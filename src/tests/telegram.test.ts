import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramClient } from "@/features/telegram/telegram-client";
import { TelegramService } from "@/features/telegram/telegram-service";

describe("Telegram Bot & Security Whitelist Integration", () => {
  beforeEach(() => {
    process.env.TELEGRAM_BOT_TOKEN = "9010734438:AAE9t0Cn66sPbMF1rq5JRLax0VUa4J61P1U";
    process.env.TELEGRAM_ALLOWED_USER_ID = "1295640663";
  });

  it("authorizes only the whitelisted owner ID and blocks any strangers", () => {
    const service = new TelegramService();

    expect(service.isAuthorized("1295640663")).toBe(true);
    expect(service.isAuthorized(1295640663)).toBe(true);

    // Strangers
    expect(service.isAuthorized("999999999")).toBe(false);
    expect(service.isAuthorized("12345")).toBe(false);
    expect(service.isAuthorized("")).toBe(false);
  });

interface ServiceWithMockClient {
  client: {
    sendMessage: ReturnType<typeof vi.fn>;
    answerCallbackQuery: ReturnType<typeof vi.fn>;
  };
}

  it("rejects unauthorized message updates with an explicit unauthorized response", async () => {
    const service = new TelegramService();
    const sendMock = vi.fn().mockResolvedValue({ ok: true });
    (service as unknown as ServiceWithMockClient).client.sendMessage = sendMock;

    const res = await service.handleUpdate({
      message: {
        chat: { id: 8888 },
        from: { id: 999999999, first_name: "Intruder" },
        text: "/status",
      },
    });

    expect(res).toEqual({ ok: true, unauthorized: true });
    expect(sendMock).toHaveBeenCalledWith(
      8888,
      expect.stringContaining("Akses Ditolak")
    );
  });

  it("processes /start command for whitelisted user and sends welcome card", async () => {
    const service = new TelegramService();
    const sendMock = vi.fn().mockResolvedValue({ ok: true });
    (service as unknown as ServiceWithMockClient).client.sendMessage = sendMock;

    await service.handleUpdate({
      message: {
        chat: { id: 1295640663 },
        from: { id: 1295640663, first_name: "B3" },
        text: "/start",
      },
    });

    expect(sendMock).toHaveBeenCalledWith(
      1295640663,
      expect.stringContaining("CeritaObim Studio Copilot"),
      expect.objectContaining({
        parse_mode: "HTML",
        reply_markup: expect.objectContaining({
          keyboard: expect.any(Array),
        }),
      })
    );
  });

  it("handles callback query for content approval and updates status", async () => {
    const service = new TelegramService();
    const answerMock = vi.fn().mockResolvedValue({ ok: true });
    const sendMock = vi.fn().mockResolvedValue({ ok: true });
    (service as unknown as ServiceWithMockClient).client.answerCallbackQuery = answerMock;
    (service as unknown as ServiceWithMockClient).client.sendMessage = sendMock;

    await service.handleUpdate({
      callback_query: {
        id: "cb_123",
        message: { chat: { id: 1295640663 } },
        from: { id: 1295640663, first_name: "B3" },
        data: "approve:CO-2026-002",
      },
    });

    expect(answerMock).toHaveBeenCalledWith("cb_123", expect.stringContaining("disetujui"));
    expect(sendMock).toHaveBeenCalledWith(
      1295640663,
      expect.stringContaining("Siap Tayang")
    );
  });

  it("instantiates TelegramClient safely and validates configuration status", () => {
    const client = new TelegramClient("test_token:123456");
    expect(client.isConfigured()).toBe(true);

    const emptyClient = new TelegramClient("");
    expect(emptyClient.isConfigured()).toBe(false);
  });
});
