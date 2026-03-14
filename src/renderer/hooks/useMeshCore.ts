import { SerialConnection, WebBleConnection, WebSerialConnection } from '@liamcottle/meshcore.js';
import { useCallback, useRef, useState } from 'react';

import { meshcoreContactToMeshNode, pubkeyToNodeId } from '../lib/meshcoreUtils';
import type { ChatMessage, DeviceState, MeshNode } from '../lib/types';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface SerialConnectionInstance extends InstanceType<typeof SerialConnection> {}

/** TCP connection implemented over IPC bridge (main-process net.Socket). */
class IpcTcpConnection {
  private host: string;
  private port: number;
  private inner: SerialConnectionInstance | null = null;
  private cleanupFns: (() => void)[] = [];

  constructor(host: string, port: number) {
    this.host = host;
    this.port = port;
  }

  async connect() {
    // Create a subclass that wires write → IPC
    class TcpOverIpc extends (SerialConnection as unknown as new () => SerialConnectionInstance) {
      async write(bytes: Uint8Array) {
        await window.electronAPI.meshcore.tcp.write(Array.from(bytes));
      }
      async close() {
        await window.electronAPI.meshcore.tcp.disconnect();
      }
    }

    const instance = new TcpOverIpc() as unknown as SerialConnectionInstance;
    this.inner = instance;

    const offData = window.electronAPI.meshcore.tcp.onData((bytes) => {
      void instance.onDataReceived(new Uint8Array(bytes));
    });
    const offDisc = window.electronAPI.meshcore.tcp.onDisconnected(() => {
      instance.onDisconnected();
    });
    this.cleanupFns = [offData, offDisc];

    await window.electronAPI.meshcore.tcp.connect(this.host, this.port);
    await instance.onConnected();
  }

  get connection() {
    return this.inner;
  }

  cleanup() {
    this.cleanupFns.forEach((fn) => fn());
    this.cleanupFns = [];
  }
}

export interface MeshCoreSelfInfo {
  name: string;
  publicKey: Uint8Array;
  type: number;
  txPower: number;
  radioFreq: number;
}

