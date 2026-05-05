import { useCallback } from 'react';

import type { SendPositionOptions } from '../lib/protocols/Protocol';
import type { IdentityId } from '../lib/types';
import { useIdentityStore } from '../stores/identityStore';

export function useSendPosition(identityId: IdentityId) {
  return useCallback(
    (opts: SendPositionOptions) => {
      const identity = useIdentityStore.getState().identities[identityId];
      if (!identity) {
        console.warn('[useSendPosition] no identity for', identityId);
        return;
      }
      identity.protocol.sendPosition(opts);
    },
    [identityId],
  );
}
