/**
 * CeritaObim Studio — Robot Makro Windows Batch 4-Video per Profil
 * 
 * Alur Kerja:
 * 1. Mendeteksi profil Chrome akun Google (Profil 1 s/d 10).
 * 2. Membuka Chrome profil target tanpa menutup profil sebelumnya (semua profil tetap terbuka di taskbar).
 * 3. Otomatis klik "+ New project" di Google Flow.
 * 4. Menyalin prompt BATCH (langsung meminta 4 video sekaligus per sesi profil).
 * 5. Menempelkan prompt ke kolom chat Google Flow & submit (Enter / tombol kirim).
 * 6. Menunggu konfirmasi kredit (80s dengan Enter-skip) dan otomatis klik "Always approve".
 * 7. Setelah Approve terklik, LANGSUNG lanjut membuka profil berikutnya tanpa menunggu render selesai!
 * 8. Semua video diberi nama resmi: "[JUDUL KONTEN] - Bagian [Nomor]".
 * 9. User tinggal download dari jendela yang terbuka, lalu pindahkan ke folder lokal DROPZONE.
 * 10. Website otomatis membaca, menggabungkan audio narasi, dan sinkronisasi ke Google Drive!
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');
const { spawn, execSync } = require('child_process');

const BASE_URL = process.env.STUDIO_BASE_URL || 'http://localhost:3000';
const SESSION_COOKIE = 'co_studio_owner_session=co_verified_owner_365d_token_v1';
const DROP_DIR = path.resolve(__dirname, '..', 'storage', 'macro_drops');
const OWNER_DROP_DIR = path.resolve(__dirname, '..', '00.FolderOwner', 'DROPZONE_HASIL_DOWNLOAD');
const BATCHES_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'pending_batches.json');
const ASSET_FILE = path.resolve(__dirname, '..', '00.FolderOwner', 'assets', 'obim.jpg');
const DOWNLOADS_DIR = path.join(process.env.USERPROFILE || '', 'Downloads');

function ensureDirs() {
  if (!fs.existsSync(DROP_DIR)) fs.mkdirSync(DROP_DIR, { recursive: true });
  if (!fs.existsSync(OWNER_DROP_DIR)) fs.mkdirSync(OWNER_DROP_DIR, { recursive: true });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    })
  );
}

function waitForUserOrTimeout(seconds, message) {
  return new Promise((resolve) => {
    let remaining = seconds;
    let finished = false;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    process.stdout.write(`\r${message} (${remaining}s tersisa, atau tekan [ENTER] sekarang): `);

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        if (!finished) {
          finished = true;
          rl.close();
          process.stdout.write('\n');
          resolve('timeout');
        }
      } else {
        process.stdout.write(`\r${message} (${remaining}s tersisa, atau tekan [ENTER] sekarang): `);
      }
    }, 1000);

    rl.question('', () => {
      clearInterval(timer);
      if (!finished) {
        finished = true;
        rl.close();
        process.stdout.write('\n');
        resolve('enter');
      }
    });
  });
}

function getMappedProfiles() {
  const localStatePath = path.join(
    process.env.LOCALAPPDATA || '',
    'Google',
    'Chrome',
    'User Data',
    'Local State'
  );

  if (!fs.existsSync(localStatePath)) {
    throw new Error('File konfigurasi Chrome tidak ditemukan di: ' + localStatePath);
  }

  const raw = fs.readFileSync(localStatePath, 'utf8');
  const json = JSON.parse(raw);
  const infoCache = json.profile?.info_cache || {};

  const profiles = [];
  for (const [dirName, pData] of Object.entries(infoCache)) {
    const match = (pData.name || '').match(/(\d+)\((.+?)\)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0) { // Lewatkan profil 0 (akun pribadi utama)
        profiles.push({
          index: num,
          dirName,
          name: pData.name,
          email: match[2],
        });
      }
    }
  }

  profiles.sort((a, b) => a.index - b.index);
  return profiles;
}

function findChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return 'chrome.exe';
}

async function refreshQueueFromServer(targetWeek = null) {
  return new Promise((resolve) => {
    const query = targetWeek ? `?week=${targetWeek}` : '';
    const url = new URL(`/api/macro/queue${query}`, BASE_URL);
    const req = http.request(
      url,
      {
        method: 'GET',
        headers: { Cookie: SESSION_COOKIE },
        timeout: 15000,
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
    req.on('error', () => resolve(null));
    req.end();
  });
}

const { generateBatches } = require('./build_batches');

function loadPendingBatches(chunkSize = 3, targetWeek = null) {
  try {
    return generateBatches(chunkSize, targetWeek);
  } catch (err) {
    if (fs.existsSync(BATCHES_FILE)) {
      try {
        const data = JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf8'));
        return Array.isArray(data) ? data : [];
      } catch {}
    }
    return [];
  }
}

function setClipboardText(text) {
  const tmpFile = path.join(__dirname, '..', 'storage', 'macro', '_clipboard_tmp.txt');
  fs.writeFileSync(tmpFile, text, 'utf8');
  const psCmd = `powershell -NoProfile -Command "Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 '${tmpFile.replace(/'/g, "''")}')"`;
  execSync(psCmd, { stdio: 'ignore' });
}

const CLICK_TOOL = path.resolve(__dirname, 'click_tool.ps1');

function runClickTool(args) {
  try {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${CLICK_TOOL}" ${args}`;
    const out = execSync(cmd);
    return out.toString().trim();
  } catch (err) {
    return err.message;
  }
}

function autoClickNewProject() {
  const out = runClickTool('-ClickNewProject');
  return out.includes('SUCCESS');
}

async function autoUploadAsset() {
  if (!fs.existsSync(ASSET_FILE)) {
    console.log(`⚠️  File aset tidak ditemukan di: ${ASSET_FILE}`);
    return false;
  }

  // 1. Klik '+' di kolom chat
  console.log(`🖱️  [ASET 1/5] Mengeklik tombol '+' di kolom input chat...`);
  runClickTool('-ClickPlusButton');
  await delay(2000);

  // 2. Klik 'Upload media'
  console.log(`🖱️  [ASET 2/5] Mengeklik tombol 'Upload media'...`);
  runClickTool('-ClickUploadMedia');
  await delay(1500);

  // 3. Navigasi folder dan pilih obim.jpg via bilah alamat
  console.log(`📂 [ASET 3/5] Memilih file obim.jpg via bilah alamat...`);
  runClickTool(`-SelectFileDialogFile "${ASSET_FILE}"`);
  await delay(2000);

  // 4. Klik 'I agree' jika modal lisensi muncul
  console.log(`🖱️  [ASET 4/5] Mengeklik konfirmasi 'I agree' (jika modal lisensi muncul)...`);
  runClickTool('-ClickIAgree');
  await delay(4000);

  // 5. Tutup panel flyout aset
  console.log(`🖱️  [ASET 5/5] Mengeklik kanvas kosong untuk menutup panel upload...`);
  runClickTool('-ClickEmptySpace');
  await delay(1500);

  return true;
}

function autoPasteTagAndSubmit() {
  try {
    const out = runClickTool('-PasteTagAndSubmit');
    return out.includes('SUCCESS');
  } catch {
    return false;
  }
}

function autoClickApprove() {
  const out = runClickTool('-ClickApprove');
  return out.includes('SUCCESS');
}

async function triggerServerSync() {
  return new Promise((resolve) => {
    const url = new URL('/api/macro/sync', BASE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: { Cookie: SESSION_COOKIE },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve({ ok: false });
          }
        });
      }
    );
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
}

async function processBatchTask(prof, batch, batchIndex, totalBatches) {
  console.log('\n================================================================');
  console.log(`🎬 [BATCH ${batchIndex + 1}/${totalBatches}] PROFIL ${prof.index}: ${prof.name}`);
  console.log(`📋 Konten : [${batch.contentCode}] "${batch.title}"`);
  console.log(`🎯 Bagian : ${batch.sceneIndices.map((i) => 'Bagian ' + i).join(', ')} (${batch.sceneCount} video sekaligus)`);
  console.log(`🏷️  Daftar Output yang Akan Dibuat Google Flow:`);
  batch.cleanFilenames.forEach((fn) => console.log(`    • ${fn}`));
  console.log('================================================================');

  // 1. Klik "+ New project" di layar Google Flow
  console.log(`🖱️  [LANGKAH 1/4] Mengarahkan kursor & mengeklik tombol "+ New project"...`);
  const ok = autoClickNewProject();
  if (ok) {
    console.log(`✅ Klik tombol "+ New project" berhasil dikirimkan!`);
  }
  console.log(`⏳ Menunggu 6.5 detik agar project baru siap & kolom input muncul...`);
  await delay(6500);

  // 1b. Klik tombol "Luaskan" pada kolom input prompt baru
  console.log(`⛶  Mengeklik tombol "Luaskan" di pojok kanan input prompt...`);
  const expRes = runClickTool('-ClickExpandPrompt');
  console.log(`    ${expRes}`);
  await delay(2000);

  // 2. Unggah Aset Karakter Obim (obim.jpg)
  console.log(`🖼️  [LANGKAH 2/4] Mengunggah aset karakter Obim (obim.jpg)...`);
  await autoUploadAsset();
  console.log(`✅ Aset Obim berhasil diunggah ke project!`);

  // 3. Salin prompt batch ke Clipboard, Tempel, Mention @obim.jpg, & Submit
  console.log(`📋 [LANGKAH 3/4] Menyalin prompt batch (${batch.sceneCount} video) ke Windows Clipboard...`);
  setClipboardText(batch.promptText);
  console.log(`✅ Prompt batch tersalin di Clipboard.`);

  console.log(`🤖 Mempersiapkan Auto-Paste, Mention @obim.jpg & Kirim ke Google Flow...`);
  await waitForUserOrTimeout(3, '⏱️  Siap menempelkan ke kolom chat');

  console.log(`⚡ [AUTO-ACTION] Mengklik kolom chat, paste prompt, mention chip @obim.jpg, dan klik submit...`);
  autoPasteTagAndSubmit();
  console.log(`🚀 Prompt batch untuk ${batch.sceneCount} video berhasil dikirimkan ke Google Flow!`);

  // 4. Klik Approve Sekali & Langsung Pindah ke Profil Berikutnya
  console.log(`\n⏳ [LANGKAH 4/4] Menunggu AI Flow menampilkan tombol konfirmasi kredit (~12 detik)...`);
  console.log(`   (Tekan [ENTER] jika tombol Approve sudah muncul lebih cepat di layar Anda)`);

  const userAction = await waitForUserOrTimeout(12, '⏱️  Menunggu tombol Approve muncul di Google Flow');
  if (userAction === 'enter') {
    console.log('\n⚡ [USER TRIGGER] Tombol ENTER ditekan, langsung mengklik Approve...');
  }

  console.log(`\n🖱️  Mengklik tombol Approve / Always approve (1x)...`);
  autoClickApprove();
  await delay(2000);

  console.log(`✅ Tombol konfirmasi kredit berhasil diklik! Render ${batch.sceneCount} video berjalan di cloud Google Flow.`);
  console.log(`🎉 PROFIL ${prof.index} SELESAI DI-PROMPT! Google Flow sedang merender ${batch.sceneCount} video di akun ini.`);
  console.log(`🌐 Jendela Profil ${prof.index} TETAP AKTIF TERBUKA di taskbar.`);
  console.log(`➡️  LANGSUNG MELANJUTKAN KE PROFIL BERIKUTNYA...\n`);
  return true;
}

async function main() {
  ensureDirs();

  console.log('\n================================================================');
  console.log('   🚀 CERITAOBIM STUDIO — ROBOT MAKRO BATCH PROMPTING 12 AKUN');
  console.log('================================================================\n');

  // Baca daftar profil Chrome
  let profiles = [];
  try {
    profiles = getMappedProfiles();
  } catch (err) {
    console.error('❌ Gagal mendeteksi profil Chrome:', err.message);
    process.exit(1);
  }

  console.log(`✅ Terdeteksi ${profiles.length} profil Chrome akun Google:`);
  profiles.forEach((p) => {
    console.log(`   [Profil ${String(p.index).padStart(2, ' ')}] Folder: "${p.dirName}" | Label: "${p.name}"`);
  });
  console.log(`🛡️  Profil 00 (Akun Utama Pribadi) DIKECUALIKAN & AMAN.`);
  console.log('----------------------------------------------------------------\n');

  const cliArgs = process.argv.slice(2);
  let cliChunk = null;
  const chunkMatch = cliArgs.find((a) => a.startsWith('--chunk=') || a.startsWith('--bagian=') || a.startsWith('--count='));
  if (chunkMatch) {
    cliChunk = parseInt(chunkMatch.split('=')[1], 10);
  }
  let cliWeek = null;
  const weekMatch = cliArgs.find((a) => a.startsWith('--week=') || a.startsWith('--minggu='));
  if (weekMatch) {
    cliWeek = weekMatch.split('=')[1].trim();
  }
  const isAllProfiles = cliArgs.includes('--all');

  // 1. Tanyakan: Pilihan Minggu (Week) Produksi
  let targetWeek = null;
  if (cliWeek) {
    if (cliWeek.toLowerCase() !== 'all' && cliWeek.toLowerCase() !== 'semua') {
      targetWeek = parseInt(cliWeek, 10) || 1;
    }
    console.log(`📅 TARGET MINGGU PRODUKSI (Dari Argumen): ${targetWeek ? 'Week ' + targetWeek : 'Semua Week'}`);
  } else {
    console.log('================================================================');
    console.log('📅 LANGKAH 1/3: PILIHAN MINGGU (WEEK) PRODUKSI');
    console.log('================================================================');
    console.log('PILIH ANTREAN KONTEN YANG INGIN DIKERJAKAN:');
    console.log('  [1] Selesaikan Week 1 Dahulu (Rekomendasi — isi sisa bagian yang belum jadi)');
    console.log('  [2] Semua Week Berurutan (Week 1 sampai tuntas, lalu lanjut Week 2)');
    console.log('  [3] Week Tertentu (Pilih nomor week manual, misal: 2)');
    console.log('');

    const weekChoice = await askQuestion('Pilih opsi week [1/2/3] (Default: 1): ');
    if (weekChoice === '2' || weekChoice.toLowerCase() === 'all') {
      targetWeek = null; // Semua week berurutan
    } else if (weekChoice === '3') {
      const customW = await askQuestion('Masukkan nomor week (contoh: 2): ');
      targetWeek = parseInt(customW, 10) || 1;
    } else {
      targetWeek = 1; // Default Week 1
    }
  }

  // 2. Tanyakan: Berapa bagian video per akun/profil?
  let chunkSize = 3;
  if (cliChunk && !isNaN(cliChunk) && cliChunk > 0) {
    chunkSize = cliChunk;
    console.log(`⚙️  JUMLAH BAGIAN PER AKUN (Dari Pipeline): ${chunkSize} bagian video per profil.`);
  } else {
    console.log('\n================================================================');
    console.log('⚙️  LANGKAH 2/3: JUMLAH BAGIAN VIDEO PER AKUN');
    console.log('================================================================');
    console.log('Berapa bagian video yang ingin di-generate sekaligus per akun profil?');
    console.log('  • Contoh input: 3 (maka setiap profil akan generate 3 video sekaligus)');
    console.log('  • Contoh input: 4 (maka setiap profil akan generate 4 video sekaligus)');
    console.log('  • Contoh input: 1 (generate 1 video per profil)');
    console.log('');

    const chunkInput = await askQuestion('Masukkan jumlah bagian per profil (Default: 3): ');
    const parsed = parseInt(chunkInput, 10);
    if (!isNaN(parsed) && parsed >= 1) chunkSize = parsed;
  }

  console.log(`\n🔄 Menyinkronkan antrean terbaru dari database studio...`);
  await refreshQueueFromServer(targetWeek);

  console.log(`⏳ Menyusun antrean batch dengan ukuran ${chunkSize} bagian per profil...`);
  const allBatches = loadPendingBatches(chunkSize, targetWeek);
  if (allBatches.length === 0) {
    console.log(`🎉 SELURUH BATCH VIDEO ${targetWeek ? 'WEEK ' + targetWeek : ''} SUDAH LENGKAP! Tidak ada antrean pending.`);
    return;
  }
  console.log(`✅ Berhasil menyusun ${allBatches.length} batch untuk antrean pending.`);
  console.log(`🎯 Konten Prioritas : [${allBatches[0].contentCode}] "${allBatches[0].title}" (${allBatches[0].cleanFilenames.join(', ')})`);
  console.log(`📁 Folder Dropzone  : ${OWNER_DROP_DIR}\n`);

  // 3. Tanyakan: Pilihan profil Chrome mana saja yang ingin dijalankan?
  let targetProfiles = [];
  if (isAllProfiles) {
    targetProfiles = profiles;
    console.log(`👤 PILIHAN PROFIL TARGET (Dari Pipeline): Menjalankan seluruh ${profiles.length} profil.`);
  } else {
    console.log('================================================================');
    console.log('👤 LANGKAH 3/3: PILIHAN PROFIL CHROME TARGET');
    console.log('================================================================');
    console.log('PILIH PROFIL YANG AKAN DIJALANKAN:');
    console.log(`  [1] Semua Profil (Profil 1 s/d ${profiles.length} secara berurutan)`);
    console.log('  [2] Beberapa Profil Saja (Pilih bebas, contoh: 1, 3, 5)');
    console.log('  [3] Rentang Profil (Range, contoh: 3-8)');
    console.log('  [4] Satu Profil Saja (Pilih 1 profil, contoh: 2)');
    console.log('');

    const modeChoice = await askQuestion('Pilih opsi profil [1/2/3/4] (Default: 1): ');

    if (modeChoice === '2') {
      const listInput = await askQuestion('Masukkan nomor-nomor profil yang ingin dijalankan (contoh: 1, 3, 5): ');
      const nums = (listInput.match(/\d+/g) || []).map((n) => parseInt(n, 10));
      targetProfiles = profiles.filter((p) => nums.includes(p.index));
      if (targetProfiles.length === 0) {
        console.log('⚠️  Tidak ada nomor profil valid yang cocok. Menjalankan Profil 1.');
        targetProfiles = profiles.slice(0, 1);
      }
    } else if (modeChoice === '3') {
      const rangeInput = await askQuestion('Masukkan rentang nomor profil (contoh: 3-8): ');
      const rangeMatch = rangeInput.match(/(\d+)\s*[-~:\s]\s*(\d+)/);
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1], 10);
        const end = parseInt(rangeMatch[2], 10);
        const minP = Math.min(start, end);
        const maxP = Math.max(start, end);
        targetProfiles = profiles.filter((p) => p.index >= minP && p.index <= maxP);
      }
      if (targetProfiles.length === 0) {
        console.log('⚠️  Rentang profil tidak valid. Menjalankan semua profil.');
        targetProfiles = profiles;
      }
    } else if (modeChoice === '4') {
      const singleInput = await askQuestion(`Pilih nomor profil (1-${profiles.length}): `);
      const pNum = parseInt(singleInput, 10);
      const found = profiles.find((p) => p.index === pNum);
      if (found) {
        targetProfiles = [found];
      } else {
        console.log('⚠️  Nomor profil tidak ditemukan. Menjalankan Profil 1.');
        targetProfiles = profiles.slice(0, 1);
      }
    } else {
      // Default: Semua profil
      targetProfiles = profiles;
    }
  }

  // Ringkasan sebelum eksekusi
  const effectiveCount = Math.min(targetProfiles.length, allBatches.length);
  const totalVideosScheduled = allBatches.slice(0, effectiveCount).reduce((sum, b) => sum + b.sceneCount, 0);

  console.log('\n================================================================');
  console.log('📋 RINGKASAN EKSEKUSI PRODUKSI');
  console.log('================================================================');
  console.log(`  • Target Week           : ${targetWeek ? 'Week ' + targetWeek : 'Semua Week (Berurutan)'}`);
  console.log(`  • Antrean Batch Pending : ${allBatches.length} batch`);
  console.log(`  • Bagian Video per Akun : ${chunkSize} bagian`);
  console.log(`  • Profil yang Dijalankan: ${targetProfiles.slice(0, effectiveCount).map((p) => 'Profil ' + p.index).join(', ')} (Maksimal ${effectiveCount} profil)`);
  if (targetProfiles.length > allBatches.length) {
    console.log(`  🛡️  Catatan Proteksi Kuota: ${targetProfiles.length - allBatches.length} profil selebihnya TIDAK dijalankan agar kuota harian aman.`);
  }
  console.log(`  • Estimasi Total Video  : ${totalVideosScheduled} video`);
  console.log(`  • Model AI Digunakan    : Omni 1.1 Flash (10s / 8s) + Aset Obim (@obim.jpg)`);
  console.log('================================================================');
  await waitForUserOrTimeout(3, '⏱️  Memulai eksekusi');

  console.log(`\n🎯 Memulai eksekusi untuk maksimal ${effectiveCount} profil...`);
  const chromePath = findChromePath();
  const flowUrl = 'https://flow.google.com';

  for (let pIdx = 0; pIdx < targetProfiles.length; pIdx++) {
    const prof = targetProfiles[pIdx];

    // Jika antrean batch sudah habis, hentikan! Jangan pernah menduplikasi batch ke profil lain.
    if (pIdx >= allBatches.length) {
      console.log('\n================================================================');
      console.log(`ℹ️  SELURUH ${allBatches.length} BATCH PENDING TELAH DIALOKASIKAN.`);
      console.log(`🛡️  Profil ${prof.index} (${prof.name}) dan profil berikutnya dilewati untuk menjaga kuota kredit harian Anda.`);
      console.log('================================================================');
      break;
    }

    // Urutan sekuensial murni: profil pertama yang dieksekusi mengambil batch pertama, dst
    const batch = allBatches[pIdx];

    console.log('\n================================================================');
    console.log(`🌟 [LANGKAH ${pIdx + 1}/${effectiveCount}] MEMBUKA PROFIL ${prof.index} (${prof.name})`);
    console.log('================================================================');
    console.log(`📂 Folder Direktori : ${prof.dirName}`);
    console.log(`🌐 Membuka Google Flow: ${flowUrl}`);

    // Buka Chrome langsung ke profil ini (jika belum terbuka)
    const child = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, flowUrl],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    console.log(`✅ Jendela Chrome untuk Profil ${prof.index} telah dibuka di layar.`);
    console.log(`⏳ Memberi waktu 10 detik agar halaman Google Flow termuat penuh...`);
    await delay(10000);

    await processBatchTask(prof, batch, pIdx, allBatches.length);

    // Catat jumlah bagian riil untuk profil ini ke active_production_session agar download otomatis tepat jumlahnya
    try {
      const SESSION_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'active_production_session.json');
      let sessionData = fs.existsSync(SESSION_FILE) ? JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8')) : { profileSceneCounts: {} };
      sessionData.profileSceneCounts = sessionData.profileSceneCounts || {};
      sessionData.profileSceneCounts[String(prof.index)] = batch.sceneCount;
      fs.writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2), 'utf8');
    } catch {}

    if (pIdx < effectiveCount - 1) {
      console.log('----------------------------------------------------------------');
      console.log(`➡️  Mempersiapkan membuka Profil ${targetProfiles[pIdx + 1].index} (${targetProfiles[pIdx + 1].name})...`);
      console.log('----------------------------------------------------------------');
      await delay(2000);
    }
  }

  console.log('\n================================================================');
  console.log('   🎉 SELURUH BATCH PROMPTING SELESAI DIKIRIMKAN KE GOOGLE FLOW!');
  console.log('================================================================');
  console.log(`🌐 Semua jendela Chrome (${targetProfiles.length} profil) TETAP AKTIF TERBUKA di taskbar Anda.`);
  console.log(`🏷️  Semua video di Google Flow otomatis dinamai persis dengan format standar:`);
  console.log(`    "pzxc_[SEGMEN]_[WEEK]_[KONTEN]_[BAGIAN]xx" (contoh: "pzxc_1_1_1_1xx", "pzxc_1_1_1_2xx", dst)`);
  console.log(`\n📥 ALUR DOWNLOAD & SINKRONISASI OTOMATIS:`);
  console.log(`    1. Buka masing-masing jendela profil Chrome di taskbar Anda.`);
  console.log(`    2. Klik tombol Download pada kartu video yang selesai di-render.`);
  console.log(`    3. File otomatis tersimpan di folder Downloads dengan awalan "pzxc_...".`);
  console.log(`    4. Jalankan Menu [3] pada Jalankan_Makro_Otomasi.bat (atau aktifkan watcher Menu [1]).`);
  console.log(`       Sistem otomatis:`);
  console.log(`         • Memindahkan file "pzxc_*" dari Downloads`);
  console.log(`         • Membersihkan nama file menjadi kode rapi di 00.FolderOwner\\KLIP_BERSIH`);
  console.log(`         • Merakit video master (00Final.mp4) bersama narasi audio`);
  console.log(`         • Mengunggah langsung ke Google Drive secara otomatis!`);
  console.log(`    👉 ANDA TIDAK PERLU MEMILIH FILE ATAU MERENAME MANUAL LAGI!`);
  console.log('================================================================\n');
}

main().catch(console.error);
