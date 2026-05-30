import { spawn } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright-core';

const ROOT_URL = 'http://127.0.0.1:5174/';
const CHROME_PATHS = [
  'C:/Users/admin/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

const CASES = [
  ['saber', 1],
  ['saber', 3],
  ['saber', 5],
  ['saber', 6],
  ['spear', 1],
  ['spear', 3],
  ['spear', 5],
  ['spear', 6],
  ['crossbow', 1],
  ['crossbow', 6],
  ['qinggang', 1],
  ['qinggang', 6],
  ['shield', 1],
  ['shield', 4],
  ['shield', 6],
  ['taiping', 1],
  ['taiping', 6],
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnVite() {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', 'npm run dev -- --port 5174 --strictPort'], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
      windowsHide: true,
    });
  }
  return spawn('npm', ['run', 'dev', '--', '--port', '5174', '--strictPort'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
}

function stopProcessTree(child) {
  if (!child?.pid) return;
  if (process.platform === 'win32') {
    spawn('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
  } else {
    child.kill('SIGTERM');
  }
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      // Retry until Vite is ready.
    }
    await sleep(250);
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function makeUrl(weapon, level) {
  const params = new URLSearchParams({
    seed: '12345',
    artA1A2: '1',
    artEnemies: '1',
    artPlayer: '1',
    artTiles: '1',
    artEffects: '1',
    artUi: '1',
    artHud: '1',
    domUi: '1',
    audio: '1',
    stateMusic: '1',
    domWeaponCd: '1',
    pickupMerge: '1',
    aiTuning: '1',
    qinqiPhantoms: '1',
    ENABLE_LARGE_MAP_CAMERA: '1',
    ENABLE_GAME_SETTINGS: '1',
    ENABLE_WEAPON_COOLDOWN_HUD: '1',
    debugInitialWeapon: weapon,
    debugInitialWeaponLevel: String(level),
  });
  return `${ROOT_URL}?${params.toString()}`;
}

async function runCase(page, weapon, level) {
  const messages = [];
  const onConsole = message => {
    if (['warning', 'error'].includes(message.type())) messages.push(`${message.type()}: ${message.text()}`);
  };
  const onPageError = error => messages.push(`pageerror: ${error.message}`);
  page.on('console', onConsole);
  page.on('pageerror', onPageError);
  try {
    await page.goto(makeUrl(weapon, level), { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForFunction(() => document.body.dataset.bootState === 'ready' || document.body.dataset.bootState === 'fallback', null, { timeout: 15000 });
    await page.evaluate(() => window.gameManager?.startNewGame?.());
    await page.waitForTimeout(2800);
    const state = await page.evaluate(() => {
      const gm = window.gameManager;
      const canvas = document.querySelector('canvas');
      let canvasSignal = null;
      if (canvas && typeof canvas.getContext === 'function') {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const width = canvas.width;
        const height = canvas.height;
        const data = ctx.getImageData(0, 0, width, height).data;
        let nonBlank = 0;
        let bright = 0;
        for (let i = 0; i < data.length; i += 800) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const a = data[i + 3];
          if (a && (r || g || b)) nonBlank++;
          if (r + g + b > 180) bright++;
        }
        canvasSignal = { width, height, nonBlank, bright };
      }
      return {
        bootState: document.body.dataset.bootState,
        gameState: gm?.gameState,
        gameTime: gm?.gameTime,
        initialWeapon: gm?.player?.weapons?.[0]?.type,
        initialLevel: gm?.player?.weapons?.[0]?.level,
        enemies: gm?.enemies?.length,
        projectiles: gm?.projectiles?.length,
        pickups: gm?.pickups?.length,
        assetStatus: window.__ASSET_STATUS__ || null,
        preload: window.__ASSET_PRELOAD__ || null,
        hasMapKit: Boolean(window.assetRuntime?.manifest?.map?.kit),
        proceduralMapBase: Boolean(window.FEATURE_FLAGS?.ENABLE_PROCEDURAL_MAP_BASE),
        canvasSignal,
      };
    });
    const problems = [];
    if (state.bootState !== 'ready') problems.push(`bootState=${state.bootState}`);
    if (state.initialWeapon !== weapon) problems.push(`weapon=${state.initialWeapon}`);
    if (state.initialLevel !== level) problems.push(`level=${state.initialLevel}`);
    if (!state.preload?.ok) problems.push('preload not ok');
    if (state.assetStatus?.errors?.length) problems.push(`asset errors: ${state.assetStatus.errors.join('; ')}`);
    if (!state.hasMapKit) problems.push('map kit missing');
    if (!state.proceduralMapBase) problems.push('procedural map base disabled');
    if (!state.canvasSignal || state.canvasSignal.nonBlank < 100) problems.push('canvas appears blank');
    if (messages.length) problems.push(...messages);
    return { weapon, level, ok: problems.length === 0, problems, state };
  } finally {
    page.off('console', onConsole);
    page.off('pageerror', onPageError);
  }
}

function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`Timed out: ${label}`)), timeoutMs)),
  ]);
}

async function main() {
  const vite = spawnVite();
  let viteOutput = '';
  vite.stdout.on('data', chunk => { viteOutput += chunk.toString(); });
  vite.stderr.on('data', chunk => { viteOutput += chunk.toString(); });

  let browser;
  try {
    await waitForServer(ROOT_URL);
    const executablePath = CHROME_PATHS.find(candidate => fs.existsSync(candidate));
    if (!executablePath) throw new Error('No Chrome/Chromium executable found for smoke test.');
    browser = await chromium.launch({
      executablePath,
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const results = [];
    for (const [weapon, level] of CASES) {
      process.stderr.write(`smoke ${weapon} lv${level}\n`);
      results.push(await withTimeout(runCase(page, weapon, level), 25000, `${weapon} lv${level}`));
    }
    const failed = results.filter(result => !result.ok);
    const summary = {
      ok: failed.length === 0,
      total: results.length,
      failed: failed.length,
      results,
    };
    console.log(JSON.stringify(summary, null, 2));
    if (failed.length > 0) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    stopProcessTree(vite);
    if (process.exitCode) {
      console.error(viteOutput);
    }
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
