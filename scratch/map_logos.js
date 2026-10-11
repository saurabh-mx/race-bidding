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
  'eldrago': 'drago', // Wait, drago image? let's see. 
  'sh1ft3r': 'shifter',
  'kurokaze': 'kuro',
  'empirezoomies': 'ez',
  'beerush': 'br',
  'rawkill': 'rawsoe',
  'paenic': 'panic',
  'bilchul': 'bilchul', // ?
  'punisher': 'rusher', // ? maybe? 
  'ghost': 'gh',
  'poison': 'poison', // ?
  'chotu18': 'chotu'
};

async function run() {
  const files = fs.readdirSync(path.join(__dirname, '../public/soulgrid'));
  const { data: racers, error } = await supabase.from('racers').select('*');
  
  if (error) {
    console.error(error);
    return;
  }

  let matchCount = 0;
  let unmatchCount = 0;

  for (const racer of racers) {
    let cName = cleanName(racer.name);
    
    // Apply alias if exists
    if (aliases[cName]) {
      cName = aliases[cName];
    }
    
    // Custom mappings based on common leetspeak in names
    let altName = cName.replace(/1/g, 'i').replace(/0/g, 'o').replace(/4/g, 'a').replace(/3/g, 'e');
    
    let matchedFile = null;
    
    // Exact match on filename without extension
    matchedFile = files.find(f => {
      const fName = cleanName(f.split('.')[0]);
      return fName === cName || fName === altName;
    });
    
    // Substring match
    if (!matchedFile) {
      matchedFile = files.find(f => {
        const fName = cleanName(f);
        return fName.includes(cName) || fName.includes(altName);
      });
    }
    
    if (matchedFile) {
      console.log(`[MATCH] ${racer.name} (${racer.type}) -> ${matchedFile}`);
      matchCount++;
      await supabase.from('racers').update({ logo_url: '/soulgrid/' + matchedFile }).eq('id', racer.id);
    } else {
      console.log(`[NO MATCH] ${racer.name} (${racer.type}) - tried: ${cName}, ${altName}`);
      unmatchCount++;
    }
  }
  
  console.log(`\nMatched: ${matchCount}, Unmatched: ${unmatchCount}`);
  console.log('Update Complete.');
}

run();
