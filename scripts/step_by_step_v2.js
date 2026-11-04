/**
 * CeritaObim Studio — Step-by-Step Modular Macro Runner V2
 * 
 * Memungkinkan eksekusi 1 per 1 langkah untuk verifikasi visual langsung:
 * Langkah 1 : Buka Google Flow & Klik "+ New project"
 * Langkah 2 : Klik tombol "Luaskan" (buka panel kanan)
 * Langkah 3 : Unggah aset obim.jpg
 * Langkah 4 : Tempel prompt & kunci chip @obim.jpg
 * Langkah 5 : Klik tombol panah kirim (Submit Arrow)
 * Langkah 6 : Klik Approve 1x
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const CLICK_TOOL = path.resolve(__dirname, 'click_tool_v2.ps1');
const ASSET_FILE = path.resolve(__dirname, '..', '00.FolderOwner', 'assets', 'obim.jpg');
const BATCHES_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'pending_batches.json');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

const { generateBatches } = require('./build_batches');

function getSampleBatch() {
  try {
    const batches = generateBatches(3);
    if (batches && batches.length > 0) return batches[0];
  } catch {}
  if (fs.existsSync(BATCHES_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf8'));
      if (data && data.length > 0) return data[0];
    } catch {}
  }
  return {
    contentCode: 'CO-TEST',
    title: 'Uji Coba Karakter Obim',
    sceneCount: 3,
    promptText: 'Uji coba prompt karakter Obim origami.',
  };
}

async function main() {
  const args = process.argv.slice(2);
  let step = 1;
  const stepMatch = args.find((a) => a.startsWith('--step='));
  if (stepMatch) step = parseInt(stepMatch.split('=')[1], 10);

  let profNum = 4;
  const profMatch = args.find((a) => a.startsWith('--profile=') || a.startsWith('--single='));
  if (profMatch) profNum = parseInt(profMatch.split('=')[1], 10);

  const profiles = getMappedProfiles();
  const targetProf = profiles.find((p) => p.index === profNum) || profiles[0];

  console.log('================================================================');
  console.log(`🧪 CERITAOBIM STUDIO — PENGUJIAN MODULAR (LANGKAH ${step})`);
  console.log(`👤 Profil Target : Profil ${targetProf.index} (${targetProf.name})`);
  console.log('================================================================\n');

  if (step === 1) {
    console.log(`🌐 [LANGKAH 1] Membuka Google Flow: https://flow.google.com ...`);
    const chromePath = findChromePath();
    const flowUrl = 'https://flow.google.com';

    const child = spawn(
      chromePath,
      [`--profile-directory=${targetProf.dirName}`, flowUrl],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    console.log(`✅ Jendela Chrome untuk Profil ${targetProf.index} telah dibuka.`);
    console.log(`⏳ Menunggu 9 detik agar halaman Google Flow termuat penuh di layar...`);
    await delay(9000);

    console.log(`🖱️  Mengeklik tombol "+ New project"...`);
    const res = runClickTool('-ClickNewProject');
    console.log(`   ${res}`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH 1:');
    console.log('   Lihat jendela Chrome Anda sekarang:');
    console.log('   • Apakah halaman project baru Google Flow sudah terbuka?');
    console.log('   • Jika ya, Anda bisa lanjut ke Langkah 2 (Luaskan Panel).');
    console.log('================================================================\n');
    return;
  }

  if (step === 2) {
    console.log(`⛶  [LANGKAH 2] Mengeklik tombol "Luaskan" di pojok kanan input prompt...`);
    const res = runClickTool('-ClickExpandPrompt');
    console.log(`   ${res}`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH 2:');
    console.log('   • Apakah panel chat di sebelah kanan sudah terbuka luas?');
    console.log('================================================================\n');
    return;
  }

  if (step === 3) {
    console.log(`🖼️  [LANGKAH 3] Mengunggah aset karakter Obim (obim.jpg)...`);
    if (!fs.existsSync(ASSET_FILE)) {
      console.log(`❌ File aset tidak ditemukan di: ${ASSET_FILE}`);
      return;
    }

    console.log(`   1. Klik '+' di kolom chat...`);
    runClickTool('-ClickPlusButton');
    await delay(1800);

    console.log(`   2. Klik 'Upload media'...`);
    runClickTool('-ClickUploadMedia');
    await delay(1500);

    console.log(`   3. Memilih file obim.jpg via Explorer...`);
    runClickTool(`-SelectFileDialogFile "${ASSET_FILE}"`);
    await delay(2000);

    console.log(`   4. Konfirmasi lisensi 'I agree'...`);
    runClickTool('-ClickIAgree');
    await delay(3500);

    console.log(`   5. Menutup panel flyout aset...`);
    runClickTool('-ClickEmptySpace');
    await delay(1200);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH 3:');
    console.log('   • Apakah gambar obim.jpg sudah muncul di kanvas project?');
    console.log('================================================================\n');
    return;
  }

  if (step === 4) {
    console.log(`📋 [LANGKAH 4] Menyalin prompt batch, paste, dan kunci chip @obim.jpg...`);
    const batch = getSampleBatch();
    console.log(`   Menyalin prompt untuk: [${batch.contentCode}] "${batch.title}"`);
    setClipboardText(batch.promptText);
    await delay(800);

    console.log(`   Fokus ke chatbox, paste prompt, dan kunci chip @obim.jpg (TANPA MENGIRIM)...`);
    const res = runClickTool('-PasteAndTagObim');
    console.log(`   ${res}`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH 4:');
    console.log('   • Apakah teks prompt sudah tertempel di kotak chat?');
    console.log('   • Apakah chip biru/bulat @obim.jpg sudah terkunci di ujung teks?');
    console.log('   • (Prompt SENGAJA BELUM DIKIRIM agar kuota kredit aman).');
    console.log('================================================================\n');
    return;
  }

  if (step === 5) {
    console.log(`🚀 [LANGKAH 5] Mengeklik tombol panah kirim (Submit Arrow) di pojok kanan bawah...`);
    const res = runClickTool('-PasteTagAndSubmit');
    console.log(`   ${res}`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH 5:');
    console.log('   • Apakah prompt berhasil terkirim ke Google Flow?');
    console.log('   • Apakah ikon panah mulai berputar/loading merespons?');
    console.log('================================================================\n');
    return;
  }

  if (step === 6) {
    console.log(`🖱️  [LANGKAH 6] Mengeklik tombol Approve / Always approve (1x bersih)...`);
    const res = runClickTool('-ClickApprove');
    console.log(`   ${res}`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH 6:');
    console.log('   • Apakah dialog konfirmasi kredit berhasil di-approve?');
    console.log('   • Apakah render video sudah mulai berjalan di Google Flow?');
    console.log('================================================================\n');
    return;
  }
}

main().catch(console.error);
