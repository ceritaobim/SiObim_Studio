import {
  listAssetsForContent,
  listContentItems,
} from "@/lib/db/repository";
import { publishContentToBuffer } from "@/lib/integrations/buffer-publisher";

export interface TelegramWebhookUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      is_bot: boolean;
      first_name: string;
      username?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
}

export async function sendTelegramMessage(text: string, chatId?: string | number) {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID?.trim();

  if (!token || !targetChatId) {
    return { ok: false, error: "TELEGRAM_CONFIG_MISSING" };
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: targetChatId,
        text,
        parse_mode: "Markdown",
      }),
    });
    const data = await res.json();
    return { ok: data.ok, data };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error sending Telegram msg",
    };
  }
}

export async function handleTelegramCommand(
  text: string,
  chatId: number
): Promise<string> {
  const trimmed = text.trim();
  const [cmd, ...args] = trimmed.split(/\s+/);
  const command = (cmd || "").toLowerCase();

  const ownerId = "owner-local-obim";

  if (command === "/start" || command === "/help") {
    return `👋 *Halo Creator CeritaObim!*

Bot Kontrol CeritaObim Studio siap menerima perintah:
• \`/status\` — Cek status progres produksi & video master 00Final
• \`/publish [KODE]\` — Publish video tertentu ke Buffer (YouTube, TikTok, IG)
• \`/ping\` — Tes respon server studio
• \`/help\` — Panduan perintah bot`;
  }

  if (command === "/ping") {
    return `🏓 *Pong!* Server CeritaObim Studio aktif & online normal.`;
  }

  if (command === "/status") {
    try {
      const items = await listContentItems(ownerId);
      const assets = await listAssetsForContent(ownerId);

      const itemsWithFinal = items.filter((i) =>
        assets.some((a) => a.contentId === i.id && a.assetType === "final_video")
      );
      const itemsWithVoice = items.filter((i) =>
        assets.some((a) => a.contentId === i.id && a.assetType === "voice_audio")
      );

      return `📊 *Laporan Progres CeritaObim Studio*
━━━━━━━━━━━━━━━━━━━━
• Total Rencana Konten: *${items.length} Topik*
• Audio Voice Over: *${itemsWithVoice.length}/${items.length} Selesai*
• Video Master (00Final.mp4): *${itemsWithFinal.length}/${items.length} Selesai*
• Integrasi Buffer: *3 Akun Terhubung (YT, TikTok, IG)*

💡 _Ketik \`/publish CO-2026-001\` untuk menjadwalkan video ke Buffer._`;
    } catch (err) {
      return `❌ Gagal mengambil status studio: ${err instanceof Error ? err.message : "Error"}`;
    }
  }

  if (command === "/publish") {
    const code = args[0]?.toUpperCase();
    if (!code) {
      return `⚠️ Masukkan kode konten. Contoh: \`/publish CO-2026-001\``;
    }

    try {
      const items = await listContentItems(ownerId);
      const target = items.find((i) => i.contentCode.toUpperCase() === code);
      if (!target) {
        return `❌ Konten dengan kode *${code}* tidak ditemukan di database.`;
      }

      const res = await publishContentToBuffer({
        ownerId,
        contentId: target.id,
      });

      if (res.ok) {
        return `🎉 *Berhasil Dipublish!*
Konten: *${target.title}* (${target.contentCode})
Terkirim ke *${res.successCount} channel medsos* via Buffer!`;
      } else {
        return `⚠️ Gagal mempublish: ${res.results.map((r) => r.error).join(", ")}`;
      }
    } catch (err) {
      return `❌ Error publish: ${err instanceof Error ? err.message : "Error"}`;
    }
  }

  return `❓ Perintah tidak dikenali. Ketik \`/help\` untuk melihat daftar perintah.`;
}
