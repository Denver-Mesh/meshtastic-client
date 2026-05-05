import { useCallback } from 'react';

import type { SendMessageOptions } from '../lib/protocols/Protocol';
import type { IdentityId } from '../lib/types';
import { useIdentityStore } from '../stores/identityStore';
import { addMessage } from '../stores/messageStore';

export function useSendMessage(identityId: IdentityId) {
  return useCallback(
    (opts: SendMessageOptions) => {
      const identity = useIdentityStore.getState().identities[identityId];
      if (!identity) {
        console.warn('[useSendMessage] no identity for', identityId);
        return;
      }
      const id = `out:${Date.now()}:${Math.random().toString(36).slice(2)}`;
      addMessage(identityId, {
        id,
        from: 0,
        to: opts.destination ?? 0xffffffff,
        text: opts.text,
        channelIndex: opts.channelIndex ?? 0,
        timestamp: Date.now(),
        status: 'sending',
      });
      identity.protocol.sendMessage({ ...opts });
    },
    [identityId],
  );
}
