/**
 * CeritaObim Studio — Telegram Bot Service & Orchestrator
 *
 * Menghubungkan Telegram Client, Database Konten Studio, Google Gemini AI Copilot,
 * Buffer Publisher, dan Pengaturan Sistem dalam peran "Kepala Toko" (Store Manager)
 * yang sigap, akurat, dan melayani sang CEO secara penuh 24/7.
 */

import { TelegramClient, type TelegramInlineButton } from "./telegram-client";
import { askGeminiCopilot } from "./telegram-ai-copilot";
import {
  getStudioStoreSnapshot,
  executePublishNow,
  executeSetSchedule,
  executeUpdateSettings,
  executeAutoScheduleQueue,
  resolveDirectStudioQuery,
} from "./studio-store-manager";
import {
  listContentItems,
  listAssetsForContent,
  updateContentItem,
} from "@/lib/db/repository";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import {
  recordVirtualOfficeEvent,
  syncUpdateProfileCredits,
} from "@/lib/services/virtual-office-sync";
import { listFlowProfileAccounts } from "@/lib/providers/flow-accounts-service";

export interface TelegramUser {
  id: number | string;
  first_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number | string;
  type?: string;
}

export interface TelegramMessage {
  message_id?: number;
  chat: TelegramChat;
  from?: TelegramUser;
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  from?: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
  [key: string]: unknown;
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export class TelegramService {
  private readonly client: TelegramClient;
  private readonly allowedUserId: string;

  constructor() {
    this.client = new TelegramClient();
    this.allowedUserId = (process.env.TELEGRAM_ALLOWED_USER_ID || "").trim();
  }

  isAuthorized(senderId: string | number): boolean {
    if (!this.allowedUserId) return false;
    return String(senderId).trim() === this.allowedUserId;
  }

  async handleUpdate(update: TelegramUpdate) {
    // 1. Tangani Callback Query (Pencetan tombol inline keyboard)
    if (update.callback_query) {
      return this.handleCallbackQuery(update.callback_query);
    }

    // 2. Tangani Pesan Teks
    const message = update.message;
    if (!message || !message.text) {
      return { ok: true, ignored: true };
    }

    const chatId = message.chat.id;
    const senderId = String(message.from?.id || "");
    const senderName = message.from?.first_name || "CEO";
    const text = message.text.trim();

    // Validasi Keamanan: Whitelist User ID
    if (!this.isAuthorized(senderId)) {
      console.warn(`[TELEGRAM] Akses ditolak untuk user ID tidak dikenal: ${senderId} (${message.from?.username})`);
      await this.client.sendMessage(
        chatId,
        `⛔ <b>Akses Ditolak</b>\nMaaf, bot ini adalah asisten pribadi eksklusif milik channel CeritaObim Studio dan hanya dapat diakses oleh pemilik akun.`
      );
      return { ok: true, unauthorized: true };
    }

    // Rekam sinyal perintah Telegram agar karakter di Kantor Virtual 3D langsung bereaksi!
    const lowerText = text.toLowerCase();
    const targetActor = lowerText.includes("publish") || lowerText.includes("upload") || lowerText.includes("jadwal")
      ? { id: "pic-qc", name: "Mba Siska (PIC QC & Distribusi)" }
      : lowerText.includes("naskah") || lowerText.includes("topik") || lowerText.includes("ide")
      ? { id: "pic-script", name: "Kak Fajar (PIC Naskah)" }
      : { id: "pic-video", name: "Mas Radit (PIC Produksi Video)" };

    recordVirtualOfficeEvent({
      source: "telegram",
      actorId: targetActor.id,
      actorName: targetActor.name,
      summary: `Menerima perintah Telegram dari ${senderName}: "${text}"`,
      command: text,
      bubbleText: `📲 Telegram CEO: "${text.slice(0, 38)}"`,
      bubbleDurationMs: 15000,
    });

    // Perintah Kantor Virtual 3D: /kantor atau "cek kantor"
    if (lowerText === "/kantor" || lowerText === "kantor" || lowerText === "cek kantor") {
      const flowAccs = listFlowProfileAccounts().slice(0, 11);
      const resting = flowAccs.filter((a) => a.credits === 0);
      const working = flowAccs.filter((a) => a.credits > 0);
      const totalKr = flowAccs.reduce((acc, a) => acc + a.credits, 0);

      const msg =
        `🏢 <b>Status Live Kantor Virtual 3D Obim Studio</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Tim Produksi Video:</b> 11 Profil + 1 PIC (Mas Radit)\n` +
        `• <b>Standby Kerja di Meja:</b> ${working.length} Editor 💻\n` +
        `• <b>Istirahat di Warkop Obim:</b> ${resting.length} Editor ☕\n` +
        `• <b>Total Kuota Render:</b> ${totalKr} / 550 kr\n` +
        `• <b>Tim Naskah & QC:</b> Aktif di ruangan masing-masing\n\n` +
        `💡 <i>Perintah Cepat Kantor 3D dari Telegram:</i>\n` +
        `• Ketik <code>/refill</code> — Isi penuh 50 kr semua profil & panggil kembali ke meja\n` +
        `• Ketik <code>/lounge</code> — Suruh tim kuota rendah istirahat ke Warkop Obim`;

      return this.client.sendMessage(chatId, msg, { parse_mode: "HTML" });
    }

    // Perintah Refill Kuota Kantor 3D dari Telegram: /refill
    if (lowerText === "/refill" || lowerText === "refill semua" || lowerText === "isi kuota") {
      syncUpdateProfileCredits({
        credits: 50,
        allProfiles: true,
        source: "telegram",
      });
      return this.client.sendMessage(
        chatId,
        `🔋 <b>Seluruh 11 Profil Chrome Diisi Ulang (50/50 kr)!</b>\nSemua anggota tim di Kantor Virtual 3D sedang berjalan kembali dari Lounge Warkop Obim menuju meja kerja masing-masing. 💻`,
        { parse_mode: "HTML" }
      );
    }

    // Perintah Istirahat ke Lounge dari Telegram: /lounge
    if (lowerText === "/lounge" || lowerText === "/istirahat") {
      syncUpdateProfileCredits({
        profileIndex: 3,
        credits: 0,
        source: "telegram",
      });
      return this.client.sendMessage(
        chatId,
        `☕ <b>Perintah Istirahat Diterima!</b>\nAnggota tim yang kehabisan kuota di Kantor Virtual 3D telah beranjak menuju kursi istirahat Warkop Obim.`,
        { parse_mode: "HTML" }
      );
    }

    // Perintah: /start atau /help atau "menu"
    if (text === "/start" || text === "/help" || text.toLowerCase() === "menu") {
      return this.sendWelcomeMessage(chatId, senderName);
    }

    // Perintah: /status atau "📊 Cek Status"
    if (text === "/status" || text === "/list" || text === "📊 Cek Status") {
      return this.sendStatusOverview(chatId);
    }

    // Perintah Review: /review [KODE] atau review:KODE
    if (
      text.startsWith("/review") ||
      text.toLowerCase().startsWith("review ") ||
      text.toLowerCase().startsWith("review:")
    ) {
      const code = text.replace(/^(\/review|review:?)/i, "").trim().split(/\s+/)[0]?.toUpperCase() || "";
      if (!code) {
        const snap = await getStudioStoreSnapshot();
        const nextCode = snap.nextVideoToUpload?.code || "CO-2026-011";
        await this.client.sendMessage(
          chatId,
          `ℹ️ <i>Format perintah:</i> <code>/review ${nextCode}</code>\nAtau Anda cukup ketik santai: <i>'Obim, kirim video selanjutnya'</i>`
        );
        return { ok: true };
      }
      return this.sendVideoReview(chatId, code);
    }

    // Perintah Publish: /publish [KODE] atau publish:KODE
    if (
      text.startsWith("/publish") ||
      text.toLowerCase().startsWith("publish ") ||
      text.toLowerCase().startsWith("publish:")
    ) {
      const code = text.replace(/^(\/publish|publish:?)/i, "").trim().split(/\s+/)[0]?.toUpperCase() || "";
      const snap = await getStudioStoreSnapshot();
      const targetCode = code || snap.nextVideoToUpload?.code;

      if (!targetCode) {
        await this.client.sendMessage(chatId, "⚠️ Tidak ada video yang siap di-publish di etalase.");
        return { ok: true };
      }

      await this.client.sendMessage(chatId, `⏳ <i>Kepala Toko sedang mengunggah video <b>${targetCode}</b> ke Buffer...</i>`);
      const res = await executePublishNow(targetCode);
      await this.client.sendMessage(chatId, res.message);
      return { ok: true };
    }

    // Perintah Approve: /approve [KODE] atau approve:KODE
    if (
      text.startsWith("/approve") ||
      text.toLowerCase().startsWith("approve ") ||
      text.toLowerCase().startsWith("approve:")
    ) {
      const code = text.replace(/^(\/approve|approve:?)/i, "").trim().split(/\s+/)[0]?.toUpperCase() || "";
      if (!code) {
        await this.client.sendMessage(
          chatId,
          "ℹ️ <i>Format perintah:</i> <code>/approve CO-2026-011</code>"
        );
        return { ok: true };
      }
      return this.approveContent(chatId, code);
    }

    // -------------------------------------------------------------------------
    // RESPON CEPAT & AKURAT (KEPALA TOKO STORE MANAGER FAST PATH)
    // -------------------------------------------------------------------------

    // 1. Ubah target video per hari (contoh: "ubah jadi 2 video per hari", "target 2 video sehari")
    const targetMatch = text.match(/(?:ubah|ganti|jadikan|target)\s*(?:jadi\s*)?(\d+)\s*(?:video|konten)?\s*(?:per\s*hari|sehari)?/i);
    if (targetMatch && targetMatch[1]) {
      const n = parseInt(targetMatch[1], 10);
      if (n > 0 && n <= 10) {
        await executeUpdateSettings({ dailyTarget: n });
        return this.client.sendMessage(
          chatId,
          `⚙️ Target diubah: <b>${n} Konten / Hari</b>`,
          { parse_mode: "HTML" }
        );
      }
    }

    // 2. Ubah jam upload (contoh: "ubah jam upload jadi jam 20:00", "ganti jam upload 19:00")
    const hourMatch = text.match(/(?:ubah|ganti)\s*(?:jam\s*(?:upload|tayang)?\s*(?:jadi\s*(?:jam\s*)?)?)(\d{1,2}[:.]\d{2})/i);
    if (hourMatch && hourMatch[1]) {
      const h = hourMatch[1].replace(".", ":");
      await executeUpdateSettings({ uploadHour: h });
      return this.client.sendMessage(
        chatId,
        `⚙️ Jam upload diubah: <b>${h} WIB</b>`,
        { parse_mode: "HTML" }
      );
    }

    // 2b. Cek Views & Performa Konten Otomatis dari Buffer
    const isAnalyticsQuery =
      /^(cek\s*)?(views?|performa|analitik|hasil\s*upload|analisis|view\s*konten)/i.test(text) ||
      text.toLowerCase().includes("berapa view") ||
      text.toLowerCase().includes("cek view");

    if (isAnalyticsQuery) {
      await this.client.sendChatAction(chatId, "typing");
      const { syncBufferAnalyticsForPublishedItems } = await import(
        "@/lib/services/analytics-sync-engine"
      );
      const syncResult = await syncBufferAnalyticsForPublishedItems(DEFAULT_OWNER_ID);

      const itemsWithViews = syncResult.updatedPublications
        .filter((p) => p.metrics.views > 0 || (p.publicUrl && !p.publicUrl.includes("buffer.com")))
        .slice(0, 5);

      if (itemsWithViews.length === 0) {
        return this.client.sendMessage(
          chatId,
          "📊 <b>Analitik Konten:</b>\nBelum ada data views yang tercatat di Buffer. Sistem akan terus memantau berkala.",
          { parse_mode: "HTML" }
        );
      }

      let replyMsg = `📊 <b>Performa Konten Teratas (Update Otomatis Buffer):</b>\n\n`;
      itemsWithViews.forEach((it, idx) => {
        replyMsg += `${idx + 1}. <b>${it.title}</b>\n`;
        replyMsg += `   👀 <b>${it.metrics.views.toLocaleString()} views</b> • ❤️ ${it.metrics.likes} likes\n`;
        if (it.publicUrl && !it.publicUrl.includes("buffer.com")) {
          replyMsg += `   🔗 <a href="${it.publicUrl}">Tonton di ${it.platform.toUpperCase()}</a>\n`;
        }
        replyMsg += `\n`;
      });

      return this.client.sendMessage(chatId, replyMsg, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
    }

    // 2c. Kueri Link Publik Video (contoh: "link video 001", "link nasi goreng")
    const isLinkQuery = /link\s*(video|konten)?/i.test(text);
    if (isLinkQuery) {
      const { listOrInitializePublications, listContentItems } = await import(
        "@/lib/db/repository"
      );
      const [pubs, allItems] = await Promise.all([
        listOrInitializePublications(DEFAULT_OWNER_ID),
        listContentItems(DEFAULT_OWNER_ID, { includeArchived: true }),
      ]);
      const pubWithLink = pubs.filter(
        (p) => p.externalPostUrl && !p.externalPostUrl.includes("buffer.com")
      );
      const codeM = text.match(/(co-2026-)?(\d{3})/i);
      const targetCode = codeM ? `CO-2026-${codeM[2]}` : null;
      const targetItem = allItems.find((i) => {
        if (targetCode && i.contentCode.toLowerCase() === targetCode.toLowerCase())
          return true;
        const words = text
          .toLowerCase()
          .split(/\s+/)
          .filter(
            (w) =>
              w.length >= 4 &&
              !["link", "video", "konten", "minta", "tolong", "mana"].includes(w)
          );
        return words.length > 0 && words.some((w) => i.title.toLowerCase().includes(w));
      });

      if (targetItem) {
        const itemPubs = pubWithLink.filter((p) => p.contentId === targetItem.id);
        if (itemPubs.length > 0) {
          let linkMsg = `🔗 <b>Link Publik: "${targetItem.title}"</b>\n\n`;
          itemPubs.forEach((p) => {
            linkMsg += `• <b>${p.platform.toUpperCase()}:</b> <a href="${p.externalPostUrl}">${p.externalPostUrl}</a>\n`;
          });
          return this.client.sendMessage(chatId, linkMsg, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          });
        }
      }
    }

    // 3. Resolusi Cepat Langsung Format: [Status] || [Judul]
    // Menjawab instan, 100% presisi tanpa embel-embel, tanpa greeting, dan tanpa halusinasi
    const snapshot = await getStudioStoreSnapshot();
    const directRes = resolveDirectStudioQuery(text, snapshot);
    if (directRes.matched) {
      return this.client.sendMessage(chatId, directRes.replyText, {
        parse_mode: "HTML",
        reply_markup: directRes.inlineButtons ? { inline_keyboard: directRes.inlineButtons } : undefined,
      });
    }

    // Obrolan Bebas & Perintah Fleksibel Lanjutan (Google Gemini AI Kepala Toko Copilot)
    await this.client.sendChatAction(chatId, "typing");

    const aiRes = await askGeminiCopilot({
      userMessage: text,
      senderName,
      snapshot,
    });

    // 1. Bangun tombol aksi dinamis yang relevan di bawah balasan
    const inlineButtons: TelegramInlineButton[][] = [];
    const nextItem = snapshot.nextVideoToUpload;

    if (nextItem) {
      inlineButtons.push([
        {
          text: `⚡ Publish Sekarang`,
          callback_data: `publish:${nextItem.code}`,
        },
        {
          text: `🎬 Tonton Video`,
          callback_data: `review:${nextItem.code}`,
        },
      ]);
    }

    inlineButtons.push([
      { text: "📊 Cek Etalase", callback_data: "menu:status" },
      { text: "🎯 1x Sehari", callback_data: "settings:target:1" },
      { text: "🎯 2x Sehari", callback_data: "settings:target:2" },
    ]);

    // 2. Kirim balasan AI berformat HTML bersih
    await this.client.sendMessage(chatId, aiRes.replyText, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineButtons },
    });

