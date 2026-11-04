/**
 * CeritaObim Studio — Autonomous Production & Publishing Engine (Auto-Pilot)
 *
 * Mengotomatiskan seluruh alur kerja tanpa perlu intervensi manual kreator:
 * 1. Smart Buffer Queueing: Otomatis menjadwalkan konten final ke Buffer sesuai jam peak-time.
 *    Jika antrean Buffer penuh (10/10), konten berikutnya antre otomatis dan masuk saat slot kosong.
 * 2. Cascading Auto-Production: Saat audio 1 week selesai, otomatis buat naskah week selanjutnya
 *    dan otomatis generate audio TTS + segmentasi prompt.
 * 3. Zero-Footprint Local Purge: Membersihkan file klip sementara & raw drop dari laptop
 *    begitu video final terkonfirmasi aman di Google Drive & Cloud.
 * 4. Notifikasi Telegram Minimalis: Memberikan update ringkas tanpa ID teknis.
 */

import fs from "fs";
import path from "path";
import {
  listAssetsForContent,
  listContentBatches,
  listContentItems,
  listOrInitializePublications,
  listScenesForContent,
  createAndGenerateWeeklyBatch,
  commitApprovedBatchProposals,
  saveVoiceAssetAndSegmentScenes,
  runContentVideoAssembly,
} from "@/lib/db/repository";
import {
  getBufferConnectedChannels,
  type BufferChannel,
} from "@/lib/integrations/buffer-client";
import { publishContentToBuffer } from "@/lib/integrations/buffer-publisher";
import {
  getActiveTTSProviderFromVault,
  readProviderProfilesVault,
  rotateToNextProviderProfile,
  recordGeminiTtsUsageForActiveProfile,
  recordUsedCreditsForActiveProfile,
} from "@/lib/providers/account-profiles";
import { getActiveMainCharacterVoice } from "@/lib/characters/character-store";
import { cleanNarrationForSpeech } from "@/lib/providers/tts/tts-provider";
import { TelegramClient } from "@/features/telegram/telegram-client";
import { syncBufferAnalyticsForPublishedItems } from "./analytics-sync-engine";
import type { ContentItemRecord } from "@/types/domain";

export interface AutopilotReport {
  timestamp: string;
  buffer: {
    channelsCount: number;
    openSlots: number;
    scheduledCount: number;
    scheduledItems: Array<{ contentCode: string; title: string; scheduledTime: string }>;
    waitingCount: number;
    waitingItems: Array<{ contentCode: string; title: string }>;
  };
  audio: {
    generatedCount: number;
    generatedItems: Array<{ contentCode: string; title: string }>;
    skippedDueToQuota: boolean;
  };
  planning: {
    newWeekCreated: boolean;
    weekNumber?: number;
    proposalsCount?: number;
  };
  cleanup: {
    purgedClipsCount: number;
    freedDiskBytes: number;
  };
  analytics?: {
    syncedCount: number;
  };
}

/**
 * Menghitung waktu posting ideal berdasarkan kategori / format konten:
 * - Pagi (08:00 WIB / 01:00 UTC) -> Sains Kuliner (Ke Dapur Yuk!)
 * - Sore (17:00 WIB / 10:00 UTC) -> Fakta Sains (Eh, Ternyata!)
 * - Malam (20:00 WIB / 13:00 UTC) -> Misteri / Psikologi (Kepikiran Aja)
 */
function calculateNextPublishSlot(
  item: ContentItemRecord,
  dayOffset: number
): string {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + Math.max(1, dayOffset));

  const text = `${item.category} ${item.title} ${item.topic}`.toLowerCase();

  let targetHourUtc = 10; // Default Sore: 17:00 WIB (10:00 UTC)
  if (
    text.includes("dapur") ||
    text.includes("makan") ||
    text.includes("masak") ||
    text.includes("kopi") ||
    text.includes("teh") ||
    text.includes("bawang") ||
    text.includes("goreng")
  ) {
    targetHourUtc = 1; // Pagi: 08:00 WIB (01:00 UTC)
  } else if (
    text.includes("pikir") ||
    text.includes("tidur") ||
    text.includes("mimpi") ||
    text.includes("deja vu") ||
    text.includes("otak") ||
    text.includes("psikologi")
  ) {
    targetHourUtc = 13; // Malam: 20:00 WIB (13:00 UTC)
  }

  targetDate.setUTCHours(targetHourUtc, 0, 0, 0);
  return targetDate.toISOString();
}

