const fs = require('fs');
const path = require('path');

function showProfiles() {
  const localStatePath = path.join(
    process.env.LOCALAPPDATA || '',
    'Google',
    'Chrome',
    'User Data',
    'Local State'
  );

  if (!fs.existsSync(localStatePath)) {
    console.log('  ⚠️  Local State Chrome tidak ditemukan.');
    return;
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
        const displayLabel = pData.user_name || match[2] || pData.name;
        profiles.push({
          index: num,
          label: displayLabel,
        });
      }
    }
  }

  profiles.sort((a, b) => a.index - b.index);

  console.log('  DAFTAR 12 AKUN PROFIL GOOGLE CHROME TERSEDIA:\n');
  const half = Math.ceil(profiles.length / 2);
  for (let i = 0; i < half; i++) {
    const p1 = profiles[i];
    const p2 = profiles[i + half];

    const col1 = p1
      ? `  [${String(p1.index).padStart(2, ' ')}] ${p1.label.padEnd(30, ' ')}`
      : ''.padEnd(38, ' ');
    const col2 = p2
      ? `|   [${String(p2.index).padStart(2, ' ')}] ${p2.label.padEnd(30, ' ')}`
      : '';

    console.log(`${col1} ${col2}`);
  }
}

showProfiles();
