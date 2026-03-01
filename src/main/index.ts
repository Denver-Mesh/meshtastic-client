import { app, BrowserWindow, ipcMain, dialog, Tray, Menu, nativeImage } from "electron";
import path from "path";
import { initDatabase, getDatabase, exportDatabase, mergeDatabase, closeDatabase } from "./database";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

// Pending Bluetooth callback from Chromium's Web Bluetooth API
let pendingBluetoothCallback: ((deviceId: string) => void) | null = null;
// Pending Serial callback (mirrors the BLE pattern)
let pendingSerialCallback: ((portId: string) => void) | null = null;

// ─── Global error handlers (prevent silent crashes in packaged app) ──
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  try {
    dialog.showErrorBox(
      "Mesh-Client — Unexpected Error",
      `${error.message}\n\n${error.stack ?? ""}`
    );
  } catch { /* dialog may not be available during early startup */ }
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

// Enable Web Bluetooth feature flag
app.commandLine.appendSwitch("enable-features", "WebBluetooth");
// Enable Web Serial (experimental)
app.commandLine.appendSwitch(
  "enable-blink-features",
  "Serial"
);

function buildTrayIcon(hasUnread: boolean): Electron.NativeImage {
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, "icon.png")
    : path.join(__dirname, "../../resources/icon.png");

  const size = process.platform === "darwin" ? 16 : 22;
  const base = nativeImage.createFromPath(iconPath).resize({ width: size, height: size });

  if (!hasUnread) return base;

  // Overlay a 4px red dot in the top-right corner
  const bitmap = Buffer.from(base.toBitmap());
  const dotR = 2;
  const dotCx = size - dotR - 1;
  const dotCy = dotR + 1;

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const dx = px - dotCx;
      const dy = py - dotCy;
      if (dx * dx + dy * dy <= dotR * dotR) {
        const idx = (py * size + px) * 4;
        bitmap[idx]     = 239; // R
        bitmap[idx + 1] = 68;  // G
        bitmap[idx + 2] = 68;  // B
        bitmap[idx + 3] = 255; // A
      }
    }
  }

  return nativeImage.createFromBitmap(bitmap, { width: size, height: size });
}

function setupTray(window: BrowserWindow) {
  tray = new Tray(buildTrayIcon(false));
  tray.setToolTip("Mesh-Client");
  tray.on("click", () => {
    window.show();
    window.focus();
  });
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Show Mesh-Client", click: () => { window.show(); window.focus(); } },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ])
  );
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "Meshtastic Client",
    // In packaged mode, electron-builder sets the app icon via mac.icon config.
    // Only set the icon manually during development.
    icon: app.isPackaged ? undefined : path.join(__dirname, "../../resources/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // ─── Web Bluetooth: Device Selection ───────────────────────────────
  // When the renderer calls navigator.bluetooth.requestDevice(),
  // Chromium fires this event. We intercept it to build our own picker
  // in the renderer instead of the (missing) native Chromium dialog.
  mainWindow.webContents.on(
    "select-bluetooth-device",
    (event, devices, callback) => {
      event.preventDefault();

      // Chromium fires this event repeatedly during discovery with an
      // updated device list and a NEW callback each time. Simply overwrite
      // the reference — Chromium manages the lifecycle of old callbacks.
      pendingBluetoothCallback = callback;

      // Deduplicate devices by ID before sending to renderer
      const seen = new Map<string, { deviceId: string; deviceName: string }>();
      for (const d of devices) {
        seen.set(d.deviceId, {
          deviceId: d.deviceId,
          deviceName: d.deviceName || "Unknown Device",
        });
      }
      mainWindow?.webContents.send(
        "bluetooth-devices-discovered",
        Array.from(seen.values())
      );
    }
  );

  // ─── Web Serial: Port Selection ────────────────────────────────────
  // Electron requires this handler for navigator.serial.requestPort()
  // to work. Without it, the Web Serial API throws.
  mainWindow.webContents.session.on(
    "select-serial-port",
    (event, portList, _webContents, callback) => {
      event.preventDefault();

      // Store callback so we can resolve it when the user picks a port
      pendingSerialCallback = callback;

      // Send port list to renderer for selection
      mainWindow?.webContents.send(
        "serial-ports-discovered",
        portList.map((p) => ({
          portId: p.portId,
          displayName:
            p.displayName || p.portName || `Port ${p.portId}`,
          portName: p.portName || "",
          vendorId: p.vendorId,
          productId: p.productId,
        }))
      );
    }
  );

  // ─── Device Permission: Serial & Bluetooth ───────────────────────────────────
  // Required in Electron 20+ — without this, Chromium shows a blank/black
  // permission overlay when navigator.bluetooth.requestDevice() is called.
  mainWindow.webContents.session.setDevicePermissionHandler((details) => {
    if (details.deviceType === "bluetooth" || details.deviceType === "serial") {
      return true;
    }
    return false;
  });

  // ─── Bluetooth Pairing ─────────────────────────────────────────────
  mainWindow.webContents.session.setBluetoothPairingHandler(
    (details, callback) => {
      // Auto-confirm pairing (Meshtastic doesn't use PIN)
      callback({ confirmed: true });
    }
  );

  // ─── Renderer crash / load failure detection ──────────────────────
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    console.error("Renderer process gone:", details.reason, details.exitCode);
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDesc, url) => {
    console.error("Failed to load:", errorCode, errorDesc, url);
  });

  // Load the app
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    const indexPath = path.join(__dirname, "../../dist/renderer/index.html");
    // Startup diagnostics for troubleshooting packaged app issues
    console.log("[Startup] app.isPackaged:", app.isPackaged);
    console.log("[Startup] __dirname:", __dirname);
    console.log("[Startup] Renderer path:", indexPath);
    console.log("[Startup] process.resourcesPath:", process.resourcesPath);
    console.log("[Startup] userData:", app.getPath("userData"));
    mainWindow.loadFile(indexPath);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // ─── Connection status tracking ──
  let isConnected = false;

  ipcMain.on('device-connected', () => {
    isConnected = true;
  });

  ipcMain.on('device-disconnected', () => {
    isConnected = false;
  });

  // Handle window close event
  mainWindow.on('close', (event) => {
    if (isConnected) {
      event.preventDefault();
      if (process.platform === 'darwin') {
        mainWindow.hide();
      } else {
        mainWindow.minimize();
      }
    } else {
      app.quit();
    }
  });

  setupTray(mainWindow);
}

