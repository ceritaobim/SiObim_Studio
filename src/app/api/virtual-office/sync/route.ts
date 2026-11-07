import { NextResponse } from "next/server";
import { listFlowProfileAccounts } from "@/lib/providers/flow-accounts-service";
import {
  loadVirtualOfficeCloudSync,
  persistVirtualOfficeCloudSync,
  readVirtualOfficeSyncState,
  recordVirtualOfficeEvent,
  saveVirtualOfficeSyncState,
  syncUpdateProfileCreditsAsync,
} from "@/lib/services/virtual-office-sync";
import {
  getStudioStoreSnapshot,
  executePublishNow,
  executeAutoScheduleQueue,
  type StoreSnapshot,
} from "@/features/telegram/studio-store-manager";
import {
  generatePersonalizedNpcReply,
  getNpcAssignedWorkContext,
} from "@/features/virtual-office/npc-persona-engine";
import { TelegramClient } from "@/features/telegram/telegram-client";
import {
  BUFFER_POSTER_WORLD_COORDS,
  DEFAULT_BUFFER_POSTERS,
} from "@/features/virtual-office/constants";
import type { BufferSchedulePosterItem } from "@/features/virtual-office/types";

export const dynamic = "force-dynamic";

function buildBufferSchedulePosters(
  snapshot: StoreSnapshot | null
): BufferSchedulePosterItem[] {
  if (!snapshot) return DEFAULT_BUFFER_POSTERS;

  const combined: Array<{
    code: string;
    title: string;
    badgeNumber: string;
    scheduleLabel: string;
    status: "scheduled" | "ready" | "published";
  }> = [];

  // 1. Scheduled items first (ordered by broadcast schedule)
  for (const item of snapshot.scheduledItems) {
    const dayMatch = item.scheduleInfo.formatted.match(/\b(\d{1,2})\b/);
    combined.push({
      code: item.code,
      title: item.title,
      badgeNumber: dayMatch?.[1]
        ? dayMatch[1].padStart(2, "0")
        : String(combined.length + 1).padStart(2, "0"),
      scheduleLabel: item.scheduleInfo.formatted.toUpperCase(),
      status: "scheduled",
    });
  }

  // 2. Ready items next (upcoming queue)
  for (const item of snapshot.readyItems) {
    combined.push({
      code: item.code,
      title: item.title,
      badgeNumber: String(combined.length + 1).padStart(2, "0"),
      scheduleLabel: `ANTRIAN SIAP • ${snapshot.settings.defaultUploadHour} WIB`,
      status: "ready",
    });
  }

  // 3. Published items
  for (const item of snapshot.publishedItems) {
    combined.push({
      code: item.code,
      title: item.title,
      badgeNumber: String(combined.length + 1).padStart(2, "0"),
      scheduleLabel: "SUDAH TAYANG DI BUFFER",
      status: "published",
    });
  }

  if (combined.length === 0) return DEFAULT_BUFFER_POSTERS;

  return BUFFER_POSTER_WORLD_COORDS.map((coord, idx) => {
    const liveItem = combined[idx];
    const fallback = DEFAULT_BUFFER_POSTERS[idx]!;
    if (!liveItem) return fallback;
    return {
      slotIndex: idx + 1,
      code: liveItem.code,
      title: liveItem.title,
      badgeNumber: liveItem.badgeNumber,
      scheduleLabel: liveItem.scheduleLabel,
      status: liveItem.status,
      platforms: ["TikTok", "Shorts", "Reels"],
      worldPosition: coord,
    };
  });
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(b|strong)>/gi, "*")
    .replace(/<\/?(i|em)>/gi, "_")
    .replace(/<\/?(code|pre)>/gi, "`")
    .replace(/<[^>]+>/g, "");
}

