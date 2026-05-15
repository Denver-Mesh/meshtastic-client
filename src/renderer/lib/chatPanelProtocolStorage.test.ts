import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearDraft,
  draftsStorageKey,
  lastReadStorageKey,
  loadDraftsInitial,
  loadOpenDmTabsInitial,
  loadPersistedLastReadInitial,
  openDmTabsStorageKey,
  saveDraft,
} from './chatPanelProtocolStorage';

describe('chatPanelProtocolStorage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('migrates legacy openDmTabs only into meshtastic key', () => {
    localStorage.setItem('mesh-client:openDmTabs', JSON.stringify([0xabc]));
    const mt = loadOpenDmTabsInitial('meshtastic');
    expect(mt).toEqual([0xabc]);
    expect(localStorage.getItem(openDmTabsStorageKey('meshtastic'))).toBe(JSON.stringify([0xabc]));

    localStorage.clear();
    localStorage.setItem('mesh-client:openDmTabs', JSON.stringify([0xabc]));
    const mc = loadOpenDmTabsInitial('meshcore');
    expect(mc).toEqual([]);
    expect(localStorage.getItem(openDmTabsStorageKey('meshcore'))).toBeNull();
  });

  it('migrates legacy lastRead only into meshtastic key', () => {
    localStorage.setItem('mesh-client:lastRead', JSON.stringify({ 'ch:0': 1 }));
    const mt = loadPersistedLastReadInitial('meshtastic');
    expect(mt).toEqual({ 'ch:0': 1 });
    expect(localStorage.getItem(lastReadStorageKey('meshtastic'))).toBe(
      JSON.stringify({ 'ch:0': 1 }),
    );

    localStorage.clear();
    localStorage.setItem('mesh-client:lastRead', JSON.stringify({ 'ch:0': 1 }));
    const mc = loadPersistedLastReadInitial('meshcore');
    expect(mc).toEqual({});
    expect(localStorage.getItem(lastReadStorageKey('meshcore'))).toBeNull();
  });
});

describe('chatPanelProtocolStorage — drafts', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty object when no drafts stored', () => {
    expect(loadDraftsInitial('meshtastic')).toEqual({});
  });

  it('saveDraft stores draft under the correct key', () => {
    saveDraft('meshtastic', 'ch:0', 'hello world');
    const raw = localStorage.getItem(draftsStorageKey('meshtastic'));
    expect(JSON.parse(raw!)).toEqual({ 'ch:0': 'hello world' });
  });

  it('saveDraft preserves existing drafts for other views', () => {
    saveDraft('meshtastic', 'ch:0', 'ch0 draft');
    saveDraft('meshtastic', 'ch:1', 'ch1 draft');
    expect(loadDraftsInitial('meshtastic')).toEqual({ 'ch:0': 'ch0 draft', 'ch:1': 'ch1 draft' });
  });

  it('clearDraft removes only the specified view key', () => {
    saveDraft('meshtastic', 'ch:0', 'ch0 draft');
    saveDraft('meshtastic', 'ch:1', 'ch1 draft');
    clearDraft('meshtastic', 'ch:0');
    expect(loadDraftsInitial('meshtastic')).toEqual({ 'ch:1': 'ch1 draft' });
  });

  it('clearDraft is a no-op when key does not exist', () => {
    saveDraft('meshtastic', 'ch:1', 'ch1 draft');
    clearDraft('meshtastic', 'ch:99');
    expect(loadDraftsInitial('meshtastic')).toEqual({ 'ch:1': 'ch1 draft' });
  });

  it('drafts are scoped per protocol', () => {
    saveDraft('meshtastic', 'ch:0', 'mt draft');
    saveDraft('meshcore', 'ch:0', 'mc draft');
    expect(loadDraftsInitial('meshtastic')['ch:0']).toBe('mt draft');
    expect(loadDraftsInitial('meshcore')['ch:0']).toBe('mc draft');
  });

  it('loadDraftsInitial ignores non-string values and corrupt JSON', () => {
    localStorage.setItem(
      draftsStorageKey('meshtastic'),
      JSON.stringify({ 'ch:0': 42, 'ch:1': 'ok' }),
    );
    expect(loadDraftsInitial('meshtastic')).toEqual({ 'ch:1': 'ok' });

    localStorage.setItem(draftsStorageKey('meshtastic'), 'not json{');
    expect(loadDraftsInitial('meshtastic')).toEqual({});
  });
});
