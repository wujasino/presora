import "@testing-library/jest-dom";

// Node 25 exposes an experimental global localStorage binding that resolves to
// undefined unless --localstorage-file is provided. Install a deterministic
// in-memory Storage for tests instead of depending on that host-level flag.
const localValues = new Map<string, string>();
const testLocalStorage: Storage = {
  get length() { return localValues.size; },
  clear: () => localValues.clear(),
  getItem: (key) => localValues.get(String(key)) ?? null,
  key: (index) => [...localValues.keys()][index] ?? null,
  removeItem: (key) => { localValues.delete(String(key)); },
  setItem: (key, value) => { localValues.set(String(key), String(value)); },
};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: testLocalStorage,
});
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: testLocalStorage,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
