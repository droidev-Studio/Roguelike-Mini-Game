export const PERK_UPGRADE_VIEW = {
  name: 'PerkUpgradeView',
  root: '.dom-perk-menu',
  selectors: {
    title: '.perk-title',
    subtitle: '.perk-subtitle',
    currency: '[data-ui="perkCurrency"]',
    list: '[data-ui="perkList"]',
  },
  actions: {
    menu: '[data-action="menu"]',
  },
  optionAttribute: 'data-perk-index',
} as const;

export interface PerkUpgradeSnapshot {
  index: number;
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  cost: number;
  costText: string;
  canAfford: boolean;
  isMaxed: boolean;
  filledSegments: number;
  segmentCount: number;
  segmentStepText: string;
  progressText: string;
  nextText?: string;
}
