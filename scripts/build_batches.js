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

      // Build descriptions for prompt (Concise & On-Point Format)
      const sceneDescriptions = chunk.map((sc) => {
        const rawDur = sc.durationSeconds || 10;
        const dur = rawDur >= 9 ? 10 : 8;
        const outputLabel = `pzxc_${segmenNum}_${weekNum}_${contentNum}_${sc.sceneIndex}xx`;
        let visualAction = (sc.visualAction || 'Karakter Obim kertas origami memperagakan adegan secara dinamis dan ekspresif.').trim();
        visualAction = visualAction.replace(/\s*\(100%.*?\)/gi, '').trim();

        return [
          `• Klip Bagian ${sc.sceneIndex} (WAJIB Title: "${outputLabel}", Durasi: ${dur}s, 9:16):`,
          `Aksi: ${visualAction}`
        ].join('\n');
      }).join('\n\n');

      const promptText = [
        `Buatkan ${chunk.length} video vertikal 9:16 model Veo 3.1 stop-motion kertas origami karakter @obim.jpg untuk konten: "${item.title}" (${item.contentCode}).`,
        `Aturan Mutlak: Mute/hening tanpa audio/BGM, karakter mulut tertutup rapat (NO lip-sync/speech), NO teks/subtitle di layar.`,
        ``,
        `PENTING: Saat memanggil tool generate video, isi parameter 'title' kartu HANYA dengan kode persis berikut:`,
        ``,
        sceneDescriptions,
        ``,
        `Karakter utama: @obim.jpg`,
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
