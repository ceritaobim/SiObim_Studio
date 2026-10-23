export interface NavItem {
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  milestoneTag: string;
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    label: "Monitor",
    shortLabel: "Monitor",
    href: "/",
    description:
      "Pusat kontrol progres Content Planning, Audio, dan Video (alokasi kredit AI)",
    milestoneTag: "Utama",
  },
  {
    label: "Content Planning",
    shortLabel: "Planning",
    href: "/content",
    description:
      "Tabel jadwal harian, trigger AI buat plan baru & buat folder Google Drive otomatis",
    milestoneTag: "Plan",
  },
  {
    label: "Audio",
    shortLabel: "Audio",
    href: "/production",
    description:
      "Tabel antrean suara per konten & trigger ElevenLabs (kontrol kredit karakter)",
    milestoneTag: "TTS",
  },
  {
    label: "Video",
    shortLabel: "Video",
    href: "/assets",
    description:
      "Tabel pecahan 8 scene (per 10 detik) & trigger Google Flow origami stop-motion",
    milestoneTag: "GFlow",
  },
  {
    label: "Karakter",
    shortLabel: "Karakter",
    href: "/characters",
    description:
      "Upload gambar referensi karakter utama & sampingan beserta ciri visual dan karakteristiknya",
    milestoneTag: "Cast",
  },
  {
    label: "Upload",
    shortLabel: "Upload",
    href: "/publishing",
    description:
      "Asisten upload harian sesuai jam algoritma (YT Shorts, TikTok, IG Reels) dengan popup Copy-Next",
    milestoneTag: "Sosmed",
  },
  {
    label: "Analitik",
    shortLabel: "Analitik",
    href: "/analytics",
    description:
      "Pantau performa penayangan, jam tonton, interaksi, dan evaluasi hook (TikTok, YouTube Shorts, IG Reels)",
    milestoneTag: "Metrik",
  },
  {
    label: "Models Usage",
    shortLabel: "Models",
    href: "/models-usage",
    description:
      "Kelola daftar Akun Google, pantau sisa kuota kredit real-time ElevenLabs & Gemini AI, dan pilih akun aktif",
    milestoneTag: "Kuota AI",
  },
  {
    label: "Setting",
    shortLabel: "Setting",
    href: "/settings",
    description:
      "Koneksi Google Drive, Spreadsheet ContentPlan_CeritaObim, dan pengaturan identitas channel",
    milestoneTag: "Setelan",
  },
];
