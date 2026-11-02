import { NextResponse } from "next/server";
import {
  handleTelegramCommand,
  sendTelegramMessage,
  type TelegramWebhookUpdate,
} from "@/lib/services/telegram-bot";

export async function POST(request: Request) {
  try {
    const update: TelegramWebhookUpdate = await request.json();

    if (update.message && update.message.text) {
      const chatId = update.message.chat.id;
      const responseText = await handleTelegramCommand(
        update.message.text,
        chatId
      );
      await sendTelegramMessage(responseText, chatId);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error processing Telegram webhook";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    message: "CeritaObim Studio Telegram Webhook Endpoint Ready",
  });
}
