/**
 * CeritaObim Studio — Google Flow Auto-Generator (Opsi 1: Otomasi Penuh via Playwright)
 * 
 * Alur Kerja:
 * 1. Mendeteksi 10 profil Chrome (Profil 1 s/d 10) dari Local State.
 * 2. Memastikan port CDP (9222) aktif di Chrome.
 * 3. Mengambil antrean scene pending dari database (storage/macro/pending_tasks.json).
 * 4. Berpindah profil Chrome satu per satu (sekuensial).
 * 5. Di setiap profil:
 *    - Buka Google Flow.
 *    - Masukkan prompt scene secara otomatis.
 *    - Klik tombol "Generate" / "Buat".
 *    - Tunggu render video selesai.
 *    - Download/simpan video klip ke `storage/macro_drops/<expectedFilename>`.
 * 6. Memicu sinkronisasi dropzone agar otomatis dirakit bersama audio Puck Bold & di-upload ke Google Drive!
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const http = require('http');
const { spawn, execSync } = require('child_process');

// Gunakan playwright-core dari node_modules
const playwrightPath = path.resolve(__dirname, '..', 'node_modules', 'playwright-core');
let chromium;
try {
  chromium = require(playwrightPath).chromium;
} catch (e) {
  console.error('❌ Gagal memuat playwright-core:', e.message);
  process.exit(1);
}

const CDP_PORT = 9222;
const BASE_URL = process.env.STUDIO_BASE_URL || 'http://localhost:3000';
const SESSION_COOKIE = 'co_studio_owner_session=co_verified_owner_365d_token_v1';
const DROP_DIR = path.resolve(__dirname, '..', 'storage', 'macro_drops');
const PENDING_FILE = path.resolve(__dirname, '..', 'storage', 'macro', 'pending_tasks.json');

function ensureDirs() {
  if (!fs.existsSync(DROP_DIR)) fs.mkdirSync(DROP_DIR, { recursive: true });
}

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
    throw new Error('File konfigurasi Chrome tidak ditemukan di: ' + localStatePath);
  }

  const raw = fs.readFileSync(localStatePath, 'utf8');
  const json = JSON.parse(raw);
  const infoCache = json.profile?.info_cache || {};

  const profiles = [];
  for (const [dirName, pData] of Object.entries(infoCache)) {
    const match = (pData.name || '').match(/(\d+)\((.+?)\)/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > 0) { // Lewatkan profil 0 (akun pribadi)
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

async function checkCdpPort(port = CDP_PORT) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/json/version`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function ensureCdpReady() {
  const isReady = await checkCdpPort(CDP_PORT);
  if (isReady) return true;

  console.log('\n⚠️  PORT REMOTE DEBUGGING (9222) BELUM AKTIF DI CHROME.');
  console.log('Agar Robot Playwright bisa mengetikkan prompt & mengklik tombol Generate di Google Flow,');
  console.log('Chrome harus diluncurkan dengan izin kendali (--remote-debugging-port=9222).\n');
  console.log('PILIHAN PERSIAPAN:');
  console.log('  [1] Restart Chrome Otomatis dengan Mode Remote Debugging (Rekomendasi)');
  console.log('      (Tab yang sedang terbuka akan otomatis dipulihkan/restore)');
  console.log('  [2] Batal');
  console.log('');

  const ans = await askQuestion('Pilih tindakan [1/2] (Default: 1): ');
  if (ans === '2') {
    console.log('Dibatalkan oleh pengguna.');
    process.exit(0);
  }

  console.log('\n🔄 Mempersiapkan Chrome dengan Remote Debugging Port 9222...');
  try {
    execSync('taskkill /IM chrome.exe /F', { stdio: 'ignore' });
  } catch {
    // Abaikan jika chrome belum berjalan
  }
  await delay(1500);

  const chromePath = findChromePath();
  // Luncurkan Chrome dengan port 9222 dan restore session
  const child = spawn(
    chromePath,
    [`--remote-debugging-port=${CDP_PORT}`, '--restore-last-session'],
    { detached: true, stdio: 'ignore' }
  );
  child.unref();

  process.stdout.write('⏳ Menunggu Chrome aktif');
  for (let i = 0; i < 15; i++) {
    await delay(1000);
    process.stdout.write('.');
    if (await checkCdpPort(CDP_PORT)) {
      console.log(' ✅ TERHUBUNG!');
      return true;
    }
  }

  console.error('\n❌ Gagal menghubungkan ke Chrome di port 9222.');
  return false;
}

function loadPendingTasks() {
  if (!fs.existsSync(PENDING_FILE)) {
    return [];
  }
  try {
    const data = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function triggerServerSync() {
  return new Promise((resolve) => {
    const url = new URL('/api/macro/sync', BASE_URL);
    const req = http.request(
      url,
      {
        method: 'POST',
        headers: { Cookie: SESSION_COOKIE },
      },
      (res) => {
        let d = '';
        res.on('data', (c) => (d += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(d));
          } catch {
            resolve({ ok: false });
          }
        });
      }
    );
    req.on('error', () => resolve({ ok: false }));
    req.end();
  });
}

async function findPromptInputBox(page) {
  const promptSelectors = [
    'textarea[placeholder*="prompt" i]',
    'textarea[placeholder*="describe" i]',
    'textarea[placeholder*="create" i]',
    'textarea[placeholder*="generate" i]',
    'textarea[placeholder*="buat" i]',
    'textarea[placeholder*="ketik" i]',
    'textarea',
    'div[contenteditable="true"][role="textbox"]',
    'div[contenteditable="true"]',
    'input[type="text"][placeholder*="prompt" i]',
  ];

  for (const sel of promptSelectors) {
    const loc = page.locator(sel).first();
    if ((await loc.count().catch(() => 0)) > 0 && (await loc.isVisible().catch(() => false))) {
      return loc;
    }
  }
  return null;
}

async function isGoogleSignInPage(page) {
  const url = page.url();
  if (url.includes('accounts.google.com')) return true;

  const signInBtnCount = await page
    .locator('a[href*="accounts.google.com"], button:has-text("Sign in"), button:has-text("Login"), button:has-text("Masuk")')
    .count()
    .catch(() => 0);

  const promptInput = await findPromptInputBox(page);
  return signInBtnCount > 0 && !promptInput;
}

async function generateSingleClipInFlow(page, task) {
  console.log(`\n----------------------------------------------------------------`);
  console.log(`🎬 [${task.contentCode}] BAGIAN ${task.sceneIndex}: "${task.title}"`);
  console.log(`📁 Target File: ${task.expectedFilename} (${task.durationSeconds}s)`);
  console.log(`----------------------------------------------------------------`);

  const flowUrl = 'https://flow.google.com';
  if (!page.url().includes('flow.google.com') && !page.url().includes('labs.google')) {
    console.log(`🌐 Membuka Google Flow: ${flowUrl}`);
    await page.goto(flowUrl, { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    await delay(3000);
  }

  if (await isGoogleSignInPage(page)) {
    console.log(`⚠️  Halaman meminta Login Google di profil ini.`);
    console.log(`👉 Silakan login di jendela Chrome tersebut sekarang.`);
    for (let c = 60; c > 0; c--) {
      process.stdout.write(`\r⏱️  Menunggu login selesai: ${c} detik...   `);
      await delay(1000);
      if (!(await isGoogleSignInPage(page))) {
        console.log('\n✅ Login terdeteksi berhasil!');
        break;
      }
    }
  }

  // Cari kotak input prompt
  let promptBox = await findPromptInputBox(page);

  // Jika belum ada, coba klik tombol "+ Project baru" / "New project"
  if (!promptBox) {
    console.log(`🔍 Kotak prompt belum terlihat, mencari tombol "Project baru"...`);
    const newProjectSelectors = [
      'button:has-text("Project baru")',
      'button:has-text("New project")',
      'button:has-text("Proyek baru")',
      '[role="button"]:has-text("Project baru")',
      '[role="button"]:has-text("New project")',
      'text="Project baru"',
      'text="New project"',
    ];
    for (const sel of newProjectSelectors) {
      const btn = page.locator(sel).first();
      if ((await btn.count().catch(() => 0)) > 0 && (await btn.isVisible().catch(() => false))) {
        await btn.click({ timeout: 5000 }).catch(() => {});
        for (let i = 0; i < 10; i++) {
          await delay(800);
          promptBox = await findPromptInputBox(page);
          if (promptBox) break;
        }
        break;
      }
    }
  }

  if (!promptBox) {
    console.log(`⚠️  Kotak prompt belum ditemukan. Menunggu 5 detik lagi...`);
    await delay(5000);
    promptBox = await findPromptInputBox(page);
  }

  if (!promptBox) {
    console.error(`❌ Kotak input prompt Google Flow tidak ditemukan. Lewatkan adegan ini.`);
    return false;
  }

  // Masukkan prompt teks
  console.log(`✍️  Mengetikkan teks prompt scene ke Google Flow...`);
  await promptBox.click({ timeout: 5000 }).catch(() => {});
  await page.keyboard.press('Control+A').catch(() => {});
  await page.keyboard.press('Backspace').catch(() => {});
  await promptBox.fill(task.promptText).catch(async () => {
    await page.keyboard.insertText(task.promptText);
  });
  await delay(600);

  // Siapkan listener untuk download atau network capture MP4
  let capturedVideoBuffer = null;
  const responseHandler = async (res) => {
    try {
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      const u = res.url();
      if (res.status() === 200 && (ct.includes('video/mp4') || ct.includes('video/webm') || u.includes('.mp4'))) {
        const buf = await res.body();
        if (buf && buf.byteLength > 80000) {
          capturedVideoBuffer = buf;
        }
      }
    } catch {}
  };
  page.on('response', responseHandler);

  let downloadPromiseResolved = null;
  page.waitForEvent('download', { timeout: 180000 }).then(async (dl) => {
    const dlPath = await dl.path();
    if (dlPath && fs.existsSync(dlPath)) {
      downloadPromiseResolved = fs.readFileSync(dlPath);
    }
  }).catch(() => {});

  // Klik tombol "Generate" / "Buat"
  console.log(`🚀 Mengklik tombol "Generate" di Google Flow...`);
  const submitSelectors = [
    'button:has-text("Generate")',
    'button:has-text("Buat")',
    'button:has-text("Create")',
    'button[aria-label*="Generate" i]',
    'button[aria-label*="Buat" i]',
    'button[aria-label*="Create" i]',
    'button[aria-label*="Send" i]',
    'button[aria-label*="Submit" i]',
    'button[type="submit"]',
  ];

  let clicked = false;
  for (const sel of submitSelectors) {
    const btn = page.locator(sel).last();
    if ((await btn.count().catch(() => 0)) > 0 && (await btn.isVisible().catch(() => false)) && (await btn.isEnabled().catch(() => false))) {
      await btn.click({ timeout: 5000 }).catch(() => {});
      clicked = true;
      break;
    }
  }

  if (!clicked) {
    await promptBox.press('Enter').catch(() => {});
  }

  console.log(`⏳ Sedang render video di Google Flow (~1 - 2 menit)...`);
  const maxWait = 180000;
  const start = Date.now();
  let finalBuffer = null;

  while (Date.now() - start < maxWait) {
    if (downloadPromiseResolved && downloadPromiseResolved.byteLength > 50000) {
      finalBuffer = downloadPromiseResolved;
      break;
    }
    if (capturedVideoBuffer && capturedVideoBuffer.byteLength > 50000) {
      finalBuffer = capturedVideoBuffer;
      break;
    }

    // Cek elemen video baru di DOM
    const videoData = await page.evaluate(async () => {
      const vids = Array.from(document.querySelectorAll('video'));
      for (const v of vids) {
        const src = v.currentSrc || v.src;
        if (src && (src.startsWith('http') || src.startsWith('blob:'))) {
          try {
            const r = await fetch(src);
            const blob = await r.blob();
            if (blob.size > 80000) {
              return new Promise((res) => {
                const reader = new FileReader();
                reader.onloadend = () => res(reader.result);
                reader.readAsDataURL(blob);
              });
            }
          } catch {}
        }
      }
      return null;
    }).catch(() => null);

    if (videoData && typeof videoData === 'string' && videoData.includes(',')) {
      const base64Str = videoData.split(',')[1];
      finalBuffer = Buffer.from(base64Str, 'base64');
      break;
    }

    const elapsed = Math.round((Date.now() - start) / 1000);
    process.stdout.write(`\r⏳ Render sedang berjalan: ${elapsed}s berlalu...   `);
    await delay(3000);
  }

  page.off('response', responseHandler);

  if (finalBuffer && finalBuffer.byteLength > 50000) {
    const destPath = path.join(DROP_DIR, task.expectedFilename);
    fs.writeFileSync(destPath, finalBuffer);
    console.log(`\n\n🎉 BERHASIL DIGENERATE & DISIMPAN!`);
    console.log(`   📂 File: ${destPath} (${Math.round(finalBuffer.byteLength / 1024)} KB)`);

    // Pemicu sinkronisasi dropzone ke database & Google Drive
    process.stdout.write(`☁️  Menyinkronkan ke Website & Google Drive... `);
    const syncRes = await triggerServerSync();
    if (syncRes.ok) {
      console.log(`✅ TERSINKRONKAN!`);
    } else {
      console.log(`(Tersimpan lokal di dropzone)`);
    }
    return true;
  } else {
    console.log(`\n⚠️  Waktu tunggu render berakhir atau video belum siap diunduh otomatis.`);
    console.log(`💡 Jika video sudah tampil di jendela Google Flow, Anda bisa klik tombol download pada video tersebut.`);
    return false;
  }
}

async function main() {
  ensureDirs();

  console.log('\n================================================================');
  console.log('   🚀 CERITAOBIM STUDIO — GOOGLE FLOW AUTO-GENERATOR (PLAYWRIGHT)');
  console.log('================================================================\n');

  // Pastikan Chrome aktif dengan CDP port 9222
  const cdpReady = await ensureCdpReady();
  if (!cdpReady) {
    process.exit(1);
  }

  // Baca daftar profil
  let profiles = [];
  try {
    profiles = getMappedProfiles();
  } catch (err) {
    console.error('❌ Gagal mendeteksi profil Chrome:', err.message);
    process.exit(1);
  }

  console.log(`\n✅ Terdeteksi ${profiles.length} profil Chrome siap pakai:`);
  profiles.forEach((p) => {
    console.log(`   [Profil ${String(p.index).padStart(2, ' ')}] Folder: "${p.dirName}" | Label: "${p.name}"`);
  });

  // Baca antrean pending task
  const allTasks = loadPendingTasks();
  if (allTasks.length === 0) {
    console.log('\n🎉 SELURUH TUGAS SCENE VIDEO LENGKAP! Tidak ada antrean pending.');
    return;
  }

  console.log(`\n📋 Terdapat ${allTasks.length} adegan video pending yang perlu dibuat.`);
  console.log(`🎯 Konten Prioritas: [${allTasks[0].contentCode}] "${allTasks[0].title}"`);

  console.log('\nPILIH MODE GENERATOR:');
  console.log(`  [1] Generate Otomatis dengan ${profiles.length} Profil Bergantian (4 klip per profil)`);
  console.log('  [2] Generate 1 Klip Saja untuk Uji Coba (Scene 1)');
  console.log('  [3] Tentukan Jumlah Klip per Profil Manual');
  console.log('');

  const choice = await askQuestion('Masukkan pilihan Anda [1/2/3] (Default: 1): ');
  let clipsPerProfile = 4;
  let targetProfiles = profiles;

  if (choice === '2') {
    clipsPerProfile = 1;
    targetProfiles = profiles.slice(0, 1);
  } else if (choice === '3') {
    const num = await askQuestion('Berapa klip per profil? (1-5): ');
    clipsPerProfile = Math.max(1, parseInt(num, 10) || 4);
  }

  console.log(`\n🚀 Memulai otomatisasi Playwright: ${targetProfiles.length} profil x ${clipsPerProfile} klip...`);

  // Sambungkan Playwright ke browser Chrome yang sudah jalan dengan port 9222
  let browser;
  try {
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${CDP_PORT}`);
  } catch (err) {
    console.error('❌ Gagal menyambungkan Playwright ke port 9222:', err.message);
    process.exit(1);
  }

  const contexts = browser.contexts();
  const context = contexts[0] || (await browser.newContext());

  let taskPointer = 0;
  const chromePath = findChromePath();

  for (let pIdx = 0; pIdx < targetProfiles.length; pIdx++) {
    const prof = targetProfiles[pIdx];
    console.log('\n================================================================');
    console.log(`🌟 [PROFIL ${prof.index}/${targetProfiles.length}] MENGAKTIFKAN ${prof.name}`);
    console.log('================================================================');

    // Buka jendela profil Chrome untuk profil ini dengan URL Google Flow
    const child = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, 'https://flow.google.com'],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();
    await delay(3000);

    // Cari halaman Google Flow di context
    const pages = context.pages();
    let flowPage = pages.find((p) => p.url().includes('flow.google.com') || p.url().includes('labs.google'));
    if (!flowPage) {
      flowPage = await context.newPage();
      await flowPage.goto('https://flow.google.com', { waitUntil: 'domcontentloaded', timeout: 45000 }).catch(() => {});
    }
    await flowPage.bringToFront().catch(() => {});

    // Kerjakan sejumlah klip untuk profil ini
    for (let c = 0; c < clipsPerProfile; c++) {
      if (taskPointer >= allTasks.length) {
        console.log('\n🎉 Semua antrean scene video telah selesai digenerate!');
        break;
      }

      const currentTask = allTasks[taskPointer];
      const success = await generateSingleClipInFlow(flowPage, currentTask);
      taskPointer++;

      if (c < clipsPerProfile - 1) {
        console.log(`\n⏱️  Jeda 5 detik sebelum klip berikutnya di profil ini...`);
        await delay(5000);
      }
    }

    if (pIdx < targetProfiles.length - 1 && taskPointer < allTasks.length) {
      console.log(`\n🔄 Selesai giliran Profil ${prof.index}. Beralih ke Profil ${targetProfiles[pIdx + 1].index}...`);
      await delay(4000);
    }
  }

  console.log('\n================================================================');
  console.log('   🎉 SESI OTOMASI GENERATE VIDEO SELESAI!');
  console.log('================================================================');
  console.log('Semua video yang selesai telah disimpan ke storage\\macro_drops,');
  console.log('disatukan bersama narasi Puck Bold, dan disinkronkan ke Google Drive.');
  console.log('================================================================\n');
}

main().catch(console.error);
