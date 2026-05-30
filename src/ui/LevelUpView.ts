export const LEVEL_UP_VIEW = {
  name: 'LevelUpView',
  root: '.dom-levelup',
  selectors: {
    title: '[data-ui="levelUpTitle"]',
    options: '[data-ui="levelUpOptions"]',
  },
  actions: {
    reroll: '[data-action="reroll"]',
  },
  optionAttribute: 'data-levelup-index',
} as const;

export interface LevelUpOptionSnapshot {
  type: string;
  title: string;
  desc: string;
  iconSrc?: string;
  levelText?: string;
}

export interface LevelUpSnapshot {
  level: number;
  rerolls: number;
  levelUpOptions: LevelUpOptionSnapshot[];
}
