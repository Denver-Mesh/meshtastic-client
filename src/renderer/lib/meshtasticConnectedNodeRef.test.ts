import { describe, expect, it } from 'vitest';

import {
  getMeshtasticConnectedMyNodeNum,
  setMeshtasticConnectedMyNodeNum,
} from './meshtasticConnectedNodeRef';

describe('meshtasticConnectedNodeRef', () => {
  it('returns 0 initially', () => {
    setMeshtasticConnectedMyNodeNum(0);
    expect(getMeshtasticConnectedMyNodeNum()).toBe(0);
  });

  it('returns the value that was set', () => {
    setMeshtasticConnectedMyNodeNum(0xdeadbeef);
    expect(getMeshtasticConnectedMyNodeNum()).toBe(0xdeadbeef);
    setMeshtasticConnectedMyNodeNum(0);
  });

  it('reflects the latest set call', () => {
    setMeshtasticConnectedMyNodeNum(1);
    setMeshtasticConnectedMyNodeNum(2);
    expect(getMeshtasticConnectedMyNodeNum()).toBe(2);
    setMeshtasticConnectedMyNodeNum(0);
  });
});
