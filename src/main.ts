import { FEATURE_FLAGS } from './config/FeatureFlags';

// The legacy single-file runtime remains the active entry while system split flags are off.
export { FEATURE_FLAGS };
export { EventBus } from './core/EventBus';
export { InputSystem as ActionInputSystem } from './core/InputSystem';
export { SpecLoader } from './core/SpecLoader';
export { StateMachine } from './core/StateMachine';
export { getRuntimeSetting, mergeSpecWithSettings } from './config/GameConfigBridge';
export { HUD_VIEW } from './ui/HudView';
export { MAIN_MENU_VIEW } from './ui/MainMenuView';
export { PAUSE_MENU_VIEW } from './ui/PauseMenuView';
export { LEVEL_UP_VIEW } from './ui/LevelUpView';
export { PERK_UPGRADE_VIEW } from './ui/PerkUpgradeView';
export type { HudSnapshot, HudSkillRow, HudWeaponRow } from './ui/HudView';
export type { MainMenuSnapshot } from './ui/MainMenuView';
export type { ResultMenuSnapshot } from './ui/PauseMenuView';
export type { LevelUpOptionSnapshot, LevelUpSnapshot } from './ui/LevelUpView';
export type { PerkUpgradeSnapshot } from './ui/PerkUpgradeView';
