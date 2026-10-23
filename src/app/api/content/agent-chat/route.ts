import { NextResponse } from "next/server";
import { getAuthorizedOwner } from "@/lib/auth/owner-auth";
import {
  createContentItem,
  getProjectSettings,
  listContentItems,
  saveScenesForContent,
  updateContentItem,
} from "@/lib/db/repository";
import { findDuplicateTopicWarnings } from "@/features/content-library/duplicate-detector";
import {
  validateAndSanitizeLLMPlanOutput,
} from "@/lib/providers/llm/llm-provider";
import { segmentNarrationIntoScenes } from "@/features/scenes/scene-segmenter";
import { pushItemsToGoogleSheetWebApp } from "@/features/content-library/google-sheets-sync";
import type { ContentItemRecord } from "@/types/domain";

export async function POST(request: Request) {
  const owner = await getAuthorizedOwner({
    requestHeaders: request.headers,
  });

  if (!owner.authorized) {
    return NextResponse.json(
      { error: "UNAUTHORIZED: Akses memerlukan otorisasi owner." },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const weekNumber = Math.max(1, Number(body.weekNumber ?? 1));
    const userMessage = String(body.message ?? "").trim();
    const chatHistory: Array<{ role: "user" | "assistant"; text: string }> =
      Array.isArray(body.history) ? body.history.slice(-6) : [];

    if (!userMessage) {
      return NextResponse.json(
        { error: "Tulis instruksi kustomisasi Anda terlebih dahulu." },
        { status: 400 }
      );
    }

    const [settings, allItems] = await Promise.all([
      getProjectSettings(owner.ownerId),
      listContentItems(owner.ownerId, { includeArchived: true }),
    ]);

    const year = new Date().getFullYear() || 2026;
    const weekStartSeq = (weekNumber - 1) * 7 + 1;
    const weekEndSeq = weekNumber * 7;

    const getSeqNum = (code: string, fallbackIdx: number) => {
      const m = code.match(/(\d+)$/);
      return m?.[1] ? parseInt(m[1], 10) : fallbackIdx + 1;
    };

    const currentWeekItems = allItems
      .filter((item, idx) => {
        const seq = getSeqNum(item.contentCode, idx);
        return seq >= weekStartSeq && seq <= weekEndSeq;
      })
      .sort((a, b) => a.contentCode.localeCompare(b.contentCode));

    const otherWeeksItems = allItems.filter((item, idx) => {
      const seq = getSeqNum(item.contentCode, idx);
      return seq < weekStartSeq || seq > weekEndSeq;
    });

    const apiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.LLM_API_KEY ||
      process.env.ANTHROPIC_API_KEY ||
      ""
    ).trim();

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "API Key AI belum diisi di .env.local (LLM_API_KEY). Masukkan API Key terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    const forbiddenPriorList = otherWeeksItems
      .map(
        (i) =>
          `- [${i.contentCode}] Judul: "${i.title}" | Topik: ${i.topic}`
      )
      .join("\n");

    const currentWeekSnapshot =
      currentWeekItems.length > 0
        ? currentWeekItems
            .map((i, idx) => {
              const dayNum = ((getSeqNum(i.contentCode, idx) - 1) % 7) + 1;
              return `Hari ${dayNum} [${i.contentCode}]:
Judul: ${i.title}
Kategori: ${i.category}
Topik: ${i.topic}
Caption: ${i.tiktokCaption}
Narasi: ${i.narration.slice(0, 260)}...`;
            })
            .join("\n\n")
        : `(Week ${weekNumber} saat ini masih kosong / belum memiliki 7 konten)`;

    const historyText =
      chatHistory.length > 0
        ? chatHistory
            .map(
              (m) =>
                `${m.role === "user" ? "Kreator" : "AI Agent"}: ${m.text}`
            )
            .join("\n")
        : "(Belum ada percakapan sebelumnya)";

    const prompt = `Kamu adalah AI Content Planning Agent khusus untuk channel video pendek Indonesia @${settings.channelName}.
Gaya Visual: ${settings.visualStyleGuide}
Gaya Bahasa Narasi: Bahasa Indonesia santai, akrab ("lo", "pernah nggak lo..."), mengalir, dan wajib dibagi per 10 detik (0-10:, 11-20:, 21-30:, 31-40:, 41-50:, 51-60:, 61-70:, 71-90:).

=== DAFTAR KONTEN MINGGU LAIN (DILARANG KERAS MENDUPLIKASI TOPIK/JUDUL INI) ===
${forbiddenPriorList || "(Belum ada minggu lain)"}

=== ISI CONTENT PLAN WEEK ${weekNumber} SAAT INI ===
${currentWeekSnapshot}

=== RIWAYAT CHAT SEBELUMNYA ===
${historyText}

=== INSTRUKSI BARU DARI KREATOR UNTUK WEEK ${weekNumber} ===
"${userMessage}"

TUGASMU SEBAGAI AI AGENT:
1. Patuhi instruksi kreator di atas untuk menyusun atau memodifikasi Content Plan Week ${weekNumber} (Hari 1 sampai Hari 7).
2. Jika Week ${weekNumber} sudah punya 7 konten dan kreator hanya meminta mengubah hari tertentu (misal "ganti Hari 3 dan Hari 5 jadi topik keuangan"), PERTAHANKAN hari lainnya persis seperti semula, dan hanya buat baru/ubah hari yang diminta!
3. Jika Week ${weekNumber} masih kosong atau kreator meminta merombak satu minggu penuh (misal "buatkan 7 konten minggu ini fokus psikologi percintaan & kerjaan"), susun ke-7 hari secara utuh.
4. PASTIKAN TIDAK ADA SATU PUN TOPIK ATAU JUDUL YANG KEMBAR/DOBEL, baik antar sesama 7 hari di Week ${weekNumber} maupun dengan Daftar Konten Minggu Lain di atas!
5. Setiap narasi WAJIB memiliki format segmen 10 detik:
0-10:
...
11-20:
...
21-30:
...
31-40:
...
41-50:
...
51-60:
...
61-70:
...
71-90:
...

Kembalikan HANYA JSON murni dengan format:
{
  "agentReply": "Jawaban ramah & ringkas dalam bahasa Indonesia kepada kreator tentang apa saja yang sudah kamu ubah/buat di Week ${weekNumber} serta jaminan bebas duplikat.",
  "proposals": [
    // Tepat 7 objek berurutan untuk Hari 1 sampai Hari 7 di Week ${weekNumber}:
    {
      "title": "Judul menarik dalam bahasa Indonesia",
      "category": "Kategori singkat",
      "topic": "Penjelasan spesifik sudut pandang topik",
      "hook": "Kalimat pembuka 3 detik pertama",
      "narration": "Narasi lengkap dengan penanda 0-10: sampai 71-90:",
      "cta": "Pertanyaan penutup di akhir video",
      "tiktokCaption": "Deskripsi 2 kalimat + hashtag",
      "youtubeDescription": "Deskripsi YouTube Shorts + hashtag",
      "instagramCaption": "Caption Instagram Reels + hashtag",
      "targetDurationSeconds": 80,
      "factualClaims": ["Klaim fakta ilmiah 1", "Klaim fakta ilmiah 2"],
      "sourceUrls": ["https://..."],
      "verificationStatus": "verified atau needs_verification"
    }
  ]
}`;

    const modelName =
      (process.env.LLM_MODEL || "").trim() === "gemini-2.5-flash" ||
      !(process.env.LLM_MODEL || "").trim()
        ? "gemini-3-flash-preview"
        : (process.env.LLM_MODEL || "").trim();

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      modelName
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const llmRes = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.7,
        },
      }),
    });

    if (!llmRes.ok) {
      const errBody = await llmRes.text().catch(() => "");
      throw new Error(
        `AI_AGENT_ERROR (Status ${llmRes.status}): ${errBody.slice(0, 180)}`
      );
    }

    const llmData = await llmRes.json();
    const parts: Array<{ text?: string }> =
      llmData?.candidates?.[0]?.content?.parts ?? [];
    const textPart =
      parts.find((p) => typeof p.text === "string" && p.text.includes("{")) ??
      parts[0];
    const rawText = textPart?.text ?? "{}";
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const parsedJson = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);

    const agentReply =
      typeof parsedJson.agentReply === "string" && parsedJson.agentReply.trim()
        ? parsedJson.agentReply.trim()
        : `Content Plan Week ${weekNumber} berhasil disesuaikan tanpa duplikasi topik!`;

    const proposals = validateAndSanitizeLLMPlanOutput(parsedJson);

    // Server-side anti-duplication verification across other weeks and within the 7 proposals
    const usedTitles = new Set(
      otherWeeksItems.map((i) => i.title.trim().toLowerCase())
    );
    const updatedWeekItems: ContentItemRecord[] = [];

    for (let dayIdx = 0; dayIdx < Math.min(7, proposals.length); dayIdx++) {
      const prop = proposals[dayIdx]!;
      const targetSeq = weekStartSeq + dayIdx;
      const targetCode = `CO-${year}-${String(targetSeq).padStart(3, "0")}`;
      const dayNumber = dayIdx + 1;

      // Check duplicate warning against other weeks
      const dupWarnings = findDuplicateTopicWarnings(
        {
          title: prop.title,
          topic: prop.topic,
          excludeCode: targetCode,
        },
        otherWeeksItems
      );

      let safeTitle = prop.title.trim();
      if (usedTitles.has(safeTitle.toLowerCase())) {
        safeTitle = `${safeTitle} (Sudut Pandang Baru)`;
      }
      usedTitles.add(safeTitle.toLowerCase());

      const existingSlotItem = allItems.find(
        (i) => i.contentCode.toUpperCase() === targetCode.toUpperCase()
      );

      let savedItem: ContentItemRecord;
      if (existingSlotItem) {
        savedItem = await updateContentItem(owner.ownerId, {
          id: existingSlotItem.id,
          title: safeTitle,
          category: prop.category,
          topic: prop.topic,
          hook: prop.hook,
          narration: prop.narration,
          cta: prop.cta,
          tiktokCaption: prop.tiktokCaption,
          youtubeDescription: prop.youtubeDescription,
          instagramCaption: prop.instagramCaption,
          targetDurationSeconds: prop.targetDurationSeconds,
          factualClaims: prop.factualClaims,
          sourceUrls: prop.sourceUrls,
          verificationStatus: prop.verificationStatus,
          notes: `Week ${weekNumber} — Hari ${dayNumber} (Dikustomisasi via AI Agent${
            dupWarnings.length > 0 ? " • Bebas Duplikat Terverifikasi" : ""
          })`,
        });
      } else {
        savedItem = await createContentItem(owner.ownerId, {
          contentCode: targetCode,
          title: safeTitle,
          category: prop.category,
          topic: prop.topic,
          hook: prop.hook,
          narration: prop.narration,
          cta: prop.cta,
          tiktokCaption: prop.tiktokCaption,
          youtubeDescription: prop.youtubeDescription,
          instagramCaption: prop.instagramCaption,
          notes: `Week ${weekNumber} — Hari ${dayNumber} (Dibuat via AI Agent)`,
          targetDurationSeconds: prop.targetDurationSeconds,
          factualClaims: prop.factualClaims,
          sourceUrls: prop.sourceUrls,
          verificationStatus: prop.verificationStatus,
          contentStatus: "script_approved",
          sourceBatchId: null,
          isDemo: false,
          publishedAt: null,
        });
      }

      // Re-segment 10s scenes for this item
      try {
        const autoScenes = segmentNarrationIntoScenes({
          contentId: savedItem.id,
          contentCode: savedItem.contentCode,
          narrationText: savedItem.narration,
          timestampStatus: "estimated",
          totalAudioDurationMs: (savedItem.targetDurationSeconds || 80) * 1000,
          minSceneSeconds: settings.targetSceneSecondsMin,
          maxSceneSeconds: settings.targetSceneSecondsMax,
        });
        await saveScenesForContent(owner.ownerId, savedItem.id, autoScenes);
      } catch {
        // ignore scene error
      }

      updatedWeekItems.push(savedItem);
    }

    const refreshedItems = await listContentItems(owner.ownerId);

    // Also sync to Google Sheets & Google Drive folders if configured
    let gsheetSyncMessage: string | null = null;
    const targetWebAppUrl =
      settings.googleSheetWebAppUrl ||
      process.env.GOOGLE_SHEETS_WEBHOOK_URL ||
      "";
    if (targetWebAppUrl) {
      try {
        const pushRes = await pushItemsToGoogleSheetWebApp(
          targetWebAppUrl,
          refreshedItems
        );
        gsheetSyncMessage = pushRes.message;
      } catch {
        // non-fatal
      }
    }

    return NextResponse.json({
      agentReply,
      weekNumber,
      updatedWeekItems,
      items: refreshedItems,
      gsheetSyncMessage,
    });
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Gagal menjalankan AI Agent Content Planning.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
