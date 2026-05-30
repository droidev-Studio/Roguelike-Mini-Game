export interface EffectRenderPort {
  renderEffects?(deltaTime: number): void;
}

export class EffectRenderer {
  render(port: EffectRenderPort, deltaTime: number): void {
    port.renderEffects?.(deltaTime);
  }
}
