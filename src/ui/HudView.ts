export const HUD_VIEW = {
  name: 'HudView',
  root: '.dom-hud',
  selectors: {
    hpText: '[data-ui="hpText"]',
    hpFill: '[data-ui="hpFill"]',
    stageText: '[data-ui="stageText"]',
    bossText: '[data-ui="bossText"]',
    waveText: '[data-ui="waveText"]',
    resonanceText: '[data-ui="resonanceText"]',
    levelText: '[data-ui="levelText"]',
    timeText: '[data-ui="timeText"]',
    expFill: '[data-ui="expFill"]',
    weaponCount: '[data-ui="weaponCount"]',
    weaponList: '[data-ui="weaponList"]',
    skillList: '[data-ui="skillList"]',
    bossBanner: '[data-ui="bossBanner"]',
    bossBannerTitle: '[data-ui="bossBannerTitle"]',
    bossBannerDesc: '[data-ui="bossBannerDesc"]',
    weaponCooldownPanel: '[data-ui="weaponCooldownPanel"]',
  },
  actions: {
    home: '[data-action="home"]',
    openSettings: '[data-action="openSettings"]',
    pause: '[data-action="pause"]',
  },
} as const;

export interface HudWeaponRow {
  type: string;
  name: string;
  level: number;
  iconSrc?: string;
}

export interface HudSkillRow {
  key: string;
  name: string;
  level: number;
  levelText?: string;
  iconSrc?: string;
}

export interface HudSnapshot {
  hp: number;
  maxHp: number;
  hpPct: number;
  expPct: number;
  stageText: string;
  bossText: string;
  waveText: string;
  resonance: number;
  level: number;
  timeText: string;
  lowHp: boolean;
  weapons: HudWeaponRow[];
  skills: HudSkillRow[];
  maxWeaponSlots: number;
}
