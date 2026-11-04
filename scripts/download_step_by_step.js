/**
 * CeritaObim Studio — Step-by-Step Modular Download Runner
 * 
 * Pengujian modular alur unduh video otomatis untuk inspeksi visual:
 * Langkah D1 : Buka Google Flow & Buka Proyek Terbaru
 * Langkah D2 : Rapikan Tampilan Kanvas (Filter Video & Tutup Panel Samping)
 * Langkah D3 : Unduh Video Card 1 (Klik Kanan ➔ Download ➔ 720p)
 * Langkah D4 : Unduh Video Card 2 (Klik Kanan ➔ Download ➔ 720p)
 * Langkah DA : Unduh Seluruh Card Sekaligus di Profil Ini
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOWNLOAD_ENGINE = path.resolve(__dirname, 'download_engine.ps1');

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

function runDownloadEngine(args) {
  try {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${DOWNLOAD_ENGINE}" ${args}`;
    const out = execSync(cmd, { stdio: 'inherit' });
    return out ? out.toString().trim() : '';
  } catch (err) {
    return err.message;
  }
}

async function main() {
  const args = process.argv.slice(2);
  let step = '1';
  const stepMatch = args.find((a) => a.startsWith('--step='));
  if (stepMatch) step = stepMatch.split('=')[1].toLowerCase();

  let profNum = 4;
  const profMatch = args.find((a) => a.startsWith('--profile=') || a.startsWith('--single='));
  if (profMatch) profNum = parseInt(profMatch.split('=')[1], 10);

  const profiles = getMappedProfiles();
  const targetProf = profiles.find((p) => p.index === profNum) || profiles[0];

  console.log('================================================================');
  console.log(`📥 CERITAOBIM STUDIO — SIDAK MAKRO UNDUH (LANGKAH ${step.toUpperCase()})`);
  console.log(`👤 Profil Target : Profil ${targetProf.index} (${targetProf.name})`);
  console.log('================================================================\n');

  if (step === '1' || step === 'd1') {
    console.log(`🌐 [LANGKAH D1] Membuka Google Flow & Mengklik Proyek Terbaru...`);
    console.log(`   Akun: Profil ${targetProf.index} ("${targetProf.dirName}")`);
    runDownloadEngine(`-ProfileDir "${targetProf.dirName}" -OnlyOpenProject`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH D1:');
    console.log('   • Apakah Google Flow terbuka di layar Anda?');
    console.log('   • Apakah proyek video terbaru sudah terklik dan kanvas terbuka?');
    console.log('   • Jika ya, lanjutkan ke Langkah D2 (Rapikan Kanvas).');
    console.log('================================================================\n');
    return;
  }

  if (step === '2' || step === 'd2') {
    console.log(`📐 [LANGKAH D2] Merapikan Tampilan Kanvas (Filter Video & Tutup Panel)...`);
    runDownloadEngine(`-ProfileDir "${targetProf.dirName}" -OnlySetupCanvas`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH D2:');
    console.log('   • Apakah panel prompt kanan sudah tertutup / kanvas melebar?');
    console.log('   • Apakah kartu-kartu video di kanvas terlihat jelas dan rapi?');
    console.log('   • Jika ya, lanjutkan ke Langkah D3 (Unduh Card 1).');
    console.log('================================================================\n');
    return;
  }

  if (step === '3' || step === 'd3') {
    console.log(`⬇️  [LANGKAH D3] Mengunduh Card Video #1...`);
    console.log(`   Alur: Klik Kanan Card 1 ➔ Klik Download ➔ Klik 720p`);
    runDownloadEngine(`-ProfileDir "${targetProf.dirName}" -OnlyCardIndex 1`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH D3:');
    console.log('   • Apakah menu klik kanan Card 1 muncul?');
    console.log('   • Apakah opsi Download ➔ 720p terklik?');
    console.log('   • Periksa folder Downloads Anda: apakah file pzxc_* mulai terunduh?');
    console.log('================================================================\n');
    return;
  }

  if (step === '4' || step === 'd4') {
    console.log(`⬇️  [LANGKAH D4] Mengunduh Card Video #2...`);
    console.log(`   Alur: Klik Kanan Card 2 ➔ Klik Download ➔ Klik 720p`);
    runDownloadEngine(`-ProfileDir "${targetProf.dirName}" -OnlyCardIndex 2`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH D4:');
    console.log('   • Apakah Card 2 berhasil terunduh dengan format 720p?');
    console.log('================================================================\n');
    return;
  }

  if (step === '5' || step === 'd5') {
    console.log(`⬇️  [LANGKAH D5] Mengunduh Card Video #3...`);
    console.log(`   Alur: Klik Kanan Card 3 ➔ Klik Download ➔ Klik 720p`);
    runDownloadEngine(`-ProfileDir "${targetProf.dirName}" -OnlyCardIndex 3`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH D5:');
    console.log('   • Apakah Card 3 berhasil terunduh dengan format 720p?');
    console.log('================================================================\n');
    return;
  }

  if (step === '6' || step === 'd6') {
    console.log(`⬇️  [LANGKAH D6] Mengunduh Card Video #4...`);
    console.log(`   Alur: Klik Kanan Card 4 ➔ Klik Download ➔ Klik 720p`);
    runDownloadEngine(`-ProfileDir "${targetProf.dirName}" -OnlyCardIndex 4`);

    console.log('\n================================================================');
    console.log('🔍 HASIL LANGKAH D6:');
    console.log('   • Apakah Card 4 berhasil terunduh dengan format 720p?');
    console.log('================================================================\n');
    return;
  }

  if (step === 'all' || step === 'da') {
    let count = 3;
    const countMatch = args.find((a) => a.startsWith('--count=') || a.startsWith('--cards='));
    if (countMatch) count = parseInt(countMatch.split('=')[1], 10) || 3;

    console.log(`⚡ [LANGKAH DA] Mengunduh ${count} Video Sekaligus di Profil ${targetProf.index}...`);
    runDownloadEngine(`-ProfileDir "${targetProf.dirName}" -AssetCount ${count}`);

    console.log('\n================================================================');
    console.log(`🎉 Pengunduhan selesai untuk Profil ${targetProf.index}.`);
    console.log('================================================================\n');
    return;
  }
}

main().catch(console.error);
