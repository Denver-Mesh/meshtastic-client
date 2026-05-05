import { useCallback } from 'react';

import type { SendWaypointOptions } from '../lib/protocols/Protocol';
import type { IdentityId } from '../lib/types';
import { useIdentityStore } from '../stores/identityStore';

export function useSendWaypoint(identityId: IdentityId) {
  return useCallback(
    (opts: SendWaypointOptions) => {
      const identity = useIdentityStore.getState().identities[identityId];
      if (!identity) {
        console.warn('[useSendWaypoint] no identity for', identityId);
        return;
      }
      identity.protocol.sendWaypoint(opts);
    },
    [identityId],
  );
}
