import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import process from 'node:process';
import { chromium } from 'playwright-core';

const PORT = Number(process.env.P0_SMOKE_PORT || 5186);
const ROOT_URL = `http://127.0.0.1:${PORT}/`;
const CHROME_PATHS = [
  'C:/Users/admin/AppData/Local/ms-playwright/chromium-1208/chrome-win64/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function spawnVite() {
  const args = ['run', 'dev', '--', '--port', String(PORT), '--strictPort'];
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/d', '/s', '/c', `npm ${args.join(' ')}`], {
      cwd: process.cwd(),
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, BROWSER: 'none' },
      windowsHide: true,
    });
  }
  return spawn('npm', args, {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
  });
}

function stopProcessTree(child) {
  if (!child?.pid) return;
  child.stdout?.destroy();
  child.stderr?.destroy();
  if (process.platform === 'win32') {
    spawnSync('taskkill.exe', ['/PID', String(child.pid), '/T', '/F'], {
      stdio: 'ignore',
      windowsHide: true,
      timeout: 5000,
    });
    return;
  }
  child.kill('SIGTERM');
}

async function waitForServer(url, timeoutMs = 20000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Keep polling until Vite is ready.
    }
    await sleep(250);
  }
  throw new Error(`Server did not become ready: ${url}`);
}

function makeDefaultGameplayUrl() {
  const params = new URLSearchParams({
    seed: '12345',
    domUi: '1',
    artUi: '1',
    artHud: '1',
    ENABLE_GAME_SETTINGS: '1',
    skipOpening: '1',
  });
  return `${ROOT_URL}?${params.toString()}`;
}

async function clickStart(page) {
  await page.evaluate(() => {
    const direct = document.querySelector('#start-game-button');
    const fuzzy = [...document.querySelectorAll('button')]
      .find(button => /开始|Start|新游戏|New/i.test(button.textContent || ''));
    (direct || fuzzy)?.click();
  });
}

async function waitForGameState(page, state, timeoutMs = 5000) {
  try {
    await page.waitForFunction(
      expected => window.gameManager?.gameState === expected,
      state,
      { timeout: timeoutMs },
    );
    return true;
  } catch {
    return false;
  }
}

async function readRuntimeState(page) {
  return page.evaluate(() => {
    const gm = window.gameManager;
    const canvas = document.querySelector('canvas');
    let canvasSignal = null;
    if (canvas && typeof canvas.getContext === 'function') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
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
      canvasSignal = { width: canvas.width, height: canvas.height, nonBlank, bright };
    }
    return {
      bootState: document.body.dataset.bootState,
      gameState: gm?.gameState,
      gameTime: gm?.gameTime,
      hasPlayer: Boolean(gm?.player),
      player: gm?.player ? {
        x: gm.player.x,
        y: gm.player.y,
        hp: gm.player.hp,
        level: gm.player.level,
        exp: gm.player.exp,
        expToNextLevel: gm.player.expToNextLevel,
        weapons: gm.player.weapons?.length || 0,
      } : null,
      enemies: gm?.enemies?.length ?? null,
      activeWeapons: gm?.activeWeapons?.length ?? null,
      pickups: gm?.pickups?.length ?? null,
      levelUpOptions: gm?.levelUpOptions?.length ?? null,
      specLoader: window.__SPEC_LOADER_STATUS__ || null,
      systemPipeline: window.__SYSTEM_PIPELINE__ || null,
      canvasSignal,
      stateHistory: (window.__GAME_STATE_HISTORY__ || []).slice(-6),
    };
  });
}

