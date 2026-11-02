const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
const url = urlMatch ? urlMatch[1].trim().replace(/^["']|["']$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^["']|["']$/g, '') : '';
const supabase = createClient(url, key);

async function run() {
  const storePath = path.resolve('.data/studio-store.json');
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

  const item020 = store.contentItems.find((i) => i.contentCode === 'CO-2026-020');
  if (!item020) {
    console.log('CO-2026-020 not found');
    return;
  }

  const ownerVideoDir = path.resolve('00.FolderOwner/VIDEO_FINAL_MASTER');
  const targetName = 'final-Kenapa Bau Bensin atau Buku Lama Enak Banget.mp4';
  const srcFile = path.join(ownerVideoDir, targetName);

  if (!fs.existsSync(srcFile)) {
    console.log('File not found:', srcFile);
    return;
  }

  const mediaDir = path.resolve('.data/media');
  const mediaDest = path.join(mediaDir, targetName);
  if (!fs.existsSync(mediaDest)) {
    fs.copyFileSync(srcFile, mediaDest);
  }

  const stat = fs.statSync(srcFile);
  const now = new Date().toISOString();
  const assetId = crypto.randomUUID();

  const asset = {
    id: assetId,
    ownerId: item020.ownerId,
    contentId: item020.id,
    sceneId: null,
    assetType: 'final_video',
    storagePath: mediaDest,
    originalFilename: targetName,
    mimeType: 'video/mp4',
    sizeBytes: stat.size,
    durationMs: 70000,
    width: 1080,
    height: 1920,
    checksum: 'co020assembled',
    metadata: {
      aspectRatio: '9:16',
      fps: 30,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      noSubtitles: true,
      noWatermark: true,
      executionMode: 'ffmpeg_local',
      sceneCount: 3,
    },
    createdAt: now,
  };

  // Upsert in store
  const existingIdx = store.assets.findIndex(
    (a) => a.contentId === item020.id && a.assetType === 'final_video'
  );
  if (existingIdx >= 0) {
    store.assets[existingIdx] = asset;
  } else {
    store.assets.push(asset);
  }
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2), 'utf8');
  console.log('Registered in studio-store.json');

  // Upsert in Supabase
  const payload = {
    id: asset.id,
    owner_id: asset.ownerId,
    content_id: asset.contentId,
    scene_id: null,
    asset_type: asset.assetType,
    storage_path: asset.storagePath,
    original_filename: asset.originalFilename,
    mime_type: asset.mimeType,
    size_bytes: asset.sizeBytes,
    duration_ms: asset.durationMs,
    width: asset.width,
    height: asset.height,
    checksum: asset.checksum,
    metadata: asset.metadata,
    created_at: asset.createdAt,
  };

  const { error } = await supabase.from('assets').upsert(payload);
  if (error) {
    console.error('Supabase error:', error.message);
  } else {
    console.log('Synced to Supabase assets table!');
  }
}

run();
