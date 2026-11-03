const fs = require('fs');
const path = require('path');

const queueFile = path.resolve(__dirname, '..', 'storage', 'macro', 'queue.json');
const batchesFile = path.resolve(__dirname, '..', 'storage', 'macro', 'pending_batches.json');
const klipDir = path.resolve(__dirname, '..', '00.FolderOwner', 'KLIP_BERSIH');
const storeFile = path.resolve(__dirname, '..', '.data', 'studio-store.json');

function getSegmentNumber(category, programName, title) {
  const text = `${category || ''} ${programName || ''} ${title || ''}`.toLowerCase();
  if (text.includes('dapur') || text.includes('makan') || text.includes('masak') || text.includes('goreng') || text.includes('kopi') || text.includes('bawang')) return 1;
  if (text.includes('pikir') || text.includes('psikologi') || text.includes('otak') || text.includes('neuroscience') || text.includes('deja vu') || text.includes('mandi') || text.includes('tidur')) return 2;
  return 3;
}

function isSceneCompleted(item, sc, existingKlipFiles, localStore) {
  // 0. Cek jika final video untuk konten ini sudah selesai dirakit
  if (item.hasFinalVideo) return true;
  if (localStore && localStore.assets) {
    const hasFinal = localStore.assets.some(
      (a) => a.contentId === item.contentId && a.assetType === 'final_video'
    );
    if (hasFinal) return true;
  }

  // 1. Cek jika status task queue sudah 'completed' / isDone
  if (sc.status === 'completed' || sc.isDone || sc.uploadedClipAssetId || sc.sceneStatus === 'clip_uploaded' || sc.sceneStatus === 'validated') {
    return true;
  }

  const segmenNum = getSegmentNumber(item.category, item.programName, item.title);
  const weekNum = item.weekNum || 1;
  const contentNum = parseInt((item.contentCode || '').replace(/\D/g, '').slice(-3), 10) || item.dayNum || 1;
  const targetFilename = `${segmenNum}_${weekNum}_${contentNum}_${sc.sceneIndex}.mp4`;

  // 2. Cek apakah file mp4 sudah tersimpan di 00.FolderOwner/KLIP_BERSIH/
  if (existingKlipFiles.has(targetFilename)) return true;

  // 3. Cek apakah ada record asset video di studio-store.json
  if (localStore && localStore.assets) {
    const hasAsset = localStore.assets.some(
      (a) =>
        a.contentId === item.contentId &&
        a.assetType === 'scene_video' &&
        (a.id === sc.uploadedClipAssetId ||
          a.sceneId === sc.sceneId ||
          a.originalFilename === `Bagian ${sc.sceneIndex}.mp4` ||
          a.metadata?.partIndex === sc.sceneIndex ||
          a.originalFilename === targetFilename ||
          a.originalFilename?.includes(`_Bagian_0${sc.sceneIndex}`) ||
          a.originalFilename?.includes(`SCENE_00${sc.sceneIndex}`))
    );
    if (hasAsset) return true;
  }

  // 4. Cek apakah scene status di store sudah clip_uploaded / validated
  if (localStore && localStore.scenes) {
    const sceneRecord = localStore.scenes.find(
      (s) => s.id === sc.sceneId || (s.contentId === item.contentId && s.sceneIndex === sc.sceneIndex)
    );
    if (
      sceneRecord &&
      (sceneRecord.uploadedClipAssetId ||
        sceneRecord.sceneStatus === 'clip_uploaded' ||
        sceneRecord.sceneStatus === 'validated')
    ) {
      return true;
    }
  }

  return false;
}

