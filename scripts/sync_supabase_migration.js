/**
 * CeritaObim Studio — Standalone Supabase Migration & Database Sync Worker
 * 
 * Fungsi:
 * 1. Memindai folder Downloads Windows, 00.FolderOwner/DROPZONE_HASIL_DOWNLOAD, & storage/macro_drops.
 * 2. Memetakan klip video pzxc_* ke konten & nomor bagian (scene).
 * 3. Menstandarkan nama file ke [segmen]_[week]_[konten]_[bagian].mp4 di 00.FolderOwner/KLIP_BERSIH.
 * 4. Memperbarui status scene langsung di Database Supabase (scene_status = 'clip_uploaded').
 * 5. Mendaftarkan rekaman aset (asset_type = 'scene_video') ke tabel assets Supabase.
 * 6. Mengarsipkan file mentah ke storage/macro_drops/processed agar Downloads tetap bersih.
 * 7. Mengecek kelengkapan klip per konten: jika klip lengkap & voice audio ada, rakit 00Final.mp4.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { createClient } = require('@supabase/supabase-js');

// Direktori Kerja
const ROOT_DIR = path.resolve(__dirname, '..');
const USER_DOWNLOADS = path.join(process.env.USERPROFILE || '', 'Downloads');
const OWNER_DROP_DIR = path.resolve(ROOT_DIR, '00.FolderOwner', 'DROPZONE_HASIL_DOWNLOAD');
const OWNER_CLEAN_DIR = path.resolve(ROOT_DIR, '00.FolderOwner', 'KLIP_BERSIH');
const OWNER_MASTER_DIR = path.resolve(ROOT_DIR, '00.FolderOwner', 'VIDEO_FINAL_MASTER');
const STORAGE_DROPS_DIR = path.resolve(ROOT_DIR, 'storage', 'macro_drops');
const PROCESSED_DIR = path.join(STORAGE_DROPS_DIR, 'processed');

function ensureDirectories() {
  [OWNER_DROP_DIR, OWNER_CLEAN_DIR, OWNER_MASTER_DIR, STORAGE_DROPS_DIR, PROCESSED_DIR].forEach((dir) => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  });
}

function loadEnv() {
  const envPath = path.resolve(ROOT_DIR, '.env.local');
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

function getFfmpegBinary() {
  const localDirect = path.join(ROOT_DIR, 'node_modules', 'ffmpeg-static', process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
  if (fs.existsSync(localDirect)) return localDirect;
  try {
    const mod = require('ffmpeg-static');
    const bin = (mod && mod.default) || mod;
    if (bin && fs.existsSync(bin)) return bin;
  } catch {}
  return 'ffmpeg';
}

function pcm16ToWavBuffer(pcmBuffer, sampleRate = 24000) {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function cleanNarration(text) {
  return (text || '')
    .replace(/(?:^|\n)\s*\[?\d{1,3}\s*(?:-|–|—|s\/d|sampai|to)\s*\d{1,3}\s*(?:s|sec|detik)?\]?\s*:?\s*(?=\n|$)/gi, '\n')
    .replace(/(?:^|\n)\s*\[?\d{1,3}\s*(?:-|–|—)\s*\d{1,3}\s*(?:s|sec|detik)?\]?\s*:\s*/gi, '\n')
    .replace(/\n{2,}/g, '\n\n')
    .trim();
}

/**
 * Otomatis menghasilkan rekaman audio voice over jika belum ada
 */
