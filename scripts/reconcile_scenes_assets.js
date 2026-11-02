const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
const url = urlMatch ? urlMatch[1].trim().replace(/^["']|["']$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^["']|["']$/g, '') : '';

const supabase = createClient(url, key);

async function reconcile() {
  console.log("=== STARTING SUPABASE SCENE & ASSET RECONCILIATION ===");
  const { data: items } = await supabase.from('content_items').select('id, content_code, title').order('content_code');
  const { data: scenes } = await supabase.from('scenes').select('*').order('scene_index');
  const { data: assets } = await supabase.from('assets').select('*').order('created_at', { ascending: false });

  let updatedScenesCount = 0;
  let updatedAssetsCount = 0;

  for (const item of items) {
    const itemScenes = scenes.filter(s => s.content_id === item.id);
    const itemAssets = assets.filter(a => a.content_id === item.id && a.asset_type === 'scene_video');

    if (itemScenes.length === 0 || itemAssets.length === 0) continue;

    for (const sc of itemScenes) {
      const meta = sc.source_alignment_metadata || {};
      const currentUploadedId = meta.uploadedClipAssetId;

      // Find matching asset: first try existing link, then partIndex, then filename, then storagePath
      let matchedAsset = itemAssets.find(a => a.scene_id === sc.id || (currentUploadedId && a.id === currentUploadedId));

      if (!matchedAsset) {
        matchedAsset = itemAssets.find(a => {
          const fn = a.original_filename || '';
          const sp = a.storage_path || '';
          const partIdx = a.metadata?.partIndex;
          return (
            partIdx === sc.scene_index ||
            fn === `Bagian ${sc.scene_index}.mp4` ||
            fn.includes(`SCENE_00${sc.scene_index}`) ||
            sp.includes(`_Bagian_0${sc.scene_index}`)
          );
        });
      }

      if (matchedAsset) {
        // Check if scene needs update
        if (sc.source_alignment_metadata?.uploadedClipAssetId !== matchedAsset.id || sc.scene_status !== 'clip_uploaded') {
          const updatedMeta = {
            ...meta,
            expectedFilename: meta.expectedFilename || `${item.content_code}_SCENE_00${sc.scene_index}.mp4`,
            uploadedClipAssetId: matchedAsset.id,
          };
          const { error: sErr } = await supabase
            .from('scenes')
            .update({
              source_alignment_metadata: updatedMeta,
              scene_status: 'clip_uploaded',
              updated_at: new Date().toISOString(),
            })
            .eq('id', sc.id);

          if (!sErr) {
            console.log(`[SCENE LINKED] ${item.content_code} Scene #${sc.scene_index} -> Asset ${matchedAsset.original_filename} (${matchedAsset.id})`);
            updatedScenesCount++;
          } else {
            console.error(`Error updating scene ${sc.id}:`, sErr.message);
          }
        }

        // Check if asset needs update
        if (matchedAsset.scene_id !== sc.id) {
          const { error: aErr } = await supabase
            .from('assets')
            .update({
              scene_id: sc.id,
            })
            .eq('id', matchedAsset.id);

          if (!aErr) {
            updatedAssetsCount++;
          } else {
            console.error(`Error updating asset ${matchedAsset.id}:`, aErr.message);
          }
        }
      }
    }
  }

  console.log(`\nReconciliation finished! Updated ${updatedScenesCount} scenes and ${updatedAssetsCount} assets in Supabase.`);
}

reconcile();
