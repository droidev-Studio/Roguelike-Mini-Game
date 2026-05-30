import { GameManager } from '../core/GameManager';
import { AnimationSystem } from './AnimationSystem';
import { BossSystem } from './BossSystem';
import { CollisionSystem } from './CollisionSystem';
import { DamageSystem } from './DamageSystem';
import { DropSystem } from './DropSystem';
import { InputSystem } from './InputSystem';
import { LegacyCanvasRenderSystem } from './LegacyCanvasRenderSystem';
import { MapSystem } from './MapSystem';
import { MovementSystem } from './MovementSystem';
import { PickupSystem } from './PickupSystem';
import { ProgressionSystem } from './ProgressionSystem';
import { SpawnSystem } from './SpawnSystem';
import { WeaponSystem } from './WeaponSystem';
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
} from './WorldPorts';

export type LegacyPipelineWorld =
  InputSystemWorld &
  MovementSystemWorld &
  CollisionSystemWorld &
  WeaponSystemWorld &
  DamageSystemWorld &
  MapSystemWorld &
  SpawnSystemWorld &
  BossSystemWorld &
  DropSystemWorld &
  PickupSystemWorld &
  ProgressionSystemWorld &
  AnimationSystemWorld &
  LegacyCanvasRenderSystemWorld;

export function createLegacySystemPipeline<TWorld extends LegacyPipelineWorld>(): GameManager<TWorld> {
  return new GameManager<TWorld>([
    new InputSystem<TWorld>(),
    new MapSystem<TWorld>(),
    new SpawnSystem<TWorld>(),
    new BossSystem<TWorld>(),
    new MovementSystem<TWorld>(),
    new DamageSystem<TWorld>(),
    new AnimationSystem<TWorld>(),
    new CollisionSystem<TWorld>(),
    new DropSystem<TWorld>(),
    new PickupSystem<TWorld>(),
    new WeaponSystem<TWorld>(),
    new ProgressionSystem<TWorld>(),
    new LegacyCanvasRenderSystem<TWorld>(),
  ]);
}
