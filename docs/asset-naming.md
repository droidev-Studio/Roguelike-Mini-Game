# Asset Naming

Runtime assets must be registered in `assets/manifest.json`. Runtime code should read assets through `AssetRuntime` or manifest-derived paths.

## Directory Roles

- `assets/ui-art/`: UI panels, buttons, borders, HUD skins.
- `assets/Game Art/player/`: player art.
- `assets/Game Art/enemies/`: normal enemy, elite, boss, and mini-boss art.
- `assets/Game Art/weapons/`: weapon icons, attack textures, and weapon effects.
- `assets/Visual Style/map/`: maps, obstacles, hazards, and decals.
- `assets/Audio & Feel/effects/`: combat feedback effects.
- `assets/Audio & Feel/audio/`: BGM and SFX.

## File Pattern

Recommended pattern:

```text
asset_<domain>_<name>_<variant>.png
```

Examples:

- `asset_player_guanyu_idle_01.png`
- `asset_enemy_tiger_guard_move_01.png`
- `asset_weapon_attack_taiping_lv6_nuke.png`
- `asset_map_obstacle_rock_small_01.png`
- `asset_ui_hud_bar_frame.png`

## Rules

- UI art belongs in `assets/ui-art/`, not `assets/Visual Style/ui/`.
- UI code belongs in `src/ui/`, not root `ui/`.
- Transparent player, enemy, weapon effect, pickup, and obstacle PNGs must pass `npm.cmd run validate`.
- Manifest `sourceSize` must match the real PNG size.
- New runtime assets must include `sourceSize`, `drawSize`, `anchor`, or equivalent metadata.
