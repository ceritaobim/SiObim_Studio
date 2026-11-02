/**
 * CeritaObim Studio — Uji Coba: Upload Aset Karakter Obim + Tempel Prompt
 * 
 * Skenario:
 * 1. Buka Chrome Profil 1 -> https://flow.google.com
 * 2. Klik "+ New project"
 * 3. Klik tombol '+' di kolom chat kanan
 * 4. Klik tombol 'Upload media' pada panel flyout
 * 5. Pilih file aset: 00.FolderOwner\assets\obim.jpg
 * 6. Tunggu aset terunggah di Google Flow
 * 7. Tempel teks prompt batch ke kolom chat (HANYA PASTE — TIDAK MENGIRIM / TIDAK GENERATE)
 * 8. Berhenti agar pengguna dapat memeriksa hasilnya di layar!
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const CLICK_TOOL = path.resolve(__dirname, 'click_tool.ps1');
const ASSET_FILE = path.resolve(__dirname, '..', '00.FolderOwner', 'assets', 'obim.jpg');
const BATCHES_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'pending_batches.json');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

async function main() {
  console.log('================================================================');
  console.log('🧪 CERITAOBIM STUDIO — UJI COBA UPLOAD ASET OBIM & TEMPEL PROMPT');
  console.log('================================================================\n');

  if (!fs.existsSync(ASSET_FILE)) {
    console.error(`❌ File aset Obim tidak ditemukan di: ${ASSET_FILE}`);
    process.exit(1);
  }
  console.log(`🖼️  File Aset Referensi : ${ASSET_FILE}`);

  let batches = [];
  if (fs.existsSync(BATCHES_FILE)) {
    batches = JSON.parse(fs.readFileSync(BATCHES_FILE, 'utf8'));
  }
  const samplePrompt = batches[0]?.promptText || 'Uji coba prompt karakter Obim origami.';

  const profiles = getMappedProfiles();
  const targetProf = profiles[0]; // Profil 1
  if (!targetProf) {
    console.error('❌ Profil 1 Chrome tidak ditemukan.');
    process.exit(1);
  }

  console.log(`👤 Target Profil Chrome : Profil ${targetProf.index} (${targetProf.name})`);
  console.log(`🌐 Membuka Google Flow  : https://flow.google.com\n`);

  const chromePath = findChromePath();
  const flowUrl = 'https://flow.google.com';

  // 1. Buka Chrome Profil 1
  const child = spawn(
    chromePath,
    [`--profile-directory=${targetProf.dirName}`, flowUrl],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  console.log(`⏳ [1/5] Menunggu 5 detik agar Google Flow termuat...`);
  await delay(5000);

  // 2. Klik "+ New project"
  console.log(`🖱️  [2/5] Mengeklik tombol "+ New project"...`);
  const resNew = runClickTool('-ClickNewProject');
  console.log(`    Hasil: ${resNew}`);
  console.log(`⏳ Menunggu 6.5 detik agar halaman project baru siap...`);
  await delay(6500);

  // 2b. Klik tombol Luaskan
  console.log(`⛶  Mengeklik tombol "Luaskan" di pojok kanan input prompt...`);
  const resExp = runClickTool('-ClickExpandPrompt');
  console.log(`    Hasil: ${resExp}`);
  await delay(2000);

  // 3. Klik tombol '+' di kolom chat
  console.log(`🖱️  [3/5] Mengeklik tombol '+' di kolom input chat (bawah-kiri chatbox)...`);
  const resPlus = runClickTool('-ClickPlusButton');
  console.log(`    Hasil: ${resPlus}`);
  console.log(`⏳ Menunggu 2 detik agar flyout panel aset muncul...`);
  await delay(2000);

  // 4. Klik tombol 'Upload media' & Pilih file obim.jpg
  console.log(`🖱️  [4/7] Mengeklik tombol 'Upload media' pada flyout panel...`);
  const resUpload = runClickTool('-ClickUploadMedia');
  console.log(`    Hasil: ${resUpload}`);

  console.log(`📂 Memilih file '${path.basename(ASSET_FILE)}' via navigasi bilah alamat Windows Explorer...`);
  const resFile = runClickTool(`-SelectFileDialogFile "${ASSET_FILE}"`);
  console.log(`    Hasil: ${resFile}`);
  console.log(`⏳ Menunggu 2 detik untuk memeriksa modal persetujuan...`);
  await delay(2000);

  // 5. Klik 'I agree' pada modal "Rights to use this image" (jika muncul)
  console.log(`🖱️  [5/7] Mengeklik tombol 'I agree' pada modal lisensi (atau koordinat aman modal)...`);
  const resAgree = runClickTool('-ClickIAgree');
  console.log(`    Hasil: ${resAgree}`);
  console.log(`⏳ Menunggu 4 detik agar aset obim.jpg selesai diunggah di Google Flow...`);
  await delay(4000);

  // 6. Klik layar kosong untuk menutup panel upload aset
  console.log(`🖱️  [6/7] Mengeklik area kanvas kosong untuk menutup panel upload aset...`);
  const resDismiss = runClickTool('-ClickEmptySpace');
  console.log(`    Hasil: ${resDismiss}`);
  console.log(`⏳ Menunggu 1.5 detik agar panel upload tertutup sempurna...`);
  await delay(1500);

  // 7. Salin Prompt, Tempel, lalu Ketikkan @obim.jpg (TANPA MENGIRIM / TANPA GENERATE)
  console.log(`📋 [7/7] Menempelkan prompt batch & mengetikkan mention @obim.jpg...`);
  setClipboardText(samplePrompt);
  const resPaste = runClickTool('-PasteAndTagObim');
  console.log(`    Hasil: ${resPaste}`);

  console.log('\n================================================================');
  console.log('🎉 UJI COBA SELESAI!');
  console.log('================================================================');
  console.log('🔍 Silakan lihat jendela Google Flow di layar Anda sekarang:');
  console.log('   1. Apakah panel upload aset sudah tertutup?');
  console.log('   2. Apakah gambar obim.jpg sudah masuk ke project?');
  console.log('   3. Apakah teks prompt tertempel dengan tag @obim.jpg di akhir?');
  console.log('   4. (Prompt SENGAJA BELUM DIKIRIM, tidak memakan kuota kredit).');
  console.log('================================================================\n');
}

main().catch(console.error);
