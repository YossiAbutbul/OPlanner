// Tiny localStorage JSON cache helper. Returns read/write fns scoped by key.
// All errors swallowed — cache misses, quota fails, JSON corruption all
// degrade gracefully to "no cache".
export const lsCache = {
  read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  write<T>(key: string, value: T): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* quota / disabled */
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};
