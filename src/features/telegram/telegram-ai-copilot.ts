/**
 * CeritaObim Studio — Telegram AI Copilot (Powered by Google Gemini)
 *
 * Mengubah bot Telegram menjadi Asisten Pribadi Cerdas (Obim Copilot)
 * yang memahami seluruh konten CeritaObim, gaya origami stop-motion,
 * dan dapat berinteraksi secara fleksibel dalam bahasa Indonesia kasual.
 */

import type { ContentItemRecord } from "@/types/domain";

export interface CopilotChatInput {
  userMessage: string;
  senderName?: string;
  contentItems: ContentItemRecord[];
  completedCodes: string[];
}

export interface CopilotChatResponse {
  replyText: string;
  action?: {
    type: "REVIEW" | "APPROVE" | "LIST_STATUS";
    contentCode?: string;
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
    return {
      replyText:
        "⚠️ API Key Google AI (Gemini) belum diset di server (.env.local). Silakan tambahkan GEMINI_API_KEY untuk mengaktifkan fitur chat cerdas.",
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

  // Buat ringkasan ringkas konten studio untuk konteks AI
  const catalogSummary = input.contentItems
    .slice(0, 30)
    .map((item) => {
      const isDone = input.completedCodes.includes(item.contentCode.toUpperCase());
      return `- [${item.contentCode}] "${item.title}" (${item.category}) -> ${
        isDone ? "✅ FINAL SIAP TAYANG" : "⏳ PROSES/PENDING"
      }`;
    })
    .join("\n");

  const systemPrompt = `Kamu adalah Obim, asisten cerdas dan partner kreatif resmi untuk channel CeritaObim Studio.
Kamu berbicara langsung dengan sang kreator (Mas ${input.senderName || "B3"}).

IDENTITAS & ATURAN CHANNEL CERITAOBIM:
- Format Video: Vertikal 9:16 (1080x1920), durasi target 65-80 detik (monetization-friendly).
- Visual Identity: Handmade origami paper stop-motion murni. Semua karakter, properti, dan background tampak terbuat dari lipatan kertas doff. Obim adalah figur anak muda kertas origami berkemeja flanel merah kotak-kotak dan celana biru dongker.
- Tanpa subtitle/teks di dalam klip video generated (teks hanya untuk banner thumbnail cover di Bagian 1).
- 3 Segmen Resmi:
  1. Ke Dapur Yuk! (Sains makanan & kuliner)
  2. Kepikiran Aja (Psikologi & pertanyaan sebelum tidur)
  3. Eh, Ternyata! (Fakta unik sains & mitos)

DATA REAL-TIME KONTEN STUDIO SAAT INI:
${catalogSummary}

TUGAS & KEMAMPUAN KAMU:
1. Berbicara dengan gaya ramah, santai, cerdas, solutif, dan antusias khas Obim (bahasa Indonesia sehari-hari, tidak kaku).
2. Jika kreator menanyakan status video/konten, jelaskan dengan ringkas mana yang sudah siap tayang dan mana yang masih pending.
3. Jika kreator meminta untuk mereview, melihat, atau mengecek video tertentu (misal: "kirim video nasi goreng" atau "review CO-2026-002"), cantumkan tag khusus di akhir jawabanmu: [ACTION:REVIEW:KODE_KONTEN] (contoh: [ACTION:REVIEW:CO-2026-001]). Sistem akan otomatis mengekstrak tag ini untuk mengirimkan video MP4 ke Telegram.
4. Jika kreator menyetujui konten (misal: "konten 002 siap tayang ya"), cantumkan tag: [ACTION:APPROVE:KODE_KONTEN].
5. Jika kreator meminta bantuan copywriting, buatkan hook memikat atau variasi caption TikTok/Reels/Shorts dengan hashtag yang relevan.
6. Jawab dengan format rapi menggunakan bullet point atau emoji yang enak dibaca di layar HP Telegram.`;

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
        temperature: 0.7,
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
          "Maaf Mas, koneksi ke Google Gemini AI sedang mengalami kendala sementara. Anda tetap bisa menggunakan perintah cepat seperti /status atau /review.",
      };
    }

    const data = await response.json();
    const candidateText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf Mas, Obim belum bisa memahami pesan tersebut.";

    // Deteksi action tags seperti [ACTION:REVIEW:CO-2026-001]
    let cleanReply = candidateText;
    let actionResult: CopilotChatResponse["action"] = undefined;

    const reviewMatch = candidateText.match(/\[ACTION:REVIEW:([A-Z0-9-]+)\]/i);
    if (reviewMatch) {
      actionResult = {
        type: "REVIEW",
        contentCode: reviewMatch[1].toUpperCase(),
      };
      cleanReply = cleanReply.replace(reviewMatch[0], "").trim();
    }

    const approveMatch = candidateText.match(/\[ACTION:APPROVE:([A-Z0-9-]+)\]/i);
    if (approveMatch) {
      actionResult = {
        type: "APPROVE",
        contentCode: approveMatch[1].toUpperCase(),
      };
      cleanReply = cleanReply.replace(approveMatch[0], "").trim();
    }

    return {
      replyText: cleanReply,
      action: actionResult,
    };
  } catch (err) {
    console.error("Gemini Copilot Error:", err);
    return {
      replyText:
        "Waduh, terjadi error saat memproses percakapan dengan Google AI. Coba tanyakan lagi ya Mas!",
    };
  }
}
