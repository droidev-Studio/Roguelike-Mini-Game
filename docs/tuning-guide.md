# Tuning Guide

Use `GameSettings.js` for global tuning. Use `src/spec/*.json` for content tables. Do not add common tuning values directly to `game.js`.

## Campaign encounter tuning (2026-10-29)

- `GameSettings.js > CAMPAIGN.DIRECTOR`: per-stage troop composition, normal/swarm population budget, 45-second warning/assault cycle, and reduced troop frequency during guard fights.
- `GameSettings.js > CAMPAIGN.BOSS`: bounded level scaling, 1.1-second skill warning, half-health cooldown change, limited arrow tracking/lifetime, and post-guard recovery.
- `src/spec/waves.json > orders`: optional per-stage kill orders with one-time supply and resonance rewards. Summons cannot farm normal orders; the final order explicitly targets phantoms.
- XP pickup values are actual XP. Do not multiply `expValue` again when collecting or merging.
- `stages.json > bossSecond` is the earliest guard appearance time. Defeating all prior guards is also required; time does not skip guards.
- `src/rules/CampaignRules.js` contains the deterministic encounter calculations. Runtime/visual integration remains in game.js.
- Validation: `node --test tools/campaign-rules.test.mjs`, `node tools/loop-scenarios.mjs <evidence-directory>`, then `node tools/loop-validation.mjs <evidence-directory>`.
- Real-time policy play: `node tools/loop-playtest.mjs --seconds=780 --label=normal --out=<evidence-directory>`. Add `--difficulty=easy` only when explicitly testing the existing Easy editor preset; do not call that a normal-difficulty run.

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
