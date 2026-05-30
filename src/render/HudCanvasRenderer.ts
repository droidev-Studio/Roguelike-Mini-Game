export interface HudCanvasRenderPort {
  renderHudCanvas?(deltaTime: number): void;
}

export class HudCanvasRenderer {
  render(port: HudCanvasRenderPort, deltaTime: number): void {
    port.renderHudCanvas?.(deltaTime);
  }
}