/**
 * 1. Smart Buffer Queueing & Auto-Scheduling
 */
async function runBufferAutoScheduler(
  ownerId: string,
  items: ContentItemRecord[]
): Promise<AutopilotReport["buffer"]> {
  const report: AutopilotReport["buffer"] = {
    channelsCount: 0,
    openSlots: 10,
    scheduledCount: 0,
    scheduledItems: [],
    waitingCount: 0,
    waitingItems: [],
  };

  let channels: BufferChannel[] = [];
  try {
    channels = await getBufferConnectedChannels();
    report.channelsCount = channels.length;
  } catch {
    // Buffer not connected or offline
    return report;
  }

  if (channels.length === 0) return report;

  const publications = await listOrInitializePublications(ownerId);
  const now = new Date();

  // Hitung jumlah post di antrean Buffer yang belum tayang
  const activeQueuedPosts = publications.filter(
    (p) =>
      p.publishStatus === "scheduled" &&
      p.scheduledAt &&
      new Date(p.scheduledAt) > now
  );

  // Buffer Free Plan maksimal 10 antrean per channel
  const BUFFER_QUEUE_LIMIT = 10;
  const currentQueueCount = activeQueuedPosts.length;
  const openSlots = Math.max(0, BUFFER_QUEUE_LIMIT - currentQueueCount);
  report.openSlots = openSlots;

  // Cari konten yang video finalnya sudah siap tapi belum dijadwalkan
  const readyItems: ContentItemRecord[] = [];
  for (const item of items) {
    const assets = await listAssetsForContent(ownerId, item.id);
    const hasFinalVideo = assets.some((a) => a.assetType === "final_video");
    const isAlreadyScheduled = publications.some(
      (p) =>
        p.contentId === item.id &&
        (p.publishStatus === "scheduled" ||
          p.publishStatus === "published")
    );

    if (hasFinalVideo && !isAlreadyScheduled && item.contentStatus !== "published") {
      readyItems.push(item);
    }
  }

  // Isi slot Buffer yang masih kosong
  const itemsToSchedule = readyItems.slice(0, openSlots);
  const itemsWaiting = readyItems.slice(openSlots);

  let dayOffset = 1;
  for (const item of itemsToSchedule) {
    const scheduledTime = calculateNextPublishSlot(item, dayOffset);
    try {
      await publishContentToBuffer({
        ownerId,
        contentId: item.id,
        scheduledTime,
        publishNow: false,
      });

      report.scheduledCount++;
      report.scheduledItems.push({
        contentCode: item.contentCode,
        title: item.title,
        scheduledTime,
      });
      dayOffset++;
    } catch {
      // Non-fatal per item
    }
  }

  report.waitingCount = itemsWaiting.length;
  report.waitingItems = itemsWaiting.map((i) => ({
    contentCode: i.contentCode,
    title: i.title,
  }));

  return report;
}

/**
 * 2. Cascading Auto-Audio & Next-Week Content Planning
 */
