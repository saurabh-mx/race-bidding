with open('src/app/streamer/page.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_lines = lines[:207] + [
    '          {profileData && (\n',
    '            <iframe \n',
    '              src={`/racer/${profileData.id}?stream=true`}\n',
    '              style={{ width: "100%", height: "1400px", border: "none", background: "transparent" }}\n',
    '              title="Profile Showcase"\n',
    '            />\n',
    '          )}\n',
    '        </div>\n'
] + lines[304:]

with open('src/app/streamer/page.tsx', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("Fixed!")