// ─── Tray unread badge ──────────────────────────────────────────────
ipcMain.on("set-tray-unread", (_event, count: number) => {
  tray?.setImage(buildTrayIcon(count > 0));
  tray?.setToolTip(count > 0 ? `Mesh-Client (${count} unread)` : "Mesh-Client");
  if (process.platform === "darwin") {
    app.dock.setBadge(count > 0 ? String(count) : "");
  }
});

// ─── IPC: Bluetooth device selected by user ────────────────────────
ipcMain.on("bluetooth-device-selected", (_event, deviceId: string) => {
  if (pendingBluetoothCallback) {
    pendingBluetoothCallback(deviceId);
    pendingBluetoothCallback = null;
  }
});

// ─── IPC: Cancel Bluetooth selection ────────────────────────────────
ipcMain.on("bluetooth-device-cancelled", () => {
  if (pendingBluetoothCallback) {
    pendingBluetoothCallback(""); // Empty string cancels the request
    pendingBluetoothCallback = null;
  }
});

// ─── IPC: Serial port selected by user ──────────────────────────────
ipcMain.on("serial-port-selected", (_event, portId: string) => {
  if (pendingSerialCallback) {
    pendingSerialCallback(portId);
    pendingSerialCallback = null;
  }
});

// ─── IPC: Cancel Serial selection ───────────────────────────────────
ipcMain.on("serial-port-cancelled", () => {
  if (pendingSerialCallback) {
    pendingSerialCallback(""); // Empty string cancels the request
    pendingSerialCallback = null;
  }
});

// ─── IPC: Database operations ──────────────────────────────────────
ipcMain.handle("db:saveMessage", (_event, message) => {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO messages (sender_id, sender_name, payload, channel, timestamp, packet_id, status, error, emoji, reply_id, to_node)
    VALUES (@sender_id, @sender_name, @payload, @channel, @timestamp, @packet_id, @status, @error, @emoji, @reply_id, @to_node)
  `);
  return stmt.run({
    sender_id: message.sender_id,
    sender_name: message.sender_name,
    payload: message.payload,
    channel: message.channel,
    timestamp: message.timestamp,
    packet_id: message.packetId ?? null,
    status: message.status ?? null,
    error: message.error ?? null,
    emoji: message.emoji ?? null,
    reply_id: message.replyId ?? null,
    to_node: message.to ?? null,
  });
});

ipcMain.handle("db:getMessages", (_event, channel?: number, limit = 200) => {
  const db = getDatabase();
  const columns = `id, sender_id, sender_name, payload, channel, timestamp,
       packet_id AS packetId, status, error, emoji, reply_id AS replyId, to_node`;
  let rows: any[];
  if (channel !== undefined && channel !== null) {
    rows = db
      .prepare(
        `SELECT ${columns} FROM messages WHERE channel = ? ORDER BY timestamp DESC LIMIT ?`
      )
      .all(channel, limit);
  } else {
    rows = db
      .prepare(`SELECT ${columns} FROM messages ORDER BY timestamp DESC LIMIT ?`)
      .all(limit);
  }
  // Map to_node back to `to` for the renderer
  return rows.map((r: any) => {
    const { to_node, ...rest } = r;
    return { ...rest, to: to_node ?? undefined };
  });
});

ipcMain.handle("db:saveNode", (_event, node) => {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO nodes (node_id, long_name, short_name, hw_model, snr, rssi, battery, last_heard, latitude, longitude, role, hops_away, via_mqtt, voltage, channel_utilization, air_util_tx, altitude)
    VALUES (@node_id, @long_name, @short_name, @hw_model, @snr, @rssi, @battery, @last_heard, @latitude, @longitude, @role, @hops_away, @via_mqtt, @voltage, @channel_utilization, @air_util_tx, @altitude)
  `);
  return stmt.run({
    role: null,
    hops_away: null,
    rssi: null,
    voltage: null,
    channel_utilization: null,
    air_util_tx: null,
    altitude: null,
    ...node,
    via_mqtt: node.via_mqtt != null ? (node.via_mqtt ? 1 : 0) : null,
  });
});

