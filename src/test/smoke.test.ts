import {describe, expect, it} from 'vitest';

// Minimal smoke test confirming the Vitest runner executes correctly.
describe('vitest smoke test', () => {
  it('runs and evaluates a basic assertion', () => {
    expect(1 + 1).toBe(2);
  });

  it('has the jsdom environment available', () => {
    expect(typeof document).toBe('object');
    expect(typeof window).toBe('object');
  });
});