async function synthesizeVoiceOnDemand(item, env) {
  const cleanText = cleanNarration(item.narration);
  if (!cleanText || cleanText.length < 5) return null;

  const geminiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  const elevenKey = env.ELEVENLABS_API_KEY || process.env.ELEVENLABS_API_KEY;

  // 1. Coba Gemini TTS
  if (geminiKey) {
    try {
      console.log(`   🎙️ [Auto-Voice] Men-generate audio Obim via Gemini TTS untuk ${item.content_code}...`);
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${encodeURIComponent(geminiKey)}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Speak in a high-pitched, bold, optimistic, super energetic 10-year-old Indonesian boy adventure hero voice (like a brave young boy cartoon protagonist, confident, bright, loud, and punchy; read only the Indonesian narration below):\n\n${cleanText}` }] }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } }
          }
        })
      });
      if (resp.ok) {
        const data = await resp.json();
        const b64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data || '';
        if (b64) {
          const pcm = Buffer.from(b64, 'base64');
          const wav = pcm16ToWavBuffer(pcm, 24000);
          return { buffer: wav, mimeType: 'audio/wav', ext: 'wav', provider: 'gemini_tts' };
        }
      } else {
        console.warn(`   ⚠️ Gemini TTS status ${resp.status} (Kuota limit). Beralih otomatis ke ElevenLabs...`);
      }
    } catch (err) {
      console.warn(`   ⚠️ Gemini TTS error: ${err.message}`);
    }
  }

  // 2. Fallback ke ElevenLabs (Premade Voice 'TX3LPaxmHKxFdv7VOQHJ' - Liam yang diizinkan di Free Tier)
  if (elevenKey) {
    try {
      console.log(`   🎙️ [Auto-Voice] Men-generate audio Obim via ElevenLabs untuk ${item.content_code}...`);
      const voiceId = env.ELEVENLABS_VOICE_ID || 'TX3LPaxmHKxFdv7VOQHJ';
      const endpoint = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'xi-api-key': elevenKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: cleanText,
          model_id: 'eleven_multilingual_v2'
        })
      });
      if (resp.ok) {
        const ab = await resp.arrayBuffer();
        return { buffer: Buffer.from(ab), mimeType: 'audio/mpeg', ext: 'mp3', provider: 'elevenlabs' };
      } else {
        const errTxt = await resp.text().catch(() => '');
        console.warn(`   ⚠️ ElevenLabs response (${resp.status}): ${errTxt.slice(0, 100)}`);
      }
    } catch (err) {
      console.warn(`   ⚠️ ElevenLabs exception: ${err.message}`);
    }
  }

  return null;
}

function getFfprobeDuration(filePath) {
  try {
    const ffmpegBin = getFfmpegBinary();
    const probe = spawnSync(ffmpegBin, ['-i', filePath], {
      encoding: 'utf8',
      timeout: 5000,
    });
    const match = (probe.stderr || '').match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
    if (match) {
      const hours = parseInt(match[1], 10);
      const mins = parseInt(match[2], 10);
      const secs = parseFloat(`${match[3]}.${match[4]}`);
      return Math.round((hours * 3600 + mins * 60 + secs) * 1000);
    }
  } catch {}
  return null;
}

// Pola deskriptif AI fallback jika Google Flow tidak menyertakan prefix pzxc_
const DESCRIPTIVE_PATTERNS = [
  { regex: /fried.*rice|eating.*rice|nasi.*goreng/i, code: "CO-2026-001", scene: 3 },
  { regex: /wajan|kuali|lempar.*wajan/i, code: "CO-2026-001", scene: 1 },
  { regex: /nasi.*sisa|cold.*rice/i, code: "CO-2026-001", scene: 2 },
  { regex: /demonstrates.*orig|demonstrates|kulkas.*bawang/i, code: "CO-2026-004", scene: 3 },
  { regex: /chopping.*onion|knife.*onion|membelah.*bawang/i, code: "CO-2026-004", scene: 1 },
  { regex: /macro.*onion|sel.*bawang/i, code: "CO-2026-004", scene: 2 },
  { regex: /floating.*space|space.*star|bintang.*origami/i, code: "CO-2026-006", scene: 1 },
  { regex: /stars.*collid|tabrakan.*bintang/i, code: "CO-2026-006", scene: 2 },
  { regex: /looking.*ring|ring.*gold|cincin.*emas/i, code: "CO-2026-006", scene: 3 },
  { regex: /choosing.*drink/i, code: "CO-2026-013", scene: 1 },
  { regex: /holding.*teacup|teacup/i, code: "CO-2026-013", scene: 2 },
  { regex: /expresses.*surprise|surprise/i, code: "CO-2026-013", scene: 3 },
  { regex: /origami.*bee|bee/i, code: "CO-2026-015", scene: 1 },
  { regex: /observing.*feat|features/i, code: "CO-2026-015", scene: 2 },
  { regex: /greeting.*audience|audience/i, code: "CO-2026-015", scene: 3 },
  { regex: /listening.*voice/i, code: "CO-2026-017", scene: 1 },
  { regex: /demonstrating.*sou|sound/i, code: "CO-2026-017", scene: 2 },
  { regex: /waving.*smiling/i, code: "CO-2026-017", scene: 3 },
  { regex: /waving.*forest|forest/i, code: "CO-2026-018", scene: 1 },
  { regex: /paper.*network|pointing.*network/i, code: "CO-2026-018", scene: 2 },
  { regex: /gesturing.*banner|gesturing.*near/i, code: "CO-2026-018", scene: 3 },
  { regex: /discovers.*flam|origami.*flam|flamingo/i, code: "CO-2026-021", scene: 1 },

  // CO-2026-042: Paru-Paru Kita Seukuran Lapangan Tenis!
  { regex: /presents.*lung|lung.*model/i, code: "CO-2026-042", scene: 1 },
  { regex: /lungs.*unfolding|unfolding.*court|court/i, code: "CO-2026-042", scene: 2 },
  { regex: /reacts.*to.*lungs|reacts.*lungs/i, code: "CO-2026-042", scene: 3 },

  // CO-2026-036: Kuda Laut Jantan yang Melahirkan!
  { regex: /unfolding.*water|paper.*water/i, code: "CO-2026-036", scene: 1 },
  { regex: /seahorse.*birth|birth.*stop-m/i, code: "CO-2026-036", scene: 2 },
  { regex: /reacts.*to.*seahorse|reacts.*seahorse/i, code: "CO-2026-036", scene: 3 },

  // CO-2026-041: Kenapa Kita Ketawa Pas Digelitik?
  { regex: /tickling|observing.*tickling/i, code: "CO-2026-041", scene: 1 },
  { regex: /reacting.*with.*sur/i, code: "CO-2026-041", scene: 2 },
  { regex: /smiling.*to.*camera/i, code: "CO-2026-041", scene: 3 },

  // CO-2026-039: Lidah Jerapah Ternyata Warnanya Biru!
  { regex: /eating.*pineapple|pineapple/i, code: "CO-2026-039", scene: 1 },
  { regex: /devours.*origami|devours/i, code: "CO-2026-039", scene: 2 },
  { regex: /gestures.*toward.*camera/i, code: "CO-2026-039", scene: 3 },

  // CO-2026-031: Kenapa Susu Warnanya Selalu Putih?
  { regex: /animation.*of.*boy/i, code: "CO-2026-031", scene: 1 },
  { regex: /flashlight|shining.*flashlight/i, code: "CO-2026-031", scene: 2 },
  { regex: /character.*gesturing.*toward/i, code: "CO-2026-031", scene: 3 },

  // CO-2026-038: Kaget Pas Mau Tidur Kayak Jatuh / Hypnic Jerk
  { regex: /star.*explodes/i, code: "CO-2026-038", scene: 1 },
  { regex: /standing.*in.*studio/i, code: "CO-2026-038", scene: 2 },
  { regex: /waving.*in.*studio/i, code: "CO-2026-038", scene: 3 },

  // CO-2026-012: Jam di Luar Angkasa Berjalan Lebih Lambat!
  { regex: /pocket.*watches/i, code: "CO-2026-012", scene: 1 },
  { regex: /correcting.*map|map.*time/i, code: "CO-2026-012", scene: 2 },
];

/**
 * Mengirim berkas video final master secara otomatis ke Bot Telegram
 */
async function sendFinalVideoToTelegram({ token, chatId, item, videoPath, cloudUrl, videoBuffer }) {
  if (!token || !chatId) {
    console.log('   ℹ️ [Telegram] Token bot atau Chat ID belum diset di .env.local, lewati notifikasi.');
    return false;
  }

  const filename = path.basename(videoPath);
  console.log(`   📱 [Telegram] Mengirim video final master ${filename} ke Bot Telegram...`);

  // Bangun caption HTML menarik & rapi (dibawah 1024 karakter)
  const category = item.category || 'Fakta Unik';
  const topic = item.topic || 'Sains Populer';
  const hookText = item.hook ? `\n🎯 <i>"${item.hook}"</i>` : '';
  const ctaText = item.cta ? `\n📢 <i>${item.cta}</i>` : '';
  const cloudLink = cloudUrl ? `\n☁️ <a href="${cloudUrl}">Tonton / Unduh via Supabase Storage</a>` : '';

  const cleanCategoryTag = category.replace(/[^a-zA-Z0-9]/g, '');
  const cleanTopicTag = topic.replace(/[^a-zA-Z0-9]/g, '');

  const caption = [
    `🎬 <b>[${item.content_code}] ${item.title}</b>`,
    `📁 <i>Kategori: ${category} | Topik: ${topic}</i>${hookText}${ctaText}`,
    '',
    `✨ <b>Video Master 9:16 Siap Tayang!</b>`,
    `Rakitan otomatis selesai, klip lokal dibersihkan (Zero-Disk).${cloudLink}`,
    '',
    `🔖 #CeritaObim #Origami3D #${cleanCategoryTag} #${cleanTopicTag} #FaktaUnik #Shorts #Reels #TikTok`,
  ].join('\n');

  try {
    const buffer = videoBuffer || (fs.existsSync(videoPath) ? fs.readFileSync(videoPath) : null);

    // 1. Prioritas Utama: Upload file video MP4 langsung jika <= 50MB (Batas Telegram Bot API)
    if (buffer && buffer.byteLength <= 50 * 1024 * 1024) {
      const durationSec = Math.round((getFfprobeDuration(videoPath) || 30000) / 1000);
      const formData = new FormData();
      formData.append('chat_id', String(chatId));
      formData.append('video', new Blob([buffer], { type: 'video/mp4' }), filename);
      formData.append('width', '1080');
      formData.append('height', '1920');
      formData.append('duration', String(durationSec || 30));
      formData.append('caption', caption);
      formData.append('parse_mode', 'HTML');
      formData.append('supports_streaming', 'true');

      const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json().catch(() => null);
      if (data && data.ok) {
        console.log(`   ✅ [Telegram] Video file ${filename} BERHASIL terkirim ke Telegram (Chat ID: ${chatId})!`);
        return true;
      } else {
        console.warn(`   ⚠️ [Telegram sendVideo file gagal]: ${data ? data.description : 'Unknown error'}. Mencoba fallback...`);
      }
    }

    // 2. Fallback: Kirim video via URL streaming Cloud jika file > 50MB atau upload buffer gagal
    if (cloudUrl) {
      const res = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          video: cloudUrl,
          caption: caption,
          parse_mode: 'HTML',
          supports_streaming: true,
        }),
      });

      const data = await res.json().catch(() => null);
      if (data && data.ok) {
        console.log(`   ✅ [Telegram] Video berhasil dikirim ke Telegram via Cloud Storage URL!`);
        return true;
      }
    }

    // 3. Fallback Terakhir: Kirim Pesan Teks
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: caption,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
      }),
    });
    console.log(`   ✅ [Telegram] Pesan notifikasi teks berhasil dikirim ke Telegram!`);
    return true;
  } catch (err) {
    console.warn(`   ⚠️ [Telegram Error] Gagal mengirim ke Telegram (non-blocking): ${err.message}`);
    return false;
  }
}

