export type SystemName = (typeof SYSTEM_EXECUTION_ORDER)[number];

export interface GameSystem<TWorld = unknown> {
  readonly name: SystemName;
  update(world: TWorld, deltaTime: number): void | boolean;
}

export const SYSTEM_EXECUTION_ORDER = [
  'InputSystem',
  'MapSystem',
  'SpawnSystem',
  'BossSystem',
  'MovementSystem',
  'DamageSystem',
  'AnimationSystem',
  'CollisionSystem',
  'DropSystem',
  'PickupSystem',
  'WeaponSystem',
  'ProgressionSystem',
  'LegacyCanvasRenderSystem',
] as const;

export function getSystemOrder(name: SystemName): number {
  return SYSTEM_EXECUTION_ORDER.indexOf(name);
}
