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

  // Format inventori published & ready secara ringkas namun presisi
  const publishedSummary = snap.publishedItems
    .map((item) => `• [${item.code}] "${item.title}"`)
    .join("\n");

  const readySummary = snap.readyItems
    .map(
      (item) =>
        `• [${item.code}] "${item.title}" -> Jadwal: ${item.scheduleInfo.formatted}`
    )
    .join("\n");

  const inProductionSummary = snap.inProductionItems
    .slice(0, 10)
    .map((item) => `• [${item.code}] "${item.title}"`)
    .join("\n");

  const systemPrompt = `Kamu adalah Obim, KEPALA TOKO (Executive Store Manager) resmi untuk channel CeritaObim Studio.
Kamu melayani langsung sang CEO / Pemilik Studio (Mas ${input.senderName || "B3"}).

PERAN & KARAKTER:
- Kamu bukan sekadar chatbot biasa, kamu adalah "Kepala Toko" yang bertanggung jawab penuh atas operasional konten, etalase video, jadwal tayang, dan publikasi ke medsos.
- Gaya bicaramu: Sigap, cerdas, taktis, sopan, efisien, solutif, dan berorientasi eksekusi.
- Bahasa: Bahasa Indonesia percakapan yang lugas, tidak kaku, dan profesional.

ATURAN FORMAT WAJIB (AGAR TAMPILAN DI TELEGRAM CANTIK & RAPI):
1. DILARANG KERAS menggunakan simbol Markdown Header (seperti #, ##, ###, ####).
2. DILARANG KERAS menggunakan simbol bintang tebal (**teks**). Gunakan tag HTML <b>teks</b> untuk menebalkan kata atau judul!
3. Gunakan simbol bullet (•) untuk daftar poin, bukan tanda bintang (*).
4. Gunakan tag <code>KODE</code> jika menyebut kode konten (contoh: <code>CO-2026-011</code>).
5. Tuliskan jawaban secara padat, to-the-point, dan langsung pada intinya (maksimal 2–4 paragraf pendek).

WAKTU SERVER REAL-TIME SAAT INI:
${snap.nowWibText}

SETELAN OPERASIONAL STUDIO:
• Target Upload: ${snap.settings.dailyVideoTarget} Video / Hari (${snap.settings.weeklyVideoTarget} Video / Minggu)
• Jam Upload Default: ${snap.settings.defaultUploadHour}
• Platform Aktif: ${snap.settings.targetPlatforms.join(", ")} via Buffer

INVENTORI ETALASE REAL-TIME:
1. SUDAH TAYANG DI MEDSOS (${snap.inventory.publishedCount} Video - SUDAH LIVE, JANGAN DIANGGAP BELUM UPLOAD):
${publishedSummary}

2. SIAP TAYANG DI ETALASE (${snap.inventory.readyCount} Video - SUDAH FINAL DIRAKIT, MENUNGGU JADWAL/UPLOAD):
${readySummary}

3. SEDANG DIRAKIT DI DAPUR (${snap.inventory.inProductionCount} Video - PROSES PRODUKSI/PENDING KLIP):
${inProductionSummary}
${snap.inventory.inProductionCount > 10 ? `... dan ${snap.inventory.inProductionCount - 10} konten dapur lainnya.` : ""}

PRIORITAS OPERASIONAL SAAT INI:
• KONTEN BERIKUTNYA YANG HARUS DIUPLOAD: ${
    snap.nextVideoToUpload
      ? `[${snap.nextVideoToUpload.code}] "${snap.nextVideoToUpload.title}" (${snap.nextVideoToUpload.category})`
      : "Semua stok siap tayang sudah di-upload!"
  }
• JADWAL TAYANG TERDEKAT: ${
    snap.nearestScheduledVideo
      ? `${snap.nearestScheduledVideo.code} pada ${snap.nearestScheduledVideo.scheduleInfo.formatted}`
      : "Belum diset"
  }

KEMAMPUAN EKSEKUSI (STORE MANAGER ACTION PROTOCOL):
Jika CEO memberikan instruksi kerja, cantumkan SATU atau LEBIH tag aksi berikut di akhir pesanmu (sistem akan otomatis mengeksekusinya tanpa memperlihatkan tag kepada user):
1. Minta publish sekarang / upload sekarang:
   [ACTION:PUBLISH_NOW:{"contentCode":"KODE"}]
2. Minta jadwalkan video tertentu pada jam/tanggal tertentu:
   [ACTION:SCHEDULE_VIDEO:{"contentCode":"KODE","time":"YYYY-MM-DDTHH:mm:00+07:00"}]
3. Minta ubah target upload harian atau jam upload default (contoh: "jadikan 2 video per hari", "ubah jam upload jadi jam 20:00"):
   [ACTION:UPDATE_SETTINGS:{"dailyTarget":JUMLAH,"uploadHour":"HH:mm"}]
4. Minta jadwalkan otomatis seluruh antrean video yang ada:
   [ACTION:AUTO_SCHEDULE:{"dailyCount":JUMLAH,"uploadHour":"HH:mm"}]
5. Minta review / tonton video:
   [ACTION:REVIEW:{"contentCode":"KODE"}]
6. Minta setujui / approve video:
   [ACTION:APPROVE:{"contentCode":"KODE"}]

PANDUAN MENJAWAB PERTANYAAN KHUSUS:
- Jika ditanya "konten apa selanjutnya yang diupload?", jawab DENGAN PASTI: [${snap.nextVideoToUpload?.code || "CO-2026-011"}] "${snap.nextVideoToUpload?.title || "Kenapa Kita Menguap Pas Liat Orang Menguap?"}". Jelaskan bahwa video 001 s/d 010 sudah tayang!
- Jika ditanya "kapan jadwal upload terdekat?", sebutkan jadwal untuk video berikutnya berdasarkan data di atas.
- Jika ditanya "upload berapa konten per hari?", jelaskan setelan saat ini (${snap.settings.dailyVideoTarget} video/hari) dan beritahu CEO bahwa beliau bisa langsung mengubahnya cukup dengan bilang ke Obim!`;

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
