/**
 * CeritaObim Studio — Macro Automation Worker & Dropzone Bridge
 *
 * Fungsi:
 * 1. Membaca antrean task video dari website (dimulai dari Week terbaru).
 * 2. Memantau folder `storage/macro_drops` secara live (Watcher Mode).
 * 3. Otomatis meng-ingest file video klip hasil generate ke database & website.
 * 4. Otomatis merakit 00Final.mp4 dengan audio voice over (FFmpeg).
 * 5. Otomatis mengunggah hasil final ke Google Drive ke folder yang tepat!
 */

const fs = require("fs");
const path = require("path");
const http = require("http");

const BASE_URL = process.env.STUDIO_BASE_URL || "http://127.0.0.1:3000";
const SESSION_COOKIE = "co_studio_owner_session=co_verified_owner_365d_token_v1";
const DROP_DIR = path.resolve(process.cwd(), "storage", "macro_drops");
const OWNER_DROP_DIR = path.resolve(process.cwd(), "00.FolderOwner", "DROPZONE_HASIL_DOWNLOAD");
const PROCESSED_DIR = path.join(DROP_DIR, "processed");
const MACRO_DIR = path.resolve(process.cwd(), "storage", "macro");

function ensureDirs() {
  [DROP_DIR, OWNER_DROP_DIR, PROCESSED_DIR, MACRO_DIR].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function requestApi(endpoint, options = {}) {
  const url = new URL(endpoint, BASE_URL);
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        timeout: options.timeout || 300000,
        headers: {
          Cookie: SESSION_COOKIE,
          ...(options.headers || {}),
        },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            resolve({ status: res.statusCode, body: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, body: data });
          }
        });
      }
    );

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("TIMEOUT"));
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (options.body) {
      req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function fetchQueue() {
  try {
    const res = await requestApi("/api/macro/queue");
    if (res.status === 200 && res.body.ok) {
      return res.body;
    }
  } catch {
    // If server is not responding, fallback to local storage/macro/queue.json
    const queueFile = path.join(MACRO_DIR, "queue.json");
    if (fs.existsSync(queueFile)) {
      return JSON.parse(fs.readFileSync(queueFile, "utf8"));
    }
  }
  return null;
}

async function printStatus() {
  console.log("\n================================================================");
  console.log("   📊 CERITAOBIM STUDIO — STATUS ANTREAN MAKRO TERBARU");
  console.log("================================================================\n");

  const queue = await fetchQueue();
  if (!queue) {
    console.log("❌ Tidak dapat mengambil antrean. Pastikan server dev berjalan di localhost:3000.");
    return;
  }

  console.log(`🎯 Minggu Produksi Aktif : Week ${queue.latestWeek}`);
  console.log(`📦 Total Konten          : ${queue.totalItems} konten`);
  console.log(`⏳ Scene Belum Jadi      : ${queue.totalPendingScenes} bagian`);
  console.log(`✅ Scene Selesai         : ${queue.totalUploadedScenes} bagian`);
  console.log(`📂 Folder Dropzone Makro : ${queue.macroDropFolder}\n`);

  if (queue.pendingTasks.length === 0) {
    console.log("🎉 SELURUH BAGIAN VIDEO TELAH LENGKAP! Tidak ada antrean pending.");
    return;
  }

  console.log("----------------------------------------------------------------");
  console.log("DAFTAR TUGAS YANG PERLU DIGENERATE MAKRO (TERBARU DAHULU):");
  console.log("----------------------------------------------------------------");

  const displayTasks = queue.pendingTasks.slice(0, 15);
  displayTasks.forEach((t) => {
    console.log(
      `#${String(t.taskIndex).padStart(2, "0")} [${t.contentCode}] Bagian ${t.sceneIndex} (${t.durationSeconds}s) | ${t.category} | "${t.title}"`
    );
    console.log(`    📁 Simpan file ke: ${t.suggestedDropPath}`);
  });

  if (queue.pendingTasks.length > 15) {
    console.log(`\n... dan ${queue.pendingTasks.length - 15} tugas berikutnya (cek storage/macro/pending_tasks.json).`);
  }
  console.log("----------------------------------------------------------------\n");
}

async function triggerSync() {
  console.log("\n🔄 Memindai folder storage/macro_drops...");
  console.log("   (Sedang memproses migrasi, sanitasi klip, dan perakitan video jika lengkap. Mohon tunggu...)");
  try {
    const res = await requestApi("/api/macro/sync", { method: "POST" });
    if (res.status === 200 && res.body.ok) {
      const data = res.body;
      if (data.scannedCount === 0) {
        console.log("ℹ️  Folder dropzone kosong. Tidak ada file video baru.");
        return;
      }

      console.log(`✅ Berhasil menyerap ${data.ingestedCount} klip video baru:`);
      data.ingestedClips.forEach((c) => {
        console.log(`   🎬 ${c.contentCode} Bagian ${c.sceneIndex} -> ${c.renamedFilename} (${Math.round(c.sizeBytes / 1024)} KB)`);
      });

      if (data.assembledVideos.length > 0) {
        console.log(`\n🎉 ${data.assembledVideos.length} VIDEO FINAL 00FINAL.MP4 BERHASIL DIRAKIT & DISINKRONKAN:`);
        data.assembledVideos.forEach((v) => {
          console.log(`   ✨ [${v.contentCode}] ${v.title}`);
          console.log(`      📹 File Final Master : ${v.finalVideoPath}`);
          console.log(`      ☁️  Google Drive Sync : ${v.gdriveUploaded ? "BERHASIL DIUNGGAH ✅" : "Tersimpan Lokal"}`);
          if (v.gdriveUrl) console.log(`      🔗 Link GDrive       : ${v.gdriveUrl}`);
        });
      }

      if (data.waitingForVoiceVideos.length > 0) {
        console.log(`\n⏳ Konten yang klipnya lengkap namun masih menunggu audio voice over:`);
        data.waitingForVoiceVideos.forEach((w) => {
          console.log(`   🎙️  ${w.contentCode} (Seluruh ${w.totalScenes} bagian klip lengkap. Buka menu Voice Over untuk auto-assembly).`);
        });
      }

      if (data.unmatchedCount > 0) {
        console.log(`\n⚠️  ${data.unmatchedCount} file tidak dapat dipetakan:`);
        data.unmatchedFiles.forEach((u) => console.log(`   ❌ ${u.filename}: ${u.reason}`));
      }
    } else {
      console.error("❌ Gagal menyinkronkan dropzone:", res.body);
    }
  } catch (err) {
    console.error("❌ Error saat menghubungi server studio:", err.message);
  }
}

async function startWatcher() {
  ensureDirs();
  console.log("\n================================================================");
  console.log("   👀 CERITAOBIM STUDIO — MAKRO AUTO-PILOT WATCHER AKTIF");
  console.log("================================================================");
  console.log(`📁 Memantau folder dropzone secara real-time:`);
  console.log(`   1. Folder Downloads User : C:\\Users\\...\\Downloads (File awalan pzxc_*)`);
  console.log(`   2. Folder Utama Owner    : ${OWNER_DROP_DIR}`);
  console.log(`   3. Folder Internal DB    : ${DROP_DIR}`);
  console.log("\n💡 Cara Kerja Otomatis:");
  console.log("   1. Unduh video dari Google Flow ke folder Downloads (otomatis bernama pzxc_...).");
  console.log("   2. Script ini langsung mendeteksi file pzxc_*, memindahkannya, dan membersihkan namanya.");
  console.log("   3. Merakit video master (00Final.mp4) bersama narasi audio ElevenLabs.");
  console.log("   4. Mengunggah langsung ke folder Google Drive konten tersebut secara otomatis!");
  console.log("\nTekan Ctrl+C untuk menghentikan pemantau.\n");

  let isSyncing = false;
  const userDownloadsDir = path.join(process.env.USERPROFILE || "", "Downloads");

  // Poll every 2 seconds
  while (true) {
    try {
      const isMedia = (e) =>
        e.isFile() &&
        (e.name.toLowerCase().endsWith(".mp4") ||
          e.name.toLowerCase().endsWith(".webm") ||
          e.name.toLowerCase().endsWith(".mov"));

      const dropFiles = fs.readdirSync(DROP_DIR, { withFileTypes: true }).filter(isMedia);
      const ownerFiles = fs.existsSync(OWNER_DROP_DIR)
        ? fs.readdirSync(OWNER_DROP_DIR, { withFileTypes: true }).filter(isMedia)
        : [];
      const downloadFiles = fs.existsSync(userDownloadsDir)
        ? fs
            .readdirSync(userDownloadsDir, { withFileTypes: true })
            .filter((e) => {
              if (!isMedia(e)) return false;
              const low = e.name.toLowerCase();
              return (
                low.startsWith("pzxc_") ||
                low.startsWith("papercraft_boy") ||
                low.startsWith("paper_boy") ||
                low.startsWith("boy_") ||
                low.includes("origami_bee") ||
                low.includes("teacup") ||
                low.includes("drinks") ||
                low.includes("forest")
              );
            })
        : [];

      const totalNew = dropFiles.length + ownerFiles.length + downloadFiles.length;

      if (totalNew > 0 && !isSyncing) {
        isSyncing = true;
        console.log(`\n⚡ [${new Date().toLocaleTimeString()}] Terdeteksi ${totalNew} file video baru (termasuk ${downloadFiles.length} di Downloads)!`);
        await triggerSync();
        isSyncing = false;
      }
    } catch (err) {
      // Ignore transient file lock
    }

    await delay(2000);
  }
}

async function main() {
  ensureDirs();
  const arg = process.argv[2] || "--status";

  if (arg === "--status" || arg === "-s") {
    await printStatus();
  } else if (arg === "--sync") {
    await triggerSync();
  } else if (arg === "--watch" || arg === "-w") {
    await startWatcher();
  } else {
    console.log("Perintah tidak dikenal. Gunakan: --status | --sync | --watch");
  }
}

main().catch(console.error);
