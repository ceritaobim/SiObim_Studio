/**
 * CeritaObim Studio — Auto-Download Video Google Flow (12 Profil Chrome)
 * 
 * Alur Kerja:
 * 1. Membaca profil Chrome dari Local State (Profil 1 s.d. 10).
 * 2. Membuka https://flow.google.com per profil.
 * 3. Mengklik project terbaru di kiri bawah beranda Flow.
 * 4. Memastikan filter 'Videos' aktif dan tampilan Grid 'M' di Settings.
 * 5. Mengunduh secara berurutan Card 1 s/d 6 (720p Original size).
 * 6. File pzxc_* terunduh ke Downloads.
 * 7. Melakukan sinkronisasi otomatis: memindahkan, membersihkan nama,
 *    dan merakit MP4 ke 00.FolderOwner/KLIP_BERSIH dan database.
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const CLICK_TOOL = path.resolve(__dirname, 'click_tool.ps1');
const MACRO_WORKER = path.resolve(__dirname, 'macro-worker.js');
const KILLSWITCH_SCRIPT = path.resolve(__dirname, 'killswitch_listener.ps1');
const STOP_FLAG = path.resolve(__dirname, '..', 'storage', 'macro', 'STOP_MACRO.flag');

let isEmergencyStopped = false;
let killswitchProcess = null;

function checkEmergencyStop() {
  if (isEmergencyStopped) return true;
  if (fs.existsSync(STOP_FLAG)) {
    isEmergencyStopped = true;
    return true;
  }
  return false;
}

function triggerEmergencyStop(source = 'KEYBOARD') {
  if (isEmergencyStopped) return;
  isEmergencyStopped = true;

  console.log('\n================================================================');
  console.log(`🛑 [EMERGENCY STOP] Tombol [${source}] ditekan!`);
  console.log('   Makro dihentikan seketika oleh pengguna.');
  console.log('================================================================\n');

  try {
    fs.writeFileSync(STOP_FLAG, 'STOP');
  } catch {}

  if (killswitchProcess) {
    try { killswitchProcess.kill(); } catch {}
  }

  process.exit(0);
}

function startKillswitchListener() {
  try {
    if (fs.existsSync(STOP_FLAG)) fs.unlinkSync(STOP_FLAG);
  } catch {}

  killswitchProcess = spawn('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    KILLSWITCH_SCRIPT
  ], { stdio: ['ignore', 'pipe', 'ignore'] });

  killswitchProcess.stdout.on('data', (data) => {
    const text = data.toString().trim();
    if (text.includes('EMERGENCY_STOP')) {
      const keyName = text.split(':')[1] || 'Shift+X / X / Esc';
      triggerEmergencyStop(keyName);
    }
  });

  // Listener input terminal jika terminal sedang aktif
  if (process.stdin.isTTY) {
    try {
      const readline = require('readline');
      readline.emitKeypressEvents(process.stdin);
      process.stdin.setRawMode(true);
      process.stdin.on('keypress', (str, key) => {
        if (key && (key.name === 'x' || key.name === 'escape' || (key.ctrl && key.name === 'c'))) {
          triggerEmergencyStop(key.name.toUpperCase());
        }
      });
      process.stdin.resume();
    } catch {}
  }
}

async function delay(ms) {
  const step = 100;
  let elapsed = 0;
  while (elapsed < ms) {
    if (checkEmergencyStop()) {
      triggerEmergencyStop('HOTKEY');
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(step, ms - elapsed)));
    elapsed += step;
  }
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

function runPowerShell(argsStr) {
  if (checkEmergencyStop()) {
    triggerEmergencyStop('HOTKEY');
  }
  try {
    const res = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${CLICK_TOOL}" ${argsStr}`, {
      encoding: 'utf8',
      timeout: 15000,
    });
    if (checkEmergencyStop()) {
      triggerEmergencyStop('HOTKEY');
    }
    return res;
  } catch (err) {
    if (checkEmergencyStop()) {
      triggerEmergencyStop('HOTKEY');
    }
    return null;
  }
}

async function main() {
  startKillswitchListener();

  console.log('\n================================================================');
  console.log('   📥 CERITAOBIM STUDIO — AUTO-DOWNLOAD VIDEO GOOGLE FLOW');
  console.log('================================================================');
  console.log('Makro ini akan mengunduh otomatis video yang telah selesai di-render');
  console.log('dari project terbaru di setiap profil Chrome (Card 1 s.d. 6).');
  console.log('----------------------------------------------------------------');
  console.log('🛑 TOMBOL PENGHENTI DARURAT (EMERGENCY KILLSWITCH):');
  console.log('   Tekan [Shift + X], [X], atau [Esc] KAPAN SAJA di keyboard');
  console.log('   untuk menghentikan makro secara seketika!');
  console.log('================================================================\n');

  // Baca argumen CLI jika ada: --cards=6 atau --profile=1 atau --sidebar=collapsed/expanded/auto
  const args = process.argv.slice(2);
  let maxCards = 6;
  const cardsArg = args.find((a) => a.startsWith('--cards='));
  if (cardsArg) {
    maxCards = parseInt(cardsArg.split('=')[1], 10) || 6;
  }

  const profileArg = args.find((a) => a.startsWith('--profile='));
  const targetProfileNum = profileArg ? parseInt(profileArg.split('=')[1], 10) : null;

  const sidebarArg = args.find((a) => a.startsWith('--sidebar='));
  const sidebarMode = sidebarArg ? sidebarArg.split('=')[1].toLowerCase() : 'auto';

  let profiles = getMappedProfiles();
  if (targetProfileNum) {
    profiles = profiles.filter((p) => p.index === targetProfileNum);
  }

  if (profiles.length === 0) {
    console.error('❌ Tidak ditemukan profil Chrome yang cocok.');
    return;
  }

  console.log(`Ditemukan ${profiles.length} profil yang akan diproses (Maks ${maxCards} video/profil, Sidebar: ${sidebarMode}):`);
  profiles.forEach((p) => console.log(`   [Profil ${p.index}] ${p.name} (${p.email})`));

  console.log('\n🚀 Memulai proses unduh otomatis dalam 3 detik...');
  await delay(3000);

  const chromePath = findChromePath();
  const flowUrl = 'https://flow.google.com';

  for (let i = 0; i < profiles.length; i++) {
    const prof = profiles[i];
    console.log('\n----------------------------------------------------------------');
    console.log(`🎬 [${i + 1}/${profiles.length}] Membuka Profil ${prof.index}: ${prof.name}...`);
    console.log('----------------------------------------------------------------');

    // 1. Buka Flow di profil ini
    console.log('🌐 Membuka flow.google.com...');
    const child = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, flowUrl],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    console.log('⏳ Menunggu 5.5 detik agar beranda Flow terbuka...');
    await delay(5500);

    // 2. Klik project terbaru di kiri bawah
    console.log('📂 Mengklik project terbaru di kiri bawah...');
    runPowerShell('-OpenLatestProject');

    // Jeda 5 detik agar kanvas dan seluruh media termuat stabil (tanpa gerakan klik acak)
    console.log('⏳ Menunggu 5 detik agar seluruh aset di kanvas project termuat stabil...');
    await delay(5000);

    // 3. Pastikan panel kiri COLLAPSED via Smart Collapse (titik Collapse di X=105, Y=933)
    console.log('🔴 Menerapkan Smart Collapse (titik Collapse)...');
    runPowerShell('-EnsurePanelCollapsed');
    await delay(1000);

    // 4. Unduh video langsung dari kanvas via Klik Kanan -> Download -> 720p
    for (let c = 1; c <= maxCards; c++) {
      console.log(`   ⬇️  [${c}/${maxCards}] Klik Kanan Card ${c} -> Download -> 720p...`);
      runPowerShell(`-DownloadCardRightClick -CardIndex ${c}`);
      await delay(1500);
    }

    console.log(`✅ Selesai mengunduh video di Profil ${prof.index}.`);

    // Tutup tab kerja dengan Ctrl+W
    console.log('🔒 Menutup tab Google Flow...');
    try {
      execSync(`powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $ws.AppActivate('Google Flow'); Start-Sleep -Milliseconds 200; $ws.SendKeys('^w')"`, {
        timeout: 5000,
        stdio: 'ignore',
      });
    } catch {}

    await delay(1500);
  }

  console.log('\n================================================================');
  console.log('   🎉 SEMUA PROFIL SELESAI DIPROSES!');
  console.log('================================================================');
  console.log('📥 Menjalankan sinkronisasi otomatis:');
  console.log('   - Memindai C:\\Users\\iqbalandimuh\\Downloads (file pzxc_*)');
  console.log('   - Membersihkan nama file & memindahkan ke 00.FolderOwner\\KLIP_BERSIH');
  console.log('   - Merakit otomatis video MP4 via FFmpeg');
  console.log('================================================================\n');

  try {
    execSync(`node "${MACRO_WORKER}" --sync`, { stdio: 'inherit' });
  } catch (err) {
    console.log('ℹ️  Sinkronisasi latar belakang tetap berjalan via API / Watcher.');
  }

  if (killswitchProcess) {
    try { killswitchProcess.kill(); } catch {}
  }
  try {
    if (fs.existsSync(STOP_FLAG)) fs.unlinkSync(STOP_FLAG);
  } catch {}

  console.log('\n✨ Auto-download dan pembersihan klip berhasil diselesaikan!');
}

main().catch((err) => {
  if (killswitchProcess) {
    try { killswitchProcess.kill(); } catch {}
  }
  console.error(err);
});
