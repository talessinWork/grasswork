// Minimal declaration so tsconfig.core.json can type-check without @types/bun installed.
// Tests themselves are excluded from tsc; bun provides the real module at runtime.
declare module 'bun:test' {
  export const describe: (name: string, fn: () => void) => void;
  export const it: (name: string, fn: () => void | Promise<void>) => void;
  export const test: typeof it;
  export const expect: any;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
}
