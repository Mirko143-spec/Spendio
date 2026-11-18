// Vitest setup for component tests (files marked `@vitest-environment jsdom`).
// Core and storage tests run in Node, where there is no DOM to set up.
import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react');
  afterEach(() => cleanup());
}
