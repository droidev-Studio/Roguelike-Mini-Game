(function initUIBridge(global) {
    const GAME_STATE = global.GAME_STATE || {
        MENU: 0,
        PLAYING: 1,
        PAUSED: 2,
        LEVEL_UP: 3,
        GAME_OVER: 4,
        VICTORY: 5,
        PERK_UPGRADE: 6,
        CUTSCENE: 7,
        OPENING_CUTSCENE: 8,
        RUN_ENTRY: 9,
    };
    const STATE_CLASS = {
        [GAME_STATE.MENU]: 'is-menu',
        [GAME_STATE.PLAYING]: 'is-playing',
        [GAME_STATE.PAUSED]: 'is-paused',
        [GAME_STATE.LEVEL_UP]: 'is-level-up',
        [GAME_STATE.GAME_OVER]: 'is-game-over',
        [GAME_STATE.VICTORY]: 'is-victory',
        [GAME_STATE.PERK_UPGRADE]: 'is-perk-upgrade',
        [GAME_STATE.CUTSCENE]: 'is-cutscene',
        [GAME_STATE.OPENING_CUTSCENE]: 'is-opening-cutscene',
        [GAME_STATE.RUN_ENTRY]: 'is-run-entry',
    };

    function getUiTextConfig() {
        return global.__UI_TEXT_CONFIG__ || {};
    }

    function readPath(source, path, fallback) {
        let cursor = source;
        for (const key of String(path).split('.')) {
            if (!cursor || typeof cursor !== 'object' || !(key in cursor)) return fallback;
            cursor = cursor[key];
        }
        return typeof cursor === 'string' ? cursor : fallback;
    }

    function uiText(path, fallback = '') {
        return readPath(getUiTextConfig(), path, fallback);
    }

    function formatText(template, values = {}) {
        return String(template || '').replace(/\{(\w+)\}/g, (_, key) => values[key] ?? '');
    }

    class UIBridge {
        constructor(options = {}) {
            this.root = options.root || document.getElementById('gameUiRoot');
            this.game = null;
            this.lastLevelUpKey = '';
            this.lastMainKey = '';
            this.lastPerkKey = '';
            this.lastStatusKey = '';
            this.lastStateClass = '';
            this.lastWeaponCooldownKey = '';
            this.settingsOpen = false;
        }

        mount(game) {
            if (!this.root) return false;
            this.game = game;
            this.root.innerHTML = this.createMarkup();
            this.applyStaticText();
            this.applyManifestUiSkins();
            this.bindEvents();
            this.root.hidden = false;
            return true;
        }

        createMarkup() {
            return `
                <div class="dom-hud">
                    <section class="hud-cluster hud-left" data-ui="hud-left">
                        <div class="hud-label"><span>生命</span><strong data-ui="hpText">0/0</strong></div>
                        <div class="meter meter-hp"><div class="meter-fill" data-ui="hpFill"></div></div>
                        <div class="hud-stat-grid">
                            <span>关卡<b data-ui="stageText">-</b></span>
                            <span>Boss<b data-ui="bossText">-</b></span>
                            <span>波次<b data-ui="waveText">-</b></span>
                            <span>残响<b data-ui="resonanceText">0</b></span>
                        </div>
                    </section>
                    <section class="hud-cluster hud-top">
                        <div class="level-text" data-ui="levelText">等级 1</div>
                        <div class="meter meter-exp"><div class="meter-fill" data-ui="expFill"></div></div>
                        <div class="time-text" data-ui="timeText">生存时间 0:00</div>
                    </section>
                    <div class="hud-actions">
                        <button class="hud-button" type="button" data-action="home">主页</button>
                        <button class="hud-button" type="button" data-action="openSettings">设置</button>
                        <button class="hud-button" type="button" data-action="pause">暂停</button>
                    </div>
                    <aside class="hud-cluster hud-right">
                        <div class="status-title"><span>武器</span><span data-ui="weaponCount">0/6</span></div>
                        <div class="status-list" data-ui="weaponList"></div>
                        <div class="status-title"><span>被动技能</span><span>局内</span></div>
                        <div class="status-list" data-ui="skillList"></div>
                    </aside>
                    <div class="boss-banner" data-ui="bossBanner" hidden>
                        <strong data-ui="bossBannerTitle"></strong>
                        <span data-ui="bossBannerDesc"></span>
                    </div>
                    <div class="weapon-cd-panel" data-ui="weaponCooldownPanel" aria-label="武器冷却"></div>
                    <div class="low-hp-vignette"></div>
                </div>
                <section class="dom-levelup" role="dialog" aria-modal="true" aria-label="升级选择">
                    <div class="levelup-panel">
                        <header class="levelup-header">
                            <div class="levelup-title" data-ui="levelUpTitle">升级</div>
                            <div class="levelup-subtitle">选择一项增益</div>
                        </header>
                        <div class="levelup-options" data-ui="levelUpOptions"></div>
                        <footer class="levelup-footer">
                            <button class="levelup-reroll" type="button" data-action="reroll">刷新选项</button>
                        </footer>
                    </div>
                </section>
                <section class="dom-main-menu" aria-label="主菜单">
                    <div class="main-panel">
                        <div class="main-title" data-ui="mainTitle">千里走单骑</div>
                        <div class="main-subtitle" data-ui="mainSubtitle">穿越时空只为找到你</div>
                        <div class="main-actions">
                            <button id="start-game-button" class="main-button main-button-primary" type="button" data-action="start">开始新游戏</button>
                            <button class="main-button" type="button" data-action="openPerks">局外升级</button>
                            <button class="main-button" type="button" data-action="openSettings">音频设置</button>
                            <button class="main-button main-button-secondary" type="button" data-action="quit">退出</button>
                            <button class="main-replay-button" type="button" data-action="replayOpening">重新播放</button>
                        </div>
                    </div>
                </section>
                <section class="dom-perk-menu" aria-label="局外升级">
                    <div class="perk-panel">
                        <header class="perk-header">
                            <div>
                                <div class="perk-title">历史残响 基因重塑</div>
                                <div class="perk-subtitle">点击购买永久升级，死亡后保留效果</div>
                            </div>
                            <div class="perk-currency">当前残响 <b data-ui="perkCurrency">0</b></div>
                        </header>
                        <div class="perk-list" data-ui="perkList"></div>
                        <footer class="perk-footer">
                            <button class="menu-button" type="button" data-action="menu">返回主页</button>
                        </footer>
                    </div>
                </section>
                <section class="dom-menu" role="dialog" aria-modal="true" aria-label="系统菜单">
                    <div class="menu-panel">
                        <div class="menu-kicker" data-ui="menuKicker">SYSTEM</div>
                        <div class="menu-title" data-ui="menuTitle">已暂停</div>
                        <div class="menu-subtitle" data-ui="menuSubtitle">战斗逻辑已冻结</div>
                        <div class="menu-stats">
                            <span>存活时间<b data-ui="menuTime">0:00</b></span>
                            <span>本局等级<b data-ui="menuLevel">1</b></span>
                            <span>本局残响<b data-ui="menuRunResonance">0</b></span>
                            <span>累计残响<b data-ui="menuTotalResonance">0</b></span>
                        </div>
                        <div class="menu-actions">
                            <button class="menu-button" type="button" data-action="resume">继续</button>
                            <button class="menu-button" type="button" data-action="restart">重启时空</button>
                            <button class="menu-button" type="button" data-action="openSettings">音频设置</button>
                            <button class="menu-button menu-button-secondary" type="button" data-action="menu">返回主页</button>
                        </div>
                    </div>
                </section>
                <section class="dom-settings" role="dialog" aria-modal="true" aria-label="音频设置">
                    <div class="settings-panel">
                        <header class="settings-header">
                            <div>
                                <div class="settings-title">音频设置</div>
                                <div class="settings-subtitle" data-ui="audioModeText">Synthetic audio</div>
                            </div>
                            <button class="settings-close" type="button" data-action="closeSettings" aria-label="关闭">X</button>
                        </header>
                        <div class="settings-list">
                            <label class="settings-row">
                                <span>总音量</span>
                                <input type="range" min="0" max="1" step="0.01" data-audio-volume="master">
                                <b data-ui="audioMasterValue">70%</b>
                            </label>
                            <label class="settings-row">
                                <span>战斗音效</span>
                                <input type="range" min="0" max="1" step="0.01" data-audio-volume="sfx">
                                <b data-ui="audioSfxValue">55%</b>
                            </label>
                            <label class="settings-row">
                                <span>背景音乐</span>
                                <input type="range" min="0" max="1" step="0.01" data-audio-volume="music">
                                <b data-ui="audioMusicValue">32%</b>
                            </label>
                            <label class="settings-row">
                                <span>界面音效</span>
                                <input type="range" min="0" max="1" step="0.01" data-audio-volume="ui">
                                <b data-ui="audioUiValue">72%</b>
                            </label>
                            <label class="settings-row">
                                <span>警告音效</span>
                                <input type="range" min="0" max="1" step="0.01" data-audio-volume="alert">
                                <b data-ui="audioAlertValue">78%</b>
                            </label>
                        </div>
                        <div class="settings-actions">
                            <button class="menu-button" type="button" data-action="muteAudio">静音</button>
                            <button class="menu-button" type="button" data-action="testAudio">测试音效</button>
                        </div>
                    </div>
                </section>
            `;
        }

        setElementText(selector, text) {
            const element = this.root?.querySelector(selector);
            if (element) element.textContent = text;
        }

        setAllElementText(selector, text) {
            this.root?.querySelectorAll(selector).forEach(element => {
                element.textContent = text;
            });
        }

        setLabelPrefix(element, text) {
            if (!element) return;
            const first = element.childNodes[0];
            if (first && first.nodeType === Node.TEXT_NODE) {
                first.textContent = text;
            } else {
                element.insertBefore(document.createTextNode(text), element.firstChild);
            }
        }

        applyStaticText() {
            if (!this.root) return;
            this.setElementText('.hud-label span', uiText('hud.hp', '生命'));
            const hudStats = this.root.querySelectorAll('.hud-stat-grid span');
            this.setLabelPrefix(hudStats[0], uiText('hud.stage', '关卡'));
            this.setLabelPrefix(hudStats[1], uiText('hud.boss', 'Boss'));
            this.setLabelPrefix(hudStats[2], uiText('hud.wave', '波次'));
            this.setLabelPrefix(hudStats[3], uiText('hud.resonance', '残响'));
            this.setElementText('.hud-actions [data-action="home"]', uiText('hud.home', '主页'));
            this.setElementText('.hud-actions [data-action="openSettings"]', uiText('hud.settings', '设置'));
            this.setElementText('.hud-actions [data-action="pause"]', uiText('hud.pause', '暂停'));
            const statusTitles = this.root.querySelectorAll('.hud-right .status-title');
            if (statusTitles[0]) statusTitles[0].querySelector('span:first-child').textContent = uiText('hud.weapons', '武器');
            if (statusTitles[1]) {
                statusTitles[1].querySelector('span:first-child').textContent = uiText('hud.passives', '被动技能');
                statusTitles[1].querySelector('span:last-child').textContent = uiText('hud.inRun', '局内');
            }
            const cooldownPanel = this.root.querySelector('[data-ui="weaponCooldownPanel"]');
            if (cooldownPanel) cooldownPanel.setAttribute('aria-label', uiText('hud.weaponCooldown', '武器冷却'));

            this.setElementText('.levelup-title', uiText('levelUp.title', '升级'));
            this.setElementText('.levelup-subtitle', uiText('levelUp.subtitle', '选择一项增益'));
            this.setElementText('[data-action="reroll"]', uiText('levelUp.reroll', '刷新选项'));

            this.setText('mainTitle', uiText('title', '千里走单骑'));
            this.setText('mainSubtitle', uiText('subtitle', '穿越时空只为找到你'));
            this.setElementText('.main-actions [data-action="start"]', uiText('mainMenu.start', '开始新游戏'));
            this.setElementText('.main-actions [data-action="openPerks"]', uiText('mainMenu.perks', '局外升级'));
            this.setElementText('.main-actions [data-action="openSettings"]', uiText('mainMenu.audioSettings', '音频设置'));
            this.setElementText('.main-actions [data-action="quit"]', uiText('mainMenu.quit', '退出'));
            this.setElementText('.main-actions [data-action="replayOpening"]', uiText('mainMenu.replayOpening', '重新播放'));

            this.setElementText('.perk-title', uiText('perkMenu.title', '历史残响 基因重塑'));
            this.setElementText('.perk-subtitle', uiText('perkMenu.subtitle', '点击购买永久升级，死亡后保留效果'));
            this.setLabelPrefix(this.root.querySelector('.perk-currency'), `${uiText('perkMenu.currency', '当前残响')} `);
            this.setElementText('.perk-footer [data-action="menu"]', uiText('perkMenu.back', '返回主页'));

            this.setText('menuKicker', uiText('systemMenu.system', 'SYSTEM'));
            this.setText('menuTitle', uiText('systemMenu.paused', '已暂停'));
            this.setText('menuSubtitle', uiText('systemMenu.pausedSubtitle', '战斗逻辑已冻结'));
            const menuStats = this.root.querySelectorAll('.menu-stats span');
            this.setLabelPrefix(menuStats[0], uiText('systemMenu.time', '存活时间'));
            this.setLabelPrefix(menuStats[1], uiText('systemMenu.runLevel', '本局等级'));
            this.setLabelPrefix(menuStats[2], uiText('systemMenu.runResonance', '本局残响'));
            this.setLabelPrefix(menuStats[3], uiText('systemMenu.totalResonance', '累计残响'));
            this.setElementText('.menu-actions [data-action="resume"]', uiText('systemMenu.resume', '继续'));
            this.setElementText('.menu-actions [data-action="restart"]', uiText('systemMenu.restart', '重启时空'));
            this.setElementText('.menu-actions [data-action="openSettings"]', uiText('systemMenu.audioSettings', '音频设置'));
            this.setElementText('.menu-actions [data-action="menu"]', uiText('systemMenu.back', '返回主页'));

            this.setElementText('.settings-title', uiText('audio.title', '音频设置'));
            this.setElementText('.settings-close', uiText('audio.close', '关闭'));
            this.setAllElementText('.settings-row:nth-of-type(1) span', uiText('audio.master', '总音量'));
            this.setAllElementText('.settings-row:nth-of-type(2) span', uiText('audio.sfx', '战斗音效'));
            this.setAllElementText('.settings-row:nth-of-type(3) span', uiText('audio.music', '背景音乐'));
            this.setAllElementText('.settings-row:nth-of-type(4) span', uiText('audio.ui', '界面音效'));
            this.setAllElementText('.settings-row:nth-of-type(5) span', uiText('audio.alert', '警告音效'));
            this.setElementText('[data-action="muteAudio"]', uiText('audio.mute', '静音'));
            this.setElementText('[data-action="testAudio"]', uiText('audio.test', '测试音效'));
        }

        applyManifestUiSkins() {
            const runtime = global.assetRuntime;
            const manifestUi = runtime?.manifest?.ui;
            if (!this.root || !manifestUi) return;
            const mappings = {
                '--ui-skin-menu': 'menu_panel',
                '--ui-skin-button': 'button_frame',
                '--ui-skin-card': 'upgrade_card',
                '--ui-skin-dialog': 'dialog_panel',
                '--ui-skin-hud-bar': 'hud_bar_frame',
                '--ui-skin-status': 'status_panel',
                '--ui-skin-warning': 'warning_banner',
                '--ui-skin-pause': 'pause_panel',
            };
            const basePath = runtime.basePath || runtime.manifest?.basePath || 'assets/';
            const resolved = {};
            for (const [cssVar, uiKey] of Object.entries(mappings)) {
                const src = manifestUi[uiKey]?.src;
                if (typeof src !== 'string' || !src) continue;
                const rawPath = `${basePath}${src}`;
                const requestPath = runtime.getAssetRequestPath?.(rawPath) || rawPath;
                this.root.style.setProperty(cssVar, `url("${requestPath}")`);
                resolved[cssVar] = src;
            }
            global.__DOM_UI_SKINS__ = resolved;
        }

        bindEvents() {
            this.root.addEventListener('click', (event) => {
                const action = event.target.closest('[data-action]')?.dataset.action;
                if (!action || !this.game) return;
                event.preventDefault();
                event.stopPropagation();
                if (action === 'pause') {
                    this.game.togglePause?.();
                } else if (action === 'start') {
                    this.game.startNewGame?.();
                } else if (action === 'openPerks') {
                    this.game.openPerkUpgrade?.();
                } else if (action === 'quit') {
                    window.location.reload();
                } else if (action === 'replayOpening') {
                    this.game.replayOpeningCutscene?.();
                } else if (action === 'openSettings') {
                    this.settingsOpen = true;
                    this.root.classList.add('is-settings-open');
                    this.updateAudioSettings();
                } else if (action === 'closeSettings') {
                    this.settingsOpen = false;
                    this.root.classList.remove('is-settings-open');
                } else if (action === 'muteAudio') {
                    window.audioManager?.toggleMuted?.();
                    this.updateAudioSettings();
                } else if (action === 'testAudio') {
                    window.audioManager?.play?.('levelUp', 0.8);
                    this.updateAudioSettings();
                } else if (action === 'home') {
                    this.game.returnToMenu?.();
                } else if (action === 'resume') {
                    this.game.resumeGame?.();
                } else if (action === 'restart') {
                    this.game.restartGame?.();
                } else if (action === 'menu') {
                    this.game.returnToMenu?.();
                } else if (action === 'reroll') {
                    const player = this.game.player;
                    if (this.game.gameState === GAME_STATE.LEVEL_UP && player && player.rerolls > 0) {
                        player.rerolls--;
                        this.game.levelUpOptions = this.game.generateLevelUpOptions();
                        this.lastLevelUpKey = '';
                        this.update(this.game);
                    }
                }
            });

            this.root.addEventListener('click', (event) => {
                const card = event.target.closest('[data-levelup-index]');
                if (!card || !this.game || this.game.gameState !== GAME_STATE.LEVEL_UP) return;
                event.preventDefault();
                event.stopPropagation();
                const index = Number(card.dataset.levelupIndex);
                if (Number.isInteger(index)) {
                    this.game.selectLevelUpOption(index);
                    this.lastLevelUpKey = '';
                    this.update(this.game);
                }
            });

            this.root.addEventListener('click', (event) => {
                const card = event.target.closest('[data-perk-index]');
                if (!card || !this.game || this.game.gameState !== GAME_STATE.PERK_UPGRADE) return;
                event.preventDefault();
                event.stopPropagation();
                const index = Number(card.dataset.perkIndex);
                if (Number.isInteger(index)) {
                    this.game.buyPerk(index);
                    this.lastPerkKey = '';
                    this.update(this.game);
                }
            });

            this.root.addEventListener('input', (event) => {
                const slider = event.target.closest('[data-audio-volume]');
                if (!slider || !window.audioManager) return;
                window.audioManager.setVolume?.(slider.dataset.audioVolume, Number(slider.value));
                this.updateAudioSettings();
            });
        }

        update(game) {
            if (!this.root || !game || typeof game.getUiSnapshot !== 'function') return;
            const snapshot = game.getUiSnapshot();
            this.applyState(snapshot);
            this.updateHud(snapshot);
            this.updateWeaponCooldowns(snapshot);
            this.updateStatus(snapshot);
            this.updateLevelUp(snapshot);
            this.updateMainMenu(snapshot);
            this.updatePerkMenu(snapshot);
            this.updateMenu(snapshot);
            this.updateAudioSettings();
        }

        applyState(snapshot) {
            const stateClass = STATE_CLASS[snapshot.gameState] || 'is-unknown';
            if (stateClass !== this.lastStateClass) {
                for (const value of Object.values(STATE_CLASS)) this.root.classList.remove(value);
                this.root.classList.add(stateClass);
                this.lastStateClass = stateClass;
            }
            this.root.classList.toggle('is-low-hp', snapshot.lowHp);
            const pauseButton = this.root.querySelector('[data-action="pause"]');
            if (pauseButton) pauseButton.textContent = snapshot.gameState === GAME_STATE.PAUSED ? uiText('hud.resume', '继续') : uiText('hud.pause', '暂停');
        }

        updateHud(snapshot) {
            this.setText('hpText', `${snapshot.hp}/${snapshot.maxHp}`);
            this.setMeter('hpFill', snapshot.hpPct);
            this.setText('stageText', snapshot.stageText);
            this.setText('bossText', snapshot.bossText);
            this.setText('waveText', snapshot.waveText);
            this.setText('resonanceText', `${snapshot.resonance}`);
            this.setText('levelText', `${uiText('hud.level', '等级')} ${snapshot.level}`);
            this.setText('timeText', snapshot.timeText);
            this.setMeter('expFill', snapshot.expPct);
            const left = this.root.querySelector('[data-ui="hud-left"]');
            if (left) left.classList.toggle('is-low', snapshot.lowHp);
            const banner = this.root.querySelector('[data-ui="bossBanner"]');
            if (banner) banner.hidden = !snapshot.bossActive;
            this.setText('bossBannerTitle', snapshot.bossActive ? `${uiText('hud.boss', 'Boss')}：${snapshot.bossName}` : '');
            this.setText('bossBannerDesc', snapshot.bossActive ? snapshot.stageDescription : '');
        }

        updateStatus(snapshot) {
            const activeSkills = (snapshot.skills || []).filter(skill => Number(skill.level) > 0);
            const key = JSON.stringify({ weapons: snapshot.weapons, skills: activeSkills });
            if (key === this.lastStatusKey) return;
            this.lastStatusKey = key;
            this.setText('weaponCount', `${snapshot.weapons.length}/${snapshot.maxWeaponSlots || 6}`);
            this.renderRows('weaponList', snapshot.weapons, false);
            this.renderRows('skillList', activeSkills, true);
        }

        updateWeaponCooldowns(snapshot) {
            const container = this.root.querySelector('[data-ui="weaponCooldownPanel"]');
            if (!container) return;
            const weapons = snapshot.weaponCooldowns || [];
            container.hidden = weapons.length === 0;
            if (weapons.length === 0) {
                container.innerHTML = '';
                this.lastWeaponCooldownKey = '';
                return;
            }
            const structureKey = weapons.map(weapon => `${weapon.type}:${weapon.level}:${weapon.iconSrc}`).join('|');
            if (structureKey !== this.lastWeaponCooldownKey) {
                this.lastWeaponCooldownKey = structureKey;
                container.innerHTML = weapons.map((weapon, index) => {
                    const icon = weapon.iconSrc
                        ? `<img src="${this.escapeAttr(weapon.iconSrc)}" alt="">`
                        : `<span>${this.escape((weapon.name || '?').slice(0, 1))}</span>`;
                    return `
                        <div class="weapon-cd-card" data-cd-index="${index}">
                            <div class="weapon-cd-icon">${icon}</div>
                            <div class="weapon-cd-mask"></div>
                            <div class="weapon-cd-border"></div>
                            <b>Lv.${this.escape(String(weapon.level || 1))}</b>
                        </div>
                    `;
                }).join('');
            }
            weapons.forEach((weapon, index) => {
                const card = container.querySelector(`[data-cd-index="${index}"]`);
                if (!card) return;
                const readyPct = Math.max(0, Math.min(100, Math.round((weapon.readyRatio || 0) * 100)));
                card.style.setProperty('--ready', String(readyPct));
                card.classList.toggle('is-ready', !!weapon.ready);
            });
        }

        updateLevelUp(snapshot) {
            const key = JSON.stringify({
                state: snapshot.gameState,
                level: snapshot.level,
                rerolls: snapshot.rerolls,
                options: snapshot.levelUpOptions,
            });
            if (key === this.lastLevelUpKey) return;
            this.lastLevelUpKey = key;
            this.setText('levelUpTitle', formatText(uiText('levelUp.titleWithLevel', '升级：等级 {level}'), { level: snapshot.level }));
            const reroll = this.root.querySelector('[data-action="reroll"]');
            if (reroll) {
                reroll.textContent = `${uiText('levelUp.reroll', '刷新选项')}（剩余：${snapshot.rerolls}次）`;
                reroll.disabled = snapshot.rerolls <= 0;
            }
            const container = this.root.querySelector('[data-ui="levelUpOptions"]');
            if (!container) return;
            container.innerHTML = snapshot.levelUpOptions.map((option, index) => {
                const typeClass = option.type === 'passive' ? 'is-passive' : 'is-weapon';
                const icon = option.iconSrc
                    ? `<img src="${this.escapeAttr(option.iconSrc)}" alt="">`
                    : `<span>${option.type === 'passive' ? '◆' : '✦'}</span>`;
                return `
                    <button class="levelup-card ${typeClass}" type="button" data-levelup-index="${index}">
                        <div class="levelup-card-title">${this.escape(option.title)}</div>
                        <div class="levelup-icon">${icon}</div>
                        <div class="levelup-card-desc">${this.escape(option.desc)}</div>
                        ${option.levelText ? `<div class="levelup-card-level">${this.escape(option.levelText)}</div>` : ''}
                    </button>
                `;
            }).join('');
        }

        updateMainMenu(snapshot) {
            const main = snapshot.mainMenu || {};
            const key = JSON.stringify(main);
            if (key === this.lastMainKey) return;
            this.lastMainKey = key;
            this.setText('mainTitle', main.title || uiText('title', '千里走单骑'));
            this.setText('mainSubtitle', main.subtitle || '');
            const container = this.root.querySelector('[data-ui="mainWeaponPreview"]');
            if (!container) return;
            container.innerHTML = (main.weaponPreview || []).map(item => item.iconSrc
                ? `<img src="${this.escapeAttr(item.iconSrc)}" alt="">`
                : '<span></span>').join('');
        }

        renderPerkSegments(perk) {
            const total = Math.max(1, Number(perk.segmentCount) || 100);
            const filled = Math.max(0, Math.min(total, Number(perk.filledSegments) || 0));
            let html = '';
            for (let index = 0; index < total; index++) {
                html += `<span class="${index < filled ? 'is-filled' : ''}"></span>`;
            }
            return html;
        }

        updatePerkMenu(snapshot) {
            const perkMenu = snapshot.perkMenu || {};
            const key = JSON.stringify(perkMenu);
            if (key === this.lastPerkKey) return;
            this.lastPerkKey = key;
            this.setText('perkCurrency', `${perkMenu.totalResonance || 0}`);
            const container = this.root.querySelector('[data-ui="perkList"]');
            if (!container) return;
            container.innerHTML = (perkMenu.perks || []).map(perk => `
                <button class="perk-card ${perk.canAfford ? 'can-afford' : ''} ${perk.isMaxed ? 'is-maxed' : ''}" type="button" data-perk-index="${perk.index}" ${perk.isMaxed ? 'disabled' : ''}>
                    <div class="perk-card-main">
                        <div class="perk-name">${this.escape(perk.name)} <span>Lv.${this.escape(String(perk.level))}</span></div>
                        <div class="perk-desc">${this.escape(perk.description)}</div>
                        <div class="perk-progress-row">
                            <div class="perk-progress-grid" aria-label="${this.escapeAttr(`基因重塑进度 ${perk.level}/${perk.maxLevel || 100}`)}">
                                ${this.renderPerkSegments(perk)}
                            </div>
                            <div class="perk-progress-meta">
                                <b>${this.escape(perk.progressText || '0.0%')}</b>
                                <span>${this.escape(perk.segmentStepText || '每格 +0.1%')}</span>
                            </div>
                        </div>
                        ${perk.nextText ? `<div class="perk-next">${this.escape(perk.nextText)}</div>` : ''}
                    </div>
                    <div class="perk-cost">
                        <span>${this.escape(uiText('perkMenu.price', '价格'))}</span>
                        <b>${this.escape(String(perk.costText || perk.cost))}</b>
                    </div>
                </button>
            `).join('');
        }

        updateMenu(snapshot) {
            const result = snapshot.result || {};
            this.setText('menuTitle', result.title || '');
            this.setText('menuSubtitle', result.subtitle || '');
            this.setText('menuTime', result.time || '0:00');
            this.setText('menuLevel', `${result.level || 1}`);
            this.setText('menuRunResonance', `${result.runResonance || 0}`);
            this.setText('menuTotalResonance', `${result.totalResonance || 0}`);
            const kicker = snapshot.gameState === GAME_STATE.VICTORY ? uiText('systemMenu.kickerVictory', 'VICTORY')
                : snapshot.gameState === GAME_STATE.GAME_OVER ? uiText('systemMenu.kickerGameOver', 'GAME OVER')
                    : uiText('systemMenu.kickerPaused', 'PAUSED');
            this.setText('menuKicker', kicker);
            const resume = this.root.querySelector('[data-action="resume"]');
            if (resume) resume.hidden = snapshot.gameState !== GAME_STATE.PAUSED;
            const restart = this.root.querySelector('[data-action="restart"]');
            if (restart) restart.hidden = snapshot.gameState === GAME_STATE.VICTORY;
        }

        updateAudioSettings() {
            const audio = window.audioManager;
            if (!audio?.getSettings) return;
            const settings = audio.getSettings();
            const status = window.__AUDIO_STATUS__ || {};
            const values = {
                master: settings.masterVolume,
                sfx: settings.sfxVolume,
                music: settings.musicVolume,
                ui: settings.uiVolume,
                alert: settings.alertVolume,
            };
            for (const [name, value] of Object.entries(values)) {
                const slider = this.root.querySelector(`[data-audio-volume="${name}"]`);
                if (slider && document.activeElement !== slider) slider.value = String(value);
                const labelKey = `audio${name.charAt(0).toUpperCase()}${name.slice(1)}Value`;
                this.setText(labelKey, `${Math.round(value * 100)}%`);
            }
            this.setText('audioModeText', `${status.mode || 'synthetic'} · ${status.sounds || 0} sounds · ${status.active || 0} active`);
            const mute = this.root.querySelector('[data-action="muteAudio"]');
            if (mute) mute.textContent = settings.muted ? '取消静音' : uiText('audio.mute', '静音');
        }

        renderRows(target, rows, isSkill) {
            const container = this.root.querySelector(`[data-ui="${target}"]`);
            if (!container) return;
            if (!rows || rows.length === 0) {
                container.innerHTML = `<div class="status-empty">${isSkill ? '暂无已激活' : '暂无'}</div>`;
                return;
            }
            container.innerHTML = rows.map((row) => {
                const icon = row.iconSrc
                    ? `<img class="status-icon" src="${this.escapeAttr(row.iconSrc)}" alt="">`
                    : `<span class="status-icon"></span>`;
                return `
                    <div class="status-row ${isSkill && row.level <= 0 ? 'is-muted' : ''}">
                        ${icon}
                        <span class="status-name">${this.escape(row.name)}</span>
                        <span class="status-level">Lv.${this.escape(String(row.levelText ?? row.level))}</span>
                    </div>
                `;
            }).join('');
        }

        setText(key, value) {
            const node = this.root.querySelector(`[data-ui="${key}"]`);
            if (node && node.textContent !== value) node.textContent = value;
        }

        setMeter(key, pct) {
            const node = this.root.querySelector(`[data-ui="${key}"]`);
            if (!node) return;
            node.style.setProperty('--pct', `${Math.max(0, Math.min(100, Math.round(pct * 1000) / 10))}`);
        }

        escape(value) {
            return String(value ?? '').replace(/[&<>"']/g, (char) => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;',
            }[char]));
        }

        escapeAttr(value) {
            return this.escape(value).replace(/`/g, '&#96;');
        }
    }

    global.UIBridge = UIBridge;
})(window);
