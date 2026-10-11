const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ncmgheuxlqiujubzqcvz.supabase.co',
  'sb_publishable_kxlHm_YbSYS3gnZmg9jw5w_iYTQb2MB'
);

async function run() {
  const { data, error } = await supabase.from('racers').select('id, name, type, logo_url, captain_image_url');
  if (error) {
    console.error(error);
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

run();
