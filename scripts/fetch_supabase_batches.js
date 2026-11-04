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

    const sceneInstructions = chunk.map((sc) => {
      const idx = sc.scene_index;
      const dur = idx === 3 ? 8 : 10;
      const outputLabel = `pzxc_${segmenNum}_${weekNum}_${contentNum}_${idx}xx`;
      const visualAction = sc.visual_action || `Karakter Obim kertas origami memperagakan adegan secara dinamis dan ekspresif.`;

      return [
        `Klip Bagian ${idx} (WAJIB Parameter Title: "${outputLabel}", Durasi: ${dur} detik, Vertikal 9:16):`,
        `Aksi Visual: [${outputLabel}] ${visualAction} (100% stop-motion kertas origami, tanpa subtitle/teks di layar, mulut terkatup rapat, hening/mute tanpa BGM).`
      ].join('\n');
    }).join('\n\n');

    const promptText = [
      `Buatkan ${chunk.length} video vertikal 9:16 model Veo 3.1 stop-motion kertas origami karakter @obim.jpg untuk konten baru: "${item.title}" (${item.content_code}).`,
      `Ketentuan Wajib: 100% handmade matte paper stop-motion, hening/mute tanpa musik (NO BGM), mulut karakter tertutup rapat (NO lip-sync/speech), dan tanpa teks/subtitle di layar. Konten ini baru dan independen dari video sebelumnya.`,
      ``,
      `PENTING & KRUSIAL: Saat memanggil tool generate video, Anda WAJIB mengisi parameter title setiap kartu HANYA dengan kode persis berikut:`,
      ``,
      sceneInstructions,
      ``,
      `Gunakan aset referensi origami berikut sebagai pemeran utama:`,
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
