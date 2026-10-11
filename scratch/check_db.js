const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ncmgheuxlqiujubzqcvz.supabase.co',
  'sb_publishable_kxlHm_YbSYS3gnZmg9jw5w_iYTQb2MB'
);

async function run() {
  const { data, error } = await supabase.from('racers').select('name, logo_url, captain_image_url').in('name', ['Chotu18', 'Crash', 'Faint', 'Injector', 'Kidbobomon']);
  console.log(data);
}

run();
