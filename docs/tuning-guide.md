# Tuning Guide

Use `GameSettings.js` for global tuning. Use `src/spec/*.json` for content tables. Do not add common tuning values directly to `game.js`.

## Combat Rules

The editor sidebar exposes five runtime controls:

- `Player Health`: player HP, range `1` to `1000`.
- `Player Intensity`: player-side difficulty, `easy / normal / hard`.
- `Game Hard`: enemy, boss, and wave difficulty, `easy / normal / hard`.
- `Drops`: drop weights, `easy / normal / hard`.
- `Level`: EXP requirement scaling, `easy / normal / hard`.

Source: `GameSettings.js` -> `COMBAT_RULES`.

Runtime APIs:

- `window.getCombatRuleSettings()`
- `window.applyCombatRuleSettings(nextSettings)`
- `window.resetCombatRuleSettings()`
- `window.getCombatRuleMultipliers()`

Local storage key: `zeroDowntimeCombatRuleSettings`.

## Spec Files

- Base rules: `src/spec/game.json`
- Stage and boss timeline: `src/spec/stages.json`
- Waves and special spawns: `src/spec/waves.json`
- Player, enemies, and bosses: `src/spec/entities.json`, `src/spec/enemies.json`
- Weapons: `src/spec/weapons.json`
- In-run passives, out-of-run perks, and EXP curve: `src/spec/progression.json`
- Drops: `src/spec/drops.json`
- UI text: `src/spec/ui-text.json`

## Temporary Spec Overrides

`src/core/SpecLoader.ts` passes loaded specs through `src/config/GameConfigBridge.ts`. For temporary debugging, set:

```js
window.GAME_SETTINGS.SPEC_OVERRIDES = {
  game: {
    maxWeaponSlots: 4
  }
};
```

Use overrides only for temporary tuning. Permanent content should be written back to `src/spec/*.json`.

## Validation

```bash
node --check game.js
npm.cmd run typecheck
npm.cmd run validate
```
