/**
 * Node 20.4+ defines its own `localStorage` global, and it is not a Storage —
 * so the DOM environment leaves it in place and every storage test fails. Give
 * the environment a real, isolated Storage when what it inherited cannot work.
 */
class MemoryStorage implements Storage {
  #entries = new Map<string, string>();
  get length(): number {
    return this.#entries.size;
  }
  clear(): void {
    this.#entries.clear();
  }
  getItem(key: string): string | null {
    return this.#entries.get(String(key)) ?? null;
  }
  key(index: number): string | null {
    return [...this.#entries.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.#entries.delete(String(key));
  }
  setItem(key: string, value: string): void {
    this.#entries.set(String(key), String(value));
  }
}

/**
 * Installed unconditionally: reading the inherited global to test it makes Node
 * warn about its own web storage file, once per worker.
 */
function install(name: "localStorage" | "sessionStorage"): void {
  const storage = new MemoryStorage();
  for (const target of [globalThis, (globalThis as { window?: object }).window]) {
    if (!target) continue;
    Object.defineProperty(target, name, { value: storage, configurable: true, writable: true });
  }
}

install("localStorage");
install("sessionStorage");
