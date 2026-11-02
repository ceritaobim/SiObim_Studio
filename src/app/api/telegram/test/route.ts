import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import { sendTelegramMessage } from "@/lib/services/telegram-bot";

export async function GET(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN?.trim() || "";
  const chatId = process.env.TELEGRAM_CHAT_ID?.trim() || "";

  return NextResponse.json({
    configured: Boolean(token && chatId),
    hasToken: Boolean(token),
    hasChatId: Boolean(chatId),
    chatIdMasked: chatId ? `${chatId.slice(0, 3)}***${chatId.slice(-2)}` : null,
  });
}

export async function POST(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const action = String(body.action || "test").toLowerCase();
    const token = body.token ? String(body.token).trim() : process.env.TELEGRAM_BOT_TOKEN?.trim();
    const chatId = body.chatId ? String(body.chatId).trim() : process.env.TELEGRAM_CHAT_ID?.trim();

    if (!token || !chatId) {
      return NextResponse.json(
        {
          error:
            "TELEGRAM_CONFIG_MISSING: Masukkan Bot Token dan Chat ID terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    // Action 1: Save configuration to .env.local
    if (action === "save") {
      const envPath = path.join(process.cwd(), ".env.local");
      let content = fs.existsSync(envPath)
        ? fs.readFileSync(envPath, "utf-8")
        : "";

      // Replace or append TELEGRAM_BOT_TOKEN
      if (content.includes("TELEGRAM_BOT_TOKEN=")) {
        content = content.replace(
          /TELEGRAM_BOT_TOKEN="?.*"?/g,
          `TELEGRAM_BOT_TOKEN="${token}"`
        );
      } else {
        content += `\nTELEGRAM_BOT_TOKEN="${token}"`;
      }

      // Replace or append TELEGRAM_CHAT_ID
      if (content.includes("TELEGRAM_CHAT_ID=")) {
        content = content.replace(
          /TELEGRAM_CHAT_ID="?.*"?/g,
          `TELEGRAM_CHAT_ID="${chatId}"`
        );
      } else {
        content += `\nTELEGRAM_CHAT_ID="${chatId}"`;
      }

      fs.writeFileSync(envPath, content, "utf-8");
      process.env.TELEGRAM_BOT_TOKEN = token;
      process.env.TELEGRAM_CHAT_ID = chatId;

      return NextResponse.json({
        ok: true,
        message: "Konfigurasi bot Telegram berhasil disimpan ke .env.local!",
      });
    }

    // Action 2: Send test message
    const testMessage = `🤖 *Tes Koneksi CeritaObim Studio*
━━━━━━━━━━━━━━━━━━━━
Halo Creator Obim! Bot Telegram studio Anda sudah *berhasil terhubung* dan siap digunakan untuk:
• Menerima notifikasi otomatis saat video \`00Final.mp4\` selesai dirakit
• Cek status via perintah \`/status\`
• Jadwalkan video ke Buffer via \`/publish [KODE]\`

Waktu pengujian: ${new Date().toLocaleString("id-ID")}`;

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: testMessage,
        parse_mode: "Markdown",
      }),
    });

    const data = await res.json();
    if (!data.ok) {
      throw new Error(data.description || "Gagal mengirim pesan via Telegram API.");
    }

    return NextResponse.json({
      ok: true,
      message: "🎉 Pesan tes berhasil dikirim! Silakan periksa aplikasi Telegram Anda.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error saat menghubungi Telegram.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
