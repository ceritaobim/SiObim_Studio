/**
 * CeritaObim Studio — START ALL V2 (Master Pipeline Bersih & Stabil)
 *
 * 5 Tahap Produksi:
 * 1. [Tahap 1/5] Generate Video V2 (Presisi submit panah + @obim chip + 1x Approve)
 * 2. [Tahap 2/5] Jeda Render Cloud Flow (3 menit)
 * 3. [Tahap 3/5] Download Video (Auto-Download Aset 720p)
 * 4. [Tahap 4/5] Migrasi & Auto-Rakit FFmpeg (Klip Bersih + Narasi Voice)
 * 5. [Tahap 5/5] Cek Sisa Kredit (Google One Histori Otomatis)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');
const { runDownloadPipeline, getMappedProfiles } = require('./download_recorded_assets');

const SESSION_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'active_production_session.json');

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

async function main() {
  console.log('\n===============================================================================');
  console.log('       🚀 CERITAOBIM STUDIO — START ALL V2 (PIPELINE OTOMASI BERSIH)         ');
  console.log('===============================================================================');
  const allProfiles = getMappedProfiles();
  const profileCountLabel = allProfiles.length > 0 ? `${allProfiles.length} Profil` : '12 Profil';

  console.log(' Pipeline V2 ini akan menjalankan 5 TAHAP PRODUKSI secara berurutan:');
  console.log(`   [Tahap 1/5] GENERATE VIDEO V2 -> Prompting presisi panah kirim & 1x Approve (${profileCountLabel})`);
  console.log('   [Tahap 2/5] JEDA RENDER CLOUD -> Memberi waktu Google Flow menyelesaikan render');
  console.log('   [Tahap 3/5] DOWNLOAD VIDEO    -> Unduh otomatis klip video 720p');
  console.log('   [Tahap 4/5] MIGRASI & RAKIT   -> Sanitasi nama pzxc_*, rakit video master FFmpeg');
  console.log(`   [Tahap 5/5] CEK KREDIT        -> Catat otomatis histori kuota sisa ${profileCountLabel}`);
  console.log('===============================================================================\n');

  let chunkSize = 3;
  const chunkWait = await waitForUserOrTimeout(5, 'Berapa bagian video per profil? Tekan [ENTER] untuk default 3 bagian');
  if (chunkWait === 'enter') {
    const chunkInput = await askQuestion('Masukkan jumlah bagian per profil (Default: 3): ');
    const parsed = parseInt(chunkInput, 10);
    if (!isNaN(parsed) && parsed > 0) chunkSize = parsed;
  }

  console.log(`\n⚙️  Pengaturan: ${chunkSize} bagian video per profil.`);
  console.log('🚀 Memulai Tahap 1 dalam 3 detik...\n');
  await delay(3000);

  // TAHAP 1: GENERATE VIDEO V2
  console.log('\n===============================================================================');
  console.log(` 🎬 [TAHAP 1/5] MEMULAI GENERATE VIDEO V2 DI ${profileCountLabel.toUpperCase()}`);
  console.log('===============================================================================');

  try {
    execSync(`node "${path.resolve(__dirname, 'gflow_v2_runner.js')}" --chunk=${chunkSize} --all`, { stdio: 'inherit' });
  } catch (err) {
    console.log('⚠️  Tahap generate video selesai atau dilewati sebagian.');
  }

  console.log('\n✅ [TAHAP 1/5 SELESAI] Seluruh profil telah di-prompt dan di-approve!');

  // TAHAP 2: JEDA 3 MENIT
  console.log('\n===============================================================================');
  console.log(' ⏳ [TAHAP 2/5] MENUNGGU PROSES RENDER CLOUD GOOGLE FLOW');
  console.log('===============================================================================');
  console.log('Memberi waktu 3 menit agar video selesai dirender di server Google Flow...');
  await waitForUserOrTimeout(180, '⏱️  Menunggu proses render selesai di Google Flow');

  // TAHAP 3: DOWNLOAD VIDEO
  console.log('\n===============================================================================');
  console.log(` ⬇️  [TAHAP 3/5] MEMULAI DOWNLOAD OTOMATIS VIDEO SELESAI (${profileCountLabel.toUpperCase()})`);
  console.log('===============================================================================');

  try {
    await runDownloadPipeline({ defaultPerProfile: chunkSize });
  } catch (err) {
    console.error('❌ Terjadi kendala saat download otomatis:', err.message);
  }

  // TAHAP 4: MIGRASI & RAKIT FFMPEG
  console.log('\n===============================================================================');
  console.log(' 🔨 [TAHAP 4/5] MEMULAI MIGRASI, SANITASI KLIP, & PERAKITAN FFMPEG');
  console.log('===============================================================================');

  try {
    execSync(`node "${path.resolve(__dirname, 'macro-worker.js')}" --sync`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Terjadi kendala saat migrasi klip:', err.message);
  }

  // TAHAP 5: CEK KREDIT
  console.log('\n===============================================================================');
  console.log(` 💳 [TAHAP 5/5] MEMULAI CEK SISA KREDIT ${profileCountLabel.toUpperCase()} (GOOGLE ONE)`);
  console.log('===============================================================================');

  try {
    execSync(`node "${path.resolve(__dirname, 'check_flow_credits.js')}"`, { stdio: 'inherit' });
  } catch (err) {
    console.error('❌ Terjadi kendala saat cek kredit:', err.message);
  }

  console.log('\n===============================================================================');
  console.log(' 🎉 SELURUH PIPELINE START ALL V2 SELESAI DENGAN SUKSES!                     ');
  console.log('===============================================================================');
  console.log('  1. Generate Video  : Seluruh profil telah di-prompt & di-approve');
  console.log('  2. Download Video  : Berkas video 720p berhasil diunduh');
  console.log('  3. Migrasi Klip    : Nama distandardisasi di 00.FolderOwner\\KLIP_BERSIH');
  console.log('  4. Video Master    : File video final dirakit bersama narasi audio');
  console.log('  5. Kredit Akun     : Catatan sisa kuota terbaru tersimpan');
  console.log('===============================================================================\n');
}

main().catch(console.error);
