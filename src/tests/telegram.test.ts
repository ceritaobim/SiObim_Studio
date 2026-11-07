import { describe, it, expect, vi, beforeEach } from "vitest";
import { TelegramClient } from "@/features/telegram/telegram-client";
import { TelegramService } from "@/features/telegram/telegram-service";
import { formatTelegramHtml } from "@/features/telegram/telegram-formatter";
import {
  getStudioStoreSnapshot,
  resolveDirectStudioQuery,
} from "@/features/telegram/studio-store-manager";

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

  it("supports multiple authorized user IDs separated by commas or spaces", () => {
    process.env.TELEGRAM_ALLOWED_USER_ID = "1295640663, 888777666, 555444333";
    const service = new TelegramService();

    expect(service.isAuthorized("1295640663")).toBe(true);
    expect(service.isAuthorized("888777666")).toBe(true);
    expect(service.isAuthorized(555444333)).toBe(true);
    expect(service.isAuthorized("999999999")).toBe(false);
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
      expect.stringContaining("Siap Tayang"),
      expect.anything()
    );
  });

  it("instantiates TelegramClient safely and validates configuration status", () => {
    const client = new TelegramClient("test_token:123456");
    expect(client.isConfigured()).toBe(true);

    const empty = new TelegramClient("");
    expect(empty.isConfigured()).toBe(false);
  });

  it("converts raw markdown headers, bold asterisks, and bullets to clean Telegram HTML without raw symbols", () => {
    const rawMarkdown =
      "### Analisis Stok Kita:\n" +
      "* Siap Tayang: **19 Konten**\n" +
      "* Sedang Diproses: **11 Konten**\n\n" +
      "### Rekomendasi Jadwal Upload:\n" +
      "1. **Opsi Konsisten (1 Konten/Hari)** - *Sangat Disarankan*\n" +
      "**Waktu Terbaik:** Jam 18.00 - 20.00 WIB\n" +
      "[ACTION:REVIEW:CO-2026-011]";

    const html = formatTelegramHtml(rawMarkdown);

    // Pastikan tidak ada raw ### atau ####
    expect(html).not.toContain("###");
    expect(html).toContain("<b>Analisis Stok Kita:</b>");
    expect(html).toContain("<b>Rekomendasi Jadwal Upload:</b>");

    // Pastikan tidak ada ** bold
    expect(html).not.toContain("**");
    expect(html).toContain("<b>19 Konten</b>");

    // Pastikan bullet diubah jadi •
    expect(html).toContain("• Siap Tayang");

    // Pastikan tag aksi tersembunyi dibersihkan
    expect(html).not.toContain("[ACTION:REVIEW:CO-2026-011]");
  });

  it("builds a real-time store snapshot with accurate inventory and next video to upload", async () => {
    const snapshot = await getStudioStoreSnapshot();

    expect(snapshot.nowWibText).toContain("WIB");
    expect(snapshot.inventory.total).toBeGreaterThan(0);
    expect(snapshot.settings.dailyVideoTarget).toBeGreaterThanOrEqual(1);

    // Etalase dan inventori harus valid
    expect(snapshot.readyItems.length + snapshot.publishedItems.length).toBeGreaterThan(0);
    if (snapshot.nextVideoToUpload) {
      expect(snapshot.nextVideoToUpload.code).toMatch(/^CO-\d{4}-\d{3}$/);
      expect(snapshot.nextVideoToUpload.title.length).toBeGreaterThan(0);
    }
  });

  it("directly answers segment queries in ultra-concise '[Status] || [Judul]' format with zero fluff", async () => {
    const snapshot = await getStudioStoreSnapshot();

    // 1. Kueri segmen pagi
    const morningRes = resolveDirectStudioQuery("apa konten segmen pagi hari ini?", snapshot);
    expect(morningRes.matched).toBe(true);
    expect(morningRes.replyText).toContain("Published");
    expect(morningRes.replyText).toContain("Rahasia Nasi Goreng Enak");
    expect(morningRes.replyText).not.toContain("Halo Mas");
    expect(morningRes.replyText).not.toContain("**");
    expect(morningRes.replyText).not.toContain("###");

    // 2. Kueri konten selanjutnya
    const nextRes = resolveDirectStudioQuery("konten apa selanjutnya yang diupload?", snapshot);
    expect(nextRes.matched).toBe(true);
    expect(nextRes.replyText).toContain("Ready");
    expect(nextRes.replyText).not.toContain("Halo");

    // 3. Kueri jadwal upload terdekat
    const scheduleRes = resolveDirectStudioQuery("kapan jadwal upload terdekat?", snapshot);
    expect(scheduleRes.matched).toBe(true);
    expect(scheduleRes.replyText).toContain("Jadwal:");

    // 4. Kueri upload berapa konten per hari
    const targetRes = resolveDirectStudioQuery("upload berapa konten per hari ?", snapshot);
    expect(targetRes.matched).toBe(true);
    expect(targetRes.replyText).toContain("Target:");
    expect(targetRes.replyText).toContain("Konten / Hari");

    // 5. Kueri spesifik judul nasi goreng
    const specificRes = resolveDirectStudioQuery("status nasi goreng", snapshot);
    expect(specificRes.matched).toBe(true);
    expect(specificRes.replyText).toContain("Published");
    expect(specificRes.replyText).toContain("Rahasia Nasi Goreng Enak");

    // 6. Kueri Kantor Virtual & Role Delegation
    const officeRes = resolveDirectStudioQuery("/office", snapshot);
    expect(officeRes.matched).toBe(true);
    expect(officeRes.replyText).toContain("KANTOR VIRTUAL CERITAOBIM");
    expect(officeRes.replyText).toContain("Manajer");
    expect(officeRes.replyText).toContain("Tim Audio");
    expect(officeRes.replyText).toContain("Produser");
    expect(officeRes.replyText).toContain("Tim Kreatif");
    expect(officeRes.replyText).toContain("Tim IT");

    // 7. Delegasi Tim IT
    const itRes = resolveDirectStudioQuery("it: status server", snapshot);
    expect(itRes.matched).toBe(true);
    expect(itRes.replyText).toContain("Tim IT & DevOps");
    expect(itRes.replyText).toContain("Website Studio");
    expect(itRes.replyText).toContain("Robot Makro");
    expect(itRes.replyText).toContain("Bot Telegram");
  });
});
