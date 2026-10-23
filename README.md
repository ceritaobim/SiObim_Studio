# CeritaObim Studio

Aplikasi web mobile-first untuk mengelola produksi rutin konten video fakta pendek berbahasa Indonesia (`@cerita_obim`) dari perencanaan mingguan, penulisan naskah, voice-over & penyelarasan timestamp, pembuatan paket prompt bergaya *handmade origami paper stop-motion*, hingga perakitan video vertikal 9:16 (`1080x1920`) dan paket publikasi untuk **TikTok**, **YouTube Shorts**, dan **Instagram Reels**.

---

## Status Saat Ini: Milestone 0 (Repository & UI Foundation)

Sesuai `docs/IMPLEMENTATION_PLAN.md`, repositori saat ini berada pada **Milestone 0**:
- Next.js 15 (App Router) + React 19 + TypeScript (`strict: true`).
- Tailwind CSS v4 + komponen UI aksesibel dan responsif mulai dari lebar layar **360px** (HP) hingga desktop.
- Navigasi utama lengkap (Sidebar pada desktop, Bottom Navigation + Drawer pada mobile):
  - `/` — Dashboard Produksi
  - `/content` — Content Library (Pustaka Konten)
  - `/batches` — Weekly Batches (Wizard Perencanaan Mingguan)
  - `/production` — Production Queue & Scene Pipeline
  - `/assets` — Assets, Scene Prompts & FFmpeg Assembly
  - `/publishing` — Publishing Center (TikTok, Shorts, Reels)
  - `/settings` — Settings & Status Integrasi Provider
- Konfigurasi pemeriksaan kode (`npm run lint`, `npm run typecheck`, `npm test`).
- Tidak ada integrasi provider eksternal yang diklaim terhubung secara palsu.

---

## Cara Menjalankan secara Lokal

### 1. Prasyarat
- **Node.js** v20+ (direkomendasikan v22 atau v24) dan **npm**.
- Untuk Milestone 5 nanti: **FFmpeg** terinstal pada mesin/worker yang menjalankan proses perakitan video.

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Environment Variables
Salin `.env.example` menjadi `.env.local`:
```bash
cp .env.example .env.local
```
> **Penting:** Jangan pernah menyimpan password akun Google, session cookie, atau menaruh kunci API rahasia di variabel berawalan `NEXT_PUBLIC_`. File `.env.local` sudah diabaikan oleh `.gitignore`.

### 4. Menjalankan Server Development
```bash
npm run dev
```
Buka `http://localhost:3000` di browser (coba juga mode responsif `360px` di DevTools).

### 5. Menjalankan Pemeriksaan Kualitas Kode
```bash
npm run typecheck
npm run lint
npm test
npm run build
```

---

## Catatan Deployment & Arsitektur Worker

1. **Web App vs Background Worker:**
   - Jangan menjalankan proses FFmpeg atau antrean pembuatan batch panjang di dalam request serverless singkat.
   - Gunakan hosting web untuk Next.js dan worker terpisah (mis. Trigger.dev / container worker dengan akses binary `ffmpeg` dan penyimpanan sementara) untuk job tahan lama pada Milestone 5.
2. **Prinsip Integrasi Aman:**
   - **Google Flow (MVP):** Menggunakan mode semi-manual (ekspor paket prompt bernomor `CO-YYYY-NNN_SCENE_001.mp4` -> buat klip di UI Google Flow -> unggah kembali ke aplikasi). Tidak menggunakan otomatisasi rotasi akun Google.
   - **Publikasi Sosial (MVP):** Menghasilkan master MP4 9:16 bersih tanpa subtitle/watermark beserta variasi caption, hashtag, dan checklist manual untuk TikTok, YouTube Shorts, dan Instagram Reels.

---

## Referensi Dokumen Spesifikasi (`docs/`)

- `AGENTS.md` — Aturan kerja agent coding & Definition of Done.
- `docs/PRD.md` — Product Requirements Document.
- `docs/ARCHITECTURE.md` — Rancangan sistem, antarmuka provider, dan struktur folder.
- `docs/DATA_MODEL.md` — Skema tabel database dan aturan integritas data.
- `docs/INTEGRATIONS.md` — Strategi integrasi LLM, ElevenLabs, Google Flow semi-manual, dan FFmpeg.
- `docs/UX_SPEC.md` — Spesifikasi layar dan navigasi responsif.
- `docs/IMPLEMENTATION_PLAN.md` — Tahapan implementasi Milestone 0 s.d. Milestone 7.
- `docs/ACCEPTANCE_CRITERIA.md` — Daftar periksa penerimaan fitur.
- `docs/SECURITY_AND_PRIVACY.md` — Batasan keamanan dan privasi.
- `docs/OPEN_DECISIONS.md` — Keputusan terbuka yang tidak boleh diasumsikan secara sepihak.
- `templates/contentplan_template.xlsx` — Template awal spreadsheet perencanaan konten.
