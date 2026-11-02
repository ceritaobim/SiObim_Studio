/**
 * CeritaObim Studio — Uji Coba Download (2 Profil Chrome)
 *
 * Menjalankan otomatisasi unduh video hasil rekaman user (storage/macro/recorded_download_flow.json)
 * secara aman pada 2 profil Chrome (Profil 1 dan Profil 2).
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const RECORDED_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'recorded_download_flow.json');
const PLAY_SCRIPT = path.resolve(__dirname, 'play_recorded_clicks.ps1');

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

function getMappedProfiles() {
  const localStatePath = path.join(
    process.env.LOCALAPPDATA || '',
    'Google',
    'Chrome',
    'User Data',
    'Local State'
  );

  if (!fs.existsSync(localStatePath)) {
    throw new Error('File Local State Chrome tidak ditemukan di: ' + localStatePath);
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
          email: pData.user_name || match[2] || '',
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

function playRecordedClicks() {
  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${PLAY_SCRIPT}"`, {
      stdio: 'inherit',
    });
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  console.log('\n================================================================');
  console.log('   🎬 CERITAOBIM STUDIO — UJI COBA DOWNLOAD (2 PROFIL)');
  console.log('================================================================');
  console.log('Menu ini akan menguji pemutaran aksi download hasil rekaman Anda');
  console.log('pada 2 profil Chrome (Profil 1 dan Profil 2) secara berurutan.');
  console.log('================================================================\n');

  if (!fs.existsSync(RECORDED_FILE)) {
    console.error('❌ File rekaman tidak ditemukan di: ' + RECORDED_FILE);
    console.log('Silakan jalankan "Rekam_Klik_Download.bat" terlebih dahulu.');
    return;
  }

  let profiles = [];
  try {
    profiles = getMappedProfiles();
  } catch (err) {
    console.error('❌ Gagal membaca profil Chrome:', err.message);
    return;
  }

  const targetProfiles = profiles.slice(0, 2);
  console.log(`Ditemukan ${targetProfiles.length} profil target untuk uji coba:`);
  targetProfiles.forEach((p) => {
    console.log(`   [Profil ${p.index}] Folder: "${p.dirName}" | Label: "${p.name}"`);
  });

  console.log('\nPILIH MODE UJI COBA:');
  console.log('  [1] Putar pada 2 Profil Chrome secara otomatis (Buka Profil 1 -> Unduh -> Buka Profil 2 -> Unduh)');
  console.log('  [2] Putar langsung di jendela Chrome yang sedang aktif di layar Anda saat ini');
  console.log('');

  const choice = await askQuestion('Pilih mode [1/2] (Default: 1): ');

  if (choice === '2') {
    console.log('\n🚀 Memutar rekaman langsung pada jendela aktif di layar Anda...');
    playRecordedClicks();
    console.log('\n✅ Uji coba pemutaran pada jendela aktif selesai!');
    return;
  }

  // Mode 1: Buka 2 Profil berurutan
  const chromePath = findChromePath();
  const flowUrl = 'https://flow.google.com';

  for (let i = 0; i < targetProfiles.length; i++) {
    const prof = targetProfiles[i];
    console.log('\n----------------------------------------------------------------');
    console.log(`🌟 [${i + 1}/${targetProfiles.length}] MEMBUKA PROFIL ${prof.index}: ${prof.name}`);
    console.log('----------------------------------------------------------------');
    console.log(`🌐 Membuka ${flowUrl}...`);

    const child = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, flowUrl],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    console.log('⏳ Menunggu 6 detik agar beranda Google Flow termuat...');
    await delay(6000);

    console.log('▶️  Memulai eksekusi rekaman download untuk profil ini...');
    playRecordedClicks();

    console.log(`✅ Selesai memproses download di Profil ${prof.index}.`);

    if (i < targetProfiles.length - 1) {
      console.log('\n⏳ Menutup tab Google Flow dan mempersiapkan profil berikutnya...');
      try {
        execSync(`powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $ws.AppActivate('Google Flow'); Start-Sleep -Milliseconds 300; $ws.SendKeys('^w')"`, {
          stdio: 'ignore',
        });
      } catch {}
      await delay(3000);
    }
  }

  console.log('\n================================================================');
  console.log('   🎉 UJI COBA DOWNLOAD PADA 2 PROFIL SELESAI!');
  console.log('================================================================');
  console.log('Seluruh file yang berhasil diunduh tersimpan di folder Downloads.');
  console.log('Anda dapat menjalankan Menu "Migrasi" untuk memindahkan dan merakit video.');
  console.log('================================================================\n');
}

main().catch(console.error);
