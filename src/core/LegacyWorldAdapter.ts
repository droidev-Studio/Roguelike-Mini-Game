import type {
  AnimationSystemWorld,
  BossSystemWorld,
  CollisionSystemWorld,
  DamageSystemWorld,
  DropSystemWorld,
  InputSystemWorld,
  LegacyCanvasRenderSystemWorld,
  MapSystemWorld,
  MovementSystemWorld,
  PickupSystemWorld,
  ProgressionSystemWorld,
  SpawnSystemWorld,
  WeaponSystemWorld,
} from '../systems/WorldPorts';

export interface LegacyGameManagerPort {
  readonly gameState?: string | number;
  handleInput(deltaTime: number): void;
  update(deltaTime: number): void;
  updateMapSystem?(deltaTime: number): void;
  updateSpawnSystem?(deltaTime: number): void;
  updateBossSystem?(deltaTime: number): void;
  updateMovementSystem?(deltaTime: number): void;
  updateDamageSystem?(deltaTime: number): void;
  updateProjectileSystem?(deltaTime: number): void | boolean;
  updateAnimationSystem?(deltaTime: number): void;
  updateCollisionSystem?(deltaTime: number): void | boolean;
  updatePlayerRecoverySystem?(deltaTime: number): void;
  updatePickupSystem?(deltaTime: number): void;
  updateDropSystem?(deltaTime: number): void;
  updateWeaponSystem?(deltaTime: number): void;
  hasPendingLevelProgression?(): boolean;
  processPendingLevelProgression?(): void;
  updateLevelProgressionSystem?(): void;
  updateProgressionSystem?(deltaTime: number): void;
  render(deltaTime: number): void;
}

export class LegacyWorldAdapter
  implements
    InputSystemWorld,
    MovementSystemWorld,
    CollisionSystemWorld,
    WeaponSystemWorld,
    DamageSystemWorld,
    SpawnSystemWorld,
    BossSystemWorld,
    MapSystemWorld,
    DropSystemWorld,
    ProgressionSystemWorld,
    PickupSystemWorld,
    AnimationSystemWorld,
    LegacyCanvasRenderSystemWorld
{
  constructor(private readonly legacy: LegacyGameManagerPort) {}

  updateInput(deltaTime: number): void {
    this.legacy.handleInput(deltaTime);
  }

  updateMovement(deltaTime: number): void {
    this.legacy.updateMovementSystem?.(deltaTime);
  }

  updateMap(deltaTime: number): void {
    this.legacy.updateMapSystem?.(deltaTime);
  }

  updateBosses(deltaTime: number): void {
    this.legacy.updateBossSystem?.(deltaTime);
  }

  updateCollision(deltaTime: number): void | boolean {
    const shouldContinue = this.legacy.updateCollisionSystem?.(deltaTime);
    if (shouldContinue === false) return false;
    this.legacy.updatePlayerRecoverySystem?.(deltaTime);
    return shouldContinue;
  }

  updateWeapons(deltaTime: number): void {
    this.legacy.updateWeaponSystem?.(deltaTime);
  }

  updateDamage(deltaTime: number): void | boolean {
    this.legacy.updateDamageSystem?.(deltaTime);
    return this.legacy.updateProjectileSystem?.(deltaTime);
  }

  updateSpawn(deltaTime: number): void {
    if (this.legacy.gameState === 1 || this.legacy.gameState === 'playing' || this.legacy.gameState === 'PLAYING') {
      if (this.legacy.updateSpawnSystem) {
        this.legacy.updateSpawnSystem(deltaTime);
      } else {
        this.legacy.update(deltaTime);
      }
    }
  }

  updatePickups(deltaTime: number): void {
    this.legacy.updatePickupSystem?.(deltaTime);
  }

  updateDrops(deltaTime: number): void {
    this.legacy.updateDropSystem?.(deltaTime);
  }

  hasPendingLevelProgression(): boolean {
    return this.legacy.hasPendingLevelProgression?.() ?? false;
  }

  processPendingLevelProgression(): void {
    if (this.legacy.processPendingLevelProgression) {
      this.legacy.processPendingLevelProgression();
      return;
    }
    this.legacy.updateLevelProgressionSystem?.();
  }

  updateProgression(deltaTime: number): void {
    if (this.legacy.updateProgressionSystem) {
      this.legacy.updateProgressionSystem(deltaTime);
      return;
    }
    this.legacy.updateLevelProgressionSystem?.();
  }

  updateAnimations(deltaTime: number): void {
    this.legacy.updateAnimationSystem?.(deltaTime);
  }

  renderLegacyCanvas(deltaTime: number): void {
    this.legacy.render(deltaTime);
  }
}
