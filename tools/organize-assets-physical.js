import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assetsRoot = path.join(root, 'assets');
const manifestPath = path.join(assetsRoot, 'manifest.json');
const dryRun = process.argv.includes('--dry-run');
const archiveArg = process.argv.find(arg => arg.startsWith('--archive='));

const now = new Date();
const stamp = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, '0'),
  String(now.getDate()).padStart(2, '0'),
  '-',
  String(now.getHours()).padStart(2, '0'),
  String(now.getMinutes()).padStart(2, '0'),
  String(now.getSeconds()).padStart(2, '0'),
].join('');

const archiveName = archiveArg ? archiveArg.slice('--archive='.length) : `asset-reclass-${stamp}`;
const archiveRoot = path.join(assetsRoot, '_archive', archiveName);

const moves = [
  ['map/main', 'Visual Style/map/main', 'Visual Style'],
  ['map/obstacles', 'Visual Style/map/obstacles', 'Visual Style'],
  ['map/environment', 'Visual Style/map/environment', 'Visual Style'],
  ['player/runtime', 'Visual Style/player/runtime', 'Visual Style'],
  ['style-proofs', 'Visual Style/style-proofs', 'Visual Style'],
  ['ui', 'Visual Style/ui', 'Visual Style'],
  ['weapons/icons', 'Game Art/weapons/icons', 'Game Art'],
  ['weapons/attacks', 'Game Art/weapons/attacks', 'Game Art'],
  ['enemies', 'Game Art/enemies', 'Game Art'],
  ['bosses', 'Game Art/bosses', 'Game Art'],
  ['minibosses', 'Game Art/minibosses', 'Game Art'],
  ['skills', 'Game Art/skills', 'Game Art'],
  ['pickups', 'Game Art/pickups', 'Game Art'],
  ['map/random-events', 'Game Art/map/random-events', 'Game Art'],
  ['effects', 'Audio & Feel/effects', 'Audio & Feel'],
];

const pathRewrites = moves
  .map(([from, to]) => [`${from}/`, `${to}/`])
  .sort((a, b) => b[0].length - a[0].length);
const plannedMovePrefixes = moves.map(([from]) => `${from}/`);

const targetRoots = new Set(['Visual Style', 'Game Art', 'Audio & Feel']);
const protectedRootNames = new Set(['manifest.json', '_archive', ...targetRoots]);

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^assets\//, '');
}

function absoluteAssetPath(relativePath) {
  return path.join(assetsRoot, ...toPosix(relativePath).split('/'));
}

function relativeAssetPath(absolutePath) {
  return path.relative(assetsRoot, absolutePath).replace(/\\/g, '/');
}

function ensureDir(dirPath) {
  if (!dryRun) fs.mkdirSync(dirPath, { recursive: true });
}

function listFiles(dirPath) {
  if (!fs.existsSync(dirPath)) return [];
  const stat = fs.statSync(dirPath);
  if (stat.isFile()) return [dirPath];
  const files = [];
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const child = path.join(dirPath, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(child));
    if (entry.isFile()) files.push(child);
  }
  return files;
}

function moveTree(fromAbs, toAbs) {
  if (fs.statSync(fromAbs).isFile()) {
    if (fs.existsSync(toAbs) && fs.statSync(toAbs).isDirectory()) {
      fs.rmSync(toAbs, { recursive: true, force: true });
    }
    ensureDir(path.dirname(toAbs));
    fs.copyFileSync(fromAbs, toAbs);
    fs.unlinkSync(fromAbs);
    return;
  }
  ensureDir(toAbs);
  for (const file of listFiles(fromAbs)) {
    const target = path.join(toAbs, path.relative(fromAbs, file));
    ensureDir(path.dirname(target));
    fs.copyFileSync(file, target);
    fs.unlinkSync(file);
  }
  fs.rmSync(fromAbs, { recursive: true, force: true });
}

function collectManifestRefs(value, refs = new Set()) {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.src === 'string') refs.add(toPosix(value.src));
  if (Array.isArray(value.frames)) {
    for (const frame of value.frames) {
      if (typeof frame === 'string') refs.add(toPosix(frame));
    }
  }
  if (Array.isArray(value.variants)) {
    for (const variant of value.variants) {
      if (typeof variant === 'string') refs.add(toPosix(variant));
      if (variant && typeof variant.src === 'string') refs.add(toPosix(variant.src));
    }
  }
  for (const nested of Object.values(value)) collectManifestRefs(nested, refs);
  return refs;
}

function rewriteAssetPath(value) {
  if (typeof value !== 'string') return value;
  const normalized = toPosix(value);
  for (const [from, to] of pathRewrites) {
    if (normalized.startsWith(from)) return `${to}${normalized.slice(from.length)}`;
  }
  return value;
}

