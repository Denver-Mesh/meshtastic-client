import type { Identity, IdentityId } from '../lib/types';
import { useIdentityStore } from '../stores/identityStore';

export function useIdentity(identityId: IdentityId): Identity | null {
  return useIdentityStore((s) => s.identities[identityId] ?? null);
}

export function useActiveIdentity(): Identity | null {
  return useIdentityStore((s) =>
    s.activeIdentityId ? (s.identities[s.activeIdentityId] ?? null) : null,
  );
}

export function useIdentities(): Identity[] {
  return useIdentityStore((s) => Object.values(s.identities));
}
