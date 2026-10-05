const fs = require('fs');
let content = fs.readFileSync('src/app/streamer/page.tsx', 'utf-8');

const startStr = '{profileData && (';
const endStr = '          )}';
const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
  const newBlock = `{profileId && (
            <iframe 
              src={\`/racer/\${profileId}?stream=true\`}
              style={{ width: '100%', height: '1400px', border: 'none', background: 'transparent' }}
              title="Profile Showcase"
            />`;
  content = content.substring(0, startIdx) + newBlock + content.substring(endIdx);
  fs.writeFileSync('src/app/streamer/page.tsx', content);
  console.log("Replaced successfully!");
} else {
  console.log("Could not find start or end bounds.");
}
