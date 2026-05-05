import { create } from 'zustand';

import type { ConnectionType, IdentityId } from '../lib/types';

export type MessageStatus = 'sending' | 'acked' | 'failed';

export interface Message {
  id: string;
  from: number;
  senderName?: string;
  to: number;
  text: string;
  channelIndex: number;
  timestamp: number;
  rxSnr?: number;
  rxRssi?: number;
  hopCount?: number;
  isTapback?: boolean;
  replyTo?: string;
  replyPreviewText?: string;
  replyPreviewSender?: string;
  status?: MessageStatus;
  mqttStatus?: MessageStatus;
  receivedVia?: ConnectionType;
  isHistory?: boolean;
  error?: string;
}

interface MessageStoreState {
  messages: Record<IdentityId, Record<string, Message>>;
}

const defaultState: MessageStoreState = {
  messages: {},
};

export const useMessageStore = create<MessageStoreState>()(() => defaultState);

export function addMessage(identityId: IdentityId, message: Message): void {
  useMessageStore.setState((s) => ({
    messages: {
      ...s.messages,
      [identityId]: { ...(s.messages[identityId] ?? {}), [message.id]: message },
    },
  }));
}

export function updateMessageStatus(
  identityId: IdentityId,
  messageId: string,
  status: MessageStatus,
  error?: string,
): void {
  useMessageStore.setState((s) => {
    const byIdentity = s.messages[identityId];
    const existing = byIdentity?.[messageId];
    if (!existing) return s;
    return {
      messages: {
        ...s.messages,
        [identityId]: { ...byIdentity, [messageId]: { ...existing, status, error } },
      },
    };
  });
}

export function clearMessageIdentity(identityId: IdentityId): void {
  useMessageStore.setState((s) => {
    const { [identityId]: _removed, ...rest } = s.messages;
    return { messages: rest };
  });
}
