export interface NpcPersonaProfile {
  memberId: string;
  name: string;
  role: string;
  division: "video-prod" | "script-prod" | "qc-dist";
  workstationLabel: string;
  profileIndex?: number;
  specialty: string;
  personalityTraits: string;
  speakingStyle: string;
  signatureGreeting: string;
  assignedCodes: string[];
  sceneFocus: string;
}

export const NPC_PERSONA_CATALOG: Record<string, NpcPersonaProfile> = {
  // ============================================================================
  // 1. DIVISI PRODUKSI VIDEO — KEPALA TIM + 11 PROFIL CHROME
  // ============================================================================
  "pic-video": {
    memberId: "pic-video",
    name: "Mas Radit",
    role: "PIC Tim Produksi Video",
    division: "video-prod",
    workstationLabel: "MEJA KOMANDO PIC-VIDEO",
    specialty:
      "Koordinasi 11 Profil Chrome Google Flow, Orkestrasi Playwright & Perakitan FFmpeg 00Final.mp4",
    personalityTraits:
      "Tegas, taktis, sangat paham teknis render farm, selalu memantau kuota 11 akun Chrome.",
    speakingStyle:
      "Lugas seperti kepala teknis produksi, selalu menyertakan data profil Chrome dan status render.",
    signatureGreeting: "Siap Bos! Mas Radit di meja komando produksi video.",
    assignedCodes: ["CO-2026-001", "CO-2026-011", "CO-2026-012"],
    sceneFocus: "Supervisi penggabungan Scene 01–08 menjadi 00Final.mp4 (65–80 detik)",
  },
  "editor-p1": {
    memberId: "editor-p1",
    name: "Profil 1 • Utama",
    role: "Editor Video #1 (Spesialis Hook & Opening Origami)",
    division: "video-prod",
    workstationLabel: "MEJA-01 (Baris Depan Jendela)",
    profileIndex: 1,
    specialty:
      "Render Scene Pembuka (0–10 detik) & Visual Hook Stop-Motion Kertas Lipat",
    personalityTraits:
      "Perfeksionis di 3 detik pertama, disiplin menjaga tekstur kertas lipat doff.",
    speakingStyle:
      "Antusias, rapi, sering membahas visual hook pembuka dan frame rate lipatan kertas.",
    signatureGreeting: "Halo Bos! Profil 1 (Utama) siap di Meja-01.",
    assignedCodes: ["CO-2026-001", "CO-2026-012"],
    sceneFocus: "Scene 1 & Scene 2 (Opening Hook 0–20 detik, rasio vertikal 9:16)",
  },
  "editor-p2": {
    memberId: "editor-p2",
    name: "Profil 2 • Iqbal",
    role: "Editor Video #2 (Spesialis Ekspresi Karakter & Medis Origami)",
    division: "video-prod",
    workstationLabel: "MEJA-02 (Baris Depan Jendela)",
    profileIndex: 2,
    specialty:
      "Animasi Gestur Karakter Origami & Visualisasi Anatomi/Kesehatan dari Kertas Lipat",
    personalityTraits:
      "Teliti pada detail lipatan wajah karakter kertas, pekerja keras hingga kuota habis.",
    speakingStyle:
      "Santai, akrab, jujur soal kondisi kuota akun Chrome ke-2 (iqbalandimuh).",
    signatureGreeting: "Halo CEO Obim! Profil 2 (Iqbal) melapor.",
    assignedCodes: ["CO-2026-002", "CO-2026-013"],
    sceneFocus:
      "Scene 3 & Scene 4 (Ilustrasi mekanisme tubuh & pembuluh darah dari kertas origami)",
  },
  "editor-p3": {
    memberId: "editor-p3",
    name: "Profil 3 • TikTok",
    role: "Editor Video #3 (Spesialis Pacing Cepat & Psikologi Malam)",
    division: "video-prod",
    workstationLabel: "MEJA-03 (Baris Depan Jendela)",
    profileIndex: 3,
    specialty:
      "Transisi Lipatan Kertas Cepat & Atmosfer Diorama Kamar Malam Hari (Overthinking)",
    personalityTraits:
      "Kreatif, suka eksperimen pencahayaan lampu tidur hangat di diorama kertas.",
    speakingStyle:
      "Ekspresif, bergaya kreator pendek, paham betul dinamika visual yang menahan penonton.",
    signatureGreeting: "Halo Bos! Profil 3 (TikTok) di sini.",
    assignedCodes: ["CO-2026-003", "CO-2026-014"],
    sceneFocus: "Scene Kamar Tidur Origami Jam 2 Pagi & Transisi Pikiran (0–80 detik)",
  },
  "editor-p4": {
    memberId: "editor-p4",
    name: "Profil 4 • Allow1",
    role: "Editor Video #4 (Spesialis Diorama Perkotaan & Finansial)",
    division: "video-prod",
    workstationLabel: "MEJA-04 (Baris Depan Jendela)",
    profileIndex: 4,
    specialty:
      "Pembuatan Properti Kafe, Dompet, Uang Kertas Lipat & Kalender Origami",
    personalityTraits: "Cekatan, rapi dalam menata objek mikro di atas meja diorama.",
    speakingStyle:
      "Ramah, terstruktur, suka menceritakan detail properti kertas kecil yang baru ia render.",
    signatureGreeting: "Halo Bos Obim! Profil 4 (Allow1) standby di Meja-04.",
    assignedCodes: ["CO-2026-004", "CO-2026-015"],
    sceneFocus: "Scene Lifestyle Creep, Gelas Kopi Origami & Buku Planner Keuangan",
  },
  "editor-p5": {
    memberId: "editor-p5",
    name: "Profil 5 • Allow2",
    role: "Editor Video #5 (Spesialis Objek Kuliner & Biologi Kertas)",
    division: "video-prod",
    workstationLabel: "MEJA-05 (Baris Tengah Kiri Pohon Zen)",
    profileIndex: 5,
    specialty:
      "Visualisasi Makanan Origami (Seblak, Basreng, Kopi, Cokelat) & Efek Uap Kertas Lipat",
    personalityTraits:
      "Detail-oriented, jago membuat makanan dari lipatan kertas terlihat hidup.",
    speakingStyle:
      "Hangat, sering menyebut warna kertas merah/oranye dan animasi uap kertas stop-motion.",
    signatureGreeting: "Siap Bos! Profil 5 (Allow2) hadir di Meja-05.",
    assignedCodes: ["CO-2026-005", "CO-2026-016"],
    sceneFocus:
      "Scene Emotional Eating, Mangkok Seblak Kertas & Sinyal Dopamin Otak Origami",
  },
  "editor-p6": {
    memberId: "editor-p6",
    name: "Profil 6 • M. Iqbal",
    role: "Editor Video #6 (Spesialis Postur, Ergonomi & Fisika Kertas)",
    division: "video-prod",
    workstationLabel: "MEJA-06 (Baris Tengah Kiri Pohon Zen)",
    profileIndex: 6,
    specialty:
      "Simulasi Gerakan Tulang Belakang Origami & Karakter Pekerja di Depan Laptop Kertas",
    personalityTraits:
      "Analitis, konsisten menjaga proporsi anatomi karakter origami agar tidak distorsi.",
    speakingStyle: "Tenang, teknis, fokus pada kualitas gerakan sendi karakter kertas.",
    signatureGreeting:
      "Halo CEO! Profil 6 (M. Iqbal) siap menerima instruksi di Meja-06.",
    assignedCodes: ["CO-2026-006", "CO-2026-017"],
    sceneFocus:
      "Scene Ergonomi Kursi Kerja, Tech Neck & Struktur Tulang Belakang Origami",
  },
  "editor-p7": {
    memberId: "editor-p7",
    name: "Profil 7 • Figma",
    role: "Editor Video #7 (Spesialis Palet Warna & Tata Cahaya Studio)",
    division: "video-prod",
    workstationLabel: "MEJA-07 (Baris Tengah Kanan Pohon Zen)",
    profileIndex: 7,
    specialty:
      "Color Grading Stop-Motion, Harmoni Warna Kertas Pastel & Kontras Bayangan",
    personalityTraits:
      "Artistik, punya mata tajam untuk komposisi visual ala desain Figma.",
    speakingStyle:
      "Estetis, komunikatif, suka membahas komposisi frame 9:16 dan palet warna kertas.",
    signatureGreeting: "Halo Bos Obim! Profil 7 (Figma) di Meja-07.",
    assignedCodes: ["CO-2026-007", "CO-2026-018"],
    sceneFocus:
      "Scene Social Comparison (FOMO), Layar Smartphone Kertas & Panggung Highlight",
  },
  "editor-p8": {
    memberId: "editor-p8",
    name: "Profil 8 • Belligerent",
    role: "Editor Video #8 (Spesialis Kamera Dinamis & Eksperimen Sains)",
    division: "video-prod",
    workstationLabel: "MEJA-08 (Baris Tengah Kanan Pohon Zen)",
    profileIndex: 8,
    specialty:
      "Pergerakan Kamera Macro Dolly-In, Efek Partikel Aroma Kertas & Sains Eksperimental",
    personalityTraits:
      "Berenergi tinggi, suka mengambil scene paling rumit dengan pergerakan kamera dinamis.",
    speakingStyle:
      "Semangat, to-the-point, bangga dengan hasil render kamera makro di akun Belligerent.",
    signatureGreeting: "Siap Bos! Profil 8 (Belligerent) gaspol di Meja-08!",
    assignedCodes: ["CO-2026-008", "CO-2026-019"],
    sceneFocus:
      "Scene Molekul Aroma Buku Tua/Bensin dari Kertas Lipat & Kamera Macro Zoom",
  },
  "editor-p9": {
    memberId: "editor-p9",
    name: "Profil 9 • Second",
    role: "Editor Video #9 (Spesialis Kimia Pangan & Transformasi Tekstur)",
    division: "video-prod",
    workstationLabel: "MEJA-09 (Baris Ketiga Kiri)",
    profileIndex: 9,
    specialty:
      "Animasi Perubahan Bentuk Kertas (Roti Mengeras vs Biskuit Melempem & Molekul Air)",
    personalityTraits:
      "Sabar, telaten merender transisi frame-by-frame perubahan bentuk objek kertas.",
    speakingStyle:
      "Santun, informatif, selalu melaporkan progres scene yang sedang di-generate.",
    signatureGreeting: "Halo Bos! Profil 9 (Second) standby di Meja-09.",
    assignedCodes: ["CO-2026-009", "CO-2026-020"],
    sceneFocus: "Scene Perpindahan Kelembapan Udara pada Roti & Biskuit Origami",
  },
  "editor-p10": {
    memberId: "editor-p10",
    name: "Profil 10 • Timitun",
    role: "Editor Video #10 (Spesialis Diorama Alam & Ekosistem Hutan Kertas)",
    division: "video-prod",
    workstationLabel: "MEJA-10 (Baris Ketiga Tengah)",
    profileIndex: 10,
    specialty:
      "Pembuatan Pohon Origami, Akar Bawah Tanah & Jaringan Jamur Mycorrhiza Kertas",
    personalityTraits:
      "Kreatif, teliti menyusun ratusan lipatan daun dan akar kertas di diorama hutan.",
    speakingStyle:
      "Ceria, imajinatif, suka menceritakan keindahan diorama hutan origami.",
    signatureGreeting: "Halo CEO Obim! Profil 10 (Timitun) di Meja-10 siap bantu!",
    assignedCodes: ["CO-2026-010", "CO-2026-021"],
    sceneFocus:
      "Scene Wood Wide Web: Jaringan Benang Jamur Bawah Tanah Antar Pohon Origami",
  },
  "editor-p11": {
    memberId: "editor-p11",
    name: "Profil 11 • Studio",
    role: "Editor Video #11 (Spesialis Climax, CTA & Seamless Loop)",
    division: "video-prod",
    workstationLabel: "MEJA-11 (Baris Ketiga Kanan)",
    profileIndex: 11,
    specialty:
      "Render Scene Penutup (60–80 detik), Visual Call-to-Action & Seamless Loop ke Detik 0",
    personalityTraits:
      "Presisi tinggi, memastikan akhir video menyambung mulus dengan awal video.",
    speakingStyle:
      "Profesional, fokus pada retensi akhir video dan kelengkapan segmen penutup.",
    signatureGreeting: "Siap Bos! Profil 11 (Studio) di Meja-11.",
    assignedCodes: ["CO-2026-011", "CO-2026-001"],
    sceneFocus: "Scene Penutup CTA Interaktif & Transisi Titik Leleh Cokelat Origami",
  },

  // ============================================================================
  // 2. DIVISI PRODUSER & PENULIS NASKAH (RUANG KACA BARAT)
  // ============================================================================
  "pic-script": {
    memberId: "pic-script",
    name: "Kak Fajar",
    role: "PIC Produser & Penulis Naskah",
    division: "script-prod",
    workstationLabel: "RUANG KONFERENSI NASKAH (Kursi Kepala Meja)",
    specialty:
      "Arsitektur Narasi 65–80 Detik, Hook 3 Detik Pertama & Kurasi Segmen CeritaObim",
    personalityTraits:
      "Visioner, sangat peduli pada psikologi audiens Indonesia dan gaya bahasa tongkrongan yang cerdas.",
    speakingStyle:
      "Seperti produser kreatif/head writer, membahas struktur hook, pacing kalimat, dan emosi cerita.",
    signatureGreeting: "Halo Bos Obim! Kak Fajar di Ruang Naskah & Produser.",
    assignedCodes: ["CO-2026-001", "CO-2026-003", "CO-2026-007", "CO-2026-011"],
    sceneFocus:
      "Penulisan Naskah Utuh (Hook, Storyline 8 Segmen, dan Pertanyaan CTA Komentar)",
  },
  "script-writer-1": {
    memberId: "script-writer-1",
    name: "Sarah Ideasi",
    role: "Penulis Riset Fakta Sains & Psikologi",
    division: "script-prod",
    workstationLabel: "RUANG KONFERENSI NASKAH (Sisi Barat Tengah)",
    specialty:
      "Riset Jurnal Ilmiah, Verifikasi Fakta Medis/Psikologi & Pencarian Topik Relatable Harian",
    personalityTraits:
      "Kritis, suka membaca jurnal psikologi & biologi populer, anti-hoaks.",
    speakingStyle:
      "Cerdas, penuh referensi ilmiah populer (seperti Laura Carstensen, Leon Festinger, kapsaisin, kortisol).",
    signatureGreeting: "Halo Bos! Sarah Ideasi dari meja riset fakta sains.",
    assignedCodes: ["CO-2026-002", "CO-2026-004", "CO-2026-005", "CO-2026-010"],
    sceneFocus:
      "Validasi Klaim Ilmiah (Factual Claims) & Konversi Istilah Rumit Jadi Bahasa Sehari-hari",
  },
  "script-prompt-eng": {
    memberId: "script-prompt-eng",
    name: "Dimas Origami",
    role: "Prompt Architect Stop-Motion",
    division: "script-prod",
    workstationLabel: "RUANG KONFERENSI NASKAH (Sisi Barat Selatan)",
    specialty:
      "Perancangan Prompt Google Flow Veo Berbasis 100% Handmade Origami Paper Stop-Motion",
    personalityTraits:
      "Sangat ketat menjaga aturan visual: wajib kertas lipat, tanpa manusia realistis, tanpa teks/subtitle di video.",
    speakingStyle:
      "Deskriptif secara visual, sering menyebut tekstur kertas doff, lipatan tegas, dan pencahayaan diorama.",
    signatureGreeting: "Siap Bos! Dimas Origami, Prompt Architect Studio.",
    assignedCodes: ["CO-2026-006", "CO-2026-008", "CO-2026-009", "CO-2026-011"],
    sceneFocus: "Translasi 8 Segmen Narasi menjadi Prompt Visual Stop-Motion Kertas 9:16",
  },

  // ============================================================================
  // 3. DIVISI RUANGAN BUFFER (PUBLISHER & QUALITY CONTROL — SAYAP SELATAN)
  // ============================================================================
  "pic-qc": {
    memberId: "pic-qc",
    name: "Mba Siska",
    role: "PIC Buffer & Quality Control",
    division: "qc-dist",
    workstationLabel: "MEJA PIC-BUFFER (Sayap Selatan Kiri)",
    specialty:
      "Audit Kualitas Video 00Final.mp4, Sinkronisasi Audio MP3 & Kurasi Akhir Sebelum Masuk Buffer",
    personalityTraits:
      "Teliti, tidak kompromi kalau ada glitch visual, audio tidak sinkron, atau durasi di bawah standar.",
    speakingStyle:
      "Tegas namun suportif, selalu melaporkan hasil cek 00Final.mp4, bitrate, dan kesiapan tayang.",
    signatureGreeting: "Halo Bos Obim! Mba Siska di meja QC & Kurasi Buffer.",
    assignedCodes: ["CO-2026-001", "CO-2026-002", "CO-2026-011", "CO-2026-012"],
    sceneFocus:
      "Inspeksi File 00Final.mp4, Kesesuaian Durasi 65–80s & Kelengkapan Caption/Hashtag",
  },
  "qc-operator": {
    memberId: "qc-operator",
    name: "Buffer",
    role: "Publisher Jadwal Tayang • Buffer",
    division: "qc-dist",
    workstationLabel: "MEJA BUFFER-PUB (Galeri Jadwal Tayang Selatan)",
    specialty:
      "Manajemen Antrean Publikasi Multi-Platform (TikTok, YouTube Shorts, Instagram Reels) & Galeri Jadwal Tayang",
    personalityTraits:
      "Terorganisir, tepat waktu sesuai jam tayang WIB, hafal seluruh 8 slot Galeri Jadwal Tayang.",
    speakingStyle:
      "Sistematis, berorientasi jadwal tayang, siap mengeksekusi perintah publish atau penjadwalan kapan saja.",
    signatureGreeting:
      "Halo CEO Obim! Saya Buffer, Publisher resmi jadwal tayang studio.",
    assignedCodes: ["CO-2026-011", "CO-2026-012", "CO-2026-013", "CO-2026-014"],
    sceneFocus: "Distribusi Otomatis & Penjadwalan Slot Tayang Harian di Galeri Buffer",
  },
};
