/**
 * CeritaObim Studio — Studio Store Manager (Kepala Toko Intelligence)
 *
 * Mengelola kecerdasan operasional, inventori video, jadwal upload,
 * dan setelan studio untuk asisten Telegram (Kepala Toko Obim).
 */

import {
  listContentItems,
  listAssetsForContent,
  getProjectSettings,
  saveProjectSettings,
  updateContentItem,
} from "@/lib/db/repository";
import { publishContentToBuffer, type PublishToBufferReport } from "@/lib/integrations/buffer-publisher";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import type { ContentItemRecord, ProjectSettingsSummary } from "@/types/domain";

export interface ScheduledSlotInfo {
  dateLabel: string;
  timeLabel: string;
  formatted: string;
  isToday: boolean;
  isPast: boolean;
}

export function formatScheduleWib(isoStr?: string | null): ScheduledSlotInfo {
  if (!isoStr) {
    return {
      dateLabel: "Belum dijadwalkan",
      timeLabel: "-",
      formatted: "Belum dijadwalkan",
      isToday: false,
      isPast: false,
    };
  }

  const d = new Date(isoStr);
  if (isNaN(d.getTime())) {
    return {
      dateLabel: isoStr,
      timeLabel: "-",
      formatted: isoStr,
      isToday: false,
      isPast: false,
    };
  }

  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

  // Konversi ke UTC+7 (WIB)
  const utcMs = d.getTime();
  const wibMs = utcMs + 7 * 60 * 60 * 1000;
  const wibDate = new Date(wibMs);

  const dayName = dayNames[wibDate.getUTCDay()];
  const dayNum = wibDate.getUTCDate();
  const monthName = monthNames[wibDate.getUTCMonth()];
  const year = wibDate.getUTCFullYear();
  const hours = String(wibDate.getUTCHours()).padStart(2, "0");
  const minutes = String(wibDate.getUTCMinutes()).padStart(2, "0");

  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const isToday =
    nowWib.getUTCFullYear() === year &&
    nowWib.getUTCMonth() === wibDate.getUTCMonth() &&
    nowWib.getUTCDate() === dayNum;

  const dateLabel = isToday ? `Hari ini (${dayName}, ${dayNum} ${monthName})` : `${dayName}, ${dayNum} ${monthName} ${year}`;
  const timeLabel = `${hours}:${minutes} WIB`;
  const formatted = `${dateLabel} • ${timeLabel}`;
  const isPast = d.getTime() < Date.now();

  return { dateLabel, timeLabel, formatted, isToday, isPast };
}

export interface StoreSnapshot {
  nowWibText: string;
  settings: {
    projectName: string;
    channelName: string;
    weeklyVideoTarget: number;
    dailyVideoTarget: number;
    defaultUploadHour: string;
    targetPlatforms: string[];
  };
  inventory: {
    total: number;
    publishedCount: number;
    readyCount: number;
    inProductionCount: number;
  };
  publishedItems: Array<{
    code: string;
    title: string;
    category: string;
    publishedAt?: string | null;
  }>;
  readyItems: Array<{
    id: string;
    code: string;
    title: string;
    category: string;
    scheduledPublishAt?: string | null;
    scheduleInfo: ScheduledSlotInfo;
  }>;
  inProductionItems: Array<{
    code: string;
    title: string;
    category: string;
  }>;
  nextVideoToUpload: {
    id: string;
    code: string;
    title: string;
    category: string;
    scheduleInfo: ScheduledSlotInfo;
  } | null;
  nearestScheduledVideo: {
    id: string;
    code: string;
    title: string;
    category: string;
    scheduleInfo: ScheduledSlotInfo;
  } | null;
}

