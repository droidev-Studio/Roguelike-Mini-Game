(function () {
    class AssetRuntime {
        constructor() {
            this.ready = false;
            this.failed = false;
            this.manifest = null;
            this.basePath = 'assets/';
            this.cache = new Map();
            this.errors = [];
            this.loaded = 0;
            this.requested = 0;
            this.cacheBustToken = this.createCacheBustToken();
            window.__ASSET_STATUS__ = this.getStatus();
        }

        async initialize(manifestPath = 'assets/manifest.json') {
            try {
                const response = await fetch(this.getAssetRequestPath(manifestPath), { cache: 'no-store' });
                if (!response.ok) throw new Error(`manifest fetch failed: ${response.status}`);
                this.manifest = await response.json();
                this.basePath = this.manifest.basePath || 'assets/';
                this.ready = true;
            } catch (error) {
                this.failed = true;
                this.errors.push(String(error && error.message ? error.message : error));
            }
            this.publishStatus();
            return this.ready;
        }

        async preloadAll(plan = 'all') {
            if (!this.ready || !this.manifest) return { ok: false, total: 0, failed: 0 };
            const paths = this.collectRuntimeAssetPaths(plan);
            const results = await Promise.all(paths.map(path => this.loadImage(path)));
            const failed = results.filter(result => !result.ok).length;
            const summary = {
                plan,
                ok: failed === 0,
                total: results.length,
                loaded: results.length - failed,
                failed,
                errors: this.errors.slice(-10),
            };
            window.__ASSET_PRELOAD__ = summary;
            this.publishStatus();
            return summary;
        }

        preloadDeferred(plan = 'all') {
            return this.preloadAll(plan).then(summary => {
                window.__ASSET_DEFERRED_PRELOAD__ = summary;
                return summary;
            });
        }

        collectRuntimeAssetPaths(plan = 'all') {
            const paths = new Set();
            const collectEntry = (entry) => {
                if (!entry || typeof entry !== 'object') return;
                if (typeof entry.src === 'string') paths.add(this.basePath + entry.src);
                if (Array.isArray(entry.frames)) {
                    for (const frame of entry.frames) {
                        if (typeof frame === 'string') paths.add(this.basePath + frame);
                    }
                }
                if (Array.isArray(entry.variants)) {
                    for (const variant of entry.variants) {
                        const variantSrc = typeof variant === 'string' ? variant : variant?.src;
                        if (typeof variantSrc === 'string') paths.add(this.basePath + variantSrc);
                    }
                }
            };
            const visit = (value) => {
                if (!value || typeof value !== 'object') return;
                if (typeof value.src === 'string' || Array.isArray(value.frames)) {
                    collectEntry(value);
                    return;
                }
                for (const nested of Object.values(value)) {
                    visit(nested);
                }
            };

            const sections = plan === 'critical'
                ? [
                    ['weapons'],
                    ['weaponAttacks'],
                    ['skills'],
                    ['pickups'],
                    ['player'],
                    ['enemies'],
                    ['miniBosses'],
                    ['effects'],
                    ['ui'],
                    ['map'],
                    ['tiles'],
                    ['terrain'],
                ]
                : [
                    ['weapons'],
                    ['weaponAttacks'],
                    ['skills'],
                    ['pickups'],
                    ['player'],
                    ['enemies'],
                    ['bosses'],
                    ['miniBosses'],
                    ['effects'],
                    ['ui'],
                    ['map'],
                    ['tiles'],
                    ['terrain'],
                ];

            for (const [section] of sections) {
                visit(this.manifest?.[section]);
            }
            return Array.from(paths);
        }

        createCacheBustToken() {
            const params = new URLSearchParams(window.location.search);
            const explicit = params.get('assetBust');
            if (explicit) return explicit;
            const isLocalDev = ['127.0.0.1', 'localhost', '::1'].includes(window.location.hostname);
            return isLocalDev ? String(Date.now()) : '';
        }

        getAssetRequestPath(path) {
            if (!this.cacheBustToken || !path) return path;
            const joiner = path.includes('?') ? '&' : '?';
            return `${path}${joiner}assetBust=${encodeURIComponent(this.cacheBustToken)}`;
        }

        loadImage(path) {
            const requestPath = this.getAssetRequestPath(path);
            if (this.cache.has(requestPath)) {
                const cached = this.cache.get(requestPath);
                if (cached.complete) {
                    const ok = cached.naturalWidth > 0 && cached.naturalHeight > 0;
                    return Promise.resolve({ ok, path });
                }
                return new Promise(resolve => {
                    cached.addEventListener('load', () => resolve({ ok: true, path }), { once: true });
                    cached.addEventListener('error', () => resolve({ ok: false, path }), { once: true });
                });
            }

            const image = new Image();
            const done = (ok) => {
                if (ok) {
                    this.loaded++;
                } else {
                    image.dataset.assetFailed = '1';
                    this.errors.push(`image load failed: ${requestPath}`);
                }
                this.publishStatus();
                return { ok, path };
            };

            this.requested++;
            this.cache.set(requestPath, image);
            this.publishStatus();

            return new Promise(resolve => {
                image.onload = () => resolve(done(true));
                image.onerror = () => resolve(done(false));
                image.src = requestPath;
            });
        }

        getWeaponIcon(weaponId, level = 1) {
            const weapon = this.manifest?.weapons?.[weaponId];
            const safeLevel = Math.max(1, Math.min(6, level));
            const entry = weapon?.levels?.[String(safeLevel)] || weapon?.levels?.['1'];
            return this.resolveImage(entry?.src);
        }

        getWeaponAttackTexture(weaponId, level = 1, slot = 'primary') {
            const attacks = this.manifest?.weaponAttacks?.[weaponId];
            const requestedLevel = Number(level);
            const safeLevel = Number.isFinite(requestedLevel)
                ? Math.max(1, Math.min(6, Math.round(requestedLevel)))
                : 1;
            const levels = attacks?.levels || {};
            const entry =
                levels[String(safeLevel)]?.[slot] ||
                levels['1']?.[slot] ||
                levels[String(safeLevel)]?.primary ||
                levels['1']?.primary;
            return this.resolveImage(entry?.src);
        }

        getSkillIcon(skillId) {
            return this.resolveImage(this.manifest?.skills?.[skillId]?.src);
        }

        getPickupIcon(pickupId) {
            return this.resolveImage(this.manifest?.pickups?.[pickupId]?.src);
        }

        getEnemySprite(enemyId, state = 'idle', frameIndex = 0) {
            const states = this.manifest?.enemies?.[enemyId];
            const entry = states?.[state] || states?.idle;
            const frames = entry?.frames || [];
            const src = frames.length > 0 ? frames[Math.abs(frameIndex) % frames.length] : entry?.src;
            return this.resolveImage(src);
        }

        getPlayerSprite(playerId = 'guanyu', state = 'idle', frameIndex = 0) {
            const states = this.manifest?.player?.[playerId];
            const entry = states?.[state] || states?.idle;
            if (!entry) return null;
            const frames = entry.frames || [];
            const src = frames.length > 0 ? frames[Math.abs(frameIndex) % frames.length] : entry.src;
            return this.resolveImage(src);
        }

        getBossSprite(bossId, state = 'idle', frameIndex = 0) {
            const states = this.manifest?.bosses?.[bossId];
            const entry = states?.[state] || states?.idle;
            const frames = entry?.frames || [];
            const src = frames.length > 0 ? frames[Math.abs(frameIndex) % frames.length] : entry?.src;
            return this.resolveImage(src);
        }

        getBossWorldSize(bossId, state = 'idle') {
            const entry = this.manifest?.bosses?.[bossId]?.[state];
            const size = Number(entry?.worldSize);
            return Number.isFinite(size) && size > 0 ? size : null;
        }

        getMiniBossSprite(miniBossId, frameIndex = 0) {
            const entry = this.manifest?.miniBosses?.[miniBossId];
            const frames = entry?.frames || [];
            const src = frames.length > 0 ? frames[Math.abs(frameIndex) % frames.length] : entry?.src;
            return this.resolveImage(src);
        }

        getMiniBossWorldSize(miniBossId) {
            const entry = this.manifest?.miniBosses?.[miniBossId];
            const size = Number(entry?.worldSize);
            return Number.isFinite(size) && size > 0 ? size : null;
        }

        normalizeMapLevel(level) {
            if (level == null) return null;
            if (typeof level === 'string' && /^lv[1-5]$/i.test(level)) return level.toLowerCase();
            const numeric = Number(level);
            if (!Number.isFinite(numeric)) return null;
            return `lv${Math.max(1, Math.min(5, Math.round(numeric)))}`;
        }

        getTileEntry(tileId, level = null) {
            const mapMain = this.manifest?.map?.main || {};
            const levelId = this.normalizeMapLevel(level);
            return (
                mapMain[tileId] ||
                (levelId ? mapMain[levelId]?.[tileId] : null) ||
                (levelId ? mapMain[levelId] : null) ||
                this.manifest?.tiles?.[tileId]
            );
        }

        getTileTexture(tileId, level = null) {
            const entry = this.getTileEntry(tileId, level);
            return this.resolveImage(entry?.src);
        }

        getTileTextureVariants(tileId, level = null) {
            const entry = this.getTileEntry(tileId, level);
            if (!entry) return [];
            const variants = Array.isArray(entry.variants) ? entry.variants : [];
            const sources = variants
                .map(variant => typeof variant === 'string' ? variant : variant?.src)
                .filter(src => typeof src === 'string');
            if (sources.length === 0 && typeof entry.src === 'string') sources.push(entry.src);
            return sources.map(src => this.resolveImage(src)).filter(Boolean);
        }

        getMapAssetEntries(category, level = null) {
            const mapCategory = this.manifest?.map?.[category] || {};
            const levelId = this.normalizeMapLevel(level);
            if (levelId && mapCategory[levelId] && typeof mapCategory[levelId] === 'object') {
                return mapCategory[levelId];
            }
            return mapCategory;
        }

        getMapAssetKinds(category, level = null) {
            const entries = this.getMapAssetEntries(category, level);
            return Object.keys(entries || {}).filter(key => !/^lv[1-5]$/i.test(key) && key !== 'legacy');
        }

        getTerrainTexture(kind, category = null, level = null) {
            const map = this.manifest?.map || {};
            const terrain = this.manifest?.terrain || {};
            const levelId = this.normalizeMapLevel(level);
            const categoryBucket = category ? map[category] : null;
            const levelEntry = categoryBucket && levelId ? categoryBucket[levelId]?.[kind] : null;
            const categoryEntry = category ? categoryBucket?.[kind] : null;
            const entry =
                levelEntry ||
                categoryEntry ||
                (levelId ? map.obstacles?.[levelId]?.[kind] : null) ||
                (levelId ? map.environment?.[levelId]?.[kind] : null) ||
                (levelId ? map.randomEvents?.[levelId]?.[kind] : null) ||
                map.obstacles?.[kind] ||
                map.environment?.[kind] ||
                map.randomEvents?.[kind] ||
                terrain.blockers?.[kind] ||
                terrain.hazards?.[kind];
            return this.resolveImage(entry?.src);
        }

        getMapRandomEventTexture(eventId) {
            const entry = this.manifest?.map?.randomEvents?.[eventId];
            return this.resolveImage(entry?.src);
        }

        getEffectTexture(effectId, level = null) {
            const binding = this.manifest?.weaponAttacks?.bindings?.[effectId];
            if (binding) {
                const requestedLevel = level == null ? NaN : Number(level);
                const resolvedLevel = Number.isFinite(requestedLevel)
                    ? requestedLevel
                    : (binding.defaultLevel || 1);
                const image = this.getWeaponAttackTexture(binding.weapon, resolvedLevel, binding.slot || 'primary');
                if (image && image.dataset.assetFailed !== '1') return image;
            }
            const src = this.manifest?.effects?.[effectId]?.src;
            return this.resolveImage(src);
        }

        getUiSkin(uiId) {
            return this.resolveImage(this.manifest?.ui?.[uiId]?.src);
        }

        resolveImage(src) {
            if (!this.ready || !src) return null;
            const path = this.basePath + src;
            const requestPath = this.getAssetRequestPath(path);
            if (this.cache.has(requestPath)) return this.cache.get(requestPath);
            this.loadImage(path);
            return this.cache.get(requestPath) || null;
        }

        resolveImageWithFallback(src, fallbackSrc) {
            const image = this.resolveImage(src);
            if (image && image.dataset.assetFailed !== '1') return image;
            return this.resolveImage(fallbackSrc);
        }

        canDraw(image) {
            return !!image && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
        }

        drawImage(ctx, image, x, y, width, height) {
            if (!this.canDraw(image)) return false;
            ctx.drawImage(image, x, y, width, height);
            return true;
        }

        getStatus() {
            return {
                ready: this.ready,
                failed: this.failed,
                requested: this.requested,
                loaded: this.loaded,
                cached: this.cache.size,
                assetBust: this.cacheBustToken,
                errors: this.errors.slice(-10),
            };
        }

        publishStatus() {
            window.__ASSET_STATUS__ = this.getStatus();
        }
    }

    window.assetRuntime = new AssetRuntime();
})();
