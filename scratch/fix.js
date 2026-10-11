const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ncmgheuxlqiujubzqcvz.supabase.co',
  'sb_publishable_kxlHm_YbSYS3gnZmg9jw5w_iYTQb2MB'
);

async function run() {
  await supabase.from('racers').update({ logo_url: '/soulgrid/br_CrW0jdf-t.webp' }).eq('name', 'Bee Rush');
  console.log('Fixed Bee Rush');
}

run();
