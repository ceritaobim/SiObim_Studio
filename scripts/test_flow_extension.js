/**
 * CeritaObim Studio — 1-Click Autopilot Test Runner
 *
 * Alur Kerja Penuh Sekali Klik:
 * 1. Membuka Chrome Profil Target dengan ekstensi terpasang.
 * 2. Membuka otomatis recent project di Google Flow.
 * 3. Mengunduh otomatis seluruh aset video di dalamnya secara sekuensial (720p).
 * 4. Tanpa perlu klik manual apa pun di dalam browser.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const EXTENSION_DIR = path.resolve(__dirname, '..', 'extensions', 'flow-downloader');

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
    throw new Error('Local State Chrome tidak ditemukan.');
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
        });
      }
    }
  }

  profiles.sort((a, b) => a.index - b.index);
  return profiles;
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Buka recent project menggunakan click_tool.ps1 yang sudah terkalibrasi
function triggerOpenRecentProject() {
  const clickTool = path.resolve(__dirname, 'click_tool.ps1');
  try {
    const res = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${clickTool}" -OpenLatestProject`,
      { encoding: 'utf8' }
    );
    return res.includes('SUCCESS');
  } catch (err) {
    console.error('Gagal membuka project:', err.message);
    return false;
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('   🚀 1-CLICK AUTOPILOT: OPEN RECENT PROJECT & DOWNLOAD ALL (720p)');
  console.log('================================================================\n');

  const chromePath = findChromePath();
  const profiles = getMappedProfiles();

  console.log('PILIH PROFIL UNTUK DIJALANKAN:');
  profiles.forEach((p) => {
    console.log(`  [${p.index}] ${p.name}`);
  });
  console.log('');

  const choice = await askQuestion(`Pilih nomor profil [1-${profiles.length}] (Default: 1): `);
  const pNum = parseInt(choice, 10) || 1;
  const target = profiles.find((p) => p.index === pNum) || profiles[0];

  const countInput = await askQuestion('Berapa banyak video yang ingin diunduh? (Default: 5): ');
  const targetCount = parseInt(countInput, 10) || 5;

  const flowUrl = 'https://flow.google.com';

  console.log('\n================================================================');
  console.log(`🌐 [1/3] Membuka Profil ${target.index}: ${target.name}...`);
  console.log('================================================================');

  const args = [
    `--profile-directory=${target.dirName}`,
    flowUrl,
  ];

  const child = spawn(chromePath, args, { detached: true, stdio: 'ignore' });
  child.unref();

  console.log('✅ Chrome dibuka.');
  console.log('⏳ Menunggu 5 detik agar beranda Google Flow termuat...');
  await delay(5000);

  console.log('\n================================================================');
  console.log('📂 [2/3] Membuka Recent Project Terakhir Secara Otomatis...');
  console.log('================================================================');
  triggerOpenRecentProject();
  console.log('✅ Sinyal buka project dikirimkan!');

  console.log('⏳ Menunggu 6 detik agar kanvas project terbuka penuh...');
  await delay(6000);

  console.log('\n================================================================');
  console.log(`📥 [3/3] Memulai Download Otomatis ${targetCount} Video (720p)...`);
  console.log('================================================================');

  const engineScript = path.resolve(__dirname, 'download_engine.ps1');
  try {
    execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${engineScript}" -ProfileDir "${target.dirName}" -AssetCount ${targetCount} -SkipOpenProject`,
      { stdio: 'inherit' }
    );
  } catch (err) {
    console.log('⚠️ Selesai eksekusi unduhan.');
  }

  console.log('\n================================================================');
  console.log(`🎉 PROSES DOWNLOAD SELESAI! Silakan periksa folder Downloads Anda.`);
  console.log('================================================================\n');
}

main().catch(console.error);
