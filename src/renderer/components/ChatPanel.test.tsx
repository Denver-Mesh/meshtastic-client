import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import ChatPanel from './ChatPanel';
import { ToastProvider } from './Toast';

describe('ChatPanel accessibility', () => {
  const defaultProps = {
    messages: [],
    channels: [{ index: 0, name: 'General' }],
    myNodeNum: 0,
    onSend: vi.fn().mockResolvedValue(undefined),
    onReact: vi.fn().mockResolvedValue(undefined),
    onResend: vi.fn(),
    onNodeClick: vi.fn(),
    isConnected: false,
    nodes: new Map(),
    isActive: true,
  };

  it('has no axe violations with empty messages', async () => {
    const { container } = render(
      <ToastProvider>
        <ChatPanel {...defaultProps} />
      </ToastProvider>,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('emoji picker opens for the correct message when messages have no packetId', async () => {
    // Messages without packetId must use timestamp as picker key so re-renders
    // don't shift the picker to a different message (regression: was using -(i+1)).
    const now = Date.now();
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ChatPanel
          {...defaultProps}
          isConnected
          myNodeNum={999}
          messages={[
            {
              sender_id: 1,
              sender_name: 'A',
              payload: 'first',
              channel: 0,
              timestamp: now - 2000,
              status: 'acked',
            },
            {
              sender_id: 1,
              sender_name: 'A',
              payload: 'second',
              channel: 0,
              timestamp: now - 1000,
              status: 'acked',
            },
          ]}
        />
      </ToastProvider>,
    );
    // Open picker for the second message
    const reactButtons = screen.getAllByTitle('React');
    await user.click(reactButtons[1]);
    // Picker should be visible — emoji buttons are titled 'Like', 'Love', etc.
    expect(screen.getByTitle('Like')).toBeInTheDocument();
  });

  it('shows RF transport badge for incoming messages with receivedVia rf', () => {
    render(
      <ToastProvider>
        <ChatPanel
          {...defaultProps}
          myNodeNum={1}
          messages={[
            {
              sender_id: 2,
              sender_name: 'Other',
              payload: 'Hello',
              channel: 0,
              timestamp: Date.now(),
              status: 'acked',
              receivedVia: 'rf',
            },
          ]}
        />
      </ToastProvider>,
    );
    expect(screen.getByTitle('Received via RF')).toBeInTheDocument();
  });
});
