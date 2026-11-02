const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
const url = urlMatch ? urlMatch[1].trim().replace(/^["']|["']$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^["']|["']$/g, '') : '';

const supabase = createClient(url, key);

async function run() {
  const storePath = path.resolve('.data/studio-store.json');
  const store = JSON.parse(fs.readFileSync(storePath, 'utf8'));

  const finalAssets = store.assets.filter((a) => a.assetType === 'final_video');
  console.log('Total local final_video assets to sync:', finalAssets.length);

  for (const asset of finalAssets) {
    const payload = {
      id: asset.id,
      owner_id: asset.ownerId,
      content_id: asset.contentId,
      scene_id: asset.sceneId ?? null,
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
      created_at: asset.createdAt || new Date().toISOString(),
    };

    const { error } = await supabase.from('assets').upsert(payload);
    if (error) {
      console.error(`Failed to sync asset ${asset.id}:`, error.message);
    } else {
      console.log(`Synced: ${asset.originalFilename}`);
    }
  }

  // Also sync contentItems scheduledPublishAt
  console.log('Syncing content items to Supabase...');
  for (const item of store.contentItems) {
    const { error } = await supabase
      .from('content_items')
      .update({
        scheduled_publish_at: item.scheduledPublishAt || null,
        title: item.title,
      })
      .eq('id', item.id);
    if (error) {
      // might fail if table has different column name or schema, let's log
    }
  }

  console.log('Finished syncing!');
}

run();
