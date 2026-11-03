const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-core');

async function generatePdf() {
  const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>CeritaObim Studio — Laporan Produk & Panduan Sistem Otonom</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Cabinet+Grotesk:wght@700;800;900&display=swap');

    @page {
      size: A4 portrait;
      margin: 0;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    body {
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #1e293b;
      line-height: 1.5;
      font-size: 13px;
    }

    .page {
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
      padding: 24mm 22mm;
      position: relative;
      background: #ffffff;
      page-break-after: always;
      break-after: page;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }

    /* COVER PAGE */
    .cover-page {
      background: linear-gradient(145deg, #090d16 0%, #0f172a 45%, #1e1b4b 100%);
      color: #ffffff;
      padding: 32mm 26mm;
      justify-content: space-between;
      position: relative;
    }

    .cover-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 7px 16px;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      margin-bottom: 24px;
    }

    .cover-title {
      font-family: 'Cabinet Grotesk', sans-serif;
      font-size: 44px;
      font-weight: 900;
      line-height: 1.1;
      letter-spacing: -1px;
      margin-bottom: 18px;
      background: linear-gradient(135deg, #ffffff 0%, #cbd5e1 50%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cover-title span {
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 60%, #d97706 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .cover-subtitle {
      font-size: 16px;
      line-height: 1.6;
      color: #cbd5e1;
      font-weight: 400;
      max-width: 580px;
      margin-bottom: 35px;
    }

    .cover-highlight-box {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 18px;
      padding: 22px 24px;
      margin-bottom: 35px;
      backdrop-filter: blur(10px);
    }

    .highlight-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 18px;
    }

    .highlight-item {
      border-left: 3px solid #f59e0b;
      padding-left: 14px;
    }

    .highlight-value {
      font-size: 22px;
      font-weight: 800;
      color: #ffffff;
      margin-bottom: 2px;
    }

    .highlight-label {
      font-size: 11px;
      color: #94a3b8;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .cover-footer {
      border-top: 1px solid rgba(255, 255, 255, 0.12);
      padding-top: 20px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }

    .cover-meta-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #64748b;
      margin-bottom: 4px;
      font-weight: 600;
    }

    .cover-meta-val {
      font-size: 13px;
      color: #e2e8f0;
      font-weight: 700;
    }

    /* INTERNAL PAGE HEADERS & FOOTERS */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2px solid #f1f5f9;
      padding-bottom: 12px;
      margin-bottom: 22px;
    }

    .header-logo {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .logo-badge {
      width: 28px;
      height: 28px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      color: #ffffff;
      font-weight: 900;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo-text {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.3px;
      color: #0f172a;
    }

    .header-tagline {
      font-size: 10px;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 1px;
    }

    .page-footer {
      border-top: 1px solid #f1f5f9;
      padding-top: 12px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #94a3b8;
      font-weight: 600;
    }

    /* TYPOGRAPHY */
    .section-eyebrow {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      font-weight: 800;
      color: #4f46e5;
      margin-bottom: 6px;
      display: inline-block;
    }

    .section-title {
      font-size: 26px;
      font-weight: 800;
      color: #0f172a;
      line-height: 1.2;
      letter-spacing: -0.5px;
      margin-bottom: 12px;
    }

    .section-lead {
      font-size: 13.5px;
      color: #475569;
      line-height: 1.6;
      margin-bottom: 20px;
    }

    /* CARDS & GRIDS */
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 18px;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 14px;
      margin-bottom: 18px;
    }

    .card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px;
      position: relative;
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }

    .card-accent {
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      border: 1px solid #cbd5e1;
    }

    .card-primary {
      background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
      border: 1px solid #c7d2fe;
    }

    .card-icon {
      font-size: 22px;
      margin-bottom: 10px;
      display: inline-block;
    }

    .card-title {
      font-size: 14px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 6px;
    }

    .card-desc {
      font-size: 12px;
      color: #64748b;
      line-height: 1.5;
    }

    /* COMPARISON TABLE */
    .compare-box {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin: 18px 0;
    }

    .compare-side {
      border-radius: 14px;
      padding: 18px;
    }

    .compare-old {
      background: #fef2f2;
      border: 1px solid #fecaca;
    }

    .compare-new {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }

    .compare-title {
      font-size: 13px;
      font-weight: 800;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .compare-old .compare-title { color: #dc2626; }
    .compare-new .compare-title { color: #16a34a; }

    .compare-list {
      list-style: none;
      space-y: 8px;
    }

    .compare-list li {
      font-size: 11.5px;
      margin-bottom: 7px;
      display: flex;
      align-items: flex-start;
      gap: 6px;
      line-height: 1.4;
    }

    .compare-old li { color: #991b1b; }
    .compare-new li { color: #166534; font-weight: 600; }

    /* STEP FLOW BOXES */
    .step-flow {
      display: flex;
      gap: 12px;
      margin: 20px 0;
    }

    .step-box {
      flex: 1;
      background: #ffffff;
      border: 1.5px solid #e2e8f0;
      border-radius: 14px;
      padding: 16px 14px;
      position: relative;
    }

    .step-number {
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: #4f46e5;
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 10px;
    }

    .step-title {
      font-size: 13px;
      font-weight: 800;
      color: #0f172a;
      margin-bottom: 4px;
    }

    .step-text {
      font-size: 11.5px;
      color: #64748b;
      line-height: 1.45;
    }

    /* BADGES & PILLS */
    .pill {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .pill-green { background: #dcfce7; color: #15803d; }
    .pill-blue { background: #dbeafe; color: #1d4ed8; }
    .pill-purple { background: #f3e8ff; color: #7e22ce; }
    .pill-amber { background: #fef3c7; color: #b45309; }

    /* SCHEDULE SLOTS SHOWCASE */
    .slot-card {
      border-radius: 12px;
      padding: 14px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
    }

    .slot-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .slot-time {
      font-size: 16px;
      font-weight: 900;
      color: #0f172a;
      font-family: monospace;
    }

    .slot-tag {
      font-size: 10.5px;
      font-weight: 800;
      color: #4f46e5;
    }

    /* HIGHLIGHT BANNER */
    .banner {
      background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%);
      color: #ffffff;
      border-radius: 16px;
      padding: 20px 22px;
      margin: 18px 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .banner-title {
      font-size: 17px;
      font-weight: 800;
      margin-bottom: 4px;
      color: #ffffff;
    }

    .banner-desc {
      font-size: 12px;
      color: #c7d2fe;
      line-height: 1.5;
    }

    .banner-stat {
      text-align: right;
      border-left: 2px solid rgba(255,255,255,0.15);
      padding-left: 20px;
    }

    .banner-num {
      font-size: 32px;
      font-weight: 900;
      color: #38bdf8;
      line-height: 1;
    }

    .banner-num-lbl {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      margin-top: 4px;
    }

    /* METRICS TABLE */
    .status-table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
      font-size: 11.5px;
    }

    .status-table th {
      background: #f1f5f9;
      color: #475569;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-size: 10px;
      padding: 8px 12px;
      border-bottom: 1.5px solid #cbd5e1;
      text-align: left;
    }

    .status-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #e2e8f0;
      color: #1e293b;
    }

    .status-table tr:last-child td {
      border-bottom: none;
    }

    .status-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .check-icon {
      color: #16a34a;
      font-weight: 900;
      margin-right: 4px;
    }
  </style>
</head>
<body>

  <!-- ================= PAGE 1: COVER ================= -->
  <div class="page cover-page">
    <div>
      <div class="cover-badge">★ Handover Resmi & Laporan Eksklusif Produk</div>
      <h1 class="cover-title">CERITAOBIM STUDIO<br><span>PABRIK KONTEN OTONOM</span></h1>
      <p class="cover-subtitle">
        Buku Panduan Eksekutif & Laporan Sistem Produksi Konten Media Sosial Otomatis 24/7. 
        Dirancang khusus untuk menghadirkan kebebasan waktu, konsistensi posting tanpa jeda, 
        dan visual origami stop-motion kelas atas yang memikat algoritma TikTok, YouTube Shorts, & Instagram Reels.
      </p>

      <div class="cover-highlight-box">
        <div class="highlight-grid">
          <div class="highlight-item">
            <div class="highlight-value">1 Hari Kerja</div>
            <div class="highlight-label">Waktu Pemilik per Minggu</div>
          </div>
          <div class="highlight-item">
            <div class="highlight-value">21 Video / Pekan</div>
            <div class="highlight-label">Kapasitas Output Otomatis</div>
          </div>
          <div class="highlight-item">
            <div class="highlight-value">100% Zero-Touch</div>
            <div class="highlight-label">Otomasi Jadwal & Cloud</div>
          </div>
        </div>
      </div>
    </div>

    <div>
      <div class="cover-footer">
        <div>
          <div class="cover-meta-label">Ditujukan Khusus Untuk Klien</div>
          <div class="cover-meta-val">Creator & Social Media Owner CeritaObim</div>
        </div>
        <div>
          <div class="cover-meta-label">Status Sistem & Versi</div>
          <div class="cover-meta-val">Auto-Pilot Cloud Production (Live Deployment)</div>
        </div>
        <div>
          <div class="cover-meta-label">Tanggal Serah Terima</div>
          <div class="cover-meta-val">Senin, 2 November 2026</div>
        </div>
      </div>
    </div>
  </div>

  <!-- ================= PAGE 2: THE REVOLUTION ================= -->
  <div class="page">
    <div>
      <div class="page-header">
        <div class="header-logo">
          <div class="logo-badge">OB</div>
          <div class="logo-text">CeritaObim Studio</div>
        </div>
        <div class="header-tagline">BAB 1: TRANSFORMASI PRODUKSI KONTEN</div>
      </div>

      <span class="section-eyebrow">Selamat Datang di Masa Depan Kreator</span>
      <h2 class="section-title">Selamat Tinggal Lelah Edit Video.<br>Selamat Datang Kebebasan Finansial & Waktu.</h2>
      <p class="section-lead">
        Sebagai pemilik bisnis media sosial, aset terbesar Anda adalah waktu. Anda tidak seharusnya menghabiskan 8 jam sehari di depan laptop hanya untuk memikirkan ide, memotong video, atau mencemaskan jadwal posting. CeritaObim Studio hadir sebagai <b>mesin pencetak konten otonom</b> Anda.
      </p>

      <div class="compare-box">
        <div class="compare-side compare-old">
          <div class="compare-title">❌ Cara Lama (Melelahkan & Rentan Burnout)</div>
          <ul class="compare-list">
            <li>Menghabiskan waktu seharian memotong klip dan mencari backsound.</li>
            <li>Laptop cepat panas dan memori hardisk penuh ratusan gigabyte.</li>
            <li>Sering lupa jadwal upload sehingga jangkauan akun anjlok drastis.</li>
            <li>Stres memikirkan 21 ide baru setiap awal pekan.</li>
            <li>Jika Anda sakit atau liburan, produksi video seketika berhenti.</li>
          </ul>
        </div>

        <div class="compare-side compare-new">
          <div class="compare-title">✨ Cara Baru (CeritaObim Studio Auto-Pilot)</div>
          <ul class="compare-list">
            <li>Nyalakan laptop sehari sekali, jalankan makro 1 klik, lalu tutup kembali.</li>
            <li>Hardisk laptop tetap 100% bersih berkat pembersih file otomatis.</li>
            <li>Konten terjadwal dan tayang sendiri tepat di jam emas penonton.</li>
            <li>Ide naskah dan suara Obim diracik otomatis secara berantai.</li>
            <li>Bisnis sosmed Anda berjalan konsisten 24/7 bahkan saat Anda berlibur.</li>
          </ul>
        </div>
      </div>

      <div class="banner">
        <div>
          <div class="banner-title">🎨 Visual Identitas Unik: Origami Stop-Motion</div>
          <div class="banner-desc">
            Setiap karakter, latar, dan properti tampak nyata dari lipatan kertas kerajinan tangan handmade. 
            Tanpa wajah AI palsu, tanpa kebosanan visual. Membangun diferensiasi kuat yang mudah diingat jutaan pemirsa.
          </div>
        </div>
        <div class="banner-stat">
          <div class="banner-num">100%</div>
          <div class="banner-num-lbl">Khas & Ikonik</div>
        </div>
      </div>

      <div class="grid-3">
        <div class="card card-accent">
          <div class="card-icon">⚡</div>
          <div class="card-title">1 Beban Hari Saja</div>
          <div class="card-desc">Cukup satu hari bebas per minggu untuk mengawasi. Sistem bekerja otomatis di 6 hari sisanya.</div>
        </div>
        <div class="card card-accent">
          <div class="card-icon">📈</div>
          <div class="card-title">Fokus Monetisasi</div>
          <div class="card-desc">Format durasi video (65–80 detik) dioptimalkan khusus untuk monetisasi TikTok Creator Rewards & YouTube.</div>
        </div>
        <div class="card card-accent">
          <div class="card-icon">📱</div>
          <div class="card-title">Mobile-First</div>
          <div class="card-desc">Format rasio 9:16 vertikal sinematik, siap santap di genggaman layar smartphone penonton.</div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>CeritaObim Studio — Panduan Sistem Klien</div>
      <div>Halaman 2 dari 6</div>
    </div>
  </div>

  <!-- ================= PAGE 3: AUTO-PILOT CLOUD FACTORY ================= -->
  <div class="page">
    <div>
      <div class="page-header">
        <div class="header-logo">
          <div class="logo-badge">OB</div>
          <div class="logo-text">CeritaObim Studio</div>
        </div>
        <div class="header-tagline">BAB 2: ARSITEKTUR MESIN PABRIK OTONOM</div>
      </div>

      <span class="section-eyebrow">Teknologi Di Balik Layar Kemudahan Anda</span>
      <h2 class="section-title">Mesin Cerdas Yang Bergerak di Cloud.<br>Laptop Anda Hanyalah Saklar Starter.</h2>
      <p class="section-lead">
        Kami merancang seluruh arsitektur sistem agar Anda tidak bergantung pada laptop mahal yang harus menyala 24 jam. Sistem kami memadukan komputasi awan tercanggih di dunia:
      </p>

      <div class="grid-2">
        <div class="card card-primary">
          <div class="card-icon">🚀</div>
          <div class="card-title">1-Click Master Makro (START ALL)</div>
          <div class="card-desc">
            Cukup buka file <b>Jalankan_Makro_Otomasi.bat</b> di laptop Anda dan tekan angka <b>1</b>. 
            Makro secara cerdas membuatkan klip di 10 akun video sekaligus, mengunduh file hasil, 
            merakit video final, dan langsung memindahkan hasilnya ke Google Drive Anda.
          </div>
        </div>

        <div class="card card-primary">
          <div class="card-icon">🧹</div>
          <div class="card-title">Pembersih Disk Otomatis (Zero-Footprint)</div>
          <div class="card-desc">
            Khawatir memori laptop penuh? Jangan cemas! Begitu video master berhasil dirakit dan diunggah ke Google Drive, 
            <b>sistem langsung menghapus seluruh potongan klip mentah dari hardisk Anda</b>. 
            Laptop Anda hanya menyimpan video yang belum selesai dirakit.
          </div>
        </div>

        <div class="card card-primary">
          <div class="card-icon">🔄</div>
          <div class="card-title">Multi-Akun Cerdas Tanpa Batas Kuota</div>
          <div class="card-desc">
            Sistem dilengkapi teknologi <i>Auto-Rotation</i>. Jika salah satu akun Google Anda menyentuh batas gratisan hari ini, 
            sistem akan <b>otomatis berpindah ke Akun 2, 3, atau 4 di balik layar</b>. Anda tidak perlu repot mengganti akun secara manual!
          </div>
        </div>

        <div class="card card-primary">
          <div class="card-icon">⛓️</div>
          <div class="card-title">Rantai Produksi Berkelanjutan (Auto-Cascade)</div>
          <div class="card-desc">
            Ketika 1 pekan video selesai dibuat, otak AI sistem langsung otomatis menuliskan 21 naskah untuk pekan berikutnya, 
            dan langsung merekam suaranya secara otomatis. Pabrik konten Anda tidak pernah kehabisan amunisi!
          </div>
        </div>
      </div>

      <div class="card card-accent" style="margin-top: 10px;">
        <div class="card-title" style="font-size: 15px; margin-bottom: 8px;">☁️ Integrasi Cloud Kelas Dunia yang Bekerja Untuk Anda</div>
        <div class="grid-3" style="margin-bottom: 0;">
          <div>
            <b style="color: #0f172a;">Vercel & Supabase</b>
            <p style="font-size: 11px; color: #64748b; margin-top: 3px;">Pusat komputasi web dan basis data yang menjaga konten Anda selalu online dan teratur.</p>
          </div>
          <div>
            <b style="color: #0f172a;">Google Drive Pribadi</b>
            <p style="font-size: 11px; color: #64748b; margin-top: 3px;">Seluruh video final dan narasi tersimpan rapi per pekan di folder Google Drive Anda.</p>
          </div>
          <div>
            <b style="color: #0f172a;">Buffer Media Publishing</b>
            <p style="font-size: 11px; color: #64748b; margin-top: 3px;">Jembatan otomatis yang menayangkan video Anda tepat waktu ke TikTok, Shorts, & Reels.</p>
          </div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>CeritaObim Studio — Panduan Sistem Klien</div>
      <div>Halaman 3 dari 6</div>
    </div>
  </div>

  <!-- ================= PAGE 4: SMART BUFFER SCHEDULING ================= -->
  <div class="page">
    <div>
      <div class="page-header">
        <div class="header-logo">
          <div class="logo-badge">OB</div>
          <div class="logo-text">CeritaObim Studio</div>
        </div>
        <div class="header-tagline">BAB 3: STRATEGI PENJADWALAN & ANTI-DUPLIKASI</div>
      </div>

      <span class="section-eyebrow">Algoritma Penjadwalan Cerdas</span>
      <h2 class="section-title">Tayang di Jam Emas Penonton Indonesia.<br>Kapasitas Terkelola Otomatis Tanpa Dobel.</h2>
      <p class="section-lead">
        CeritaObim Studio mengeliminasi keraguan: <i>"Kapan jam terbaik untuk upload konten saya?"</i>. 
        Sistem secara pintar membagi program harian Anda ke dalam 3 slot primetime penonton Indonesia:
      </p>

      <div class="grid-3">
        <div class="slot-card" style="border-top: 4px solid #f59e0b;">
          <div class="slot-header">
            <span class="pill pill-amber">🍳 Kuliner / Sarapan</span>
            <div class="slot-time">08:00 WIB</div>
          </div>
          <div class="card-title">Ke Dapur Yuk!</div>
          <div class="card-desc">
            Sains makanan, rahasia resep, dan fakta kuliner seru untuk menyapa penonton saat sarapan dan perjalanan pagi.
          </div>
        </div>

        <div class="slot-card" style="border-top: 4px solid #10b981;">
          <div class="slot-header">
            <span class="pill pill-green">💡 Fakta Sains</span>
            <div class="slot-time">17:00 WIB</div>
          </div>
          <div class="card-title">Eh, Ternyata!</div>
          <div class="card-desc">
            Fakta sains unik dan mengejutkan yang menghibur saat santai sepulang kerja atau sekolah.
          </div>
        </div>

        <div class="slot-card" style="border-top: 4px solid #6366f1;">
          <div class="slot-header">
            <span class="pill pill-purple">🌙 Overthinking</span>
            <div class="slot-time">20:00 WIB</div>
          </div>
          <div class="card-title">Kepikiran Aja</div>
          <div class="card-desc">
            Topik psikologi menarik, misteri pikiran, dan pertanyaan unik pengantar tidur malam penonton.
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 10px; background: #faf5ff; border: 1.5px solid #e9d5ff;">
        <div class="card-title" style="color: #6b21a8; font-size: 15px; margin-bottom: 8px;">
          🛡️ Fitur Pengamanan: Anti-Duplikasi & Smart Queue Management
        </div>
        <div class="grid-2" style="margin-bottom: 0;">
          <div>
            <b style="color: #0f172a;">Antrean Buffer Maksimal 10 Post</b>
            <p style="font-size: 11.5px; color: #64748b; margin-top: 4px; line-height: 1.45;">
              Paket gratis Buffer membatasi maksimal 10 antrean per channel. Sistem secara otonom mengisi hingga kuota penuh, 
              dan video lainnya menunggu dengan tertib. Begitu 1 video tayang di medsos, video berikutnya <b>otomatis masuk ke antrean</b>!
            </p>
          </div>
          <div>
            <b style="color: #0f172a;">Jaminan Anti-Posting Dobel</b>
            <p style="font-size: 11.5px; color: #64748b; margin-top: 4px; line-height: 1.45;">
              Konten yang sudah masuk jadwal tidak akan pernah bisa dijadwalkan ganda. Jika Anda ingin mengganti jam, 
              cukup tekan tombol <b>Ubah Jadwal</b>, dan sistem langsung menyelaraskan jam tayang di Buffer tanpa membuat dobel post.
            </p>
          </div>
        </div>
      </div>

      <div class="banner" style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); margin-top: 18px;">
        <div>
          <div class="banner-title">🔒 Tombol Aman 'Sudah Tayang'</div>
          <div class="banner-desc">
            Ketika video sudah rilis di medsos, tombol posting otomatis terkunci dengan label <b>Sudah Tayang</b> dan tanda centang hijau. 
            Tidak ada lagi risiko video yang sama terpublish dua kali secara tidak sengaja!
          </div>
        </div>
        <div class="banner-stat" style="border-left-color: rgba(255,255,255,0.2);">
          <div class="banner-num" style="color: #a7f3d0;">100%</div>
          <div class="banner-num-lbl">Aman & Terkunci</div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>CeritaObim Studio — Panduan Sistem Klien</div>
      <div>Halaman 4 dari 6</div>
    </div>
  </div>

  <!-- ================= PAGE 5: TELEGRAM COPILOT ================= -->
  <div class="page">
    <div>
      <div class="page-header">
        <div class="header-logo">
          <div class="logo-badge">OB</div>
          <div class="logo-text">CeritaObim Studio</div>
        </div>
        <div class="header-tagline">BAB 4: KENDALI STUDIO DARI SMARTPHONE</div>
      </div>

      <span class="section-eyebrow">Studio Pribadi di Dalam Saku Anda</span>
      <h2 class="section-title">Kelola Seluruh Akun Sosmed Anda<br>Cukup Melalui Chat Telegram di Ponsel.</h2>
      <p class="section-lead">
        Anda tidak perlu duduk di depan meja kerja untuk mengetahui perkembangan studio Anda. 
        Melalui integrasi <b>Bot Telegram AI Copilot</b>, seluruh kendali operasional berada di genggaman tangan Anda:
      </p>

      <div class="grid-2">
        <div class="card card-accent">
          <div class="card-icon">📱</div>
          <div class="card-title">Pratinjau Video Instan</div>
          <div class="card-desc">
            Setiap video master yang selesai dirakit dapat langsung diputar dan ditinjau langsung di dalam aplikasi Telegram di ponsel Anda.
          </div>
        </div>

        <div class="card card-accent">
          <div class="card-icon">👍</div>
          <div class="card-title">Persetujuan 1-Tap</div>
          <div class="card-desc">
            Suka dengan videonya? Cukup tekan tombol <b>[Setujui Video]</b> di chat bot, dan video seketika meluncur masuk ke jadwal antrean Buffer.
          </div>
        </div>

        <div class="card card-accent">
          <div class="card-icon">✨</div>
          <div class="card-title">Tampilan Ringkas & Bersih</div>
          <div class="card-desc">
            Bot dirancang minimalis dan bersahabat. <b>Tidak ada kode-kode teknis rumit</b> (seperti UUID atau kode database)—hanya menampilkan judul video yang jelas dan on-point!
          </div>
        </div>

        <div class="card card-accent">
          <div class="card-icon">🔐</div>
          <div class="card-title">Keamanan Whitelist Pribadi</div>
          <div class="card-desc">
            Hanya ID Telegram Anda yang memiliki wewenang untuk memberi instruksi. Orang asing yang mencoba chat ke bot akan ditolak otomatis.
          </div>
        </div>
      </div>

      <div class="card" style="margin-top: 15px; border: 1px solid #cbd5e1; background: #f8fafc;">
        <div class="card-title" style="font-size: 14px; margin-bottom: 10px;">💬 Contoh Interaksi Chat Telegram dengan Asisten Obim:</div>
        <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 14px; font-size: 12px; line-height: 1.6;">
          <p style="color: #4f46e5; font-weight: 800; margin-bottom: 4px;">👤 Anda: <i>/status</i></p>
          <p style="color: #1e293b; margin-bottom: 8px;">
            🤖 <b>CeritaObim Bot:</b><br>
            📊 <b>Status Ringkasan Produksi:</b><br>
            • Siap Tayang: <b>18 Video</b><br>
            • Sudah Terbit: <b>2 Video</b><br>
            • Pekan 1: <b>100% Selesai (7/7 Lengkap)</b><br>
            • Antrean Buffer: <b>5/10 slot aktif (5 slot terbuka)</b>
          </p>
          <div style="border-top: 1px dashed #e2e8f0; padding-top: 8px; margin-top: 8px;">
            <p style="color: #4f46e5; font-weight: 800; margin-bottom: 4px;">👤 Anda: <i>/review</i></p>
            <p style="color: #1e293b;">
              🤖 <b>CeritaObim Bot:</b><br>
              🎬 <b>Meninjau Video Baru:</b><br>
              <b>"Kenapa Suara Hujan Bikin Kita Ngantuk?"</b> (28 detik)<br>
              <i>[▶️ Klik untuk tonton video]</i><br>
              [ ✅ Setujui & Jadwalkan ] &nbsp; [ ✍️ Catatan Revisi ]
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>CeritaObim Studio — Panduan Sistem Klien</div>
      <div>Halaman 5 dari 6</div>
    </div>
  </div>

  <!-- ================= PAGE 6: STATUS & CLIENT HANDOVER ================= -->
  <div class="page">
    <div>
      <div class="page-header">
        <div class="header-logo">
          <div class="logo-badge">OB</div>
          <div class="logo-text">CeritaObim Studio</div>
        </div>
        <div class="header-tagline">BAB 5: LAPORAN SERAH TERIMA & STATUS AKTIF</div>
      </div>

      <span class="section-eyebrow">Laporan Kesiapan Produksi</span>
      <h2 class="section-title">Status Sistem Saat Ini: Siap Tempur.<br>Hasil Produksi Nyata Siap Mengudara.</h2>
      <p class="section-lead">
        Berikut adalah inventaris aset dan status kesiapan sistem CeritaObim Studio pada saat serah terima:
      </p>

      <table class="status-table">
        <thead>
          <tr>
            <th>Komponen / Modul</th>
            <th>Kapasitas / Volume</th>
            <th>Status Operasional</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><b>Produksi Pekan 1 (Week 1)</b></td>
            <td>7 dari 7 Video Lengkap</td>
            <td><span class="pill pill-green"><span class="check-icon">✓</span> 100% Siap Rilis</span></td>
          </tr>
          <tr>
            <td><b>Total Video Master Full HD (9:16)</b></td>
            <td>19 Video Master Siap Tayang</td>
            <td><span class="pill pill-green"><span class="check-icon">✓</span> Tersimpan di GDrive</span></td>
          </tr>
          <tr>
            <td><b>Kapasitas Kredit Google Flow</b></td>
            <td>343 Kredit Siap di 10 Profil</td>
            <td><span class="pill pill-blue">~114 Video Baru Siap</span></td>
          </tr>
          <tr>
            <td><b>Kredit Suara ElevenLabs Obim</b></td>
            <td>48.499 Kredit Bulanan</td>
            <td><span class="pill pill-green"><span class="check-icon">✓</span> ~30 Video Full Durasi</span></td>
          </tr>
          <tr>
            <td><b>Integrasi Cloud Vercel & Supabase</b></td>
            <td>Serverless Auto-Pilot 2 Jam</td>
            <td><span class="pill pill-green"><span class="check-icon">✓</span> Live & Terhubung</span></td>
          </tr>
          <tr>
            <td><b>Jalur Penjadwalan Buffer Medsos</b></td>
            <td>TikTok, YouTube, Instagram</td>
            <td><span class="pill pill-green"><span class="check-icon">✓</span> Terhubung & Teruji</span></td>
          </tr>
        </tbody>
      </table>

      <span class="section-eyebrow" style="margin-top: 14px;">Rutinitas Anda (Hanya Butuh 3 Menit Sehari)</span>
      <div class="step-flow">
        <div class="step-box">
          <div class="step-number">1</div>
          <div class="step-title">Nyalakan & Klik 1</div>
          <div class="step-text">Buka file <i>Jalankan_Makro_Otomasi.bat</i>, tekan [1] START ALL di pagi hari.</div>
        </div>
        <div class="step-box">
          <div class="step-number">2</div>
          <div class="step-title">Tutup Laptop</div>
          <div class="step-text">Biarkan makro bekerja. Setelah selesai, tutup laptop Anda. File mentah otomatis dibersihkan.</div>
        </div>
        <div class="step-box">
          <div class="step-number">3</div>
          <div class="step-title">Nikmati Hasilnya</div>
          <div class="step-text">Video otomatis masuk jadwal Buffer, diunggah ke Google Drive, dan tayang tepat waktu!</div>
        </div>
      </div>

      <div class="card card-accent" style="border-left: 4px solid #4f46e5; margin-top: 14px;">
        <div class="card-title" style="font-size: 13.5px; margin-bottom: 4px;">🤝 Komitmen Kualitas & Dukungan Berkelanjutan</div>
        <div class="card-desc" style="font-size: 11.5px;">
          Sistem CeritaObim Studio telah dibangun dengan standar kode TypeScript ketat, arsitektur *self-healing* yang tahan gangguan kuota, 
          dan jaminan kemudahan bagi pemilik bisnis sosial media. Selamat menikmati era baru produksi konten otonom!
        </div>
      </div>
    </div>

    <div class="page-footer">
      <div>CeritaObim Studio — Panduan Sistem Klien</div>
      <div>Halaman 6 dari 6 (Dokumen Resmi Serah Terima)</div>
    </div>
  </div>

</body>
</html>
`;

  const htmlPath = path.resolve(__dirname, '..', 'storage', 'laporan_klien_ceritaobim.html');
  const pdfPath = path.resolve(__dirname, '..', 'Laporan_Produk_CeritaObim_Studio_Autonomous.pdf');

  fs.writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('HTML written to:', htmlPath);

  console.log('Launching browser to render PDF...');
  const browser = await chromium.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
  });

  const page = await browser.newPage();
  await page.goto('file://' + htmlPath.replace(/\\/g, '/'), {
    waitUntil: 'networkidle',
  });

  await page.pdf({
    path: pdfPath,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '0mm',
      bottom: '0mm',
      left: '0mm',
      right: '0mm',
    },
    preferCSSPageSize: true,
  });

  await browser.close();
  console.log('✅ PDF successfully created at:', pdfPath);
  const stats = fs.statSync(pdfPath);
  console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB`);
}

generatePdf().catch(console.error);
