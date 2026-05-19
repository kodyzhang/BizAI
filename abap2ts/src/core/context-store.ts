import { AbapObjectContext } from '../types.js';

class ContextStore {
  private readonly store = new Map<string, AbapObjectContext>();

  add(ctx: AbapObjectContext): void {
    this.store.set(ctx.name.toUpperCase(), ctx);
  }

  get(name: string): AbapObjectContext | undefined {
    return this.store.get(name.toUpperCase());
  }

  getAll(): AbapObjectContext[] {
    return [...this.store.values()];
  }

  has(name: string): boolean {
    return this.store.has(name.toUpperCase());
  }

  clear(): void {
    this.store.clear();
  }

  size(): number {
    return this.store.size;
  }
}

export const contextStore = new ContextStore();
