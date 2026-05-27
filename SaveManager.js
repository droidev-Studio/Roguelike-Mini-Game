(function initSaveManager(global) {
    const SAVE_VERSION = 1;
    const DEFAULT_SAVE_KEY = 'zeroDowntimeRoguelikeSave';
    const LEGACY_SAVE_KEYS = ['chronosHackerData'];
    const EMPTY_SAVE_DATA = Object.freeze({
        version: SAVE_VERSION,
        totalResonance: 0,
        perkLevels: {}
    });

    function sanitizeSaveData(data) {
        if (!data || typeof data !== 'object') return { ...EMPTY_SAVE_DATA };
        return {
            version: Number(data.version) || SAVE_VERSION,
            totalResonance: Math.max(0, Number(data.totalResonance) || 0),
            perkLevels: data.perkLevels && typeof data.perkLevels === 'object'
                ? { ...data.perkLevels }
                : {}
        };
    }

    class SaveManager {
        constructor(options = {}) {
            this.storage = options.storage || global.localStorage;
            this.key = options.key || DEFAULT_SAVE_KEY;
            this.legacyKeys = options.legacyKeys || LEGACY_SAVE_KEYS;
            this.lastError = null;
        }

        publishStatus(status) {
            global.__SAVE_MANAGER_STATUS__ = {
                key: this.key,
                version: SAVE_VERSION,
                lastError: this.lastError,
                ...status
            };
        }

        readRaw(key) {
            const raw = this.storage?.getItem?.(key);
            return raw ? sanitizeSaveData(JSON.parse(raw)) : null;
        }

        load() {
            try {
                const current = this.readRaw(this.key);
                if (current) {
                    this.publishStatus({ loaded: true, migrated: false, empty: false, data: current });
                    return current;
                }

                for (const legacyKey of this.legacyKeys) {
                    const legacy = this.readRaw(legacyKey);
                    if (legacy) {
                        this.publishStatus({ loaded: true, migrated: true, legacyKey, empty: false, data: legacy });
                        return legacy;
                    }
                }

                const empty = { ...EMPTY_SAVE_DATA };
                this.publishStatus({ loaded: true, migrated: false, empty: true, data: empty });
                return empty;
            } catch (error) {
                this.lastError = error.message || String(error);
                const empty = { ...EMPTY_SAVE_DATA };
                this.publishStatus({ loaded: false, migrated: false, empty: true, data: empty });
                return empty;
            }
        }

        save(data) {
            const safeData = sanitizeSaveData(data);
            safeData.version = SAVE_VERSION;
            try {
                this.storage?.setItem?.(this.key, JSON.stringify(safeData));
                this.lastError = null;
                this.publishStatus({ saved: true, data: safeData });
                return true;
            } catch (error) {
                this.lastError = error.message || String(error);
                this.publishStatus({ saved: false, data: safeData });
                return false;
            }
        }
    }

    global.SAVE_VERSION = SAVE_VERSION;
    global.DEFAULT_SAVE_KEY = DEFAULT_SAVE_KEY;
    global.SaveManager = SaveManager;
})(window);
