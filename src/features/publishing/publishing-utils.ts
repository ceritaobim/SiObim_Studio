import type { ObimProgramName, ContentItemRecord } from "@/types/domain";

export interface PublishingTimeSlot {
  id: "pagi" | "sore" | "malam";
  label: "Pagi" | "Sore" | "Malam";
  timeWib: string; // "07:00", "16:30", "19:30"
  icon: string;
  title: string;
  peakDescription: string;
  defaultProgram: ObimProgramName;
  programTag: string;
}

export const PUBLISHING_TIME_SLOTS: PublishingTimeSlot[] = [
  {
    id: "pagi",
    label: "Pagi",
    timeWib: "07:00",
    icon: "🌅",
    title: "Pagi (07:00 WIB)",
    peakDescription: "Peak Sarapan & Perjalanan Pagi (07:00 WIB)",
    defaultProgram: "Ke Dapur Yuk!",
    programTag: "Kuliner / Sains Makanan",
  },
  {
    id: "sore",
    label: "Sore",
    timeWib: "16:30",
    icon: "🌇",
    title: "Sore (16:30 WIB)",
    peakDescription: "Peak Rehat Sore & Pulang Kantor (16:30 WIB)",
    defaultProgram: "Eh, Ternyata!",
    programTag: "Fakta Sains & Mitos",
  },
  {
    id: "malam",
    label: "Malam",
    timeWib: "19:30",
    icon: "🌙",
    title: "Malam (19:30 WIB)",
    peakDescription: "Prime Time Santai & Sebelum Tidur (19:30 WIB)",
    defaultProgram: "Kepikiran Aja",
    programTag: "Psikologi & Overthinking",
  },
];

export function detectObimSegment(item: {
  programName?: string;
  category?: string;
  topic?: string;
  title?: string;
}): ObimProgramName {
  if (
    item.programName === "Ke Dapur Yuk!" ||
    item.programName === "Kepikiran Aja" ||
    item.programName === "Eh, Ternyata!"
  ) {
    return item.programName as ObimProgramName;
  }

  const cat = (item.category || "").toLowerCase();

  // 1. Cek Kategori Utama terlebih dahulu (Paling Akurat)
  if (
    cat.includes("makan") ||
    cat.includes("dapur") ||
    cat.includes("kuliner") ||
    cat.includes("resep")
  ) {
    return "Ke Dapur Yuk!";
  }

  if (
    cat.includes("psikolog") ||
    cat.includes("neuro") ||
    cat.includes("overthink")
  ) {
    return "Kepikiran Aja";
  }

  if (
    cat.includes("biologi") ||
    cat.includes("astronomi") ||
    cat.includes("alam") ||
    cat.includes("fisika") ||
    cat.includes("hewan") ||
    cat.includes("sains") ||
    cat.includes("tubuh")
  ) {
    return "Eh, Ternyata!";
  }

  // 2. Jika kategori belum spesifik, cek Kata Kunci Judul
  const title = (item.title || "").toLowerCase();
  if (
    title.includes("nasi") ||
    title.includes("bawang") ||
    title.includes("nanas") ||
    title.includes("piring") ||
    title.includes("kopi") ||
    title.includes("teh") ||
    title.includes("roti") ||
    title.includes("garam") ||
    title.includes("cokelat") ||
    title.includes("madu") ||
    title.includes("rendang") ||
    title.includes("susu") ||
    title.includes("telur") ||
    title.includes("cabe") ||
    title.includes("es krim")
  ) {
    return "Ke Dapur Yuk!";
  }

  if (
    title.includes("mandi") ||
    title.includes("tidur") ||
    title.includes("mimpi") ||
    title.includes("deja vu") ||
    title.includes("ngantuk") ||
    title.includes("sosmed")
  ) {
    return "Kepikiran Aja";
  }

  return "Eh, Ternyata!";
}

export function getDefaultSlotForItem(item: ContentItemRecord): PublishingTimeSlot {
  const seg = detectObimSegment(item);
  if (seg === "Ke Dapur Yuk!") return PUBLISHING_TIME_SLOTS[0]!; // Pagi (07:00)
  if (seg === "Eh, Ternyata!") return PUBLISHING_TIME_SLOTS[1]!; // Sore (16:30)
  return PUBLISHING_TIME_SLOTS[2]!; // Malam (19:30)
}
