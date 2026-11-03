/**
 * CeritaObim Studio — Standard Hashtag Generator
 *
 * Aturan Ketat Pengunggahan Konten CeritaObim Studio:
 * Tepat 3 hashtag per video:
 * 1. #CeritaOBIM
 * 2. #SiOBIM
 * 3. #<tag_topik_spesifik> (contoh: #nasigoreng, #bawang, #dejavu)
 */

const STOP_WORDS = new Set([
  "kenapa",
  "mengapa",
  "apakah",
  "bagaimana",
  "rahasia",
  "adalah",
  "bisa",
  "yang",
  "pada",
  "dari",
  "ini",
  "itu",
  "kita",
  "kamu",
  "bikin",
  "buat",
  "saat",
  "pas",
  "lagi",
  "tapi",
  "nggak",
  "tidak",
  "akan",
  "sudah",
  "harus",
  "ternyata",
  "misteri",
  "alasan",
  "fakta",
  "tentang",
  "pernah",
  "ngerasa",
  "sebelumnya",
  "malah",
  "dong",
  "sih",
  "nih",
  "deh",
]);

/**
 * Menghasilkan tepat 3 hashtag sesuai standar resmi CeritaObim Studio:
 * #CeritaOBIM #SiOBIM #${topicTag}
 */
export function getStandardHashtags(title?: string, topic?: string): string {
  const baseKey = (topic || title || "sains").trim();

  // Bersihkan tanda baca dan karakter non-alfanumerik
  const words = baseKey
    .toLowerCase()
    .replace(/[?!.,'"`()—–:\-_/\\#@+]/g, " ")
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));

  // Ambil kata kunci terbaik (maksimal 2 kata digabung jika sangat pendek, misal "nasi" + "goreng" -> "nasigoreng", "deja" + "vu" -> "dejavu")
  let specificTag = "faktaunik";
  if (words.length >= 2 && words[0]!.length <= 4 && words[1]!.length <= 6) {
    specificTag = `${words[0]}${words[1]}`;
  } else if (words.length > 0 && words[0]) {
    specificTag = words[0];
  }

  // Sanitasi slug hashtag
  specificTag = specificTag.replace(/[^a-z0-9]/g, "");
  if (!specificTag) specificTag = "faktaunik";

  return `#CeritaOBIM #SiOBIM #${specificTag}`;
}
