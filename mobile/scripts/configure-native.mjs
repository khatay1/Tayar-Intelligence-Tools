import fs from 'node:fs';
import path from 'node:path';

const platform = process.argv[2];
const root = process.cwd();

function replaceOnce(filePath, marker, insertion, guard) {
  const absolute = path.join(root, filePath);
  let content = fs.readFileSync(absolute, 'utf8');
  if (content.includes(guard)) return;
  const index = content.lastIndexOf(marker);
  if (index < 0) throw new Error(`Could not patch ${filePath}: marker not found`);
  content = `${content.slice(0, index)}${insertion}${content.slice(index)}`;
  fs.writeFileSync(absolute, content);
}

if (platform === 'android') {
  replaceOnce(
    'android/app/src/main/AndroidManifest.xml',
    '</activity>',
    `            <intent-filter>\n                <action android:name="android.intent.action.VIEW" />\n                <category android:name="android.intent.category.DEFAULT" />\n                <category android:name="android.intent.category.BROWSABLE" />\n                <data android:scheme="tayartools" />\n            </intent-filter>\n`,
    'android:scheme="tayartools"',
  );
  console.log('Configured Android tayartools:// deep link.');
} else if (platform === 'ios') {
  replaceOnce(
    'ios/App/App/Info.plist',
    '</dict>',
    `\t<key>CFBundleURLTypes</key>\n\t<array>\n\t\t<dict>\n\t\t\t<key>CFBundleTypeRole</key>\n\t\t\t<string>Editor</string>\n\t\t\t<key>CFBundleURLSchemes</key>\n\t\t\t<array>\n\t\t\t\t<string>tayartools</string>\n\t\t\t</array>\n\t\t</dict>\n\t</array>\n`,
    '<string>tayartools</string>',
  );
  console.log('Configured iOS tayartools:// URL scheme.');
} else {
  throw new Error('Usage: node scripts/configure-native.mjs <android|ios>');
}
