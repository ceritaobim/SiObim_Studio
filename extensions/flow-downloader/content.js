/**
 * CeritaObim Studio — Google Flow Video Downloader (Content Script)
 *
 * FITUR UTAMA: 100% AUTOPILOT
 * 1. Di Beranda Flow: Otomatis membuka project terakhir.
 * 2. Di Kanvas Project: Otomatis mendeteksi semua kartu video dan mengunduh 720p satu per satu.
 * 3. 0% Miss-Click: Bekerja langsung di level elemen DOM Google Flow.
 */

(function () {
  console.log('[CeritaObim] Flow Downloader Content Script loaded.');

  if (window.__ceritaObimDownloaderLoaded) return;
  window.__ceritaObimDownloaderLoaded = true;

  let detectedCards = [];
  let isDownloading = false;
  let targetDownloadCount = 5;
  let autoPilotTriggered = false;

  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  // ==========================================
  // 1. FLOATING TOOLBAR UI (STATUS DISPLAY)
  // ==========================================
  function createFloatingUI() {
    if (document.getElementById('ceritaobim-floating-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'ceritaobim-floating-panel';
    panel.innerHTML = `
      <div class="cobim-header">
        <div class="cobim-title-group">
          <span class="cobim-badge-status" id="cobim-status-dot"></span>
          <span>⚡ CeritaObim Autopilot</span>
        </div>
        <div class="cobim-controls-top">
          <button class="cobim-icon-btn" id="cobim-btn-toggle" title="Kecilkan/Besarkan panel">_</button>
        </div>
      </div>
      <div class="cobim-body">
        <div class="cobim-info-card">
          <div id="cobim-page-status" style="font-weight: 600;">🚀 Autopilot Aktif</div>
          <div id="cobim-card-count" style="margin-top: 4px; color: #38bdf8;">Memulai alur otomatis...</div>
        </div>

        <div class="cobim-input-row">
          <label for="cobim-input-count">Jumlah video diunduh:</label>
          <input type="number" id="cobim-input-count" class="cobim-input-number" min="1" max="20" value="5" />
        </div>

        <button id="cobim-btn-download-all" class="cobim-btn-primary">
          <span>📥 Unduh Ulang Semua (720p)</span>
        </button>

        <div class="cobim-log-box" id="cobim-log-box">
          [AUTOPILOT] Sistem siap. Menjalankan deteksi otomatis...
        </div>
      </div>
    `;

    document.body.appendChild(panel);

    const btnToggle = panel.querySelector('#cobim-btn-toggle');
    btnToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      panel.classList.toggle('minimized');
      btnToggle.textContent = panel.classList.contains('minimized') ? '◻' : '_';
    });

    panel.addEventListener('click', () => {
      if (panel.classList.contains('minimized')) {
        panel.classList.remove('minimized');
        btnToggle.textContent = '_';
      }
    });

    const btnDownload = panel.querySelector('#cobim-btn-download-all');
    btnDownload.addEventListener('click', () => {
      const countInput = panel.querySelector('#cobim-input-count');
      const count = parseInt(countInput.value, 10) || 5;
      startBatchDownload(count);
    });

    const inputCount = panel.querySelector('#cobim-input-count');
    inputCount.addEventListener('change', (e) => {
      targetDownloadCount = parseInt(e.target.value, 10) || 5;
    });
  }

  function logMessage(msg, type = '') {
    console.log(`[CeritaObim] ${msg}`);
    const logBox = document.getElementById('cobim-log-box');
    if (!logBox) return;
    const item = document.createElement('div');
    if (type) item.className = type;
    item.textContent = `• ${msg}`;
    logBox.appendChild(item);
    logBox.scrollTop = logBox.scrollHeight;
  }

  function setStatus(text, cardCountText = '', statusType = 'normal') {
    const pageStatus = document.getElementById('cobim-page-status');
    const cardCountEl = document.getElementById('cobim-card-count');
    const statusDot = document.getElementById('cobim-status-dot');

    if (pageStatus && text) pageStatus.textContent = text;
    if (cardCountEl && cardCountText) cardCountEl.textContent = cardCountText;
    if (statusDot) {
      statusDot.className = 'cobim-badge-status ' + (statusType === 'busy' ? 'busy' : statusType === 'error' ? 'error' : '');
    }
  }

  // ==========================================
  // 2. AUTOPILOT TAHAP 1: BUKA PROJECT TERAKHIR (BERANDA)
  // ==========================================
  async function handleHomepageAutopilot() {
    setStatus('🏠 Beranda Flow Terdeteksi', 'Mencari project terakhir...');
    logMessage('Mencari kartu project terakhir di beranda...', 'highlight');

    await sleep(2500);

    // 1. Cari link tag <a> yang menuju project
    const projectLinks = Array.from(document.querySelectorAll('a[href*="/project/"]'));
    if (projectLinks.length > 0) {
      logMessage(`✅ Project ditemukan: ${projectLinks[0].href}. Membuka project...`, 'success');
      setStatus('📂 Membuka Project...', 'Sedang navigasi ke kanvas', 'busy');
      projectLinks[0].click();
      return true;
    }

    // 2. Cari kartu project di area bawah kiri beranda (posisi standar Recent Projects)
    const x = Math.round(window.innerWidth * 0.15);
    const y = Math.round(window.innerHeight * 0.86);
    const el = document.elementFromPoint(x, y);

    if (el) {
      logMessage(`✅ Mengklik elemen kartu project di titik (${x}, ${y})...`, 'success');
      setStatus('📂 Membuka Project...', 'Mengeklik kartu project', 'busy');
      el.click();
      el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      return true;
    }

    logMessage('⚠️ Belum menemukan kartu project. Mencoba lagi dalam 2 detik...', 'warn');
    setTimeout(handleHomepageAutopilot, 2000);
    return false;
  }

  // ==========================================
  // 3. DETEKSI KARTU VIDEO DI KANVAS
  // ==========================================
  function scanForVideoCards() {
    document.querySelectorAll('.cobim-card-marker').forEach((el) => el.remove());

    const isProjectPage = window.location.href.includes('/project/');
    if (!isProjectPage) return [];

    const cards = [];

    // Strategi A: Tag video langsung
    const videoElements = Array.from(document.querySelectorAll('video'));
    if (videoElements.length > 0) {
      videoElements.forEach((v) => {
        let p = v.parentElement;
        while (p && p !== document.body) {
          const rect = p.getBoundingClientRect();
          if (rect.width >= 120 && rect.height >= 180 && rect.width < 1000) {
            cards.push(p);
            break;
          }
          p = p.parentElement;
        }
      });
    }

    // Strategi B: Gambar thumbnail kanvas berukuran vertikal
    if (cards.length === 0) {
      const images = Array.from(document.querySelectorAll('img'));
      images.forEach((img) => {
        const rect = img.getBoundingClientRect();
        if (rect.width >= 100 && rect.height >= 140 && rect.top > 80 && rect.left > 100) {
          let p = img.parentElement;
          while (p && p !== document.body) {
            const pRect = p.getBoundingClientRect();
            if (pRect.width >= 120 && pRect.height >= 180 && pRect.width < 800) {
              cards.push(p);
              break;
            }
            p = p.parentElement;
          }
        }
      });
    }

    // Strategi C: Elemen kanvas role/class
    if (cards.length === 0) {
      const candidates = Array.from(
        document.querySelectorAll('[role="gridcell"], [data-node-id], [class*="card"], [class*="node"], [class*="tile"]')
      );
      candidates.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.width >= 120 && rect.height >= 180 && rect.top > 100 && rect.left > 80) {
          cards.push(el);
        }
      });
    }

    // Deduplikasi
    const uniqueCards = [];
    cards.forEach((c) => {
      const rectC = c.getBoundingClientRect();
      const isDuplicate = uniqueCards.some((existing) => {
        const rectE = existing.getBoundingClientRect();
        const diffX = Math.abs(rectC.left - rectE.left);
        const diffY = Math.abs(rectC.top - rectE.top);
        return diffX < 30 && diffY < 30;
      });
      if (!isDuplicate) uniqueCards.push(c);
    });

    // Urutkan kiri ke kanan (Video 1 -> 2 -> dst)
    uniqueCards.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      if (Math.abs(rectA.top - rectB.top) > 100) {
        return rectA.top - rectB.top;
      }
      return rectA.left - rectB.left;
    });

    detectedCards = uniqueCards;

    uniqueCards.forEach((c, idx) => {
      try {
        const marker = document.createElement('div');
        marker.className = 'cobim-card-marker';
        marker.textContent = `#${idx + 1}`;
        c.style.position = 'relative';
        c.appendChild(marker);
      } catch {}
    });

    return uniqueCards;
  }

  // ==========================================
  // 4. AUTOPILOT TAHAP 2: UNDUH VIDEO 720p PER KARTU
  // ==========================================
  async function triggerCardDownload(cardElement, cardIndex, total) {
    logMessage(`[Video ${cardIndex + 1}/${total}] Membuka menu konteks kartu...`, 'highlight');

    cardElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    await sleep(600);

    const rect = cardElement.getBoundingClientRect();
    const clientX = Math.round(rect.left + rect.width / 2);
    const clientY = Math.round(rect.top + rect.height / 2);

    const mouseOpts = {
      bubbles: true,
      cancelable: true,
      view: window,
      button: 2,
      buttons: 2,
      clientX,
      clientY,
      screenX: window.screenX + clientX,
      screenY: window.screenY + clientY,
    };

    // Dispatch klik kanan
    cardElement.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
    cardElement.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
    cardElement.dispatchEvent(new MouseEvent('contextmenu', mouseOpts));
    cardElement.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
    cardElement.dispatchEvent(new PointerEvent('pointerup', mouseOpts));

    await sleep(600);

    // Cari tombol Download / Unduh
    const menuItems = Array.from(
      document.querySelectorAll('[role="menuitem"], button, div, span, li, a')
    );

    let downloadItem = menuItems.find((el) => {
      const txt = (el.textContent || '').trim().toLowerCase();
      return (txt === 'download' || txt === 'unduh') && el.offsetParent !== null;
    });

    if (!downloadItem) {
      downloadItem = menuItems.find((el) => {
        const txt = (el.textContent || '').trim().toLowerCase();
        return (txt.startsWith('download') || txt.startsWith('unduh')) && el.offsetParent !== null && txt.length < 20;
      });
    }

    if (!downloadItem) {
      logMessage(`⚠️ [Video ${cardIndex + 1}/${total}] Menu Download tidak muncul. Menutup menu...`, 'warn');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return false;
    }

    logMessage(`[Video ${cardIndex + 1}/${total}] Mengeklik menu Download...`);
    downloadItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    downloadItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    downloadItem.click();

    await sleep(600);

    // Cari opsi 720p
    const subItems = Array.from(document.querySelectorAll('*'));
    let p720Item = subItems.find((el) => {
      const txt = (el.textContent || '').trim();
      return txt.includes('720p') && el.offsetParent !== null && el.children.length <= 2;
    });

    if (!p720Item) {
      p720Item = subItems.find((el) => {
        const txt = (el.textContent || '').trim();
        return txt.startsWith('720') && el.offsetParent !== null;
      });
    }

    if (!p720Item) {
      logMessage(`⚠️ [Video ${cardIndex + 1}/${total}] Opsi 720p tidak ditemukan.`, 'warn');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));
      return false;
    }

    logMessage(`[Video ${cardIndex + 1}/${total}] ✅ Memilih 720p! Unduhan dimulai.`, 'success');
    p720Item.click();

    await sleep(400);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }));

    return true;
  }

  // ==========================================
  // 5. BATCH DOWNLOAD RUNNER
  // ==========================================
  async function startBatchDownload(targetCount = 5) {
    if (isDownloading) return;

    const cards = scanForVideoCards();
    if (!cards || cards.length === 0) {
      logMessage('⏳ Menunggu kanvas selesai dimuat...', 'warn');
      return false;
    }

    const actualCount = Math.min(targetCount, cards.length);
    logMessage(`🚀 [AUTOPILOT] Mengunduh ${actualCount} video secara otomatis...`, 'highlight');
    setStatus('⏳ Autopilot Mengunduh...', `${actualCount} Video`, 'busy');
    isDownloading = true;

    const btn = document.getElementById('cobim-btn-download-all');
    if (btn) btn.disabled = true;

    let successCount = 0;

    for (let i = 0; i < actualCount; i++) {
      const ok = await triggerCardDownload(cards[i], i, actualCount);
      if (ok) successCount++;

      if (i < actualCount - 1) {
        logMessage(`⏳ Jeda 2.5 detik sebelum video ${i + 2}...`);
        await sleep(2500);
      }
    }

    isDownloading = false;
    if (btn) btn.disabled = false;
    setStatus('🟢 Autopilot Selesai', `${successCount}/${actualCount} Berhasil Diunduh`);
    logMessage(`🎉 SELESAI! ${successCount} dari ${actualCount} video telah diunduh.`, 'success');

    document.title = `[DOWNLOAD_DONE_${successCount}] ` + document.title;
    return true;
  }

  // ==========================================
  // 6. LOOP AUTOPILOT CERDAS
  // ==========================================
  async function runAutopilotLoop() {
    if (autoPilotTriggered) return;

    const isProjectPage = window.location.href.includes('/project/');

    if (!isProjectPage) {
      // 1. Berada di beranda -> otomatis buka project terakhir
      autoPilotTriggered = true;
      await handleHomepageAutopilot();
    } else {
      // 2. Berada di project -> otomatis download semua kartu
      autoPilotTriggered = true;
      setStatus('🔍 Memindai Video...', 'Menunggu elemen kanvas');
      logMessage('Kanvas project terdeteksi. Memulai unduh otomatis dalam 3.5 detik...', 'highlight');

      let attempts = 0;
      const pollCards = setInterval(async () => {
        attempts++;
        const cards = scanForVideoCards();
        if (cards.length > 0) {
          clearInterval(pollCards);
          setStatus('🟢 Video Terdeteksi', `${cards.length} kartu ditemukan`);
          logMessage(`Ditemukan ${cards.length} kartu video. Memulai unduh batch...`, 'success');
          await sleep(1500);
          await startBatchDownload(targetDownloadCount);
        } else if (attempts >= 12) {
          clearInterval(pollCards);
          setStatus('⚠️ Waktu Habis', 'Tidak ada kartu video terdeteksi');
          logMessage('Gagal mendeteksi kartu video setelah 15 detik.', 'warn');
        }
      }, 1500);
    }
  }

  // ==========================================
  // 7. INISIALISASI
  // ==========================================
  function init() {
    createFloatingUI();

    // Jalankan Autopilot otomatis setelah jeda awal 2 detik
    setTimeout(() => {
      runAutopilotLoop();
    }, 2000);

    // Amati navigasi SPA jika halaman berpindah dari beranda ke project
    let lastUrl = window.location.href;
    setInterval(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        logMessage(`Navigasi halaman: ${lastUrl}`);
        autoPilotTriggered = false;
        setTimeout(() => {
          runAutopilotLoop();
        }, 2000);
      }
    }, 1500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.ceritaObim = {
    scan: scanForVideoCards,
    downloadAll: startBatchDownload,
    getCards: () => detectedCards,
  };
})();
