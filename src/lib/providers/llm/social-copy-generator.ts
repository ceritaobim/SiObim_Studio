import type { ContentItemRecord } from "@/types/domain";

export type SocialCopyTone = "viral_curiosity" | "storytelling" | "casual_debate";

export interface GeneratedSocialCopy {
  viralTitle: string;
  hook: string;
  tiktokCaption: string;
  youtubeTitle: string;
  youtubeDescription: string;
  instagramCaption: string;
  hashtags: string[];
}

export async function generateSocialCopyForContent(
  content: ContentItemRecord,
  tone: SocialCopyTone = "viral_curiosity"
): Promise<GeneratedSocialCopy> {
  const apiKey = (process.env.GEMINI_API_KEY || process.env.LLM_API_KEY || "").trim();
  const model = process.env.LLM_MODEL || "gemini-3-flash-preview";

  const toneGuidelines: Record<SocialCopyTone, string> = {
    viral_curiosity:
      "Gunakan gaya bahasa santai khas anak muda Indonesia, bikin sangat penasaran, to the point, dan memancing orang berhenti scroll di 3 detik pertama.",
    storytelling:
      "Gunakan gaya bercerita singkat yang seru, mengalir, membawa penonton seperti diajak eksplorasi rahasia sains di dunia lipatan kertas origami.",
    casual_debate:
      "Gunakan gaya santai yang melempar pertanyaan debat interaktif di akhir untuk memancing perang komentar positif (contoh: 'Lo tim A atau tim B?').",
  };

  const systemInstruction = `Kamu adalah pakar Viral Social Media Strategist & Copywriter untuk CeritaObim Studio (animasi edukasi sains vertikal 9:16 handmade origami paper stop-motion).
Karakter utama: Obim (anak laki-laki kemeja flanel merah kotak-kotak).
Target audiens: Generasi muda Indonesia di TikTok, YouTube Shorts, dan Instagram Reels.

Aturan output:
1. Respon HANYA berupa JSON valid tanpa markdown backticks atau penjelasan pembuka/penutup.
2. Format JSON harus memiliki properti:
   - "viralTitle": Judul singkat yang sangat menarik & memikat (maks 60 karakter)
   - "hook": Kalimat pembuka 3 detik pertama yang bikin orang berhenti scroll
   - "tiktokCaption": Caption TikTok ringkas + pertanyaan memancing komen + 5-6 hashtags relevan
   - "youtubeTitle": Judul YouTube Shorts SEO-friendly + emoji (maks 70 karakter)
   - "youtubeDescription": Deskripsi ringkas YouTube Shorts (1-2 paragraf) + fakta kunci + tags
   - "instagramCaption": Caption Instagram Reels bergaya micro-blogging rapi + ajakan share ke teman + hashtags
   - "hashtags": Array berisi 6-8 hashtag tanpa simbol pagar (contoh: ["CeritaObim", "FaktaUnik", "SainsSeru"])`;

  const prompt = `Konten Saat Ini:
- Judul: ${content.title}
- Topik / Fakta: ${content.topic}
- Program: ${content.programName || "Sains Unik"}
- Narasi:
${content.narration}

Instruksi Tambahan:
${toneGuidelines[tone]}

Buatkan copy medsos (TikTok, YouTube Shorts, Instagram Reels) yang sangat viral dan siap pakai dalam format JSON.`;

  if (apiKey) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${systemInstruction}\n\n${prompt}` }] }],
          generationConfig: {
            temperature: 0.7,
            responseMimeType: "application/json",
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText) {
          const parsed = JSON.parse(rawText);
          return {
            viralTitle: parsed.viralTitle || content.title,
            hook: parsed.hook || content.hook,
            tiktokCaption: parsed.tiktokCaption || content.tiktokCaption,
            youtubeTitle: parsed.youtubeTitle || `${content.title} #Shorts`,
            youtubeDescription:
              parsed.youtubeDescription || content.youtubeDescription,
            instagramCaption:
              parsed.instagramCaption || content.instagramCaption,
            hashtags: Array.isArray(parsed.hashtags)
              ? parsed.hashtags
              : ["CeritaObim", "FaktaUnik", "SainsSeru", "OrigamiAnimasi", "FYP"],
          };
        }
      }
    } catch {
      // Fallback below
    }
  }

  // High quality heuristic fallback if API is not accessible or offline
  const baseHashtags = [
    "CeritaObim",
    "FaktaUnik",
    "SainsSeru",
    "OrigamiPapercraft",
    "FYP",
  ];
  if (content.programName === "Ke Dapur Yuk!") baseHashtags.push("SainsMakanan", "KeDapurYuk");
  else if (content.programName === "Kepikiran Aja") baseHashtags.push("FaktaPikiran", "KepikiranAja");
  else baseHashtags.push("EhTernyata", "TriviaSains");

  const hashString = baseHashtags.map((h) => `#${h}`).join(" ");

  return {
    viralTitle: content.title,
    hook: content.hook || "Lo pernah kepikiran nggak sih kenapa hal ini bisa terjadi?",
    tiktokCaption: `${content.title}! 😲\n\n${content.hook}\n\nKomen pendapat lo di bawah ya! 👇\n${hashString}`,
    youtubeTitle: `${content.title} 💡 #Shorts`,
    youtubeDescription: `${content.title}\n\nTahukah kamu? ${content.topic}\n\nTonton video origami stop-motion CeritaObim lainnya setiap hari!\n\n${hashString}`,
    instagramCaption: `Siapa yang baru tau rahasia ini? 🤯\n\n${content.hook}\n\nKira-kira fakta apa lagi yang pengen lo tau? Tulis di komentar & jangan lupa share ke temen lo ya! ✨\n\n${hashString}`,
    hashtags: baseHashtags,
  };
}
