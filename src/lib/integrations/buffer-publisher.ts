import fs from "fs";
import path from "path";
import {
  listAssetsForContent,
  listContentItems,
  listOrInitializePublications,
  updateContentItem,
  updatePlatformPublication,
} from "@/lib/db/repository";
import { createServerSupabaseAdminClient } from "@/lib/auth/owner-auth";
import { getStandardHashtags } from "@/lib/utils/hashtag-helper";
import {
  getBufferConnectedChannels,
  publishVideoToBufferChannel,
  updateBufferPostSchedule,
  deleteBufferPost,
  type BufferPostResult,
} from "./buffer-client";

export interface PublishToBufferParams {
  ownerId: string;
  contentId: string;
  targetPlatforms?: string[]; // e.g. ["youtube", "tiktok", "instagram"]
  scheduledTime?: string; // ISO string e.g. "2026-11-01T18:00:00Z"
  customCaption?: string;
  publishNow?: boolean;
}

export interface PublishToBufferReport {
  ok: boolean;
  contentId: string;
  contentCode: string;
  title: string;
  videoUrl: string;
  results: BufferPostResult[];
  successCount: number;
  failureCount: number;
}

/**
 * Ensures a publicly accessible HTTPS URL for Buffer ingestion.
 * 1. Checks if already stored on Supabase Storage bucket.
 * 2. If not, uploads video file to Supabase Storage and returns public URL.
 * 3. Fallback to Google Drive stream URL if available, or NEXT_PUBLIC_APP_URL.
 */
