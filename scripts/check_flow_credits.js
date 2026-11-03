/**
 * CeritaObim Studio — Pemeriksa Kredit Otomatis 10 Profil Google Flow
 * 
 * Alur Kerja:
 * 1. Membaca 10 profil Chrome dari Local State (Profil 1 s.d. 10).
 * 2. Membuka jendela Chrome per profil ke https://flow.google.com.
 * 3. Mengklik avatar profil di pojok kanan atas untuk membuka popup kredit.
 * 4. Membaca teks kredit (XX kredit Google Flow) secara otomatis via clipboard / konfirmasi.
 * 5. Menyimpan hasil kredit ke storage/flow-accounts.json (format visual X / 50).
 * 6. Membuka visual dashboard di browser (http://localhost:3000/models-usage).
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const readline = require('readline');

const CLICK_TOOL = path.resolve(__dirname, 'click_tool.ps1');
const ACCOUNTS_FILE = path.resolve(__dirname, '..', 'storage', 'flow-accounts.json');

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function askQuestion(query) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans.trim());
    });
  });
}

function waitForUserOrTimeout(seconds, defaultVal, promptMsg) {
  return new Promise((resolve) => {
    let remaining = seconds;
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const timer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(timer);
        rl.close();
        process.stdout.write(`\n⏳ Waktu habis, menggunakan nilai: ${defaultVal}\n`);
        resolve(String(defaultVal));
      } else {
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(`${promptMsg} (${remaining}s): `);
      }
    }, 1000);

    process.stdout.write(`${promptMsg} (${remaining}s): `);
    rl.question('', (ans) => {
      clearInterval(timer);
      rl.close();
      resolve(ans.trim() || String(defaultVal));
    });
  });
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

function clickAvatar() {
  try {
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${CLICK_TOOL}" -ClickFlowAvatar`, {
      encoding: 'utf8',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function extractCredit() {
  try {
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${CLICK_TOOL}" -ExtractGoogleOneCredit`, {
      encoding: 'utf8',
      timeout: 18000,
    });
    const match = out.match(/FOUND_CREDIT:(\d+)/);
    if (match && match[1]) {
      const val = parseInt(match[1], 10);
      if (val >= 0 && val <= 50) {
        return val;
      }
    }
  } catch {}
  return null;
}

function loadAccounts() {
  if (fs.existsSync(ACCOUNTS_FILE)) {
    try {
      return JSON.parse(fs.readFileSync(ACCOUNTS_FILE, 'utf8'));
    } catch {}
  }
  return [];
}

function saveAccounts(accounts) {
  const dir = path.dirname(ACCOUNTS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf8');
}

async function main() {
  console.log('\n================================================================');
  console.log('   🔍 CERITAOBIM STUDIO — PEMERIKSA KREDIT OTOMATIS (12 PROFIL)');
  console.log('================================================================');
  console.log('Metode: Akses langsung ke Histori Kredit Google One (100% Otomatis)');
  console.log('Tidak memerlukan klik manual atau input keyboard dari Anda.');
  console.log('================================================================\n');

  const profiles = getMappedProfiles();
  if (profiles.length === 0) {
    console.error('❌ Tidak ditemukan profil Chrome terpetakan di sistem.');
    return;
  }

  console.log(`Ditemukan ${profiles.length} profil Chrome yang akan diperiksa:`);
  profiles.forEach((p) => console.log(`   [Profil ${p.index}] ${p.name} (${p.email})`));

  console.log('\n🚀 Memulai pemeriksaan otomatis dalam 3 detik...');
  await delay(3000);

  const chromePath = findChromePath();
  const creditActivityUrl = 'https://one.google.com/ai/activity?utm_source=flow&utm_medium=web&utm_campaign=flow_ai_credits_page';
  let accountsData = loadAccounts();
  const accountsMap = new Map(accountsData.map((a) => [a.index, a]));

  for (let i = 0; i < profiles.length; i++) {
    const prof = profiles[i];
    console.log(`\n▶ [${i + 1}/${profiles.length}] Memeriksa Profil ${prof.index}: ${prof.name} (${prof.email})...`);

    // Buka Chrome profil ini langsung ke halaman Histori Kredit Google One
    const child = spawn(
      chromePath,
      [`--profile-directory=${prof.dirName}`, creditActivityUrl],
      { detached: true, stdio: 'ignore' }
    );
    child.unref();

    // Tunggu 5.5 detik agar halaman dan komponen kartu Google One termuat penuh
    await delay(5500);

    // Ekstrak angka kredit otomatis (click_tool.ps1 mencoba hingga 3x secara internal)
    let detectedCredit = extractCredit();

    const existing = accountsMap.get(prof.index);
    const rawCredit = detectedCredit !== null ? detectedCredit : (existing ? existing.credits : 50);
    const finalCredit = Math.min(50, Math.max(0, rawCredit));

    const maxCredits = 50;
    const percentage = Math.min(100, Math.round((finalCredit / maxCredits) * 100));
    let status = 'healthy';
    if (finalCredit < 10) status = 'danger';
    else if (finalCredit < 25) status = 'warning';

    const accountRecord = {
      index: prof.index,
      dirName: prof.dirName,
      name: prof.name,
      email: prof.email,
      credits: finalCredit,
      maxCredits,
      percentage,
      status,
      lastChecked: new Date().toISOString(),
      notes: detectedCredit !== null ? `Auto-sync ${new Date().toLocaleTimeString('id-ID')}` : (existing?.notes || 'Tersimpan'),
    };

    accountsMap.set(prof.index, accountRecord);
    saveAccounts(Array.from(accountsMap.values()).sort((a, b) => a.index - b.index));

    if (detectedCredit !== null) {
      console.log(`   ✅ Sisa Kredit Terbaca: ${finalCredit} / 50 kredit (${percentage}% | Status: ${status.toUpperCase()})`);
    } else {
      console.log(`   ℹ️  Kredit Tersimpan: ${finalCredit} / 50 kredit (Status: ${status.toUpperCase()})`);
    }

    // Jeda singkat sebelum profil berikutnya
    await delay(1000);
  }

  // Cetak Rekapitulasi
  const allUpdated = Array.from(accountsMap.values()).sort((a, b) => a.index - b.index);
  console.log('\n================================================================');
  console.log('   📊 REKAPITULASI KREDIT 12 PROFIL GOOGLE FLOW');
  console.log('================================================================');
  console.log(' No | Profil & Email               | Sisa Kredit | Visual Bar   | Status');
  console.log('----+-------------------------------+-------------+--------------+--------');

  allUpdated.forEach((acc) => {
    const barBlocks = Math.round((acc.credits / 50) * 10);
    const barStr = '█'.repeat(Math.min(10, barBlocks)) + '░'.repeat(Math.max(0, 10 - barBlocks));
    const padEmail = (acc.email || acc.name).padEnd(28).slice(0, 28);
    const padCredit = `${acc.credits} / 50`.padEnd(11);
    console.log(` #${String(acc.index).padStart(2, ' ')} | ${padEmail} | ${padCredit} | [${barStr}] | ${acc.status.toUpperCase()}`);
  });

  const totalCredits = allUpdated.reduce((sum, a) => sum + a.credits, 0);
  console.log('================================================================');
  console.log(`🎯 TOTAL KREDIT TERSEDIA: ${totalCredits} / 500 kredit (~${Math.floor(totalCredits / 3)} video final)`);
  console.log('🌐 Membuka visual dashboard di browser: http://localhost:3000/models-usage ...\n');

  try {
    const openUrl = 'http://localhost:3000/models-usage';
    execSync(`start "" "${openUrl}"`, { stdio: 'ignore' });
  } catch {}
}

main().catch(console.error);
