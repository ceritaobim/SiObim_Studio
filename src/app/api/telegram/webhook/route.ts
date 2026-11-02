import { NextResponse } from "next/server";
import { TelegramService } from "@/features/telegram/telegram-service";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const update = await request.json().catch(() => null);
    if (!update) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const service = new TelegramService();
    await service.handleUpdate(update);

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Internal error";
    console.error("[TELEGRAM WEBHOOK ERROR]", err);
    // Telegram requires 200 OK to prevent repeating webhook deliveries
    return NextResponse.json({ ok: false, error: errorMsg });
  }
}

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedUser = process.env.TELEGRAM_ALLOWED_USER_ID;

  return NextResponse.json({
    status: "active",
    name: "CeritaObim Studio Telegram Webhook",
    configured: Boolean(token && allowedUser),
    botActive: Boolean(token),
    whitelistActive: Boolean(allowedUser),
    timestamp: new Date().toISOString(),
  });
}
