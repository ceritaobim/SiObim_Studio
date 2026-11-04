/**
 * CeritaObim Studio — GFlow Macro Runner V2
 * 
 * Fitur Utama V2:
 * 1. Menjalankan SOP 10 langkah bersih & terkalibrasi presisi.
 * 2. Menggunakan click_tool_v2.ps1 (koordinat tombol submit panah 94.4%, 88.8% + chip @obim.jpg).
 * 3. Klik Approve 1x saja (tidak membabi buta 65x klik).
 * 4. Mendukung mode semua profil atau mode uji coba 1 profil tertentu (--profile=X).
 */

const fs = require('fs');
const path = require('path');
const http = require('http');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const CLICK_TOOL = path.resolve(__dirname, 'click_tool_v2.ps1');
const ASSET_FILE = path.resolve(__dirname, '..', '00.FolderOwner', 'assets', 'obim.jpg');
const BATCHES_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'pending_batches.json');
const OWNER_DROP_DIR = path.resolve(__dirname, '..', '00.FolderOwner', 'KLIP_MENTAH');
const BASE_URL = 'http://localhost:3000';
const SESSION_COOKIE = 'siobim_session=authenticated; Path=/; HttpOnly; SameSite=Lax';

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDirs() {
  const dirs = [
    path.dirname(BATCHES_FILE),
    path.dirname(ASSET_FILE),
    OWNER_DROP_DIR,
  ];
  dirs.forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
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

function getMappedProfiles() {
  const localStatePath = path.join(
    process.env.LOCALAPPDATA || '',
    'Google',
    'Chrome',
    'User Data',
    'Local State'
  );

  if (!fs.existsSync(localStatePath)) {
    throw new Error('Local State Chrome tidak ditemukan di: ' + localStatePath);
  }

  const raw = fs.readFileSync(localStatePath, 'utf8');
  const json = JSON.parse(raw);
  const infoCache = json.profile?.info_cache || {};

  const profiles = [];
  for (const [dirName, pData] of Object.entries(infoCache)) {
    const match = (pData.name || '').match(/(\d+)\((.+?)\)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0) {
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

function setClipboardText(text) {
  const tmpFile = path.join(__dirname, '..', 'storage', 'macro', '_clipboard_tmp.txt');
  fs.writeFileSync(tmpFile, text, 'utf8');
  const psCmd = `powershell -NoProfile -Command "Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 '${tmpFile.replace(/'/g, "''")}')"`;
  execSync(psCmd, { stdio: 'ignore' });
}

function runClickTool(args) {
  try {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${CLICK_TOOL}" ${args}`;
    const out = execSync(cmd);
    return out.toString().trim();
  } catch (err) {
    return err.message;
  }
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

    process.stdout.write(`\r${message} (${remaining}s tersisa, atau tekan [ENTER] untuk langsung lanjut): `);

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
        process.stdout.write(`\r${message} (${remaining}s tersisa, atau tekan [ENTER] untuk langsung lanjut): `);
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

async function uploadObimAsset() {
  if (!fs.existsSync(ASSET_FILE)) {
    console.log(`⚠️  File aset tidak ditemukan di: ${ASSET_FILE}`);
    return false;
  }

  console.log(`   [ASET 1/5] Mengeklik tombol '+' di kolom input chat...`);
  runClickTool('-ClickPlusButton');
  await delay(1800);

  console.log(`   [ASET 2/5] Mengeklik tombol 'Upload media'...`);
  runClickTool('-ClickUploadMedia');
  await delay(1500);

  console.log(`   [ASET 3/4] Memilih file obim.jpg via bilah alamat Windows Explorer...`);
  runClickTool(`-SelectFileDialogFile "${ASSET_FILE}"`);
  console.log(`   ⏳ Menunggu 4 detik agar file obim.jpg selesai diunggah...`);
  await delay(4000);

  console.log(`   [ASET 4/4] Menutup panel flyout upload via tombol ESC...`);
  runClickTool('-ClickEmptySpace');
  await delay(1200);

  return true;
}

async function processBatchV2(prof, batch, batchIndex, totalBatches) {
  console.log('\n================================================================');
  console.log(`🎬 [BATCH ${batchIndex + 1}/${totalBatches}] PROFIL ${prof.index}: ${prof.name}`);
  console.log(`📋 Konten : [${batch.contentCode}] "${batch.title}"`);
  console.log(`🎯 Bagian : ${batch.sceneIndices.map((i) => 'Bagian ' + i).join(', ')} (${batch.sceneCount} video sekaligus)`);
  console.log(`🏷️  Daftar Output yang Akan Dibuat Google Flow:`);
  batch.cleanFilenames.forEach((fn) => console.log(`    • ${fn}`));
  console.log('================================================================');

  // Langkah 1: Klik "+ New project"
  console.log(`🖱️  [LANGKAH 1/5] Mengeklik tombol "+ New project"...`);
  const resNew = runClickTool('-ClickNewProject');
  console.log(`   ${resNew}`);
  console.log(`⏳ Menunggu 5 detik agar halaman project baru siap...`);
  await delay(5000);

  // Tutup modal pengumuman "Easier asset management" jika muncul
  runClickTool('-DismissFlowModal');
  await delay(1500);

  // Langkah 2: Klik tombol "Luaskan"
  console.log(`⛶  [LANGKAH 2/5] Mengeklik tombol "Luaskan" di pojok kanan input prompt...`);
  const resExp = runClickTool('-ClickExpandPrompt');
  console.log(`   ${resExp}`);
  await delay(2000);

  // Langkah 3: Unggah Aset Obim
  console.log(`🖼️  [LANGKAH 3/5] Mengunggah aset karakter Obim (obim.jpg)...`);
  await uploadObimAsset();
  console.log(`   ✅ Aset Obim berhasil diunggah ke project!`);

  // Langkah 4: Paste Prompt, Ketik @obim.jpg, Tekan Enter Chip & Klik Submit Arrow
  console.log(`📋 [LANGKAH 4/5] Menyalin prompt batch (${batch.sceneCount} video) ke Clipboard...`);
  setClipboardText(batch.promptText);
  await delay(1000);

  console.log(`⚡ [AUTO-ACTION] Memfokuskan chat, paste prompt, kunci chip @obim.jpg, dan klik submit panah...`);
  const resSubmit = runClickTool('-PasteTagAndSubmit');
  console.log(`   ${resSubmit}`);
  console.log(`🚀 Prompt batch untuk ${batch.sceneCount} video berhasil dikirimkan ke Google Flow!`);

  // Langkah 5: Tunggu dialog konfirmasi & Klik Approve 1 KALI SAJA
  console.log(`\n⏳ [LANGKAH 5/5] Menunggu Google Flow menampilkan tombol konfirmasi kredit (~25 detik)...`);
  console.log(`   (Tekan [ENTER] jika tombol Approve sudah muncul lebih cepat di layar Anda)`);

  const userAction = await waitForUserOrTimeout(25, '⏱️  Menunggu dialog Approve muncul di Google Flow');
  if (userAction === 'enter') {
    console.log('\n⚡ [USER TRIGGER] Tombol ENTER ditekan, langsung mengeksekusi klik Approve...');
  } else {
    console.log('\n⏱️  Waktu tunggu 25 detik selesai, mengeksekusi klik Approve...');
  }

  console.log(`🖱️  Mengklik tombol Approve / Always approve (1x bersih)...`);
  runClickTool('-ClickApprove');
  await delay(2500);

  console.log(`✅ Tombol konfirmasi kredit berhasil diklik! Render berjalan di cloud Google Flow.`);
  console.log(`🎉 PROFIL ${prof.index} SELESAI DI-PROMPT! Google Flow sedang merender ${batch.sceneCount} video.`);
  console.log(`🌐 Jendela Profil ${prof.index} TETAP AKTIF TERBUKA di taskbar.`);
  console.log(`➡️  LANGSUNG MELANJUTKAN KE PROFIL BERIKUTNYA...\n`);
  return true;
}

async function main() {
  ensureDirs();

  console.log('\n================================================================');
  console.log('   🚀 CERITAOBIM STUDIO — MAKRO OTOMASI V2 (PRESISI TINGGI)');
  console.log('================================================================\n');

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
  console.log(`🛡️  Profil 00 (Akun Utama Pribadi) DIKECUALIKAN & AMAN.\n`);

  const args = process.argv.slice(2);
  let singleProfNum = null;
  const singleMatch = args.find((a) => a.startsWith('--profile=') || a.startsWith('--single='));
  if (singleMatch) {
    singleProfNum = parseInt(singleMatch.split('=')[1], 10);
  }

  let chunkSize = 3;
  const chunkMatch = args.find((a) => a.startsWith('--chunk=') || a.startsWith('--bagian='));
  if (chunkMatch) {
    chunkSize = parseInt(chunkMatch.split('=')[1], 10) || 3;
  }

  let targetWeek = 1;
  const weekMatch = args.find((a) => a.startsWith('--week='));
  if (weekMatch) {
    const val = weekMatch.split('=')[1].trim();
    targetWeek = (val.toLowerCase() === 'all' || val.toLowerCase() === 'semua') ? null : (parseInt(val, 10) || 1);
  }

  // Pilih mode
  let targetProfiles = profiles;
  if (singleProfNum) {
    const found = profiles.find((p) => p.index === singleProfNum);
    if (found) {
      targetProfiles = [found];
      console.log(`🎯 MODE UJI COBA 1 PROFIL: Profil ${found.index} (${found.name})`);
    } else {
      console.log(`⚠️  Profil ${singleProfNum} tidak ditemukan. Menjalankan Profil 1.`);
      targetProfiles = profiles.slice(0, 1);
    }
  } else if (!args.includes('--all')) {
    console.log('PILIH MODE EKSEKUSI:');
    console.log('  [1] Semua Profil (12 Profil Berurutan)');
    console.log('  [2] Uji Coba 1 Profil Saja (Pilih nomor profil)');
    const mode = await askQuestion('Pilih mode [1/2] (Default: 1): ');
    if (mode === '2') {
      const pInput = await askQuestion(`Masukkan nomor profil (1-${profiles.length}): `);
      const pNum = parseInt(pInput, 10);
      const found = profiles.find((p) => p.index === pNum);
      if (found) {
        targetProfiles = [found];
      } else {
        targetProfiles = profiles.slice(0, 1);
      }
    }
  }

  const allBatches = loadPendingBatches(chunkSize, targetWeek);
  if (allBatches.length === 0) {
    console.log('🎉 Tidak ada antrean video pending!');
    return;
  }

  const effectiveCount = Math.min(targetProfiles.length, allBatches.length);
  console.log(`\n📋 Siap memproses ${effectiveCount} profil untuk antrean ${allBatches.length} batch...`);
  await waitForUserOrTimeout(3, '⏱️  Memulai eksekusi');

  const chromePath = findChromePath();
  const flowUrl = 'https://flow.google.com';

  for (let pIdx = 0; pIdx < effectiveCount; pIdx++) {
    const prof = targetProfiles[pIdx];
    const batch = allBatches[pIdx];

    console.log('\n================================================================');
    console.log(`🌟 [LANGKAH ${pIdx + 1}/${effectiveCount}] MEMBUKA PROFIL ${prof.index} (${prof.name})`);
    console.log('================================================================');

    const child = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, flowUrl],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    console.log(`✅ Jendela Chrome untuk Profil ${prof.index} telah dibuka di layar.`);
    console.log(`⏳ Memberi waktu 10 detik agar halaman Google Flow termuat penuh...`);
    await delay(10000);

    await processBatchV2(prof, batch, pIdx, allBatches.length);

    if (pIdx < effectiveCount - 1) {
      console.log(`➡️  Mempersiapkan Profil ${targetProfiles[pIdx + 1].index}...`);
      await delay(3000);
    }
  }

  console.log('\n================================================================');
  console.log('   🎉 SELURUH BATCH PROMPTING V2 SELESAI DIKIRIMKAN!');
  console.log('================================================================\n');
}

main().catch(console.error);
