import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const assetRoot = path.join(root, 'assets');
const manifestPath = path.join(assetRoot, 'manifest.json');
const dryRun = process.argv.includes('--dry-run');

function toPosix(value) {
  return value.replace(/\\/g, '/');
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
    } else {
      out.push(fullPath);
    }
  }
  return out;
}

function normalizeAssetRef(src) {
  return toPosix(String(src || '').replace(/^assets\//, ''));
}

function collectManifestRefs(value, refs = new Set()) {
  if (!value || typeof value !== 'object') return refs;
  if (typeof value.src === 'string') refs.add(normalizeAssetRef(value.src));
  if (Array.isArray(value.frames)) {
    for (const frame of value.frames) {
      if (typeof frame === 'string') refs.add(normalizeAssetRef(frame));
    }
  }
  if (Array.isArray(value.variants)) {
    for (const variant of value.variants) {
      if (typeof variant === 'string') refs.add(normalizeAssetRef(variant));
      if (variant && typeof variant.src === 'string') refs.add(normalizeAssetRef(variant.src));
    }
  }
  for (const nested of Object.values(value)) {
    collectManifestRefs(nested, refs);
  }
  return refs;
}

function keepReason(relativePath, manifestRefs) {
  const normalized = toPosix(relativePath);
  const fileName = path.posix.basename(normalized);
  if (manifestRefs.has(normalized)) return 'manifest reference';
  if (normalized.startsWith('_archive/')) return 'existing archive';
  if (normalized.startsWith('style-proofs/')) return 'style proof retained for offline reference';
  if (normalized.startsWith('prompts/')) return 'generation prompt';
  if (normalized.startsWith('source/')) return 'source documentation/tooling';
  if (normalized.startsWith('generated/weapon-v2/')) return 'AssetRuntime v2 fallback target';
  if (normalized === 'manifest.json' || normalized === 'style-bible.md') return 'asset metadata';
  if (/lv[._-]?[1-6]/i.test(fileName) && /^(weapons|map)\//.test(normalized)) {
    return 'lv1-lv6 retention rule';
  }
  return '';
}

function makeArchiveName() {
  const now = new Date();
  const pad = value => String(value).padStart(2, '0');
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestRefs = collectManifestRefs(manifest);
const allFiles = walk(assetRoot)
  .map(filePath => ({
    absolutePath: filePath,
    relativePath: toPosix(path.relative(assetRoot, filePath)),
    sizeBytes: fs.statSync(filePath).size,
  }))
  .filter(file => !file.relativePath.startsWith('_archive/'));

const kept = [];
const candidates = [];

for (const file of allFiles) {
  const reason = keepReason(file.relativePath, manifestRefs);
  if (reason) {
    kept.push({ ...file, reason });
  } else {
    candidates.push({ ...file, reason: 'unreferenced and no retention rule matched' });
  }
}

const archiveName = `unused-assets-${makeArchiveName()}`;
const archiveRoot = path.join(assetRoot, '_archive', archiveName);
const moved = [];

if (!dryRun) {
  for (const candidate of candidates) {
    const destination = path.join(archiveRoot, candidate.relativePath);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.renameSync(candidate.absolutePath, destination);
    moved.push({
      from: candidate.relativePath,
      to: toPosix(path.relative(assetRoot, destination)),
      sizeBytes: candidate.sizeBytes,
      reason: candidate.reason,
    });
  }
}

const report = {
  dryRun,
  archive: dryRun ? null : toPosix(path.relative(assetRoot, archiveRoot)),
  generatedAt: new Date().toISOString(),
  retentionRules: [
    'keep anything referenced by assets/manifest.json',
    'keep assets/style-proofs/** for offline reference',
    'keep assets/prompts/** and assets/source/**',
    'keep assets/generated/weapon-v2/** because AssetRuntime probes it',
    'keep weapon/map filenames containing lv1-lv6, lv.1-lv.6, or lv_1-lv_6',
  ],
  totals: {
    scannedFiles: allFiles.length,
    keptFiles: kept.length,
    candidateFiles: candidates.length,
    movedFiles: moved.length,
    candidateBytes: candidates.reduce((sum, file) => sum + file.sizeBytes, 0),
  },
  moved,
  candidates: candidates.map(file => ({
    path: file.relativePath,
    sizeBytes: file.sizeBytes,
    reason: file.reason,
  })),
  kept: kept.map(file => ({
    path: file.relativePath,
    sizeBytes: file.sizeBytes,
    reason: file.reason,
  })),
};

if (!dryRun) {
  fs.mkdirSync(archiveRoot, { recursive: true });
  fs.writeFileSync(path.join(archiveRoot, 'cleanup-report.json'), JSON.stringify(report, null, 2));
}

console.log(JSON.stringify({
  dryRun,
  archive: report.archive,
  scannedFiles: report.totals.scannedFiles,
  keptFiles: report.totals.keptFiles,
  candidateFiles: report.totals.candidateFiles,
  movedFiles: report.totals.movedFiles,
  candidateMB: Number((report.totals.candidateBytes / 1024 / 1024).toFixed(2)),
}, null, 2));
