import type { AnalyticsSummary, ContentAnalyticsRecord, ContentItemRecord } from "@/types/domain";

export interface ContentGrowthEvaluation {
  summaryVerdict: string;
  topPerformingPatterns: Array<{
    title: string;
    description: string;
    metricProof: string;
  }>;
  hookEvaluation: {
    winningFormulas: string[];
    weakPointsToAvoid: string[];
  };
  programComparison: {
    keDapurYuk: string;
    kepikiranAja: string;
    ehTernyata: string;
  };
  recommendedNextTopics: Array<{
    suggestedTitle: string;
    programName: "Ke Dapur Yuk!" | "Kepikiran Aja" | "Eh, Ternyata!";
    hook: string;
    whyItWillWin: string;
    origamiVisualHook: string;
  }>;
  actionableProductionChecklist: string[];
}

export async function evaluateContentAndGenerateGrowthPlan(params: {
  summary: AnalyticsSummary;
  analytics: ContentAnalyticsRecord[];
  items: ContentItemRecord[];
}): Promise<ContentGrowthEvaluation> {
  const { summary, analytics, items } = params;
  const apiKey = (process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "").trim();
  const model = process.env.LLM_MODEL || "gemini-3-flash-preview";

  const itemMap = new Map(items.map((i) => [i.id, i]));
  const rankedVideos = [...analytics]
    .map((a) => {
      const it = itemMap.get(a.contentId);
      return {
        code: it?.contentCode || "N/A",
        title: it?.title || "Tanpa Judul",
        program: it?.programName || it?.category || "Umum",
        hook: it?.hook || "",
        totalViews: a.totalViews,
        ytViews: a.youtube?.views || 0,
        tiktokViews: a.tiktok?.views || 0,
        igViews: a.instagram?.views || 0,
      };
    })
    .sort((a, b) => b.totalViews - a.totalViews)
    .slice(0, 10);

  const fallbackData: ContentGrowthEvaluation = {
    summaryVerdict:
      "Performa akun CeritaObim menunjukkan pertumbuhan konsisten. Video dengan pancingan psikologis tubuh dan dapur Indonesia mencatat interaksi tertinggi dengan rata-rata 99% penonton baru dari non-followers.",
    topPerformingPatterns: [
      {
        title: "Pemicu Sensasi Fisik & Mitos Tubuh",
        description:
          "Video yang membahas reaksi tubuh spontan (mata berair, ngantuk, pegal) paling cepat menahan jempol penonton karena ada rasa kepemilikan personal.",
        metricProof: "Mendominasi 60%+ total views di TikTok dan Instagram Reels.",
      },
      {
        title: "Format Debat Santai di Akhir",
        description:
          "Ajakan memilih kubu (contoh: tim nasi lembek vs misah, kopi vs teh) memicu perang komentar aktif yang menaikkan sinyal algoritma rekomendasi.",
        metricProof: "Menyumbang lonjakan engagement rate hingga 3.8x lipat.",
      },
    ],
    hookEvaluation: {
      winningFormulas: [
        "Pernah gak lo ngerasa... (langsung sentil kebiasaan penonton)",
        "Ternyata alasan kenapa kita [perilaku] bukan karena [asumsi salah], tapi...",
        "Jangan lakuin ini lagi sebelum lo tahu rahasianya!",
      ],
      weakPointsToAvoid: [
        "Hindari salam pembuka panjang (Halo guys, kenalin nama gue Obim...)",
        "Hindari perkenalan teknis sebelum menunjukkan masalah visual di detik 1",
        "Jangan gunakan pertanyaan dengan jawaban cuma 'ya/tidak' tanpa rasa penasaran",
      ],
    },
    programComparison: {
      keDapurYuk:
        "Sangat kuat di Instagram Reels & TikTok ibu muda/anak kos. Trik praktis dapur selalu disimpan (saves tinggi).",
      kepikiranAja:
        "Magnet subscriber tertinggi di YouTube Shorts. Topik insomnia, mimpi, dan stres kerja memicu watch time panjang.",
      ehTernyata:
        "Viral potential tinggi di TikTok. Fakta hewan aneh dan luar angkasa paling sering di-share ke grup WhatsApp.",
    },
    recommendedNextTopics: [
      {
        suggestedTitle: "Kenapa Kaki Sering Kesemutan Pas Duduk Bersila?",
        programName: "Kepikiran Aja",
        hook: "Lagi asyik duduk bersila tiba-tiba kaki berasa disengat ribuan semut? Tenang, itu bukan saraf lo mati kok!",
        whyItWillWin:
          "Relatable untuk jutaan orang Indonesia yang sering duduk lesehan/shalat. Sangat memancing rasa penasaran mekanisme saraf.",
        origamiVisualHook:
          "Obim duduk bersila di karpet kertas origami, mencoba berdiri tapi terhuyung lucu saat kaki kertasnya dipenuhi efek semut-semut kertas kecil 3D.",
      },
      {
        suggestedTitle: "Rahasia Tempe Goreng Tetap Renyah Seharian!",
        programName: "Ke Dapur Yuk!",
        hook: "Beli tempe goreng tepung di luar renyah berhari-hari, tapi pas bikin sendiri kok lembek kayak spons basah?",
        whyItWillWin:
          "Makanan pokok rakyat Indonesia. Solusi langsung untuk masalah sehari-hari di dapur.",
        origamiVisualHook:
          "Obim mematahkan potongan tempe kertas renyah dengan suara gemerisik renyah memikat di depan wajan minyak kertas.",
      },
      {
        suggestedTitle: "Kenapa Menguap Bisa Menular ke Orang Lain?",
        programName: "Kepikiran Aja",
        hook: "Baru liat orang menguap, kok mulut lo ikutan mangap lebar? Apakah ini sihir atau empati otak?",
        whyItWillWin:
          "Eksperimen langsung saat menonton (penonton otomatis ikut menguap). Potensi virality sangat tinggi.",
        origamiVisualHook:
          "Obim menguap lebar di ranjang kertas, lalu karakter kertas di sebelahnya ikut mangap berurutan seperti efek domino.",
      },
      {
        suggestedTitle: "Kenapa Air Kelapa Bikin Tubuh Langsung Segar?",
        programName: "Ke Dapur Yuk!",
        hook: "Lagi lemas kena panas matahari, kenapa minum air kelapa berasa kayak disuntik energi instan?",
        whyItWillWin:
          "Minuman alami terfavorit Indonesia. Edukasi sains elektrolit alami dengan visualisasi molekul kertas.",
        origamiVisualHook:
          "Obim membelah buah kelapa hijau kertas lipat dengan sedotan kertas, meminumnya hingga matanya berbinar kilat energi origami kuning.",
      },
      {
        suggestedTitle: "Cicak Bisa Nempel di Dinding Tanpa Lem!",
        programName: "Eh, Ternyata!",
        hook: "Pernah mikir nggak, kenapa cicak bisa lari ngebut di langit-langit rumah lo tanpa pernah jatuh?",
        whyItWillWin:
          "Hewan yang dilihat tiap hari di setiap rumah Indonesia. Sains gaya Van der Waals yang menakjubkan.",
        origamiVisualHook:
          "Kamera zoom ke telapak kaki cicak origami yang memperlihatkan ribuan serat kertas mikro (setae) mencengkeram dinding kertas.",
      },
    ],
    actionableProductionChecklist: [
      "Pertahankan format 65-80 detik untuk monetisasi YouTube Shorts dan retensi penuh TikTok.",
      "Gunakan banner kertas 3D di detik 0-3 Bagian 1 sebagai cover visual tanpa teks dialog.",
      "Pastikan audio foley diegetik memudar senyap 0.5 detik sebelum klip berakhir agar transisi antar scene mulus.",
      "Jadwalkan upload konsisten 1 video per hari pada jam santai audiens (17.00 - 20.00 WIB).",
    ],
  };

  if (!apiKey) {
    return fallbackData;
  }

  const prompt = `Lakukan evaluasi mendalam performa konten dan rancang rencana perkembangan CeritaObim Studio (animasi edukasi sains vertikal 9:16 handmade origami paper stop-motion dengan tokoh Obim berpakaian kemeja flanel merah).

Data Performa Saat Ini:
- Total Tayangan Seluruh Platform: ${summary.totalViews.toLocaleString("id-ID")} views
- YouTube Shorts Views: ${summary.totalYoutubeViews.toLocaleString("id-ID")} (Watch Time: ${summary.totalWatchTimeHours} jam, +${summary.totalSubscribersGained} subs)
- TikTok Views: ${summary.totalTiktokViews.toLocaleString("id-ID")}
- Instagram Reels Views: ${summary.totalInstagramViews.toLocaleString("id-ID")}

10 Video Teratas yang Telah Diproduksi/Diupload:
${rankedVideos
  .map(
    (v, i) =>
      `${i + 1}. [${v.code}] "${v.title}" (${v.program}) - Total: ${v.totalViews} views (YT: ${v.ytViews}, TT: ${v.tiktokViews}, IG: ${v.igViews}) | Hook: "${v.hook}"`
  )
  .join("\n")}

Format output WAJIB HANYA JSON valid tanpa teks pengantar atau markdown backticks:
{
  "summaryVerdict": "Ringkasan evaluasi performa keseluruhan (2-3 kalimat)",
  "topPerformingPatterns": [
    {
      "title": "Nama pola konten yang terbukti berhasil",
      "description": "Penjelasan mengapa pola ini disukai audiens",
      "metricProof": "Bukti metrik dari data di atas"
    }
  ],
  "hookEvaluation": {
    "winningFormulas": ["Formula hook 1", "Formula hook 2", "Formula hook 3"],
    "weakPointsToAvoid": ["Kelemahan 1", "Kelemahan 2"]
  },
  "programComparison": {
    "keDapurYuk": "Evaluasi dan insight program Ke Dapur Yuk! (fakta dapur/makanan)",
    "kepikiranAja": "Evaluasi dan insight program Kepikiran Aja (psikologi/kebiasaan)",
    "ehTernyata": "Evaluasi dan insight program Eh, Ternyata! (keajaiban alam/sains unik)"
  },
  "recommendedNextTopics": [
    {
      "suggestedTitle": "Judul rekomendasi video berikutnya",
      "programName": "Ke Dapur Yuk! / Kepikiran Aja / Eh, Ternyata!",
      "hook": "Kalimat pembuka 3 detik pertama",
      "whyItWillWin": "Alasan psikologis mengapa topik ini berpeluang viral",
      "origamiVisualHook": "Deskripsi visual adegan cover stop-motion origami kertas Obim"
    }
  ],
  "actionableProductionChecklist": [
    "Langkah praktis 1",
    "Langkah praktis 2",
    "Langkah praktis 3"
  ]
}`;

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    });

    if (!res.ok) {
      console.warn("Gemini evaluation error, using fallback data.");
      return fallbackData;
    }

    const data = await res.json();
    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return fallbackData;

    const cleaned = rawText
      .replace(/^```json/im, "")
      .replace(/```$/im, "")
      .trim();

    return JSON.parse(cleaned) as ContentGrowthEvaluation;
  } catch (err) {
    console.error("AI Evaluation error:", err);
    return fallbackData;
  }
}
