import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "CeritaObim Studio",
    template: "%s | CeritaObim Studio",
  },
  description:
    "Studio produksi video fakta pendek berbahasa Indonesia bergaya stop-motion kertas origami untuk TikTok, YouTube Shorts, dan Instagram Reels.",
  applicationName: "CeritaObim Studio",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#d97706",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body
        className="min-h-screen bg-stone-50 text-stone-900"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
