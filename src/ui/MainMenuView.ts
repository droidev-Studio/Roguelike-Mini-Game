export const MAIN_MENU_VIEW = {
  name: 'MainMenuView',
  root: '.dom-main-menu',
  selectors: {
    title: '[data-ui="mainTitle"]',
    subtitle: '[data-ui="mainSubtitle"]',
    weaponPreview: '[data-ui="mainWeaponPreview"]',
  },
  actions: {
    start: '[data-action="start"]',
    openPerks: '[data-action="openPerks"]',
    openSettings: '[data-action="openSettings"]',
    quit: '[data-action="quit"]',
  },
} as const;

export interface MainMenuSnapshot {
  title: string;
  subtitle: string;
  weaponPreview?: Array<{ iconSrc?: string }>;
}
