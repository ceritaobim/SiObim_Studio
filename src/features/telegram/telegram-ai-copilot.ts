/**
 * CeritaObim Studio — Telegram AI Copilot (Conversational Executive AI)
 *
 * Mengubah bot Telegram menjadi asisten AI percakapan yang benar-benar fleksibel,
 * luwes, cerdas, memiliki memori obrolan (multi-turn context), dan terhubung
 * langsung dengan seluruh data real-time Studio, Buffer, serta Kantor Virtual 3D.
 */

import { type StoreSnapshot } from "./studio-store-manager";
import { formatTelegramHtml } from "./telegram-formatter";
import { listFlowProfileAccounts } from "@/lib/providers/flow-accounts-service";

export interface StoreAction {
  type:
    | "PUBLISH_NOW"
    | "SCHEDULE_VIDEO"
    | "UPDATE_SETTINGS"
    | "AUTO_SCHEDULE"
    | "REVIEW"
    | "APPROVE"
    | "REST_ALL_EDITORS"
    | "STANDBY_ALL_EDITORS";
  contentCode?: string;
  time?: string;
  dailyTarget?: number;
  uploadHour?: string;
}

export interface CopilotChatInput {
  chatId?: string | number;
  userMessage: string;
  senderName?: string;
  snapshot: StoreSnapshot;
}

export interface CopilotChatResponse {
  replyText: string;
  actions: StoreAction[];
}

interface ChatTurn {
  role: "user" | "model";
  text: string;
}

declare global {
  // eslint-disable-next-line no-var
  var __OBIM_TELEGRAM_CHAT_HISTORY__: Map<string, ChatTurn[]> | undefined;
}

function getChatHistory(chatKey: string): ChatTurn[] {
  if (!globalThis.__OBIM_TELEGRAM_CHAT_HISTORY__) {
    globalThis.__OBIM_TELEGRAM_CHAT_HISTORY__ = new Map<string, ChatTurn[]>();
  }
  return globalThis.__OBIM_TELEGRAM_CHAT_HISTORY__.get(chatKey) || [];
}

function appendChatHistory(chatKey: string, userText: string, modelText: string): void {
  if (!globalThis.__OBIM_TELEGRAM_CHAT_HISTORY__) {
    globalThis.__OBIM_TELEGRAM_CHAT_HISTORY__ = new Map<string, ChatTurn[]>();
  }
  const existing = globalThis.__OBIM_TELEGRAM_CHAT_HISTORY__.get(chatKey) || [];
  const updated: ChatTurn[] = [
    ...existing,
    { role: "user" as const, text: userText },
    { role: "model" as const, text: modelText },
  ].slice(-12); // Simpan 6 pasang percakapan terakhir agar selalu nyambung
  globalThis.__OBIM_TELEGRAM_CHAT_HISTORY__.set(chatKey, updated);
}

/**
 * Fallback percakapan natural & cerdas apabila API Gemini sedang rate-limit / offline
 */
