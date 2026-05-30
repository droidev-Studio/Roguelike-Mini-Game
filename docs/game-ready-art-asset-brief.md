# Game-Ready Art Asset Brief

This brief is the handoff contract for the next art replacement pass. The runtime now supports metadata-driven rendering through `assets/manifest.json` and `AssetRuntime.drawGameAsset()`, so new files should be generated as game-ready transparent sprites rather than full illustrations.

## General Rules

- Format: PNG with transparent background.
- No text, border, UI frame, full scene background, or cropped object.
- Camera: top-down or near top-down.
- Composition: centered, clear silhouette, readable at gameplay size.
- Style: Three Kingdoms fantasy battlefield, low visual noise.
- Keep old `lv1-lv6` weapon resources unless a same-level replacement is ready.

## Target Paths

- Map decals: `assets/Visual Style/map/environment/`
- Obstacles and props: `assets/Game Art/map/random-events/` or `assets/Visual Style/map/obstacles/`
- Pickups: `assets/Game Art/pickups/`
- Weapon body/projectile assets: `assets/Game Art/weapons/attacks/weapon_attack/`
- Weapon visual effects: `assets/Game Art/weapons/attacks/weapon_effect/`
- Feedback effects: `assets/Audio & Feel/effects/`

After adding files, update only the relevant manifest entries first. Do not write code-specific sizes into gameplay systems; use manifest metadata.

## P2 Priority Assets

### Pickup Token

Recommended source size: `256x256`. Runtime draw size: `20-56px`.

- `asset_pickup_exp_token.png`
- `asset_pickup_exp_large_token.png`
- `asset_pickup_boss_exp_token.png`
- `asset_pickup_resonance_token.png`
- `asset_pickup_bun_token.png`
- `asset_pickup_chicken_token.png`
- `asset_pickup_magnet_token.png`

Prompt:

```text
Top-down game pickup token, transparent background, high readability at 24px, strong silhouette, glowing outline, centered icon, stylized Three Kingdoms fantasy, no text, no frame.
```

### Weapon Attack

Recommended source size: `512x512`; use `1024x512` when the shape is strongly horizontal.

- `asset_weapon_attack_saber_arc_lv1.png`
- `asset_weapon_attack_saber_arc_lv3.png`
- `asset_weapon_attack_saber_arc_lv5.png`
- `asset_weapon_attack_saber_arc_lv6.png`
- `asset_weapon_attack_spear_thrust_lv1.png`
- `asset_weapon_attack_spear_thrust_lv3.png`
- `asset_weapon_attack_spear_thrust_lv5.png`
- `asset_weapon_attack_spear_thrust_lv6.png`
- `asset_weapon_attack_qinggang_orbit_blade.png`
- `asset_weapon_attack_crossbow_arrow_projectile.png`
- `asset_weapon_attack_shield_pulse_circle.png`
- `asset_weapon_attack_taiping_magic_circle.png`

Prompt:

```text
Top-down gameplay attack effect, transparent background, aligned to face right, clear hit direction, fits a [arc/line/orbit/circle/projectile] attack area, soft fading edges, readable during fast combat, no weapon icon frame, no full scene.
```

### Hazard And Feedback

Recommended source size: `512x512` or `768x768`. Center should be semi-transparent; boundary must be readable.

- `asset_effect_boss_fire_area_readable.png`
- `asset_effect_boss_scorched_ground_readable.png`
- `asset_effect_lightning_aoe_boundary.png`
- `asset_effect_levelup_nova_clean.png`

Prompt:

```text
Top-down gameplay hazard area, transparent background, clear danger boundary, glowing edge, semi-transparent center, readable during combat, no full scene, no text, no border.
```

### Map Kit

Do not generate a full map or base tile. The game uses a procedural base ground. These assets are local map kit only.

Decals, source size `256x256` or `512x512`, six per biome:

- `grass`: grass patch, broken arrow, wheel track, stone debris, mud stain, banner scrap
- `loess`: dust patch, cracked earth, wheel track, broken spear, sand debris, worn road mark
- `stone`: stone debris, crack, ash stain, broken tile, worn mark, cold dust patch
- `blood`: blood stain, dark smear, broken arrow, corpse mark, red dust, torn cloth
- `fire`: ash patch, burnt crack, ember stain, scorch mark, molten crack, charred debris

Obstacles, source size `512x512`:

- `asset_map_obstacle_rock_small_01.png`
- `asset_map_obstacle_broken_cart_01.png`
- `asset_map_obstacle_wooden_fence_01.png`
- `asset_map_obstacle_barricade_01.png`
- `asset_map_obstacle_broken_bridge_01.png`
- `asset_map_obstacle_supply_crate_01.png`
- `asset_map_obstacle_ruined_pillar_01.png`
- `asset_map_obstacle_weapon_pile_01.png`
- `asset_map_obstacle_corpse_mound_01.png`
- `asset_map_obstacle_fallen_banner_01.png`
- `asset_map_obstacle_wall_ruin_01.png`
- `asset_map_obstacle_fire_pile_01.png`

Hazards, source size `512x512`:

- `asset_map_hazard_fire_pool_01.png`
- `asset_map_hazard_poison_pool_01.png`
- `asset_map_hazard_lava_crack_01.png`
- `asset_map_hazard_spike_trap_01.png`
- `asset_map_hazard_cursed_zone_01.png`
- `asset_map_hazard_boss_portal_01.png`

Landmarks, source size `512x512`:

- `asset_map_landmark_war_banner_01.png`
- `asset_map_landmark_ruined_gate_01.png`
- `asset_map_landmark_campfire_01.png`
- `asset_map_landmark_altar_01.png`
- `asset_map_landmark_stage_portal_01.png`

Map decal prompt:

```text
Top-down battlefield decoration decal, transparent background, small ground detail, no scene background, no border, no text, readable at 64px, soft edges, low contrast, Three Kingdoms fantasy battlefield style.
```

Obstacle prompt:

```text
Top-down terrain obstacle sprite, transparent background, clear ground footprint, centered object, soft shadow below, no perspective camera, no cropped edges, readable at 128px, Three Kingdoms battlefield style.
```

## Manifest Metadata Checklist

Each new resource should include:

```json
{
  "src": "Game Art/weapons/attacks/weapon_effect/example.png",
  "sourceSize": [512, 512],
  "drawSize": [96, 96],
  "anchor": [0.5, 0.5],
  "safeFrame": [0, 0, 512, 512],
  "assetRole": "weaponAttack",
  "sortLayer": "weaponEffect"
}
```

Weapon attacks must also include `attackShape`. Pickups must include `glowColor`. Characters must include `feetAnchor` and `collisionRadius`.
