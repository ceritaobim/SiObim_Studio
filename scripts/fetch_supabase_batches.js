/**
 * CeritaObim Studio — Supabase Batch Fetcher
 * 
 * Mengambil antrean konten yang BENAR-BENAR belum diproduksi langsung dari Supabase:
 * - Membaca tabel 'scenes' dengan scene_status = 'prompt_ready'
 * - Memastikan tidak ada 'scene_video' pada tabel 'assets' di Supabase untuk scene tersebut
 * - Mengelompokkan berdasarkan content_id
 * - Membangun naskah prompt presisi tinggi untuk 11 profil Google
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const BATCHES_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'supabase_pending_batches.json');

function loadEnv() {
  const envPath = path.resolve(__dirname, '..', '.env.local');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.local tidak ditemukan di: ' + envPath);
  }
  const raw = fs.readFileSync(envPath, 'utf8');
  const env = {};
  raw.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
  return env;
}

function parseContentNumbers(contentCode) {
  const match = (contentCode || '').match(/CO-(\d{4})-(\d+)/);
  const contentNum = match ? parseInt(match[2], 10) : 1;
  const weekNum = Math.max(1, Math.ceil(contentNum / 7));
  const segmenNum = 3; // Segmen 3: Fakta Unik Si Obim (9:16)
  return { contentNum, weekNum, segmenNum };
}

async function fetchSupabaseBatches(maxBatches = 11, chunkSize = 3) {
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Konfigurasi Supabase URL / Key tidak ditemukan di .env.local');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Ambil semua scene yang statusnya 'prompt_ready'
  const { data: scenes, error: sceneErr } = await supabase
    .from('scenes')
    .select(`
      id,
      content_id,
      scene_index,
      narration_text,
      visual_action,
      scene_status,
      content_items (
        id,
        content_code,
        title,
        category,
        topic,
        narration
      )
    `)
    .eq('scene_status', 'prompt_ready')
    .order('content_id')
    .order('scene_index', { ascending: true });

  if (sceneErr) {
    throw new Error('Gagal mengambil data scenes dari Supabase: ' + sceneErr.message);
  }

  // 2. Ambil aset video yang sudah ada di Supabase untuk memastikan tidak diproduksi ulang
  const { data: assets, error: assetErr } = await supabase
    .from('assets')
    .select('scene_id, content_id')
    .eq('asset_type', 'scene_video');

  const producedSceneIds = new Set((assets || []).map((a) => a.scene_id).filter(Boolean));

  // Filter scene yang benar-benar belum selesai di Supabase
  const unproducedScenes = (scenes || []).filter((s) => !producedSceneIds.has(s.id));

  // 3. Kelompokkan per Content Item
  const grouped = new Map();
  for (const sc of unproducedScenes) {
    const item = sc.content_items;
    if (!item) continue;
    const cid = item.id;
    if (!grouped.has(cid)) {
      grouped.set(cid, {
        item,
        scenes: [],
      });
    }
    grouped.get(cid).scenes.push(sc);
  }

  const batches = [];
  let batchCounter = 1;

  for (const [cid, val] of grouped.entries()) {
    if (batches.length >= maxBatches) break;

    const item = val.item;
    const pendingScenes = val.scenes;
    const { contentNum, weekNum, segmenNum } = parseContentNumbers(item.content_code);

    // Ambil sisa scene sesuai chunkSize (maks 3 per batch)
    const chunk = pendingScenes.slice(0, chunkSize);
    const indices = chunk.map((s) => s.sceneIndex || s.scene_index);
    const partNames = indices.map((idx) => `Bagian ${idx}`).join(', ');
    const hasCoverHook = chunk.some((s) => (s.sceneIndex || s.scene_index) === 1);

    const cleanFilenames = indices.map(
      (idx) => `${segmenNum}_${weekNum}_${contentNum}_${idx}.mp4`
    );

    const outputRequirements = chunk
      .map(
        (sc, n) =>
          ` 1. Klip Bagian ${sc.scene_index} -> TITLE WAJIB: "pzxc_${segmenNum}_${weekNum}_${contentNum}_${sc.scene_index}xx"`
      )
      .join('\n');

    const sceneDescriptions = chunk.map((sc, n) => {
      const idx = sc.scene_index;
      const dur = idx === 3 ? 8 : 10;
      const outputLabel = `pzxc_${segmenNum}_${weekNum}_${contentNum}_${idx}xx`;
      const roleLabel =
        idx === 1
          ? 'THUMBNAIL & COVER HOOK'
          : idx === 2
          ? 'SCIENCE MECHANISM & BREAKDOWN'
          : 'RESOLUTION & DEBATE CTA';

      const visualAction =
        sc.visual_action ||
        `Karakter Obim kertas origami memperagakan adegan secara dinamis dan ekspresif.`;

      if (idx === 1) {
        return [
          `--- [BAGIAN ${idx} / CLIP ${n + 1}] (${roleLabel} • CARD TITLE: "${outputLabel}") ---`,
          ` • VIDEO TITLE PARAMETER : "${outputLabel}" (CRITICAL: Card name MUST be this exact code, DO NOT use descriptive phrases)`,
          ` • Durasi Video : ${dur} detik (9:16 vertikal) • [${roleLabel}]`,
          ` • Properti Kertas Topik : Properti kertas origami lipat bertema ${item.title}`,
          ` • Pose & Karakter Obim : Obim berpose ekspresif dan ramah`,
          ` • Visual Origami Action : [${outputLabel}] ${visualAction}. (PENTING: Karakter Obim TIDAK BOLEH berbicara atau menggerakkan bibir/mulut! Mulut tertutup rapat, ekspresi murni dari gerakan mata dan tubuh. NO mouth movement, NO lip sync, NO dialogue).`,
          ` • Audio & SFX Directive : DILARANG ADA MUSIK (NO BGM, NO MUSIC)! Dilarang ada suara sepanjang video. Detik 0-3 dan 7-10 WAJIB HENING TOTAL (Dead Silence). Hanya boleh ada SATU efek suara benda pendek (<1 detik) di detik ke-5 (misal 'pop' halus), lalu langsung senyap total agar saat video disambung tidak ada audio yang terpotong kasar. JIKA RAGU: Hasilkan video yang 100% HENING / MUTE tanpa suara!`,
          ` • Lingkungan Diorama : Diorama studio kertas stop-motion matte`,
          ` • Konteks Topik Adegan : ${sc.narration_text}`,
          ` • KINETIC HOOK SPECS : KLIP VIDEO vertikal 9:16 aksi kinetik stop-motion kertas origami langsung di detik pertama (in-media-res). DILARANG menggunakan papan nama/banner/teks kaku. NO subtitles, NO text on screen, NO speech.`,
        ].join('\n');
      }

      return [
        `--- [BAGIAN ${idx} / CLIP ${n + 1}] (${roleLabel} • CARD TITLE: "${outputLabel}") ---`,
        ` • VIDEO TITLE PARAMETER : "${outputLabel}" (CRITICAL: Card name MUST be this exact code, DO NOT use descriptive phrases)`,
        ` • Durasi Video : ${dur} detik (9:16 vertikal) • [${roleLabel}]`,
        ` • Properti Kertas Topik : Properti kertas origami lipat bertema ${item.title}`,
        ` • Pose & Karakter Obim : Obim berpose ekspresif dan ramah`,
        ` • Visual Origami Action : [${outputLabel}] ${visualAction} (100% handmade folded matte origami paper stop-motion, 9:16 vertical, NO subtitles, NO text on screen. PENTING: Karakter DILARANG berbicara/lip sync, mulut tertutup rapat, NO mouth movement, NO speech).`,
        ` • Audio & SFX Directive : DILARANG ADA MUSIK (NO BGM, NO MUSIC)! Dilarang ada suara sepanjang video. Detik 0-3 dan 7-10 WAJIB HENING TOTAL (Dead Silence). Hanya boleh ada SATU efek suara benda pendek (<1 detik) di detik ke-5 (misal 'pop' halus), lalu langsung senyap total agar saat video disambung tidak ada audio yang terpotong kasar. JIKA RAGU: Hasilkan video yang 100% HENING / MUTE tanpa suara!`,
        ` • Lingkungan Diorama : Diorama studio kertas stop-motion matte`,
        ` • Konteks Topik Adegan : ${sc.narration_text}`,
      ].join('\n');
    });

    const promptText = [
      `[CRITICAL DIRECTIVE FOR GOOGLE FLOW AI AGENT — SET EXACT CARD TITLES]`,
      `IMPORTANT: When invoking the video generation tool, you MUST pass the parameter title EXACTLY as specified below.`,
      `NEVER use English descriptive phrases as card titles (e.g. NEVER use "Papercraft boy...", "Boy waving...", "Paper boy...").`,
      `The card title MUST BE strictly the exact short code below:`,
      outputRequirements,
      ``,
      `=== BATCH VIDEO GENERATOR — CERITAOBIM STUDIO ===`,
      `Content Code : ${item.content_code}`,
      `Judul Konten : ${item.title}`,
      `Topik : ${item.category || item.topic || 'Biologi & Sains Unik'}`,
      `Format Video : Vertical 9:16 (1080x1920) Stop-Motion Origami Kertas (Model: Veo 3.1 - Lite / Omni 1.1 Flash)`,
      ``,
      `[INSTRUKSI INDEPENDENSI KONTEN — TIDAK TERKAIT DENGAN VIDEO SEBELUMNYA]`,
      `PERHATIAN: Batch ini adalah KONTEN BARU yang 100% INDEPENDEN. DILARANG melanjutkan atau menghubungkan cerita, latar belakang, dan topik dari video-video yang pernah di-generate sebelumnya dalam proyek ini.`,
      `Satu-satunya elemen yang dipertahankan hanyalah karakter utama (@obim.jpg) origami anak laki-laki berkemeja merah kotak-kotak sebagai figur sentral.`,
      ``,
      `[ATURAN PENAMAAN OUTPUT WAJIB — KODE PREFIX pzxc_ & SEPARATOR xx]`,
      `PENTING & KRUSIAL: Setiap video yang dihasilkan WAJIB dinamai dan diberi label HANYA menggunakan kode singkat berikut:`,
      outputRequirements,
      `- Format Kode: pzxc_[Segmen]_[Week]_[Konten]_[Bagian]xx`,
      `- Contoh: "pzxc_${segmenNum}_${weekNum}_${contentNum}_${indices[0]}xx"`,
      `- DILARANG menambahkan judul artikel atau kata lain pada nama output. HANYA gunakan kode singkat di atas!`,
      ``,
      `[ATURAN MODEL AI & DURASI WAJIB — VEO 3.1 - LITE / OMNI 1.1 FLASH]`,
      `- Model AI Video: Gunakan Veo 3.1 - Lite (atau Omni 1.1 Flash) dengan format vertikal 9:16 (mendukung durasi resmi 10 detik dan 8 detik).`,
      `- Durasi Output: Setiap video memiliki durasi resmi 10 detik (atau 8 detik pada adegan penutup).`,
      `- Kelanjutan Visual: Jika ucapan narasi selesai lebih awal dari durasi klip, karakter origami tetap bergerak dan berpose natural hingga durasi video selesai.`,
      ``,
      `[ATURAN TEMPO TINGGI & ANTI-SLOW MOTION — RETENSI TINGGI 9:16]`,
      `- ZERO SLOW-MOTION & ZERO LAZY DRIFT: Video DILARANG KERAS bergerak lambat, malas, atau melayang santai yang membuat penonton scroll sebelum video selesai!`,
      `- HIGH-SPEED CRISP STOP-MOTION: Seluruh objek origami harus bergerak lincah, berkecepatan tinggi, dan berenergi dengan animasi snap-motion lipatan kertas yang meletup sigap (crisp, fast-paced tactile pop-up folding).`,
      `- DYNAMIC CAMERA IN-MOTION: Kamera vertikal 9:16 WAJIB aktif bergerak (fast snap-zoom in, macro dolly-in, whip-pan transisi kilat, dynamic tracking) dengan perubahan fokus visual cepat setiap 1.5 detik.`,
      `- DETIK 0-1.3 INSTANT HOOK: Khusus Bagian 1, frame pertama detik 0.0 WAJIB langsung menghentak dengan kejutan aksi fisik origami ke arah layar untuk mengunci perhatian penonton sejak detik pertama!`,
      ``,
      `[ATURAN VISUAL, THUMBNAIL & KARAKTER WAJIB]`,
      `- Gaya Visual: Handmade origami paper stop-motion, 100% lipatan kertas matte tanpa orang/objek realistis.`,
      `- Karakter Obim: Karakter anak laki-laki origami memakai kemeja flanel merah kotak-kotak dan celana biru.`,
      hasCoverHook
        ? `- High-Impact Visual Hook: Bagian 1 WAJIB berupa KLIP VIDEO aksi kinetik stop-motion kertas origami langsung di detik pertama (in-media-res).`
        : `- High-Impact Visual Hook: Tidak diperlukan pada batch ini (Bagian 1 sudah selesai di-generate).`,
      `- Aturan Bagian Lain: 100% dunia lipatan kertas origami stop-motion murni (handmade folded matte paper). DILARANG menampilkan subtitle, teks di layar, huruf, watermark, banner, atau manusia/objek realistis (NO subtitles, NO text on screen).`,
      `- Kontinuitas: Jaga konsistensi pakaian karakter Obim, proporsi lipatan kertas, dan pencahayaan antar bagian secara berurutan.`,
      ``,
      `[ATURAN AUDIO & EFEK SUARA (SFX) WAJIB — DILARANG MUSIK & SUARA SEPANJANG VIDEO]`,
      `- DILARANG KERAS BACKGROUND MUSIC: NO BGM, NO MUSIC, NO MELODY, NO DRONE, NO AMBIENT SOUNDTRACK! Sama sekali tidak boleh ada musik atau instrumen pengiring latar!`,
      `- DILARANG SUARA SEPANJANG VIDEO: Suara efek TIDAK BOLEH berjalan terus-menerus di sepanjang klip video. Karena seluruh bagian video ini nantinya akan disatukan menjadi video utuh di studio, suara yang terus-menerus akan menyebabkan transisi kontras kasar (tiba-tiba muncul atau tiba-tiba terpotong).`,
      `- HANYA EFEK SUARA PENDEK (0.5 - 1.0 DETIK SAJA): Di pertengahan adegan (detik ke-4 atau 5), HANYA boleh ada SATU bunyi efek fisik benda nyata yang sangat singkat (misal bunyi 'pop' lipatan kertas atau 'klik' halus 0.5s), lalu seketika senyap total.`,
      `- AWAL & AKHIR WAJIB HENING (DEAD SILENCE): Detik 0-3 dan detik 7-10 WAJIB HENING TOTAL tanpa suara apa pun.`,
      `- ZERO SPEECH, ZERO LIP SYNC: DILARANG KERAS karakter berbicara, membuka mulut, menggerakkan bibir, atau mengeluarkan suara vokal/kata apa pun! Mulut karakter WAJIB selalu terkatup rapat (CLOSED MOUTH). Dubbing narasi Obim dipasang terpisah di studio.`,
      `- REKOMENDASI TERBAIK / JIKA RAGU: Hasilkan video yang 100% HENING / MUTE tanpa suara sama sekali!`,
      ``,
      `[DAFTAR ${chunk.length} BAGIAN SCENE YANG HARUS DIKERJAKAN PADA SESI INI]`,
      ...sceneDescriptions,
      ``,
      chunk.length === 1
        ? `[INSTRUKSI EKSEKUSI FINAL — KERJAKAN 1 BAGIAN DENGAN TITLE PERSIS]\nKerjakan 1 bagian di atas (Bagian ${indices[0]}) menggunakan model Veo 3.1 - Lite (atau Omni 1.1 Flash) dalam bentuk 1 KLIP VIDEO vertikal 9:16 stop-motion origami kertas.\nKlip video yang dihasilkan WAJIB diset title parameter-nya HANYA menggunakan kode persis berikut:\n${outputRequirements}`
        : `[INSTRUKSI EKSEKUSI FINAL — KERJAKAN ${chunk.length} BAGIAN SEKALIGUS DENGAN TITLE PERSIS]\nKerjakan ${chunk.length} bagian di atas (${partNames}) SEKALIGUS menggunakan model Veo 3.1 - Lite (atau Omni 1.1 Flash) dalam bentuk ${chunk.length} KLIP VIDEO vertikal 9:16 stop-motion origami kertas.\nSetiap klip video yang dihasilkan WAJIB diset title parameter-nya HANYA menggunakan kode persis berikut:\n${outputRequirements}`,
      ``,
      `Gunakan aset referensi origami berikut sebagai karakter pemeran utama:`,
    ].join('\n');

    batches.push({
      batchIndex: batchCounter++,
      contentId: item.id,
      contentCode: item.content_code,
      title: item.title,
      category: item.category,
      topic: item.topic,
      sceneIndices: indices,
      sceneCount: chunk.length,
      cleanFilenames,
      promptText,
    });
  }

  // Simpan ke storage/macro
  const dir = path.dirname(BATCHES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(BATCHES_FILE, JSON.stringify(batches, null, 2), 'utf8');

  return batches;
}

if (require.main === module) {
  fetchSupabaseBatches(11)
    .then((batches) => {
      console.log(`\n✅ BERHASIL MENGAMBIL ${batches.length} BATCH DARI SUPABASE UNTUK 11 PROFIL:`);
      batches.forEach((b) => {
        console.log(`   [Profil ${b.batchIndex}] [${b.contentCode}] ${b.title} (${b.sceneIndices.map((i) => 'Bagian ' + i).join(', ')})`);
      });
    })
    .catch((err) => {
      console.error('❌ Error fetch Supabase:', err.message);
    });
}

module.exports = { fetchSupabaseBatches };