async function runP0Smoke(page) {
  const messages = [];
  page.on('console', message => {
    if (message.type() === 'error') messages.push(`console: ${message.text()}`);
  });
  page.on('pageerror', error => messages.push(`pageerror: ${error.message}`));

  await page.goto(makeDefaultGameplayUrl(), { waitUntil: 'domcontentloaded', timeout: 20000 });
  await page.waitForFunction(
    () => !!window.gameManager && (document.body.dataset.bootState === 'ready' || document.body.dataset.bootState === 'fallback'),
    null,
    { timeout: 20000 },
  );

  const beforeStart = await readRuntimeState(page);
  await clickStart(page);
  await page.waitForFunction(() => window.gameManager?.gameState === 1 && !!window.gameManager?.player, null, { timeout: 10000 });
  await page.mouse.click(640, 360);

  const startState = await readRuntimeState(page);
  await page.keyboard.down('d');
  await page.keyboard.down('s');
  await page.waitForTimeout(700);
  await page.keyboard.up('d');
  await page.keyboard.up('s');
  const movedState = await readRuntimeState(page);
  await page.waitForFunction(
    () => (window.gameManager?.enemies?.length || 0) >= 1 || (window.gameManager?.gameTime || 0) >= 3,
    null,
    { timeout: 4000 },
  );
  const combatState = await readRuntimeState(page);

  await page.mouse.click(640, 360);
  await page.keyboard.press('p');
  const pauseReached = await waitForGameState(page, 2);
  const pausedState = await readRuntimeState(page);
  await page.mouse.click(640, 360);
  await page.keyboard.press('p');
  let resumeReached = await waitForGameState(page, 1, 1200);
  if (!resumeReached) {
    await page.keyboard.press('Escape');
    resumeReached = await waitForGameState(page, 1, 1200);
  }
  const resumedState = await readRuntimeState(page);

  await page.evaluate(() => {
    const gm = window.gameManager;
    if (!gm?.player) return;
    gm.player.addExp(gm.player.expToNextLevel || 9999);
  });
  await page.waitForFunction(() => window.gameManager?.gameState === 3, null, { timeout: 5000 });
  const levelUpState = await readRuntimeState(page);

  const problems = [];
  if (beforeStart.bootState !== 'ready') problems.push(`bootState=${beforeStart.bootState}`);
  if (beforeStart.systemPipeline?.enabled) problems.push('default path unexpectedly enabled system split');
  if (startState.gameState !== 1) problems.push(`start gameState=${startState.gameState}`);
  if (!startState.hasPlayer) problems.push('player missing after start');
  if ((startState.activeWeapons || 0) < 1) problems.push('player has no active weapon');
  if ((combatState.enemies || pausedState.enemies || resumedState.enemies || 0) < 1) problems.push('enemy did not spawn');
  if (!startState.canvasSignal || startState.canvasSignal.nonBlank < 100) problems.push('canvas appears blank');
  if (movedState.player && startState.player) {
    const moved = Math.hypot(movedState.player.x - startState.player.x, movedState.player.y - startState.player.y);
    if (moved < 5) problems.push(`player did not move enough: ${moved.toFixed(2)}px`);
  }
  if (!pauseReached || pausedState.gameState !== 2) problems.push(`pause gameState=${pausedState.gameState}`);
  if (!resumeReached || resumedState.gameState !== 1) problems.push(`resume gameState=${resumedState.gameState}`);
  if (levelUpState.gameState !== 3) problems.push(`level-up gameState=${levelUpState.gameState}`);
  if ((levelUpState.levelUpOptions || 0) < 1) problems.push('level-up options missing');
  if (messages.length) problems.push(...messages);

  return {
    ok: problems.length === 0,
    problems,
    beforeStart,
    startState,
    movedState,
    combatState,
    pausedState,
    resumedState,
    levelUpState,
  };
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
    if (!executablePath) throw new Error('No Chrome/Chromium executable found for P0 smoke test.');
    browser = await chromium.launch({ executablePath, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const result = await runP0Smoke(page);
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    stopProcessTree(vite);
    if (process.exitCode) console.error(viteOutput);
  }
}

main().then(() => {
  process.exit(process.exitCode || 0);
}).catch(error => {
  console.error(error);
  process.exit(1);
});
