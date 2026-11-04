/**
 * CeritaObim Studio — Automatic Public Video & Analytics Sync Engine
 *
 * Mengambil link publik (TikTok, YouTube Shorts, Instagram Reels) dan metrik
 * performa (views, likes, comments, watch time) langsung dari Buffer API secara otomatis
 * tanpa perlu creator menginput link secara manual.
 */

import {
  listContentItems,
  listOrInitializePublications,
  updatePlatformPublication,
  upsertContentAnalytics,
} from "@/lib/db/repository";
import {
  fetchBufferPostDetails,
  extractMetricsMap,
  type ParsedBufferMetrics,
} from "@/lib/integrations/buffer-client";
import { TelegramClient } from "@/features/telegram/telegram-client";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import type { PlatformAnalyticsMetrics } from "@/types/domain";

export interface SyncAnalyticsResult {
  ok: boolean;
  syncedCount: number;
  updatedPublications: Array<{
    contentId: string;
    contentCode: string;
    title: string;
    platform: string;
    publicUrl: string;
    metrics: ParsedBufferMetrics;
  }>;
  errors: string[];
}

/**
 * Mengekstrak Buffer Post ID dari URL Buffer atau catatan metadata.
 */
export function extractBufferPostId(urlOrNotes?: string | null): string | null {
  if (!urlOrNotes) return null;
  // Format 1: https://buffer.com/app/posts/6ae864e2b0da614b55402ef9
  const matchUrl = urlOrNotes.match(/buffer\.com\/app\/posts\/([a-f0-9]{24})/i);
  if (matchUrl && matchUrl[1]) return matchUrl[1];

  // Format 2: bufferPostId:6ae864e2b0da614b55402ef9
  const matchNotes = urlOrNotes.match(/bufferPostId:([a-f0-9]{24})/i);
  if (matchNotes && matchNotes[1]) return matchNotes[1];

  // Format 3: Raw 24 hex char ID
  if (/^[a-f0-9]{24}$/i.test(urlOrNotes.trim())) return urlOrNotes.trim();

  return null;
}

/**
 * Sinkronisasi otomatis seluruh publikasi video dari Buffer API ke database studio:
 * 1. Mengambil link publik video (TikTok/YouTube Shorts/Instagram Reels).
 * 2. Mengambil angka Views, Likes, Comments, Shares, & Watch Time.
 * 3. Memperbarui tabel publikasi & analitik di database.
 * 4. Mengirimkan notifikasi selebrasi jika ada video yang menembus milestone views.
 */
export async function syncBufferAnalyticsForPublishedItems(
  ownerId: string = DEFAULT_OWNER_ID,
  options?: { notifyTelegram?: boolean }
): Promise<SyncAnalyticsResult> {
  const result: SyncAnalyticsResult = {
    ok: true,
    syncedCount: 0,
    updatedPublications: [],
    errors: [],
  };

  try {
    const [publications, items] = await Promise.all([
      listOrInitializePublications(ownerId),
      listContentItems(ownerId, { includeArchived: true }),
    ]);

    const itemMap = new Map(items.map((it) => [it.id, it]));
    const telegramClient = new TelegramClient();

    for (const pub of publications) {
      // Cari Buffer Post ID dari externalPostUrl atau notes
      const bufferPostId =
        extractBufferPostId(pub.externalPostUrl) ||
        extractBufferPostId(pub.notes);

      if (!bufferPostId) continue;

      try {
        const postDetail = await fetchBufferPostDetails(bufferPostId);
        if (!postDetail) continue;

        const content = itemMap.get(pub.contentId);
        const parsedMetrics = extractMetricsMap(postDetail.metrics);
        const publicUrl = postDetail.externalLink || pub.externalPostUrl || "";

        // 1. Update Platform Publication jika ada link publik atau perubahan status
        const isNowSent = postDetail.status === "sent";
        const hasNewPublicLink =
          postDetail.externalLink &&
          postDetail.externalLink !== pub.externalPostUrl;

        if (hasNewPublicLink || (isNowSent && pub.publishStatus !== "published")) {
          await updatePlatformPublication(ownerId, {
            publicationId: pub.id,
            publishStatus: isNowSent ? "published" : pub.publishStatus,
            externalPostUrl: postDetail.externalLink || pub.externalPostUrl,
            notes: `bufferPostId:${bufferPostId}${pub.notes ? " | " + pub.notes : ""}`,
          });
        }

        // 2. Update Content Analytics ke Database
        const platformKey = (
          postDetail.channelService ||
          pub.platform ||
          "tiktok"
        ).toLowerCase();

        const platformMetrics: Partial<PlatformAnalyticsMetrics> = {
          views: parsedMetrics.views,
          likes: parsedMetrics.likes,
          comments: parsedMetrics.comments,
          shares: parsedMetrics.shares,
          watchTimeHours: parsedMetrics.watchTimeHours,
          ctrPercentage: parsedMetrics.engagementRate,
        };

        const updatePayload: {
          contentId: string;
          tiktok?: Partial<PlatformAnalyticsMetrics>;
          youtube?: Partial<PlatformAnalyticsMetrics>;
          instagram?: Partial<PlatformAnalyticsMetrics>;
        } = {
          contentId: pub.contentId,
        };

        if (platformKey.includes("tiktok")) {
          updatePayload.tiktok = platformMetrics;
        } else if (platformKey.includes("youtube")) {
          updatePayload.youtube = platformMetrics;
        } else if (platformKey.includes("instagram")) {
          updatePayload.instagram = platformMetrics;
        }

        await upsertContentAnalytics(ownerId, updatePayload);

        result.syncedCount++;
        result.updatedPublications.push({
          contentId: pub.contentId,
          contentCode: content?.contentCode || "CO-OBIM",
          title: content?.title || pub.titleOrHook || "Konten Obim",
          platform: platformKey,
          publicUrl,
          metrics: parsedMetrics,
        });

        // 3. Notifikasi Telegram opsional jika views tinggi (Milestone Alert)
        if (
          options?.notifyTelegram &&
          parsedMetrics.views >= 500 &&
          content &&
          telegramClient.isConfigured()
        ) {
          const allowedUser = (process.env.TELEGRAM_ALLOWED_USER_ID || "").trim();
          if (allowedUser) {
            const serviceName = platformKey.includes("tiktok")
              ? "TikTok"
              : platformKey.includes("youtube")
              ? "YouTube Shorts"
              : "Instagram Reels";

            await telegramClient.sendMessage(
              allowedUser,
              `🎉 <b>Milestone Performa Konten!</b>\n\n` +
                `Video <b>${content.contentCode}: "${content.title}"</b>\n` +
                `👀 Sudah meraih <b>${parsedMetrics.views.toLocaleString()} views</b> di ${serviceName}!\n` +
                `❤️ ${parsedMetrics.likes} likes • ⏱️ ${Math.round(parsedMetrics.watchTimeHours * 60)} menit tontonan\n` +
                (publicUrl ? `🔗 <a href="${publicUrl}">Tonton Video di ${serviceName}</a>` : "")
            ).catch(() => {});
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Gagal sync post ${bufferPostId}: ${msg}`);
      }
    }
  } catch (err) {
    result.ok = false;
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Error utama sinkronisasi: ${msg}`);
  }

  return result;
}
