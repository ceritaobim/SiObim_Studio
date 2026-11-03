export interface NavItem {
  label: string;
  shortLabel: string;
  href: string;
  description: string;
  milestoneTag: string;
}

export const PRIMARY_NAV_ITEMS: NavItem[] = [
  {
    label: "Dashboard",
    shortLabel: "Home",
    href: "/",
    description: "Pusat monitoring ringkas produksi mingguan dan aksi cepat",
    milestoneTag: "Home",
  },
  {
    label: "Kantor Virtual",
    shortLabel: "Kantor",
    href: "/office",
    description: "Markas agensi virtual Si Obim: Manajer, Produser, Audio, Kreatif & IT",
    milestoneTag: "Agency",
  },
  {
    label: "Content Plan",
    shortLabel: "Planning",
    href: "/content",
    description: "Tabel jadwal harian & generator topik fakta sains unik",
    milestoneTag: "Plan",
  },
  {
    label: "Voice Over",
    shortLabel: "Audio",
    href: "/production",
    description: "Generator narasi suara Obim & manajemen audio MP3",
    milestoneTag: "TTS",
  },
  {
    label: "Video Studio",
    shortLabel: "Video",
    href: "/assets",
    description: "Dropzone klip origami stop-motion & perakitan video final",
    milestoneTag: "GFlow",
  },
  {
    label: "Publishing",
    shortLabel: "Buffer",
    href: "/publishing",
    description: "Auto-publish ke TikTok, YouTube Shorts, dan Instagram Reels via Buffer",
    milestoneTag: "Sosmed",
  },
  {
    label: "Karakter",
    shortLabel: "Karakter",
    href: "/characters",
    description: "Galeri pose, ekspresi, dan konsistensi visual Obim",
    milestoneTag: "Cast",
  },
  {
    label: "Models Usage",
    shortLabel: "Ganti Akun",
    href: "/models-usage",
    description: "Ganti Akun Google (Multi-Account), pantau kuota Gemini TTS, Google Flow & ElevenLabs",
    milestoneTag: "Akun AI",
  },
  {
    label: "Tools Hub",
    shortLabel: "Tools",
    href: "/tools",
    description: "Diagnosa kesehatan & setting engine AI, GFlow, Buffer, Drive, dan FFmpeg",
    milestoneTag: "Engines",
  },
  {
    label: "Evaluasi & Analitik",
    shortLabel: "Evaluasi",
    href: "/analytics",
    description: "Evaluasi performa konten, metrik medsos, dan riset ide pertumbuhan Obim",
    milestoneTag: "Growth",
  },
  {
    label: "Pengaturan",
    shortLabel: "Setting",
    href: "/settings",
    description: "Setelan mode studio, backup cloud, VPS deployment, dan bot Telegram",
    milestoneTag: "Sistem",
  },
];
