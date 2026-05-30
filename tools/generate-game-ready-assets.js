import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = process.cwd();
const manifestPath = path.join(root, 'assets', 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function makePng(width, height, painter) {
  const png = new PNG({ width, height });
  const put = (x, y, r, g, b, a) => {
    if (x < 0 || y < 0 || x >= width || y >= height || a <= 0) return;
    const index = (Math.floor(y) * width + Math.floor(x)) * 4;
    const sourceAlpha = Math.max(0, Math.min(255, a)) / 255;
    const targetAlpha = png.data[index + 3] / 255;
    const outAlpha = sourceAlpha + targetAlpha * (1 - sourceAlpha);
    if (outAlpha <= 0) return;
    png.data[index] = Math.round((r * sourceAlpha + png.data[index] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
    png.data[index + 1] = Math.round((g * sourceAlpha + png.data[index + 1] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
    png.data[index + 2] = Math.round((b * sourceAlpha + png.data[index + 2] * targetAlpha * (1 - sourceAlpha)) / outAlpha);
    png.data[index + 3] = Math.round(outAlpha * 255);
  };
  painter({ png, put, width, height });
  return png;
}

function writePng(relativePath, width, height, painter) {
  const filePath = path.join(root, 'assets', relativePath);
  ensureDir(filePath);
  fs.writeFileSync(filePath, PNG.sync.write(makePng(width, height, painter)));
}

function rgba(hex) {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function radial({ put, width, height }, cx, cy, radius, color, alpha = 180, power = 1.8, ellipseY = 1) {
  const [r, g, b] = color;
  const minX = Math.max(0, Math.floor(cx - radius));
  const maxX = Math.min(width - 1, Math.ceil(cx + radius));
  const minY = Math.max(0, Math.floor(cy - radius * ellipseY));
  const maxY = Math.min(height - 1, Math.ceil(cy + radius * ellipseY));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const dx = (x - cx) / radius;
      const dy = (y - cy) / (radius * ellipseY);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 1) continue;
      put(x, y, r, g, b, Math.round(alpha * Math.pow(1 - dist, power)));
    }
  }
}

function ring(ctx, cx, cy, radius, thickness, color, alpha = 220, ellipseY = 1) {
  const [r, g, b] = color;
  const outer = radius + thickness / 2;
  for (let y = Math.max(0, Math.floor(cy - outer * ellipseY)); y <= Math.min(ctx.height - 1, Math.ceil(cy + outer * ellipseY)); y++) {
    for (let x = Math.max(0, Math.floor(cx - outer)); x <= Math.min(ctx.width - 1, Math.ceil(cx + outer)); x++) {
      const dist = Math.sqrt(((x - cx) / radius) ** 2 + ((y - cy) / (radius * ellipseY)) ** 2);
      const strength = Math.exp(-((dist - 1) ** 2) / Math.max(0.0001, (thickness / radius) ** 2));
      if (strength > 0.01) ctx.put(x, y, r, g, b, Math.round(alpha * strength));
    }
  }
}

function lineStroke(ctx, x1, y1, x2, y2, thickness, color, alpha = 220) {
  const [r, g, b] = color;
  const minX = Math.max(0, Math.floor(Math.min(x1, x2) - thickness));
  const maxX = Math.min(ctx.width - 1, Math.ceil(Math.max(x1, x2) + thickness));
  const minY = Math.max(0, Math.floor(Math.min(y1, y2) - thickness));
  const maxY = Math.min(ctx.height - 1, Math.ceil(Math.max(y1, y2) + thickness));
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lenSq));
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const dist = Math.hypot(x - px, y - py);
      if (dist > thickness) continue;
      ctx.put(x, y, r, g, b, Math.round(alpha * (1 - dist / thickness)));
    }
  }
}

