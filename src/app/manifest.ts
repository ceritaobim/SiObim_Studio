import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CeritaObim Studio — Origami Short-Form Video Batch Producer",
    short_name: "CeritaObim",
    description:
      "Aplikasi produksi mingguan video fakta singkat Bahasa Indonesia bergaya stop-motion kertas origami (9:16) untuk TikTok, YouTube Shorts, dan Instagram Reels.",
    start_url: "/",
    display: "standalone",
    background_color: "#fafaf9",
    theme_color: "#d97706",
    orientation: "portrait",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