// The connection object returned by meshcore.js is typed loosely — use unknown and cast
interface MeshCoreConnection {
  on(event: string, cb: (...args: unknown[]) => void): void;
  off(event: string, cb: (...args: unknown[]) => void): void;
  once(event: string, cb: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  close(): Promise<void>;
  getSelfInfo(timeout?: number): Promise<MeshCoreSelfInfo>;
  getContacts(): Promise<MeshCoreContactRaw[]>;
  getChannels(): Promise<MeshCoreChannelRaw[]>;
  sendFloodAdvert(): Promise<void>;
  sendTextMessage(pubKey: Uint8Array, text: string, type?: number): Promise<unknown>;
  sendChannelTextMessage(channelIdx: number, text: string): Promise<void>;
}

interface MeshCoreContactRaw {
  publicKey: Uint8Array;
  type: number;
  advName: string;
  lastAdvert: number;
  advLat: number;
  advLon: number;
}

interface MeshCoreChannelRaw {
  channelIdx: number;
  name: string;
}

const INITIAL_STATE: DeviceState = {
  status: 'disconnected',
  myNodeNum: 0,
  connectionType: null,
};

export function useMeshCore() {
  const [state, setState] = useState<DeviceState>(INITIAL_STATE);
  const [nodes, setNodes] = useState<Map<number, MeshNode>>(new Map());
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [channels, setChannels] = useState<{ index: number; name: string }[]>([]);
  const [selfInfo, setSelfInfo] = useState<MeshCoreSelfInfo | null>(null);

  const connRef = useRef<MeshCoreConnection | null>(null);
  const ipcTcpRef = useRef<IpcTcpConnection | null>(null);
  // Map pubKeyPrefix (6-byte hex) → nodeId for DM routing
  const pubKeyPrefixMapRef = useRef<Map<string, number>>(new Map());
  // Full pubKey → nodeId for sending
  const pubKeyMapRef = useRef<Map<number, Uint8Array>>(new Map());

  const addMessage = useCallback((msg: ChatMessage) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateNode = useCallback((node: MeshNode) => {
    setNodes((prev) => {
      const next = new Map(prev);
      next.set(node.node_id, node);
      return next;
    });
  }, []);

  const setupEventListeners = useCallback(
    (conn: MeshCoreConnection) => {
      // Push: periodic advert (auto-add mode)
      conn.on('0x80', (data: unknown) => {
        const d = data as {
          publicKey: Uint8Array;
          advLat: number;
          advLon: number;
          lastAdvert: number;
        };
        const nodeId = pubkeyToNodeId(d.publicKey);
        setNodes((prev) => {
          const existing = prev.get(nodeId);
          if (!existing) return prev;
          const next = new Map(prev);
          next.set(nodeId, {
            ...existing,
            last_heard: d.lastAdvert,
            latitude: d.advLat !== 0 ? d.advLat / 1e7 : existing.latitude,
            longitude: d.advLon !== 0 ? d.advLon / 1e7 : existing.longitude,
          });
          return next;
        });
      });

      // Push: new contact discovered (manual-add mode)
      conn.on('0x8A', (data: unknown) => {
        const d = data as MeshCoreContactRaw;
        const node = meshcoreContactToMeshNode(d);
        pubKeyMapRef.current.set(node.node_id, d.publicKey);
        const prefix = Array.from(d.publicKey.slice(0, 6))
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        pubKeyPrefixMapRef.current.set(prefix, node.node_id);
        updateNode(node);
      });

      // Push: message waiting — fetch it
      conn.on('0x83', () => {
        // Trigger sync of next waiting message
        void (async () => {
          try {
            // sendCommandSyncNextMessage equivalent — use the raw command via connection internals
            // meshcore.js doesn't expose a high-level waitingMessages() fetch, so we listen on
            // ContactMsgRecv / ChannelMsgRecv which fire when the device pushes a message.
          } catch (e) {
            console.warn('[useMeshCore] MsgWaiting sync error', e);
          }
        })();
      });

      // Incoming DM
      conn.on('7', (data: unknown) => {
        const d = data as { pubKeyPrefix: Uint8Array; text: string; senderTimestamp: number };
        const prefix = Array.from(d.pubKeyPrefix)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('');
        const senderId = pubKeyPrefixMapRef.current.get(prefix) ?? 0;
        const sender = nodes.get(senderId);
        addMessage({
          sender_id: senderId,
          sender_name: sender?.long_name ?? `Node-${senderId.toString(16).toUpperCase()}`,
          payload: d.text,
          channel: -1, // DM channel sentinel
          timestamp: d.senderTimestamp * 1000,
          status: 'acked',
        });
      });

      // Incoming channel message
      conn.on('8', (data: unknown) => {
        const d = data as { channelIdx: number; text: string; senderTimestamp: number };
        addMessage({
          sender_id: 0, // unknown sender in channel mode
          sender_name: 'Unknown',
          payload: d.text,
          channel: d.channelIdx,
          timestamp: d.senderTimestamp * 1000,
          status: 'acked',
        });
      });

      conn.on('disconnected', () => {
        setState((prev) => ({ ...prev, status: 'disconnected' }));
      });
    },
    [addMessage, updateNode, nodes],
  );

  const connect = useCallback(
    async (type: 'ble' | 'serial' | 'tcp', tcpHost?: string) => {
      setState({
        status: 'connecting',
        myNodeNum: 0,
        connectionType: type === 'tcp' ? 'http' : type,
      });

      try {
        let conn: MeshCoreConnection;

        if (type === 'ble') {
          conn = (await (
            WebBleConnection as unknown as { open(): Promise<unknown> }
          ).open()) as MeshCoreConnection;
        } else if (type === 'serial') {
          conn = (await (
            WebSerialConnection as unknown as { open(): Promise<unknown> }
          ).open()) as MeshCoreConnection;
        } else {
          // tcp
          const host = tcpHost ?? 'localhost';
          const tcpConn = new IpcTcpConnection(host, 4403);
          ipcTcpRef.current = tcpConn;
          await tcpConn.connect();
          conn = tcpConn.connection as unknown as MeshCoreConnection;
        }

        connRef.current = conn;
        setupEventListeners(conn);

        setState((prev) => ({ ...prev, status: 'connected' }));

        // Fetch self info, contacts, channels
        const info = await conn.getSelfInfo(5000);
        setSelfInfo(info);

        const myNodeId = pubkeyToNodeId(info.publicKey);
        setState((prev) => ({ ...prev, myNodeNum: myNodeId, status: 'configured' }));

        const contacts = await conn.getContacts();
        const newNodes = new Map<number, MeshNode>();
        for (const contact of contacts) {
          const node = meshcoreContactToMeshNode(contact);
          newNodes.set(node.node_id, node);
          pubKeyMapRef.current.set(node.node_id, contact.publicKey);
          const prefix = Array.from(contact.publicKey.slice(0, 6))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
          pubKeyPrefixMapRef.current.set(prefix, node.node_id);
        }
        setNodes(newNodes);

        const rawChannels = await conn.getChannels();
        setChannels(rawChannels.map((c) => ({ index: c.channelIdx, name: c.name })));
      } catch (err) {
        console.error('[useMeshCore] connect error', err);
        setState({ status: 'disconnected', myNodeNum: 0, connectionType: null });
        ipcTcpRef.current?.cleanup();
        ipcTcpRef.current = null;
      }
    },
    [setupEventListeners],
  );

  const disconnect = useCallback(async () => {
    try {
      await connRef.current?.close();
    } catch {
      // ignore
    }
    ipcTcpRef.current?.cleanup();
    ipcTcpRef.current = null;
    connRef.current = null;
    pubKeyMapRef.current.clear();
    pubKeyPrefixMapRef.current.clear();
    setNodes(new Map());
    setMessages([]);
    setChannels([]);
    setSelfInfo(null);
    setState(INITIAL_STATE);
  }, []);

  const sendMessage = useCallback(
    async (text: string, channelIdx: number, destNodeId?: number) => {
      if (!connRef.current) return;
      if (destNodeId !== undefined) {
        const pubKey = pubKeyMapRef.current.get(destNodeId);
        if (!pubKey) {
          console.warn('[useMeshCore] sendMessage: no pubKey for', destNodeId);
          return;
        }
        await connRef.current.sendTextMessage(pubKey, text);
      } else {
        await connRef.current.sendChannelTextMessage(channelIdx, text);
      }
      // Optimistically add own message
      addMessage({
        sender_id: state.myNodeNum,
        sender_name: selfInfo?.name ?? 'Me',
        payload: text,
        channel: channelIdx,
        timestamp: Date.now(),
        status: 'acked',
        to: destNodeId,
      });
    },
    [addMessage, selfInfo, state.myNodeNum],
  );

  const sendAdvert = useCallback(async () => {
    if (!connRef.current) return;
    await connRef.current.sendFloodAdvert();
  }, []);

  // No-op stubs to satisfy the same interface shape used in App.tsx
  const noopAsync = useCallback(async () => {}, []);
  const noopVoid = useCallback(() => {}, []);

  return {
    state,
    nodes,
    messages,
    channels,
    selfInfo,
    connect,
    disconnect,
    sendMessage,
    sendAdvert,
    // Stubs for interface compatibility
    mqttStatus: 'disconnected' as const,
    selfNodeId: state.myNodeNum,
    getNodes: useCallback(() => Array.from(nodes.values()), [nodes]),
    getFullNodeLabel: useCallback(
      (id: number) => nodes.get(id)?.long_name ?? id.toString(16).toUpperCase(),
      [nodes],
    ),
    getPickerStyleNodeLabel: useCallback(
      (id: number) => nodes.get(id)?.long_name ?? id.toString(16).toUpperCase(),
      [nodes],
    ),
    traceRouteResults: new Map<number, { route: number[]; from: number }>(),
    queueStatus: null,
    deviceLogs: [] as { ts: number; level: string; source: string; message: string }[],
    neighborInfo: new Map<number, unknown>(),
    waypoints: [] as unknown[],
    telemetry: [] as unknown[],
    signalTelemetry: [] as unknown[],
    environmentTelemetry: [] as unknown[],
    channelConfigs: [] as unknown[],
    moduleConfigs: {} as Record<string, unknown>,
    deviceOwner: null,
    ourPosition: null,
    gpsLoading: false,
    telemetryEnabled: null,
    sendReaction: noopAsync,
    traceRoute: noopAsync,
    requestPosition: noopAsync,
    deleteNode: noopAsync,
    setNodeFavorited: noopAsync,
    reboot: noopAsync,
    shutdown: noopAsync,
    factoryReset: noopAsync,
    resetNodeDb: noopAsync,
    commitConfig: noopAsync,
    setConfig: noopAsync,
    setDeviceChannel: noopAsync,
    clearChannel: noopAsync,
    setOwner: noopAsync,
    rebootOta: noopAsync,
    enterDfuMode: noopAsync,
    factoryResetConfig: noopAsync,
    sendWaypoint: noopAsync,
    deleteWaypoint: noopAsync,
    setModuleConfig: noopAsync,
    setCannedMessages: noopAsync,
    requestRefresh: noopAsync,
    refreshOurPosition: noopAsync,
    sendPositionToDevice: noopAsync,
    updateGpsInterval: noopVoid,
    refreshNodesFromDb: noopAsync,
    refreshMessagesFromDb: noopAsync,
    connectAutomatic: noopAsync,
    telemetryDeviceUpdateInterval: undefined as number | undefined,
  };
}
