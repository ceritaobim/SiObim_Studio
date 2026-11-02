/**
 * CeritaObim Studio — Uji Coba Makro Google Flow (3 Profil Pertama)
 * Menguji transisi sekuensial Profil 1, 2, dan 3 tanpa mengganggu Profil 0
 */

const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

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
    // Cocokkan pola angka(nama/email) baik di awal maupun jika ada nama Google di depannya
    const match = (pData.name || '').match(/(\d+)\((.+?)\)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0) { // Kecualikan profil 0
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
  process.stdout.write('\r                                                                 \r');
}

async function runTest() {
  console.log('\n================================================================');
  console.log('   🚀 CERITAOBIM STUDIO — UJI COBA MAKRO FLOW (3 PROFIL)');
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
    console.log('💡 Pastikan Anda sudah menamai profil Chrome Anda seperti: 1(email1), 2(email2)');
    process.exit(1);
  }

  console.log(`✅ Berhasil mendeteksi ${profiles.length} profil terdaftar di Chrome:`);
  profiles.forEach((p) => {
    console.log(`   [Profil ${p.index}] Folder: "${p.dirName}" | Label: "${p.name}"`);
  });

  // Ambil hanya 3 profil pertama untuk uji coba
  const testProfiles = profiles.slice(0, 3);
  console.log(`\n🎯 Memulai uji coba sekuensial untuk ${testProfiles.length} profil pertama...\n`);

  const chromePath = findChromePath();
  const flowUrl = 'https://flow.google.com';
  const obimUrl = 'http://localhost:3000/assets';

  for (let i = 0; i < testProfiles.length; i++) {
    const prof = testProfiles[i];
    console.log('----------------------------------------------------------------');
    console.log(`▶️ [LANGKAH ${i + 1}/${testProfiles.length}] MEMBUKA PROFIL ${prof.index}: ${prof.name}`);
    console.log('----------------------------------------------------------------');
    console.log(`📂 Folder Direktori: ${prof.dirName}`);
    console.log(`🌐 Membuka Google Flow: ${flowUrl}`);
    console.log(`🎬 Membuka Obim Studio Video: ${obimUrl}`);

    // Buka jendela Chrome khusus profil ini dengan URL Flow dan Obim Studio
    const chromeProcess = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, flowUrl, obimUrl],
      { detached: true, stdio: 'ignore' }
    );
    chromeProcess.unref();

    console.log(`\n✅ Jendela Chrome untuk Profil ${prof.index} (${prof.name}) telah dibuka di layar Anda.`);
    console.log(`👉 Silakan periksa apakah profil yang terbuka benar-benar sesuai dengan akun emailnya.`);

    if (i < testProfiles.length - 1) {
      await countdown(15, `Menunggu sebelum beralih ke Profil ${testProfiles[i + 1].index}`);
      console.log(`\n🔄 Selesai giliran Profil ${prof.index}. Beralih ke profil berikutnya...\n`);
    } else {
      await countdown(5, `Menyelesaikan uji coba 3 profil`);
    }
  }

  console.log('\n================================================================');
  console.log('   🎉 UJI COBA 3 PROFIL SELESAI!');
  console.log('================================================================');
  console.log('Semua 3 profil berhasil dipanggil secara bergantian.');
  console.log('Profil 0 (pribadi) Anda tetap aman dan tidak pernah disentuh.');
  console.log('\nTekan tombol apa saja untuk menutup jendela ini...');
}

runTest();
