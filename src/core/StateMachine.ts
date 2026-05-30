export type StateGuard<TState, TPayload = unknown> = (
  from: TState,
  to: TState,
  payload: TPayload,
) => boolean;

export interface StateChange<TState, TPayload = unknown> {
  from: TState;
  to: TState;
  payload: TPayload;
}

export interface StateMachineHooks<TState, TPayload = unknown> {
  onExit?: (change: StateChange<TState, TPayload>) => void;
  onEnter?: (change: StateChange<TState, TPayload>) => void;
}

export class StateMachine<TState, TPayload = unknown> {
  private listeners = new Set<(change: StateChange<TState, TPayload>) => void>();

  constructor(
    private currentState: TState,
    private readonly canChange: StateGuard<TState, TPayload> = () => true,
    private readonly hooks: StateMachineHooks<TState, TPayload> = {},
  ) {}

  get state(): TState {
    return this.currentState;
  }

  change(to: TState, payload: TPayload): boolean {
    const from = this.currentState;
    if (Object.is(from, to) || !this.canChange(from, to, payload)) return false;
    const change = { from, to, payload };
    this.hooks.onExit?.(change);
    this.currentState = to;
    this.hooks.onEnter?.(change);
    for (const listener of this.listeners) listener(change);
    return true;
  }

  subscribe(listener: (change: StateChange<TState, TPayload>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
