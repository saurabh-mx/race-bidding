const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  'https://ncmgheuxlqiujubzqcvz.supabase.co',
  'sb_publishable_kxlHm_YbSYS3gnZmg9jw5w_iYTQb2MB'
);

async function main() {
  const { data, error } = await supabase
    .from('racers')
    .update({ type: 'CAPTAIN', racer_role: 'CAPTAIN' })
    .eq('type', 'INDIVIDUAL')
    .select('id, name, type, racer_role');

  if (error) {
    console.error('Update error:', error);
  } else {
    console.log('Updated rows:', data?.length);
    console.log(data);
  }
}

main();
