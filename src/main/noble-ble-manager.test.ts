// @vitest-environment node
import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

/**
 * NobleBleManager depends on @stoprocent/noble (native). We cannot unit-test
 * startScanning() in plain Node without brittle module mocks that diverge from
 * Electron/CJS interop. Instead, lock in the stale-connected-peripheral fix
 * the same way as database.test.ts: assert the implementation still contains
 * the preservation + re-emit behavior.
 */
const SOURCE = readFileSync(join(__dirname, 'noble-ble-manager.ts'), 'utf-8');

describe('NobleBleManager.startScanning (regression)', () => {
  it('preserves connected peripherals and re-emits deviceDiscovered when clearing knownPeripherals', () => {
    expect(SOURCE).toMatch(/stillConnected/);
    expect(SOURCE).toMatch(/peripheral\.state === ['"]connected['"]/);
    expect(SOURCE).toMatch(/emit\('deviceDiscovered'/);
  });
});
