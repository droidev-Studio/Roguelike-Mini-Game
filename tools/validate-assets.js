import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const manifestPath = path.join(root, 'assets', 'manifest.json');
const indexPath = path.join(root, 'index.html');
const errors = [];
const warnings = [];

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

function assertDirectory(relativePath) {
  const filePath = path.join(root, relativePath);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isDirectory()) {
    errors.push(`Missing directory: ${relativePath}`);
    return false;
  }
  return true;
}

function assertMissing(relativePath, message) {
  if (fs.existsSync(path.join(root, relativePath))) {
    errors.push(message || `Unexpected path: ${relativePath}`);
  }
}

function readPngSize(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    const isPng = buffer.length > 24 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47;
    if (!isPng) return null;
    return [buffer.readUInt32BE(16), buffer.readUInt32BE(20)];
  } catch {
    return null;
  }
}

function inspectPngAlpha(filePath) {
  try {
    const png = PNG.sync.read(fs.readFileSync(filePath));
    let minX = png.width;
    let minY = png.height;
    let maxX = -1;
    let maxY = -1;
    let opaquePixels = 0;
    let cornerAlpha = 0;
    let cornerSamples = 0;
    const cornerSize = Math.max(1, Math.floor(Math.min(png.width, png.height) * 0.06));
    for (let y = 0; y < png.height; y++) {
      for (let x = 0; x < png.width; x++) {
        const alpha = png.data[(png.width * y + x) * 4 + 3];
        if ((x < cornerSize || x >= png.width - cornerSize) && (y < cornerSize || y >= png.height - cornerSize)) {
          cornerAlpha += alpha;
          cornerSamples++;
        }
        if (alpha > 12) {
          opaquePixels++;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0) return { width: png.width, height: png.height, empty: true, cornerAlpha: 0, fillRatio: 0 };
    const bboxWidth = maxX - minX + 1;
    const bboxHeight = maxY - minY + 1;
    return {
      width: png.width,
      height: png.height,
      empty: false,
      bboxWidth,
      bboxHeight,
      fillRatio: opaquePixels / (png.width * png.height),
      cornerAlpha: cornerSamples ? cornerAlpha / cornerSamples : 0,
    };
  } catch {
    return null;
  }
}

function hasPair(value) {
  return Array.isArray(value) &&
    value.length >= 2 &&
    Number.isFinite(Number(value[0])) &&
    Number.isFinite(Number(value[1]));
}

function hasSafeFrame(value) {
  return Array.isArray(value) &&
    value.length >= 4 &&
    value.every(item => Number.isFinite(Number(item)));
}

function collectAssetRefs(value, refs = [], context = 'manifest') {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.src === 'string') refs.push({ src: value.src, entry: value, context });
  if (Array.isArray(value.frames)) {
    for (const [index, frame] of value.frames.entries()) {
      if (typeof frame === 'string') refs.push({ src: frame, entry: value, context: `${context}.frames[${index}]` });
    }
  }
  if (Array.isArray(value.variants)) {
    for (const [index, variant] of value.variants.entries()) {
      if (typeof variant === 'string') refs.push({ src: variant, entry: value, context: `${context}.variants[${index}]` });
      if (variant && typeof variant.src === 'string') refs.push({ src: variant.src, entry: variant, context: `${context}.variants[${index}]` });
    }
  }
  for (const [key, nested] of Object.entries(value)) {
    collectAssetRefs(nested, refs, `${context}.${key}`);
  }
  return refs;
}

function validateEntryMetadata(entry, context) {
  if (!entry || typeof entry !== 'object') return;
  const role = entry.assetRole;
  if (typeof entry.src === 'string' || Array.isArray(entry.frames)) {
    if (!hasPair(entry.sourceSize)) errors.push(`Missing sourceSize: ${context}`);
    if (!hasPair(entry.drawSize) && !Number.isFinite(Number(entry.worldSize)) && role !== 'weaponIcon') {
      errors.push(`Missing drawSize/worldSize: ${context}`);
    }
    if (!hasPair(entry.anchor) && !hasPair(entry.feetAnchor) && !hasPair(entry.centerAnchor)) {
      errors.push(`Missing anchor/feetAnchor: ${context}`);
    }
    if (!hasSafeFrame(entry.safeFrame)) warnings.push(`Missing safeFrame: ${context}`);
  }
  if ((role === 'weaponAttack' || role === 'weaponEffect') && !entry.attackShape) errors.push(`Missing attackShape: ${context}`);
  if (role === 'weaponBody') {
    if (entry.facing !== 'right' && entry.facing !== 'up' && entry.facing !== 'left' && entry.facing !== 'down') {
      errors.push(`Missing or invalid weapon body facing: ${context}`);
    }
    if (!hasPair(entry.gripAnchor)) errors.push(`Missing weapon body gripAnchor: ${context}`);
    if (!hasPair(entry.tipAnchor)) errors.push(`Missing weapon body tipAnchor: ${context}`);
    if (!hasPair(entry.pivot)) errors.push(`Missing weapon body pivot: ${context}`);
    if (!hasPair(entry.drawSize)) errors.push(`Missing weapon body drawSize: ${context}`);
    if (!hasSafeFrame(entry.safeFrame)) errors.push(`Missing weapon body safeFrame: ${context}`);
  }
  if (role === 'pickup') {
    if (!entry.glowColor) errors.push(`Missing pickup glowColor: ${context}`);
    if (!hasPair(entry.drawSize)) errors.push(`Missing pickup drawSize: ${context}`);
  }
  if (['player', 'enemy', 'boss', 'miniBoss'].includes(role)) {
    if (!hasPair(entry.feetAnchor) && !hasPair(entry.anchor)) errors.push(`Missing character anchor: ${context}`);
    if (!Number.isFinite(Number(entry.collisionRadius))) errors.push(`Missing collisionRadius: ${context}`);
  }
}

function validateVisualAlpha(ref, filePath) {
  const role = ref.entry?.assetRole;
  if (!role || role === 'styleProof' || role === 'uiSkin' || role === 'aiTileDecorationCandidate') return;
  const alpha = inspectPngAlpha(filePath);
  if (!alpha) return;
  if (alpha.empty) {
    warnings.push(`PNG has no visible pixels: ${ref.context} ${ref.src}`);
    return;
  }
  if (alpha.cornerAlpha > 8 && ['pickup', 'weaponAttack', 'weaponEffect', 'skillIcon', 'weaponIcon', 'player', 'enemy', 'boss', 'miniBoss', 'obstacle', 'hazard', 'decal', 'prop'].includes(role)) {
    warnings.push(`PNG corners are not transparent enough: ${ref.context} ${ref.src}`);
  }
  if (role === 'weaponEffect' && (alpha.cornerAlpha > 8 || alpha.fillRatio > 0.9)) {
    warnings.push(`Weapon effect may include baked background/checkerboard; needs cleanup or premultiplied transparent export: ${ref.context} ${ref.src}`);
  }
  if (alpha.fillRatio < 0.015 && ['pickup', 'weaponAttack', 'weaponEffect', 'skillIcon', 'weaponIcon'].includes(role)) {
    warnings.push(`Visible content may be too small inside source image: ${ref.context} ${ref.src}`);
  }
}

function walkEntries(value, visitor, context = 'manifest') {
  if (!value || typeof value !== 'object') return;
  visitor(value, context);
  for (const [key, nested] of Object.entries(value)) {
    walkEntries(nested, visitor, `${context}.${key}`);
  }
}

assertFile('index.html');
assertFile('game.css');
assertFile('GameSettings.js');
assertFile('game.js');
assertFile('assets/manifest.json');
assertFile('src/core/SpecLoader.ts');
assertFile('src/systems/WorldPorts.ts');
assertFile('src/systems/createLegacySystemPipeline.ts');
assertFile('src/systems/MapSystem.ts');
assertFile('src/systems/DropSystem.ts');
assertFile('src/systems/ProgressionSystem.ts');
assertFile('tools/p0-gameplay-smoke.js');
assertFile('assets/ui-art/asset_ui_menu_panel.png');
assertFile('src/ui/UIBridge.js');
assertFile('src/ui/GameEditorSidebar.js');
assertFile('src/ui/game-ui.css');
assertFile('src/ui/HudView.ts');
assertFile('src/ui/MainMenuView.ts');
assertFile('src/ui/PauseMenuView.ts');
assertFile('src/ui/LevelUpView.ts');
assertFile('src/ui/PerkUpgradeView.ts');
assertFile('docs/architecture.md');
assertFile('docs/tuning-guide.md');
assertFile('docs/asset-naming.md');
assertDirectory('src/spec');
assertMissing('ui', 'Root ui/ directory must stay migrated to src/ui/');
assertMissing(path.join('assets', 'Visual Style', 'ui'), 'UI art must stay migrated to assets/ui-art/');

for (const docName of ['architecture.md', 'tuning-guide.md', 'asset-naming.md']) {
  const docPath = path.join(root, 'docs', docName);
  if (!fs.existsSync(docPath)) continue;
  const content = fs.readFileSync(docPath, 'utf8');
  if (/鍗|锛|瑙|鐩|搴|娓|绾|�/.test(content)) {
    errors.push(`Docs appear mojibake/corrupted: docs/${docName}`);
  }
  if (!content.trim().startsWith('# ')) {
    warnings.push(`Docs should start with a title heading: docs/${docName}`);
  }
}

const indexHtml = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : '';
if (indexHtml.includes('style.css')) errors.push('index.html still references style.css; use game.css');
if (indexHtml.includes('asset-manifest.json')) errors.push('index.html still references asset-manifest.json; use assets/manifest.json');
if (indexHtml.includes('href="ui/') || indexHtml.includes('src="ui/')) {
  errors.push('index.html still references root ui/; use src/ui/');
}
if (!indexHtml.includes('GameSettings.js') || !indexHtml.includes('game.js')) {
  errors.push('index.html must load GameSettings.js and game.js');
} else if (indexHtml.indexOf('GameSettings.js') > indexHtml.indexOf('game.js')) {
  errors.push('GameSettings.js must be loaded before game.js');
}

const manifest = readJson(manifestPath);
if (manifest) {
  const basePath = manifest.basePath || 'assets/';
  const seenRefs = new Set();
  for (const ref of collectAssetRefs(manifest)) {
    assertFile(path.join(basePath, ref.src));
    if (ref.src.startsWith('Visual Style/ui/')) {
      errors.push(`UI art must use ui-art/: ${ref.context} ${ref.src}`);
    }
    const sourceKey = `${ref.context}:${ref.src}`;
    if (seenRefs.has(sourceKey)) continue;
    seenRefs.add(sourceKey);
    const filePath = path.join(root, basePath, ref.src);
    const actualSize = readPngSize(filePath);
    if (actualSize && hasPair(ref.entry?.sourceSize) && !ref.context.includes('.variants[')) {
      const expected = [Number(ref.entry.sourceSize[0]), Number(ref.entry.sourceSize[1])];
      if (expected[0] !== actualSize[0] || expected[1] !== actualSize[1]) {
        errors.push(`sourceSize mismatch: ${ref.context} ${ref.src} expected ${expected.join('x')} actual ${actualSize.join('x')}`);
      }
    }
    if (actualSize) validateVisualAlpha(ref, filePath);
  }
  walkEntries(manifest, validateEntryMetadata);
  for (const [weaponId, weapon] of Object.entries(manifest.weaponAttacks || {})) {
    if (weaponId === 'bindings') continue;
    const expectsBodyAttachment = Object.values(weapon.levels || {}).some(slots => Boolean(slots?.body));
    if (!expectsBodyAttachment) continue;
    for (const [level, slots] of Object.entries(weapon.levels || {})) {
      if (!slots?.body) {
        const message = `Missing weapon body attachment metadata: weaponAttacks.${weaponId}.levels.${level}.body`;
        if (weaponId === 'spear') errors.push(message);
        else warnings.push(message);
      }
    }
  }
  for (const [tileId, entry] of Object.entries(manifest.map?.main || {})) {
    if (entry?.assetRole && entry.assetRole !== 'aiTileDecorationCandidate') {
      errors.push(`Map main asset must not be treated as runtime base tile: map.main.${tileId}`);
    }
  }
}

const requiredSpecFiles = [
  'game.json',
  'stages.json',
  'waves.json',
  'entities.json',
  'enemies.json',
  'weapons.json',
  'progression.json',
  'drops.json',
  'balance.json',
  'effects.json',
  'ui-text.json',
];
const specDir = path.join(root, 'src', 'spec');
if (fs.existsSync(specDir) && fs.statSync(specDir).isDirectory()) {
  for (const fileName of requiredSpecFiles) {
    assertFile(path.join('src', 'spec', fileName));
  }
  assertMissing(path.join('src', 'spec', 'ui.json'), 'Use src/spec/ui-text.json instead of src/spec/ui.json');
  for (const fileName of fs.readdirSync(specDir)) {
    if (fileName.endsWith('.json')) readJson(path.join(specDir, fileName));
  }
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn(warnings.join('\n'));
}
console.log('Asset and config validation passed.');