function arcAttack(ctx, color, level = 1) {
  const [r, g, b] = color;
  const cx = ctx.width * 0.20;
  const cy = ctx.height * 0.50;
  const maxR = ctx.width * 0.58;
  const minR = ctx.width * 0.18;
  const halfAngle = (62 + level * 4) * Math.PI / 180;
  for (let y = 0; y < ctx.height; y++) {
    for (let x = 0; x < ctx.width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);
      if (Math.abs(angle) > halfAngle || dist < minR || dist > maxR) continue;
      const edge = Math.min((dist - minR) / 80, (maxR - dist) / 80, (halfAngle - Math.abs(angle)) / 0.25);
      const hot = Math.max(0, Math.min(1, edge));
      ctx.put(x, y, r, g, b, Math.round((80 + 150 * (dist / maxR)) * hot));
    }
  }
  ring(ctx, cx, cy, maxR * 0.86, 18 + level * 2, [255, 245, 170], 120, 0.72);
}

function spearAttack(ctx, color, level = 1) {
  radial(ctx, ctx.width * 0.26, ctx.height * 0.5, ctx.height * 0.24, color, 80, 1.8, 0.45);
  lineStroke(ctx, ctx.width * 0.12, ctx.height * 0.5, ctx.width * 0.88, ctx.height * 0.5, 16 + level * 1.8, color, 185);
  lineStroke(ctx, ctx.width * 0.22, ctx.height * 0.5, ctx.width * 0.94, ctx.height * 0.5, 5 + level, [255, 250, 195], 230);
  lineStroke(ctx, ctx.width * 0.78, ctx.height * 0.42, ctx.width * 0.96, ctx.height * 0.5, 8, [255, 250, 195], 190);
  lineStroke(ctx, ctx.width * 0.78, ctx.height * 0.58, ctx.width * 0.96, ctx.height * 0.5, 8, [255, 250, 195], 190);
}

function orbitBlade(ctx) {
  lineStroke(ctx, ctx.width * 0.50, ctx.height * 0.18, ctx.width * 0.50, ctx.height * 0.82, 18, [96, 205, 255], 170);
  lineStroke(ctx, ctx.width * 0.50, ctx.height * 0.14, ctx.width * 0.50, ctx.height * 0.78, 5, [235, 252, 255], 230);
  radial(ctx, ctx.width * 0.50, ctx.height * 0.19, ctx.width * 0.12, [116, 221, 255], 160, 1.2, 1.4);
  radial(ctx, ctx.width * 0.50, ctx.height * 0.80, ctx.width * 0.09, [76, 140, 255], 125, 1.4, 1.2);
}

function circleEffect(ctx, color, rings = 2) {
  radial(ctx, ctx.width / 2, ctx.height / 2, ctx.width * 0.33, color, 70, 1.6);
  for (let i = 0; i < rings; i++) {
    ring(ctx, ctx.width / 2, ctx.height / 2, ctx.width * (0.20 + i * 0.105), 9 + i * 3, i ? [255, 240, 150] : color, 160);
  }
}

function token(ctx, color, symbol = 'circle') {
  radial(ctx, ctx.width / 2, ctx.height / 2, ctx.width * 0.45, color, 160, 1.6);
  ring(ctx, ctx.width / 2, ctx.height / 2, ctx.width * 0.34, 11, [255, 255, 235], 190);
  if (symbol === 'diamond') {
    lineStroke(ctx, ctx.width * 0.50, ctx.height * 0.22, ctx.width * 0.78, ctx.height * 0.50, 6, [255, 255, 255], 190);
    lineStroke(ctx, ctx.width * 0.78, ctx.height * 0.50, ctx.width * 0.50, ctx.height * 0.78, 6, [255, 255, 255], 190);
    lineStroke(ctx, ctx.width * 0.50, ctx.height * 0.78, ctx.width * 0.22, ctx.height * 0.50, 6, [255, 255, 255], 190);
    lineStroke(ctx, ctx.width * 0.22, ctx.height * 0.50, ctx.width * 0.50, ctx.height * 0.22, 6, [255, 255, 255], 190);
  } else if (symbol === 'cross') {
    lineStroke(ctx, ctx.width * 0.34, ctx.height * 0.50, ctx.width * 0.66, ctx.height * 0.50, 9, [255, 255, 255], 220);
    lineStroke(ctx, ctx.width * 0.50, ctx.height * 0.34, ctx.width * 0.50, ctx.height * 0.66, 9, [255, 255, 255], 220);
  } else if (symbol === 'magnet') {
    ring(ctx, ctx.width / 2, ctx.height * 0.48, ctx.width * 0.18, 18, [255, 80, 80], 190, 1.25);
    lineStroke(ctx, ctx.width * 0.35, ctx.height * 0.50, ctx.width * 0.35, ctx.height * 0.70, 9, [225, 245, 255], 220);
    lineStroke(ctx, ctx.width * 0.65, ctx.height * 0.50, ctx.width * 0.65, ctx.height * 0.70, 9, [225, 245, 255], 220);
  } else {
    radial(ctx, ctx.width / 2, ctx.height / 2, ctx.width * 0.16, [255, 255, 255], 180, 1.8);
  }
}

