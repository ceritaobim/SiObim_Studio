/**
 * CeritaObim Studio — Local Telegram Bot Runner (Polling Mode)
 *
 * Jalankan script ini untuk menguji dan mengobrol dengan Bot Telegram langsung
 * dari laptop Anda sebelum di-deploy ke Vercel!
 *
 * Polling membaca pesan masuk dari Telegram dan meneruskannya ke
 * API Webhook lokal (http://localhost:3000/api/telegram/webhook).
 */

const fs = require('fs');
const path = require('path');

// Baca .env.local secara manual jika ada
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach((line) => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const k = trimmed.slice(0, eqIdx).trim();
        const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[k]) process.env[k] = v;
      }
    }
  });
}

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ALLOWED_ID = process.env.TELEGRAM_ALLOWED_USER_ID;
const LOCAL_WEBHOOK_URL = process.env.LOCAL_WEBHOOK_URL || 'http://localhost:3000/api/telegram/webhook';

if (!TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN belum diset di .env.local');
  process.exit(1);
}

console.log('\n================================================================');
console.log('       🤖 CERITAOBIM STUDIO — TELEGRAM BOT RUNNER (LOCAL)       ');
console.log('================================================================');
console.log(`🔑 Bot Token  : ${TOKEN.slice(0, 10)}...`);
console.log(`👤 Whitelist  : User ID ${ALLOWED_ID || '(Semua User)'}`);
console.log(`🌐 Target API : ${LOCAL_WEBHOOK_URL}`);
console.log('================================================================\n');

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function startPolling() {
  // Hapus webhook sebelumnya agar mode polling aktif tanpa konflik
  try {
    await fetch(`https://api.telegram.org/bot${TOKEN}/deleteWebhook?drop_pending_updates=false`);
    console.log('✅ Webhook dibersihkan, memulai Long-Polling Telegram...');
  } catch (err) {
    console.warn('⚠️ Gagal membersihkan webhook:', err.message);
  }

  let offset = 0;
  console.log('🚀 BOT SIAGA! Silakan buka Telegram di HP Anda dan chat dengan bot.\n');

  while (true) {
    try {
      const res = await fetch(`https://api.telegram.org/bot${TOKEN}/getUpdates?offset=${offset}&timeout=20`);
      if (!res.ok) {
        await delay(3000);
        continue;
      }

      const data = await res.json();
      if (data.ok && Array.isArray(data.result)) {
        for (const update of data.result) {
          offset = update.update_id + 1;

          const sender = update.message?.from || update.callback_query?.from;
          const text = update.message?.text || update.callback_query?.data || '(Non-teks)';
          console.log(`📩 [Pesan Masuk] Dari: ${sender?.first_name} (@${sender?.username || sender?.id}): "${text}"`);

          // Teruskan ke API Studio dengan mekanisme retry jika server sedang sibuk/kompilasi
          let forwarded = false;
          let attempts = 0;
          const maxAttempts = 3;

          while (!forwarded && attempts < maxAttempts) {
            attempts++;
            try {
              const apiRes = await fetch(LOCAL_WEBHOOK_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(update),
              });
              const apiData = await apiRes.json().catch(() => ({}));
              if (!apiRes.ok) {
                if (apiRes.status >= 500 && attempts < maxAttempts) {
                  console.warn(   ⚠️ Server Studio sedang kompilasi/restarting (HTTP ). Mencoba lagi (/)...);
                  await delay(2000);
                  continue;
                }
                console.error('❌ API Error:', apiRes.status, apiData);
              } else {
                console.log('   ✅ Berhasil diproses oleh Studio!');
              }
              forwarded = true;
            } catch (forwardErr) {
              if (attempts < maxAttempts) {
                console.warn(   ⚠️ Menunggu server Next.js aktif (/)...);
                await delay(2500);
              } else {
                console.error('❌ Gagal meneruskan ke localhost:3000. Pastikan server dev berjalan!', forwardErr.message);
                forwarded = true;
              }
            }
          }
        }
      }
    } catch (pollErr) {
      // transient network error
      await delay(3000);
    }
  }
}

startPolling().catch(console.error);
