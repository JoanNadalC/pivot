// upload-fonts.js — Upload Noto Sans vers Cloudflare KV
// Usage : node scripts/upload-fonts.js <KV_NAMESPACE_ID>
// Les fonts doivent être dans worker/fonts/

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const KV_ID = process.argv[2];
if (!KV_ID) {
  console.error('Usage: node scripts/upload-fonts.js <KV_NAMESPACE_ID>');
  process.exit(1);
}

const fontsDir = path.join(__dirname, '..', 'fonts');
const fonts = [
  { key: 'NotoSans-Regular', file: 'NotoSans-Regular.ttf' },
  { key: 'NotoSans-Bold',    file: 'NotoSans-Bold.ttf' },
];

for (const { key, file } of fonts) {
  const filePath = path.join(fontsDir, file);
  if (!fs.existsSync(filePath)) {
    console.error(`❌ Font manquante : ${filePath}`);
    console.error(`   Télécharge depuis : https://fonts.google.com/noto/specimen/Noto+Sans`);
    process.exit(1);
  }
  console.log(`⬆  Upload ${key}…`);
  execSync(`npx wrangler kv:key put --namespace-id=${KV_ID} "${key}" --path="${filePath}"`, { stdio: 'inherit' });
  console.log(`✅ ${key} uploadé`);
}

console.log('\n✅ Fonts uploadées. Mets à jour wrangler.toml avec :');
console.log(`   id = "${KV_ID}"`);
