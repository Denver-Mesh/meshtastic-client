import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import type { MeshNode } from '../lib/types';
import RepeatersPanel from './RepeatersPanel';

vi.mock('./Toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useMeshcoreRepeaterRemoteAuth', () => ({
  MeshcoreRepeaterRemoteAuthBanner: () => null,
  useMeshcoreRepeaterRemoteAuth: () => ({
    ensureConfigured: vi.fn().mockResolvedValue(undefined),
    RemoteAuthModal: null,
  }),
}));

function mockRepeaterNode(id: number): MeshNode {
  return {
    node_id: id,
    long_name: 'Test Repeater',
    short_name: 'TR',
    hw_model: 'Repeater',
    snr: 2,
    battery: 100,
    last_heard: Math.floor(Date.now() / 1000),
    latitude: null,
    longitude: null,
  };
}

const repeater = mockRepeaterNode(0xabc);

const baseProps = {
  nodes: new Map([[repeater.node_id, repeater]]),
  meshcoreNodeStatus: new Map(),
  meshcoreTraceResults: new Map(),
  onRequestRepeaterStatus: vi.fn().mockResolvedValue(undefined),
  onPing: vi.fn().mockResolvedValue(undefined),
  onDeleteRepeater: vi.fn().mockResolvedValue(undefined),
  isConnected: true,
};

describe('RepeatersPanel', () => {
  it('shows CLI interface button when onSendCliCommand is provided and connected', async () => {
    const { container } = render(
      <RepeatersPanel {...baseProps} onSendCliCommand={vi.fn().mockResolvedValue('ok')} />,
    );
    expect(screen.getByRole('button', { name: 'CLI interface' })).toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('hides CLI interface button when onSendCliCommand is omitted', async () => {
    const { container } = render(<RepeatersPanel {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'CLI interface' })).not.toBeInTheDocument();
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