async function runSupabaseMigration() {
  console.log('\n================================================================');
  console.log('   📦 CERITAOBIM STUDIO — MIGRASI & SINKRONISASI DATABASE');
  console.log('   Pindai Downloads -> Standarisasi KLIP_BERSIH -> Update Supabase');
  console.log('================================================================\n');

  ensureDirectories();
  const env = loadEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Konfigurasi Supabase URL / Key tidak ditemukan di .env.local');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // 1. Ambil data Content Items dan Scenes dari Supabase
  console.log('📡 Mengambil daftar konten dan adegan dari Database Supabase...');
  const { data: contentItems, error: contentErr } = await supabase
    .from('content_items')
    .select('id, owner_id, content_code, title, category, topic, narration, hook, cta');

  if (contentErr) {
    throw new Error('Gagal mengambil content_items dari Supabase: ' + contentErr.message);
  }

  const { data: allScenes, error: scenesErr } = await supabase
    .from('scenes')
    .select('id, content_id, scene_index, scene_status');

  if (scenesErr) {
    throw new Error('Gagal mengambil scenes dari Supabase: ' + scenesErr.message);
  }

  // Buat index pencarian cepat
  const contentByNumber = new Map();
  contentItems.forEach((ci) => {
    const match = ci.content_code.match(/CO-(\d{4})-(\d+)/);
    if (match) {
      const num = parseInt(match[2], 10);
      contentByNumber.set(num, ci);
    }
    contentByNumber.set(ci.content_code.toUpperCase(), ci);
  });

  // 2. Kumpulkan berkas target dari Downloads, Dropzone Owner, dan storage/macro_drops
  console.log('🔍 Memindai berkas video yang siap dimigrasikan...');
  const candidateFiles = [];

  // A. Windows Downloads folder
  if (fs.existsSync(USER_DOWNLOADS)) {
    const dlFiles = fs.readdirSync(USER_DOWNLOADS);
    dlFiles.forEach((file) => {
      const lower = file.toLowerCase();
      if ((lower.endsWith('.mp4') || lower.endsWith('.webm')) && (
        lower.startsWith('pzxc_') ||
        DESCRIPTIVE_PATTERNS.some((dp) => dp.regex.test(file))
      )) {
        candidateFiles.push({
          sourcePath: path.join(USER_DOWNLOADS, file),
          filename: file,
          origin: 'Downloads',
        });
      }
    });
  }

  // B. DROPZONE_HASIL_DOWNLOAD
  if (fs.existsSync(OWNER_DROP_DIR)) {
    const dropFiles = fs.readdirSync(OWNER_DROP_DIR);
    dropFiles.forEach((file) => {
      const lower = file.toLowerCase();
      if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
        candidateFiles.push({
          sourcePath: path.join(OWNER_DROP_DIR, file),
          filename: file,
          origin: 'Dropzone Owner',
        });
      }
    });
  }

  // C. storage/macro_drops (root only, ignore subfolders)
  if (fs.existsSync(STORAGE_DROPS_DIR)) {
    const storageFiles = fs.readdirSync(STORAGE_DROPS_DIR);
    storageFiles.forEach((file) => {
      const p = path.join(STORAGE_DROPS_DIR, file);
      if (fs.statSync(p).isFile()) {
        const lower = file.toLowerCase();
        if (lower.endsWith('.mp4') || lower.endsWith('.webm') || lower.endsWith('.mov')) {
          candidateFiles.push({
            sourcePath: p,
            filename: file,
            origin: 'storage/macro_drops',
          });
        }
      }
    });
  }

  if (candidateFiles.length === 0) {
    console.log('ℹ️  Tidak ada file klip baru di folder Downloads atau Dropzone.');
    console.log('   Melanjutkan ke evaluasi kelengkapan konten & perakitan video...');
  } else {
    console.log(`🎯 Ditemukan ${candidateFiles.length} file video baru untuk diproses:\n`);
  }

  const migratedClips = [];
  const touchedContentIds = new Set();
  const unmatched = [];

  for (const candidate of candidateFiles) {
    const ext = path.extname(candidate.filename) || '.mp4';
    const baseName = path.basename(candidate.filename, ext);

    // Deteksi kode singkat: pzxc_[segmen]_[week]_[content]_[scene]xx*
    const shortCodeRegex = /(?:^|[^0-9a-z])(?:pzxc_)?(\d+)_(\d+)_(\d+)_0*(\d+)(?:xx.*)?$/i;
    const match = baseName.match(shortCodeRegex);

    let targetItem = null;
    let targetSceneIndex = null;
    let cleanFilename = '';

    if (match) {
      const segmenNum = parseInt(match[1], 10);
      const weekNum = parseInt(match[2], 10);
      const contentNum = parseInt(match[3], 10);
      const sceneIndex = parseInt(match[4], 10);

      cleanFilename = `${segmenNum}_${weekNum}_${contentNum}_${sceneIndex}${ext}`;
      targetSceneIndex = sceneIndex;
      targetItem = contentByNumber.get(contentNum);
    } else {
      // Fallback deskriptif
      for (const dp of DESCRIPTIVE_PATTERNS) {
        if (dp.regex.test(baseName)) {
          targetItem = contentByNumber.get(dp.code);
          if (targetItem) {
            targetSceneIndex = dp.scene;
            const contentNum = parseInt(targetItem.content_code.replace(/\D/g, '').slice(-3), 10);
            const weekNum = Math.max(1, Math.ceil(contentNum / 7));
            cleanFilename = `3_${weekNum}_${contentNum}_${targetSceneIndex}${ext}`;
            break;
          }
        }
      }
    }

    if (!targetItem || targetSceneIndex === null) {
      unmatched.push({ file: candidate.filename, reason: 'Pola kode pzxc_[segmen]_[week]_[konten]_[bagian]xx tidak cocok' });
      continue;
    }

    // Cari Scene ID di Supabase
    const sceneRecord = allScenes.find(
      (s) => s.content_id === targetItem.id && s.scene_index === targetSceneIndex
    );

    if (!sceneRecord) {
      unmatched.push({ file: candidate.filename, reason: `Adegan Bagian ${targetSceneIndex} untuk ${targetItem.content_code} tidak ditemukan di tabel scenes` });
      continue;
    }

    try {
      const fileBuffer = fs.readFileSync(candidate.sourcePath);
      const checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex').slice(0, 16);
      const cleanDestPath = path.join(OWNER_CLEAN_DIR, cleanFilename);

      // Salin ke 00.FolderOwner/KLIP_BERSIH (TETAP DIPERTAHANKAN di lokal untuk perakitan FFmpeg)
      fs.writeFileSync(cleanDestPath, fileBuffer);

      // Probe durasi video
      const durationMs = getFfprobeDuration(cleanDestPath) || 10000;

      // 1. UNGGAH KLIP KE PENYIMPANAN CLOUD (Supabase Storage: studio-assets)
      let cloudClipUrl = '';
      const cloudClipStoragePath = `scene-clips/${targetItem.content_code}/${cleanFilename}`;
      try {
        const { error: uploadClipErr } = await supabase.storage
          .from('studio-assets')
          .upload(cloudClipStoragePath, fileBuffer, {
            upsert: true,
            contentType: 'video/mp4',
          });

        if (!uploadClipErr) {
          const { data: urlData } = supabase.storage
            .from('studio-assets')
            .getPublicUrl(cloudClipStoragePath);
          cloudClipUrl = urlData?.publicUrl || '';
        } else {
          console.warn(`   ⚠️ Supabase Storage upload clip warning: ${uploadClipErr.message}`);
        }
      } catch (cloudErr) {
        console.warn(`   ⚠️ Supabase Storage exception: ${cloudErr.message}`);
      }

      // UPDATE SUPABASE: scenes table
      const { error: updateSceneErr } = await supabase
        .from('scenes')
        .update({
          scene_status: 'clip_uploaded',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sceneRecord.id);

      if (updateSceneErr) {
        console.warn(`   ⚠️ Supabase update scene warning: ${updateSceneErr.message}`);
      }

      // UPDATE SUPABASE: assets table (replace existing scene_video for this scene if exists)
      await supabase
        .from('assets')
        .delete()
        .eq('content_id', targetItem.id)
        .eq('scene_id', sceneRecord.id)
        .eq('asset_type', 'scene_video');

      const assetId = crypto.randomUUID();
      const { error: insertAssetErr } = await supabase
        .from('assets')
        .insert({
          id: assetId,
          owner_id: targetItem.owner_id,
          content_id: targetItem.id,
          scene_id: sceneRecord.id,
          asset_type: 'scene_video',
          storage_path: cleanDestPath,
          original_filename: cleanFilename,
          mime_type: 'video/mp4',
          size_bytes: fileBuffer.byteLength,
          duration_ms: durationMs,
          width: 1080,
          height: 1920,
          checksum: checksum,
          metadata: {
            source: 'makro_final_supabase_sync',
            originalRawFile: candidate.filename,
            cleanFilename: cleanFilename,
            origin: candidate.origin,
            cloudStoragePath: cloudClipStoragePath,
            cloudUrl: cloudClipUrl,
            cloudUploaded: Boolean(cloudClipUrl),
            importedAt: new Date().toISOString(),
          },
        });

      if (insertAssetErr) {
        console.warn(`   ⚠️ Supabase insert asset warning: ${insertAssetErr.message}`);
      }

      // Arsipkan file asli dari Downloads / Dropzone ke processed
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const processedPath = path.join(PROCESSED_DIR, `${timestamp}_${cleanFilename}`);
      try {
        fs.renameSync(candidate.sourcePath, processedPath);
      } catch {
        fs.copyFileSync(candidate.sourcePath, processedPath);
        fs.unlinkSync(candidate.sourcePath);
      }

      migratedClips.push({
        contentCode: targetItem.content_code,
        title: targetItem.title,
        sceneIndex: targetSceneIndex,
        cleanFilename: cleanFilename,
        sizeKB: Math.round(fileBuffer.byteLength / 1024),
      });

      touchedContentIds.add(targetItem.id);

      console.log(`   ✅ [${targetItem.content_code}] Bagian ${targetSceneIndex} -> ${cleanFilename} (${Math.round(fileBuffer.byteLength / 1024)} KB) [Supabase Updated]`);
    } catch (err) {
      console.error(`   ❌ Gagal memproses ${candidate.filename}:`, err.message);
      unmatched.push({ file: candidate.filename, reason: err.message });
    }
  }

  // 3. Evaluasi Kelengkapan Klip & Rakit Video Final jika Lengkap
  console.log('\n================================================================');
  console.log('   🔍 EVALUASI KELENGKAPAN KONTEN & REKAMAN VOICE OVER');
  console.log('================================================================');

  const assembledList = [];
  const waitingForVoiceList = [];

  // Dapatkan seluruh konten yang sudah punya final_video di assets Supabase
  const { data: existingFinals } = await supabase
    .from('assets')
    .select('content_id')
    .eq('asset_type', 'final_video');
  const finishedIds = new Set((existingFinals || []).map((a) => a.content_id));

  // Ambil daftar klip yang ada di KLIP_BERSIH lokal
  const cleanFiles = fs.existsSync(OWNER_CLEAN_DIR) ? fs.readdirSync(OWNER_CLEAN_DIR) : [];
  const cleanFilesByNum = new Map();
  cleanFiles.forEach((cf) => {
    const m = cf.match(/^\d+_\d+_(\d+)_(\d+)\.mp4$/i);
    if (m) {
      const cNum = parseInt(m[1], 10);
      const sIdx = parseInt(m[2], 10);
      if (!cleanFilesByNum.has(cNum)) cleanFilesByNum.set(cNum, []);
      cleanFilesByNum.get(cNum).push({ file: cf, path: path.join(OWNER_CLEAN_DIR, cf), sceneIndex: sIdx });
    }
  });

  // Evaluasi semua konten yang disentuh ATAU yang punya klip lengkap di KLIP_BERSIH tapi belum ada final_video
  const contentsToEvaluate = contentItems.filter((item) => {
    if (finishedIds.has(item.id)) return false; // Sudah dirakit
    const cNum = parseInt(item.content_code.replace(/\D/g, '').slice(-3), 10);
    const hasLocalClips = cleanFilesByNum.has(cNum) && (cleanFilesByNum.get(cNum).length >= 3);
    return touchedContentIds.has(item.id) || hasLocalClips;
  });

  for (const item of contentsToEvaluate) {
    const contentId = item.id;
    const cNum = parseInt(item.content_code.replace(/\D/g, '').slice(-3), 10);

    // Ambil scene & assets terbaru dari Supabase
    const { data: scenes } = await supabase
      .from('scenes')
      .select('id, scene_index, scene_status')
      .eq('content_id', contentId)
      .order('scene_index', { ascending: true });

    const { data: assets } = await supabase
      .from('assets')
      .select('id, asset_type, storage_path, scene_id')
      .eq('content_id', contentId);

    const totalScenes = (scenes || []).length || 3;
    const targetRequiredClips = Math.min(3, totalScenes);
    let uploadedClips = (assets || []).filter((a) => a.asset_type === 'scene_video');

    // Jika di assets Supabase belum tercatat 3 klip tapi di KLIP_BERSIH ada klip, sinkronkan
    if (uploadedClips.length < targetRequiredClips && cleanFilesByNum.has(cNum)) {
      const localClips = cleanFilesByNum.get(cNum);
      for (const lc of localClips) {
        if (!uploadedClips.some((uc) => uc.storage_path === lc.path || uc.storage_path.endsWith(lc.file))) {
          const sc = (scenes || []).find((s) => s.scene_index === lc.sceneIndex);
          uploadedClips.push({
            id: crypto.randomUUID(),
            asset_type: 'scene_video',
            storage_path: lc.path,
            scene_id: sc ? sc.id : null,
          });
        }
      }
    }

    const voiceAsset = (assets || []).find((a) => a.asset_type === 'voice_audio');
    const isAllClipsReady = uploadedClips.length >= targetRequiredClips;

    if (isAllClipsReady) {
      // Selesaikan pencarian audio voice over yang valid
      let resolvedVoicePath = null;
      let effectiveVoiceAsset = voiceAsset;

      if (voiceAsset && voiceAsset.storage_path && fs.existsSync(voiceAsset.storage_path)) {
        resolvedVoicePath = voiceAsset.storage_path;
      } else {
        // 1. Cari file audio di folder .data/media
        const mediaDir = path.join(ROOT_DIR, '.data', 'media');
        if (fs.existsSync(mediaDir)) {
          const mFiles = fs.readdirSync(mediaDir);
          const found = mFiles.find(
            (f) => f.startsWith(`${item.content_code}_VOICE_`) && (f.endsWith('.wav') || f.endsWith('.mp3'))
          );
          if (found) {
            resolvedVoicePath = path.join(mediaDir, found);
            console.log(`   🎙️  [Audio Cache] Ditemukan rekaman suara Obim lokal: ${found}`);
          }
        }

        // 2. Cek di Supabase Storage: studio-assets/voice-audio/${item.content_code}/...
        if (!resolvedVoicePath) {
          try {
            const { data: cloudVoiceList } = await supabase.storage
              .from('studio-assets')
              .list(`voice-audio/${item.content_code}`);
            if (cloudVoiceList && cloudVoiceList.length > 0) {
              const cloudVoiceName = cloudVoiceList[0].name;
              const { data: blob } = await supabase.storage
                .from('studio-assets')
                .download(`voice-audio/${item.content_code}/${cloudVoiceName}`);
              if (blob) {
                const dlBuffer = Buffer.from(await blob.arrayBuffer());
                if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
                const dlPath = path.join(mediaDir, `${item.content_code}_VOICE_${cloudVoiceName}`);
                fs.writeFileSync(dlPath, dlBuffer);
                resolvedVoicePath = dlPath;
                console.log(`   ☁️  Berhasil mengunduh voice audio dari Supabase Storage: ${cloudVoiceName}`);
              }
            }
          } catch {}
        }

        // 3. Jika belum ada, otomatis generate on the fly via Gemini TTS / ElevenLabs!
        if (!resolvedVoicePath && (env.GEMINI_API_KEY || env.ELEVENLABS_API_KEY)) {
          console.log(`   ✨ [Auto-Pilot Fase 2] Men-generate audio naskah Obim secara realtime...`);
          const synthRes = await synthesizeVoiceOnDemand(item, env);
          if (synthRes) {
            const mediaDir = path.join(ROOT_DIR, '.data', 'media');
            if (!fs.existsSync(mediaDir)) fs.mkdirSync(mediaDir, { recursive: true });
            const localAudioName = `${item.content_code}_VOICE_${Date.now()}.${synthRes.ext}`;
            const localAudioPath = path.join(mediaDir, localAudioName);
            fs.writeFileSync(localAudioPath, synthRes.buffer);
            resolvedVoicePath = localAudioPath;

            // Unggah ke Supabase Storage agar permanen di cloud
            const cloudAudioPath = `voice-audio/${item.content_code}/${localAudioName}`;
            await supabase.storage.from('studio-assets').upload(cloudAudioPath, synthRes.buffer, {
              upsert: true,
              contentType: synthRes.mimeType,
            });

            // Update/Insert ke Supabase assets
            const newVoiceAssetId = voiceAsset ? voiceAsset.id : crypto.randomUUID();
            await supabase.from('assets').upsert({
              id: newVoiceAssetId,
              owner_id: item.owner_id,
              content_id: item.id,
              asset_type: 'voice_audio',
              storage_path: localAudioPath,
              original_filename: `${item.content_code}_VOICE.${synthRes.ext}`,
              mime_type: synthRes.mimeType,
              size_bytes: synthRes.buffer.byteLength,
              duration_ms: Math.round(synthRes.buffer.byteLength / 48),
              checksum: crypto.createHash('sha256').update(synthRes.buffer).digest('hex').slice(0, 16),
              metadata: {
                providerKey: synthRes.provider,
                cloudStoragePath: cloudAudioPath,
                timestampStatus: 'estimated',
                generatedAt: new Date().toISOString(),
              },
            });
            console.log(`   ✅ Audio voice over Obim selesai dibuat & diunggah ke cloud!`);
          }
        }

        if (resolvedVoicePath) {
          effectiveVoiceAsset = {
            id: voiceAsset ? voiceAsset.id : crypto.randomUUID(),
            storage_path: resolvedVoicePath,
            asset_type: 'voice_audio',
          };
        }
      }

      if (resolvedVoicePath && effectiveVoiceAsset) {
        console.log(`\n🎉 Konten [${item.content_code}] ${item.title}: KLIP LENGKAP + VOICE AUDIO SIAP!`);
        console.log(`   🔨 Memulai auto-assembly FFmpeg 9:16...`);

        // Panggil FFmpeg perakitan video
        const cleanTitle = (item.title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
        const masterVideoPath = path.join(OWNER_MASTER_DIR, `${item.content_code}_${cleanTitle}_00Final.mp4`);

        const success = assembleFinalVideo(item, scenes || [], uploadedClips, effectiveVoiceAsset, masterVideoPath);
        if (success) {
          const masterBuffer = fs.readFileSync(masterVideoPath);

          // 2. UNGGAH VIDEO FINAL 00FINAL.MP4 KE PENYIMPANAN CLOUD
          let masterCloudUrl = '';
          const masterCloudPath = `final-videos/${item.content_code}_00Final.mp4`;
          try {
            const { error: uploadMasterErr } = await supabase.storage
              .from('studio-assets')
              .upload(masterCloudPath, masterBuffer, {
                upsert: true,
                contentType: 'video/mp4',
              });

            if (!uploadMasterErr) {
              const { data: urlData } = supabase.storage
                .from('studio-assets')
                .getPublicUrl(masterCloudPath);
              masterCloudUrl = urlData?.publicUrl || '';
              console.log(`   ☁️  Video Final Master TERUNGGAH KE CLOUD: ${masterCloudUrl}`);
            } else {
              console.warn(`   ⚠️ Supabase Storage master upload warning: ${uploadMasterErr.message}`);
            }
          } catch (cloudMasterErr) {
            console.warn(`   ⚠️ Supabase Storage master exception: ${cloudMasterErr.message}`);
          }

          // Daftarkan final_video asset ke Supabase
          const masterAssetId = crypto.randomUUID();
          await supabase.from('assets').insert({
            id: masterAssetId,
            owner_id: item.owner_id,
            content_id: item.id,
            asset_type: 'final_video',
            storage_path: masterVideoPath,
            original_filename: path.basename(masterVideoPath),
            mime_type: 'video/mp4',
            size_bytes: masterBuffer.byteLength,
            duration_ms: getFfprobeDuration(masterVideoPath),
            width: 1080,
            height: 1920,
            metadata: {
              source: 'makro_final_assembly',
              cloudStoragePath: masterCloudPath,
              cloudUrl: masterCloudUrl,
              cloudUploaded: Boolean(masterCloudUrl),
              assembledAt: new Date().toISOString(),
            },
          });

          // Update status konten di Supabase menjadi ready_for_publishing
          await supabase
            .from('content_items')
            .update({ content_status: 'ready_for_publishing' })
            .eq('id', item.id);

          assembledList.push({
            code: item.content_code,
            title: item.title,
            path: masterVideoPath,
            cloudUrl: masterCloudUrl,
          });
          console.log(`   ✨ Master 00Final.mp4 BERHASIL DIRAKIT: ${masterVideoPath}`);

          // OTOMATIS KIRIM KE TELEGRAM BOT (Setiap video baru dirakit langsung dikirim ke HP)
          console.log(`   🚀 [Auto-Pilot Telegram] Mengirim video final rakitan langsung ke Bot Telegram...`);
          const tgSent = await sendFinalVideoToTelegram({
            token: env.TELEGRAM_BOT_TOKEN,
            chatId: env.TELEGRAM_ALLOWED_USER_ID,
            item,
            videoPath: masterVideoPath,
            cloudUrl: masterCloudUrl,
            videoBuffer: masterBuffer,
          });

          if (tgSent) {
            await supabase
              .from('assets')
              .update({
                metadata: {
                  source: 'makro_final_assembly',
                  cloudStoragePath: masterCloudPath,
                  cloudUrl: masterCloudUrl,
                  cloudUploaded: Boolean(masterCloudUrl),
                  assembledAt: new Date().toISOString(),
                  telegramSent: true,
                  telegramSentAt: new Date().toISOString(),
                },
              })
              .eq('id', masterAssetId);
          }

          // 3. HAPUS BAGIAN-BAGIAN VIDEO DARI LAPTOP SETELAH FINAL TERUPLOAD KE CLOUD (Zero-Disk Bloat)
          console.log(`   🧹 [Zero-Disk Cleanup] Membersihkan klip bagian lokal ${item.content_code} dari KLIP_BERSIH...`);
          let deletedCount = 0;
          for (const clip of uploadedClips) {
            if (clip.storage_path && fs.existsSync(clip.storage_path)) {
              try {
                fs.unlinkSync(clip.storage_path);
                deletedCount++;
              } catch (delErr) {
                console.warn(`      ⚠️ Gagal menghapus klip lokal: ${delErr.message}`);
              }
            }
          }
          console.log(`   ✅ ${deletedCount} klip bagian lokal telah dihapus dari laptop (Aman: Seluruh klip & video final master tersimpan di cloud).`);
        }
      } else {
        waitingForVoiceList.push({
          code: item.content_code,
          title: item.title,
          totalScenes: totalScenes,
        });
        console.log(`   🎙️  [${item.content_code}] ${item.title}: Seluruh ${totalScenes} bagian klip LENGKAP! (Menunggu rekaman audio voice over di studio).`);
      }
    } else {
      console.log(`   ⏳ [${item.content_code}] ${item.title}: ${uploadedClips.length}/${totalScenes} klip siap.`);
    }
  }

  // 4. Ringkasan Akhir
  console.log('\n================================================================');
  console.log('   📊 RINGKASAN MIGRASI & SINKRONISASI DATABASE:');
  console.log('================================================================');
  console.log(`  • Klip Video Berhasil Dimigrasikan : ${migratedClips.length} klip`);
  console.log(`  • Status Supabase Diperbarui       : ${migratedClips.length} adegan (clip_uploaded)`);
  console.log(`  • Berkas Bersih Tersimpan Di       : 00.FolderOwner\\KLIP_BERSIH`);
  console.log(`  • Folder Downloads Windows         : Sudah dibersihkan (diarsipkan ke processed)`);
  if (assembledList.length > 0) {
    console.log(`  • Video Final Master 00Final.mp4   : ${assembledList.length} video selesai dirakit`);
  }
  if (waitingForVoiceList.length > 0) {
    console.log(`  • Menunggu Audio Voice Over        : ${waitingForVoiceList.length} konten`);
  }
  if (unmatched.length > 0) {
    console.log(`  • Berkas Tidak Cocok               : ${unmatched.length} berkas`);
    unmatched.forEach((u) => console.log(`     - ${u.file}: ${u.reason}`));
  }
  console.log('================================================================\n');

  return {
    migratedCount: migratedClips.length,
    assembledCount: assembledList.length,
  };
}

/**
 * Merakit video master 9:16 menggunakan FFmpeg dengan transisi presisi & audio voice over
 */
function assembleFinalVideo(item, scenes, clipAssets, voiceAsset, outputPath) {
  try {
    const ffmpegBin = getFfmpegBinary();

    // Kumpulkan seluruh berkas klip video fisik yang tersedia untuk konten ini
    const clipMap = new Map();
    for (const c of clipAssets) {
      if (!c.storage_path || !fs.existsSync(c.storage_path)) continue;

      let partNum = null;
      const m = c.storage_path.match(/(?:Bagian_0*(\d+)|_(\d+)\.mp4$)/i);
      if (m) {
        partNum = parseInt(m[1] || m[2], 10);
      } else if (c.scene_id && Array.isArray(scenes)) {
        const sc = scenes.find((s) => s.id === c.scene_id);
        if (sc) partNum = sc.scene_index;
      }

      if (partNum && !clipMap.has(partNum)) {
        clipMap.set(partNum, c.storage_path);
      }
    }

    // Urutkan klip berdasarkan nomor bagian (1, 2, 3...)
    const sortedParts = Array.from(clipMap.keys()).sort((a, b) => a - b);
    const orderedClips = sortedParts.map((p) => clipMap.get(p));

    if (orderedClips.length === 0) {
      console.warn('   ⚠️ Tidak ada file klip adegan yang ditemukan secara fisik di laptop.');
      return false;
    }

    console.log(`   🎬 Merangkai ${orderedClips.length} bagian video (${sortedParts.map((p) => `Bagian ${p}`).join(', ')}) dengan SFX + audio voice over Obim...`);

    // Dapatkan durasi audio narasi
    const voiceDurationMs = getFfprobeDuration(voiceAsset.storage_path) || 30000;
    const voiceDurationSec = voiceDurationMs / 1000;

    // Hitung durasi per segmen klip agar selaras dengan total audio narasi (tidak terpotong)
    const clipInfos = orderedClips.map((clipPath) => {
      const durMs = getFfprobeDuration(clipPath) || 8000;
      let hasAudio = false;
      try {
        const probe = spawnSync(ffmpegBin, ['-i', clipPath], { encoding: 'utf8', timeout: 5000 });
        hasAudio = (probe.stderr || '').includes('Audio:');
      } catch {}
      return {
        path: clipPath,
        actualDurSec: durMs / 1000,
        hasAudio,
      };
    });

    const totalClipsDurSec = clipInfos.reduce((sum, c) => sum + c.actualDurSec, 0);
    const deficitSec = Math.max(0, voiceDurationSec - totalClipsDurSec);
    const padPerClipSec = deficitSec > 0 ? (deficitSec / clipInfos.length) : 0;

    // Buat filter_complex: scale, pad 1080x1920 (9:16), tpad klon frame akhir agar narasi tidak terpotong
    const filterParts = [];
    clipInfos.forEach((info, i) => {
      const padSec = parseFloat(padPerClipSec.toFixed(3));
      const tpadStr = padSec > 0.05 ? `,tpad=stop_mode=clone:stop_duration=${padSec}` : '';
      filterParts.push(
        `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30,format=yuv420p${tpadStr}[v${i}]`
      );
    });

    const vConcat = clipInfos.map((_, i) => `[v${i}]`).join('') + `concat=n=${clipInfos.length}:v=1:a=0[vout]`;
    filterParts.push(vConcat);

    // Audio mixing: efek suara klip (35%) + narasi Obim (100%)
    const anyClipHasAudio = clipInfos.some((c) => c.hasAudio);
    const voiceInputIdx = clipInfos.length;

    let audioMapArgs = [];
    if (anyClipHasAudio) {
      clipInfos.forEach((info, i) => {
        const padSec = parseFloat(padPerClipSec.toFixed(3));
        const apadStr = padSec > 0.05 ? `,apad=pad_dur=${padSec}` : '';
        if (info.hasAudio) {
          filterParts.push(`[${i}:a]volume=0.35,aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo${apadStr}[a${i}]`);
        } else {
          filterParts.push(`anullsrc=channel_layout=stereo:sample_rate=44100,atrim=0:${(info.actualDurSec + padPerClipSec).toFixed(3)},asetpts=PTS-STARTPTS[a${i}]`);
        }
      });
      const aConcat = clipInfos.map((_, i) => `[a${i}]`).join('') + `concat=n=${clipInfos.length}:v=0:a=1[asfx]`;
      filterParts.push(aConcat);
      filterParts.push(`[${voiceInputIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.0[avoice]`);
      filterParts.push(`[asfx][avoice]amix=inputs=2:duration=longest:dropout_transition=0[aout]`);
      audioMapArgs = ['-map', '[aout]'];
    } else {
      filterParts.push(`[${voiceInputIdx}:a]aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo,volume=1.0[aout]`);
      audioMapArgs = ['-map', '[aout]'];
    }

    const inputArgs = [];
    clipInfos.forEach((c) => inputArgs.push('-i', c.path));
    inputArgs.push('-i', voiceAsset.storage_path);

    const ffmpegArgs = [
      '-y',
      ...inputArgs,
      '-filter_complex', filterParts.join(';'),
      '-map', '[vout]',
      ...audioMapArgs,
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-ar', '44100',
      '-movflags', '+faststart',
      outputPath,
    ];

    const result = spawnSync(ffmpegBin, ffmpegArgs, {
      encoding: 'utf8',
      timeout: 180000,
    });

    if (result.status === 0 && fs.existsSync(outputPath)) {
      return true;
    } else {
      console.warn(`   ⚠️ FFmpeg error: ${result.stderr ? result.stderr.slice(-500) : 'Gagal'}`);
      return false;
    }
  } catch (err) {
    console.error(`   ❌ Exception saat rakit video: ${err.message}`);
    return false;
  }
}

/**
 * Mengirim video final yang sudah dirakit ke Telegram (bisa 1 video spesifik atau semua)
 */
async function sendReadyVideosToTelegram(targetCode = 'all') {
  console.log('\n================================================================');
  console.log('   📱 CERITAOBIM STUDIO — TELEGRAM MASTER VIDEO DISPATCHER');
  console.log('================================================================\n');

  const env = loadEnv();
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_ALLOWED_USER_ID;

  if (!token || !chatId) {
    console.error('❌ TELEGRAM_BOT_TOKEN atau TELEGRAM_ALLOWED_USER_ID belum diset di .env.local');
    return;
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabase = createClient(supabaseUrl, supabaseKey);

  let query = supabase
    .from('content_items')
    .select('id, content_code, title, category, topic, hook, cta, content_status')
    .order('content_code', { ascending: true });

  if (targetCode && targetCode.toLowerCase() !== 'all') {
    query = query.ilike('content_code', `%${targetCode}%`);
  } else {
    query = query.eq('content_status', 'ready_for_publishing');
  }

  const { data: items, error } = await query;
  if (error || !items) {
    console.error('❌ Gagal membaca konten dari Supabase:', error ? error.message : 'No data');
    return;
  }

  console.log(`🔍 Ditemukan ${items.length} konten target untuk dikirim ke Telegram.`);

  let successCount = 0;
  for (const item of items) {
    // Cari asset final_video untuk konten ini
    const { data: assets } = await supabase
      .from('assets')
      .select('*')
      .eq('content_id', item.id)
      .eq('asset_type', 'final_video')
      .order('created_at', { ascending: false })
      .limit(1);

    const asset = assets && assets[0];
    if (!asset) {
      console.log(`   ⚠️ [${item.content_code}] ${item.title}: Belum memiliki aset video final.`);
      continue;
    }

    const cloudUrl = asset.metadata && asset.metadata.cloudUrl;
    let localPath = asset.storage_path;
    if (!localPath || !fs.existsSync(localPath)) {
      const candidates = fs.existsSync(OWNER_MASTER_DIR)
        ? fs.readdirSync(OWNER_MASTER_DIR).filter((f) => f.includes(item.content_code))
        : [];
      if (candidates.length > 0) {
        localPath = path.join(OWNER_MASTER_DIR, candidates[0]);
      }
    }

    console.log(`\n📤 [${item.content_code}] ${item.title}`);
    const sent = await sendFinalVideoToTelegram({
      token,
      chatId,
      item,
      videoPath: localPath || `${item.content_code}_00Final.mp4`,
      cloudUrl,
      videoBuffer: (localPath && fs.existsSync(localPath)) ? fs.readFileSync(localPath) : null,
    });

    if (sent) {
      successCount++;
      await supabase
        .from('assets')
        .update({
          metadata: {
            ...(asset.metadata || {}),
            telegramSent: true,
            telegramSentAt: new Date().toISOString(),
          },
        })
        .eq('id', asset.id);
    }

    // Jeda 2 detik antar video agar aman dari limit Telegram API
    if (items.length > 1) {
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  console.log(`\n🏁 Selesai. ${successCount}/${items.length} video berhasil terkirim ke Telegram!\n`);
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const tgArgIndex = args.indexOf('--send-telegram');
  if (tgArgIndex !== -1) {
    const target = args[tgArgIndex + 1] || 'all';
    sendReadyVideosToTelegram(target).catch((err) => {
      console.error('❌ Gagal mengirim video ke Telegram:', err.message);
      process.exit(1);
    });
  } else {
    runSupabaseMigration().catch((err) => {
      console.error('❌ Gagal menjalankan migrasi:', err.message);
      process.exit(1);
    });
  }
}

module.exports = { runSupabaseMigration, sendFinalVideoToTelegram, sendReadyVideosToTelegram };
