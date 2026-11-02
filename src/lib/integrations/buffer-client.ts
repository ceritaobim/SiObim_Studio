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
  title?: string;
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

  const cleanTitle = (params.title || params.text.split("\n")[0] || "Cerita Obim").trim();

  // Construct metadata based on platform
  const metadata: Record<string, unknown> = {};
  if (params.service === "instagram") {
    metadata.instagram = {
      type: "reel",
      shouldShareToFeed: true,
      isAiGenerated: true,
    };
  } else if (params.service === "tiktok") {
    metadata.tiktok = {
      title: cleanTitle.slice(0, 80),
      isAiGenerated: true,
    };
  } else if (params.service === "youtube") {
    metadata.youtube = {
      title: cleanTitle.slice(0, 95),
      categoryId: "27", // Education category
      privacy: "public",
      madeForKids: false,
      isAiGenerated: true,
    };
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
      ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
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

  if (data.errors && data.errors.length > 0) {
    const errorMsg = data.errors
      .map((e: { message?: string }) => e.message || "Error")
      .join(" | ");
    return {
      ok: false,
      channelId: params.channelId,
      service: params.service,
      error: errorMsg,
    };
  }
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

/**
 * Updates the scheduled time (dueAt) or caption of an existing post in Buffer.
 * This prevents creating duplicate posts when creators adjust their schedule.
 */
export async function updateBufferPostSchedule(params: {
  postId: string;
  dueAt: string;
  text?: string;
}): Promise<{ ok: boolean; postId?: string; dueAt?: string; error?: string }> {
  const token = getBufferToken();

  const query = `
    mutation EditPost($input: EditPostInput!) {
      editPost(input: $input) {
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

  const input: Record<string, unknown> = {
    id: params.postId,
    dueAt: params.dueAt,
    mode: "customScheduled",
  };
  if (params.text) {
    input.text = params.text;
  }

  const res = await fetch("https://api.buffer.com", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ query, variables: { input } }),
  });

  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    return {
      ok: false,
      error: data.errors.map((e: { message?: string }) => e.message || "Error").join(" | "),
    };
  }

  const result = data.data?.editPost;
  if (result?.message) {
    return { ok: false, error: result.message };
  }

  if (result?.post?.id) {
    return {
      ok: true,
      postId: result.post.id,
      dueAt: result.post.dueAt,
    };
  }

  return { ok: false, error: "Gagal memperbarui jadwal postingan di Buffer." };
}

/**
 * Deletes a scheduled post from Buffer queue.
 */
export async function deleteBufferPost(postId: string): Promise<{ ok: boolean; error?: string }> {
  const token = getBufferToken();

  const query = `
    mutation DeletePost($input: DeletePostInput!) {
      deletePost(input: $input) {
        ... on DeletePostSuccess {
          id
        }
        ... on VoidMutationError {
          message
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
    body: JSON.stringify({
      query,
      variables: { input: { id: postId } },
    }),
  });

  const data = await res.json();
  if (data.errors && data.errors.length > 0) {
    return {
      ok: false,
      error: data.errors.map((e: { message?: string }) => e.message || "Error").join(" | "),
    };
  }

  const result = data.data?.deletePost;
  if (result?.message) {
    return { ok: false, error: result.message };
  }

  return { ok: true };
}
