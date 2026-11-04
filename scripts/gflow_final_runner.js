/**
 * CeritaObim Studio — GFlow Master Final Runner
 * 
 * Eksekusi Penuh 11 Profil Google:
 * 1. Ambil Antrean Konten Langsung dari Supabase (66 scene pending, 11 profil)
 * 2. Auto-Generate 11 Profil (New Project ➔ Luaskan ➔ Upload Obim ➔ Paste Prompt ➔ Chip @obim.jpg ➔ Kirim ➔ Approve 1x)
 * 3. Jeda Render Cloud
 * 4. Auto-Download 11 Profil (Buka Project ➔ Rapikan Kanvas ➔ Unduh Card 1, 2, 3 ke 720p)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const CLICK_TOOL = path.resolve(__dirname, 'click_tool_v2.ps1');
const DOWNLOAD_ENGINE = path.resolve(__dirname, 'download_engine.ps1');
const ASSET_FILE = path.resolve(__dirname, '..', '00.FolderOwner', 'assets', 'obim.jpg');
const { fetchSupabaseBatches } = require('./fetch_supabase_batches');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function runDownloadEngine(args) {
  try {
    const cmd = `powershell -NoProfile -ExecutionPolicy Bypass -File "${DOWNLOAD_ENGINE}" ${args}`;
    const out = execSync(cmd, { stdio: 'inherit' });
    return out ? out.toString().trim() : '';
  } catch (err) {
    return err.message;
  }
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

// ============================================================================
// TAHAP 1: AUTO-GENERATE 11 PROFIL (PROJECT TERAKHIR & ALWAYS APPROVE AKTIF)
// ============================================================================

async function runAutoGenerate11(batches, profiles, chromePath) {
  console.log('\n================================================================');
  console.log('   🚀 [TAHAP 1/3] MEMULAI AUTO-GENERATE DI 11 PROFIL GOOGLE');
  console.log('   (Mode Efisien: Buka Proyek Terakhir + Always Approve + Langsung Pindah)');
  console.log('================================================================\n');

  const count = Math.min(11, profiles.length, batches.length);

  for (let i = 0; i < count; i++) {
    const prof = profiles[i];
    const batch = batches[i];

    console.log('\n================================================================');
    console.log(`🎬 [PROFIL ${i + 1}/${count}] MEMPROSES PROFIL ${prof.index} (${prof.name})`);
    console.log(`📋 Konten Supabase : [${batch.contentCode}] "${batch.title}"`);
    console.log(`🎯 Bagian Scene     : ${batch.sceneIndices.map((idx) => 'Bagian ' + idx).join(', ')} (${batch.sceneCount} video)`);
    console.log('================================================================');

    // 1. Buka Chrome Flow
    console.log(`🌐 [1/4] Membuka Google Flow untuk Profil ${prof.index}...`);
    const child = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, 'https://flow.google.com'],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    console.log(`⏳ Menunggu 8 detik agar beranda Flow termuat...`);
    await delay(8000);

    // 2. Buka Project Terakhir (yang sudah aktif Always Approve)
    console.log(`📂 [2/4] Mengklik kartu project terakhir (yang sudah aktif Always Approve)...`);
    runClickTool('-OpenLatestProject');
    console.log(`⏳ Menunggu 6 detik agar kanvas project terbuka penuh...`);
    await delay(6000);

    // 3. Pastikan panel chat kanan terbuka (Luaskan)
    console.log(`⛶  [3/4] Memastikan panel chat kanan terbuka (Luaskan)...`);
    runClickTool('-ClickExpandPrompt');
    await delay(1500);

    // 4. Salin prompt, tempel, tag @obim.jpg, dan klik panah kirim
    console.log(`📋 [4/4] Menyalin prompt batch (${batch.sceneCount} video) ke Clipboard...`);
    setClipboardText(batch.promptText);
    await delay(600);

    console.log(`⚡ [AUTO-ACTION] Fokus chatbox, paste prompt, kunci chip @obim.jpg, dan klik submit...`);
    runClickTool('-PasteTagAndSubmit');
    console.log(`🚀 Prompt batch berhasil dikirimkan ke Google Flow!`);

    // Sesuai instruksi: karena sudah Always Approve, langsung jeda 3.5 detik lalu lanjut profil berikutnya!
    console.log(`⏳ Menunggu 3.5 detik agar permintaan render diterima server Flow...`);
    await delay(3500);

    console.log(`✅ Profil ${prof.index} SELESAI DIKIRIMKAN! (Always Approve aktif, otomatis merender).`);
    if (i < count - 1) {
      console.log(`➡️  LANGSUNG BERPINDAH KE PROFIL BERIKUTNYA (Profil ${profiles[i + 1].index})...\n`);
      await delay(2000);
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 SELURUH ${count} PROFIL BERHASIL DIKIRIMKAN SECARA INSTAN!`);
  console.log('================================================================\n');
}

// ============================================================================
// TAHAP 3: AUTO-DOWNLOAD 11 PROFIL
// ============================================================================

async function runAutoDownload11(batches, profiles) {
  console.log('\n================================================================');
  console.log('   📥 [TAHAP 3/3] MEMULAI AUTO-DOWNLOAD DI 11 PROFIL GOOGLE');
  console.log('================================================================\n');

  const count = Math.min(11, profiles.length);

  for (let i = 0; i < count; i++) {
    const prof = profiles[i];
    const batch = batches[i] || { sceneCount: 3 };
    const targetCards = Math.min(4, Math.max(1, batch.sceneCount));

    console.log('\n================================================================');
    console.log(`🎬 [DOWNLOAD ${i + 1}/${count}] MEMPROSES UNDUH PROFIL ${prof.index}: ${prof.name}`);
    console.log(`   Target Unduh: ${targetCards} Kartu Video (720p Original size)`);
    console.log('================================================================');

    runDownloadEngine(`-ProfileDir "${prof.dirName}" -AssetCount ${targetCards}`);

    // Tutup tab flow dengan Ctrl+W agar rapi
    console.log(`🔒 Menutup tab Google Flow pada Profil ${prof.index}...`);
    try {
      execSync(`powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $null = $ws.AppActivate('Google Flow'); Start-Sleep -Milliseconds 200; $ws.SendKeys('^w')"`, {
        stdio: 'ignore',
        timeout: 5000,
      });
    } catch {}

    if (i < count - 1) {
      console.log('⏳ Jeda 2 detik sebelum profil berikutnya...\n');
      await delay(2000);
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 SELURUH ${count} PROFIL BERHASIL DIUNDUH!`);
  console.log('   File pzxc_* sudah tersimpan di folder Downloads Windows.');
  console.log('================================================================\n');
}

// ============================================================================
// MAIN CONTROLLER
// ============================================================================

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || '--full';

  console.log('\n================================================================');
  console.log('   ⭐ CERITAOBIM STUDIO — MAKRO FINAL AUTONOMOUS');
  console.log('   Mode: Auto-Generate (11 Profil) + Auto-Download (11 Profil)');
  console.log('================================================================\n');

  // 1. Ambil Profil 1 s/d 11 (Profil 12 dikecualikan)
  const allProfiles = getMappedProfiles();
  const profiles11 = allProfiles.filter((p) => p.index >= 1 && p.index <= 11);

  console.log(`👤 Terdeteksi ${profiles11.length} Profil Google (Profil 1 s.d. 11):`);
  profiles11.forEach((p) => console.log(`   [Profil ${String(p.index).padStart(2, ' ')}] ${p.name} (${p.email})`));

  // 2. Ambil 11 Batch Antrean Konten Langsung dari Supabase
  console.log('\n📡 Menghubungkan ke Database Supabase...');
  const batches = await fetchSupabaseBatches(11);
  console.log(`✅ Berhasil mengambil ${batches.length} batch konten unproduced dari Supabase:\n`);
  batches.forEach((b) => {
    console.log(`   [Batch ${b.batchIndex} -> Profil ${b.batchIndex}] [${b.contentCode}] ${b.title} (${b.sceneIndices.map((i) => 'Bagian ' + i).join(', ')})`);
  });

  const chromePath = findChromePath();

  if (mode === '--generate-only') {
    await runAutoGenerate11(batches, profiles11, chromePath);
    return;
  }

  if (mode === '--download-only') {
    await runAutoDownload11(batches, profiles11);
    return;
  }

  // MODE FULL PIPELINE: Generate ➔ Jeda Render ➔ Download
  await runAutoGenerate11(batches, profiles11, chromePath);

  console.log('\n================================================================');
  console.log('   ⏳ [TAHAP 2/3] MENUNGGU GOOGLE FLOW SELESAI MERENDER VIDEO');
  console.log('================================================================');
  console.log('Video sedang dirender oleh cloud Google Flow di latar belakang.');
  console.log('Beri waktu beberapa menit agar seluruh klip video 1080x1920 siap unduh.');
  console.log('----------------------------------------------------------------');

  await waitForUserOrTimeout(240, '⏱️  Menunggu proses render cloud selesai');

  await runAutoDownload11(batches, profiles11);

  console.log('\n================================================================');
  console.log('   🏁 MAKRO FINAL SELESAI DENGAN SEMPURNA!');
  console.log('   • 11 Profil Google telah berhasil di-prompt (Sumber: Supabase)');
  console.log('   • 11 Profil Google telah selesai diunduh');
  console.log('================================================================\n');
}

main().catch(console.error);