export async function getStudioStoreSnapshot(): Promise<StoreSnapshot> {
  const [items, settings] = await Promise.all([
    listContentItems(DEFAULT_OWNER_ID).catch(() => [] as ContentItemRecord[]),
    getProjectSettings(DEFAULT_OWNER_ID).catch(() => ({}) as ProjectSettingsSummary),
  ]);

  // Waktu sekarang WIB
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const nowWibText = `${dayNames[nowWib.getUTCDay()]}, ${nowWib.getUTCDate()} ${monthNames[nowWib.getUTCMonth()]} ${nowWib.getUTCFullYear()} ${String(nowWib.getUTCHours()).padStart(2, "0")}:${String(nowWib.getUTCMinutes()).padStart(2, "0")} WIB`;

  const weeklyTarget = settings.weeklyVideoTarget || 7;
  const dailyTarget = Math.max(1, Math.round(weeklyTarget / 7));

  // Ambil upload hour dari note/setting atau default 19:00 WIB
  const defaultUploadHour = "19:00 WIB";

  // Identifikasi asset video yang sudah final
  const publishedList: StoreSnapshot["publishedItems"] = [];
  const readyList: StoreSnapshot["readyItems"] = [];
  const inProductionList: StoreSnapshot["inProductionItems"] = [];

  for (const item of items) {
    if (item.contentStatus === "published") {
      publishedList.push({
        code: item.contentCode,
        title: item.title,
        category: item.category,
        publishedAt: item.publishedAt,
      });
      continue;
    }

    // Periksa apakah video siap tayang (memiliki final_video atau status ready/assembled)
    let isVideoReady = item.contentStatus === "ready_to_publish" || item.contentStatus === "assembled";
    if (!isVideoReady) {
      const assets = await listAssetsForContent(DEFAULT_OWNER_ID, item.id).catch(() => []);
      if (assets.some((a) => a.assetType === "final_video")) {
        isVideoReady = true;
      }
    }

    if (isVideoReady) {
      readyList.push({
        id: item.id,
        code: item.contentCode,
        title: item.title,
        category: item.category,
        scheduledPublishAt: item.scheduledPublishAt,
        scheduleInfo: formatScheduleWib(item.scheduledPublishAt),
      });
    } else {
      inProductionList.push({
        code: item.contentCode,
        title: item.title,
        category: item.category,
      });
    }
  }

  // Video selanjutnya yang harus diupload adalah item paling atas di antrean ready
  const nextVideo = readyList[0] || null;

  // Jadwal terdekat adalah item ready yang memiliki jadwal terdekat
  const scheduledReady = readyList.filter(
    (i) => i.scheduledPublishAt && !i.scheduleInfo.isPast
  );
  scheduledReady.sort((a, b) => {
    return new Date(a.scheduledPublishAt!).getTime() - new Date(b.scheduledPublishAt!).getTime();
  });
  const nearestScheduled = scheduledReady[0] || nextVideo || null;

  return {
    nowWibText,
    settings: {
      projectName: settings.projectName || "CeritaObim Studio",
      channelName: settings.channelName || "cerita_obim",
      weeklyVideoTarget: weeklyTarget,
      dailyVideoTarget: dailyTarget,
      defaultUploadHour,
      targetPlatforms: settings.targetPlatforms || ["tiktok", "youtube", "instagram"],
    },
    inventory: {
      total: items.length,
      publishedCount: publishedList.length,
      readyCount: readyList.length,
      inProductionCount: inProductionList.length,
    },
    publishedItems: publishedList,
    readyItems: readyList,
    inProductionItems: inProductionList,
    nextVideoToUpload: nextVideo,
    nearestScheduledVideo: nearestScheduled,
  };
}

/**
 * Eksekusi Aksi: Publish Sekarang ke Buffer (YouTube Shorts, TikTok, Instagram Reels)
 */
