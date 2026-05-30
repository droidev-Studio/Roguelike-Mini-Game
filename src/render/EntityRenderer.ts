export interface EntityRenderPort {
  renderEntities?(deltaTime: number): void;
}

export class EntityRenderer {
  render(port: EntityRenderPort, deltaTime: number): void {
    port.renderEntities?.(deltaTime);
  }
}