    // 3. Eksekusi semua instruksi aksi yang dikeluarkan oleh Kepala Toko AI
    for (const action of aiRes.actions) {
      try {
        if (action.type === "PUBLISH_NOW" && action.contentCode) {
          await this.client.sendMessage(
            chatId,
            `⏳ <i>Instruksi diterima: Kepala Toko sedang mengeksekusi publikasi <b>${action.contentCode}</b> ke Buffer...</i>`
          );
          const res = await executePublishNow(action.contentCode);
          await this.client.sendMessage(chatId, res.message);
        } else if (action.type === "SCHEDULE_VIDEO" && action.contentCode && action.time) {
          const res = await executeSetSchedule(action.contentCode, action.time);
          await this.client.sendMessage(chatId, res.message);
        } else if (action.type === "UPDATE_SETTINGS") {
          const res = await executeUpdateSettings({
            dailyTarget: action.dailyTarget,
            uploadHour: action.uploadHour,
          });
          await this.client.sendMessage(chatId, res.message);
        } else if (action.type === "AUTO_SCHEDULE") {
          const res = await executeAutoScheduleQueue({
            dailyCount: action.dailyTarget,
            uploadHour: action.uploadHour,
          });
          await this.client.sendMessage(chatId, res.message);
        } else if (action.type === "REVIEW" && action.contentCode) {
          await this.sendVideoReview(chatId, action.contentCode);
        } else if (action.type === "APPROVE" && action.contentCode) {
          await this.approveContent(chatId, action.contentCode);
        }
      } catch (actErr: unknown) {
        console.error("Gagal mengeksekusi aksi dari AI:", actErr);
      }
    }

