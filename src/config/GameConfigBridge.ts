type PlainRecord = Record<string, unknown>;

function isPlainRecord(value: unknown): value is PlainRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function cloneValue<TValue>(value: TValue): TValue {
  if (Array.isArray(value)) return value.map(item => cloneValue(item)) as TValue;
  if (isPlainRecord(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)])) as TValue;
  }
  return value;
}

export function getByPath<TValue>(source: unknown, path: string, fallback: TValue): TValue {
  let cursor: unknown = source;
  for (const key of path.split('.')) {
    if (!cursor || typeof cursor !== 'object' || !(key in cursor)) return fallback;
    cursor = (cursor as PlainRecord)[key];
  }
  return cursor as TValue;
}

export function mergePlainConfig<TTarget extends PlainRecord>(target: TTarget, source: unknown): TTarget {
  if (!isPlainRecord(source)) return target;
  const targetRecord = target as PlainRecord;
  for (const [key, value] of Object.entries(source)) {
    if (isPlainRecord(value) && isPlainRecord(targetRecord[key])) {
      mergePlainConfig(targetRecord[key] as PlainRecord, value);
    } else {
      targetRecord[key] = cloneValue(value);
    }
  }
  return target;
}

export function getRuntimeSetting<TValue>(path: string, fallback: TValue): TValue {
  const getter = (globalThis as { getGameSetting?: (path: string, fallback: TValue) => TValue }).getGameSetting;
  if (typeof getter === 'function') return getter(path, fallback);

  return getByPath((globalThis as { GAME_SETTINGS?: unknown }).GAME_SETTINGS, path, fallback);
}

export function mergeSpecWithSettings<TSpec extends PlainRecord>(spec: TSpec, overridePath?: string): TSpec {
  const result = cloneValue(spec);
  const settingsPath = overridePath ? `SPEC_OVERRIDES.${overridePath}` : 'SPEC_OVERRIDES';
  const overrides = getRuntimeSetting<unknown>(settingsPath, null);
  return mergePlainConfig(result, overrides);
}
