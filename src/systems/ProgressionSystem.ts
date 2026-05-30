import type { GameSystem } from './System';
import type { ProgressionSystemWorld } from './WorldPorts';

export class ProgressionSystem<TWorld extends ProgressionSystemWorld> implements GameSystem<TWorld> {
  readonly name = 'ProgressionSystem' as const;

  update(world: TWorld, deltaTime: number): void {
    if (world.hasPendingLevelProgression && world.processPendingLevelProgression) {
      if (world.hasPendingLevelProgression()) {
        world.processPendingLevelProgression();
      }
      return;
    }
    world.updateProgression?.(deltaTime);
  }
}