function buildConversationalFallback(input: CopilotChatInput): CopilotChatResponse {
  const q = input.userMessage.toLowerCase().trim();
  const snap = input.snapshot;
  const flowAccs = listFlowProfileAccounts().slice(0, 11);
  const restingCount = flowAccs.filter((a) => a.credits === 0).length;
  const workingCount = flowAccs.length - restingCount;
  const totalKr = flowAccs.reduce((sum, a) => sum + a.credits, 0);

  const lastPublished =
    snap.publishedItems[snap.publishedItems.length - 1] || snap.publishedItems[0];
  const nearestUpload = snap.nearestScheduledVideo || snap.nextVideoToUpload;

  // 1. Pertanyaan tentang berapa kali sehari jadwal upload / frekuensi
  if (
    (q.includes("berapa") && (q.includes("sehari") || q.includes("hari") || q.includes("kali"))) ||
    q.includes("frekuensi") ||
    q.includes("target upload")
  ) {
    return {
      replyText:
        `Saat ini jadwal upload rutin kita diset <b>${snap.settings.dailyVideoTarget} kali sehari</b> pada pukul <b>${snap.settings.defaultUploadHour} WIB</b>, Mas.\n\n` +
        (nearestUpload
          ? `Untuk antrean terdekat, video yang siap tayang adalah <b>"${nearestUpload.title}"</b> (${nearestUpload.scheduleInfo.formatted}). Kalau Mas ingin mengubah frekuensi tayang per hari atau jamnya, tinggal bilang saja ke saya ya!`
          : `Kalau Mas ingin mengubah target tayang per hari (misalnya jadi 2x atau 3x sehari), langsung beritahu saya saja ya!`),
      actions: [],
    };
  }

  // 2. Pertanyaan tentang konten terakhir yang sudah terupload / tayang
  if (
    (q.includes("terakhir") || q.includes("terahir") || q.includes("barusan")) &&
    (q.includes("upload") || q.includes("tayang") || q.includes("publish") || q.includes("konten") || q.includes("video"))
  ) {
    if (lastPublished) {
      return {
        replyText:
          `Konten terakhir yang sudah berhasil tayang (<i>Published</i>) adalah <b>"${lastPublished.title}"</b> (<code>${lastPublished.code}</code>) dari kategori <i>${lastPublished.category}</i>.\n\n` +
          `Total saat ini sudah ada <b>${snap.publishedItems.length} video</b> yang tayang di medsos, dan masih ada <b>${snap.readyItems.length} video siap tayang</b> di etalase kita.`,
        actions: [],
      };
    }
    return {
      replyText: `Saat ini belum ada video yang berstatus tayang di medsos, Mas. Namun kita punya <b>${snap.readyItems.length} video siap tayang</b> di etalase.`,
      actions: [],
    };
  }

  // 3. Pertanyaan tentang konten terdekat / selanjutnya yang akan diupload
  if (
    (q.includes("terdekat") || q.includes("selanjutnya") || q.includes("berikutnya") || q.includes("habis ini") || q.includes("kapan")) &&
    (q.includes("upload") || q.includes("tayang") || q.includes("konten") || q.includes("video") || q.includes("jadwal"))
  ) {
    if (nearestUpload) {
      const schedLabel =
        nearestUpload.scheduleInfo.formatted !== "Belum dijadwalkan"
          ? nearestUpload.scheduleInfo.formatted
          : `Hari ini pukul ${snap.settings.defaultUploadHour} WIB`;
      return {
        replyText:
          `Konten terdekat yang akan di-upload selanjutnya adalah <b>"${nearestUpload.title}"</b> (<code>${nearestUpload.code}</code>).\n\n` +
          `📅 <b>Jadwal Tayang:</b> ${schedLabel}\n` +
          `🎯 <b>Kategori:</b> <i>${nearestUpload.category}</i>\n\n` +
          `Mau langsung saya publish sekarang ke Buffer atau tetap mengikuti jadwal tersebut, Mas?`,
        actions: [],
      };
    }
  }

  // 4. Pertanyaan tentang kabar / kondisi kantor virtual / editor
  if (q.includes("editor") || q.includes("kantor") || q.includes("tim") || q.includes("kuota")) {
    return {
      replyText:
        `Kondisi tim di <b>Kantor Virtual 3D</b> saat ini terpantau aman, Mas:\n` +
        `• <b>Editor Standby di PC:</b> ${workingCount} dari 11 editor 💻\n` +
        `• <b>Editor di Kursi Istirahat (Lounge):</b> ${restingCount} editor ☕\n` +
        `• <b>Total Kuota Google Flow:</b> ${totalKr}/550 credits\n\n` +
        `Mas bisa menyuruh saya kapan saja misalnya <i>"suruh semua editor istirahat"</i> atau <i>"panggil semua editor standby ke PC"</i>.`,
      actions: [],
    };
  }

  // 5. Balasan percakapan umum yang tetap kaya konteks
  return {
    replyText:
      `Siap Mas! Saat ini operasional <b>CeritaObim Studio</b> berjalan lancar:\n` +
      `• <b>Jadwal Rutin:</b> ${snap.settings.dailyVideoTarget} konten/hari (Jam ${snap.settings.defaultUploadHour} WIB)\n` +
      `• <b>Konten Terakhir Tayang:</b> ${lastPublished ? `"${lastPublished.title}"` : "-"}\n` +
      `• <b>Antrean Upload Terdekat:</b> ${nearestUpload ? `"${nearestUpload.title}" (${nearestUpload.scheduleInfo.formatted})` : "-"}\n` +
      `• <b>Tim Editor 3D:</b> ${workingCount} standby di PC, ${restingCount} di kursi istirahat Lounge.\n\n` +
      `Ada yang ingin Mas diskusikan soal ide konten, ubah jadwal tayang, atau instruksi untuk tim editor di kantor?`,
    actions: [],
  };
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
    return buildConversationalFallback(input);
  }

  const configuredModel = (
    process.env.LLM_MODEL ||
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash"
  )
    .trim()
    .replace(/^["']|["']$/g, "");

  // Daftar model Gemini dengan fallback otomatis jika model utama sibuk/tidak ditemukan
  const candidateModels = Array.from(
    new Set([
      configuredModel,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ])
  );

  const snap = input.snapshot;
  const flowAccs = listFlowProfileAccounts().slice(0, 11);
  const restingEditors = flowAccs.filter((a) => a.credits === 0);
  const workingEditors = flowAccs.filter((a) => a.credits > 0);
  const totalFlowCredits = flowAccs.reduce((sum, a) => sum + a.credits, 0);

  const lastPublishedItem =
    snap.publishedItems[snap.publishedItems.length - 1] || snap.publishedItems[0];

  const publishedSummary = snap.publishedItems
    .map(
      (item, idx) =>
        `${idx + 1}. [${item.code}] "${item.title}" (${item.category})${
          idx === snap.publishedItems.length - 1 ? " <-- TERAKHIR TAYANG / BARU SAJA TERUPLOAD" : ""
        }`
    )
    .join("\n");

  const scheduledSummary = snap.scheduledItems
    .map(
      (item, idx) =>
        `${idx + 1}. [${item.code}] "${item.title}" -> Jadwal Tayang: ${item.scheduleInfo.formatted}${
          idx === 0 ? " <-- TERDEKAT AKAN DIUPLOAD" : ""
        }`
    )
    .join("\n");

  const readySummary = snap.readyItems
    .map(
      (item, idx) =>
        `${idx + 1}. [${item.code}] "${item.title}" -> Status: Ready (00Final.mp4 siap tayang), Jadwal: ${item.scheduleInfo.formatted}`
    )
    .join("\n");

  const inProductionSummary = snap.inProductionItems
    .slice(0, 10)
    .map((item, idx) => `${idx + 1}. [${item.code}] "${item.title}" (${item.category})`)
    .join("\n");

  const editorStatusSummary = flowAccs
    .map(
      (a) =>
        `Profil ${a.index} (${a.email}): ${
          a.credits === 0
            ? "Sedang duduk di KURSI ISTIRAHAT Lounge (0/50 kr)"
            : `Standby di depan PC meja kerja (${a.credits}/50 kr)`
        }`
    )
    .join("\n");

  const systemPrompt = `Kamu adalah Obim, Asisten Eksekutif AI & Co-Founder pribadi untuk CEO CeritaObim Studio (Mas ${
    input.senderName || "Iqbal / CEO"
  }).

KEPRIBADIAN & GAYA BICARA KAMU (SANGAT PENTING):
1. Kamu adalah AI yang cerdas, luwes, hangat, fleksibel, dan nyambung diajak ngobrol apa saja layaknya asisten eksekutif manusia sungguhan.
2. JANGAN PERNAH menjawab dengan format template kaku seperti "Ready || Judul" atau "Published || Judul"! Jawablah dengan kalimat bahasa Indonesia yang natural, mengalir, enak dibaca, dan langsung menjawab inti pertanyaan CEO.
3. Jawab sesuai konteks pertanyaan:
   - Kalau CEO bertanya singkat (misal: "berapa kali sehari jadwal upload kita?"), jawab dengan jelas dan natural (contoh: explaining bahwa jadwal upload saat ini diset ${snap.settings.dailyVideoTarget} kali sehari setiap jam ${snap.settings.defaultUploadHour} WIB, sebutkan juga jadwal video terdekat jika relevan).
   - Kalau CEO bertanya "apa konten terakhir yang terupload?", jelaskan dengan natural video terakhir yang sudah berstatus Published beserta konteks singkatnya.
   - Kalau CEO bertanya "apa konten terdekat yang akan diupload?", sebutkan judul video terdekat di antrean beserta kapan jadwal tayangnya dan ringkasan singkat topiknya.
   - Kalau CEO mengajak diskusi ide konten, strategi TikTok/Shorts/Reels, naskah origami stop-motion, atau bertanya hal bebas di luar template, tanggapi dengan cerdas, solutif, dan fleksibel!
4. Gunakan format HTML Telegram yang rapi jika perlu penekanan: gunakan <b>teks tebal</b> dan <i>teks miring</i>. Jangan gunakan simbol markdown bintang (**teks**) atau pagar (###).

DATA REAL-TIME CERITAOBIM STUDIO SAAT INI (SUMBER KEBENARAN):
• Waktu Sekarang: ${snap.nowWibText}
• Pengaturan Frekuensi Upload: ${snap.settings.dailyVideoTarget} kali sehari (Target: ${snap.settings.dailyVideoTarget} Konten / Hari)
• Jam Upload Default: Jam ${snap.settings.defaultUploadHour} WIB

• Konten Terakhir yang Sudah Tayang (Last Uploaded / Published):
  ${
    lastPublishedItem
      ? `[${lastPublishedItem.code}] "${lastPublishedItem.title}" (Kategori: ${lastPublishedItem.category})`
      : "Belum ada"
  }

• Konten Terdekat yang Akan Diupload Selanjutnya (Next / Nearest Upload):
  ${
    snap.nearestScheduledVideo
      ? `[${snap.nearestScheduledVideo.code}] "${snap.nearestScheduledVideo.title}" — Dijadwalkan: ${snap.nearestScheduledVideo.scheduleInfo.formatted}`
      : snap.nextVideoToUpload
      ? `[${snap.nextVideoToUpload.code}] "${snap.nextVideoToUpload.title}" — Siap tayang (Jadwal: Hari ini jam ${snap.settings.defaultUploadHour} WIB)`
      : "Semua video siap tayang sudah diupload"
  }

• Daftar Lengkap Konten Sudah Tayang di Medsos (${snap.publishedItems.length} Video Published):
${publishedSummary || "(Belum ada)"}

• Daftar Konten Terjadwal di Antrean Buffer (${snap.scheduledItems.length} Video Scheduled):
${scheduledSummary || "(Belum ada jadwal spesifik di Buffer)"}

• Daftar Konten Siap Tayang / Ready (${snap.readyItems.length} Video Ready 00Final.mp4):
${readySummary || "(Kosong)"}

• Daftar Konten Sedang Diproduksi di Dapur (${snap.inProductionItems.length} Video):
${inProductionSummary || "(Kosong)"}

DATA REAL-TIME KANTOR VIRTUAL 3D & 11 EDITOR VIDEO:
• Total Editor Video: 11 Editor (Profil Chrome 1 s/d 11), dipimpin oleh PIC Video Mas Radit.
• Tim Naskah: Kak Fajar (PIC), Sarah Ideasi (Riset Sains), Dimas Origami (Prompt Architect).
• Ruangan Buffer (Publisher): Mba Siska (PIC QC) & Buffer (Publisher Jadwal Tayang).
• Status Posisi Editor Saat Ini:
  - Standby di depan PC masing-masing: ${workingEditors.length} Editor
  - Sedang duduk di Kursi Istirahat (Lounge Warkop Obim): ${restingEditors.length} Editor
  - Total Kuota Google Flow: ${totalFlowCredits} / 550 credits
• Rincian 11 Editor:
${editorStatusSummary}

KEMAMPUAN EKSEKUSI AKSI OTOMATIS (ACTION TAGS):
Jika dari pesan CEO terlihat ia meminta/menyuruh melakukan suatu tindakan, jawablah secara natural DAN sertakan tag aksi berikut di baris paling akhir jawabanmu (tag ini akan dieksekusi sistem secara otomatis):
- Jika CEO menyuruh semua editor istirahat / ke lounge / ke kursi istirahat:
  [ACTION:REST_ALL_EDITORS]
- Jika CEO menyuruh semua editor kembali standby / balik ke PC / kerja lagi / isi kuota semua:
  [ACTION:STANDBY_ALL_EDITORS]
- Jika CEO meminta ubah frekuensi upload per hari atau jam tayang (misal jadi 2 kali sehari atau jam 20:00):
  [ACTION:UPDATE_SETTINGS:{"dailyTarget":2,"uploadHour":"20:00"}]
- Jika CEO meminta publish/upload sebuah video sekarang juga:
  [ACTION:PUBLISH_NOW:{"contentCode":"${snap.nextVideoToUpload?.code || "CO-2026-011"}"}]
- Jika CEO meminta merapikan / menjadwalkan otomatis antrean video:
  [ACTION:AUTO_SCHEDULE]
- Jika CEO meminta menampilkan video untuk direview/ditonton:
  [ACTION:REVIEW:{"contentCode":"${snap.nextVideoToUpload?.code || "CO-2026-011"}"}]`;

  const chatKey = String(input.chatId || "default");
  const history = getChatHistory(chatKey);

  const contents = [
    ...history.map((turn) => ({
      role: turn.role,
      parts: [{ text: turn.text }],
    })),
    {
      role: "user",
      parts: [{ text: input.userMessage }],
    },
  ];

  for (const modelName of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        modelName
      )}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const payload = {
        system_instruction: {
          parts: [{ text: systemPrompt }],
        },
        contents,
        generationConfig: {
          temperature: 0.65,
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
        console.warn(`[Telegram AI Copilot] Model ${modelName} HTTP ${response.status}:`, errText.slice(0, 200));
        continue;
      }

      const data = await response.json();
      const candidateText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        continue;
      }

      // Ekstrak semua tag aksi seperti [ACTION:TYPE:{...}] atau [ACTION:TYPE]
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

      const cleanReply = formatTelegramHtml(candidateText);
      appendChatHistory(chatKey, input.userMessage, cleanReply);

      return {
        replyText: cleanReply,
        actions,
      };
    } catch (err) {
      console.warn(`[Telegram AI Copilot] Error calling ${modelName}:`, err);
    }
  }

  // Jika semua model gagal (mis. kuota API habis), gunakan fallback percakapan natural
  return buildConversationalFallback(input);
}
