export interface ArtMapRenderPort {
  renderArtMap?(deltaTime: number): void;
}

export class ArtMapRenderer {
  render(port: ArtMapRenderPort, deltaTime: number): void {
    port.renderArtMap?.(deltaTime);
  }
}
