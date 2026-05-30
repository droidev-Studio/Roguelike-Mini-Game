export type InputAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'pause'
  | 'auto'
  | 'reset'
  | 'confirm'
  | 'cancel';

export type InputBindings = Record<InputAction, string[]>;

export class InputSystem {
  readonly keys: Record<string, boolean> = {};
  private previousKeys: Record<string, boolean> = {};

  constructor(readonly bindings: InputBindings = {
    moveUp: ['w', 'arrowup'],
    moveDown: ['s', 'arrowdown'],
    moveLeft: ['a', 'arrowleft'],
    moveRight: ['d', 'arrowright'],
    pause: ['escape', 'p'],
    auto: ['tab'],
    reset: ['r'],
    confirm: ['enter', ' '],
    cancel: ['escape'],
  }) {}

  setKey(key: string, pressed: boolean): void {
    this.keys[key.toLowerCase()] = pressed;
  }

  update(): void {
    this.previousKeys = { ...this.keys };
  }

  isDown(action: InputAction): boolean {
    return this.bindings[action].some(key => Boolean(this.keys[key]));
  }

  wasPressed(action: InputAction): boolean {
    return this.bindings[action].some(key => Boolean(this.keys[key]) && !this.previousKeys[key]);
  }

  getMoveVector(): { x: number; y: number } {
    let x = 0;
    let y = 0;
    if (this.isDown('moveUp')) y -= 1;
    if (this.isDown('moveDown')) y += 1;
    if (this.isDown('moveLeft')) x -= 1;
    if (this.isDown('moveRight')) x += 1;
    if (x !== 0 || y !== 0) {
      const length = Math.hypot(x, y);
      x /= length;
      y /= length;
    }
    return { x, y };
  }
}
