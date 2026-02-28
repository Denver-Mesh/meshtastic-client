import { contextBridge, ipcRenderer } from "electron";

export interface BluetoothDevice {
  deviceId: string;
  deviceName: string;
}

export interface SerialPort {
  portId: string;
  displayName: string;
  portName: string;
  vendorId?: string;
  productId?: string;
}

contextBridge.exposeInMainWorld("electronAPI", {
  // ─── Database operations ────────────────────────────────────────
  db: {
    saveMessage: (message: {
      sender_id: number;
      sender_name: string;
      payload: string;
      channel: number;
      timestamp: number;
      to?: number;
    }) => ipcRenderer.invoke("db:saveMessage", message),

    getMessages: (channel?: number, limit?: number) =>
      ipcRenderer.invoke("db:getMessages", channel, limit),

    saveNode: (node: {
      node_id: number;
      long_name: string;
      short_name: string;
      hw_model: string;
      snr: number;
      battery: number;
      last_heard: number;
      latitude: number;
      longitude: number;
    }) => ipcRenderer.invoke("db:saveNode", node),

    getNodes: () => ipcRenderer.invoke("db:getNodes"),
    clearMessages: () => ipcRenderer.invoke("db:clearMessages"),
    clearNodes: () => ipcRenderer.invoke("db:clearNodes"),
    deleteNode: (nodeId: number) => ipcRenderer.invoke("db:deleteNode", nodeId),
    updateMessageStatus: (packetId: number, status: string, error?: string) =>
      ipcRenderer.invoke("db:updateMessageStatus", packetId, status, error),
    exportDb: () => ipcRenderer.invoke("db:export"),
    importDb: () => ipcRenderer.invoke("db:import"),
  },

  // ─── Bluetooth device selection ─────────────────────────────────
  // Main process intercepts select-bluetooth-device and sends the
  // device list here. Renderer shows a picker, then calls select/cancel.
  onBluetoothDevicesDiscovered: (callback: (devices: BluetoothDevice[]) => void) => {
    const handler = (_event: unknown, devices: BluetoothDevice[]) =>
      callback(devices);
    ipcRenderer.on("bluetooth-devices-discovered", handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener("bluetooth-devices-discovered", handler);
    };
  },

  selectBluetoothDevice: (deviceId: string) => {
    ipcRenderer.send("bluetooth-device-selected", deviceId);
  },

  cancelBluetoothSelection: () => {
    ipcRenderer.send("bluetooth-device-cancelled");
  },

  // ─── Serial port selection ──────────────────────────────────────
  // Main process intercepts select-serial-port and sends the port
  // list here. Renderer shows a picker, then calls selectSerialPort.
  onSerialPortsDiscovered: (callback: (ports: SerialPort[]) => void) => {
    const handler = (_event: unknown, ports: SerialPort[]) =>
      callback(ports);
    ipcRenderer.on("serial-ports-discovered", handler);
    return () => {
      ipcRenderer.removeListener("serial-ports-discovered", handler);
    };
  },

  selectSerialPort: (portId: string) => {
    ipcRenderer.send("serial-port-selected", portId);
  },

  cancelSerialSelection: () => {
    ipcRenderer.send("serial-port-cancelled");
  },

  // ─── Session management ────────────────────────────────────────
  clearSessionData: () => ipcRenderer.invoke("session:clearData"),

  // ─── Connection status ─────────────────────────────────────────
  notifyDeviceConnected: () => ipcRenderer.send("device-connected"),
  notifyDeviceDisconnected: () => ipcRenderer.send("device-disconnected"),
  setTrayUnread: (count: number) => ipcRenderer.send("set-tray-unread", count),
});
