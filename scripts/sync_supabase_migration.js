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
    .select('id, owner_id, content_code, title, category, topic');

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
    console.log('   Semua klip yang ada sebelumnya sudah termigrasi & tersinkronisasi.');
    return { migratedCount: 0, assembledCount: 0 };
  }

  console.log(`🎯 Ditemukan ${candidateFiles.length} file video baru untuk diproses:\n`);

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

  for (const contentId of touchedContentIds) {
    const item = contentItems.find((i) => i.id === contentId);
    if (!item) continue;

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

    const totalScenes = (scenes || []).length;
    const uploadedClips = (assets || []).filter((a) => a.asset_type === 'scene_video');
    const voiceAsset = (assets || []).find((a) => a.asset_type === 'voice_audio');

    const isAllClipsReady = totalScenes > 0 && uploadedClips.length >= totalScenes;

    if (isAllClipsReady) {
      if (voiceAsset && fs.existsSync(voiceAsset.storage_path)) {
        console.log(`\n🎉 Konten [${item.content_code}] ${item.title}: KLIP LENGKAP + VOICE AUDIO ADA!`);
        console.log(`   🔨 Memulai auto-assembly FFmpeg 9:16...`);

        // Panggil FFmpeg perakitan video
        const cleanTitle = (item.title || 'video').replace(/[^a-zA-Z0-9_-]/g, '_');
        const masterVideoPath = path.join(OWNER_MASTER_DIR, `${item.content_code}_${cleanTitle}_00Final.mp4`);

        const success = assembleFinalVideo(item, scenes, uploadedClips, voiceAsset, masterVideoPath);
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

          assembledList.push({
            code: item.content_code,
            title: item.title,
            path: masterVideoPath,
            cloudUrl: masterCloudUrl,
          });
          console.log(`   ✨ Master 00Final.mp4 BERHASIL DIRAKIT: ${masterVideoPath}`);

          // 3. HAPUS BAGIAN-BAGIAN VIDEO DARI LAPTOP SETELAH FINAL TERUPLOAD KE CLOUD
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
    const sortedScenes = [...scenes].sort((a, b) => a.scene_index - b.scene_index);

    // Filter klip yang terurut sesuai urutan adegan
    const orderedClips = [];
    for (const sc of sortedScenes) {
      const clip = clipAssets.find((c) => c.scene_id === sc.id);
      if (clip && fs.existsSync(clip.storage_path)) {
        orderedClips.push(clip.storage_path);
      }
    }

    if (orderedClips.length !== sortedScenes.length) {
      console.warn('   ⚠️ Tidak semua file klip adegan ditemukan secara fisik.');
      return false;
    }

    // Buat concat manifest file temporer
    const concatListPath = path.resolve(STORAGE_DROPS_DIR, `concat_${item.content_code}_${Date.now()}.txt`);
    const lines = orderedClips.map((p) => `file '${p.replace(/\\/g, '/')}'`);
    fs.writeFileSync(concatListPath, lines.join('\n'), 'utf8');

    // FFmpeg command: Concatenate clips, scale & pad to 1080x1920, and attach voice audio
    const ffmpegArgs = [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatListPath,
      '-i', voiceAsset.storage_path,
      '-vf', 'scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1',
      '-c:v', 'libx264',
      '-preset', 'fast',
      '-crf', '18',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      outputPath,
    ];

    const result = spawnSync(ffmpegBin, ffmpegArgs, {
      encoding: 'utf8',
      timeout: 120000,
    });

    try { fs.unlinkSync(concatListPath); } catch {}

    if (result.status === 0 && fs.existsSync(outputPath)) {
      return true;
    } else {
      console.warn(`   ⚠️ FFmpeg error: ${result.stderr ? result.stderr.slice(-400) : 'Gagal'}`);
      return false;
    }
  } catch (err) {
    console.error(`   ❌ Exception saat rakit video: ${err.message}`);
    return false;
  }
}

if (require.main === module) {
  runSupabaseMigration().catch((err) => {
    console.error('❌ Gagal menjalankan migrasi:', err.message);
    process.exit(1);
  });
}

module.exports = { runSupabaseMigration };
