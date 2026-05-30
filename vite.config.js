import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'vite';

const allowedImageExtensions = new Set(['.png', '.svg', '.jpg', '.jpeg', '.webp']);

function toPosix(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^assets\//, '');
}

function timestamp() {
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

function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function resolveAssetPath(root, src) {
  const normalized = toPosix(src);
  if (!normalized || normalized.includes('\0') || path.posix.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error('Invalid asset path');
  }
  const extension = path.extname(normalized).toLowerCase();
  if (!allowedImageExtensions.has(extension)) {
    throw new Error('Only image assets can be replaced');
  }
  const assetsRoot = path.resolve(root, 'assets');
  const absolutePath = path.resolve(assetsRoot, normalized);
  if (!absolutePath.startsWith(`${assetsRoot}${path.sep}`)) {
    throw new Error('Asset path escapes assets directory');
  }
  if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) {
    throw new Error('Asset file does not exist');
  }
  return { normalized, absolutePath, extension };
}

function openImagePicker(initialDirectory) {
  const script = `
Add-Type -AssemblyName System.Windows.Forms
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.InitialDirectory = '${initialDirectory.replace(/'/g, "''")}'
$dialog.Filter = 'Image files (*.png;*.svg;*.jpg;*.jpeg;*.webp)|*.png;*.svg;*.jpg;*.jpeg;*.webp'
$dialog.Multiselect = $false
$dialog.Title = 'Select replacement image'
if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  Write-Output $dialog.FileName
}
`;
  const result = spawnSync('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    encoding: 'utf8',
    windowsHide: false,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || 'Image picker failed');
  return String(result.stdout || '').trim();
}

function localAssetEditorPlugin() {
  return {
    name: 'local-asset-editor',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__asset-editor__/replace', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { ok: false, error: 'Method not allowed' });
        try {
          const body = await readJsonBody(req);
          const { normalized, absolutePath, extension } = resolveAssetPath(server.config.root, body.src);
          const selectedPath = openImagePicker(path.dirname(absolutePath));
          if (!selectedPath) return jsonResponse(res, 200, { ok: false, cancelled: true });
          const selectedExtension = path.extname(selectedPath).toLowerCase();
          if (!allowedImageExtensions.has(selectedExtension)) {
            throw new Error('Selected file is not an allowed image format');
          }
          if (selectedExtension !== extension) {
            throw new Error(`Selected image must use the same extension as the target (${extension})`);
          }
          const backupPath = path.resolve(
            server.config.root,
            'assets',
            '_archive',
            `replaced-assets-${timestamp()}`,
            normalized
          );
          fs.mkdirSync(path.dirname(backupPath), { recursive: true });
          fs.copyFileSync(absolutePath, backupPath);
          fs.copyFileSync(selectedPath, absolutePath);
          return jsonResponse(res, 200, {
            ok: true,
            src: normalized,
            selected: selectedPath,
            backup: path.relative(server.config.root, backupPath).replace(/\\/g, '/'),
          });
        } catch (error) {
          return jsonResponse(res, 400, { ok: false, error: error.message || String(error) });
        }
      });

      server.middlewares.use('/__asset-editor__/show', async (req, res) => {
        if (req.method !== 'POST') return jsonResponse(res, 405, { ok: false, error: 'Method not allowed' });
        try {
          const body = await readJsonBody(req);
          const { absolutePath } = resolveAssetPath(server.config.root, body.src);
          spawn('explorer.exe', ['/select,', absolutePath], { detached: true, stdio: 'ignore' }).unref();
          return jsonResponse(res, 200, { ok: true });
        } catch (error) {
          return jsonResponse(res, 400, { ok: false, error: error.message || String(error) });
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [localAssetEditorPlugin()],
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
