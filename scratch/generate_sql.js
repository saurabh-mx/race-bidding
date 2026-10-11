const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://ncmgheuxlqiujubzqcvz.supabase.co',
  'sb_publishable_kxlHm_YbSYS3gnZmg9jw5w_iYTQb2MB'
);

function cleanName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const aliases = {
  'arknemesis': 'arc',
  'momentzmotorsports': 'momentz',
  'amoremcqueens': 'amore',
  'exoshifters': 'exo',
  'speedunicorn': 'unicorn',
  'bennysburnout': 'bb',
  'blackwingsofpegasus': 'pegasus',
  'shocker': 'shock',
  'arn0ux': 'arnox',
  'fukka': 'fuka',
  'chillipotato': 'chili',
  'laalm1rch1': 'mirchi',
  'subuwu': 'subus',
  'phaze': 'phase',
  'ra1nnlv': 'rain',
  'kidbobomon': 'kidbo',
  'wrecker': 'wreker',
  'wubbubs': 'wububs',
  'zalim007': 'zalim',
  'majesty': 'majest',
  'ardee': 'arde',
  'monkeyking': 'moneyking',
  'eldrago': 'drago', 
  'sh1ft3r': 'shifter',
  'kurokaze': 'kuro',
  'empirezoomies': 'ez',
  'beerush': 'br',
  'rawkill': 'rawsoe',
  'paenic': 'panic',
  'bilchul': 'bilchul',
  'punisher': 'rusher',
  'ghost': 'gh',
  'poison': 'poison',
  'diamound': 'gem',
  'chotu18': 'chotu'
};

async function run() {
  const files = fs.readdirSync(path.join(__dirname, '../public/soulgrid'));
  const { data: racers, error } = await supabase.from('racers').select('*');
  
  if (error) {
    console.error(error);
    return;
  }

  let sql = '-- Update Logos Script\n';
  
  for (const racer of racers) {
    let cName = cleanName(racer.name);
    if (aliases[cName]) {
      cName = aliases[cName];
    }
    
    let altName = cName.replace(/1/g, 'i').replace(/0/g, 'o').replace(/4/g, 'a').replace(/3/g, 'e');
    
    let matchedFile = files.find(f => {
      const fName = cleanName(f.split('.')[0]);
      return fName === cName || fName === altName;
    });
    
    if (!matchedFile) {
      matchedFile = files.find(f => {
        const fName = cleanName(f);
        return fName.includes(cName) || fName.includes(altName);
      });
    }
    
    if (matchedFile) {
      // Escape single quotes for SQL
      const url = '/soulgrid/' + matchedFile.replace(/'/g, "''");
      const name = racer.name.replace(/'/g, "''");
      // Use captain_image_url for Captains? Wait, page.tsx uses driver.logo_url for the main image, and team_logo logic uses logo_url!
      // In drivers/page.tsx: <img src={driver.logo_url} />
      // In teams/page.tsx: team.captain_image_url || team.logo_url
      // Let's just update logo_url for everyone.
      sql += `UPDATE racers SET logo_url = '${url}' WHERE name = '${name}';\n`;
    }
  }
  
  // Fix Bee Rush specifically
  sql += `UPDATE racers SET logo_url = '/soulgrid/br_CrW0jdf-t.webp' WHERE name = 'Bee Rush';\n`;
  // Fix Ghost
  sql += `UPDATE racers SET logo_url = '/soulgrid/spide.webp' WHERE name = 'GHOST';\n`;
  
  fs.writeFileSync(path.join(__dirname, '../update_logos.sql'), sql);
  console.log('Generated update_logos.sql');
}

run();
