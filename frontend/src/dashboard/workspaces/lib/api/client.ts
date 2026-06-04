// Mock-mode API client. Flip USE_MOCKS to false once a real backend exists;
// each api/*.ts function then swaps its body for a fetch() to the listed endpoint.
export const USE_MOCKS = true;

export const delay = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));

// Deterministic id helper (avoids Date.now()/Math.random in shared code paths).
let counter = 0;
export const nextId = (prefix: string) => `${prefix}_${++counter}`;
