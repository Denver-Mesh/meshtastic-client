import type { AxeMatchers } from 'vitest-axe/matchers';

declare module '@vitest/expect' {
  interface Assertion<T = any> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
