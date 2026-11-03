/**
 * CeritaObim Studio — Download Video (Berdasarkan Hasil Rekaman Klik Kanan User)
 *
 * Alur Kerja:
 * 1. Membaca rekaman dari storage/macro/recorded_download_flow.json.
 * 2. Mengelompokkan klik menjadi Blok Aset:
 *    - Setiap kali terjadi RightClick menandai kartu aset video baru.
 *    - Klik kiri setelahnya adalah aksi Download dan 720p.
 * 3. Menyesuaikan jumlah aset yang diunduh per profil sesuai jumlah bagian yang di-generate.
 * 4. Berpindah profil Chrome secara sekuensial.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn, execSync } = require('child_process');

const RECORDED_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'recorded_download_flow.json');
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

function parseRecording() {
  if (!fs.existsSync(RECORDED_FILE)) {
    throw new Error('File rekaman tidak ditemukan di: ' + RECORDED_FILE);
  }

  const raw = fs.readFileSync(RECORDED_FILE, 'utf8').replace(/^\uFEFF/, '');
  const steps = JSON.parse(raw);

  let initialSteps = [];
  let assetBlocks = [];
  let currentBlock = null;

  for (const s of steps) {
    if (s.Type === 'RightClick') {
      if (currentBlock) assetBlocks.push(currentBlock);
      currentBlock = { rightClick: s, followClicks: [] };
    } else if (currentBlock) {
      currentBlock.followClicks.push(s);
    } else {
      initialSteps.push(s);
    }
  }
  if (currentBlock) assetBlocks.push(currentBlock);

  return { initialSteps, assetBlocks };
}

function executeWinClick(x, y, isRight = false) {
  const downFlag = isRight ? '0x08' : '0x02';
  const upFlag = isRight ? '0x10' : '0x04';
  const psCmd = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern void mouse_event(int flags, int dx, int dy, int cButtons, int extraInfo); [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();' -Name U32 -Namespace WinMouse -ErrorAction SilentlyContinue
try { [WinMouse.U32]::SetProcessDPIAware() | Out-Null } catch {}
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
Start-Sleep -Milliseconds 80
[WinMouse.U32]::mouse_event(${downFlag}, 0, 0, 0, 0)
Start-Sleep -Milliseconds 60
[WinMouse.U32]::mouse_event(${upFlag}, 0, 0, 0, 0)
`;
  try {
    execSync(`powershell -NoProfile -Command "${psCmd.replace(/\r?\n/g, ' ')}"`, { stdio: 'ignore' });
  } catch {}
}

function activateFlowWindow() {
  try {
    execSync(`powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $null = $ws.AppActivate('Google Flow'); $null = $ws.AppActivate('Chrome');"`, {
      stdio: 'ignore',
    });
  } catch {}
}

function closeFlowTab() {
  try {
    execSync(`powershell -NoProfile -Command "$ws = New-Object -ComObject WScript.Shell; $null = $ws.AppActivate('Google Flow'); Start-Sleep -Milliseconds 200; $ws.SendKeys('^w')"`, {
      stdio: 'ignore',
    });
  } catch {}
}

async function downloadAssetsForProfile(prof, count, assetBlocks, initialSteps) {
  console.log(`\n📂 [PROFIL ${prof.index}] Masuk ke project terbaru...`);
  activateFlowWindow();
  await delay(500);

  // 1. Eksekusi initial steps (Klik project terbaru)
  for (const init of initialSteps) {
    console.log(`   🖱️  Klik buka project di (${init.X}, ${init.Y})...`);
    executeWinClick(init.X, init.Y, false);
    await delay(5500); // Tunggu kanvas project termuat
  }

  // 2. Eksekusi Blok Aset sebanyak 'count' video
  const targetCount = Math.min(count, assetBlocks.length);
  console.log(`🎯 [PROFIL ${prof.index}] Memulai download ${targetCount} bagian video (berdasarkan rekaman klik kanan)...`);

  for (let bIdx = 0; bIdx < targetCount; bIdx++) {
    const block = assetBlocks[bIdx];
    console.log(`   ⬇️  [VIDEO ${bIdx + 1}/${targetCount}] Klik kanan aset di (${block.rightClick.X}, ${block.rightClick.Y})...`);
    activateFlowWindow();
    executeWinClick(block.rightClick.X, block.rightClick.Y, true);
    await delay(1000); // Tunggu context menu muncul

    for (const fc of block.followClicks) {
      console.log(`      🖱️  Klik pilihan di (${fc.X}, ${fc.Y})...`);
      executeWinClick(fc.X, fc.Y, false);
      const waitTime = Math.max(800, Math.min(2500, fc.DelayMs || 1200));
      await delay(waitTime);
    }

    await delay(1500); // Beri waktu proses download terpancing
  }

  console.log(`✅ [PROFIL ${prof.index}] Selesai mengunduh ${targetCount} video.`);
  await delay(2000);
}

async function runDownloadPipeline(options = {}) {
  const { profilesCount = null, specificProfiles = null, defaultPerProfile = 4, customPerProfile = null } = options;

  const { initialSteps, assetBlocks } = parseRecording();
  console.log(`✅ Berhasil memuat rekaman: 1 langkah buka project & ${assetBlocks.length} blok aset video.`);

  let allProfiles = getMappedProfiles();
  let targetProfiles = allProfiles;

  if (specificProfiles && Array.isArray(specificProfiles)) {
    targetProfiles = allProfiles.filter((p) => specificProfiles.includes(p.index));
  } else if (profilesCount) {
    targetProfiles = allProfiles.slice(0, profilesCount);
  }

  // Baca active_production_session jika ada
  let sessionMap = {};
  if (fs.existsSync(SESSION_FILE)) {
    try {
      const sData = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));
      sessionMap = sData.profileSceneCounts || {};
    } catch {}
  }

  const engineScript = path.resolve(__dirname, 'download_engine.ps1');

  for (let i = 0; i < targetProfiles.length; i++) {
    const prof = targetProfiles[i];
    const sessionCount = sessionMap[String(prof.index)];
    if (sessionCount === 0) {
      console.log(`⏩ [PROFIL ${prof.index}] Dilewati karena tidak ada video yang di-generate pada profil ini.`);
      continue;
    }
    const rawCount = customPerProfile || sessionCount || defaultPerProfile;
    const scenesToDownload = Math.min(5, Math.max(1, rawCount));

    console.log('\n================================================================');
    console.log(`🎬 [${i + 1}/${targetProfiles.length}] MEMPROSES DOWNLOAD PROFIL ${prof.index}: ${prof.name}`);
    console.log(`   Target Unduh: ${scenesToDownload} video (Langkah 1 Buka Project + Download 720p)`);
    console.log('================================================================');

    try {
      execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${engineScript}" -ProfileDir "${prof.dirName}" -AssetCount ${scenesToDownload}`, {
        stdio: 'inherit',
      });
    } catch (err) {
      console.log(`⚠️  Proses unduh untuk Profil ${prof.index} selesai.`);
    }

    if (i < targetProfiles.length - 1) {
      console.log('⏳ Jeda 2 detik sebelum membuka profil berikutnya...\n');
      await delay(2000);
    }
  }

  console.log('\n================================================================');
  console.log(`🎉 SELURUH ${targetProfiles.length} PROFIL SELESAI DIUNDUH!`);
  console.log('================================================================\n');
}

// Standalone runner jika dipanggil dari terminal
if (require.main === module) {
  (async () => {
    console.log('\n================================================================');
    console.log('   📥 CERITAOBIM STUDIO — DOWNLOAD VIDEO (REKAMAN KLIK KANAN)');
    console.log('================================================================');

    const { assetBlocks } = parseRecording();
    const maxAssets = assetBlocks.length || 8;

    const args = process.argv.slice(2);
    let profilesCount = null;
    let specificProfiles = null;
    let customPerProfile = null;

    // Cek apakah ada parameter CLI langsung (misal: --assets=4 atau --count=4)
    const assetArg = args.find((a) => a.startsWith('--assets=') || a.startsWith('--count=') || a.startsWith('--bagian='));
    if (assetArg) {
      customPerProfile = parseInt(assetArg.split('=')[1], 10);
    }

    // 1. Tanyakan: Berapa banyak aset per profil yang ingin di-download?
    if (!customPerProfile) {
      console.log('⚙️  LANGKAH 1/2: JUMLAH ASET PER PROFIL');
      console.log('================================================================');
      console.log(`Tersedia rekaman hingga ${maxAssets} aset video per project.`);
      const countInput = await askQuestion(`Berapa banyak aset per profil yang ingin di-download? (1 s/d ${maxAssets}, Default: 4): `);
      let parsedCount = parseInt(countInput, 10);
      if (isNaN(parsedCount) || parsedCount < 1) parsedCount = 4;
      customPerProfile = Math.min(maxAssets, Math.max(1, parsedCount));
      console.log(`✅ Ditetapkan: ${customPerProfile} aset video per profil.\n`);
    }

    // 2. Tanyakan: Jangkauan Profil Chrome
    if (args.includes('--2profiles')) {
      profilesCount = 2;
    } else if (args.includes('--all')) {
      profilesCount = 10;
    } else {
      console.log('👤 LANGKAH 2/2: PILIH JANGKAUAN PROFIL');
      console.log('================================================================');
      console.log('PILIH PROFIL YANG AKAN DI-DOWNLOAD:');
      console.log('  [1] Semua Profil (Profil 1 s/d 10)');
      console.log('  [2] Uji Coba 2 Profil Saja (Profil 1 & Profil 2)');
      console.log('  [3] Satu Profil Saja');
      console.log('');
      const ans = await askQuestion('Pilih opsi [1/2/3] (Default: 1): ');
      if (ans === '2') {
        profilesCount = 2;
      } else if (ans === '3') {
        const pNum = parseInt(await askQuestion('Nomor profil (1-10): '), 10) || 1;
        specificProfiles = [pNum];
      } else {
        profilesCount = 10;
      }
    }

    await runDownloadPipeline({ profilesCount, specificProfiles, customPerProfile });
  })().catch(console.error);
}

module.exports = {
  runDownloadPipeline,
  parseRecording,
  getMappedProfiles,
};
