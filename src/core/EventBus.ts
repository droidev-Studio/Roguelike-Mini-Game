type EventMap = Record<string, unknown>;
type EventHandler<TPayload> = (payload: TPayload) => void;

export class EventBus<TEvents extends EventMap = EventMap> {
  private handlers = new Map<keyof TEvents, Set<EventHandler<TEvents[keyof TEvents]>>>();

  on<TKey extends keyof TEvents>(eventName: TKey, handler: EventHandler<TEvents[TKey]>): () => void {
    const handlers = this.handlers.get(eventName) || new Set<EventHandler<TEvents[keyof TEvents]>>();
    handlers.add(handler as EventHandler<TEvents[keyof TEvents]>);
    this.handlers.set(eventName, handlers);
    return () => handlers.delete(handler as EventHandler<TEvents[keyof TEvents]>);
  }

  emit<TKey extends keyof TEvents>(eventName: TKey, payload: TEvents[TKey]): void {
    const handlers = this.handlers.get(eventName);
    if (!handlers) return;
    for (const handler of handlers) handler(payload);
  }

  clear(): void {
    this.handlers.clear();
  }
}