function decal(ctx, color, variant) {
  const c = color;
  radial(ctx, ctx.width * 0.5, ctx.height * 0.52, ctx.width * 0.30, c, 58, 2.6, 0.32 + (variant % 3) * 0.12);
  for (let i = 0; i < 5; i++) {
    const x = ctx.width * (0.25 + i * 0.12);
    const y = ctx.height * (0.45 + Math.sin(i + variant) * 0.12);
    lineStroke(ctx, x - 18, y, x + 22, y + Math.cos(i) * 8, 2 + (variant % 4), c, 60);
  }
}

function obstacle(ctx, color, variant) {
  radial(ctx, ctx.width / 2, ctx.height * 0.68, ctx.width * 0.31, [0, 0, 0], 65, 2.0, 0.32);
  for (let i = 0; i < 4 + (variant % 3); i++) {
    radial(ctx, ctx.width * (0.30 + i * 0.10), ctx.height * (0.48 + Math.sin(i) * 0.08), ctx.width * (0.12 + (i % 2) * 0.04), color, 210, 1.3, 0.75);
  }
  lineStroke(ctx, ctx.width * 0.24, ctx.height * 0.58, ctx.width * 0.76, ctx.height * 0.52, 8, [44, 30, 22], 190);
}

function hazard(ctx, color, variant) {
  radial(ctx, ctx.width / 2, ctx.height / 2, ctx.width * 0.36, color, 86, 1.8);
  ring(ctx, ctx.width / 2, ctx.height / 2, ctx.width * 0.34, 18, color, 190, 0.82);
  ring(ctx, ctx.width / 2, ctx.height / 2, ctx.width * 0.22, 8, [255, 245, 200], 100, 0.7);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + variant;
    lineStroke(ctx, ctx.width / 2, ctx.height / 2, ctx.width / 2 + Math.cos(a) * ctx.width * 0.32, ctx.height / 2 + Math.sin(a) * ctx.height * 0.22, 4, color, 90);
  }
}

function landmark(ctx, color, variant) {
  radial(ctx, ctx.width / 2, ctx.height * 0.72, ctx.width * 0.25, [0, 0, 0], 55, 2.0, 0.28);
  lineStroke(ctx, ctx.width * 0.50, ctx.height * 0.22, ctx.width * 0.50, ctx.height * 0.74, 11, [86, 54, 34], 230);
  radial(ctx, ctx.width * 0.56, ctx.height * 0.28, ctx.width * 0.20, color, 190, 1.2, 0.7);
  lineStroke(ctx, ctx.width * 0.42, ctx.height * 0.64, ctx.width * 0.66, ctx.height * 0.72, 8 + variant, color, 160);
}

const pickups = {
  EXP: ['Game Art/pickups/asset_pickup_exp_token.png', '#5ad7ff', 'diamond', [24, 24]],
  EXP_LARGE: ['Game Art/pickups/asset_pickup_exp_large_token.png', '#ffae42', 'diamond', [32, 32]],
  BOSS_EXP: ['Game Art/pickups/asset_pickup_boss_exp_token.png', '#ff405f', 'diamond', [36, 36]],
  RESONANCE: ['Game Art/pickups/asset_pickup_resonance_token.png', '#d58bff', 'diamond', [34, 34]],
  BUN: ['Game Art/pickups/asset_pickup_bun_token.png', '#ffe7b1', 'cross', [34, 34]],
  CHICKEN: ['Game Art/pickups/asset_pickup_chicken_token.png', '#ffb24f', 'cross', [38, 38]],
  MAGNET: ['Game Art/pickups/asset_pickup_magnet_token.png', '#6ed7ff', 'magnet', [34, 34]],
};

