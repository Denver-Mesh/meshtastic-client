import type { IdentityId } from '../lib/types';
import type { Message } from '../stores/messageStore';
import { useMessageStore } from '../stores/messageStore';

export function useMessages(identityId: IdentityId): Message[] {
  return useMessageStore((s) => {
    const byId = s.messages[identityId];
    return byId ? Object.values(byId) : [];
  });
}