    return { ok: true };
  }

  private async sendWelcomeMessage(chatId: number | string, senderName: string) {
    const snap = await getStudioStoreSnapshot();

    const welcomeHtml =
      `Halo <b>Mas ${senderName}</b>! 👋\n` +
      `Saya <b>Obim</b>, Kepala Toko & Asisten Eksekutif <b>CeritaObim Studio Copilot</b>.\n\n` +
      `Markas agensi virtual siap mengelola operasional studio:\n` +
      `• 🏢 <b>Kantor Virtual:</b> 5 Departemen Siaga 24/7 (Ketik <code>/office</code>)\n` +
      `• 📊 <b>Pantau Etalase:</b> ${snap.inventory.publishedCount} Tayang | ${snap.inventory.readyCount} Siap Tayang | ${snap.inventory.inProductionCount} Dapur\n` +
      `• ⚡ <b>Video Terdepan:</b> ${snap.nextVideoToUpload ? `<code>${snap.nextVideoToUpload.code}</code> "${snap.nextVideoToUpload.title}"` : "-"}\n` +
      `• 🎯 <b>Setelan:</b> ${snap.settings.dailyVideoTarget} Video/Hari • Jam ${snap.settings.defaultUploadHour}\n\n` +
      `<i>Ketik perintah peran seperti <code>it: status server</code>, <code>manajer: cek stok</code>, atau <code>/office</code> untuk memantau semua ruangan.</i>`;

    const keyboard = {
      keyboard: [
        [{ text: "🏢 Kantor Virtual" }, { text: "📊 Cek Status" }],
        [{ text: "⚡ Publish Konten Selanjutnya Sekarang" }],
        [{ text: "🎬 Video Siap Review" }, { text: "💡 Rekomendasi Ide Konten" }],
      ],
      resize_keyboard: true,
    };

    const inlineKeyboard: TelegramInlineButton[][] = [];
    if (snap.nextVideoToUpload) {
      inlineKeyboard.push([
        {
          text: `⚡ Publish Sekarang (${snap.nextVideoToUpload.code})`,
          callback_data: `publish:${snap.nextVideoToUpload.code}`,
        },
        {
          text: `🎬 Tonton Video`,
          callback_data: `review:${snap.nextVideoToUpload.code}`,
        },
      ]);
    }

    return this.client.sendMessage(chatId, welcomeHtml, {
      parse_mode: "HTML",
      reply_markup: {
        keyboard: keyboard.keyboard,
        resize_keyboard: true,
      },
    });
  }

  private async sendStatusOverview(chatId: number | string) {
    await this.client.sendChatAction(chatId, "typing");
    const snap = await getStudioStoreSnapshot();

    if (snap.inventory.total === 0) {
      return this.client.sendMessage(chatId, "Belum ada konten yang tersimpan di studio.");
    }

    let msg = `📊 <b>LAPORAN OPERASIONAL CERITAOBIM STUDIO</b>\n`;
    msg += `<i>Update: ${snap.nowWibText}</i>\n\n`;

    // 1. Etalase Siap Tayang (Antrean Upload)
    msg += `⚡ <b>SIAP TAYANG DI ETALASE (${snap.inventory.readyCount} Video):</b>\n`;
    if (snap.readyItems.length === 0) {
      msg += `<i>Semua stok etalase sudah tayang! Silakan rakit konten baru di dapur.</i>\n`;
    } else {
      snap.readyItems.slice(0, 5).forEach((item, idx) => {
        msg += `${idx + 1}. <b>${item.title}</b>\n   👉 <i>Jadwal: ${item.scheduleInfo.formatted}</i>\n`;
      });
      if (snap.readyItems.length > 5) {
        msg += `<i>... dan ${snap.readyItems.length - 5} video siap tayang lainnya.</i>\n`;
      }
    }

    // 2. Sudah Tayang
    msg += `\n🚀 <b>SUDAH TAYANG DI MEDSOS (${snap.inventory.publishedCount} Video):</b>\n`;
    snap.publishedItems.slice(0, 5).forEach((item) => {
      msg += `• <b>${item.title}</b> ✅\n`;
    });
    if (snap.publishedItems.length > 5) {
      msg += `<i>... dan ${snap.publishedItems.length - 5} video live lainnya.</i>\n`;
    }

    // 3. Dapur Produksi
    msg += `\n⏳ <b>SEDANG DIRAKIT DI DAPUR (${snap.inventory.inProductionCount} Konten):</b>\n`;
    msg += `• <i>Stok klip origami sedang diproduksi & menunggu perakitan final.</i>\n\n`;
    msg += `⚙️ <b>Setelan:</b> ${snap.settings.dailyVideoTarget} Video/Hari • Jam ${snap.settings.defaultUploadHour}`;

    const inlineButtons: TelegramInlineButton[][] = [];

    if (snap.nextVideoToUpload) {
      inlineButtons.push([
        {
          text: `⚡ Publish Sekarang`,
          callback_data: `publish:${snap.nextVideoToUpload.code}`,
        },
        {
          text: `🎬 Tonton Video`,
          callback_data: `review:${snap.nextVideoToUpload.code}`,
        },
      ]);
    }

    inlineButtons.push([
      { text: "🎯 Set 1x Sehari", callback_data: "settings:target:1" },
      { text: "🎯 Set 2x Sehari", callback_data: "settings:target:2" },
      { text: "🗓️ Rapikan Jadwal Antrean", callback_data: "schedule:auto" },
    ]);

    return this.client.sendMessage(chatId, msg, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineButtons },
    });
  }

  async sendVideoReview(chatId: number | string, contentCode: string) {
    await this.client.sendChatAction(chatId, "upload_video");

    const items = await listContentItems(DEFAULT_OWNER_ID).catch(() => []);
    const item = items.find(
      (i) => i.contentCode.toUpperCase() === contentCode.toUpperCase()
    );

    if (!item) {
      return this.client.sendMessage(
        chatId,
        `❌ Video dengan kode <code>${contentCode}</code> tidak ditemukan di database studio.`
      );
    }

    const assets = await listAssetsForContent(DEFAULT_OWNER_ID, item.id).catch(
      () => []
    );
    const finalAsset = assets.find((a) => a.assetType === "final_video");

    const meta = (finalAsset?.metadata || {}) as Record<string, unknown>;
    const gdriveFileUrl = typeof meta.gdriveFileUrl === "string" ? meta.gdriveFileUrl : "";
    const gdriveFolderUrl = typeof meta.gdriveDayFolderUrl === "string" ? meta.gdriveDayFolderUrl : "";

    const safeTitle = escapeHtml(item.title || "Konten Obim");
    const safeCaptionBody = escapeHtml(item.tiktokCaption || item.instagramCaption || item.narration || "-");

    const statusText =
      item.contentStatus === "published"
        ? "Sudah Tayang di Medsos 🚀"
        : item.contentStatus === "ready_to_publish"
        ? "Siap Tayang di Etalase ✅"
        : "Menunggu Perakitan / Review ⏳";

    let caption =
      `🎬 <b>[${item.contentCode}] ${safeTitle}</b>\n\n` +
      `🏷️ <b>Topik:</b> ${escapeHtml(item.category)} — ${escapeHtml(item.topic)}\n` +
      `📝 <b>Caption Medsos:</b>\n` +
      `<code>${safeCaptionBody}</code>\n\n` +
      `Status: <b>${statusText}</b>`;

    if (!finalAsset) {
      caption += `\n\n⚠️ <i>Catatan: Video final MP4 belum selesai dirakit. Di atas adalah pratinjau naskah & caption. Anda tetap bisa menyetujuinya jika naskah sudah siap!</i>`;
    }

    const inlineKeyboard: TelegramInlineButton[][] = [];

    // Tombol Publish Sekarang jika video sudah siap
    if (item.contentStatus !== "published") {
      inlineKeyboard.push([
        {
          text: `⚡ Publish Sekarang (${item.contentCode})`,
          callback_data: `publish:${item.contentCode}`,
        },
      ]);
    }

    if (item.contentStatus !== "ready_to_publish" && item.contentStatus !== "published") {
      inlineKeyboard.push([
        {
          text: "✅ Setujui & Masukkan Etalase",
          callback_data: `approve:${item.contentCode}`,
        },
      ]);
    }

    inlineKeyboard.push([
      {
        text: "📋 Salin TikTok",
        callback_data: `copy:${item.contentCode}:tiktok`,
      },
      {
        text: "📋 Salin Reels",
        callback_data: `copy:${item.contentCode}:reels`,
      },
    ]);

    if (gdriveFileUrl || gdriveFolderUrl) {
      inlineKeyboard.push([
        {
          text: "🔗 Buka Video di Google Drive",
          url: gdriveFileUrl || gdriveFolderUrl,
        },
      ]);
    }

    // 1. Coba kirimkan video langsung jika link streaming / GDrive tersedia
    if (gdriveFileUrl) {
      try {
        const fileIdMatch = gdriveFileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) || gdriveFileUrl.match(/id=([a-zA-Z0-9_-]+)/);
        const directVideoUrl = fileIdMatch
          ? `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`
          : gdriveFileUrl;

        await this.client.sendVideo(chatId, directVideoUrl, {
          caption,
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        return { ok: true };
      } catch (videoErr) {
        console.warn("Gagal kirim video URL langsung, fallback ke kartu info:", videoErr);
      }
    }

    // 2. Fallback: Kirimkan kartu review lengkap
    return this.client.sendMessage(chatId, caption, {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: inlineKeyboard },
    });
  }

  private async approveContent(chatId: number | string, contentCode: string) {
    const items = await listContentItems(DEFAULT_OWNER_ID).catch(() => []);
    const item = items.find(
      (i) => i.contentCode.toUpperCase() === contentCode.toUpperCase()
    );

    if (!item) {
      return this.client.sendMessage(
        chatId,
        `❌ Konten <code>${contentCode}</code> tidak ditemukan.`
      );
    }

    await updateContentItem(DEFAULT_OWNER_ID, {
      id: item.id,
      contentStatus: "ready_to_publish",
    });

    return this.client.sendMessage(
      chatId,
      `🎉 <b>Disetujui Mas!</b>\nVideo <b>[${item.contentCode}] "${item.title}"</b> kini berstatus <b>Siap Tayang</b> dan masuk ke etalase antrean medsos!`,
      {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `⚡ Publish Sekarang (${item.contentCode})`,
                callback_data: `publish:${item.contentCode}`,
              },
              {
                text: "📊 Cek Etalase",
                callback_data: "menu:status",
              },
            ],
          ],
        },
      }
    );
  }

  private async handleCallbackQuery(cb: TelegramCallbackQuery) {
    const callbackId = cb.id;
    const chatId = cb.message?.chat?.id;
    const senderId = String(cb.from?.id || "");
    const data = String(cb.data || "");

    if (!chatId) {
      await this.client.answerCallbackQuery(callbackId, "Chat tidak valid");
      return { ok: true, ignored: true };
    }

    if (!this.isAuthorized(senderId)) {
      await this.client.answerCallbackQuery(callbackId, "⛔ Akses ditolak", true);
      return { ok: true, unauthorized: true };
    }

    const parts = data.split(":");
    const action = parts[0];
    const codeOrArg = parts[1];
    const sub = parts[2];

    if (action === "publish" && codeOrArg) {
      await this.client.answerCallbackQuery(callbackId, `Mengunggah ${codeOrArg}...`);
      await this.client.sendMessage(chatId, `⏳ <i>Sedang mengunggah <b>${codeOrArg}</b> ke Buffer...</i>`);
      const res = await executePublishNow(codeOrArg);
      await this.client.sendMessage(chatId, res.message);
      return { ok: true };
    }

    if (action === "review" && codeOrArg) {
      await this.client.answerCallbackQuery(callbackId, `Memuat review ${codeOrArg}...`);
      return this.sendVideoReview(chatId, codeOrArg);
    }

    if (action === "approve" && codeOrArg) {
      await this.client.answerCallbackQuery(callbackId, `Konten ${codeOrArg} disetujui! ✅`);
      return this.approveContent(chatId, codeOrArg);
    }

    if (action === "menu" && codeOrArg === "status") {
      await this.client.answerCallbackQuery(callbackId, "Memuat status etalase...");
      return this.sendStatusOverview(chatId);
    }

    if (action === "schedule" && codeOrArg === "auto") {
      await this.client.answerCallbackQuery(callbackId, "Merapikan antrean jadwal...");
      const res = await executeAutoScheduleQueue();
      await this.client.sendMessage(chatId, res.message);
      return { ok: true };
    }

    if (action === "settings" && codeOrArg === "target" && sub) {
      const targetCount = parseInt(sub, 10) || 1;
      await this.client.answerCallbackQuery(callbackId, `Target diset ${targetCount}x/hari!`);
      const res = await executeUpdateSettings({ dailyTarget: targetCount });
      await this.client.sendMessage(chatId, res.message);
      return { ok: true };
    }

    if (action === "settings" && codeOrArg === "hour" && sub) {
      await this.client.answerCallbackQuery(callbackId, `Jam tayang diubah ke ${sub} WIB!`);
      const res = await executeUpdateSettings({ uploadHour: sub });
      await this.client.sendMessage(chatId, res.message);
      return { ok: true };
    }

    if (action === "copy" && codeOrArg && sub) {
      await this.client.answerCallbackQuery(callbackId, `Caption ${sub.toUpperCase()} dimuat!`);
      const items = await listContentItems(DEFAULT_OWNER_ID).catch(() => []);
      const item = items.find((i) => i.contentCode.toUpperCase() === codeOrArg.toUpperCase());
      if (item) {
        const copyText = sub === "reels" ? (item.instagramCaption || item.tiktokCaption) : item.tiktokCaption;
        await this.client.sendMessage(
          chatId,
          `📋 <b>Caption ${sub.toUpperCase()} untuk ${item.contentCode}:</b>\n\n` +
          `<code>${copyText || item.narration}</code>\n\n` +
          `<i>(Sentuh teks di atas untuk otomatis menyalin ke clipboard)</i>`,
          { parse_mode: "HTML" }
        );
      }
      return { ok: true };
    }

    await this.client.answerCallbackQuery(callbackId);
    return { ok: true };
  }
}
