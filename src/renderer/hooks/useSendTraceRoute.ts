import { useCallback } from 'react';

import type { IdentityId } from '../lib/types';
import { useIdentityStore } from '../stores/identityStore';

export function useSendTraceRoute(identityId: IdentityId) {
  return useCallback(
    (nodeId: number) => {
      const identity = useIdentityStore.getState().identities[identityId];
      if (!identity) {
        console.warn('[useSendTraceRoute] no identity for', identityId);
        return;
      }
      identity.protocol.sendTraceRoute(nodeId);
    },
    [identityId],
  );
}
