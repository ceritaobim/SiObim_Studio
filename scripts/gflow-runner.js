/**
 * CeritaObim Studio — Runner Rotasi Profil Chrome (Google Flow & Obim Studio)
 * Mendukung rotasi 10 profil Chrome (Profil 1 s/d 10) atau uji coba 3 profil.
 * Profil 0 (pribadi/main) selalu aman dan tidak pernah disentuh.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

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
      if (num > 0) { // Lewatkan profil 0 (pribadi)
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function countdown(seconds, message) {
  for (let i = seconds; i > 0; i--) {
    process.stdout.write(`\r⏱️  ${message}: ${i} detik tersisa...   `);
    await delay(1000);
  }
  process.stdout.write('\r                                                                       \r');
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

async function main() {
  console.log('\n================================================================');
  console.log('   🚀 CERITAOBIM STUDIO — ROTASI PROFIL CHROME (GOOGLE FLOW)');
  console.log('================================================================\n');

  let profiles = [];
  try {
    profiles = getMappedProfiles();
  } catch (err) {
    console.error('❌ Gagal mendeteksi profil Chrome:', err.message);
    process.exit(1);
  }

  if (profiles.length === 0) {
    console.error('❌ Tidak ditemukan profil Chrome dengan format 1(...), 2(...)!');
    console.log('💡 Pastikan Anda menamai profil Chrome Anda seperti: 1(email1), 2(email2)');
    process.exit(1);
  }

  console.log(`✅ Terdeteksi ${profiles.length} profil akun Google Flow di Chrome:`);
  profiles.forEach((p) => {
    console.log(`   [Profil ${String(p.index).padStart(2, ' ')}] Folder: "${p.dirName}" | Label: "${p.name}"`);
  });
  console.log(`🛡️  Profil 00 (Akun Utama Pribadi) DIKECUALIKAN & AMAN.`);
  console.log('----------------------------------------------------------------\n');

  // Baca argumen CLI jika ada (misal --all atau --limit=3)
  const args = process.argv.slice(2);
  let targetProfiles = profiles;
  let intervalSec = 20;

  if (args.includes('--3') || args.includes('-3')) {
    targetProfiles = profiles.slice(0, 3);
  } else if (args.includes('--all') || args.includes('-a')) {
    targetProfiles = profiles;
  } else {
    // Tanyakan interaktif jika tidak ada flag
    console.log('PILIH MODE ROTASI:');
    console.log('  [1] Jalankan SEMUA 10 Profil Bergantian (Rekomendasi Produksi)');
    console.log('  [2] Uji Coba 3 Profil Saja (Profil 1, 2, 3)');
    console.log('  [3] Buka Satu Profil Tertentu Saja (Pilih Nomor 1-10)');
    console.log('');
    const choice = await askQuestion('Masukkan pilihan Anda [1/2/3] (Default: 1): ');

    if (choice === '2') {
      targetProfiles = profiles.slice(0, 3);
    } else if (choice === '3') {
      const pNum = await askQuestion(`Pilih nomor profil (1-${profiles.length}): `);
      const found = profiles.find((p) => p.index === parseInt(pNum, 10));
      if (found) {
        targetProfiles = [found];
      } else {
        console.log('⚠️ Nomor profil tidak valid. Menjalankan semua 10 profil.');
        targetProfiles = profiles;
      }
    } else {
      targetProfiles = profiles;
    }
  }

  console.log(`\n🎯 Mempersiapkan pembukaan ${targetProfiles.length} profil...`);
  const chromePath = findChromePath();
  const flowUrl = 'https://flow.google.com';
  const obimUrl = 'http://localhost:3000/assets';

  for (let i = 0; i < targetProfiles.length; i++) {
    const prof = targetProfiles[i];
    console.log('\n----------------------------------------------------------------');
    console.log(`▶️ [LANGKAH ${i + 1}/${targetProfiles.length}] MEMBUKA PROFIL ${prof.index}: ${prof.name}`);
    console.log('----------------------------------------------------------------');
    console.log(`📂 Folder Direktori Chrome : ${prof.dirName}`);
    console.log(`🌐 Google Flow URL         : ${flowUrl}`);
    console.log(`🎬 Obim Studio Video URL   : ${obimUrl}`);

    const chromeProcess = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, flowUrl, obimUrl],
      { detached: true, stdio: 'ignore' }
    );
    chromeProcess.unref();

    console.log(`✅ Jendela Chrome Profil ${prof.index} (${prof.name}) telah dibuka di layar.`);

    if (i < targetProfiles.length - 1) {
      console.log(`👉 Silakan gunakan profil ini. Menunggu profil berikutnya...`);
      await countdown(intervalSec, `Jeda sebelum membuka Profil ${targetProfiles[i + 1].index}`);
    } else {
      console.log(`\n🎉 Semua ${targetProfiles.length} profil telah dibuka.`);
    }
  }

  console.log('\n================================================================');
  console.log('   ✨ ROTASI PROFIL SELESAI!');
  console.log('================================================================');
  console.log('💡 TIPS WORKFLOW SELANJUTNYA:');
  console.log('1. Setiap video klip yang didownload dari Flow, simpan/arahkan ke:');
  console.log('   storage\\macro_drops');
  console.log('2. Jendela [1] Auto-Ingest Watcher akan otomatis menggabungkannya');
  console.log('   dengan audio Obim (Puck Bold) dan meng-upload ke Google Drive!');
  console.log('================================================================\n');
}

main().catch(console.error);