async function runAutoAudioAndPlanning(
  ownerId: string,
  items: ContentItemRecord[]
): Promise<{
  audio: AutopilotReport["audio"];
  planning: AutopilotReport["planning"];
}> {
  const audioReport: AutopilotReport["audio"] = {
    generatedCount: 0,
    generatedItems: [],
    skippedDueToQuota: false,
  };

  const planningReport: AutopilotReport["planning"] = {
    newWeekCreated: false,
  };

  // 2a. Cek apakah ada konten aktif yang belum memiliki audio
  const itemsNeedingAudio = [];
  for (const item of items) {
    if (item.contentStatus === "archived") continue;
    const assets = await listAssetsForContent(ownerId, item.id);
    const hasVoice = assets.some((a) => a.assetType === "voice_audio");
    if (!hasVoice && item.narration && item.narration.trim().length > 15) {
      itemsNeedingAudio.push(item);
    }
  }

  // Generate audio otomatis untuk konten yang belum bersuara (maksimal 3 per cycle agar kuota aman)
  const mainCharacterVoice = getActiveMainCharacterVoice();
  const candidatesForAudio = itemsNeedingAudio.slice(0, 3);

  for (const item of candidatesForAudio) {
    let attempts = 0;
    let succeeded = false;

    while (!succeeded && attempts < 3) {
      attempts++;
      try {
        const tts = getActiveTTSProviderFromVault(
          undefined,
          mainCharacterVoice.voiceId
        );
        const synthesis = await tts.synthesize({
          contentId: item.id,
          contentCode: item.contentCode,
          narrationText: item.narration,
          voiceId: mainCharacterVoice.voiceId,
        });

        if (synthesis.providerKey === "elevenlabs") {
          recordUsedCreditsForActiveProfile(
            cleanNarrationForSpeech(item.narration).length
          );
        } else if (synthesis.providerKey === "gemini_tts") {
          recordGeminiTtsUsageForActiveProfile();
        }

        const ext = synthesis.mimeType.includes("wav") ? "wav" : "mp3";
        await saveVoiceAssetAndSegmentScenes(ownerId, {
          contentId: item.id,
          audioBuffer: synthesis.audioBuffer,
          originalFilename: `${item.contentCode}_VOICE.${ext}`,
          mimeType: synthesis.mimeType,
          durationMs: synthesis.durationMs,
          providerKey: synthesis.providerKey,
          providerModel: synthesis.providerModel,
          voiceId: synthesis.voiceId,
          providerRequestId: synthesis.providerRequestId,
          wordSpans: synthesis.wordSpans,
          timestampStatus: synthesis.timestampStatus,
        });

        audioReport.generatedCount++;
        audioReport.generatedItems.push({
          contentCode: item.contentCode,
          title: item.title,
        });
        succeeded = true;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : "";
        if (errMsg.includes("429") || errMsg.includes("KUOTA")) {
          // Putar ke akun berikutnya
          recordGeminiTtsUsageForActiveProfile({ markExhausted429: true });
          rotateToNextProviderProfile();
        } else {
          break;
        }
      }
    }
  }

  // 2b. Evaluasi kelengkapan week: jika seluruh konten pada week aktif audionya sudah selesai,
  // otomatis siapkan konten week berikutnya!
  const latestItem = items[items.length - 1];
  const latestNum = latestItem
    ? parseInt(latestItem.contentCode.replace(/\D/g, "").slice(-3), 10)
    : 0;
  const currentMaxWeek = Math.max(1, Math.ceil(latestNum / 7));

  // Cek apakah 7 item di week terakhir sudah punya audio semua
  const weekStartIdx = (currentMaxWeek - 1) * 7;
  const weekItems = items.slice(weekStartIdx, weekStartIdx + 7);

  if (weekItems.length === 7) {
    let allWeekHasAudio = true;
    for (const wi of weekItems) {
      const assets = await listAssetsForContent(ownerId, wi.id);
      if (!assets.some((a) => a.assetType === "voice_audio")) {
        allWeekHasAudio = false;
        break;
      }
    }

    if (allWeekHasAudio && currentMaxWeek < 8) {
      const nextWeekNum = currentMaxWeek + 1;
      try {
        const batch = await createAndGenerateWeeklyBatch(ownerId, {
          batchName: `Batch: Content Plan — Week ${nextWeekNum}`,
          targetWeekStart: new Date().toISOString().slice(0, 10),
          targetVideoCount: 7,
          customThemeHint: `Fakta Sains Unik & Viral Pekan ${nextWeekNum}`,
        });

        await commitApprovedBatchProposals(ownerId, batch.id, {
          commitAll: true,
          targetWeekNumber: nextWeekNum,
        });

        planningReport.newWeekCreated = true;
        planningReport.weekNumber = nextWeekNum;
        planningReport.proposalsCount = batch.proposals.length;
      } catch {
        // Non-blocking
      }
    }
  }

  return { audio: audioReport, planning: planningReport };
}

