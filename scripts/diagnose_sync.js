const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
const url = urlMatch ? urlMatch[1].trim().replace(/^["']|["']$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^["']|["']$/g, '') : '';

const supabase = createClient(url, key);

async function run() {
  const { data: items } = await supabase.from('content_items').select('id, content_code, title').order('content_code');
  const { data: scenes } = await supabase.from('scenes').select('*').order('scene_index');
  const { data: assets } = await supabase.from('assets').select('*');

  console.log(`Analyzing ${items.length} items, ${scenes.length} scenes, ${assets.length} assets...`);

  const report = [];

  for (const item of items) {
    const itemScenes = scenes.filter(s => s.content_id === item.id);
    const itemAssets = assets.filter(a => a.content_id === item.id);
    const sceneVideos = itemAssets.filter(a => a.asset_type === 'scene_video');
    const finalVideo = itemAssets.find(a => a.asset_type === 'final_video');

    // Count how many scenes match via current strict logic:
    const matchedScenes = itemScenes.filter(sc => {
      const meta = sc.source_alignment_metadata || {};
      const uploadedId = meta.uploadedClipAssetId;
      return sceneVideos.some(a => a.scene_id === sc.id || (uploadedId && a.id === uploadedId));
    });

    // Count how many scenes match via filename/partIndex:
    const filenameMatchedScenes = itemScenes.filter(sc => {
      return sceneVideos.some(a => {
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
    });

    report.push({
      code: item.content_code,
      title: item.title.substring(0, 30),
      totalScenes: itemScenes.length,
      sceneVideosCount: sceneVideos.length,
      strictMatched: matchedScenes.length,
      filenameMatched: filenameMatchedScenes.length,
      hasFinal: Boolean(finalVideo),
      finalFilename: finalVideo?.original_filename || null
    });
  }

  console.table(report);
}

run();
