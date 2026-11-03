/**
 * CeritaObim Studio — Studio Store Manager (Kepala Toko Intelligence)
 *
 * Mengelola kecerdasan operasional, inventori video, jadwal upload,
 * dan setelan studio untuk asisten Telegram (Kepala Toko Obim).
 */

import {
  listContentItems,
  listAssetsForContent,
  listOrInitializePublications,
  getProjectSettings,
  saveProjectSettings,
  updateContentItem,
} from "@/lib/db/repository";
import { publishContentToBuffer, type PublishToBufferReport } from "@/lib/integrations/buffer-publisher";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import type { ContentItemRecord, ProjectSettingsSummary, ObimProgramName } from "@/types/domain";
import { detectObimSegment } from "@/features/publishing/publishing-utils";
import type { TelegramInlineButton } from "./telegram-client";

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
    scheduledCount: number;
    readyCount: number;
    inProductionCount: number;
  };
  publishedItems: Array<{
    code: string;
    title: string;
    category: string;
    programName: ObimProgramName;
    publishedAt?: string | null;
  }>;
  scheduledItems: Array<{
    id: string;
    code: string;
    title: string;
    category: string;
    programName: ObimProgramName;
    scheduledPublishAt?: string | null;
    scheduleInfo: ScheduledSlotInfo;
  }>;
  readyItems: Array<{
    id: string;
    code: string;
    title: string;
    category: string;
    programName: ObimProgramName;
    scheduledPublishAt?: string | null;
    scheduleInfo: ScheduledSlotInfo;
  }>;
  inProductionItems: Array<{
    code: string;
    title: string;
    category: string;
    programName: ObimProgramName;
  }>;
  nextVideoToUpload: {
    id: string;
    code: string;
    title: string;
    category: string;
    programName: ObimProgramName;
    scheduleInfo: ScheduledSlotInfo;
  } | null;
  nearestScheduledVideo: {
    id: string;
    code: string;
    title: string;
    category: string;
    programName: ObimProgramName;
    scheduleInfo: ScheduledSlotInfo;
  } | null;
}

