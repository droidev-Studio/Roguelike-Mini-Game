import type { GameSystem } from './System';
import type { MapSystemWorld } from './WorldPorts';

export class MapSystem<TWorld extends MapSystemWorld> implements GameSystem<TWorld> {
  readonly name = 'MapSystem' as const;

  update(world: TWorld, deltaTime: number): void {
    world.updateMap?.(deltaTime);
  }
}
