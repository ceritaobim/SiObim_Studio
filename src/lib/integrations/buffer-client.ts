export interface BufferChannel {
  id: string;
  name: string;
  displayName: string;
  service: "youtube" | "tiktok" | "instagram" | string;
  avatar?: string;
}

export interface BufferPostResult {
  ok: boolean;
  channelId: string;
  service: string;
  postId?: string;
  status?: string;
  dueAt?: string;
  error?: string;
}

function getBufferToken(): string {
  const token = process.env.BUFFER_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "BUFFER_TOKEN_MISSING: BUFFER_ACCESS_TOKEN belum dikonfigurasi di .env.local"
    );
  }
  return token;
}

export async function fetchBufferAccountAndOrg() {
  const token = getBufferToken();
  const query = `
    query {
      account {
        id
        email
        organizations {
          id
          name
        }
      }
    }
  `;

  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors[0]?.message || "Gagal mengakses profil Buffer.");
  }

  const account = data.data?.account;
  const organizationId = account?.organizations?.[0]?.id;
  return {
    accountId: account?.id,
    email: account?.email,
    organizationId,
    organizations: account?.organizations || [],
  };
}

export async function getBufferConnectedChannels(): Promise<BufferChannel[]> {
  const token = getBufferToken();
  const { organizationId } = await fetchBufferAccountAndOrg();

  if (!organizationId) {
    return [];
  }

  const query = `
    query GetChannels($input: ChannelsInput!) {
      channels(input: $input) {
        id
        name
        displayName
        service
      }
    }
  `;

  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      query,
      variables: {
        input: { organizationId },
      },
    }),
  });

  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    throw new Error(data.errors[0]?.message || "Gagal mengambil daftar channel Buffer.");
  }

  return data.data?.channels || [];
}

export async function publishVideoToBufferChannel(params: {
  channelId: string;
  service: string;
  text: string;
  videoUrl: string;
  dueAt?: string;
  publishNow?: boolean;
}): Promise<BufferPostResult> {
  const token = getBufferToken();

  let mode: "shareNow" | "customScheduled" | "addToQueue" = "addToQueue";
  if (params.publishNow) {
    mode = "shareNow";
  } else if (params.dueAt) {
    mode = "customScheduled";
  }

  // Construct metadata based on platform
  const metadata: Record<string, unknown> = {};
  if (params.service === "instagram") {
    metadata.instagram = { type: "reel" };
  } else if (params.service === "tiktok") {
    metadata.tiktok = { allowComments: true, allowDuet: true, allowStitch: true };
  }

  const query = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post {
            id
            status
            dueAt
          }
        }
        ... on MutationError {
          message
        }
      }
    }
  `;

  const variables = {
    input: {
      channelId: params.channelId,
      text: params.text,
      schedulingType: "automatic",
      mode,
      ...(mode === "customScheduled" && params.dueAt
        ? { dueAt: params.dueAt }
        : {}),
      assets: [
        {
          video: {
            url: params.videoUrl,
          },
        },
      ],
      metadata,
    },
  };

  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  const data = await res.json();
  const mutationResult = data.data?.createPost;

  if (mutationResult?.message) {
    return {
      ok: false,
      channelId: params.channelId,
      service: params.service,
      error: mutationResult.message,
    };
  }

  const post = mutationResult?.post;
  if (post?.id) {
    return {
      ok: true,
      channelId: params.channelId,
      service: params.service,
      postId: post.id,
      status: post.status,
      dueAt: post.dueAt,
    };
  }

  return {
    ok: false,
    channelId: params.channelId,
    service: params.service,
    error: data.errors?.[0]?.message || "Gagal membuat postingan di Buffer.",
  };
}