for (const [id, [src, color, symbol, drawSize]] of Object.entries(pickups)) {
  writePng(src, 256, 256, ctx => token(ctx, rgba(color), symbol));
  Object.assign(manifest.pickups[id], {
    src,
    sourceSize: [256, 256],
    safeFrame: [0, 0, 256, 256],
    drawSize,
    anchor: [0.5, 0.5],
    assetRole: 'pickup',
  });
}

for (const level of [1, 3, 5, 6]) {
  const src = `Game Art/weapons/attacks/weapon_effect/asset_weapon_attack_saber_arc_lv${level}.png`;
  writePng(src, 512, 512, ctx => arcAttack(ctx, rgba(level >= 5 ? '#ff7a30' : '#ffd966'), level));
  Object.assign(manifest.weaponAttacks.saber.levels[String(level)].primary, { src, sourceSize: [512, 512], safeFrame: [0, 0, 512, 512] });
}

for (const level of [1, 3, 5, 6]) {
  const src = `Game Art/weapons/attacks/weapon_effect/asset_weapon_attack_spear_thrust_lv${level}.png`;
  writePng(src, 1024, 512, ctx => spearAttack(ctx, rgba(level >= 5 ? '#89f7ff' : '#cdeaff'), level));
  Object.assign(manifest.weaponAttacks.spear.levels[String(level)].primary, { src, sourceSize: [1024, 512], safeFrame: [0, 0, 1024, 512] });
}

writePng('Game Art/weapons/attacks/weapon_attack/asset_weapon_attack_qinggang_orbit_blade.png', 512, 512, orbitBlade);
Object.assign(manifest.weaponAttacks.qinggang.levels['1'].primary, {
  src: 'Game Art/weapons/attacks/weapon_attack/asset_weapon_attack_qinggang_orbit_blade.png',
  sourceSize: [512, 512],
  safeFrame: [0, 0, 512, 512],
});

writePng('Game Art/weapons/attacks/weapon_attack/asset_weapon_attack_crossbow_arrow_projectile.png', 512, 128, ctx => spearAttack(ctx, rgba('#ffe08a'), 1));
Object.assign(manifest.weaponAttacks.crossbow.levels['1'].projectile, {
  src: 'Game Art/weapons/attacks/weapon_attack/asset_weapon_attack_crossbow_arrow_projectile.png',
  sourceSize: [512, 128],
  safeFrame: [0, 0, 512, 128],
  drawSize: [48, 14],
});

writePng('Game Art/weapons/attacks/weapon_effect/asset_weapon_attack_shield_pulse_circle.png', 512, 512, ctx => circleEffect(ctx, rgba('#7cffd5'), 3));
for (const slot of ['primary', 'charge', 'release']) {
  Object.assign(manifest.weaponAttacks.shield.levels['1'][slot], {
    src: 'Game Art/weapons/attacks/weapon_effect/asset_weapon_attack_shield_pulse_circle.png',
    sourceSize: [512, 512],
    safeFrame: [0, 0, 512, 512],
  });
}

writePng('Game Art/weapons/attacks/weapon_effect/asset_weapon_attack_taiping_magic_circle.png', 512, 512, ctx => circleEffect(ctx, rgba('#bb78ff'), 4));
Object.assign(manifest.weaponAttacks.taiping.levels['1'].primary, {
  src: 'Game Art/weapons/attacks/weapon_effect/asset_weapon_attack_taiping_magic_circle.png',
  sourceSize: [512, 512],
  safeFrame: [0, 0, 512, 512],
});

const effectMap = {
  boss_fire_area: ['Audio & Feel/effects/asset_effect_boss_fire_area_readable.png', '#ff5f2e'],
  boss_scorched_ground: ['Audio & Feel/effects/asset_effect_boss_scorched_ground_readable.png', '#b64a28'],
  lightning_aoe: ['Audio & Feel/effects/asset_effect_lightning_aoe_boundary.png', '#82e8ff'],
  levelup_nova: ['Audio & Feel/effects/asset_effect_levelup_nova_clean.png', '#fff0a0'],
};
for (const [id, [src, color]] of Object.entries(effectMap)) {
  writePng(src, 512, 512, ctx => hazard(ctx, rgba(color), id.length));
  Object.assign(manifest.effects[id], { src, sourceSize: [512, 512], safeFrame: [0, 0, 512, 512] });
}

