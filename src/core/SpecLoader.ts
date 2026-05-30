import { mergeSpecWithSettings } from '../config/GameConfigBridge';

export type RuntimeSpecs = Record<string, unknown>;

export class SpecLoader {
  readonly specs: RuntimeSpecs = {};

  constructor(
    private readonly basePath = 'src/spec/',
    private readonly cacheBust = false,
  ) {}

  async loadAll(fileNames = [
    'game.json',
    'stages.json',
    'entities.json',
    'enemies.json',
    'weapons.json',
    'balance.json',
    'waves.json',
    'effects.json',
    'progression.json',
    'drops.json',
    'ui-text.json',
  ]): Promise<RuntimeSpecs> {
    await Promise.all(fileNames.map(async fileName => {
      const key = fileName.replace(/\.json$/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
      this.specs[key] = await this.loadJson(fileName);
    }));
    return this.specs;
  }

  async loadJson(fileName: string): Promise<unknown> {
    const suffix = this.cacheBust ? `?t=${Date.now()}` : '';
    const response = await fetch(`${this.basePath}${fileName}${suffix}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load spec: ${fileName}`);
    const spec = await response.json();
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return spec;
    const overrideKey = fileName.replace(/\.json$/, '').replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    return mergeSpecWithSettings(spec as Record<string, unknown>, overrideKey);
  }

  get<TValue = unknown>(path: string, fallback: TValue): TValue {
    let cursor: unknown = this.specs;
    for (const key of path.split('.')) {
      if (!cursor || typeof cursor !== 'object' || !(key in cursor)) return fallback;
      cursor = (cursor as Record<string, unknown>)[key];
    }
    return cursor as TValue;
  }
}