ipcMain.handle("db:getNodes", () => {
  const db = getDatabase();
  return db.prepare("SELECT * FROM nodes ORDER BY last_heard DESC").all();
});

ipcMain.handle("db:clearMessages", () => {
  const db = getDatabase();
  return db.prepare("DELETE FROM messages").run();
});

ipcMain.handle("db:clearNodes", () => {
  const db = getDatabase();
  return db.prepare("DELETE FROM nodes").run();
});

ipcMain.handle("db:deleteNode", (_event, nodeId: number) => {
  const db = getDatabase();
  return db.prepare("DELETE FROM nodes WHERE node_id = ?").run(nodeId);
});

ipcMain.handle("db:deleteNodesByAge", (_event, days: number) => {
  const cutoff = Math.floor(Date.now() / 1000) - days * 86400;
  return getDatabase().prepare("DELETE FROM nodes WHERE last_heard < ?").run(cutoff);
});

ipcMain.handle("db:pruneNodesByCount", (_event, maxCount: number) => {
  return getDatabase().prepare(
    "DELETE FROM nodes WHERE node_id NOT IN (SELECT node_id FROM nodes ORDER BY last_heard DESC LIMIT ?)"
  ).run(maxCount);
});

ipcMain.handle("db:deleteNodesBatch", (_event, nodeIds: number[]) => {
  if (!nodeIds.length) return 0;
  const placeholders = nodeIds.map(() => "?").join(", ");
  const result = getDatabase().prepare(`DELETE FROM nodes WHERE node_id IN (${placeholders})`).run(...nodeIds);
  return result.changes;
});

ipcMain.handle("db:clearMessagesByChannel", (_event, channel: number) => {
  return getDatabase().prepare("DELETE FROM messages WHERE channel = ?").run(channel);
});

ipcMain.handle("db:getMessageChannels", () => {
  return getDatabase().prepare("SELECT DISTINCT channel FROM messages ORDER BY channel").all();
});

// ─── IPC: Update message delivery status ────────────────────────────
ipcMain.handle(
  "db:updateMessageStatus",
  (_event, packetId: number, status: string, error?: string) => {
    const db = getDatabase();
    return db
      .prepare("UPDATE messages SET status = ?, error = ? WHERE packet_id = ?")
      .run(status, error ?? null, packetId);
  }
);

// ─── IPC: Export database ───────────────────────────────────────────
ipcMain.handle("db:export", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "Export Database",
    defaultPath: `mesh-client-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
  });
  if (!result.canceled && result.filePath) {
    exportDatabase(result.filePath);
    return result.filePath;
  }
  return null;
});

// ─── IPC: Import / merge database ───────────────────────────────────
ipcMain.handle("db:import", async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    title: "Import Database",
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
    properties: ["openFile"],
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const summary = mergeDatabase(result.filePaths[0]);
    return summary;
  }
  return null;
});

// ─── IPC: Clear Chromium session data (BLE cache, cookies, etc.) ──
ipcMain.handle("session:clearData", async () => {
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) return;
  await win.webContents.session.clearStorageData({
    storages: [
      "cookies",
      "localstorage",
      "cachestorage",
      "shadercache",
      "serviceworkers",
    ],
  });
  await win.webContents.session.clearCache();
});

// ─── App lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  try {
    initDatabase();
    createWindow();
  } catch (error) {
    console.error("Fatal startup error:", error);
    dialog.showErrorBox(
      "Mesh-Client — Startup Error",
      `The application failed to start:\n\n${error instanceof Error ? error.message : String(error)}\n\nPlease report this issue.`
    );
    app.quit();
    return;
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      try {
        createWindow();
      } catch (error) {
        console.error("Window creation error:", error);
      }
    } else {
      mainWindow?.show(); // Restore hidden window on dock click
    }
  });
});

app.on("before-quit", () => {
  closeDatabase();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
