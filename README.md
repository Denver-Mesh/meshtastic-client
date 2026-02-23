# Electastic

A cross-platform Meshtastic desktop client for **Mac**, **Linux**, and **Windows**.

Connect to your Meshtastic devices over Bluetooth, USB Serial, or WiFi — no python, no phone required.

> Originally ported from [Joey's (NV0N) Meshtastic Mac Client](https://github.com/rinchen/meshtastic_mac_client) and the Denver Mesh community. This is a full rewrite in Electron + React + TypeScript to support all platforms.

> [!WARNING]
> This is an early release. A lot of things might be buggy. This may or may not be updated over the coming days/weeks. So far it has only been tested on a **Mac** with a **T-Deck** in Bluetooth Pairing Mode.

---

## Setup

### Prerequisites

- **Node.js** 18+ (LTS recommended)
- **npm** 9+
- A Meshtastic device

### Mac

```bash
git clone https://github.com/defidude/Electastic.git
cd Elecstatic
npm install
npm start
```

You may need to allow Bluetooth access in **System Settings > Privacy & Security > Bluetooth**.

### Linux

```bash
git clone https://github.com/defidude/Electastic.git
cd Elecstatic
npm install
npm start
```

BLE requires BlueZ installed. If Bluetooth doesn't work, try launching with `--enable-features=WebBluetooth`.

### Windows

```bash
git clone https://github.com/defidude/Electastic.git
cd Elecstatic
npm install
npm start
```

Should work out of the box. If serial isn't detected, make sure you have the correct USB drivers for your device.

---

## Building

```bash
# Production build
npm run build

# Run the production build
npm start

# Package as distributable
npm run dist:mac      # macOS .dmg
npm run dist:linux    # Linux .AppImage / .deb
npm run dist:win      # Windows .exe
```

---

## Features

- **Bluetooth LE** — pair wirelessly with nearby Meshtastic devices
- **USB Serial** — plug in via USB cable
- **WiFi/HTTP** — connect to network-enabled nodes
- **Chat** — send/receive messages across channels with delivery indicators (ACK/NAK) and emoji reactions (tapback)
- **Node List** — all discovered nodes with SNR, battery, GPS, last heard
- **Node Detail Modal** — click any node or sender name for full info
- **Map** — interactive OpenStreetMap with node positions
- **Telemetry** — battery voltage and signal quality charts
- **Radio Config** — region, modem preset, device role, GPS, power, Bluetooth, display settings
- **Admin** — reboot, shutdown, factory reset, trace route, DB export/import
- **Persistent Storage** — messages and nodes saved locally via SQLite
- **Dark UI** — custom scrollbar, tab icons, polished chat bubbles

---

## Connection Types

| Platform | Bluetooth | Serial | HTTP |
|----------|-----------|--------|------|
| macOS    | Yes       | Yes    | Yes  |
| Windows  | Yes       | Yes    | Yes  |
| Linux    | Partial   | Yes    | Yes  |

---

## Tech Stack

| Component  | Technology                                |
|------------|-------------------------------------------|
| Desktop    | Electron                                  |
| UI         | React 19 + TypeScript                     |
| Styling    | Tailwind CSS v4                           |
| Meshtastic | @meshtastic/core (JSR)                    |
| Maps       | Leaflet + OpenStreetMap                   |
| Charts     | Recharts                                  |
| Database   | SQLite (better-sqlite3)                   |
| Build      | esbuild + Vite + electron-builder         |

---

## Project Structure

```
src/
├── main/           # Electron main process (window, BLE handler, SQLite)
├── preload/        # Context bridge (IPC)
└── renderer/       # React app
    ├── components/ # All UI panels (Chat, Nodes, Map, Config, etc.)
    ├── hooks/      # useDevice — Meshtastic device state management
    └── lib/        # Transport setup, TypeScript types
```

---

## License

MIT — see [LICENSE](LICENSE)

## Credits

See [CREDITS.md](CREDITS.md). Special thanks to **Joey (NV0N)** for the original Meshtastic Mac Client that inspired this project, and the Denver Mesh community.
