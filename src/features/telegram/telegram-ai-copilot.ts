/**
 * CeritaObim Studio — Telegram AI Copilot (Kepala Toko Intelligence)
 *
 * Mengubah bot Telegram menjadi Kepala Toko Cerdas (Obim Store Manager)
 * yang melayani sang CEO (Kreator) dengan pemahaman 100% akurat atas
 * data inventori video real-time, status publikasi, dan kontrol sistem.
 */

import { type StoreSnapshot } from "./studio-store-manager";
import { formatTelegramHtml } from "./telegram-formatter";

export interface StoreAction {
  type:
    | "PUBLISH_NOW"
    | "SCHEDULE_VIDEO"
    | "UPDATE_SETTINGS"
    | "AUTO_SCHEDULE"
    | "REVIEW"
    | "APPROVE";
  contentCode?: string;
  time?: string;
  dailyTarget?: number;
  uploadHour?: string;
}

export interface CopilotChatInput {
  userMessage: string;
  senderName?: string;
  snapshot: StoreSnapshot;
}

export interface CopilotChatResponse {
  replyText: string;
  actions: StoreAction[];
}

export async function askGeminiCopilot(
  input: CopilotChatInput
): Promise<CopilotChatResponse> {
  let apiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.LLM_API_KEY ||
    ""
  ).trim();
  apiKey = apiKey.replace(/^["']|["']$/g, "").trim();

  if (!apiKey) {
    return {
      replyText:
        "⚠️ <b>API Key Google AI (Gemini) belum diset.</b>\nSilakan tambahkan <code>GEMINI_API_KEY</code> di pengaturan server untuk mengaktifkan kecerdasan Kepala Toko.",
      actions: [],
    };
  }

  let model = (
    process.env.LLM_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-3-flash-preview"
  ).trim();
  model = model.replace(/^["']|["']$/g, "").trim();

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const snap = input.snapshot;

  // Format inventori published & ready secara ringkas dan TANPA kode teknis
  const publishedSummary = snap.publishedItems
    .map((item) => `• "${item.title}"`)
    .join("\n");

  const scheduledSummary = snap.scheduledItems
    .map((item) => `• "${item.title}" -> Jadwal: ${item.scheduleInfo.formatted}`)
    .join("\n");

  const readySummary = snap.readyItems
    .map((item) => `• "${item.title}" -> Siap masuk antrean Buffer`)
    .join("\n");

  const inProductionSummary = snap.inProductionItems
    .slice(0, 8)
    .map((item) => `• "${item.title}"`)
    .join("\n");

  const systemPrompt = `Kamu adalah Obim, KEPALA TOKO (Store Manager) resmi CeritaObim Studio.
Kamu melayani langsung CEO / Pemilik Studio (Mas ${input.senderName || "B3"}).

ATURAN FORMAT SANGAT KETAT (WAJIB DIIKUTI):
1. DILARANG KERAS menyapa atau berbasa-basi! JANGAN PERNAH gunakan kata sapaan seperti "Halo Mas", "Semangat pagi", "Wah seru", dll. Langsung jawab intinya saja!
2. DILARANG KERAS memberikan analisis marketing atau penjelasan seperti "Kenapa ini?", "Topik ini pagi banget", atau "Secara visual dapet banget feelnya".
3. FORMAT JAWABAN STATUS KONTEN HARUS PERSIS SEPERTI INI:
   [Status] || [Judul Konten]
   Status HANYA boleh: Published, Ready, atau Pending.
   Contoh:
   <b>Published</b> || Rahasia Nasi Goreng Enak Harus Pakai Nasi Sisa?
   <b>Ready</b> || Kenapa Kita Sering Lupa Mimpi Pas Bangun?
   <b>Pending</b> || Jam di Luar Angkasa Berjalan Lebih Lambat!
4. DILARANG MENGGUNAKAN SIMBOL MARKDOWN HEADER (###, ##, #) ATAU BINTANG (**teks**). Gunakan tag HTML <b>teks</b> untuk menebalkan!

FAKTA REAL-TIME STUDIO SAAT INI:
• Waktu Sekarang: ${snap.nowWibText}
• Target Upload: ${snap.settings.dailyVideoTarget} Video / Hari (${snap.settings.defaultUploadHour})
• Konten Sudah Tayang di Medsos (10 Video):
${publishedSummary}

• Konten Terjadwal di Buffer:
${scheduledSummary || "(Belum ada di antrean Buffer)"}

• Konten Siap Masuk Antrean Buffer:
${readySummary || "(Semua video yang sudah jadi telah masuk antrean)"}

• Konten Sedang Proses Produksi di Studio:
${inProductionSummary}

KONTEN PRIORITAS:
• KONTEN SELANJUTNYA: "${snap.nextVideoToUpload?.title || "Semua video sudah tayang"}"
• JADWAL UPLOAD TERDEKAT: ${
    snap.nearestScheduledVideo
      ? `${snap.nearestScheduledVideo.scheduleInfo.formatted} untuk "${snap.nearestScheduledVideo.title}"`
      : "Belum diset"
  }

PANDUAN JAWABAN:
- Jika ditanya konten pagi/siang/malam atau konten tertentu, jawab HANYA dalam format:
  [Status] || [Judul]
- Jika ditanya "konten apa selanjutnya yang diupload?", jawab:
  <b>Ready</b> || ${snap.nextVideoToUpload?.title || "Kenapa Kita Sering Lupa Mimpi Pas Bangun?"}
- Jika ditanya jadwal upload:
  Jadwal: ${snap.nearestScheduledVideo ? snap.nearestScheduledVideo.scheduleInfo.formatted : snap.settings.defaultUploadHour}
- Jika ditanya jumlah upload:
  Target: ${snap.settings.dailyVideoTarget} Konten / Hari (Jam ${snap.settings.defaultUploadHour})
- Jika CEO memberi instruksi ubah target atau jam upload, cantumkan tag aksi di akhir pesan:
  [ACTION:UPDATE_SETTINGS:{"dailyTarget":JUMLAH,"uploadHour":"HH:mm"}]
- Jika CEO minta publish sekarang:
  [ACTION:PUBLISH_NOW:{"contentCode":"${snap.nextVideoToUpload?.code || "CO-2026-011"}"}]`;

  try {
    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input.userMessage }],
        },
      ],
      generationConfig: {
        temperature: 0.5,
        maxOutputTokens: 1024,
      },
    };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Gemini API Error:", response.status, errText);
      return {
        replyText:
          "⚠️ <i>Koneksi ke otak AI sedang sibuk sementara, Mas. Namun Anda tetap bisa memberi perintah langsung seperti /status, /review, atau ubah jadwal.</i>",
        actions: [],
      };
    }

    const data = await response.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Siap Mas, ada yang bisa Obim bantu atur di studio?";

    // Ekstrak semua tag aksi seperti [ACTION:TYPE:{...}] atau [ACTION:TYPE:CODE]
    const actions: StoreAction[] = [];
    const actionRegex = /\[ACTION:([A-Z_]+)(?::(.*?)\]|\])/gi;
    let match: RegExpExecArray | null;

    while ((match = actionRegex.exec(candidateText)) !== null) {
      if (!match || !match[1]) continue;
      const type = match[1].toUpperCase() as StoreAction["type"];
      const rawParam = (match[2] || "").trim();

      let actionObj: StoreAction = { type };

      if (rawParam.startsWith("{") && rawParam.endsWith("}")) {
        try {
          const parsed = JSON.parse(rawParam);
          actionObj = { ...actionObj, ...parsed };
        } catch {
          // ignore json parse error
        }
      } else if (rawParam) {
        actionObj.contentCode = rawParam.toUpperCase();
      }

      actions.push(actionObj);
    }

    // Bersihkan tag action dan format rapi ke Telegram HTML
    const cleanReply = formatTelegramHtml(candidateText);

    return {
      replyText: cleanReply,
      actions,
    };
  } catch (err: unknown) {
    console.error("Copilot unexpected error:", err);
    return {
      replyText:
        "⚠️ <i>Terjadi kendala saat memproses jawaban. Silakan coba lagi sebentar lagi.</i>",
      actions: [],
    };
  }
}
