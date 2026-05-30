import type { GameSystem } from './System';
import type { BossSystemWorld } from './WorldPorts';

export class BossSystem<TWorld extends BossSystemWorld> implements GameSystem<TWorld> {
  readonly name = 'BossSystem' as const;

  update(world: TWorld, deltaTime: number): void {
    world.updateBosses?.(deltaTime);
  }
}
