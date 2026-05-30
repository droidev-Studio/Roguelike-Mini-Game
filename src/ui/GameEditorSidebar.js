const pngModules = import.meta.glob([
    '../../assets/ui-art/**/*.{png,svg,jpg,jpeg,webp}',
    '../../assets/Visual Style/**/*.{png,svg,jpg,jpeg,webp}',
    '../../assets/Game Art/**/*.{png,svg,jpg,jpeg,webp}',
    '../../assets/Audio & Feel/**/*.{png,svg,jpg,jpeg,webp}',
    '!../../assets/Visual Style/style-proofs/**',
    '!../../assets/_archive/**',
], {
    eager: true,
    query: '?url',
    import: 'default',
});

const MODE_TABS = [
    { id: 'stats', label: 'Stats' },
    { id: 'media', label: 'Media' },
];

const COMBAT_RULE_CONFIG = window.GAME_SETTINGS?.COMBAT_RULES || window.DEFAULT_GAME_SETTINGS?.COMBAT_RULES || {};
const COMBAT_RULE_STORAGE_KEY = COMBAT_RULE_CONFIG.STORAGE_KEY || 'zeroDowntimeCombatRuleSettings';
const COMBAT_RULE_DEFAULTS = {
    playerHealth: 100,
    playerIntensity: 'normal',
    gameHard: 'normal',
    drops: 'normal',
    level: 'normal',
    ...(COMBAT_RULE_CONFIG.DEFAULTS || {}),
};

const MEDIA_STRUCTURE = [
    {
        id: 'visual',
        label: 'Visual Style',
        categories: [
            { id: 'maps', label: 'Maps', sections: ['Map & Environment'], path: 'assets/Visual Style/map' },
            { id: 'player', label: 'Player', sections: ['Player Runtime'], path: 'assets/Visual Style/player/runtime' },
            { id: 'ui', label: 'UI', sections: ['UI Skins', 'UI Skin Library'], path: 'assets/ui-art' },
        ],
    },
    {
        id: 'art',
        label: 'Game Art',
        categories: [
            { id: 'icons', label: 'Icons', sections: ['Weapon Icons'], path: 'assets/Game Art/weapons/icons' },
            { id: 'weaponAttack', label: 'Weapon Attack', sections: ['Weapon Attack'], path: 'assets/Game Art/weapons/attacks/weapon_attack' },
            { id: 'weaponEffect', label: 'Weapon Effect', sections: ['Weapon Effect'], path: 'assets/Game Art/weapons/attacks/weapon_effect' },
            { id: 'enemies', label: 'Enemies', sections: ['Enemies'], path: 'assets/Game Art/enemies' },
            { id: 'bosses', label: 'Bosses', sections: ['Bosses'], path: 'assets/Game Art/bosses' },
            { id: 'minibosses', label: 'MiniBosses', sections: ['MiniBosses'], path: 'assets/Game Art/minibosses' },
            { id: 'skills', label: 'Skills', sections: ['Skill Icons'], path: 'assets/Game Art/skills' },
            { id: 'pickups', label: 'Pickups', sections: ['Pickup Icons'], path: 'assets/Game Art/pickups' },
            { id: 'props', label: 'Props', sections: ['Random Event Props'], path: 'assets/Game Art/map/random-events' },
        ],
    },
    {
        id: 'feel',
        label: 'Audio & Feel',
        categories: [
            { id: 'effects', label: 'Effects', sections: ['Effects'], path: 'assets/Audio & Feel/effects' },
            { id: 'audio', label: 'Audio', sections: ['Audio'], path: 'assets/Audio & Feel/audio', empty: true },
        ],
    },
];

const ASSET_BASE = 'assets/';
const CSS_UI_SKINS = new Set([
    'ui-art/asset_ui_menu_panel.png',
    'ui-art/asset_ui_button_frame.png',
    'ui-art/asset_ui_upgrade_card_frame.png',
    'ui-art/asset_ui_dialog_panel.png',
    'ui-art/asset_ui_hud_bar_frame.png',
    'ui-art/asset_ui_status_panel.png',
    'ui-art/asset_ui_warning_banner.png',
    'ui-art/asset_ui_pause_panel.png',
]);

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function fileName(src) {
    return String(src || '').split('/').pop() || '';
}

