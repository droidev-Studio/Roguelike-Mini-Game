export const PAUSE_MENU_VIEW = {
  name: 'PauseMenuView',
  root: '.dom-menu',
  selectors: {
    kicker: '[data-ui="menuKicker"]',
    title: '[data-ui="menuTitle"]',
    subtitle: '[data-ui="menuSubtitle"]',
    time: '[data-ui="menuTime"]',
    level: '[data-ui="menuLevel"]',
    runResonance: '[data-ui="menuRunResonance"]',
    totalResonance: '[data-ui="menuTotalResonance"]',
  },
  actions: {
    resume: '[data-action="resume"]',
    restart: '[data-action="restart"]',
    openSettings: '[data-action="openSettings"]',
    menu: '[data-action="menu"]',
  },
} as const;

export interface ResultMenuSnapshot {
  title: string;
  subtitle: string;
  time: string;
  level: number;
  runResonance: number;
  totalResonance: number;
}