export async function GET() {
  try {
    const [{ accounts, syncState }, snapshot] = await Promise.all([
      loadVirtualOfficeCloudSync(),
      getStudioStoreSnapshot().catch(() => null),
    ]);

    const telegramConfigured = Boolean(
      process.env.TELEGRAM_BOT_TOKEN?.trim() &&
        (process.env.TELEGRAM_ALLOWED_USER_ID?.trim() ||
          process.env.TELEGRAM_CHAT_ID?.trim())
    );

    return NextResponse.json({
      ok: true,
      accounts,
      syncState,
      telegramConfigured,
      bufferSchedulePosters: buildBufferSchedulePosters(snapshot),
      storeSummary: snapshot
        ? {
            nowWibText: snapshot.nowWibText,
            settings: snapshot.settings,
            inventory: snapshot.inventory,
            nextVideoToUpload: snapshot.nextVideoToUpload || null,
          }
        : null,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Gagal memuat sinkronisasi kantor.",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = String(body.action || "chat");

    // 1. UPDATE CREDITS (Single or Bulk)
    if (action === "update_credit") {
      const bulkAction = body.bulkAction ? String(body.bulkAction) : undefined;
      let credits = typeof body.credits === "number" ? body.credits : 50;
      const profileIndex =
        typeof body.profileIndex === "number" ? body.profileIndex : undefined;
      let allProfiles = Boolean(body.allProfiles);
      let message = "";

      if (bulkAction === "refill_all" || bulkAction === "standby_all") {
        allProfiles = true;
        credits = 50;
        message =
          "💻 Seluruh 11 Editor Video telah kembali standby ke PC masing-masing (50/50 kr)!";
      } else if (bulkAction === "evacuate_lounge" || bulkAction === "rest_all") {
        allProfiles = true;
        credits = 0;
        message =
          "☕ Seluruh 11 Editor Video beranjak dari PC menuju kursi istirahat di Lounge Warkop Obim!";
      }

      const updatedAccounts = await syncUpdateProfileCreditsAsync({
        profileIndex,
        credits,
        allProfiles,
        source: "virtual-office",
      });

      // Mirror notification to Telegram if enabled
      const state = readVirtualOfficeSyncState();
      const shouldMirror = Boolean(body.mirrorToTelegram ?? state.mirrorToTelegram);
      const targetChatId =
        process.env.TELEGRAM_ALLOWED_USER_ID?.trim() ||
        process.env.TELEGRAM_CHAT_ID?.trim();
      if (shouldMirror && targetChatId && process.env.TELEGRAM_BOT_TOKEN) {
        const client = new TelegramClient();
        const tgMsg = allProfiles
          ? credits > 0
            ? `🏢 <b>[Kantor Virtual 3D]</b> Seluruh 11 Editor Video kembali <b>Standby di PC Masing-Masing (${credits}/50 kr)</b> 💻.`
            : `🏢 <b>[Kantor Virtual 3D]</b> Seluruh 11 Editor Video berpindah dari PC ke <b>Kursi Istirahat Lounge</b> ☕.`
          : `🏢 <b>[Kantor Virtual 3D]</b> Kuota <b>Profil ${profileIndex}</b> diupdate menjadi <b>${credits}/50 kr</b> (${credits === 0 ? "Istirahat ke Lounge ☕" : "Standby di Meja 💻"}).`;
        await client.sendMessage(targetChatId, tgMsg, { parse_mode: "HTML" }).catch(() => null);
      }

      return NextResponse.json({
        ok: true,
        message,
        accounts: updatedAccounts,
        syncState: readVirtualOfficeSyncState(),
      });
    }

    // 2. TOGGLE MIRROR TO TELEGRAM
    if (action === "toggle_mirror") {
      const state = readVirtualOfficeSyncState();
      state.mirrorToTelegram = Boolean(body.mirrorToTelegram);
      saveVirtualOfficeSyncState(state);
      await persistVirtualOfficeCloudSync(listFlowProfileAccounts(), state);
      return NextResponse.json({ ok: true, syncState: state });
    }

    // 3. REAL AI & TELEGRAM COMMAND CHAT FROM 3D VIRTUAL OFFICE
    if (action === "chat") {
      const text = String(body.text || "").trim();
      const memberId = String(body.memberId || "pic-video");
      const memberName = String(body.memberName || "Kepala Tim Obim");
      const memberRole = String(body.memberRole || "PIC Studio");
      const profileIndex =
        typeof body.profileIndex === "number" ? body.profileIndex : undefined;

      if (!text) {
        return NextResponse.json({ ok: false, error: "Pesan kosong" }, { status: 400 });
      }

      const lower = text.toLowerCase();
      const snapshot = await getStudioStoreSnapshot();
      const accounts = listFlowProfileAccounts();
      const workCtx = await getNpcAssignedWorkContext(memberId, profileIndex, accounts);
      let replyText = "";
      let updatedAccounts = accounts;
      let updatedCredits: number | undefined = undefined;

      const isBulkStandbyText =
        lower === "/standby" ||
        lower === "editor standby" ||
        lower === "semua editor standby" ||
        /(?:semua|editor).*(?:standby|stand\s*by|kembali\s*ke\s*pc|kembali\s*ke\s*meja)/i.test(lower);

      const isBulkRestText =
        lower === "/istirahat" ||
        lower === "editor istirahat" ||
        lower === "semua editor istirahat" ||
        /(?:semua|editor).*(?:istirahat|kursi\s*istirahat|ke\s*lounge)/i.test(lower);

      // A. Check credit / refill / standby / rest actions first
      if (isBulkStandbyText) {
        updatedAccounts = await syncUpdateProfileCreditsAsync({
          credits: 50,
          allProfiles: true,
          source: "virtual-office",
        });
        if (profileIndex) updatedCredits = 50;
        replyText =
          `💻 *Seluruh 11 Editor Video Kembali Standby di PC Masing-Masing!*\n` +
          `Semua editor (Profil 1 s/d Profil 11) sedang berjalan kembali dari kursi istirahat menuju meja PC masing-masing dengan kuota penuh (50/50 kr).`;
      } else if (isBulkRestText) {
        updatedAccounts = await syncUpdateProfileCreditsAsync({
          credits: 0,
          allProfiles: true,
          source: "virtual-office",
        });
        if (profileIndex) updatedCredits = 0;
        replyText =
          `☕ *Seluruh 11 Editor Video Berpindah ke Kursi Istirahat!*\n` +
          `Semua editor (Profil 1 s/d Profil 11) telah meninggalkan PC mereka dan berjalan menuju kursi istirahat di *Lounge Warkop Obim*.`;
      } else if (lower === "refill_50" || lower === "/refill" || lower.includes("isi kuota")) {
        if (profileIndex) {
          updatedAccounts = await syncUpdateProfileCreditsAsync({
            profileIndex,
            credits: 50,
            source: "virtual-office",
          });
          updatedCredits = 50;
          replyText =
            `🔋 *Kuota ${workCtx.persona.name} Diisi Penuh (50/50 kr)!*\n` +
            `Saya sudah kembali duduk di *${workCtx.persona.workstationLabel}* dan siap melanjutkan render *${workCtx.persona.sceneFocus}* untuk konten \`${workCtx.currentAssignedItem.contentCode}\` (*"${workCtx.currentAssignedItem.title}"*). 💻`;
        } else {
          updatedAccounts = await syncUpdateProfileCreditsAsync({
            credits: 50,
            allProfiles: true,
            source: "virtual-office",
          });
          replyText = `🔋 *Seluruh 11 Profil Chrome Diisi Penuh (50/50 kr)!*\nSemua editor telah kembali ke meja kerja masing-masing untuk melanjutkan antrean produksi.`;
        }
      } else if (lower === "rest_now" || lower === "/lounge" || lower.includes("ke lounge")) {
        if (profileIndex) {
          updatedAccounts = await syncUpdateProfileCreditsAsync({
            profileIndex,
            credits: 0,
            source: "virtual-office",
          });
          updatedCredits = 0;
          replyText =
            `☕ *${workCtx.persona.name} Beranjak ke Lounge Warkop Obim!*\n` +
            `Kuota akun Chrome diset ke *0/50 kr* usai mengerjakan \`${workCtx.lastCompletedItem.contentCode}\` (*"${workCtx.lastCompletedItem.title}"*). Sedang istirahat menyeruput kopi di kursi lounge.`;
        } else {
          updatedAccounts = await syncUpdateProfileCreditsAsync({
            credits: 0,
            allProfiles: true,
            source: "virtual-office",
          });
          replyText =
            `☕ *Seluruh 11 Editor Video Berpindah ke Kursi Istirahat!*\n` +
            `Semua editor telah meninggalkan PC mereka dan duduk di kursi istirahat Lounge Warkop Obim.`;
        }
      } else if (
        lower === "consume_3" ||
        lower === "consume_10" ||
        lower.includes("render 1 klip")
      ) {
        const targetIdx = profileIndex || 1;
        const curr = accounts.find((a) => a.index === targetIdx)?.credits ?? 50;
        const nextKr = Math.max(0, curr - 10);
        updatedAccounts = await syncUpdateProfileCreditsAsync({
          profileIndex: targetIdx,
          credits: nextKr,
          source: "virtual-office",
        });
        if (profileIndex) updatedCredits = nextKr;
        replyText =
          nextKr === 0
            ? `🎬 *Render Klip Selesai oleh ${workCtx.persona.name}!*\nAdegan *${workCtx.persona.sceneFocus}* untuk \`${workCtx.currentAssignedItem.contentCode}\` (*"${workCtx.currentAssignedItem.title}"*) telah dirender, namun kuota Profil ${targetIdx} kini *0/50 kr*.\n☕ Saya izin berjalan ke kursi istirahat di Warkop Obim dulu ya, Bos!`
            : `🎬 *Render Klip Selesai oleh ${workCtx.persona.name}!*\nBerhasil men-generate adegan *${workCtx.persona.sceneFocus}* untuk \`${workCtx.currentAssignedItem.contentCode}\` (*"${workCtx.currentAssignedItem.title}"*).\nSisa kuota Profil ${targetIdx} di database: *${nextKr}/50 kr*. Tetap standby di *${workCtx.persona.workstationLabel}*!`;
      } else if (lower === "/status" || lower === "/kantor" || lower === "/kuota_all") {
        const top11 = accounts.slice(0, 11);
        const totalKr = top11.reduce((s, a) => s + a.credits, 0);
        const resting = top11.filter((a) => a.credits === 0).length;
        const working = top11.length - resting;

        replyText =
          `📊 *Laporan Real-Time dari ${workCtx.persona.name} (${workCtx.persona.role})*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `• *Fokus Meja Saya:* \`${workCtx.lastCompletedItem.contentCode}\` — _"${workCtx.lastCompletedItem.title}"_\n` +
          `• *Total Konten Database:* ${snapshot.inventory.total} Topik (${snapshot.inventory.readyCount} Ready, ${snapshot.inventory.scheduledCount} Scheduled, ${snapshot.inventory.publishedCount} Published)\n` +
          `• *Tim Video 3D:* ${working} Kerja di Meja 💻 | ${resting} Istirahat di Lounge ☕\n` +
          `• *Total Kuota Google Flow:* ${totalKr}/550 kr (~${Math.floor(totalKr / 3)} klip)\n` +
          (snapshot.nextVideoToUpload
            ? `\n🎯 *Antrean Buffer Berikutnya:* \`${snapshot.nextVideoToUpload.code}\` — _${snapshot.nextVideoToUpload.title}_`
            : "");
      } else if (lower.startsWith("/publish")) {
        const argCode = text.split(/\s+/)[1]?.toUpperCase();
        const targetCode = argCode || snapshot.nextVideoToUpload?.code;
        if (!targetCode) {
          replyText = `⚠️ Saat ini belum ada video berstatus Ready (00Final.mp4) yang siap di-publish ke Buffer.`;
        } else {
          const pubRes = await executePublishNow(targetCode);
          replyText = stripHtmlTags(pubRes.message);
        }
      } else if (lower === "/auto_schedule" || lower.includes("jadwal otomatis")) {
        const schedRes = await executeAutoScheduleQueue();
        replyText = stripHtmlTags(schedRes.message);
      } else if (lower === "/draft_naskah") {
        const item = workCtx.currentAssignedItem;
        replyText =
          `🎬 *Draf Naskah & Visual (${workCtx.persona.name} — ${workCtx.persona.role})*\n` +
          `━━━━━━━━━━━━━━━━━━━━\n` +
          `• *Konten:* \`${item.contentCode}\` — *"${item.title}"* (${item.category})\n` +
          `• *Hook (0-4s):* "${item.hook}"\n` +
          `• *Fokus Visual Origami:* ${workCtx.persona.sceneFocus}\n` +
          `• *CTA Penutup:* "${item.cta}"`;
      } else {
        // B. Personalized Role-Based NPC Response Engine (Unique per NPC & Assigned Content!)
        replyText = await generatePersonalizedNpcReply({
          memberId,
          memberName,
          memberRole,
          profileIndex,
          userText: text,
          snapshot,
          accounts: updatedAccounts,
        });
      }

      // Record live event & speech bubble in 3D office
      recordVirtualOfficeEvent({
        source: "virtual-office",
        actorId: memberId,
        actorName: memberName,
        summary: `CEO berbicara dengan ${memberName}: "${text.slice(0, 45)}"`,
        command: text,
        replyPreview: replyText.slice(0, 90),
        bubbleText: `💬 ${replyText.replace(/[*_`]/g, "").slice(0, 44)}...`,
        bubbleDurationMs: 12000,
      });

      // Mirror conversation to real Telegram chat if enabled
      const state = readVirtualOfficeSyncState();
      const shouldMirror = Boolean(body.mirrorToTelegram ?? state.mirrorToTelegram);
      const targetChatId =
        process.env.TELEGRAM_ALLOWED_USER_ID?.trim() ||
        process.env.TELEGRAM_CHAT_ID?.trim();
      if (shouldMirror && targetChatId && process.env.TELEGRAM_BOT_TOKEN) {
        const client = new TelegramClient();
        const tgMirror =
          `🎮 <b>[Interaksi Kantor 3D — ${memberName}]</b>\n` +
          `👤 <b>CEO:</b> ${text}\n\n` +
          `🤖 <b>${memberName}:</b>\n${replyText.slice(0, 600)}`;
        await client.sendMessage(targetChatId, tgMirror, { parse_mode: "HTML" }).catch(() => null);
      }

      const latestSnapshot = await getStudioStoreSnapshot().catch(() => snapshot);
      return NextResponse.json({
        ok: true,
        reply: replyText,
        replyText,
        updatedCredits,
        accounts: updatedAccounts,
        bufferSchedulePosters: buildBufferSchedulePosters(latestSnapshot),
        syncState: readVirtualOfficeSyncState(),
      });
    }

    return NextResponse.json({ ok: false, error: "Action tidak dikenali" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Gagal memproses aksi kantor 3D.",
      },
      { status: 500 }
    );
  }
}