function generateBatches(chunkSize = 3, targetWeek = null) {
  if (!fs.existsSync(queueFile)) {
    console.log('queue.json not found');
    return [];
  }

  const existingKlipFiles = new Set(fs.existsSync(klipDir) ? fs.readdirSync(klipDir) : []);
  let localStore = null;
  if (fs.existsSync(storeFile)) {
    try {
      localStore = JSON.parse(fs.readFileSync(storeFile, 'utf8'));
    } catch {}
  }

  const queue = JSON.parse(fs.readFileSync(queueFile, 'utf8'));
  const batches = [];
  let batchCounter = 1;

  // Urutkan antrean: Week tertua dahulu (Week 1 sebelum Week 2), lalu nomor urut konten ascending
  const sortedQueueItems = [...(queue.items || [])].sort((a, b) => {
    const wA = a.weekNum || 1;
    const wB = b.weekNum || 1;
    if (wA !== wB) return wA - wB;
    const numA = parseInt((a.contentCode || '').replace(/\D/g, ''), 10) || a.dayNum || 0;
    const numB = parseInt((b.contentCode || '').replace(/\D/g, ''), 10) || b.dayNum || 0;
    return numA - numB;
  });

  const filteredQueueItems = targetWeek
    ? sortedQueueItems.filter((i) => String(i.weekNum) === String(targetWeek))
    : sortedQueueItems;

  filteredQueueItems.forEach((item) => {
    const safeTitle = (item.title || '')
      .replace(/[?:\/*"<>|]/g, '')
      .trim()
      .toUpperCase();
    const rawScenes = item.scenes || [];
    const segmenNum = getSegmentNumber(item.category, item.programName, item.title);
    const weekNum = item.weekNum || 1;
    const contentNum = parseInt((item.contentCode || '').replace(/\D/g, '').slice(-3), 10) || item.dayNum || 1;

    // Filter HANYA scene yang belum pernah di-generate / belum memiliki klip bersih
    const pendingScenes = rawScenes.filter((sc) => !isSceneCompleted(item, sc, existingKlipFiles, localStore));

    // Jika seluruh scene untuk konten ini sudah selesai, lewati sepenuhnya!
    if (pendingScenes.length === 0) {
      return;
    }

    // Chunk sisa scene yang belum selesai menjadi batch-batch sesuai chunkSize
    for (let i = 0; i < pendingScenes.length; i += chunkSize) {
      const chunk = pendingScenes.slice(i, i + chunkSize);
      const indices = chunk.map((s) => s.sceneIndex);
      const partNames = indices.map((idx) => `Bagian ${idx}`).join(', ');
      const hasCoverHook = chunk.some((s) => s.sceneIndex === 1);

      // Build clean filenames (e.g. 1_1_1_3.mp4)
      const cleanFilenames = chunk.map((s) => `${segmenNum}_${weekNum}_${contentNum}_${s.sceneIndex}.mp4`);
      const expectedFilenames = chunk.map((s) => s.expectedFilename);

      // Build descriptions for prompt
      const totalScenesInContent = rawScenes.length || 3;
      const sceneDescriptions = chunk.map((sc, n) => {
        const rawDur = sc.durationSeconds || 10;
        const dur = rawDur >= 9 ? 10 : 8;
        const outputLabel = `pzxc_${segmenNum}_${weekNum}_${contentNum}_${sc.sceneIndex}xx`;
        const visualAction = sc.visualAction || 'Origami paper stop motion action';
        const entity = sc.entityAttributes || {};
        const roleLabel =
          entity.roleLabel ||
          (sc.sceneIndex === 1
            ? 'THUMBNAIL & COVER HOOK'
            : sc.sceneIndex === totalScenesInContent
            ? 'RESOLUTION & DEBATE CTA'
            : 'SCIENCE MECHANISM & BREAKDOWN');
        const topicProps =
          entity.topicProps && entity.topicProps.length > 0
            ? entity.topicProps.join(', ')
            : `Properti kertas origami lipat bertema ${item.title}`;
        const stance = entity.characterStance || 'Obim berpose ekspresif dan ramah';
        const environment =
          entity.origamiEnvironment || 'Diorama studio kertas stop-motion matte';

        if (sc.sceneIndex === 1) {
          return [
            `--- [BAGIAN ${sc.sceneIndex} / CLIP ${n + 1}] (${roleLabel} • CARD TITLE: "${outputLabel}") ---`,
            `  • VIDEO TITLE PARAMETER : "${outputLabel}" (CRITICAL: Card name MUST be this exact code, DO NOT use descriptive phrases)`,
            `  • Durasi Video          : ${dur} detik (9:16 vertikal) • [${roleLabel}]`,
            `  • Properti Kertas Topik : ${topicProps}`,
            `  • Pose & Karakter Obim  : ${stance}`,
            `  • Visual Origami Action : [${outputLabel}] ${visualAction}. (PENTING: Karakter Obim TIDAK BOLEH berbicara atau menggerakkan bibir/mulut! Mulut tertutup rapat, ekspresi murni dari gerakan mata dan tubuh. NO mouth movement, NO lip sync, NO dialogue).`,
            `  • Lingkungan Diorama    : ${environment}`,
            `  • Konteks Topik Adegan  : ${sc.narrationText}`,
            `  • KINETIC HOOK SPECS   : KLIP VIDEO vertikal 9:16 aksi kinetik stop-motion kertas origami langsung di detik pertama (in-media-res). DILARANG menggunakan papan nama/banner/teks kaku. NO subtitles, NO text on screen, NO speech.`,
          ].join('\n');
        }

        return [
          `--- [BAGIAN ${sc.sceneIndex} / CLIP ${n + 1}] (${roleLabel} • CARD TITLE: "${outputLabel}") ---`,
          `  • VIDEO TITLE PARAMETER : "${outputLabel}" (CRITICAL: Card name MUST be this exact code, DO NOT use descriptive phrases)`,
          `  • Durasi Video          : ${dur} detik (9:16 vertikal) • [${roleLabel}]`,
          `  • Properti Kertas Topik : ${topicProps}`,
          `  • Pose & Karakter Obim  : ${stance}`,
          `  • Visual Origami Action : [${outputLabel}] ${visualAction} (100% handmade folded matte origami paper stop-motion, 9:16 vertical, NO subtitles, NO text on screen. PENTING: Karakter DILARANG berbicara/lip sync, mulut tertutup rapat, NO mouth movement, NO speech).`,
          `  • Lingkungan Diorama    : ${environment}`,
          `  • Konteks Topik Adegan  : ${sc.narrationText}`,
        ].join('\n');
      });

      const outputRequirements = chunk
        .map((sc, n) => `  ${n + 1}. Klip Bagian ${sc.sceneIndex} -> TITLE WAJIB: "pzxc_${segmenNum}_${weekNum}_${contentNum}_${sc.sceneIndex}xx"`)
        .join('\n');

      const promptText = [
        `[CRITICAL DIRECTIVE FOR GOOGLE FLOW AI AGENT — SET EXACT CARD TITLES]`,
        `IMPORTANT: When invoking the video generation tool, you MUST pass the parameter title EXACTLY as specified below.`,
        `NEVER use English descriptive phrases as card titles (e.g. NEVER use "Papercraft boy...", "Boy waving...", "Paper boy...").`,
        `The card title MUST BE strictly the exact short code below:`,
        outputRequirements,
        ``,
        `=== BATCH VIDEO GENERATOR — CERITAOBIM STUDIO ===`,
        `Content Code : ${item.contentCode}`,
        `Judul Konten : ${item.title}`,
        `Topik        : ${item.category || 'Edukasi & Fakta Unik'}`,
        `Format Video : Vertical 9:16 (1080x1920) Stop-Motion Origami Kertas (Model: Omni 1.1 Flash)`,
        ``,
        `[ATURAN PENAMAAN OUTPUT WAJIB — KODE PREFIX pzxc_ & SEPARATOR xx]`,
        `PENTING & KRUSIAL: Setiap video yang dihasilkan WAJIB dinamai dan diberi label HANYA menggunakan kode singkat berikut:`,
        outputRequirements,
        `- Format Kode: pzxc_[Segmen]_[Week]_[Konten]_[Bagian]xx`,
        `- Contoh: "pzxc_${segmenNum}_${weekNum}_${contentNum}_${chunk[0].sceneIndex}xx"`,
        `- DILARANG menambahkan judul artikel atau kata lain pada nama output. HANYA gunakan kode singkat di atas!`,
        ``,
        `[ATURAN MODEL AI & DURASI WAJIB — OMNI 1.1 FLASH]`,
        `- Model AI Video: WAJIB menggunakan Omni 1.1 Flash (mendukung durasi resmi 10 detik dan 8 detik).`,
        `- Durasi Output: Setiap video memiliki durasi resmi 10 detik (atau 8 detik pada adegan penutup).`,
        `- Kelanjutan Visual: Jika ucapan narasi selesai lebih awal dari durasi klip, karakter origami tetap bergerak dan berpose natural hingga durasi video selesai.`,
        ``,
        `[ATURAN TEMPO TINGGI & ANTI-SLOW MOTION — RETENSI TINGGI 9:16]`,
        `- ZERO SLOW-MOTION & ZERO LAZY DRIFT: Video DILARANG KERAS bergerak lambat, malas, atau melayang santai yang membuat penonton scroll sebelum video selesai!`,
        `- HIGH-SPEED CRISP STOP-MOTION: Seluruh objek origami harus bergerak lincah, berkecepatan tinggi, dan berenergi dengan animasi snap-motion lipatan kertas yang meletup sigap (crisp, fast-paced tactile pop-up folding).`,
        `- DYNAMIC CAMERA IN-MOTION: Kamera vertikal 9:16 WAJIB aktif bergerak (fast snap-zoom in, macro dolly-in, whip-pan transisi kilat, dynamic tracking) dengan perubahan fokus visual cepat setiap 1.5 detik.`,
        `- DETIK 0-1.3 INSTANT HOOK: Khusus Bagian 1, frame pertama detik 0.0 WAJIB langsung menghentak dengan kejutan aksi fisik origami ke arah layar untuk mengunci perhatian penonton sejak detik pertama!`,
        ``,
        `[ATURAN VISUAL, THUMBNAIL & KARAKTER WAJIB]`,
        `- Gaya Visual: Handmade origami paper stop-motion, 100% lipatan kertas matte tanpa orang/objek realistis.`,
        `- Karakter Obim: Karakter anak laki-laki origami memakai kemeja flanel merah kotak-kotak dan celana biru.`,
        hasCoverHook
          ? `- High-Impact Visual Hook (Bagian 1): Bagian 1 WAJIB berupa KLIP VIDEO kinetik vertikal 9:16 (bukan gambar diam) dengan aksi origami spektakuler dan ekspresi Obim yang menghentikan scroll. DILARANG menggunakan papan nama/banner/teks kaku.`
          : `- High-Impact Visual Hook: Tidak diperlukan pada batch ini (Bagian 1 sudah selesai di-generate).`,
        `- Aturan Bagian Lain: 100% dunia lipatan kertas origami stop-motion murni (handmade folded matte paper). DILARANG menampilkan subtitle, teks di layar, huruf, watermark, banner, atau manusia/objek realistis (NO subtitles, NO text on screen).`,
        `- Kontinuitas: Jaga konsistensi pakaian karakter Obim, proporsi lipatan kertas, dan pencahayaan antar bagian secara berurutan.`,
        ``,
        `[ATURAN AUDIO & EFEK SUARA (SFX) WAJIB — DILARANG BICARA / BERSUARA]`,
        `- ZERO SPEECH, ZERO LIP SYNC: DILARANG KERAS karakter berbicara, membuka mulut, menggerakkan bibir, bernyanyi, bergumam, atau mengeluarkan suara vokal/kata apa pun! Mulut karakter WAJIB selalu terkatup rapat (CLOSED MOUTH). Dubbing narasi sudah kami sediakan secara terpisah!`,
        `- NO BGM: DILARANG ada background music atau instrumen pengiring latar terus-menerus.`,
        `- HANYA EFEK SUARA DIEGETIK (SFX): Hanya boleh ada efek suara benda nyata kontekstual pendek (1-2 detik) di pertengahan adegan (misal bunyi derit kertas terlipat, ketukan kayu, atau letupan pop halus), dan WAJIB hening di awal dan akhir klip agar transisi mulus.`,
        ``,
        `[DAFTAR ${chunk.length} BAGIAN SCENE YANG HARUS DIKERJAKAN PADA SESI INI]`,
        ...sceneDescriptions,
        ``,
        chunk.length === 1
          ? `[INSTRUKSI EKSEKUSI FINAL — KERJAKAN 1 BAGIAN DENGAN TITLE PERSIS]\nKerjakan 1 bagian di atas (Bagian ${indices[0]}) menggunakan model Omni 1.1 Flash dalam bentuk 1 KLIP VIDEO vertikal 9:16 stop-motion origami kertas.\nKlip video yang dihasilkan WAJIB diset title parameter-nya HANYA menggunakan kode persis berikut:\n${outputRequirements}`
          : `[INSTRUKSI EKSEKUSI FINAL — KERJAKAN ${chunk.length} BAGIAN SEKALIGUS DENGAN TITLE PERSIS]\nKerjakan ${chunk.length} bagian di atas (${partNames}) SEKALIGUS menggunakan model Omni 1.1 Flash dalam bentuk ${chunk.length} KLIP VIDEO vertikal 9:16 stop-motion origami kertas.\nSetiap klip video yang dihasilkan WAJIB diset title parameter-nya HANYA menggunakan kode persis berikut:\n${outputRequirements}`,
        ``,
        `Gunakan aset referensi origami berikut sebagai karakter pemeran utama:`,
      ].join('\n');

      batches.push({
        batchIndex: batchCounter++,
        contentId: item.contentId,
        contentCode: item.contentCode,
        title: item.title,
        safeTitle,
        sceneIndices: indices,
        sceneCount: chunk.length,
        cleanFilenames,
        expectedFilenames,
        promptText,
      });
    }
  });

  fs.writeFileSync(batchesFile, JSON.stringify(batches, null, 2), 'utf8');
  return batches;
}

if (require.main === module) {
  const argChunk = parseInt(process.argv[2], 10) || 3;
  const batches = generateBatches(argChunk);
  console.log('SUCCESS: Generated', batches.length, 'batches in pending_batches.json (Chunk Size:', argChunk, ')');
  if (batches[0]) {
    console.log('Sample Batch 1:', {
      batchIndex: batches[0].batchIndex,
      contentCode: batches[0].contentCode,
      title: batches[0].title,
      scenes: batches[0].sceneIndices,
      cleanFilenames: batches[0].cleanFilenames,
    });
  }
}

module.exports = { generateBatches };
