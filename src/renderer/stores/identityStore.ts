import { create } from 'zustand';

import type { Identity, IdentityId } from '../lib/types';

interface IdentityStoreState {
  identities: Record<IdentityId, Identity>;
  activeIdentityId: IdentityId | null;
}

const defaultState: IdentityStoreState = {
  identities: {},
  activeIdentityId: null,
};

export const useIdentityStore = create<IdentityStoreState>()(() => defaultState);

export function addIdentity(identity: Identity): void {
  useIdentityStore.setState((s) => ({
    identities: { ...s.identities, [identity.id]: identity },
  }));
}

export function removeIdentity(id: IdentityId): void {
  useIdentityStore.setState((s) => {
    const { [id]: _removed, ...rest } = s.identities;
    return {
      identities: rest,
      activeIdentityId: s.activeIdentityId === id ? null : s.activeIdentityId,
    };
  });
}

export function setActiveIdentity(id: IdentityId | null): void {
  useIdentityStore.setState({ activeIdentityId: id });
}

export function updateIdentity(
  id: IdentityId,
  updates: Partial<Omit<Identity, 'id' | 'protocol'>>,
): void {
  useIdentityStore.setState((s) => {
    const existing = s.identities[id];
    if (!existing) return s;
    return { identities: { ...s.identities, [id]: { ...existing, ...updates } } };
  });
}

export function getIdentity(id: IdentityId): Identity | null {
  return useIdentityStore.getState().identities[id] ?? null;
}
