const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=([^\r\n]+)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=([^\r\n]+)/);
const url = urlMatch ? urlMatch[1].trim().replace(/^["']|["']$/g, '') : '';
const key = keyMatch ? keyMatch[1].trim().replace(/^["']|["']$/g, '') : '';

const supabase = createClient(url, key);

async function run() {
  const { data, error } = await supabase
    .from('assets')
    .select('id, content_id, asset_type, original_filename');
  console.log('Error:', error);
  console.log('Total Supabase assets:', data?.length);
  const finals = data?.filter((a) => a.asset_type === 'final_video');
  console.log('Finals in Supabase:', finals?.length);
}
run();
