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
            const entry = this.getWeaponIconEntry(weaponId, level);
            return this.resolveImage(entry?.src);
        }

        getWeaponIconEntry(weaponId, level = 1) {
            const weapon = this.manifest?.weapons?.[weaponId];
            const safeLevel = Math.max(1, Math.min(6, Number(level) || 1));
            return weapon?.levels?.[String(safeLevel)] || weapon?.levels?.['1'] || null;
        }

        getWeaponAttackTexture(weaponId, level = 1, slot = 'primary') {
            const entry = this.getWeaponAttackEntry(weaponId, level, slot);
            return this.resolveImage(entry?.src);
        }

        getWeaponAttackEntry(weaponId, level = 1, slot = 'primary') {
            const attacks = this.manifest?.weaponAttacks?.[weaponId];
            const requestedLevel = Number(level);
            const safeLevel = Number.isFinite(requestedLevel)
                ? Math.max(1, Math.min(6, Math.round(requestedLevel)))
                : 1;
            const levels = attacks?.levels || {};
            const levelSlots = levels[String(safeLevel)] || {};
            const levelOneSlots = levels['1'] || {};
            return (
                levelSlots[slot] ||
                levelOneSlots[slot] ||
                levelSlots.primary ||
                levelOneSlots.primary ||
                (slot === 'primary' ? (levelSlots.fx || levelOneSlots.fx || levelSlots.body || levelOneSlots.body) : null) ||
                null
            );
        }

        getWeaponBodyEntry(weaponId, level = 1) {
            return this.getWeaponAttackEntry(weaponId, level, 'body');
        }

        getWeaponBodyTexture(weaponId, level = 1) {
            return this.resolveImage(this.getWeaponBodyEntry(weaponId, level)?.src);
        }

        getWeaponFxEntry(weaponId, level = 1) {
            return this.getWeaponAttackEntry(weaponId, level, 'fx');
        }

        getWeaponFxTexture(weaponId, level = 1) {
            return this.resolveImage(this.getWeaponFxEntry(weaponId, level)?.src);
        }

        getSkillIcon(skillId) {
            return this.resolveImage(this.manifest?.skills?.[skillId]?.src);
        }

        getPickupIcon(pickupId) {
            return this.resolveImage(this.manifest?.pickups?.[pickupId]?.src);
        }

        getPickupEntry(pickupId) {
            return this.manifest?.pickups?.[pickupId] || null;
        }

        getEnemySprite(enemyId, state = 'idle', frameIndex = 0) {
            const states = this.manifest?.enemies?.[enemyId];
            const entry = states?.[state] || states?.idle;
            const frames = entry?.frames || [];
            const src = frames.length > 0 ? frames[Math.abs(frameIndex) % frames.length] : entry?.src;
            return this.resolveImage(src);
        }

        getEnemyEntry(enemyId, state = 'idle') {
            const states = this.manifest?.enemies?.[enemyId];
            return states?.[state] || states?.idle || null;
        }

        getPlayerSprite(playerId = 'guanyu', state = 'idle', frameIndex = 0) {
            const states = this.manifest?.player?.[playerId];
            const entry = states?.[state] || states?.idle;
            if (!entry) return null;
            const frames = entry.frames || [];
            const src = frames.length > 0 ? frames[Math.abs(frameIndex) % frames.length] : entry.src;
            return this.resolveImage(src);
        }

        getPlayerEntry(playerId = 'guanyu', state = 'idle') {
            const states = this.manifest?.player?.[playerId];
            return states?.[state] || states?.idle || null;
        }

        getBossSprite(bossId, state = 'idle', frameIndex = 0) {
            const states = this.manifest?.bosses?.[bossId];
            const entry = states?.[state] || states?.idle;
            const frames = entry?.frames || [];
            const src = frames.length > 0 ? frames[Math.abs(frameIndex) % frames.length] : entry?.src;
            return this.resolveImage(src);
        }

        getBossEntry(bossId, state = 'idle') {
            const states = this.manifest?.bosses?.[bossId];
            return states?.[state] || states?.idle || null;
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

        getMiniBossEntry(miniBossId) {
            return this.manifest?.miniBosses?.[miniBossId] || null;
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

        getMapKitEntries(kind = 'decals', biome = null) {
            const kit = this.manifest?.map?.kit?.[kind];
            if (!kit || typeof kit !== 'object') return [];
            const bucket = biome && kit[biome] && typeof kit[biome] === 'object' ? kit[biome] : kit;
            const entries = [];
            const visit = (value) => {
                if (!value || typeof value !== 'object') return;
                if (typeof value.src === 'string') {
                    entries.push(value);
                    return;
                }
                for (const nested of Object.values(value)) visit(nested);
            };
            visit(bucket);
            return entries;
        }

        getMapKitTexture(entry) {
            return this.resolveImage(entry?.src);
        }

        getTerrainTexture(kind, category = null, level = null) {
            const entry = this.getTerrainEntry(kind, category, level);
            return this.resolveImage(entry?.src);
        }

        getTerrainEntry(kind, category = null, level = null) {
            const map = this.manifest?.map || {};
            const terrain = this.manifest?.terrain || {};
            const levelId = this.normalizeMapLevel(level);
            const categoryBucket = category ? map[category] : null;
            const levelEntry = categoryBucket && levelId ? categoryBucket[levelId]?.[kind] : null;
            const categoryEntry = category ? categoryBucket?.[kind] : null;
            return (
                levelEntry ||
                categoryEntry ||
                (levelId ? map.obstacles?.[levelId]?.[kind] : null) ||
                (levelId ? map.environment?.[levelId]?.[kind] : null) ||
                (levelId ? map.randomEvents?.[levelId]?.[kind] : null) ||
                map.obstacles?.[kind] ||
                map.environment?.[kind] ||
                map.randomEvents?.[kind] ||
                terrain.blockers?.[kind] ||
                terrain.hazards?.[kind] ||
                null
            );
        }

        getMapRandomEventTexture(eventId) {
            const entry = this.manifest?.map?.randomEvents?.[eventId];
            return this.resolveImage(entry?.src);
        }

        getEffectTexture(effectId, level = null) {
            const entry = this.getEffectEntry(effectId, level);
            return this.resolveImage(entry?.src);
        }

        getEffectEntry(effectId, level = null) {
            const binding = this.manifest?.weaponAttacks?.bindings?.[effectId];
            if (binding) {
                const requestedLevel = level == null ? NaN : Number(level);
                const resolvedLevel = Number.isFinite(requestedLevel)
                    ? requestedLevel
                    : (binding.defaultLevel || 1);
                const entry = this.getWeaponAttackEntry(binding.weapon, resolvedLevel, binding.slot || 'primary');
                if (entry?.src) return entry;
            }
            return this.manifest?.effects?.[effectId] || null;
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

        normalizePair(value, fallback) {
            if (Array.isArray(value) && value.length >= 2) {
                const first = Number(value[0]);
                const second = Number(value[1]);
                if (Number.isFinite(first) && Number.isFinite(second)) return [first, second];
            }
            return fallback;
        }

        getRotationOffset(facing = 'right') {
            if (Number.isFinite(Number(facing))) return Number(facing);
            switch (String(facing || 'right').toLowerCase()) {
                case 'up':
                    return Math.PI / 2;
                case 'left':
                    return Math.PI;
                case 'down':
                    return -Math.PI / 2;
                case 'right':
                default:
                    return 0;
            }
        }

        drawWeaponAttachmentDebug(ctx, entry = {}, drawWidth = 1, drawHeight = 1) {
            const grip = this.normalizePair(entry.gripAnchor, this.normalizePair(entry.pivot, [0.18, 0.5]));
            const pivot = this.normalizePair(entry.pivot, grip);
            const tip = this.normalizePair(entry.tipAnchor, [0.93, 0.5]);
            const tail = this.normalizePair(entry.tailAnchor, [0.06, 0.5]);
            const hitLine = entry.hitLine || {};
            const hitFrom = this.normalizePair(hitLine.from, [0.22, 0.5]);
            const hitTo = this.normalizePair(hitLine.to, [0.94, 0.5]);
            const hitWidth = Math.max(1, Number(hitLine.width || 0.14) * drawHeight);
            const point = (anchor) => [drawWidth * (anchor[0] - pivot[0]), drawHeight * (anchor[1] - pivot[1])];
            const drawPoint = (anchor, color, radius = 4) => {
                const [px, py] = point(anchor);
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(px, py, radius, 0, Math.PI * 2);
                ctx.fill();
            };

            ctx.save();
            ctx.shadowBlur = 0;
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = 2;

            const [tailX, tailY] = point(tail);
            const [tipX, tipY] = point(tip);
            ctx.strokeStyle = 'rgba(116, 229, 255, 0.9)';
            ctx.beginPath();
            ctx.moveTo(tailX, tailY);
            ctx.lineTo(tipX, tipY);
            ctx.stroke();

            const [hitFromX, hitFromY] = point(hitFrom);
            const [hitToX, hitToY] = point(hitTo);
            ctx.strokeStyle = 'rgba(255, 72, 72, 0.92)';
            ctx.lineWidth = hitWidth;
            ctx.beginPath();
            ctx.moveTo(hitFromX, hitFromY);
            ctx.lineTo(hitToX, hitToY);
            ctx.stroke();

            drawPoint(grip, 'rgba(77, 255, 128, 0.95)', 4);
            drawPoint(pivot, 'rgba(250, 204, 21, 0.95)', 3);
            drawPoint(tip, 'rgba(255, 72, 72, 0.95)', 4);
            ctx.restore();
        }

        drawWeaponBody(ctx, image, x, y, angle, entry = {}, options = {}) {
            if (!this.canDraw(image)) return false;
            const drawSize = this.normalizePair(options.drawSize, this.normalizePair(entry.drawSize, [160, 36]));
            const pivot = this.normalizePair(options.pivot, this.normalizePair(entry.pivot || entry.gripAnchor, [0.18, 0.5]));
            const rotationOffset = Number(options.rotationOffset ?? entry.rotationOffset ?? this.getRotationOffset(entry.facing));
            const ok = this.drawGameAsset(ctx, image, entry, x, y, {
                ...options,
                width: options.width ?? drawSize[0],
                height: options.height ?? drawSize[1],
                angle: angle + rotationOffset,
                anchor: pivot,
                blendMode: options.blendMode || entry.blendMode,
            });
            if (ok && (options.debug ?? false)) {
                ctx.save();
                ctx.translate(x, y);
                ctx.rotate(angle + rotationOffset);
                this.drawWeaponAttachmentDebug(ctx, { ...entry, pivot }, Number(options.width ?? drawSize[0]), Number(options.height ?? drawSize[1]));
                ctx.restore();
            }
            return ok;
        }

        drawAttackShapeDebug(ctx, entry = {}, drawWidth = 1, drawHeight = 1) {
            const shape = entry.attackShape;
            if (!shape) return;
            ctx.save();
            ctx.shadowBlur = 0;
            ctx.filter = 'none';
            ctx.globalCompositeOperation = 'source-over';
            ctx.strokeStyle = 'rgba(190, 92, 255, 0.95)';
            ctx.fillStyle = 'rgba(190, 92, 255, 0.10)';
            ctx.lineWidth = 2;
            if (shape === 'arc') {
                const radius = Number(entry.logicalRadius) || Math.max(drawWidth, drawHeight) * 0.45;
                const angle = ((Number(entry.logicalAngleDegrees) || 120) * Math.PI) / 180;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius, -angle / 2, angle / 2);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            } else if (shape === 'line' || shape === 'projectile') {
                const length = Number(entry.logicalLength) || drawWidth;
                const width = Number(entry.logicalWidth) || Math.max(8, drawHeight * 0.35);
                ctx.strokeRect(0, -width / 2, length, width);
            } else if (shape === 'orbitBlade') {
                const bladeWidth = Math.max(8, Number(entry.logicalWidth) || drawWidth * 0.55);
                const bladeHeight = Math.max(16, Number(entry.logicalLength) || drawHeight);
                ctx.strokeRect(-bladeWidth / 2, -bladeHeight * 0.78, bladeWidth, bladeHeight);
                ctx.beginPath();
                ctx.arc(0, 0, Number(entry.orbitRadius) || Math.max(drawWidth, drawHeight), 0, Math.PI * 2);
                ctx.stroke();
            } else if (shape === 'circle') {
                const radius = Number(entry.logicalRadius) || Math.max(drawWidth, drawHeight) * 0.5;
                ctx.beginPath();
                ctx.arc(0, 0, radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }

        applyAttackShapeMask(ctx, entry = {}, dx = 0, dy = 0, drawWidth = 1, drawHeight = 1) {
            const shape = entry.attackShape;
            if (!shape || !entry.enableShapeMask || entry.disableShapeMask) return false;
            ctx.beginPath();
            if (shape === 'arc') {
                const radius = Math.max(drawWidth, drawHeight) * Number(entry.visualScale || 1);
                const angle = ((Number(entry.logicalAngleDegrees) || 120) * Math.PI) / 180;
                ctx.moveTo(0, 0);
                ctx.arc(0, 0, radius, -angle / 2, angle / 2);
                ctx.closePath();
            } else if (shape === 'circle') {
                ctx.ellipse(0, 0, Math.max(1, drawWidth / 2), Math.max(1, drawHeight / 2), 0, 0, Math.PI * 2);
            } else if (shape === 'projectile') {
                const radius = Math.max(2, drawHeight / 2);
                const left = dx;
                const right = dx + drawWidth;
                const top = dy;
                const bottom = dy + drawHeight;
                ctx.moveTo(left + radius, top);
                ctx.lineTo(right - radius, top);
                ctx.arc(right - radius, top + radius, radius, -Math.PI / 2, Math.PI / 2);
                ctx.lineTo(left + radius, bottom);
                ctx.arc(left + radius, top + radius, radius, Math.PI / 2, Math.PI * 1.5);
                ctx.closePath();
            } else if (shape === 'line') {
                const halfHeight = Math.max(3, Math.min(drawHeight / 2, Number(entry.logicalWidth || drawHeight) * Number(entry.visualWidthMultiplier || 1.0)));
                const left = Math.min(dx, 0);
                const right = Math.max(dx + drawWidth, Number(entry.logicalLength || drawWidth));
                const radius = Math.min(halfHeight, Math.max(4, halfHeight * 0.55));
                ctx.moveTo(left + radius, -halfHeight);
                ctx.lineTo(right - radius, -halfHeight);
                ctx.arc(right - radius, -halfHeight + radius, radius, -Math.PI / 2, Math.PI / 2);
                ctx.lineTo(left + radius, halfHeight);
                ctx.arc(left + radius, halfHeight - radius, radius, Math.PI / 2, Math.PI * 1.5);
                ctx.closePath();
            } else if (shape === 'orbitBlade') {
                const bladeWidth = Math.max(8, Math.min(drawWidth, Number(entry.drawSize?.[0]) || drawWidth));
                const bladeHeight = Math.max(16, drawHeight);
                const left = -bladeWidth / 2;
                const top = -bladeHeight * 0.78;
                const radius = Math.min(bladeWidth / 2, 10);
                ctx.moveTo(left + radius, top);
                ctx.lineTo(left + bladeWidth - radius, top);
                ctx.arc(left + bladeWidth - radius, top + radius, radius, -Math.PI / 2, 0);
                ctx.lineTo(left + bladeWidth, top + bladeHeight - radius);
                ctx.arc(left + bladeWidth - radius, top + bladeHeight - radius, radius, 0, Math.PI / 2);
                ctx.lineTo(left + radius, top + bladeHeight);
                ctx.arc(left + radius, top + bladeHeight - radius, radius, Math.PI / 2, Math.PI);
                ctx.lineTo(left, top + radius);
                ctx.arc(left + radius, top + radius, radius, Math.PI, Math.PI * 1.5);
                ctx.closePath();
            } else {
                return false;
            }
            ctx.clip();
            return true;
        }

        drawGameAsset(ctx, image, entry = {}, x, y, options = {}) {
            if (!this.canDraw(image)) return false;
            const sourceWidth = image.naturalWidth || image.width || 1;
            const sourceHeight = image.naturalHeight || image.height || 1;
            const sourceSize = this.normalizePair(entry.sourceSize, [sourceWidth, sourceHeight]);
            const safeFrame = Array.isArray(entry.safeFrame) && entry.safeFrame.length >= 4
                ? entry.safeFrame.map(value => Number(value))
                : [0, 0, sourceSize[0], sourceSize[1]];
            const sx = Math.max(0, Math.min(sourceWidth, Number.isFinite(safeFrame[0]) ? safeFrame[0] : 0));
            const sy = Math.max(0, Math.min(sourceHeight, Number.isFinite(safeFrame[1]) ? safeFrame[1] : 0));
            const sw = Math.max(1, Math.min(sourceWidth - sx, Number.isFinite(safeFrame[2]) ? safeFrame[2] : sourceWidth));
            const sh = Math.max(1, Math.min(sourceHeight - sy, Number.isFinite(safeFrame[3]) ? safeFrame[3] : sourceHeight));
            const drawSize = this.normalizePair(
                options.drawSize,
                this.normalizePair(entry.drawSize, [options.width || sw, options.height || sh])
            );
            const drawWidth = Math.max(1, Number(options.width ?? drawSize[0]));
            const drawHeight = Math.max(1, Number(options.height ?? drawSize[1]));
            const anchor = this.normalizePair(
                options.anchor,
                this.normalizePair(entry.anchor || entry.feetAnchor || entry.centerAnchor, [0.5, 0.5])
            );
            const alpha = Math.max(0, Math.min(1, options.alpha === undefined ? 1 : Number(options.alpha)));
            const angle = Number(options.angle || 0);
            const dx = -drawWidth * anchor[0];
            const dy = -drawHeight * anchor[1];

            ctx.save();
            ctx.translate(x, y);
            if (angle) ctx.rotate(angle);
            ctx.globalAlpha *= alpha;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            if (options.filter) ctx.filter = options.filter;
            if (entry.blendMode || options.blendMode) ctx.globalCompositeOperation = options.blendMode || entry.blendMode;
            if (entry.shadow || options.shadowBlur) {
                const shadow = typeof entry.shadow === 'object' ? entry.shadow : {};
                ctx.shadowBlur = Number(options.shadowBlur ?? shadow.blur ?? 0);
                ctx.shadowColor = options.shadowColor || shadow.color || 'rgba(0, 0, 0, 0.45)';
                ctx.shadowOffsetX = Number(shadow.offsetX || 0);
                ctx.shadowOffsetY = Number(shadow.offsetY || 0);
            }
            if (entry.glowColor || options.glowColor) {
                ctx.shadowBlur = Number(options.glowBlur ?? entry.glowBlur ?? Math.max(8, Math.min(drawWidth, drawHeight) * 0.22));
                ctx.shadowColor = options.glowColor || entry.glowColor;
            }
            this.applyAttackShapeMask(ctx, entry, dx, dy, drawWidth, drawHeight);
            ctx.drawImage(image, sx, sy, sw, sh, dx, dy, drawWidth, drawHeight);

            if (options.debug) {
                ctx.shadowBlur = 0;
                ctx.filter = 'none';
                ctx.globalCompositeOperation = 'source-over';
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(77, 166, 255, 0.95)';
                ctx.strokeRect(dx, dy, drawWidth, drawHeight);
                ctx.strokeStyle = 'rgba(255, 230, 77, 0.95)';
                ctx.strokeRect(dx + (sx / sourceWidth) * drawWidth, dy + (sy / sourceHeight) * drawHeight, (sw / sourceWidth) * drawWidth, (sh / sourceHeight) * drawHeight);
                ctx.fillStyle = 'rgba(77, 255, 128, 0.95)';
                ctx.beginPath();
                ctx.arc(0, 0, 3, 0, Math.PI * 2);
                ctx.fill();
                this.drawAttackShapeDebug(ctx, entry, drawWidth, drawHeight);
                if (options.hitbox) {
                    ctx.strokeStyle = 'rgba(255, 72, 72, 0.95)';
                    const hit = options.hitbox;
                    if (hit.shape === 'rect') {
                        ctx.strokeRect(-hit.width / 2 + (hit.offsetX || 0), -hit.height / 2 + (hit.offsetY || 0), hit.width, hit.height);
                    } else {
                        ctx.beginPath();
                        ctx.arc(hit.offsetX || 0, hit.offsetY || 0, hit.radius || Math.min(drawWidth, drawHeight) / 2, 0, Math.PI * 2);
                        ctx.stroke();
                    }
                }
            }
            ctx.restore();
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