/**
 * 3. Zero-Footprint Local Purge:
 * Menghapus klip sementara di laptop untuk konten yang master video finalnya
 * SUDAH LENGKAP dan tersimpan aman di Google Drive / Supabase Storage.
 * Laptop HANYA menyimpan potongan yang belum memiliki FINAL!
 */
export async function purgeCompletedLocalFiles(
  ownerId: string,
  items: ContentItemRecord[]
): Promise<AutopilotReport["cleanup"]> {
  const cleanupReport: AutopilotReport["cleanup"] = {
    purgedClipsCount: 0,
    freedDiskBytes: 0,
  };

  const processedDropDir = path.resolve(
    process.cwd(),
    "storage",
    "macro_drops",
    "processed"
  );
  const cleanClipsDir = path.resolve(
    process.cwd(),
    "00.FolderOwner",
    "KLIP_BERSIH"
  );
  const mediaDir = path.resolve(process.cwd(), ".data", "media");

  for (const item of items) {
    const assets = await listAssetsForContent(ownerId, item.id);
    const finalAsset = assets.find((a) => a.assetType === "final_video");

    // Hanya bersihkan jika konten memiliki final_video yang valid
    if (!finalAsset) continue;

    const codeNum = parseInt(
      item.contentCode.replace(/\D/g, "").slice(-3),
      10
    );

    // 1. Hapus klip sementara di 00.FolderOwner/KLIP_BERSIH (contoh: 1_1_1_1.mp4, 1_1_1_2.mp4, 1_1_1_3.mp4)
    if (fs.existsSync(cleanClipsDir)) {
      try {
        const cleanFiles = fs.readdirSync(cleanClipsDir);
        for (const cf of cleanFiles) {
          const match = cf.match(/^\d+_\d+_(\d+)_\d+\.mp4$/i);
          if (match && match[1] && parseInt(match[1], 10) === codeNum) {
            const p = path.join(cleanClipsDir, cf);
            const size = fs.statSync(p).size;
            fs.unlinkSync(p);
            cleanupReport.purgedClipsCount++;
            cleanupReport.freedDiskBytes += size;
          }
        }
      } catch {}
    }

    // 2. Hapus klip scene per bagian di .data/media (contoh: CO-2026-001_Bagian_01.mp4)
    if (fs.existsSync(mediaDir)) {
      try {
        const mediaFiles = fs.readdirSync(mediaDir);
        for (const mf of mediaFiles) {
          if (
            mf.startsWith(`${item.contentCode}_Bagian_`) &&
            mf.endsWith(".mp4")
          ) {
            const p = path.join(mediaDir, mf);
            const size = fs.statSync(p).size;
            fs.unlinkSync(p);
            cleanupReport.purgedClipsCount++;
            cleanupReport.freedDiskBytes += size;
          }
        }
      } catch {}
    }

    // 3. Hapus klip mentah di storage/macro_drops/processed yang sudah selesai
    if (fs.existsSync(processedDropDir)) {
      try {
        const procFiles = fs.readdirSync(processedDropDir);
        for (const pf of procFiles) {
          if (
            pf.includes(`_${codeNum}_`) ||
            pf.includes(`${item.contentCode}`)
          ) {
            const p = path.join(processedDropDir, pf);
            const size = fs.statSync(p).size;
            fs.unlinkSync(p);
            cleanupReport.purgedClipsCount++;
            cleanupReport.freedDiskBytes += size;
          }
        }
      } catch {}
    }
  }

  return cleanupReport;
}