const biomes = {
  grass: '#6fa34f',
  loess: '#c4944f',
  stone: '#8aa0a8',
  blood: '#9c2a2c',
  fire: '#e15b22',
};
manifest.map.kit = manifest.map.kit || {};
manifest.map.kit.decals = {};
let decalIndex = 0;
for (const [biome, color] of Object.entries(biomes)) {
  manifest.map.kit.decals[biome] = {};
  for (const name of ['patch', 'broken_arrow', 'wheel_track', 'debris', 'stain', 'banner_scrap']) {
    const id = `${biome}_${name}_01`;
    const src = `Visual Style/map/environment/asset_map_decal_${id}.png`;
    writePng(src, 256, 256, ctx => decal(ctx, rgba(color), decalIndex++));
    manifest.map.kit.decals[biome][id] = {
      src,
      sourceSize: [256, 256],
      drawSize: [120, 90],
      anchor: [0.5, 0.5],
      safeFrame: [0, 0, 256, 256],
      assetRole: 'decal',
      sortLayer: 'terrain',
      placement: 'random_low_density',
      canRotate: true,
      canMirror: true,
      alpha: 0.34,
    };
  }
}

manifest.map.kit.obstacles = {};
for (const [index, name] of ['rock_small', 'broken_cart', 'wooden_fence', 'barricade', 'broken_bridge', 'supply_crate', 'ruined_pillar', 'weapon_pile', 'corpse_mound', 'fallen_banner', 'wall_ruin', 'fire_pile'].entries()) {
  const src = `Visual Style/map/obstacles/asset_map_obstacle_${name}_01.png`;
  writePng(src, 512, 512, ctx => obstacle(ctx, rgba(index % 3 === 0 ? '#8d8272' : index % 3 === 1 ? '#7a4c32' : '#685d50'), index));
  manifest.map.kit.obstacles[name] = {
    src,
    sourceSize: [512, 512],
    drawSize: [150, 110],
    anchor: [0.5, 0.72],
    safeFrame: [0, 0, 512, 512],
    assetRole: 'obstacle',
    sortLayer: 'terrain',
    placement: 'local_map_kit',
    collision: { shape: 'circle', radius: 42 },
  };
}

manifest.map.kit.hazards = {};
for (const [index, [name, color]] of [['fire_pool', '#ff5a2a'], ['poison_pool', '#70d85b'], ['lava_crack', '#ff7a24'], ['spike_trap', '#d8d0b8'], ['cursed_zone', '#a46cff'], ['boss_portal', '#ff4a7d']].entries()) {
  const src = `Visual Style/map/environment/asset_map_hazard_${name}_01.png`;
  writePng(src, 512, 512, ctx => hazard(ctx, rgba(color), index));
  manifest.map.kit.hazards[name] = {
    src,
    sourceSize: [512, 512],
    drawSize: [160, 160],
    anchor: [0.5, 0.5],
    safeFrame: [0, 0, 512, 512],
    assetRole: 'hazard',
    sortLayer: 'hazard',
    placement: 'gameplay_zone',
    alpha: 0.55,
  };
}

manifest.map.kit.landmarks = {};
for (const [index, name] of ['war_banner', 'ruined_gate', 'campfire', 'altar', 'stage_portal'].entries()) {
  const src = `Game Art/map/random-events/asset_map_landmark_${name}_01.png`;
  writePng(src, 512, 512, ctx => landmark(ctx, rgba(index % 2 ? '#c18d52' : '#d54438'), index));
  manifest.map.kit.landmarks[name] = {
    src,
    sourceSize: [512, 512],
    drawSize: [150, 150],
    anchor: [0.5, 0.76],
    safeFrame: [0, 0, 512, 512],
    assetRole: 'landmark',
    sortLayer: 'terrain',
    placement: 'rare_landmark',
  };
}

fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log('Generated P2 game-ready placeholder assets and updated manifest.'); 
