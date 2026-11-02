const fs = require('fs');
const path = require('path');

const storePath = path.resolve('.data/studio-store.json');
const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));
const ownerDir = path.resolve('00.FolderOwner/VIDEO_FINAL_MASTER');
const mediaDir = path.resolve('.data/media');

const files = fs.readdirSync(ownerDir);
console.log('Total files in VIDEO_FINAL_MASTER:', files.length);

let updatedAssets = 0;
let createdCount = 0;

store.contentItems.forEach((item) => {
  const safeTitle = (item.title || '').replace(/[?:/*"<>|\\]/g, '').trim();
  const targetFinalName = `final-${safeTitle}.mp4`;

  // Find matching file in VIDEO_FINAL_MASTER
  const matchInOwner = files.find(
    (f) => f.includes(item.contentCode) || f.includes(safeTitle)
  );

  if (matchInOwner) {
    const srcPath = path.join(ownerDir, matchInOwner);
    const dstPath = path.join(ownerDir, targetFinalName);
    if (!fs.existsSync(dstPath)) {
      fs.copyFileSync(srcPath, dstPath);
      createdCount++;
    }
  }

  // Also in .data/media
  const mediaSrc = path.join(mediaDir, `${item.contentCode}_MASTER_9x16.mp4`);
  const mediaDst = path.join(mediaDir, targetFinalName);
  if (fs.existsSync(mediaSrc) && !fs.existsSync(mediaDst)) {
    fs.copyFileSync(mediaSrc, mediaDst);
  }

  // Update asset in store if final_video exists
  const finalAsset = store.assets.find(
    (a) => a.contentId === item.id && a.assetType === 'final_video'
  );
  if (finalAsset) {
    finalAsset.originalFilename = targetFinalName;
    if (fs.existsSync(mediaDst)) {
      finalAsset.storagePath = mediaDst;
    }
    updatedAssets++;
  }
});

fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
console.log('Done! Created copies in owner dir:', createdCount);
console.log('Updated final_video assets in DB:', updatedAssets);