function normalizeAssetPath(path) {
    return String(path || '').replace(/\\/g, '/').replace(/^assets\//, '');
}

function getWeaponAssetSection(src) {
    const path = normalizeAssetPath(src);
    if (path.includes('/weapon_effect/')) return 'Weapon Effect';
    return 'Weapon Attack';
}

function fullAssetUrl(src) {
    const path = normalizeAssetPath(src);
    return `${ASSET_BASE}${path}`;
}

async function postAssetEditorAction(action, src) {
    const response = await fetch(`/__asset-editor__/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ src: normalizeAssetPath(src) }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || (result.ok === false && !result.cancelled)) {
        throw new Error(result.error || `Asset ${action} failed`);
    }
    return result;
}

function normalizeCombatRuleSettings(next = {}) {
    const enumValue = value => ['easy', 'normal', 'hard'].includes(value) ? value : 'normal';
    const health = Math.round(Number(next.playerHealth ?? COMBAT_RULE_DEFAULTS.playerHealth));
    return {
        playerHealth: Math.max(1, Math.min(1000, Number.isFinite(health) ? health : COMBAT_RULE_DEFAULTS.playerHealth)),
        playerIntensity: enumValue(next.playerIntensity),
        gameHard: enumValue(next.gameHard),
        drops: enumValue(next.drops),
        level: enumValue(next.level),
    };
}

function getCombatSettings() {
    if (typeof window.getCombatRuleSettings === 'function') return window.getCombatRuleSettings();
    try {
        return normalizeCombatRuleSettings({
            ...COMBAT_RULE_DEFAULTS,
            ...JSON.parse(localStorage.getItem(COMBAT_RULE_STORAGE_KEY) || '{}'),
        });
    } catch (error) {
        return { ...COMBAT_RULE_DEFAULTS };
    }
}

function applyCombatSettings(next) {
    if (typeof window.applyCombatRuleSettings === 'function') return window.applyCombatRuleSettings(next);
    const settings = normalizeCombatRuleSettings({ ...getCombatSettings(), ...next });
    localStorage.setItem(COMBAT_RULE_STORAGE_KEY, JSON.stringify(settings));
    return settings;
}

async function fetchJson(path) {
    const response = await fetch(path, { cache: 'no-store' });
    if (!response.ok) throw new Error(`${path} failed: ${response.status}`);
    return response.json();
}

function addAsset(list, refs, asset) {
    if (!asset?.src) return;
    const src = normalizeAssetPath(asset.src);
    refs.add(src);
    list.push({
        ...asset,
        src,
        file: fileName(src),
    });
}

function mergeTextValue(current, next) {
    const values = new Set(
        String(current || '')
            .split(', ')
            .map(value => value.trim())
            .filter(Boolean)
    );
    if (Array.isArray(next)) {
        next.forEach(value => values.add(String(value)));
    } else if (next) {
        values.add(String(next));
    }
    return Array.from(values).join(', ');
}

function mergeArrayValue(current, next) {
    const values = new Set(Array.isArray(current) ? current : []);
    if (Array.isArray(next)) {
        next.forEach(value => values.add(value));
    }
    return Array.from(values);
}

function consolidateAssetRows(items) {
    const rows = [];
    const byKey = new Map();
    for (const item of items) {
        const key = `${item.tab}|${item.section}|${item.src}`;
        const existing = byKey.get(key);
        if (!existing) {
            const clone = { ...item };
            byKey.set(key, clone);
            rows.push(clone);
            continue;
        }
        existing.id = mergeTextValue(existing.id, item.id);
        existing.role = mergeTextValue(existing.role, item.role);
        existing.binding = mergeTextValue(existing.binding, item.binding);
        existing.usage = mergeArrayValue(existing.usage, item.usage);
        existing.tags = mergeArrayValue(existing.tags, item.tags);
        if (!existing.worldSize && item.worldSize) existing.worldSize = item.worldSize;
        if (existing.status !== item.status) existing.status = `${existing.status}+${item.status}`;
    }
    return rows;
}

function collectManifestAssets(manifest) {
    const assets = [];
    const refs = new Set();

    for (const [weaponId, weapon] of Object.entries(manifest.weapons || {})) {
        for (const [level, entry] of Object.entries(weapon.levels || {})) {
            addAsset(assets, refs, {
                tab: 'art',
                section: 'Weapon Icons',
                id: weaponId,
                role: `Lv.${level} icon`,
                src: entry.src,
                binding: 'Upgrade cards, weapon status list, cooldown HUD',
                usage: entry.usage,
                status: 'bound',
            });
        }
    }

    for (const [weaponId, weapon] of Object.entries(manifest.weaponAttacks || {})) {
        if (weaponId === 'bindings') continue;
        for (const [level, slots] of Object.entries(weapon.levels || {})) {
            for (const [slot, entry] of Object.entries(slots || {})) {
                addAsset(assets, refs, {
                    tab: 'art',
                    section: getWeaponAssetSection(entry.src),
                    id: weaponId,
                    role: `Lv.${level} ${slot}`,
                    src: entry.src,
                    binding: 'Combat attack rendering',
                    tags: entry.tags,
                    status: 'bound',
                });
            }
        }
    }

    for (const [playerId, states] of Object.entries(manifest.player || {})) {
        for (const [state, entry] of Object.entries(states || {})) {
            for (const [index, frame] of (entry.frames || []).entries()) {
                addAsset(assets, refs, {
                    tab: 'visual',
                    section: 'Player Runtime',
                    id: playerId,
                    role: `${state} frame ${index + 1}`,
                    src: frame,
                    binding: 'Player sprite renderer',
                    worldSize: entry.worldSize,
                    status: 'bound',
                });
            }
            if (entry.src) {
                addAsset(assets, refs, {
                    tab: 'visual',
                    section: 'Player Runtime',
                    id: playerId,
                    role: state,
                    src: entry.src,
                    binding: 'Player sprite renderer',
                    worldSize: entry.worldSize,
                    status: 'bound',
                });
            }
        }
    }

    for (const sectionName of ['enemies', 'bosses']) {
        const label = sectionName === 'enemies' ? 'Enemies' : 'Bosses';
        for (const [entityId, states] of Object.entries(manifest[sectionName] || {})) {
            for (const [state, entry] of Object.entries(states || {})) {
                for (const [index, frame] of (entry.frames || []).entries()) {
                    addAsset(assets, refs, {
                        tab: 'art',
                        section: label,
                        id: entityId,
                        role: `${state} frame ${index + 1}`,
                        src: frame,
                        binding: `${label.slice(0, -1)} sprite renderer`,
                        worldSize: entry.worldSize,
                        status: 'bound',
                    });
                }
                if (entry.src) {
                    addAsset(assets, refs, {
                        tab: 'art',
                        section: label,
                        id: entityId,
                        role: state,
                        src: entry.src,
                        binding: `${label.slice(0, -1)} sprite renderer`,
                        worldSize: entry.worldSize,
                        status: 'bound',
                    });
                }
            }
        }
    }

    for (const [miniBossId, entry] of Object.entries(manifest.miniBosses || {})) {
        for (const [index, frame] of (entry.frames || []).entries()) {
            addAsset(assets, refs, {
                tab: 'art',
                section: 'MiniBosses',
                id: miniBossId,
                role: `frame ${index + 1}`,
                src: frame,
                binding: 'Minute mini-boss renderer',
                worldSize: entry.worldSize,
                status: 'bound',
            });
        }
        if (entry.src) {
            addAsset(assets, refs, {
                tab: 'art',
                section: 'MiniBosses',
                id: miniBossId,
                role: 'idle',
                src: entry.src,
                binding: 'Minute mini-boss renderer',
                worldSize: entry.worldSize,
                status: 'bound',
            });
        }
    }

    for (const [skillId, entry] of Object.entries(manifest.skills || {})) {
        addAsset(assets, refs, {
            tab: 'art',
            section: 'Skill Icons',
            id: skillId,
            role: 'passive icon',
            src: entry.src,
            binding: 'Upgrade cards and passive status list',
            usage: entry.usage,
            status: 'bound',
        });
    }

    for (const [pickupId, entry] of Object.entries(manifest.pickups || {})) {
        addAsset(assets, refs, {
            tab: 'art',
            section: 'Pickup Icons',
            id: pickupId,
            role: 'world pickup',
            src: entry.src,
            binding: 'Pickup world renderer',
            usage: entry.usage,
            status: 'bound',
        });
    }

    for (const [effectId, entry] of Object.entries(manifest.effects || {})) {
        const binding = manifest.weaponAttacks?.bindings?.[effectId];
        addAsset(assets, refs, {
            tab: 'feel',
            section: 'Effects',
            id: effectId,
            role: binding ? 'fallback texture' : 'effect texture',
            src: entry.src,
            binding: binding
                ? `Fallback; effective texture is ${binding.weapon} Lv.${binding.defaultLevel || 1} ${binding.slot || 'primary'}`
                : 'drawArtEffectTexture',
            usage: entry.usage,
            status: binding ? 'fallback' : 'bound',
        });
    }

    for (const [uiId, entry] of Object.entries(manifest.ui || {})) {
        addAsset(assets, refs, {
            tab: 'visual',
            section: 'UI Skins',
            id: uiId,
            role: CSS_UI_SKINS.has(entry.src) ? 'Canvas + DOM skin' : 'Canvas skin',
            src: entry.src,
            binding: CSS_UI_SKINS.has(entry.src)
                ? 'Canvas drawArtUiTexture and src/ui/game-ui.css'
                : 'Canvas drawArtUiTexture',
            usage: entry.usage,
            status: 'bound',
        });
    }

    collectMapAssets(assets, refs, {
        main: manifest.map?.main,
        obstacles: manifest.map?.obstacles,
        environment: manifest.map?.environment,
    }, 'Map & Environment');
    collectMapAssets(assets, refs, manifest.map?.randomEvents || {}, 'Random Event Props', [], 'art');
    collectMapAssets(assets, refs, manifest.tiles || {}, 'Map & Environment');
    collectMapAssets(assets, refs, manifest.terrain || {}, 'Map & Environment');

    return { assets: consolidateAssetRows(assets), refs };
}

function collectMapAssets(assets, refs, object, section, trail = [], tab = 'visual') {
    for (const [key, value] of Object.entries(object || {})) {
        if (!value || typeof value !== 'object') continue;
        const id = [...trail, key].join('/');
        const hasAsset = value.src || value.frames || value.variants;
        if (hasAsset) {
            if (value.src) {
                addAsset(assets, refs, {
                    tab,
                    section,
                    id,
                    role: 'src',
                    src: value.src,
                    binding: 'Map tile, obstacle, or terrain renderer',
                    usage: value.usage,
                    status: 'bound',
                });
            }
            for (const [index, variant] of (value.variants || []).entries()) {
                addAsset(assets, refs, {
                    tab,
                    section,
                    id,
                    role: `variant ${index + 1}`,
                    src: typeof variant === 'string' ? variant : variant.src,
                    binding: 'Tile variant renderer',
                    usage: value.usage,
                    status: 'bound',
                });
            }
            for (const [index, frame] of (value.frames || []).entries()) {
                addAsset(assets, refs, {
                    tab,
                    section,
                    id,
                    role: `frame ${index + 1}`,
                    src: frame,
                    binding: 'Map animated asset',
                    usage: value.usage,
                    status: 'bound',
                });
            }
        } else {
            collectMapAssets(assets, refs, value, section, [...trail, key], tab);
        }
    }
}

function classifyUnboundAsset(src) {
    const path = normalizeAssetPath(src);
    const logical = path
        .replace(/^Visual Style\//, '')
        .replace(/^ui-art\//, 'ui/')
        .replace(/^Game Art\//, '')
        .replace(/^Audio & Feel\//, '');
    if (
        path.startsWith('_archive/') ||
        path.startsWith('Visual Style/style-proofs/') ||
        logical.startsWith('style-proofs/')
    ) {
        return null;
    }
    if (logical.startsWith('weapons/attacks/weapon_attack/')) {
        return {
            tab: 'art',
            section: 'Weapon Attack',
            role: 'unbound weapon body candidate',
            binding: 'Not referenced by manifest; likely alternate weapon, projectile, or blade body',
        };
    }
    if (logical.startsWith('weapons/attacks/weapon_effect/')) {
        return {
            tab: 'art',
            section: 'Weapon Effect',
            role: 'unbound weapon effect candidate',
            binding: 'Not referenced by manifest; likely alternate slash, pulse, trail, or magic effect',
        };
    }
    if (logical.startsWith('weapons/icons/')) {
        return {
            tab: 'art',
            section: 'Weapon Icons',
            role: 'legacy/duplicate candidate',
            binding: 'Not referenced by manifest; compare against weapons/icons before reuse',
        };
    }
    if (logical.startsWith('weapons/')) {
        return null;
    }
    if (logical.startsWith('player/')) {
        if (!logical.startsWith('player/runtime/')) return null;
        return {
            tab: 'visual',
            section: 'Player Runtime',
            role: 'legacy/source candidate',
            binding: 'Player style library; not the current manifest binding',
        };
    }
    if (path.startsWith('Game Art/map/random-events/')) {
        return {
            tab: 'art',
            section: 'Random Event Props',
            role: 'unbound event prop candidate',
            binding: 'Random event art library; not referenced by manifest',
        };
    }
    if (logical.startsWith('map/')) {
        return {
            tab: 'visual',
            section: 'Map & Environment',
            role: 'map style library',
            binding: 'Map/background library; not the current manifest binding',
        };
    }
    if (logical.startsWith('ui/')) {
        return {
            tab: 'visual',
            section: 'UI Skin Library',
            role: 'unbound UI skin',
            binding: 'UI library; not currently used by AssetRuntime',
        };
    }
    if (logical.startsWith('effects/')) {
        return {
            tab: 'feel',
            section: 'Effects',
            role: 'unbound effect candidate',
            binding: 'Feedback/effect library; not referenced by manifest',
        };
    }
    if (logical.startsWith('enemies/')) {
        return {
            tab: 'art',
            section: 'Enemies',
            role: 'unbound enemy candidate',
            binding: 'Enemy art library; not referenced by manifest',
        };
    }
    if (logical.startsWith('bosses/')) {
        return {
            tab: 'art',
            section: 'Bosses',
            role: 'unbound boss candidate',
            binding: 'Boss art library; not referenced by manifest',
        };
    }
    if (logical.startsWith('minibosses/')) {
        return {
            tab: 'art',
            section: 'MiniBosses',
            role: 'unbound mini-boss candidate',
            binding: 'Mini-boss art library; not referenced by manifest',
        };
    }
    if (logical.startsWith('skills/') || logical.startsWith('pickups/')) {
        const isSkill = logical.startsWith('skills/');
        return {
            tab: 'art',
            section: isSkill ? 'Skill Icons' : 'Pickup Icons',
            role: 'unbound item candidate',
            binding: 'Item/icon library; not referenced by manifest',
        };
    }
    return {
        tab: 'art',
        section: 'Unclassified Asset Candidates',
        role: 'unbound candidate',
        binding: 'Asset library only; not currently used by AssetRuntime',
    };
}

function collectUnboundAssets(refs) {
    const all = Object.keys(pngModules)
        .map(path => path.replace(/\\/g, '/').replace(/^(\.\.\/)+assets\//, ''))
        .sort((a, b) => a.localeCompare(b));
    return all
        .filter(src => !refs.has(src))
        .map(src => {
            const classification = classifyUnboundAsset(src);
            if (!classification) return null;
            return {
                ...classification,
                id: src.split('/')[0],
                src,
                status: 'unbound',
                file: fileName(src),
            };
        })
        .filter(Boolean);
}

function summarizeAssetsBy(items, key) {
    return Array.from(groupBy(items, key).entries())
        .map(([title, groupItems]) => ({ title, count: groupItems.length }))
        .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));
}

function renderSummaryList(title, items, emptyText = 'None') {
    const rows = items.length
        ? items.map(item => ruleCard(item.title, `${item.count} items`)).join('')
        : ruleCard(emptyText, '0 items');
    return `
        <section class="editor-group">
            <header class="editor-group-header">
                <div class="editor-group-title">${escapeHtml(title)}</div>
                <div class="editor-group-count">${items.length} groups</div>
            </header>
            <div class="rules-table">${rows}</div>
        </section>
    `;
}

function groupBy(items, key) {
    return items.reduce((map, item) => {
        const group = item[key] || 'Other';
        if (!map.has(group)) map.set(group, []);
        map.get(group).push(item);
        return map;
    }, new Map());
}

function shortAssetName(asset) {
    const raw = asset.id && asset.id !== 'Visual Style' && asset.id !== 'Game Art' && asset.id !== 'Audio & Feel'
        ? asset.id
        : fileName(asset.src).replace(/\.[^.]+$/, '');
    return String(raw || fileName(asset.src)).replace(/^asset_/, '');
}

function renderAssetTile(asset) {
    return `
        <article class="media-thumb-card" title="${escapeHtml(asset.src)}">
            <button class="media-thumb-replace" type="button" data-asset-replace="${escapeHtml(asset.src)}" aria-label="Replace ${escapeHtml(shortAssetName(asset))}">
                <img class="media-thumb-image" src="${escapeHtml(fullAssetUrl(asset.src))}" alt="">
            </button>
            <div class="media-thumb-label">${escapeHtml(shortAssetName(asset))}</div>
            <button class="media-thumb-menu" type="button" data-asset-show="${escapeHtml(asset.src)}" aria-label="Show asset in folder">&#8942;</button>
        </article>
    `;
}

function mediaCategoryKey(section, category) {
    return `${section.id}:${category.id}`;
}

function mediaCategoryRows(category, items) {
    if (category.empty) return [];
    return items.filter(item => category.sections.includes(item.section));
}

function findMediaCategory(key) {
    for (const section of MEDIA_STRUCTURE) {
        const category = section.categories.find(item => mediaCategoryKey(section, item) === key);
        if (category) return { section, category };
    }
    return null;
}

function renderMediaCategory(section, category, items) {
    const rows = mediaCategoryRows(category, items);
    const count = category.empty ? 0 : rows.length;
    const key = mediaCategoryKey(section, category);
    return `
        <article class="media-category ${category.empty ? 'is-empty' : ''}" data-media-card="${escapeHtml(key)}">
            <button class="media-category-head" type="button">
                <span class="media-category-title">${escapeHtml(category.label)}</span>
                <span class="media-category-path">${escapeHtml(category.path)}</span>
                <span class="media-category-count">${count}</span>
            </button>
        </article>
    `;
}

function renderMediaSection(section, items) {
    const count = section.categories.reduce((sum, category) => {
        if (category.empty) return sum;
        return sum + mediaCategoryRows(category, items).length;
    }, 0);
    return `
        <section class="media-section">
            <header class="media-section-header">
                <div class="media-section-title">${escapeHtml(section.label)}</div>
                <div class="media-section-count">${count}</div>
            </header>
            <div class="media-category-list">
                ${section.categories.map(category => renderMediaCategory(section, category, items)).join('')}
            </div>
        </section>
    `;
}

function renderMediaIndex(items) {
    return `
        <div class="editor-media">
            ${MEDIA_STRUCTURE.map(section => renderMediaSection(section, items)).join('')}
        </div>
    `;
}

function renderMediaDetail(state, selected) {
    const rows = [...state.assets, ...state.unboundAssets];
    const categoryRows = mediaCategoryRows(selected.category, rows);
    const count = selected.category.empty ? 0 : categoryRows.length;
    const collapsed = Boolean(state.mediaImagesCollapsed);
    return `
        <div class="editor-media media-detail-view">
            <section class="media-detail ${collapsed ? 'is-collapsed' : ''}">
                <header class="media-detail-header">
                    <button class="media-back-button" type="button" data-media-back>Back</button>
                    <div class="media-detail-heading">
                        <div class="media-detail-kicker">${escapeHtml(selected.section.label)}</div>
                        <h2>${escapeHtml(selected.category.label)}</h2>
                        <div class="media-detail-path">${escapeHtml(selected.category.path)}</div>
                    </div>
                    <div class="media-detail-actions">
                        <button class="media-collapse-button" type="button" data-media-collapse>${collapsed ? 'Expand' : 'Collapse'}</button>
                        <div class="media-detail-count">${count}</div>
                    </div>
                </header>
                ${collapsed
                    ? `<button class="media-collapsed-strip" type="button" data-media-collapse>${count} images collapsed</button>`
                    : `<div class="media-grid">
                        ${categoryRows.length ? categoryRows.map(renderAssetTile).join('') : `<div class="media-empty">Empty slot</div>`}
                    </div>`
                }
            </section>
        </div>
    `;
}

function renderMedia(state) {
    const rows = [...state.assets, ...state.unboundAssets];
    const selected = findMediaCategory(state.selectedMediaKey);
    return selected ? renderMediaDetail(state, selected) : renderMediaIndex(rows);
}

function renderSegmentedControl(id, value) {
    return `
        <div class="stats-segment" role="group" aria-label="${escapeHtml(id)}">
            ${['easy', 'normal', 'hard'].map(option => `
                <button class="stats-choice ${value === option ? 'is-active' : ''}" type="button" data-setting="${escapeHtml(id)}" data-choice="${option}">
                    ${escapeHtml(option[0].toUpperCase() + option.slice(1))}
                </button>
            `).join('')}
        </div>
    `;
}

function renderStats(state) {
    const settings = normalizeCombatRuleSettings(state.combatSettings || getCombatSettings());
    return `
        <div class="stats-panel">
            <section class="stats-card">
                <header class="stats-card-header">
                    <h2>Game Settings</h2>
                    <button class="stats-reset" type="button" data-reset-combat>Reset to Normal</button>
                </header>
                <div class="stats-control">
                    <label for="playerHealthControl">Player Health</label>
                    <div class="stats-slider-row">
                        <input id="playerHealthControl" class="stats-slider" type="range" min="1" max="1000" step="1" value="${settings.playerHealth}" data-setting="playerHealth">
                        <input class="stats-number" type="number" min="1" max="1000" step="1" value="${settings.playerHealth}" data-setting="playerHealthNumber" aria-label="Player Health value">
                    </div>
                </div>
                <div class="stats-control">
                    <label>Player Intensity</label>
                    ${renderSegmentedControl('playerIntensity', settings.playerIntensity)}
                </div>
                <div class="stats-control">
                    <label>Difficulty Setting</label>
                    ${renderSegmentedControl('gameHard', settings.gameHard)}
                </div>
                <div class="stats-control">
                    <label>Drops Rate</label>
                    ${renderSegmentedControl('drops', settings.drops)}
                </div>
                <div class="stats-control">
                    <label>Experience</label>
                    ${renderSegmentedControl('level', settings.level)}
                </div>
            </section>
        </div>
    `;
}

function ruleCard(title, meta) {
    return `
        <article class="rule-card">
            <div class="rule-title">${escapeHtml(title)}</div>
            <div class="rule-meta">${escapeHtml(meta)}</div>
        </article>
    `;
}

function renderRules(specs) {
    const weapons = Object.values(specs.weapons || {}).map(weapon => ruleCard(
        `${weapon.name || weapon.id} (${weapon.id})`,
        `damage ${weapon.damage}; cooldown ${weapon.attackInterval}s; range ${weapon.range}; levels ${(weapon.levels || []).length}; effects ${(weapon.effects || []).map(e => e.type).join(', ') || 'none'}`
    )).join('');
    const enemies = Object.entries(specs.enemies || {}).map(([id, enemy]) => ruleCard(
        `${enemy.name || id} (${id})`,
        `hp ${enemy.hp}; speed ${enemy.speed}; size ${enemy.size}; damage ${enemy.damage}; exp ${enemy.exp}; flags ${(enemy.flags || []).join(', ') || 'none'}`
    )).join('');
    const stages = (specs.waves?.stages || []).map((stage, index) => ruleCard(
        `${index + 1}. ${stage.name} / ${stage.boss}`,
        `spawn ${stage.minSpawnCount}-${stage.maxSpawnCount}; interval ${stage.spawnInterval}s; bossHp ${stage.bossHp}; bossSpeed ${stage.bossSpeed}; ability ${stage.bossAbility}`
    )).join('');
    const balance = specs.balance ? [
        ruleCard('Player', `hp ${specs.balance.player?.hp}; speed ${specs.balance.player?.speed}; size ${specs.balance.player?.size}; magnet ${specs.balance.player?.magnetRadius}; rerolls ${specs.balance.player?.rerolls}`),
        ruleCard('Drops', `expChance ${specs.balance.drops?.expChance}; resonanceChance ${specs.balance.drops?.resonanceChance}; maxExpPickups ${specs.balance.drops?.maxExpPickups}`),
        ruleCard('Combat', Object.entries(specs.balance.combat || {}).map(([k, v]) => `${k}: ${v}`).join('; ')),
        ruleCard('Spawn', Object.entries(specs.balance.spawn || {}).map(([k, v]) => `${k}: ${v}`).join('; ')),
    ].join('') : '';

    return `
        <div class="editor-section">
            <section class="editor-group">
                <header class="editor-group-header"><div class="editor-group-title">Weapons</div><div class="editor-group-count">${Object.keys(specs.weapons || {}).length} rules</div></header>
                <div class="rules-table">${weapons}</div>
            </section>
            <section class="editor-group">
                <header class="editor-group-header"><div class="editor-group-title">Enemies</div><div class="editor-group-count">${Object.keys(specs.enemies || {}).length} rules</div></header>
                <div class="rules-table">${enemies}</div>
            </section>
            <section class="editor-group">
                <header class="editor-group-header"><div class="editor-group-title">Waves</div><div class="editor-group-count">${specs.waves?.stages?.length || 0} stages</div></header>
                <div class="rules-table">${stages}</div>
            </section>
            <section class="editor-group">
                <header class="editor-group-header"><div class="editor-group-title">Balance</div><div class="editor-group-count">read-only</div></header>
                <div class="rules-table">${balance}</div>
            </section>
        </div>
    `;
}

function renderRuntime(manifest, assets, unboundAssets, specs) {
    const status = window.__ASSET_STATUS__ || {};
    const manifestSummary = summarizeAssetsBy(assets, 'section');
    const unboundSummary = summarizeAssetsBy(unboundAssets, 'section');
    return `
        <div class="editor-section">
            <div class="editor-summary-grid">
                <div class="editor-stat"><b>${escapeHtml(manifest.version || '-')}</b><span>manifest version</span></div>
                <div class="editor-stat"><b>${escapeHtml(manifest.basePath || 'assets/')}</b><span>base path</span></div>
                <div class="editor-stat"><b>${assets.length}</b><span>manifest asset rows</span></div>
                <div class="editor-stat"><b>${unboundAssets.length}</b><span>unbound PNGs</span></div>
                <div class="editor-stat"><b>${status.ready ? 'ready' : 'loading'}</b><span>asset runtime</span></div>
                <div class="editor-stat"><b>${Object.keys(specs).length}</b><span>spec files loaded</span></div>
            </div>
            ${renderSummaryList('Manifest Binding Summary', manifestSummary)}
            ${renderSummaryList('Unbound PNG Summary', unboundSummary)}
        </div>
    `;
}

function renderMode(state) {
    return state.mode === 'media' ? renderMedia(state) : renderStats(state);
}

function renderShell(root, state) {
    root.innerHTML = `
        <div class="editor-panel">
            <nav class="editor-mode-tabs" aria-label="Editor modes">
                ${MODE_TABS.map(tab => `
                    <button class="editor-mode-tab ${state.mode === tab.id ? 'is-active' : ''}" type="button" data-editor-mode="${tab.id}">
                        ${escapeHtml(tab.label)}
                    </button>
                `).join('')}
            </nav>
            <div class="editor-content" data-editor-content>
                ${renderMode(state)}
            </div>
        </div>
    `;
    root.addEventListener('click', async event => {
        const modeButton = event.target.closest('[data-editor-mode]');
        const choiceButton = event.target.closest('[data-choice]');
        const resetButton = event.target.closest('[data-reset-combat]');
        const replaceButton = event.target.closest('[data-asset-replace]');
        const showButton = event.target.closest('[data-asset-show]');
        const mediaButton = event.target.closest('[data-media-card] .media-category-head');
        const mediaBackButton = event.target.closest('[data-media-back]');
        const mediaCollapseButton = event.target.closest('[data-media-collapse]');
        const content = root.querySelector('[data-editor-content]');
        if (replaceButton) {
            const card = replaceButton.closest('.media-thumb-card');
            const image = replaceButton.querySelector('img');
            const src = replaceButton.dataset.assetReplace;
            card?.classList.add('is-replacing');
            try {
                const result = await postAssetEditorAction('replace', src);
                if (result.cancelled) return;
                if (image) image.src = `${fullAssetUrl(src)}?replaced=${Date.now()}`;
                card?.classList.add('is-replaced');
                card?.setAttribute('title', `${src}\nReplaced. Backup: ${result.backup || '-'}`);
            } catch (error) {
                window.alert(error.message || String(error));
            } finally {
                card?.classList.remove('is-replacing');
            }
            return;
        }
        if (showButton) {
            try {
                await postAssetEditorAction('show', showButton.dataset.assetShow);
            } catch (error) {
                window.alert(error.message || String(error));
            }
            return;
        }
        if (modeButton) {
            state.mode = modeButton.dataset.editorMode;
            root.querySelectorAll('[data-editor-mode]').forEach(tab => {
                tab.classList.toggle('is-active', tab === modeButton);
            });
            if (content) {
                content.scrollTop = 0;
                content.innerHTML = renderMode(state);
            }
            return;
        }
        if (choiceButton) {
            state.combatSettings = applyCombatSettings({
                [choiceButton.dataset.setting]: choiceButton.dataset.choice,
            });
            if (content) content.innerHTML = renderMode(state);
            return;
        }
        if (resetButton) {
            state.combatSettings = applyCombatSettings(COMBAT_RULE_DEFAULTS);
            if (content) content.innerHTML = renderMode(state);
            return;
        }
        if (mediaBackButton) {
            state.selectedMediaKey = '';
            state.mediaImagesCollapsed = false;
            if (content) {
                content.scrollTop = 0;
                content.innerHTML = renderMode(state);
            }
            return;
        }
        if (mediaCollapseButton) {
            state.mediaImagesCollapsed = !state.mediaImagesCollapsed;
            if (content) content.innerHTML = renderMode(state);
            return;
        }
        if (mediaButton) {
            const card = mediaButton.closest('[data-media-card]');
            state.selectedMediaKey = card.dataset.mediaCard;
            state.mediaImagesCollapsed = false;
            if (content) {
                content.scrollTop = 0;
                content.innerHTML = renderMode(state);
            }
        }
    });
    root.addEventListener('input', event => {
        const input = event.target.closest('[data-setting="playerHealth"], [data-setting="playerHealthNumber"]');
        if (!input) return;
        const value = Math.max(1, Math.min(1000, Math.round(Number(input.value) || COMBAT_RULE_DEFAULTS.playerHealth)));
        state.combatSettings = applyCombatSettings({ playerHealth: value });
        const slider = root.querySelector('[data-setting="playerHealth"]');
        const number = root.querySelector('[data-setting="playerHealthNumber"]');
        if (slider && slider !== input) slider.value = value;
        if (number && number !== input) number.value = value;
    });
}

function initMobileSidebarToggle(root) {
    const shell = document.getElementById('gameEditorShell');
    const toggle = document.getElementById('gameEditorToggle');
    if (!shell || !toggle) return;

    const setOpen = open => {
        shell.classList.toggle('editor-sidebar-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? '隐藏编辑栏' : '显示编辑栏');
        toggle.textContent = open ? '隐藏' : '编辑';
    };

    setOpen(false);
    toggle.addEventListener('click', () => {
        setOpen(!shell.classList.contains('editor-sidebar-open'));
    });

    document.addEventListener('keydown', event => {
        if (event.key === 'Escape' && shell.classList.contains('editor-sidebar-open')) {
            setOpen(false);
        }
    });

    document.addEventListener('pointerdown', event => {
        if (!shell.classList.contains('editor-sidebar-open')) return;
        if (window.matchMedia('(min-width: 921px)').matches) return;
        if (root.contains(event.target) || toggle.contains(event.target)) return;
        setOpen(false);
    });
}

async function initGameEditorSidebar() {
    const root = document.getElementById('gameEditorSidebar');
    if (!root) return;
    initMobileSidebarToggle(root);
    try {
        const manifest = await fetchJson('assets/manifest.json');
        const { assets, refs } = collectManifestAssets(manifest);
        const unboundAssets = collectUnboundAssets(refs);
        renderShell(root, {
            manifest,
            assets,
            unboundAssets,
            mode: 'stats',
            selectedMediaKey: '',
            mediaImagesCollapsed: false,
            combatSettings: getCombatSettings(),
        });
    } catch (error) {
        root.innerHTML = `<div class="editor-error">Editor data failed to load: ${escapeHtml(error.message || error)}</div>`;
    }
}

initGameEditorSidebar();
