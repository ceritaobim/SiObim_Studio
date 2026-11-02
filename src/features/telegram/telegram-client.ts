/**
 * CeritaObim Studio — Telegram Bot Client
 *
 * Client HTTP ringan untuk Telegram Bot API tanpa dependensi eksternal.
 * Mendukung pengiriman pesan teks berformat HTML, video, chat action, dan inline keyboard.
 */

export interface TelegramInlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface TelegramSendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  reply_markup?: {
    inline_keyboard?: TelegramInlineButton[][];
    keyboard?: Array<Array<{ text: string }>>;
    resize_keyboard?: boolean;
    one_time_keyboard?: boolean;
  };
  disable_web_page_preview?: boolean;
}

export interface TelegramSendVideoOptions extends TelegramSendMessageOptions {
  caption?: string;
  duration?: number;
  width?: number;
  height?: number;
  supports_streaming?: boolean;
}

export class TelegramClient {
  private readonly token: string;
  private readonly baseUrl: string;

  constructor(token?: string) {
    this.token = (token !== undefined ? token : process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!this.token) {
      console.warn("⚠️ TelegramClient: TELEGRAM_BOT_TOKEN belum diset.");
    }
    this.baseUrl = `https://api.telegram.org/bot${this.token}`;
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.token.includes(":"));
  }

  private async callApi(method: string, payload: Record<string, unknown>) {
    if (!this.isConfigured()) {
      throw new Error("TELEGRAM_BOT_TOKEN_MISSING: Token bot belum dikonfigurasi.");
    }

    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok) {
      const errMsg = data?.description || response.statusText || "Gagal memanggil Telegram API";
      throw new Error(`TELEGRAM_API_ERROR (${method}): ${errMsg}`);
    }

    return data.result;
  }

  async sendMessage(
    chatId: number | string,
    text: string,
    options?: TelegramSendMessageOptions
  ) {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode ?? "HTML",
      reply_markup: options?.reply_markup,
      disable_web_page_preview: options?.disable_web_page_preview,
    };

    try {
      return await this.callApi("sendMessage", payload);
    } catch (err: unknown) {
      // Jika parsing HTML gagal (misal tag tidak valid dari AI), fallback kirim plain text
      if (
        options?.parse_mode &&
        err instanceof Error &&
        (err.message.includes("can't parse entities") ||
          err.message.includes("entity") ||
          err.message.includes("tag"))
      ) {
        console.warn("Telegram sendMessage HTML parse failed, retrying plain text:", err.message);
        delete payload.parse_mode;
        return await this.callApi("sendMessage", payload);
      }
      throw err;
    }
  }

  async sendVideo(
    chatId: number | string,
    videoUrl: string,
    options?: TelegramSendVideoOptions
  ) {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      video: videoUrl,
      caption: options?.caption,
      parse_mode: options?.parse_mode ?? "HTML",
      supports_streaming: options?.supports_streaming ?? true,
      reply_markup: options?.reply_markup,
    };

    try {
      return await this.callApi("sendVideo", payload);
    } catch (err: unknown) {
      if (
        options?.parse_mode &&
        err instanceof Error &&
        (err.message.includes("can't parse entities") ||
          err.message.includes("entity") ||
          err.message.includes("tag"))
      ) {
        console.warn("Telegram sendVideo caption HTML parse failed, retrying plain text:", err.message);
        delete payload.parse_mode;
        return await this.callApi("sendVideo", payload);
      }
      throw err;
    }
  }

  async sendChatAction(
    chatId: number | string,
    action: "typing" | "upload_video" | "record_video" | "upload_document" = "typing"
  ) {
    try {
      await this.callApi("sendChatAction", {
        chat_id: chatId,
        action,
      });
    } catch {
      // Non-fatal if chat action fails
    }
  }

  async answerCallbackQuery(callbackQueryId: string, text?: string, showAlert = false) {
    try {
      return await this.callApi("answerCallbackQuery", {
        callback_query_id: callbackQueryId,
        text,
        show_alert: showAlert,
      });
    } catch {
      return null;
    }
  }

  async setWebhook(url: string, secretToken?: string) {
    const payload: Record<string, unknown> = { url };
    if (secretToken) payload.secret_token = secretToken;
    return this.callApi("setWebhook", payload);
  }

  async deleteWebhook() {
    return this.callApi("deleteWebhook", { drop_pending_updates: true });
  }

  async getWebhookInfo() {
    return this.callApi("getWebhookInfo", {});
  }

  async getUpdates(offset?: number, timeout = 10) {
    const payload: Record<string, unknown> = { timeout };
    if (offset) payload.offset = offset;
    return this.callApi("getUpdates", payload);
  }
}
