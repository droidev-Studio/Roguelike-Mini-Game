import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'assets', 'manifest.json');
const indexPath = path.join(root, 'index.html');
const errors = [];

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    errors.push(`JSON parse failed: ${path.relative(root, filePath)} (${error.message})`);
    return null;
  }
}

function assertFile(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath)) {
    errors.push(`Missing file: ${relativePath}`);
  }
}

function collectAssetRefs(value, refs = []) {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.src === 'string') refs.push(value.src);
  if (Array.isArray(value.frames)) {
    for (const frame of value.frames) {
      if (typeof frame === 'string') refs.push(frame);
    }
  }
  if (Array.isArray(value.variants)) {
    for (const variant of value.variants) {
      if (typeof variant === 'string') refs.push(variant);
      if (variant && typeof variant.src === 'string') refs.push(variant.src);
    }
  }
  for (const nested of Object.values(value)) {
    collectAssetRefs(nested, refs);
  }
  return refs;
}

assertFile('index.html');
assertFile('game.css');
assertFile('GameSettings.js');
assertFile('game.js');
assertFile('assets/manifest.json');

const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
if (indexHtml.includes('style.css')) errors.push('index.html still references style.css; use game.css');
if (indexHtml.includes('asset-manifest.json')) errors.push('index.html still references asset-manifest.json; use assets/manifest.json');
if (!indexHtml.includes('GameSettings.js') || !indexHtml.includes('game.js')) {
  errors.push('index.html must load GameSettings.js and game.js');
} else if (indexHtml.indexOf('GameSettings.js') > indexHtml.indexOf('game.js')) {
  errors.push('GameSettings.js must be loaded before game.js');
}

const manifest = readJson(manifestPath);
if (manifest) {
  const basePath = manifest.basePath || 'assets/';
  for (const src of collectAssetRefs(manifest)) {
    assertFile(path.join(basePath, src));
  }
}

for (const fileName of fs.readdirSync(path.join(root, 'src', 'spec'))) {
  if (fileName.endsWith('.json')) readJson(path.join(root, 'src', 'spec', fileName));
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log('Asset and config validation passed.');
