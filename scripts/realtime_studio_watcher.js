/**
 * CeritaObim Studio — Autonomous Real-Time Studio Watcher Daemon
 * 
 * Menghilangkan seluruh kebutuhan trigger manual kreator:
 * 1. REALTIME DOWNLOAD WATCHER: Memantau folder Downloads & Dropzone secara non-stop.
 *    Begitu ada klip baru hasil makro Chrome:
 *    - Otomatis distandarkan ke 00.FolderOwner/KLIP_BERSIH
 *    - Otomatis diunggah ke Supabase Storage (studio-assets/scene-clips/...)
 *    - Otomatis diperbarui statusnya di database Supabase (scene_status = 'clip_uploaded')
 *    - Otomatis memicu perakitan video jika 3/3 bagian klip telah lengkap
 * 2. REALTIME AUTO-ASSEMBLY & ZERO-DISK CLEANUP:
 *    - Otomatis merakit 00Final.mp4 menggunakan FFmpeg 9:16 + Audio Obim
 *    - Otomatis mengunggah 00Final.mp4 ke Supabase Storage (studio-assets/final-videos/...)
 *    - Otomatis menghapus potongan klip lokal dari laptop setelah final terunggah aman di cloud
 *    - Otomatis memperbarui status naskah di database menjadi ready_for_publishing
 * 3. REALTIME AUTO-VOICE & AUTO-PLANNING:
 *    - Memeriksa Supabase setiap 30 detik: jika ada Content Plan baru yang belum punya audio,
 *      otomatis men-generate voice over (Gemini TTS / ElevenLabs rotasi otomatis),
 *      menghitung timestamp, menyusun prompt origami ringkas, dan mengunggah ke Supabase & Google Drive!
 */

const fs = require('fs');
const path = require('path');
const { runSupabaseMigration } = require('./sync_supabase_migration');

const POLL_INTERVAL_MS = 10000; // 10 detik per siklus
let isProcessing = false;
let cycleCount = 0;

console.log('\n===============================================================================');
console.log('   ⚡ CERITAOBIM STUDIO — AUTONOMOUS REAL-TIME WATCHER DAEMON');
console.log('===============================================================================');
console.log('   STATUS         : AKTIF (REALTIME BACKGROUND DAEMON)');
console.log('   FOLDER PANTAU  : Downloads Windows & 00.FolderOwner/DROPZONE_HASIL_DOWNLOAD');
console.log('   CLOUD SYNC     : Supabase Storage (studio-assets)');
console.log('   INTERVAL CEK   : Setiap 10 Detik Non-Stop');
console.log('   HENTIKAN       : Tekan Ctrl + C di jendela ini kapan saja');
console.log('===============================================================================\n');

async function runDaemonCycle() {
  if (isProcessing) return;
  isProcessing = true;
  cycleCount++;

  try {
    const timestamp = new Date().toLocaleTimeString('id-ID');
    process.stdout.write(`\r[${timestamp}] 📡 Siklus #${cycleCount}: Memindai Downloads & antrean Supabase... `);

    // Jalankan migrasi & sinkronisasi otomatis
    const res = await runSupabaseMigration();

    if (res && (res.migratedCount > 0 || res.assembledCount > 0)) {
      console.log(`\n✨ [PROGRES REALTIME] ${res.migratedCount} klip baru termigrasi, ${res.assembledCount} video final 00Final.mp4 selesai dirakit & diunggah ke cloud!`);
    }
  } catch (err) {
    console.error('\n⚠️ Daemon warning:', err.message);
  } finally {
    isProcessing = false;
  }
}

// Jalankan siklus pertama segera
runDaemonCycle();

// Jadwalkan siklus berulang
const timer = setInterval(runDaemonCycle, POLL_INTERVAL_MS);

process.on('SIGINT', () => {
  console.log('\n\n🛑 Real-Time Studio Watcher dihentikan oleh pengguna.');
  clearInterval(timer);
  process.exit(0);
});
