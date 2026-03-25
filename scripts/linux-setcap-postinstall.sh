#!/usr/bin/env sh
set -u

APP_BIN="/opt/mesh-client/mesh-client"

if [ ! -x "$APP_BIN" ]; then
  echo "mesh-client postinstall: binary not found at $APP_BIN; skipping setcap"
  exit 0
fi

if ! command -v setcap >/dev/null 2>&1; then
  echo "mesh-client postinstall: setcap not installed; skipping CAP_NET_RAW setup"
  exit 0
fi

if setcap cap_net_raw+eip "$APP_BIN"; then
  echo "mesh-client postinstall: applied cap_net_raw to $APP_BIN"
  exit 0
fi

echo "mesh-client postinstall: failed to apply cap_net_raw to $APP_BIN; BLE may need manual setup"
exit 0
