import type { GameSystem } from './System';
import type { DropSystemWorld } from './WorldPorts';

export class DropSystem<TWorld extends DropSystemWorld> implements GameSystem<TWorld> {
  readonly name = 'DropSystem' as const;

  update(world: TWorld, deltaTime: number): void {
    world.updateDrops?.(deltaTime);
  }
}