function rewriteManifestPaths(value, key = '') {
  if (typeof value === 'string') {
    if (['src', 'frames', 'variants', 'derived'].includes(key)) return rewriteAssetPath(value);
    return value;
  }
  if (Array.isArray(value)) return value.map(item => rewriteManifestPaths(item, key));
  if (!value || typeof value !== 'object') return value;
  const result = {};
  for (const [childKey, childValue] of Object.entries(value)) {
    result[childKey] = rewriteManifestPaths(childValue, childKey);
  }
  return result;
}

function movePath(fromRelative, toRelative, category, manifestRefs, reportMoves) {
  const fromAbs = absoluteAssetPath(fromRelative);
  const toAbs = absoluteAssetPath(toRelative);
  if (!fs.existsSync(fromAbs)) {
    if (fs.existsSync(toAbs)) {
      for (const file of listFiles(toAbs)) {
        const rest = path.relative(toAbs, file).replace(/\\/g, '/');
        const oldPath = `${fromRelative}/${rest}`;
        reportMoves.push({
          oldPath,
          newPath: relativeAssetPath(file),
          category,
          manifestReferenced: manifestRefs.has(toPosix(oldPath)),
          alreadyMoved: true,
        });
      }
    }
    return;
  }
  const files = listFiles(fromAbs);
  for (const file of files) {
    const oldPath = relativeAssetPath(file);
    const rest = path.relative(fromAbs, file);
    const newPath = relativeAssetPath(path.join(toAbs, rest));
    reportMoves.push({
      oldPath,
      newPath,
      category,
      manifestReferenced: manifestRefs.has(toPosix(oldPath)),
    });
  }
  if (!dryRun) {
    moveTree(fromAbs, toAbs);
  }
}

function archiveRemainingRootEntries(manifestRefs, reportMoves) {
  for (const entry of fs.readdirSync(assetsRoot, { withFileTypes: true })) {
    if (protectedRootNames.has(entry.name)) continue;
    const fromAbs = path.join(assetsRoot, entry.name);
    const toAbs = path.join(archiveRoot, entry.name);
    const files = listFiles(fromAbs);
    for (const file of files) {
      const oldPath = relativeAssetPath(file);
      if (dryRun && plannedMovePrefixes.some(prefix => oldPath.startsWith(prefix))) continue;
      const rest = path.relative(fromAbs, file);
      const newPath = relativeAssetPath(path.join(toAbs, rest));
      reportMoves.push({
        oldPath,
        newPath,
        category: '_archive',
        manifestReferenced: manifestRefs.has(toPosix(oldPath)),
      });
    }
    if (!dryRun) {
      moveTree(fromAbs, toAbs);
    }
  }
}

if (!fs.existsSync(manifestPath)) {
  console.error(`Missing manifest: ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestRefs = collectManifestRefs(manifest);
const reportMoves = [];

if (!dryRun) {
  ensureDir(archiveRoot);
  for (const rootName of targetRoots) ensureDir(path.join(assetsRoot, rootName));
  ensureDir(path.join(assetsRoot, 'Audio & Feel', 'audio'));
  fs.closeSync(fs.openSync(path.join(assetsRoot, 'Audio & Feel', 'audio', '.gitkeep'), 'a'));
}

for (const [from, to, category] of moves) {
  movePath(from, to, category, manifestRefs, reportMoves);
}

archiveRemainingRootEntries(manifestRefs, reportMoves);

if (fs.existsSync(archiveRoot)) {
  const knownNewPaths = new Set(reportMoves.map(move => move.newPath));
  for (const file of listFiles(archiveRoot)) {
    const newPath = relativeAssetPath(file);
    if (knownNewPaths.has(newPath) || newPath.endsWith('/asset-reclass-report.json')) continue;
    const oldPath = path.relative(archiveRoot, file).replace(/\\/g, '/');
    reportMoves.push({
      oldPath,
      newPath,
      category: '_archive',
      manifestReferenced: manifestRefs.has(toPosix(oldPath)),
      alreadyMoved: true,
    });
  }
}

const rewrittenManifest = rewriteManifestPaths(manifest);
const archivedManifestRefs = reportMoves.filter(move => move.category === '_archive' && move.manifestReferenced);
const report = {
  mode: dryRun ? 'dry-run' : 'apply',
  archiveRoot: relativeAssetPath(archiveRoot),
  movedCount: reportMoves.length,
  archivedManifestReferenceCount: archivedManifestRefs.length,
  archivedManifestReferences: archivedManifestRefs,
  moves: reportMoves,
};

if (!dryRun) {
  fs.writeFileSync(manifestPath, `${JSON.stringify(rewrittenManifest, null, 2)}\n`);
  fs.writeFileSync(path.join(archiveRoot, 'asset-reclass-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify({
  mode: report.mode,
  archiveRoot: report.archiveRoot,
  movedCount: report.movedCount,
  archivedManifestReferenceCount: report.archivedManifestReferenceCount,
}, null, 2));

if (archivedManifestRefs.length > 0) {
  console.error('Refusing to continue cleanly: manifest-referenced files would be archived.');
  process.exitCode = 1;
}