export async function executePublishNow(
  contentCodeOrId: string
): Promise<{ ok: boolean; message: string; report?: PublishToBufferReport }> {
  const items = await listContentItems(DEFAULT_OWNER_ID);
  const target = items.find(
    (i) =>
      i.contentCode.toUpperCase() === contentCodeOrId.toUpperCase() ||
      i.id === contentCodeOrId
  );

  if (!target) {
    return {
      ok: false,
      message: `Konten <code>${contentCodeOrId}</code> tidak ditemukan di database studio.`,
    };
  }

  try {
    const report = await publishContentToBuffer({
      ownerId: DEFAULT_OWNER_ID,
      contentId: target.id,
      publishNow: true,
    });

    if (report.ok) {
      const channelSuccess = report.results
        .filter((r) => r.ok)
        .map((r) => r.service.toUpperCase())
        .join(", ");

      return {
        ok: true,
        message:
          `🚀 <b>SUKSES PUBLISH KE BUFFER!</b>\n\n` +
          `Video <b>[${target.contentCode}] "${target.title}"</b> telah dipublikasikan ke antrean live:\n` +
          `• <b>Channels:</b> ${channelSuccess || "Semua channel terhubung"}\n` +
          `• <b>Status Studio:</b> Otomatis diperbarui menjadi <b>PUBLISHED</b> ✅`,
        report,
      };
    } else {
      const errMsg = report.results
        .filter((r) => !r.ok)
        .map((r) => `${r.service}: ${r.error}`)
        .join("\n• ");

      return {
        ok: false,
        message: `⚠️ Sebagian channel gagal di-publish:\n• ${errMsg}`,
        report,
      };
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return {
      ok: false,
      message: `❌ Gagal mempublikasikan ke Buffer: ${msg}`,
    };
  }
}

/**
 * Eksekusi Aksi: Update Jadwal Tayang Konten Tertentu
 */
export async function executeSetSchedule(
  contentCode: string,
  isoDateTime: string
): Promise<{ ok: boolean; message: string }> {
  const items = await listContentItems(DEFAULT_OWNER_ID);
  const target = items.find(
    (i) => i.contentCode.toUpperCase() === contentCode.toUpperCase()
  );

  if (!target) {
    return {
      ok: false,
      message: `Konten <code>${contentCode}</code> tidak ditemukan.`,
    };
  }

  await updateContentItem(DEFAULT_OWNER_ID, {
    id: target.id,
    scheduledPublishAt: isoDateTime,
  });

  const info = formatScheduleWib(isoDateTime);

  return {
    ok: true,
    message:
      `📅 <b>JADWAL DIPERBARUI!</b>\n\n` +
      `Video <b>[${target.contentCode}] "${target.title}"</b> berhasil dijadwalkan untuk:\n` +
      `👉 <b>${info.formatted}</b>`,
  };
}

/**
 * Eksekusi Aksi: Update Setelan Studio (Target Upload Harian / Jam Upload Default)
 */
export async function executeUpdateSettings(params: {
  dailyTarget?: number;
  uploadHour?: string;
}): Promise<{ ok: boolean; message: string }> {
  const current = await getProjectSettings(DEFAULT_OWNER_ID);

  const updates: Partial<ProjectSettingsSummary> = {};
  let dailyCount = Math.round((current.weeklyVideoTarget || 7) / 7);

  if (params.dailyTarget && params.dailyTarget > 0) {
    dailyCount = params.dailyTarget;
    updates.weeklyVideoTarget = dailyCount * 7;
  }

  await saveProjectSettings(DEFAULT_OWNER_ID, {
    ...current,
    ...updates,
  });

  const hourText = params.uploadHour ? `${params.uploadHour} WIB` : "19:00 WIB";

  return {
    ok: true,
    message:
      `⚙️ <b>SETELAN STUDIO BERHASIL DISIMPAN!</b>\n\n` +
      `Kepala Toko telah menyesuaikan strategi produksi:\n` +
      `• 🎯 <b>Target Upload:</b> ${dailyCount} Video / Hari (${dailyCount * 7} Video / Minggu)\n` +
      `• ⏰ <b>Jam Tayang Default:</b> ${hourText}\n` +
      `• 📱 <b>Platform Target:</b> TikTok, YouTube Shorts, Instagram Reels`,
  };
}

/**
 * Eksekusi Aksi: Penjadwalan Otomatis Berantai untuk Semua Video Siap Tayang
 */
export async function executeAutoScheduleQueue(params?: {
  dailyCount?: number;
  uploadHour?: string;
}): Promise<{ ok: boolean; message: string }> {
  const snapshot = await getStudioStoreSnapshot();
  const ready = snapshot.readyItems;

  if (ready.length === 0) {
    return {
      ok: false,
      message: "Tidak ada video di etalase siap tayang yang perlu dijadwalkan.",
    };
  }

  const daily = params?.dailyCount || snapshot.settings.dailyVideoTarget || 1;
  const hourPart = params?.uploadHour?.replace(/[^0-9:]/g, "") || "19:00";
  const [hStr, mStr] = hourPart.split(":");
  const targetH = parseInt(hStr || "19", 10) || 19;
  const targetM = parseInt(mStr || "0", 10) || 0;

  // Mulai dari hari ini atau besok jika jam upload sudah lewat
  const now = new Date();
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  let startOffsetDays = 0;
  if (nowWib.getUTCHours() >= targetH) {
    startOffsetDays = 1; // Jadwalkan mulai besok
  }

  let scheduledCount = 0;
  const scheduleLines: string[] = [];

  for (let i = 0; i < ready.length; i++) {
    const item = ready[i];
    if (!item) continue;
    const dayIndex = startOffsetDays + Math.floor(i / daily);
    const slotIndexInDay = i % daily;

    // Hitung jam untuk slot dalam sehari (misal: slot 1 jam 12:00, slot 2 jam 19:00, atau sama rata)
    const slotHour = daily === 1 ? targetH : Math.min(21, targetH + slotIndexInDay * 4);

    const slotDate = new Date(now.getTime() + dayIndex * 24 * 60 * 60 * 1000);
    const y = slotDate.getFullYear();
    const m = String(slotDate.getMonth() + 1).padStart(2, "0");
    const d = String(slotDate.getDate()).padStart(2, "0");
    const h = String(slotHour).padStart(2, "0");
    const min = String(targetM).padStart(2, "0");

    const isoStr = `${y}-${m}-${d}T${h}:${min}:00+07:00`;

    await updateContentItem(DEFAULT_OWNER_ID, {
      id: item.id,
      scheduledPublishAt: isoStr,
    });

    scheduledCount++;
    if (i < 5) {
      const info = formatScheduleWib(isoStr);
      scheduleLines.push(`• <b>${item.code}</b>: ${info.formatted}`);
    }
  }

  return {
    ok: true,
    message:
      `🗓️ <b>ANTREAN OTOMATIS BERHASIL DIJADWALKAN!</b>\n\n` +
      `Sebanyak <b>${scheduledCount} video</b> di etalase telah dijadwalkan (${daily} video/hari):\n` +
      scheduleLines.join("\n") +
      (ready.length > 5 ? `\n<i>... dan ${ready.length - 5} video berikutnya telah dirapikan.</i>` : ""),
  };
}