async function getOrUploadPublicVideoUrl(
  contentCode: string,
  title: string,
  storagePath: string
): Promise<string> {
  const supabase = createServerSupabaseAdminClient();
  const bucketName = process.env.ASSET_STORAGE_BUCKET || "studio-assets";
  const safeTitle = (title || "").replace(/[?:/*"<>|\\]/g, "").trim();
  const fileName = `final-${safeTitle}.mp4`;
  const objectPath = `final-videos/${fileName}`;

  if (supabase && fs.existsSync(storagePath)) {
    try {
      // Check if file already exists in bucket or upload it
      const fileBuffer = fs.readFileSync(storagePath);
      await supabase.storage.from(bucketName).upload(objectPath, fileBuffer, {
        contentType: "video/mp4",
        upsert: true,
      });

      const { data } = supabase.storage
        .from(bucketName)
        .getPublicUrl(objectPath);
      if (data?.publicUrl) {
        return data.publicUrl;
      }
    } catch {
      // Fallback below
    }
  }

  // Fallback: public app domain URL
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(
    /\/$/,
    ""
  );
  return `${appUrl}/api/assembly?contentId=${encodeURIComponent(
    contentCode
  )}&download=1`;
}

export async function publishContentToBuffer(
  params: PublishToBufferParams
): Promise<PublishToBufferReport> {
  const { ownerId, contentId, targetPlatforms, scheduledTime, customCaption } =
    params;

  const items = await listContentItems(ownerId);
  const content = items.find((i) => i.id === contentId);
  if (!content) {
    throw new Error(`CONTENT_NOT_FOUND: Konten ID "${contentId}" tidak ditemukan.`);
  }

  const assets = await listAssetsForContent(ownerId, contentId);
  const finalVideo = assets.find((a) => a.assetType === "final_video");

  if (!finalVideo || !finalVideo.storagePath) {
    throw new Error(
      `VIDEO_NOT_READY: Video master "00Final.mp4" belum dirakit untuk "${content.contentCode}". Silakan rakit video terlebih dahulu.`
    );
  }

  if (!fs.existsSync(finalVideo.storagePath)) {
    throw new Error(
      `FILE_MISSING: File video tidak ditemukan di path: ${finalVideo.storagePath}`
    );
  }

  // 1. Get or create a public video URL for Buffer ingestion
  const publicVideoUrl = await getOrUploadPublicVideoUrl(
    content.contentCode,
    content.title,
    finalVideo.storagePath
  );

  // 2. Fetch connected channels from Buffer
  const channels = await getBufferConnectedChannels();
  if (channels.length === 0) {
    throw new Error(
      "NO_CHANNELS: Belum ada channel medsos yang terhubung di akun Buffer Anda."
    );
  }

  // 3. Filter channels based on targetPlatforms
  const matchingChannels = channels.filter((ch) => {
    if (!targetPlatforms || targetPlatforms.length === 0) return true;
    return targetPlatforms.includes(ch.service);
  });

  if (matchingChannels.length === 0) {
    throw new Error(
      `NO_MATCHING_CHANNELS: Tidak ditemukan channel yang cocok untuk platform: ${targetPlatforms?.join(
        ", "
      )}`
    );
  }

  // 4. Construct rich post text with title, description, and strict 3 standard hashtags
  const standardHashtags = getStandardHashtags(content.title, content.topic);
  const defaultCaption =
    `${content.title}\n\n${content.hook || ""}\n\n${standardHashtags}`.trim();

  // 5. Post to each matching channel (with duplicate safeguard)
  const existingPubs = await listOrInitializePublications(ownerId, contentId).catch(() => []);
  const results: BufferPostResult[] = [];

  for (const ch of matchingChannels) {
    try {
      let channelText = customCaption?.trim();
      if (!channelText) {
        let rawText = "";
        if (ch.service === "tiktok" && content.tiktokCaption?.trim()) {
          rawText = content.tiktokCaption.trim();
        } else if (ch.service === "instagram" && content.instagramCaption?.trim()) {
          rawText = content.instagramCaption.trim();
        } else if (ch.service === "youtube" && content.youtubeDescription?.trim()) {
          rawText = content.youtubeDescription.trim();
        } else {
          rawText = defaultCaption;
        }

        // Pastikan caption diakhiri dengan tepat 3 hashtag resmi
        const withoutOldTags = rawText.replace(/(?:#[a-zA-Z0-9_]+\s*)+$/g, "").trim();
        channelText = `${withoutOldTags}\n\n${standardHashtags}`.trim();
      }

      const existingPub = existingPubs.find(
        (p) => p.platform.toLowerCase() === ch.service.toLowerCase()
      );
      const existingPostId = existingPub?.externalPostUrl
        ? existingPub.externalPostUrl.split("/").pop()?.trim()
        : undefined;

      // STRICT ANTI-DUPLICATE GUARD: If this channel was ALREADY published, block duplicate post!
      if (existingPub?.publishStatus === "published") {
        results.push({
          ok: true,
          channelId: ch.id,
          service: ch.service,
          postId: existingPostId || "already-published",
          status: "published",
        });
        continue;
      }

      // ANTI-DUPLICATE SAFEGUARD: If this post was ALREADY scheduled in Buffer,
      // UPDATE the existing Buffer post's dueAt instead of creating a duplicate!
      if (!params.publishNow && existingPub?.publishStatus === "scheduled" && existingPostId) {
        const updateRes = await updateBufferPostSchedule({
          postId: existingPostId,
          dueAt: scheduledTime || existingPub.scheduledAt || new Date(Date.now() + 86400000).toISOString(),
          text: channelText,
        });

        if (updateRes.ok) {
          results.push({
            ok: true,
            channelId: ch.id,
            service: ch.service,
            postId: existingPostId,
            status: "scheduled",
            dueAt: updateRes.dueAt || scheduledTime,
          });
          continue;
        }
        // If update failed (e.g. post was deleted externally on Buffer), proceed to recreate
      }

      const res = await publishVideoToBufferChannel({
        channelId: ch.id,
        service: ch.service,
        title: content.title,
        text: channelText,
        videoUrl: publicVideoUrl,
        dueAt: scheduledTime,
        publishNow: params.publishNow,
      });
      results.push(res);
    } catch (postErr) {
      results.push({
        ok: false,
        channelId: ch.id,
        service: ch.service,
        error: postErr instanceof Error ? postErr.message : "Error saat post",
      });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const failureCount = results.length - successCount;

  // 6. Update content status and individual platform publication records in DB
  if (successCount > 0) {
    await updateContentItem(ownerId, {
      id: contentId,
      contentStatus: "published",
      publishedAt: new Date().toISOString(),
    });

    try {
      const pubs = await listOrInitializePublications(ownerId, contentId);
      for (const res of results) {
        if (res.ok) {
          const pub = pubs.find(
            (p) => p.platform.toLowerCase() === res.service.toLowerCase()
          );
          if (pub) {
            await updatePlatformPublication(ownerId, {
              publicationId: pub.id,
              publishStatus: scheduledTime ? "scheduled" : "published",
              scheduledAt: scheduledTime || null,
              externalPostUrl: res.postId
                ? `https://buffer.com/app/posts/${res.postId}`
                : "",
            });
          }
        }
      }
    } catch (pubErr) {
      console.warn("Gagal memperbarui status publikasi platform di database:", pubErr);
    }
  }

  return {
    ok: successCount > 0,
    contentId: content.id,
    contentCode: content.contentCode,
    title: content.title,
    videoUrl: publicVideoUrl,
    results,
    successCount,
    failureCount,
  };
}

/**
 * Reschedules all active scheduled posts of a content item in Buffer.
 * Updates dueAt on Buffer and keeps database records in sync.
 */
export async function rescheduleContentInBuffer(params: {
  ownerId: string;
  contentId: string;
  newScheduledTime: string;
}): Promise<{ ok: boolean; updatedCount: number; errors: string[] }> {
  const { ownerId, contentId, newScheduledTime } = params;
  const pubs = await listOrInitializePublications(ownerId, contentId).catch(() => []);
  const scheduledPubs = pubs.filter(
    (p) => p.publishStatus === "scheduled" && p.externalPostUrl
  );

  let updatedCount = 0;
  const errors: string[] = [];

  for (const pub of scheduledPubs) {
    const postId = pub.externalPostUrl?.split("/").pop()?.trim();
    if (!postId) continue;

    const res = await updateBufferPostSchedule({
      postId,
      dueAt: newScheduledTime,
    });

    if (res.ok) {
      updatedCount++;
      await updatePlatformPublication(ownerId, {
        publicationId: pub.id,
        scheduledAt: newScheduledTime,
      });
    } else if (res.error) {
      errors.push(`${pub.platform}: ${res.error}`);
    }
  }

  // Update content item scheduledPublishAt
  await updateContentItem(ownerId, {
    id: contentId,
    scheduledPublishAt: newScheduledTime,
  });

  return {
    ok: updatedCount > 0 || errors.length === 0,
    updatedCount,
    errors,
  };
}

/**
 * Cancels scheduled posts for a content item in Buffer.
 * Calls Buffer deletePost mutation and resets database status to ready_to_publish.
 */
export async function cancelScheduledContentInBuffer(params: {
  ownerId: string;
  contentId: string;
}): Promise<{ ok: boolean; deletedCount: number; errors: string[] }> {
  const { ownerId, contentId } = params;
  const pubs = await listOrInitializePublications(ownerId, contentId).catch(() => []);
  const scheduledPubs = pubs.filter(
    (p) => p.publishStatus === "scheduled" && p.externalPostUrl
  );

  let deletedCount = 0;
  const errors: string[] = [];

  for (const pub of scheduledPubs) {
    const postId = pub.externalPostUrl?.split("/").pop()?.trim();
    if (!postId) continue;

    const res = await deleteBufferPost(postId);
    if (res.ok) {
      deletedCount++;
    } else if (res.error) {
      errors.push(`${pub.platform}: ${res.error}`);
    }

    // Reset platform publication status in database
    await updatePlatformPublication(ownerId, {
      publicationId: pub.id,
      publishStatus: "ready_for_manual_upload",
      scheduledAt: null,
      externalPostUrl: "",
    });
  }

  // Reset content item status in database
  await updateContentItem(ownerId, {
    id: contentId,
    contentStatus: "ready_to_publish",
    scheduledPublishAt: null,
  });

  return {
    ok: true,
    deletedCount,
    errors,
  };
}