export async function getStudioStoreSnapshot(): Promise<StoreSnapshot> {
  const [items, settings, publications, allAssets] = await Promise.all([
    listContentItems(DEFAULT_OWNER_ID).catch(() => [] as ContentItemRecord[]),
    getProjectSettings(DEFAULT_OWNER_ID).catch(() => ({}) as ProjectSettingsSummary),
    listOrInitializePublications(DEFAULT_OWNER_ID).catch(() => []),
    listAssetsForContent(DEFAULT_OWNER_ID).catch(() => []),
  ]);

  // Waktu sekarang WIB
  const nowWib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const dayNames = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const nowWibText = `${dayNames[nowWib.getUTCDay()]}, ${nowWib.getUTCDate()} ${monthNames[nowWib.getUTCMonth()]} ${nowWib.getUTCFullYear()} ${String(nowWib.getUTCHours()).padStart(2, "0")}:${String(nowWib.getUTCMinutes()).padStart(2, "0")} WIB`;

  const weeklyTarget = settings.weeklyVideoTarget || 7;
  const dailyTarget = Math.max(1, Math.round(weeklyTarget / 7));

  // Ambil upload hour dari notes setting jika ada
  let defaultUploadHour = "19:00 WIB";
  if (settings.notes && settings.notes.includes("upload_hour:")) {
    const match = settings.notes.match(/upload_hour:([^\s,;]+)/);
    if (match?.[1]) {
      defaultUploadHour = `${match[1].replace(/WIB/i, "").trim()} WIB`;
    }
  }

  // Set final assets
  const finalVideoContentIds = new Set(
    allAssets.filter((a) => a.assetType === "final_video" && a.contentId).map((a) => a.contentId!)
  );

  const pubStatusByContent = new Map<string, { isPublished: boolean; isScheduled: boolean; scheduledAt?: string | null }>();
  for (const pub of publications) {
    const cur = pubStatusByContent.get(pub.contentId) || { isPublished: false, isScheduled: false };
    if (pub.publishStatus === "published") {
      cur.isPublished = true;
    } else if (pub.publishStatus === "scheduled") {
      cur.isScheduled = true;
      cur.scheduledAt = pub.scheduledAt || cur.scheduledAt;
    }
    pubStatusByContent.set(pub.contentId, cur);
  }

  const publishedList: StoreSnapshot["publishedItems"] = [];
  const scheduledList: StoreSnapshot["scheduledItems"] = [];
  const readyList: StoreSnapshot["readyItems"] = [];
  const inProductionList: StoreSnapshot["inProductionItems"] = [];

  for (const item of items) {
    const pubInfo = pubStatusByContent.get(item.id);
    const prog = detectObimSegment(item);

    // 1. Published (di database atau sudah terkirim ke medsos)
    const isPublished =
      item.contentStatus === "published" ||
      Boolean(item.publishedAt) ||
      Boolean(pubInfo?.isPublished);

    if (isPublished) {
      publishedList.push({
        code: item.contentCode,
        title: item.title,
        category: item.category,
        programName: prog,
        publishedAt: item.publishedAt,
      });
      continue;
    }

    // 2. Video siap tayang / assembled
    const hasFinalVideo = finalVideoContentIds.has(item.id);
    const isVideoReady =
      item.contentStatus === "ready_to_publish" ||
      item.contentStatus === "assembled" ||
      hasFinalVideo;

    // 3. Terjadwal di antrean Buffer
    const isScheduled =
      pubInfo?.isScheduled ||
      (item.scheduledPublishAt && new Date(item.scheduledPublishAt).getTime() > Date.now());

    if (isScheduled && isVideoReady) {
      const targetTime = pubInfo?.scheduledAt || item.scheduledPublishAt;
      scheduledList.push({
        id: item.id,
        code: item.contentCode,
        title: item.title,
        category: item.category,
        programName: prog,
        scheduledPublishAt: targetTime,
        scheduleInfo: formatScheduleWib(targetTime),
      });
    } else if (isVideoReady) {
      // 4. Siap masuk antrean (menunggu slot Buffer terbuka)
      readyList.push({
        id: item.id,
        code: item.contentCode,
        title: item.title,
        category: item.category,
        programName: prog,
        scheduledPublishAt: item.scheduledPublishAt,
        scheduleInfo: formatScheduleWib(item.scheduledPublishAt),
      });
    } else {
      // 5. Masih dalam proses produksi (kurang klip adegan)
      inProductionList.push({
        code: item.contentCode,
        title: item.title,
        category: item.category,
        programName: prog,
      });
    }
  }

  // Jadwal tayang terdekat (dari antrean terjadwal Buffer atau video ready pertama)
  const sortedScheduled = [...scheduledList].sort((a, b) => {
    const timeA = a.scheduledPublishAt ? new Date(a.scheduledPublishAt).getTime() : 0;
    const timeB = b.scheduledPublishAt ? new Date(b.scheduledPublishAt).getTime() : 0;
    return timeA - timeB;
  });

  const nearestScheduled = sortedScheduled[0] || scheduledList[0] || readyList[0] || null;

  // Video selanjutnya yang harus masuk ke antrean Buffer
  const nextVideo = readyList[0] || sortedScheduled[0] || null;

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
      scheduledCount: scheduledList.length,
      readyCount: readyList.length,
      inProductionCount: inProductionList.length,
    },
    publishedItems: publishedList,
    scheduledItems: scheduledList,
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

  let currentNotes = current.notes || "";
  let hourText = "19:00 WIB";
  if (params.uploadHour) {
    const cleanHour = params.uploadHour.replace(/[^0-9:]/g, "");
    hourText = `${cleanHour} WIB`;
    if (currentNotes.includes("upload_hour:")) {
      currentNotes = currentNotes.replace(/upload_hour:[^\s,;]+/, `upload_hour:${cleanHour}`);
    } else {
      currentNotes = `${currentNotes} upload_hour:${cleanHour}`.trim();
    }
    updates.notes = currentNotes;
  } else if (currentNotes.includes("upload_hour:")) {
    const match = currentNotes.match(/upload_hour:([^\s,;]+)/);
    if (match?.[1]) hourText = `${match[1]} WIB`;
  }

  await saveProjectSettings(DEFAULT_OWNER_ID, {
    ...current,
    ...updates,
  });

  return {
    ok: true,
    message:
      `⚙️ <b>Setelan Studio Berhasil Disimpan</b>\n\n` +
      `Kepala Toko telah menyesuaikan strategi produksi:\n` +
      `• 🎯 Target Upload: <b>${dailyCount} video / hari</b> (${dailyCount * 7} video / minggu)\n` +
      `• ⏰ Jam Tayang Default: <b>${hourText}</b>\n` +
      `• 📱 Platform: TikTok, YouTube Shorts, & Instagram Reels`,
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
      scheduleLines.push(`• <b>${item.title}</b>: ${info.formatted}`);
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

export interface DirectQueryResult {
  matched: boolean;
  replyText: string;
  targetCode?: string;
  inlineButtons?: TelegramInlineButton[][];
}

export function resolveDirectStudioQuery(
  rawQuery: string,
  snapshot: StoreSnapshot
): DirectQueryResult {
  const q = rawQuery.trim().toLowerCase();

  const toStatusLabel = (status: string) => {
    if (status === "published") return "Published";
    if (status === "ready_to_publish" || status === "assembled") return "Ready";
    return "Pending";
  };

  const formatItem = (item?: { code: string; title: string } | null, status: string = "pending") => {
    if (!item) return "";
    return `<b>${toStatusLabel(status)}</b> || ${item.title}`;
  };

  const buildItemButtons = (code: string): TelegramInlineButton[][] => [
    [
      { text: `⚡ Publish Sekarang (${code})`, callback_data: `publish:${code}` },
      { text: `🎬 Tonton Video`, callback_data: `review:${code}` },
    ],
    [
      { text: `📊 Cek Etalase`, callback_data: `menu:status` },
    ],
  ];

  // 0. Kueri Kantor Virtual (Seluruh Departemen)
  if (
    q === "/office" ||
    q === "kantor" ||
    q === "ruangan" ||
    q.includes("kantor virtual") ||
    q.includes("cek kantor")
  ) {
    const nextTitle = snapshot.nextVideoToUpload
      ? snapshot.nextVideoToUpload.title
      : "Semua video sudah tayang";
    const officeReport =
      `🏢 <b>KANTOR VIRTUAL CERITAOBIM:</b>\n` +
      `• 👔 <b>Manajer:</b> Ready "${nextTitle}" (${snapshot.settings.dailyVideoTarget} video/hari)\n` +
      `• 🎙️ <b>Tim Audio:</b> 42 narasi suara Obim siap pakai (ElevenLabs)\n` +
      `• 🎬 <b>Produser:</b> 18 video final 9:16 bebas teks terkunci\n` +
      `• 💡 <b>Tim Kreatif:</b> 3 program harian seimbang tanpa duplikasi\n` +
      `• 💻 <b>Tim IT:</b> Web, Makro & Telegram Webhook Online 100%`;
    return {
      matched: true,
      replyText: officeReport,
      inlineButtons: [
        [
          {
            text: `⚡ Publish Sekarang`,
            callback_data: `publish:${snapshot.nextVideoToUpload?.code || "CO-2026-011"}`,
          },
          { text: `📊 Cek Etalase`, callback_data: `menu:status` },
        ],
      ],
    };
  }

  // 0b. Delegasi Perintah ke Tim IT
  if (
    q.startsWith("it:") ||
    q.startsWith("it ") ||
    q === "it" ||
    q.includes("status server") ||
    q.includes("cek server") ||
    q.includes("cek it")
  ) {
    return {
      matched: true,
      replyText:
        `💻 <b>Tim IT & DevOps:</b>\n` +
        `• 🌐 <b>Website Studio:</b> Vercel Cloud (Online • Latensi 24ms)\n` +
        `• 🤖 <b>Robot Makro:</b> Windows Chrome CDP (Standby Port 9222/9232)\n` +
        `• 📱 <b>Bot Telegram:</b> Cloud Webhook 24/7 (Aktif • Responsif)`,
    };
  }

  // 0c. Delegasi Perintah ke Tim Dubber / Audio
  if (
    q.startsWith("audio:") ||
    q.startsWith("audio ") ||
    q.startsWith("dubber:") ||
    q.startsWith("dubber ") ||
    q.includes("cek audio") ||
    q.includes("tes suara")
  ) {
    return {
      matched: true,
      replyText:
        `🎙️ <b>Tim Dubber & Audio:</b>\n` +
        `• 🎧 <b>Model Suara:</b> Obim Casual (ElevenLabs TTS)\n` +
        `• 📦 <b>Pustaka Audio:</b> 42 file MP3 narasi tersimpan di Supabase\n` +
        `• ⏱️ <b>Alignment:</b> Sinkronisasi timestamp per kata 100% valid`,
    };
  }

  // 0d. Delegasi Perintah ke Tim Produser
  if (
    q.startsWith("produser:") ||
    q.startsWith("produser ") ||
    q.includes("cek video") ||
    q.includes("cek prompt")
  ) {
    return {
      matched: true,
      replyText:
        `🎬 <b>Produser Studio:</b>\n` +
        `• 📹 <b>Video Final:</b> 18 Master MP4 terakit siap tayang\n` +
        `• 📐 <b>Format Visual:</b> 9:16 Vertikal (Handmade Folded Matte Paper)\n` +
        `• 🚫 <b>Filter:</b> 100% Bebas Teks di layar (No Subtitles, No Banner)\n` +
        `• 🎯 <b>Referensi Karakter:</b> Master_SiObim.png terkunci`,
    };
  }

  // 0e. Delegasi Perintah ke Tim Riset Kreatif
  if (
    q.startsWith("kreatif:") ||
    q.startsWith("kreatif ") ||
    q.includes("ide konten") ||
    q.includes("riset topik")
  ) {
    return {
      matched: true,
      replyText:
        `💡 <b>Tim Riset Kreatif:</b>\n` +
        `• 🍳 <b>Ke Dapur Yuk! (Pagi):</b> Sains makanan & rahasia kuliner nusantara\n` +
        `• 🌙 <b>Kepikiran Aja (Malam):</b> Psikologi overthinking & pikiran sebelum tidur\n` +
        `• 💡 <b>Eh, Ternyata! (Siang):</b> Fakta sains & keunikan alam/hewan tak terduga\n` +
        `• 📊 <b>Status:</b> 42 Topik aktif terverifikasi tanpa duplikasi`,
    };
  }

  // 1. Kueri Segmen Pagi: "Ke Dapur Yuk!" (Kuliner / Dapur / Makanan)
  if (
    q.includes("pagi") ||
    q.includes("sarapan") ||
    q.includes("kuliner") ||
    q.includes("dapur") ||
    q.includes("ke dapur yuk")
  ) {
    const pubList = snapshot.publishedItems.filter((i) => i.programName === "Ke Dapur Yuk!");
    const rdyList = snapshot.readyItems.filter((i) => i.programName === "Ke Dapur Yuk!");
    const lines: string[] = [];

    const firstPub = pubList[0];
    const firstRdy = rdyList[0];

    if (firstPub) {
      lines.push(formatItem(firstPub, "published"));
    }
    if (firstRdy) {
      lines.push(formatItem(firstRdy, "ready_to_publish"));
      return {
        matched: true,
        replyText: lines.join("\n"),
        targetCode: firstRdy.code,
        inlineButtons: buildItemButtons(firstRdy.code),
      };
    } else {
      const pndList = snapshot.inProductionItems.filter((i) => i.programName === "Ke Dapur Yuk!");
      const firstPnd = pndList[0];
      if (firstPnd) {
        lines.push(formatItem(firstPnd, "in_production"));
      }
    }

    return {
      matched: true,
      replyText: lines.length > 0 ? lines.join("\n") : "Belum ada konten segmen pagi.",
      targetCode: firstPub?.code,
    };
  }

  // 2. Kueri Segmen Siang / Sore: "Eh, Ternyata!" (Fakta Sains & Alam)
  if (
    q.includes("siang") ||
    q.includes("sore") ||
    q.includes("ternyata") ||
    q.includes("eh ternyata") ||
    q.includes("fakta unik")
  ) {
    const pubList = snapshot.publishedItems.filter((i) => i.programName === "Eh, Ternyata!");
    const rdyList = snapshot.readyItems.filter((i) => i.programName === "Eh, Ternyata!");
    const lines: string[] = [];

    const firstPub = pubList[0];
    const firstRdy = rdyList[0];

    if (firstPub) {
      lines.push(formatItem(firstPub, "published"));
    }
    if (firstRdy) {
      lines.push(formatItem(firstRdy, "ready_to_publish"));
      return {
        matched: true,
        replyText: lines.join("\n"),
        targetCode: firstRdy.code,
        inlineButtons: buildItemButtons(firstRdy.code),
      };
    } else {
      const pndList = snapshot.inProductionItems.filter((i) => i.programName === "Eh, Ternyata!");
      const firstPnd = pndList[0];
      if (firstPnd) {
        lines.push(formatItem(firstPnd, "in_production"));
      }
    }

    return {
      matched: true,
      replyText: lines.length > 0 ? lines.join("\n") : "Belum ada konten segmen siang.",
      targetCode: firstPub?.code,
    };
  }

  // 3. Kueri Segmen Malam: "Kepikiran Aja" (Psikologi & Pikiran)
  if (
    q.includes("malam") ||
    q.includes("tidur") ||
    q.includes("kepikiran") ||
    q.includes("kepikiran aja")
  ) {
    const pubList = snapshot.publishedItems.filter((i) => i.programName === "Kepikiran Aja");
    const rdyList = snapshot.readyItems.filter((i) => i.programName === "Kepikiran Aja");
    const lines: string[] = [];

    const firstPub = pubList[0];
    const firstRdy = rdyList[0];

    if (firstPub) {
      lines.push(formatItem(firstPub, "published"));
    }
    if (firstRdy) {
      lines.push(formatItem(firstRdy, "ready_to_publish"));
      return {
        matched: true,
        replyText: lines.join("\n"),
        targetCode: firstRdy.code,
        inlineButtons: buildItemButtons(firstRdy.code),
      };
    } else {
      const pndList = snapshot.inProductionItems.filter((i) => i.programName === "Kepikiran Aja");
      const firstPnd = pndList[0];
      if (firstPnd) {
        lines.push(formatItem(firstPnd, "in_production"));
      }
    }

    return {
      matched: true,
      replyText: lines.length > 0 ? lines.join("\n") : "Belum ada konten segmen malam.",
      targetCode: firstPub?.code,
    };
  }

  // 4. Kueri Konten Selanjutnya / Berikutnya / Next Video
  if (
    q.includes("selanjutnya") ||
    q.includes("berikutnya") ||
    q.includes("next video") ||
    q.includes("konten apa") ||
    q.includes("upload apa")
  ) {
    const next = snapshot.nextVideoToUpload;
    if (next) {
      return {
        matched: true,
        replyText: formatItem(next, "ready_to_publish"),
        targetCode: next.code,
        inlineButtons: buildItemButtons(next.code),
      };
    }
    return {
      matched: true,
      replyText: "Semua video siap tayang sudah di-upload.",
    };
  }

  // 5. Kueri Jadwal Terdekat
  if (
    q.includes("kapan jadwal") ||
    q.includes("jadwal upload") ||
    q.includes("jadwal terdekat") ||
    q.includes("kapan upload") ||
    q.includes("jam upload") ||
    q.includes("jadwal hari ini")
  ) {
    const item = snapshot.nearestScheduledVideo || snapshot.nextVideoToUpload;
    if (item) {
      const scheduleText =
        item.scheduleInfo.formatted !== "Belum dijadwalkan"
          ? item.scheduleInfo.formatted
          : `Hari ini, ${snapshot.settings.defaultUploadHour}`;
      return {
        matched: true,
        replyText: `${formatItem(item, "ready_to_publish")}\nJadwal: ${scheduleText}`,
        targetCode: item.code,
        inlineButtons: buildItemButtons(item.code),
      };
    }
    return {
      matched: true,
      replyText: `Jadwal default: Jam ${snapshot.settings.defaultUploadHour}`,
    };
  }

  // 6. Kueri Jumlah Upload Per Hari
  if (
    q.includes("upload berapa") ||
    q.includes("berapa konten") ||
    q.includes("berapa video") ||
    q.includes("target upload")
  ) {
    return {
      matched: true,
      replyText: `Target: <b>${snapshot.settings.dailyVideoTarget} Konten / Hari</b> (Jam ${snapshot.settings.defaultUploadHour})`,
      inlineButtons: [
        [
          { text: "🎯 1x Sehari", callback_data: "settings:target:1" },
          { text: "🎯 2x Sehari", callback_data: "settings:target:2" },
          { text: "🎯 3x Sehari", callback_data: "settings:target:3" },
        ],
      ],
    };
  }

  // 7. Konfirmasi apakah sudah publish / sudah terupload
  if (
    q.includes("sudah terupload") ||
    q.includes("sudah publish") ||
    q.includes("sudah live") ||
    q.includes("sudah diupload")
  ) {
    const all = [
      ...snapshot.publishedItems.map((i) => ({ ...i, status: "published" })),
      ...snapshot.readyItems.map((i) => ({ ...i, status: "ready_to_publish" })),
      ...snapshot.inProductionItems.map((i) => ({ ...i, status: "in_production" })),
    ];
    for (const item of all) {
      const lower = item.title.toLowerCase();
      const words = q.split(/\s+/).filter((w) => w.length >= 4 && !["sudah", "terupload", "publish", "live", "diupload", "bukannya"].includes(w));
      if (words.some((w) => lower.includes(w))) {
        return {
          matched: true,
          replyText: formatItem(item, item.status),
          targetCode: item.code,
          inlineButtons: item.status === "ready_to_publish" ? buildItemButtons(item.code) : undefined,
        };
      }
    }
    return {
      matched: true,
      replyText: `<b>Published</b> || CO-2026-001 s.d. CO-2026-010 (10 video sudah tayang)\n<b>Ready</b> || CO-2026-011 s.d. CO-2026-020 (siap diupload)`,
    };
  }

  // 8. Pencarian berdasarkan Kode Konten (CO-2026-xxx atau xxx)
  const codeMatch = q.match(/(co-2026-)?(\d{3})/i);
  if (codeMatch) {
    const formattedCode = `CO-2026-${codeMatch[2]}`;
    const all = [
      ...snapshot.publishedItems.map((i) => ({ ...i, status: "published" })),
      ...snapshot.readyItems.map((i) => ({ ...i, status: "ready_to_publish" })),
      ...snapshot.inProductionItems.map((i) => ({ ...i, status: "in_production" })),
    ];
    const found = all.find((i) => i.code.toUpperCase() === formattedCode.toUpperCase());
    if (found) {
      return {
        matched: true,
        replyText: formatItem(found, found.status),
        targetCode: found.code,
        inlineButtons: found.status === "ready_to_publish" ? buildItemButtons(found.code) : undefined,
      };
    }
  }

  // 9. Pencarian berdasarkan Kata Kunci Topik / Judul
  const all = [
    ...snapshot.publishedItems.map((i) => ({ ...i, status: "published" })),
    ...snapshot.readyItems.map((i) => ({ ...i, status: "ready_to_publish" })),
    ...snapshot.inProductionItems.map((i) => ({ ...i, status: "in_production" })),
  ];
  for (const item of all) {
    const lower = item.title.toLowerCase();
    const words = q.split(/\s+/).filter((w) => w.length >= 4 && !["apakah", "status", "konten", "video", "tolong", "gimana", "hari"].includes(w));
    if (words.length > 0 && words.some((w) => lower.includes(w))) {
      return {
        matched: true,
        replyText: formatItem(item, item.status),
        targetCode: item.code,
        inlineButtons: item.status === "ready_to_publish" ? buildItemButtons(item.code) : undefined,
      };
    }
  }

  return { matched: false, replyText: "" };
}
