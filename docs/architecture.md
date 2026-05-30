# Architecture Boundaries

The current runtime still uses root `game.js` as the stable execution entry. The goal is not a rewrite. The goal is to stop new content tables from growing inside `game.js` and move data, tuning, resources, state, and input into clear boundaries.

## Primary Entrypoints

- `GameSettings.js`: tuning, combat rules, feature switches, feel, performance, and debug settings.
- `src/spec/*.json`: content tables for rules, stages, waves, entities, enemies, weapons, progression, drops, effects, and UI text.
- `assets/manifest.json`: the only runtime asset registry.
- `game.js`: the legacy execution engine and coordinator while migration is in progress.

## Current Priority

- P0/P1 are active: keep the default gameplay path playable, keep compatibility guards green, and keep optional modular paths behind flags.
- P2 architecture migration is paused. Do not migrate additional systems until the default gameplay path remains stable through `npm run smoke:p0`, `npm run typecheck`, and `npm run validate`.

## Current Layout

```text
zero_downtime_refactor/
|- GameSettings.js
|- AssetRuntime.js
|- game.js
|- assets/
|  |- manifest.json
|  `- ui-art/
|- src/
|  |- config/
|  |  |- FeatureFlags.ts
|  |  `- GameConfigBridge.ts
|  |- core/
|  |  |- InputSystem.ts
|  |  |- SpecLoader.ts
|  |  `- StateMachine.ts
|  |- spec/
|  |  |- game.json
|  |  |- stages.json
|  |  |- waves.json
|  |  |- entities.json
|  |  |- enemies.json
|  |  |- weapons.json
|  |  |- progression.json
|  |  |- drops.json
|  |  |- balance.json
|  |  |- effects.json
|  |  `- ui-text.json
|  |- systems/
|  |- render/
|  `- ui/
|     |- HudView.ts
|     |- MainMenuView.ts
|     |- PauseMenuView.ts
|     |- LevelUpView.ts
|     |- PerkUpgradeView.ts
|     |- UIBridge.js
|     |- GameEditorSidebar.js
|     `- game-ui.css
|- tools/
|  `- validate-assets.js
`- docs/
```

## Implemented Boundaries

- `src/spec/game.json` drives run duration, final boss trigger time, max weapon slots, and level-up choice count.
- `src/spec/progression.json` drives EXP requirements, level-up rules, in-run passive upgrades, out-of-run perks, and perk progress bars.
- `src/spec/ui-text.json` drives DOM UI text and selected Canvas UI text.
- `src/spec/drops.json` drives normal, elite, boss, and wooden ox drops.
- `src/spec/entities.json` and `src/spec/enemies.json` drive player and enemy baseline stats.
- `src/spec/weapons.json` drives weapon baseline values and JSON weapon parameters.
- `assets/ui-art/` is for UI art. `src/ui/` is for UI code. They must not be mixed.
- DOM UI skin CSS variables are injected from `assets/manifest.json`; CSS paths are fallback only.
- Runtime spec loading goes through `src/core/SpecLoader.ts`; legacy fetch loading in `game.js` remains a fallback.
- Spec loader status is exposed through `window.__SPEC_LOADER_STATUS__` for smoke tests.
- State changes go through `game.changeState()`.
- State changes publish `game-state-change`, `window.__GAME_STATE_CHANGE__`, and `window.__GAME_STATE_HISTORY__`.
- Input actions are normalized to `moveUp`, `moveDown`, `moveLeft`, `moveRight`, `pause`, `auto`, `reset`, `confirm`, and `cancel`.
- Runtime input bindings are exposed through `window.__INPUT_BINDINGS__`.
- `GameManager` now implements the standard `src/systems/WorldPorts.ts` methods such as `updateInput`, `updateMap`, `updateDrops`, and `renderLegacyCanvas`.
- When `ENABLE_SYSTEM_SPLIT=1`, `game.js` loads `src/systems/createLegacySystemPipeline.ts` and runs it against the `GameManager` world port directly.
- The inline `game.js` system pipeline remains a fallback and is exposed through `window.__SYSTEM_PIPELINE__` for smoke tests.

## Do Not Add

- Do not add large content tables to `game.js`.
- Do not write `game.gameState = ...` from UI code.
- Do not restore root `ui/`.
- Do not restore `assets/Visual Style/ui/`.
- Do not add runtime image paths outside `assets/manifest.json`.

## Next Migration Order

1. Move remaining content tables from `game.js` into `src/spec`.
2. Replace inline state and input helpers with `src/core/StateMachine.ts` and `src/core/InputSystem.ts`.
3. Move low-risk systems first: `MapSystem`, `DropSystem`, and `ProgressionSystem`.
4. Move `SpawnSystem` and `WeaponSystem`.
5. Move collision, movement, and rendering last.
