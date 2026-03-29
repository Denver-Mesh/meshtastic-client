import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import {
  MESHTASTIC_CONTACT_GROUP_BUILTIN_GPS,
  MESHTASTIC_CONTACT_GROUP_BUILTIN_RF_MQTT,
} from '../lib/meshtasticContactGroupUtils';
import type { MeshNode } from '../lib/types';
import NodeListPanel from './NodeListPanel';

function makeNode(partial: Partial<MeshNode> & Pick<MeshNode, 'node_id'>): MeshNode {
  return {
    long_name: 'N',
    short_name: '',
    hw_model: '',
    snr: 0,
    battery: 0,
    last_heard: Date.now(),
    latitude: null,
    longitude: null,
    ...partial,
  };
}

vi.mock('../stores/diagnosticsStore', () => ({
  useDiagnosticsStore: (selector: (s: unknown) => unknown) => {
    const store = {
      diagnosticRows: [],
      ignoreMqttEnabled: false,
      nodeRedundancy: new Map(),
    };
    return selector(store);
  },
}));

vi.mock('./Toast', () => ({
  useToast: () => ({
    addToast: vi.fn(),
  }),
}));

const defaultFilter = {
  enabled: false,
  maxDistance: 500,
  unit: 'miles' as const,
  hideMqttOnly: false,
};

describe('NodeListPanel accessibility', () => {
  it('has no axe violations with empty nodes', async () => {
    const { container } = render(
      <NodeListPanel
        nodes={new Map()}
        myNodeNum={0}
        onNodeClick={vi.fn()}
        locationFilter={defaultFilter}
        onToggleFavorite={vi.fn()}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('shows contacts title in meshcore mode', () => {
    render(
      <NodeListPanel
        nodes={new Map()}
        myNodeNum={0}
        onNodeClick={vi.fn()}
        locationFilter={defaultFilter}
        onToggleFavorite={vi.fn()}
        mode="meshcore"
      />,
    );
    expect(screen.getByRole('heading', { name: 'Contacts (0)' })).toBeInTheDocument();
  });
});

describe('NodeListPanel import contacts', () => {
  it('shows Import Contacts button in meshcore mode when onImportContacts provided', () => {
    render(
      <NodeListPanel
        nodes={new Map()}
        myNodeNum={0}
        onNodeClick={vi.fn()}
        locationFilter={defaultFilter}
        onToggleFavorite={vi.fn()}
        mode="meshcore"
        onImportContacts={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Import Contacts' })).toBeInTheDocument();
  });

  it('does not show Import Contacts button in meshtastic mode', () => {
    render(
      <NodeListPanel
        nodes={new Map()}
        myNodeNum={0}
        onNodeClick={vi.fn()}
        locationFilter={defaultFilter}
        onToggleFavorite={vi.fn()}
        mode="meshtastic"
        onImportContacts={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Import Contacts' })).not.toBeInTheDocument();
  });

  it('filters Meshtastic nodes by GPS built-in group', () => {
    const nodes = new Map<number, MeshNode>([
      [1, makeNode({ node_id: 1, long_name: 'Me', latitude: 40, longitude: -74 })],
      [2, makeNode({ node_id: 2, long_name: 'HasGps', latitude: 37.5, longitude: -122.4 })],
      [3, makeNode({ node_id: 3, long_name: 'NoGps', latitude: null, longitude: null })],
    ]);
    render(
      <NodeListPanel
        nodes={nodes}
        myNodeNum={1}
        onNodeClick={vi.fn()}
        locationFilter={defaultFilter}
        onToggleFavorite={vi.fn()}
        mode="meshtastic"
        selectedGroupId={MESHTASTIC_CONTACT_GROUP_BUILTIN_GPS}
        onGroupChange={vi.fn()}
        onManageGroups={vi.fn()}
        groups={[]}
        groupMemberIds={new Set()}
      />,
    );
    expect(screen.getByText('HasGps')).toBeInTheDocument();
    expect(screen.queryByText('NoGps')).not.toBeInTheDocument();
    expect(screen.queryByText('Me')).not.toBeInTheDocument();
  });

  it('filters Meshtastic nodes by RF+MQTT built-in group', () => {
    const nodes = new Map<number, MeshNode>([
      [
        1,
        makeNode({ node_id: 1, long_name: 'Me', heard_via_mqtt: true, heard_via_mqtt_only: false }),
      ],
      [
        2,
        makeNode({
          node_id: 2,
          long_name: 'Hybrid',
          heard_via_mqtt: true,
          heard_via_mqtt_only: false,
        }),
      ],
      [
        3,
        makeNode({
          node_id: 3,
          long_name: 'MqttOnly',
          heard_via_mqtt: true,
          heard_via_mqtt_only: true,
        }),
      ],
    ]);
    render(
      <NodeListPanel
        nodes={nodes}
        myNodeNum={1}
        onNodeClick={vi.fn()}
        locationFilter={defaultFilter}
        onToggleFavorite={vi.fn()}
        mode="meshtastic"
        selectedGroupId={MESHTASTIC_CONTACT_GROUP_BUILTIN_RF_MQTT}
        onGroupChange={vi.fn()}
        onManageGroups={vi.fn()}
        groups={[]}
        groupMemberIds={new Set()}
      />,
    );
    expect(screen.getByText('Hybrid')).toBeInTheDocument();
    expect(screen.queryByText('MqttOnly')).not.toBeInTheDocument();
    expect(screen.queryByText('Me')).not.toBeInTheDocument();
  });

  it('does not show Import Contacts button when onImportContacts not provided in meshcore mode', () => {
    render(
      <NodeListPanel
        nodes={new Map()}
        myNodeNum={0}
        onNodeClick={vi.fn()}
        locationFilter={defaultFilter}
        onToggleFavorite={vi.fn()}
        mode="meshcore"
      />,
    );
    expect(screen.queryByRole('button', { name: 'Import Contacts' })).not.toBeInTheDocument();
  });
});
