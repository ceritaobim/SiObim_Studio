/**
 * CeritaObim Studio — Telegram Bot Service & Orchestrator
 *
 * Menghubungkan Telegram Client, Database Konten Studio, Google Drive,
 * dan Google Gemini AI Copilot dalam satu alur yang aman dan responsif.
 */

import { TelegramClient, type TelegramInlineButton } from "./telegram-client";
import { askGeminiCopilot } from "./telegram-ai-copilot";
import {
  listContentItems,
  listAssetsForContent,
  updateContentItem,
} from "@/lib/db/repository";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import type { ContentItemRecord } from "@/types/domain";

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
    const senderName = message.from?.first_name || "Creator";
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

    // Perintah: /start atau /help
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
        await this.client.sendMessage(
          chatId,
          "ℹ️ Format perintah: <code>/review CO-2026-002</code>\nAtau Anda bisa ketik santai: <i>'Kirim video tentang nasi goreng'</i>"
        );
        return { ok: true };
      }
      return this.sendVideoReview(chatId, code);
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
          "ℹ️ Format perintah: <code>/approve CO-2026-002</code>"
        );
        return { ok: true };
      }
      return this.approveContent(chatId, code);
    }

    // Obrolan Fleksibel Bebas (Google Gemini AI Copilot)
    await this.client.sendChatAction(chatId, "typing");

    const allItems = await listContentItems(DEFAULT_OWNER_ID).catch(() => []);
    const completedCodes = await this.getCompletedContentCodes(allItems);

    const aiRes = await askGeminiCopilot({
      userMessage: text,
      senderName,
      contentItems: allItems,
      completedCodes,
    });

    // Kirim jawaban teks dari Gemini
    await this.client.sendMessage(chatId, aiRes.replyText, {
      parse_mode: "HTML",
    });

    // Jalankan action jika AI mendeteksi permintaan review atau approval
    if (aiRes.action?.type === "REVIEW" && aiRes.action.contentCode) {
      await this.sendVideoReview(chatId, aiRes.action.contentCode);
    } else if (aiRes.action?.type === "APPROVE" && aiRes.action.contentCode) {
      await this.approveContent(chatId, aiRes.action.contentCode);
    }

    return { ok: true };
  }

  private async sendWelcomeMessage(chatId: number | string, senderName: string) {
    const welcomeHtml = `Halo <b>${senderName}</b>! 👋\n` +
      `Selamat datang di <b>CeritaObim Studio Copilot</b>.\n\n` +
      `Saya asisten pribadi Anda untuk mengontrol produksi video saat Anda berada di luar:\n` +
      `• 📊 <b>Cek Status</b>: Pantau video yang siap tayang & masih pending.\n` +
      `• 🎬 <b>Review Video</b>: Tonton video 00Final.mp4 langsung di Telegram.\n` +
      `• 🚀 <b>Setujui & Jadwalkan</b>: Tandai video siap tayang sekali klik.\n` +
      `• 💬 <b>Chat Bebas</b>: Ngobrol santai pakai Google AI (tanya ide, minta caption, dll).\n\n` +
      `<i>Ketik pertanyaan apa saja atau gunakan tombol cepat di bawah:</i>`;

    const keyboard = {
      keyboard: [
        [{ text: "📊 Cek Status" }, { text: "🎬 Video Siap Review" }],
        [{ text: "💡 Rekomendasi Ide Konten" }],
      ],
      resize_keyboard: true,
    };

    return this.client.sendMessage(chatId, welcomeHtml, {
      parse_mode: "HTML",
      reply_markup: keyboard,
    });
  }

  private async sendStatusOverview(chatId: number | string) {
    await this.client.sendChatAction(chatId, "typing");
    const items = await listContentItems(DEFAULT_OWNER_ID).catch(() => []);
    if (items.length === 0) {
      return this.client.sendMessage(chatId, "Belum ada konten yang tersimpan di studio.");
    }

    const completedCodes = await this.getCompletedContentCodes(items);

    const completedItems = items.filter((i) =>
      completedCodes.includes(i.contentCode.toUpperCase())
    );
    const pendingItems = items.filter(
      (i) => !completedCodes.includes(i.contentCode.toUpperCase())
    );

    let msg = `📊 <b>STATUS PRODUKSI CERITAOBIM STUDIO</b>\n\n`;
    msg += `<b>✅ SUDAH FINAL (${completedItems.length} Video di GDrive):</b>\n`;

    if (completedItems.length === 0) {
      msg += `<i>Belum ada video final yang selesai dirakit.</i>\n`;
    } else {
      completedItems.slice(0, 10).forEach((item) => {
        msg += `• <b>${item.contentCode}</b>: "${item.title}"\n  👉 /review_${item.contentCode.replace(/-/g, "_")}\n`;
      });
      if (completedItems.length > 10) {
        msg += `<i>... dan ${completedItems.length - 10} video final lainnya.</i>\n`;
      }
    }

    msg += `\n<b>⏳ MASIH PROSES / PENDING (${pendingItems.length} Konten):</b>\n`;
    if (pendingItems.length === 0) {
      msg += `<i>Semua konten telah selesai 100%! 🎉</i>\n`;
    } else {
      pendingItems.slice(0, 8).forEach((item) => {
        msg += `• [${item.contentCode}] ${item.title}\n`;
      });
      if (pendingItems.length > 8) {
        msg += `<i>... dan ${pendingItems.length - 8} konten pending lainnya.</i>\n`;
      }
    }

    // Buat tombol inline review untuk 3 konten final teratas
    const inlineButtons: TelegramInlineButton[][] = completedItems.slice(0, 3).map((item) => [
      {
        text: `🎬 Review ${item.contentCode} (${item.title.slice(0, 24)}...)`,
        callback_data: `review:${item.contentCode}`,
      },
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
        `❌ Konten dengan kode <code>${contentCode}</code> tidak ditemukan di database studio.`
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
    const safeCategory = escapeHtml(item.category || "Umum");
    const safeTopic = escapeHtml(item.topic || "-");
    const safeHook = escapeHtml(item.hook || (item.narration ? item.narration.slice(0, 60) : "-"));
    const safeCaptionBody = escapeHtml(item.tiktokCaption || item.instagramCaption || item.narration || "-");

    let caption = `🎬 <b>[${item.contentCode}] ${safeTitle}</b>\n` +
      `🏷️ <b>Topik:</b> ${safeCategory} — ${safeTopic}\n` +
      `🎣 <b>Hook:</b> "${safeHook}..."\n\n` +
      `📝 <b>Caption TikTok / Reels:</b>\n` +
      `<code>${safeCaptionBody}</code>\n\n` +
      `Status: <b>${item.contentStatus.toUpperCase()}</b>`;

    if (!finalAsset) {
      caption += `\n\n⚠️ <i>Catatan: Video final MP4 belum selesai dirakit di studio. Di atas adalah pratinjau naskah & caption. Anda tetap bisa menyetujuinya jika naskah sudah siap!</i>`;
    }

    const inlineKeyboard: TelegramInlineButton[][] = [
      [
        {
          text: "✅ Setujui & Siap Tayang",
          callback_data: `approve:${item.contentCode}`,
        },
      ],
      [
        {
          text: "📋 Salin Caption TikTok",
          callback_data: `copy:${item.contentCode}:tiktok`,
        },
        {
          text: "📋 Salin Reels",
          callback_data: `copy:${item.contentCode}:reels`,
        },
      ],
    ];

    if (gdriveFileUrl || gdriveFolderUrl) {
      inlineKeyboard.push([
        {
          text: "🔗 Buka File di Google Drive",
          url: gdriveFileUrl || gdriveFolderUrl,
        },
      ]);
    }

    // 1. Coba kirimkan video langsung jika link streaming / GDrive tersedia
    if (gdriveFileUrl) {
      try {
        // Format direct download link dari Google Drive
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

    // 2. Fallback: Kirimkan kartu review lengkap dengan link GDrive jika video belum bisa distreaming langsung
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
      `🎉 <b>Status Diperbarui!</b>\nKonten <b>${item.contentCode}</b> "${item.title}" telah disetujui dan berstatus: <b>READY TO PUBLISH</b> (Siap Tayang).`
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

    const [action, code, sub] = data.split(":");

    if (action === "review" && code) {
      await this.client.answerCallbackQuery(callbackId, `Memuat review ${code}...`);
      return this.sendVideoReview(chatId, code);
    }

    if (action === "approve" && code) {
      await this.client.answerCallbackQuery(callbackId, `Konten ${code} disetujui! ✅`);
      return this.approveContent(chatId, code);
    }

    if (action === "copy" && code && sub) {
      await this.client.answerCallbackQuery(callbackId, `Caption ${sub.toUpperCase()} dimuat!`);
      const items = await listContentItems(DEFAULT_OWNER_ID).catch(() => []);
      const item = items.find((i) => i.contentCode.toUpperCase() === code.toUpperCase());
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

  private async getCompletedContentCodes(items: ContentItemRecord[]): Promise<string[]> {
    const completed: string[] = [];
    for (const item of items) {
      if (
        item.contentStatus === "assembled" ||
        item.contentStatus === "approved" ||
        item.contentStatus === "ready_to_publish" ||
        item.contentStatus === "published"
      ) {
        completed.push(item.contentCode.toUpperCase());
        continue;
      }
      // Cek apakah memiliki asset final_video
      const assets = await listAssetsForContent(DEFAULT_OWNER_ID, item.id).catch(() => []);
      if (assets.some((a) => a.assetType === "final_video")) {
        completed.push(item.contentCode.toUpperCase());
      }
    }
    return completed;
  }
}
