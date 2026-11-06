/**
 * CeritaObim Studio — Script Eksekusi Mandiri: Migrasi Klip Downloads
 *
 * Alur Kerja:
 * 1. [Langkah 1] Pindahkan file .mp4 yang sudah sesuai format ke 00.FolderOwner\KLIP_BERSIH.
 * 2. [Langkah 2] Deteksi file .mp4 mentah (pzxc / prompt Flow), ganti nama resmi, dan pindahkan ke KLIP_BERSIH.
 *    (File yang tidak dapat dideteksi TETAP DIBIARKAN di Downloads).
 * 3. [Langkah 3 - Kritis] Deteksi & amankan file DOUBLE/duplikat ke 00.FolderOwner\KLIP_DUPLIKAT.
 * 4. [Langkah 4] Ingest database & auto-rakit FFmpeg 00Final.mp4 jika klip lengkap.
 */

const path = require("path");
const fs = require("fs");

// Register ts-node / tsx loader or use direct JS import if compiled, or tsx
async function run() {
  console.log("\n===============================================================================");
  console.log("       🚀 CERITAOBIM STUDIO — MIGRASI & PERAPIAN KLIP DOWNLOADS                ");
  console.log("===============================================================================");
  console.log(" Memulai migrasi cerdas 2-tahap + deteksi file double...\n");

  try {
    // Dynamic import the TypeScript module using jiti or tsx
    let engine;
    try {
      const jiti = require("jiti")(__filename);
      engine = jiti("../src/lib/services/clip-migration-engine");
    } catch {
      // Fallback: compile ts on the fly with ts-node or run via npx tsx
      console.log("Menggunakan runtime TSX...");
      const { execSync } = require("child_process");
      execSync("npx tsx scripts/run_migration_tsx.ts", { stdio: "inherit" });
      return;
    }

    const report = await engine.runTwoStepClipMigration();

    console.log("-------------------------------------------------------------------------------");
    console.log(`📊 TOTAL FILE VIDEO (.MP4) DIPINDAI : ${report.scannedCount} file`);
    console.log("-------------------------------------------------------------------------------");

    console.log(`\n✅ [LANGKAH 1] File Sudah Sesuai Format: ${report.stage1Moved.length} file dipindahkan`);
    report.stage1Moved.forEach((f) => {
      console.log(`   + [SESUAI] ${f.originalFilename} -> ${f.contentCode} Bagian ${f.sceneIndex}`);
    });

    console.log(`\n🔍 [LANGKAH 2] File Mentah Dideteksi & Direname: ${report.stage2Detected.length} file`);
    report.stage2Detected.forEach((f) => {
      console.log(`   + [DIRENAME] ${f.originalFilename}`);
      console.log(`     └──> ${f.renamedFilename} (${f.reason})`);
    });

    if (report.stage2Unmatched.length > 0) {
      console.log(`\n⚠️ [TIDAK TERDETEKSI] Dibiarkan di Folder Downloads: ${report.stage2Unmatched.length} file`);
      report.stage2Unmatched.forEach((f) => {
        console.log(`   - ${f.filename}: ${f.reason}`);
      });
    }

    console.log(`\n🛡️ [LANGKAH 3 - KRITIS] Deteksi File Double / Duplikat: ${report.stage3Duplicates.length} file diamankan`);
    if (report.stage3Duplicates.length > 0) {
      report.stage3Duplicates.forEach((d) => {
        console.log(`   ⚠️ [DOUBLE DETECTED] Konten ${d.contentCode} Bagian ${d.sceneIndex}:`);
        console.log(`      • File Aktif (Terbaik)  : ${d.keptFile}`);
        console.log(`      • Duplikat Diamankan ke : 00.FolderOwner\\KLIP_DUPLIKAT\\${path.basename(d.archivedToPath)}`);
        console.log(`      • Alasan Pemilihan      : ${d.reason}`);
      });
    } else {
      console.log("   ✓ Tidak ditemukan konflik file double. Semua bagian klip unik.");
    }

    console.log(`\n📦 [LANGKAH 4] Sinkronisasi Database & Perakitan Video Master:`);
    console.log(`   • Klip Ter-ingest ke Database: ${report.stage4IngestedCount} klip`);
    console.log(`   • Video Master Dirakit FFmpeg : ${report.stage4AssembledVideos.length} video`);
    report.stage4AssembledVideos.forEach((v) => {
      console.log(`     🎉 [00FINAL SELESAI] ${v.contentCode} - ${v.title}`);
      console.log(`        Lokasi: ${v.finalVideoPath}`);
    });

    console.log("\n===============================================================================");
    console.log(" 🎉 PROSES MIGRASI DAN PERAPIAN KLIP SELESAI DENGAN SUKSES!                     ");
    console.log("===============================================================================\n");
  } catch (err) {
    console.error("❌ Terjadi kesalahan saat migrasi klip:", err);
  }
}

run();
