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
  listAuthenticatedTelegramUsers,
  saveAuthenticatedTelegramUser,
  removeAuthenticatedTelegramUser,
  getStudioTelegramPasscode,
  setStudioTelegramPasscode,
} from "@/lib/db/repository";
import { DEFAULT_OWNER_ID } from "@/lib/config/env";
import {
  loadVirtualOfficeCloudSync,
  recordVirtualOfficeEvent,
  syncUpdateProfileCreditsAsync,
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
    this.allowedUserId = (
      process.env.TELEGRAM_ALLOWED_USER_IDS ||
      process.env.TELEGRAM_ALLOWED_USER_ID ||
      ""
    ).trim();
  }

  isAuthorized(senderId: string | number): boolean {
    const raw = (
      process.env.TELEGRAM_ALLOWED_USER_IDS ||
      process.env.TELEGRAM_ALLOWED_USER_ID ||
      this.allowedUserId ||
      ""
    ).trim();

    const allowedList = raw
      ? raw
          .split(/[,;\s]+/)
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    const idStr = String(senderId).trim();
    if (idStr && allowedList.includes(idStr)) {
      return true;
    }

    try {
      const dbUsers = listAuthenticatedTelegramUsers();
      if (dbUsers.some((u) => String(u.userId).trim() === idStr)) {
        return true;
      }
    } catch (e) {
      console.error("[TELEGRAM] Error checking authenticated users from store:", e);
    }

    return false;
  }

  isOwnerOrAdmin(senderId: string | number): boolean {
    const idStr = String(senderId).trim();
    if (!idStr) return false;

    const raw = (
      process.env.TELEGRAM_ALLOWED_USER_IDS ||
      process.env.TELEGRAM_ALLOWED_USER_ID ||
      this.allowedUserId ||
      ""
    ).trim();

    const allowedList = raw
      ? raw
          .split(/[,;\s]+/)
          .map((id) => id.trim())
          .filter(Boolean)
      : [];

    if (allowedList.length > 0 && allowedList.includes(idStr)) {
      return true;
    }

    try {
      const dbUsers = listAuthenticatedTelegramUsers();
      const match = dbUsers.find((u) => String(u.userId).trim() === idStr);
      if (match && (match.role === "owner" || match.role === "admin")) {
        return true;
      }
    } catch {}

    return false;
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
    const senderUsername = message.from?.username || "";
    const text = message.text.trim();

    // Validasi Keamanan: Whitelist User ID & Passcode Login
    if (!this.isAuthorized(senderId)) {
      const studioPasscode = getStudioTelegramPasscode();
      const loginRegex = /^\/(?:login|masuk|start)(?:\s+(.+))?$/i;
      const loginMatch = text.match(loginRegex);

      let providedPasscode: string | null = null;
      if (loginMatch && loginMatch[1]) {
        providedPasscode = loginMatch[1].trim();
      } else if (
        !text.startsWith("/") &&
        (text.toLowerCase() === studioPasscode.toLowerCase() || text === studioPasscode)
      ) {
        providedPasscode = text.trim();
      }

      if (providedPasscode) {
        if (
          providedPasscode.toLowerCase() === studioPasscode.toLowerCase() ||
          providedPasscode === studioPasscode
        ) {
          const isFirstOwner =
            senderId === "1295640663" ||
            (process.env.TELEGRAM_ALLOWED_USER_ID || "")
              .split(/[,;\s]+/)
              .map((s) => s.trim())
              .includes(senderId);

          saveAuthenticatedTelegramUser({
            userId: senderId,
            username: senderUsername,
            firstName: senderName,
            role: isFirstOwner ? "owner" : "member",
            authenticatedAt: new Date().toISOString(),
            lastActiveAt: new Date().toISOString(),
          });

          console.info(`[TELEGRAM] User baru berhasil login & terdaftar: ${senderId} (${senderName})`);
          await this.client.sendMessage(
            chatId,
            `🎉 <b>Login Berhasil! Selamat Datang di CeritaObim Studio</b>\n\n` +
            `Halo <b>${escapeHtml(senderName)}</b>, akun Telegram Anda telah terverifikasi dan <b>tersimpan secara permanen</b> di sistem studio.\n\n` +
            `✅ <b>Status:</b> Terautentikasi (Tidak perlu login lagi)\n` +
            `🆔 <b>User ID:</b> <code>${senderId}</code>\n\n` +
            `Mulai sekarang Anda dapat langsung mengakses Copilot Studio, memantau antrean video, cek etalase, hingga status kantor virtual.\n\n` +
            `Ketik <b>/help</b> atau <b>/status</b> untuk memulai! 🚀`,
            { parse_mode: "HTML" }
          );
          return { ok: true, authenticated: true };
        } else {
          await this.client.sendMessage(
            chatId,
            `❌ <b>Passcode Salah</b>\n\n` +
            `Passcode yang Anda masukkan tidak valid.\n` +
            `Silakan coba lagi dengan format:\n` +
            `<code>/login [passcode]</code>\n\n` +
            `<i>Hubungi Owner CeritaObim Studio jika Anda belum memiliki passcode akses.</i>`,
            { parse_mode: "HTML" }
          );
          return { ok: true, unauthorized: true, invalidPasscode: true };
        }
      }

      console.warn(`[TELEGRAM] Akses ditolak untuk user ID tidak dikenal: ${senderId} (${message.from?.username})`);
      await this.client.sendMessage(
        chatId,
        `⛔ <b>Akses Ditolak</b>\nMaaf, bot ini adalah asisten pribadi eksklusif milik channel CeritaObim Studio dan hanya dapat diakses oleh user yang diizinkan.\n\n` +
        `🔐 <b>Ingin Masuk?</b>\n` +
        `Jika Anda memiliki <b>Studio Passcode</b>, silakan ketik:\n` +
        `<code>/login [passcode]</code>\n` +
        `<i>(Contoh: <code>/login obim2026</code>)</i>\n\n` +
        `💡 <i>Anda hanya perlu login <b>1 kali saja</b>. Akun Telegram Anda akan diingat selamanya tanpa perlu login ulang!</i>\n\n` +
        `🆔 <b>User ID Telegram Anda:</b> <code>${senderId}</code>\n` +
        `<i>Berikan nomor User ID ini kepada Owner Studio untuk didaftarkan ke daftar izin bot.</i>`
      );
      return { ok: true, unauthorized: true };
    }

    // Perbarui jejak aktivitas terakhir untuk pengguna terdaftar
    try {
      const dbUsers = listAuthenticatedTelegramUsers();
      const existing = dbUsers.find((u) => String(u.userId).trim() === senderId);
      if (existing) {
        saveAuthenticatedTelegramUser({
          ...existing,
          lastActiveAt: new Date().toISOString(),
          username: senderUsername || existing.username,
          firstName: senderName || existing.firstName,
        });
      }
    } catch {}

    const lowerText = text.toLowerCase();

    // Perintah User Management: /login (ketika sudah terautentikasi)
    if (lowerText.startsWith("/login") || lowerText.startsWith("/masuk")) {
      return this.client.sendMessage(
        chatId,
        `ℹ️ <b>Anda Sudah Terverifikasi</b>\n\n` +
        `Akun Telegram Anda (ID: <code>${senderId}</code>) sudah aktif dan terdaftar secara permanen di CeritaObim Studio.\n\n` +
        `Ketik <code>/whoami</code> untuk melihat detail akun atau <code>/help</code> untuk bantuan menu.`,
        { parse_mode: "HTML" }
      );
    }

    // Perintah User Management: /whoami, /akun, /profil
    if (lowerText === "/whoami" || lowerText === "/akun" || lowerText === "/profil") {
      const isOwner = this.isOwnerOrAdmin(senderId);
      const dbUsers = listAuthenticatedTelegramUsers();
      const userRecord = dbUsers.find((u) => String(u.userId).trim() === senderId);
      const roleText = isOwner ? "👑 Studio Owner / Super Admin" : "👤 Tim Studio Member";
      const sinceText = userRecord?.authenticatedAt
        ? new Date(userRecord.authenticatedAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
        : "Permanent Whitelist";

      const msg =
        `👤 <b>Informasi Akun Telegram Studio</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Nama:</b> ${escapeHtml(senderName)}\n` +
        `• <b>Username:</b> ${senderUsername ? "@" + escapeHtml(senderUsername) : "-"}\n` +
        `• <b>Telegram User ID:</b> <code>${senderId}</code>\n` +
        `• <b>Peran:</b> ${roleText}\n` +
        `• <b>Status Login:</b> ✅ Terautentikasi (Permanen)\n` +
        `• <b>Terdaftar Sejak:</b> ${sinceText} WIB\n\n` +
        `💡 <i>Ketik <code>/logout</code> jika ingin keluar dari sesi ini.</i>`;

      return this.client.sendMessage(chatId, msg, { parse_mode: "HTML" });
    }

    // Perintah User Management: /logout, /keluar
    if (lowerText === "/logout" || lowerText === "/keluar") {
      removeAuthenticatedTelegramUser(senderId);
      return this.client.sendMessage(
        chatId,
        `🚪 <b>Logout Berhasil</b>\n\n` +
        `Sesi akses bot Telegram Anda telah dihapus dari sistem studio.\n\n` +
        `Untuk masuk kembali di kemudian hari, ketik:\n` +
        `<code>/login [passcode]</code>`,
        { parse_mode: "HTML" }
      );
    }

    // Perintah User Management (Admin/Owner): /users, /listusers, /pengguna
    if (lowerText === "/users" || lowerText === "/listusers" || lowerText === "/pengguna") {
      if (!this.isOwnerOrAdmin(senderId)) {
        return this.client.sendMessage(
          chatId,
          "⛔ Perintah ini hanya dapat diakses oleh Owner / Admin Studio."
        );
      }

      const users = listAuthenticatedTelegramUsers();
      let msg = `👥 <b>Daftar Pengguna Telegram Terverifikasi</b>\n━━━━━━━━━━━━━━━━━━━━\n`;
      if (users.length === 0) {
        msg += `<i>Belum ada user yang login via passcode. (Akses saat ini aktif melalui static whitelist .env)</i>\n\n`;
      } else {
        users.forEach((u, i) => {
          const uRole = u.role === "owner" ? "👑 Owner" : "👤 Member";
          const uName = escapeHtml(u.firstName || u.username || "User");
          const uTag = u.username ? ` (@${escapeHtml(u.username)})` : "";
          msg += `${i + 1}. <b>${uName}</b>${uTag}\n`;
          msg += `   └ ID: <code>${u.userId}</code> | ${uRole}\n`;
        });
        msg += `\nTotal: <b>${users.length} pengguna</b> terdaftar permanen.\n\n`;
      }
      msg += `💡 <b>Perintah Admin:</b>\n`;
      msg += `• Cabut akses: <code>/revoke [User_ID]</code>\n`;
      msg += `• Ganti passcode: <code>/setpasscode [passcode_baru]</code>`;

      return this.client.sendMessage(chatId, msg, { parse_mode: "HTML" });
    }

    // Perintah User Management (Admin/Owner): /revoke [User_ID], /hapususer [User_ID]
    if (lowerText.startsWith("/revoke") || lowerText.startsWith("/hapususer")) {
      if (!this.isOwnerOrAdmin(senderId)) {
        return this.client.sendMessage(
          chatId,
          "⛔ Perintah ini hanya dapat diakses oleh Owner / Admin Studio."
        );
      }

      const targetId = text.replace(/^\/(?:revoke|hapususer)/i, "").trim().split(/\s+/)[0];
      if (!targetId) {
        return this.client.sendMessage(
          chatId,
          "ℹ️ <i>Format perintah:</i> <code>/revoke [User_ID]</code>\nContoh: <code>/revoke 987654321</code>"
        );
      }

      const removed = removeAuthenticatedTelegramUser(targetId);
      if (removed) {
        return this.client.sendMessage(
          chatId,
          `✅ <b>Akses Dicabut</b>\nUser ID <code>${targetId}</code> telah berhasil dihapus dari daftar akses studio. Pengguna tersebut harus login ulang untuk dapat mengakses bot.`,
          { parse_mode: "HTML" }
        );
      } else {
        return this.client.sendMessage(
          chatId,
          `⚠️ User ID <code>${targetId}</code> tidak ditemukan di daftar pengguna aktif.`,
          { parse_mode: "HTML" }
        );
      }
    }

    // Perintah User Management (Admin/Owner): /setpasscode [passcode], /gantipasscode [passcode]
    if (lowerText.startsWith("/setpasscode") || lowerText.startsWith("/gantipasscode")) {
      if (!this.isOwnerOrAdmin(senderId)) {
        return this.client.sendMessage(
          chatId,
          "⛔ Perintah ini hanya dapat diakses oleh Owner / Admin Studio."
        );
      }

      const newPass = text.replace(/^\/(?:setpasscode|gantipasscode)/i, "").trim();
      if (!newPass) {
        const cur = getStudioTelegramPasscode();
        return this.client.sendMessage(
          chatId,
          `🔑 <b>Passcode Studio Saat Ini:</b> <code>${cur}</code>\n\nUntuk mengubahnya, ketik:\n<code>/setpasscode [passcode_baru]</code>`,
          { parse_mode: "HTML" }
        );
      }

      setStudioTelegramPasscode(newPass);
      return this.client.sendMessage(
        chatId,
        `✅ <b>Passcode Studio Berhasil Diperbarui!</b>\n\n🔑 <b>Passcode Baru:</b> <code>${escapeHtml(newPass)}</code>\n\nPengguna baru sekarang dapat login menggunakan passcode ini. Pengguna yang sudah login sebelumnya tetap dapat mengakses tanpa perlu login ulang.`,
        { parse_mode: "HTML" }
      );
    }

    // Rekam sinyal perintah Telegram agar karakter di Kantor Virtual 3D langsung bereaksi!
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

    // Perintah Kantor Virtual 3D: /kantor, /office, "🏢 Kantor Virtual", atau "cek kantor"
    if (
      lowerText === "/kantor" ||
      lowerText === "/office" ||
      lowerText === "kantor" ||
      lowerText === "cek kantor" ||
      lowerText.includes("kantor virtual")
    ) {
      await loadVirtualOfficeCloudSync();
      const flowAccs = listFlowProfileAccounts().slice(0, 11);
      const resting = flowAccs.filter((a) => a.credits === 0);
      const working = flowAccs.filter((a) => a.credits > 0);
      const totalKr = flowAccs.reduce((acc, a) => acc + a.credits, 0);

      const msg =
        `🏢 <b>Status Live Kantor Virtual 3D Obim Studio</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `• <b>Tim Produksi Video:</b> 11 Editor + 1 PIC (Mas Radit)\n` +
        `• <b>Standby di PC Masing-Masing:</b> ${working.length} Editor 💻\n` +
        `• <b>Duduk di Kursi Istirahat (Lounge):</b> ${resting.length} Editor ☕\n` +
        `• <b>Total Kuota Render:</b> ${totalKr} / 550 kr\n` +
        `• <b>Tim Naskah & Publisher Buffer:</b> Aktif di ruangan masing-masing\n\n` +
        `💡 <i>Perintah Cepat Kantor 3D dari Telegram:</i>\n` +
        `• Ketik <code>semua editor istirahat</code> — Semua 11 editor pindah dari PC ke kursi istirahat\n` +
        `• Ketik <code>editor standby</code> — Semua 11 editor jalan kembali ke PC masing-masing`;

      return this.client.sendMessage(chatId, msg, {
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "☕ Semua Editor Istirahat", callback_data: "office:rest_all" },
              { text: "💻 Semua Editor Standby ke PC", callback_data: "office:standby_all" },
            ],
          ],
        },
      });
    }

    // Perintah Standby / Kembali ke PC Masing-Masing dari Telegram (Command atau Kalimat Natural)
    const isStandbyEditorsCommand =
      lowerText === "/refill" ||
      lowerText === "/standby" ||
      lowerText === "/kerja" ||
      lowerText === "standby" ||
      lowerText === "editor standby" ||
      lowerText === "semua editor standby" ||
      lowerText === "refill semua" ||
      lowerText === "isi kuota" ||
      /(?:editor|semua|tim|mereka).*(?:standby|stand\s*by|kembali\s*ke\s*pc|kembali\s*ke\s*komputer|kembali\s*ke\s*meja|balik\s*ke\s*pc|balik\s*kerja|kerja\s*lagi|refill|isi\s*kuota)/i.test(
        lowerText
      ) ||
      /(?:standby|stand\s*by|kembali\s*ke\s*pc|kembali\s*ke\s*komputer|kembali\s*ke\s*meja|balik\s*ke\s*pc|refill).*(?:editor|semua|tim)/i.test(
        lowerText
      );

    if (isStandbyEditorsCommand) {
      const singleProfileMatch =
        !lowerText.includes("semua") && lowerText.match(/profil\s*(\d{1,2})/i);
      if (singleProfileMatch && singleProfileMatch[1]) {
        const idx = parseInt(singleProfileMatch[1], 10);
        await syncUpdateProfileCreditsAsync({
          profileIndex: idx,
          credits: 50,
          source: "telegram",
        });
        return this.client.sendMessage(
          chatId,
          `💻 <b>Editor Profil ${idx} Kembali Standby di PC!</b>\nProfil ${idx} telah berjalan kembali dari kursi istirahat menuju meja PC kerjanya dengan kuota penuh (50/50 kr).`,
          { parse_mode: "HTML" }
        );
      }

      await syncUpdateProfileCreditsAsync({
        credits: 50,
        allProfiles: true,
        source: "telegram",
      });
      return this.client.sendMessage(
        chatId,
        `💻 <b>Seluruh 11 Editor Video Kembali Standby di PC Masing-Masing!</b>\nSemua editor (Profil 1 s/d Profil 11) di Kantor Virtual 3D sedang berjalan kembali dari kursi istirahat menuju meja PC masing-masing dan siap bekerja (50/50 kr).`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "☕ Suruh Semua Editor Istirahat", callback_data: "office:rest_all" },
                { text: "🏢 Cek Status Kantor 3D", callback_data: "office:status" },
              ],
            ],
          },
        }
      );
    }

    // Perintah Semua Editor Istirahat ke Kursi Istirahat (Lounge) dari Telegram (Command atau Kalimat Natural)
    const isRestEditorsCommand =
      lowerText === "/lounge" ||
      lowerText === "/istirahat" ||
      lowerText === "istirahat" ||
      lowerText === "editor istirahat" ||
      lowerText === "semua editor istirahat" ||
      lowerText === "istirahat semua" ||
      /(?:editor|semua|tim|mereka).*(?:istirahat|lounge|kursi\s*istirahat|ngopi|rehat|santai)/i.test(
        lowerText
      ) ||
      /(?:istirahat|ke\s*lounge|ke\s*kursi\s*istirahat|suruh\s*istirahat).*(?:editor|semua|tim)/i.test(
        lowerText
      );

    if (isRestEditorsCommand) {
      const singleProfileMatch =
        !lowerText.includes("semua") && lowerText.match(/profil\s*(\d{1,2})/i);
      if (singleProfileMatch && singleProfileMatch[1]) {
        const idx = parseInt(singleProfileMatch[1], 10);
        await syncUpdateProfileCreditsAsync({
          profileIndex: idx,
          credits: 0,
          source: "telegram",
        });
        return this.client.sendMessage(
          chatId,
          `☕ <b>Editor Profil ${idx} Berpindah ke Kursi Istirahat!</b>\nProfil ${idx} telah meninggalkan PC dan berjalan menuju kursi istirahat di Lounge Warkop Obim.`,
          { parse_mode: "HTML" }
        );
      }

      await syncUpdateProfileCreditsAsync({
        credits: 0,
        allProfiles: true,
        source: "telegram",
      });
      return this.client.sendMessage(
        chatId,
        `☕ <b>Seluruh 11 Editor Video Berpindah ke Kursi Istirahat!</b>\nSemua editor (Profil 1 s/d Profil 11) di Kantor Virtual 3D telah beranjak dari depan PC mereka dan berjalan menuju kursi istirahat di <b>Lounge Warkop Obim</b>.\n\n💡 <i>Ketik <code>editor standby</code> kapan saja agar semua editor jalan kembali ke PC masing-masing.</i>`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                { text: "💻 Panggil Semua Editor Standby ke PC", callback_data: "office:standby_all" },
                { text: "🏢 Cek Status Kantor 3D", callback_data: "office:status" },
              ],
            ],
          },
        }
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

    // 3. Delegasi Peran Spesifik (HANYA jika diawali prefix eksplisit "it:", "manajer:", "audio:", "produser:", "kreatif:")
    await loadVirtualOfficeCloudSync();
    const snapshot = await getStudioStoreSnapshot();
    const isExplicitRolePrefix = /^(it|devops|manajer|manager|audio|voice|produser|script|kreatif|video)\s*:/i.test(
      text.trim()
    );
    if (isExplicitRolePrefix) {
      const directRes = resolveDirectStudioQuery(text, snapshot);
      if (directRes.matched) {
        return this.client.sendMessage(chatId, directRes.replyText, {
          parse_mode: "HTML",
          reply_markup: directRes.inlineButtons
            ? { inline_keyboard: directRes.inlineButtons }
            : undefined,
        });
      }
    }

    // 4. Obrolan Percakapan AI Fleksibel & Kontekstual (Google Gemini AI Copilot dengan Memori Percakapan)
    await this.client.sendChatAction(chatId, "typing");

    const aiRes = await askGeminiCopilot({
      chatId,
      userMessage: text,
      senderName,
      snapshot,
    });

    // Tampilkan tombol inline HANYA jika relevan dengan topik obrolan (tidak spam di setiap chat)
    const inlineButtons: TelegramInlineButton[][] = [];
    const nextItem = snapshot.nextVideoToUpload;
    const mentionsUploadOrNext =
      /(?:upload|publish|tayang|terdekat|selanjutnya|antrean|jadwal)/i.test(lowerText);
    const mentionsEditorOrOffice =
      /(?:editor|kantor|istirahat|lounge|standby|kuota)/i.test(lowerText);

    if (mentionsUploadOrNext && nextItem) {
      inlineButtons.push([
        {
          text: `⚡ Publish Sekarang (${nextItem.code})`,
          callback_data: `publish:${nextItem.code}`,
        },
        {
          text: `🎬 Review Video`,
          callback_data: `review:${nextItem.code}`,
        },
      ]);
    } else if (mentionsEditorOrOffice) {
      inlineButtons.push([
        { text: "☕ Semua Editor Istirahat", callback_data: "office:rest_all" },
        { text: "💻 Semua Editor Standby ke PC", callback_data: "office:standby_all" },
      ]);
    }

    // Kirim balasan AI berformat HTML bersih
    await this.client.sendMessage(chatId, aiRes.replyText, {
      parse_mode: "HTML",
      reply_markup:
        inlineButtons.length > 0 ? { inline_keyboard: inlineButtons } : undefined,
    });

    // Eksekusi semua instruksi aksi otomatis yang dikeluarkan oleh AI Copilot
    for (const action of aiRes.actions) {
      try {
        if (action.type === "REST_ALL_EDITORS") {
          await syncUpdateProfileCreditsAsync({
            credits: 0,
            allProfiles: true,
            source: "telegram",
          });
        } else if (action.type === "STANDBY_ALL_EDITORS") {
          await syncUpdateProfileCreditsAsync({
            credits: 50,
            allProfiles: true,
            source: "telegram",
          });
        } else if (action.type === "PUBLISH_NOW" && action.contentCode) {
          await this.client.sendMessage(
            chatId,
            `⏳ <i>Instruksi diterima: sedang mengeksekusi publikasi <b>${action.contentCode}</b> ke Buffer...</i>`
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
      `• 🎯 <b>Setelan:</b> ${snap.settings.dailyVideoTarget} Video/Hari • Jam ${snap.settings.defaultUploadHour}\n` +
      `• 👤 <b>Akses & Akun:</b> Ketik <code>/whoami</code> | <code>/logout</code> (Admin: <code>/users</code>)\n\n` +
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

    if (action === "office" && codeOrArg === "rest_all") {
      await this.client.answerCallbackQuery(callbackId, "Semua 11 editor berjalan ke kursi istirahat! ☕");
      await syncUpdateProfileCreditsAsync({
        credits: 0,
        allProfiles: true,
        source: "telegram",
      });
      await this.client.sendMessage(
        chatId,
        `☕ <b>Seluruh 11 Editor Video Berpindah ke Kursi Istirahat!</b>\nSemua editor (Profil 1 s/d Profil 11) telah meninggalkan meja PC dan duduk di kursi istirahat Lounge Warkop Obim.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "💻 Panggil Semua Editor Standby ke PC", callback_data: "office:standby_all" }],
            ],
          },
        }
      );
      return { ok: true };
    }

    if (action === "office" && codeOrArg === "standby_all") {
      await this.client.answerCallbackQuery(callbackId, "Semua 11 editor kembali ke PC masing-masing! 💻");
      await syncUpdateProfileCreditsAsync({
        credits: 50,
        allProfiles: true,
        source: "telegram",
      });
      await this.client.sendMessage(
        chatId,
        `💻 <b>Seluruh 11 Editor Video Kembali Standby di PC Masing-Masing!</b>\nSemua editor (Profil 1 s/d Profil 11) telah berjalan kembali menuju meja PC masing-masing dengan kuota penuh (50/50 kr).`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [{ text: "☕ Suruh Semua Editor Istirahat", callback_data: "office:rest_all" }],
            ],
          },
        }
      );
      return { ok: true };
    }

    if (action === "office" && codeOrArg === "status") {
      await this.client.answerCallbackQuery(callbackId, "Memuat status Kantor 3D...");
      await loadVirtualOfficeCloudSync();
      const flowAccs = listFlowProfileAccounts().slice(0, 11);
      const resting = flowAccs.filter((a) => a.credits === 0);
      const working = flowAccs.filter((a) => a.credits > 0);
      const totalKr = flowAccs.reduce((acc, a) => acc + a.credits, 0);

      await this.client.sendMessage(
        chatId,
        `🏢 <b>Status Live Kantor Virtual 3D Obim Studio</b>\n` +
          `• <b>Standby di PC Masing-Masing:</b> ${working.length} Editor 💻\n` +
          `• <b>Duduk di Kursi Istirahat (Lounge):</b> ${resting.length} Editor ☕\n` +
          `• <b>Total Kuota Render:</b> ${totalKr} / 550 kr`,
        { parse_mode: "HTML" }
      );
      return { ok: true };
    }

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