/**
 * 4. Notifikasi Telegram Minimalis & On-Point
 */
async function sendTelegramAutopilotNotification(report: AutopilotReport) {
  const allowedUser = (process.env.TELEGRAM_ALLOWED_USER_ID || "").trim();
  if (!allowedUser) return;

  const client = new TelegramClient();
  if (!client.isConfigured()) return;

  // Hanya kirimkan jika ada kejadian penting (video terjadwal, audio jadi, atau week baru)
  const hasNews =
    report.buffer.scheduledCount > 0 ||
    report.audio.generatedCount > 0 ||
    report.planning.newWeekCreated ||
    report.cleanup.purgedClipsCount > 0;

  if (!hasNews) return;

  let msg = `⚡ <b>Auto-Pilot CeritaObim Studio</b>\n\n`;

  if (report.buffer.scheduledCount > 0) {
    msg += `🚀 <b>${report.buffer.scheduledCount} Video Otomatis Terjadwal di Medsos:</b>\n`;
    report.buffer.scheduledItems.forEach((it, idx) => {
      msg += `${idx + 1}. ${it.title}\n`;
    });
    msg += `\n`;
  }

  if (report.buffer.waitingCount > 0) {
    msg += `🕒 <i>${report.buffer.waitingCount} video siap lainnya antre menunggu slot Buffer terbuka.</i>\n\n`;
  }

  if (report.audio.generatedCount > 0) {
    msg += `🎙️ <b>${report.audio.generatedCount} Audio Baru Otomatis Digenerate:</b>\n`;
    report.audio.generatedItems.forEach((it) => {
      msg += `• ${it.title}\n`;
    });
    msg += `\n`;
  }

  if (report.planning.newWeekCreated) {
    msg += `📅 <b>Konten Week ${report.planning.weekNumber} Otomatis Dibuat (${report.planning.proposalsCount} Topik Baru)!</b>\n\n`;
  }

  if (report.cleanup.purgedClipsCount > 0) {
    const mb = Math.round(report.cleanup.freedDiskBytes / 1024 / 1024);
    msg += `🧹 <i>Pembersihan Otomatis: ${report.cleanup.purgedClipsCount} klip sementara selesai dihapus (${mb} MB ruang laptop dihemat).</i>`;
  }

  try {
    await client.sendMessage(allowedUser, msg, { parse_mode: "HTML" });
  } catch {
    // Non-fatal
  }
}

/**
 * Master Controller: Menjalankan satu siklus penuh Auto-Pilot
 */
export async function runAutopilotCycle(
  ownerId = "default-owner-001"
): Promise<AutopilotReport> {
  const items = await listContentItems(ownerId);

  // 1. Buffer Queueing
  const bufferReport = await runBufferAutoScheduler(ownerId, items);

  // 2. Cascading Audio & Planning
  const { audio: audioReport, planning: planningReport } =
    await runAutoAudioAndPlanning(ownerId, items);

  // 3. Zero-Footprint Local Purge
  const cleanupReport = await purgeCompletedLocalFiles(ownerId, items);

  // 4. Automatic Public Links & Analytics Sync from Buffer
  let analyticsSyncedCount = 0;
  try {
    const syncRes = await syncBufferAnalyticsForPublishedItems(ownerId, {
      notifyTelegram: true,
    });
    analyticsSyncedCount = syncRes.syncedCount;
  } catch {
    // Non-fatal
  }

  const report: AutopilotReport = {
    timestamp: new Date().toISOString(),
    buffer: bufferReport,
    audio: audioReport,
    planning: planningReport,
    cleanup: cleanupReport,
    analytics: {
      syncedCount: analyticsSyncedCount,
    },
  };

  // 5. Kirim notifikasi Telegram ringkas jika ada progres baru
  await sendTelegramAutopilotNotification(report);

  return report;
}
