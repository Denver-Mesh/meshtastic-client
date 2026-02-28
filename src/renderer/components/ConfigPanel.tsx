import { useState, useEffect } from "react";

interface ChannelConfig {
  index: number;
  name: string;
  role: number;
  psk: Uint8Array;
}

interface Props {
  onSetConfig: (config: unknown) => Promise<void>;
  onCommit: () => Promise<void>;
  onSetChannel: (config: {
    index: number;
    role: number;
    settings: { name: string; psk: Uint8Array };
  }) => Promise<void>;
  onClearChannel: (index: number) => Promise<void>;
  channelConfigs: ChannelConfig[];
  isConnected: boolean;
}

const REGIONS = [
  { value: 0, label: "Unset" },
  { value: 1, label: "US" },
  { value: 2, label: "EU_433" },
  { value: 3, label: "EU_868" },
  { value: 4, label: "CN" },
  { value: 5, label: "JP" },
  { value: 6, label: "ANZ" },
  { value: 7, label: "KR" },
  { value: 8, label: "TW" },
  { value: 9, label: "RU" },
  { value: 10, label: "IN" },
  { value: 11, label: "NZ_865" },
  { value: 12, label: "TH" },
  { value: 13, label: "UA_433" },
  { value: 14, label: "UA_868" },
  { value: 15, label: "MY_433" },
  { value: 16, label: "MY_919" },
  { value: 17, label: "SG_923" },
  { value: 18, label: "LORA_24" },
];

const MODEM_PRESETS = [
  { value: 0, label: "Long Fast" },
  { value: 1, label: "Long Slow" },
  { value: 2, label: "Long Moderate" },
  { value: 3, label: "Short Fast" },
  { value: 4, label: "Short Slow" },
  { value: 5, label: "Medium Fast" },
  { value: 6, label: "Medium Slow" },
];

const DEVICE_ROLES = [
  { value: 0, label: "Client", description: "Normal client mode" },
  { value: 1, label: "Client Mute", description: "Client that does not transmit" },
  { value: 2, label: "Router", description: "Dedicated router/repeater" },
  { value: 3, label: "Router Client", description: "Router + client mode" },
  { value: 5, label: "Tracker", description: "GPS tracker only" },
  { value: 6, label: "Sensor", description: "Telemetry sensor node" },
  { value: 7, label: "TAK", description: "TAK-enabled device" },
  { value: 8, label: "Client Hidden", description: "Client, hidden from node list" },
  { value: 9, label: "Lost and Found", description: "Broadcasts position for recovery" },
  { value: 10, label: "TAK Tracker", description: "TAK tracker mode" },
];

const DISPLAY_UNITS = [
  { value: 0, label: "Metric" },
  { value: 1, label: "Imperial" },
];

/** Reusable select component */
function ConfigSelect({
  label,
  value,
  options,
  onChange,
  disabled,
  description,
}: {
  label: string;
  value: number;
  options: Array<{ value: number; label: string; description?: string }>;
  onChange: (val: number) => void;
  disabled: boolean;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-muted">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        className="w-full px-3 py-2 bg-secondary-dark rounded-lg text-gray-200 border border-gray-600 focus:border-brand-green focus:outline-none disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

/** Reusable toggle switch */
function ConfigToggle({
  label,
  checked,
  onChange,
  disabled,
  description,
}: {
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled: boolean;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted">{label}</label>
        <button
          onClick={() => onChange(!checked)}
          disabled={disabled}
          className={`relative w-10 h-5 rounded-full transition-colors disabled:opacity-50 ${
            checked ? "bg-brand-green" : "bg-gray-600"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              checked ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

/** Reusable number input */
function ConfigNumber({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
  unit,
  description,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
  disabled: boolean;
  min?: number;
  max?: number;
  unit?: string;
  description?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-sm text-muted">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          disabled={disabled}
          className="w-28 px-3 py-2 bg-secondary-dark rounded-lg text-gray-200 border border-gray-600 focus:border-brand-green focus:outline-none disabled:opacity-50"
        />
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      {description && <p className="text-xs text-muted">{description}</p>}
    </div>
  );
}

/** Collapsible section wrapper */
function ConfigSection({
  title,
  children,
  onApply,
  applying,
  disabled,
}: {
  title: string;
  children: React.ReactNode;
  onApply: () => void;
  applying: boolean;
  disabled: boolean;
}) {
  return (
    <details className="group bg-deep-black/50 rounded-lg border border-gray-700">
      <summary className="px-4 py-3 cursor-pointer text-gray-200 font-medium flex items-center justify-between hover:bg-gray-800 rounded-lg transition-colors">
        <span>{title}</span>
        <svg
          className="w-4 h-4 text-muted group-open:rotate-180 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 pb-4 space-y-4">
        {children}
        <button
          onClick={onApply}
          disabled={disabled || applying}
          className="w-full px-4 py-2 bg-brand-green hover:bg-brand-green/90 disabled:bg-gray-600 disabled:text-muted text-white text-sm font-medium rounded-lg transition-colors"
        >
          {applying ? "Applying..." : `Apply ${title}`}
        </button>
      </div>
    </details>
  );
}

function pskToHex(psk: Uint8Array): string {
  return Array.from(psk)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function hexToPsk(hex: string): Uint8Array {
  const bytes = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(bytes.map((b) => parseInt(b, 16)));
}

function generateRandomPsk(): Uint8Array {
  const psk = new Uint8Array(32);
  crypto.getRandomValues(psk);
  return psk;
}

const CHANNEL_ROLES = [
  { value: 0, label: "Disabled" },
  { value: 1, label: "Primary" },
  { value: 2, label: "Secondary" },
];

export default function ConfigPanel({
  onSetConfig,
  onCommit,
  onSetChannel,
  onClearChannel,
  channelConfigs,
  isConnected,
}: Props) {
  // ─── LoRa settings ────────────────────────────────────────────
  const [region, setRegion] = useState(1);
  const [modemPreset, setModemPreset] = useState(0);
  const [hopLimit, setHopLimit] = useState(3);

  // ─── Device settings ──────────────────────────────────────────
  const [deviceRole, setDeviceRole] = useState(0);

  // ─── Position settings ────────────────────────────────────────
  const [positionBroadcastSecs, setPositionBroadcastSecs] = useState(900);
  const [gpsUpdateInterval, setGpsUpdateInterval] = useState(120);
  const [fixedPosition, setFixedPosition] = useState(false);

  // ─── Power settings ───────────────────────────────────────────
  const [isPowerSaving, setIsPowerSaving] = useState(false);

  // ─── Bluetooth settings ───────────────────────────────────────
  const [btEnabled, setBtEnabled] = useState(true);
  const [btFixedPin, setBtFixedPin] = useState(123456);

  // ─── Display settings ─────────────────────────────────────────
  const [screenOnSecs, setScreenOnSecs] = useState(60);
  const [displayUnits, setDisplayUnits] = useState(0);

  // ─── Shared state ─────────────────────────────────────────────
  const [status, setStatus] = useState<string | null>(null);
  const [applyingSection, setApplyingSection] = useState<string | null>(null);

  const disabled = !isConnected;

  const applyConfig = async (
    section: string,
    configCase: string,
    configValue: Record<string, unknown>
  ) => {
    if (!isConnected) return;
    setApplyingSection(section);
    setStatus(`Applying ${section}...`);
    try {
      await onSetConfig({
        payloadVariant: {
          case: configCase,
          value: configValue,
        },
      });
      await onCommit();
      setStatus(`${section} applied successfully!`);
    } catch (err) {
      setStatus(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setApplyingSection(null);
    }
  };

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <h2 className="text-xl font-semibold text-gray-200">
        Device Configuration
      </h2>

      {!isConnected && (
        <div className="bg-yellow-900/30 border border-yellow-700 text-yellow-300 px-4 py-2 rounded-lg text-sm">
          Connect to a device to modify configuration.
        </div>
      )}

      {/* ═══ LoRa / Radio ═══ */}
      <ConfigSection
        title="LoRa / Radio"
        onApply={() =>
          applyConfig("LoRa", "lora", {
            region,
            modemPreset,
            usePreset: true,
            hopLimit,
          })
        }
        applying={applyingSection === "LoRa"}
        disabled={disabled}
      >
        <ConfigSelect
          label="Region"
          value={region}
          options={REGIONS}
          onChange={setRegion}
          disabled={disabled || applyingSection !== null}
        />
        <ConfigSelect
          label="Modem Preset"
          value={modemPreset}
          options={MODEM_PRESETS}
          onChange={setModemPreset}
          disabled={disabled || applyingSection !== null}
        />
        <div className="space-y-1">
          <label className="text-sm text-muted">Hop Limit</label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={7}
              value={hopLimit}
              onChange={(e) => setHopLimit(Number(e.target.value))}
              disabled={disabled || applyingSection !== null}
              className="flex-1 accent-green-500 disabled:opacity-50"
            />
            <span className="text-gray-200 font-mono text-lg w-6 text-center">
              {hopLimit}
            </span>
          </div>
          <p className="text-xs text-muted">
            Number of times a message can be relayed (1–7). Higher = more
            reach, more airtime. Default: 3.
          </p>
        </div>
      </ConfigSection>

      {/* ═══ Device Role ═══ */}
      <ConfigSection
        title="Device Role"
        onApply={() => applyConfig("Device", "device", { role: deviceRole })}
        applying={applyingSection === "Device"}
        disabled={disabled}
      >
        <ConfigSelect
          label="Role"
          value={deviceRole}
          options={DEVICE_ROLES}
          onChange={setDeviceRole}
          disabled={disabled || applyingSection !== null}
          description={
            DEVICE_ROLES.find((r) => r.value === deviceRole)?.description
          }
        />
      </ConfigSection>

      {/* ═══ Position / GPS ═══ */}
      <ConfigSection
        title="Position / GPS"
        onApply={() =>
          applyConfig("Position", "position", {
            positionBroadcastSecs,
            gpsUpdateInterval,
            fixedPosition,
          })
        }
        applying={applyingSection === "Position"}
        disabled={disabled}
      >
        <ConfigNumber
          label="Position Broadcast Interval"
          value={positionBroadcastSecs}
          onChange={setPositionBroadcastSecs}
          disabled={disabled || applyingSection !== null}
          min={0}
          max={86400}
          unit="seconds"
          description="How often to broadcast position. 0 = use default (900s). Set higher to conserve airtime."
        />
        <ConfigNumber
          label="GPS Update Interval"
          value={gpsUpdateInterval}
          onChange={setGpsUpdateInterval}
          disabled={disabled || applyingSection !== null}
          min={0}
          max={86400}
          unit="seconds"
          description="How often to poll the GPS module. 0 = use default."
        />
        <ConfigToggle
          label="Fixed Position"
          checked={fixedPosition}
          onChange={setFixedPosition}
          disabled={disabled || applyingSection !== null}
          description="When enabled, the device will use a manually-set position instead of GPS."
        />
      </ConfigSection>

      {/* ═══ Power ═══ */}
      <ConfigSection
        title="Power"
        onApply={() =>
          applyConfig("Power", "power", { isPowerSaving })
        }
        applying={applyingSection === "Power"}
        disabled={disabled}
      >
        <ConfigToggle
          label="Power Saving Mode"
          checked={isPowerSaving}
          onChange={setIsPowerSaving}
          disabled={disabled || applyingSection !== null}
          description="Enable low-power mode. Reduces responsiveness but significantly extends battery life."
        />
      </ConfigSection>

      {/* ═══ Bluetooth ═══ */}
      <ConfigSection
        title="Bluetooth"
        onApply={() =>
          applyConfig("Bluetooth", "bluetooth", {
            enabled: btEnabled,
            fixedPin: btFixedPin,
          })
        }
        applying={applyingSection === "Bluetooth"}
        disabled={disabled}
      >
        <ConfigToggle
          label="Bluetooth Enabled"
          checked={btEnabled}
          onChange={setBtEnabled}
          disabled={disabled || applyingSection !== null}
          description="Toggle Bluetooth radio on the device."
        />
        <ConfigNumber
          label="Pairing PIN"
          value={btFixedPin}
          onChange={setBtFixedPin}
          disabled={disabled || applyingSection !== null || !btEnabled}
          min={100000}
          max={999999}
          description="6-digit fixed PIN for Bluetooth pairing. Default: 123456."
        />
      </ConfigSection>

      {/* ═══ Display ═══ */}
      <ConfigSection
        title="Display"
        onApply={() =>
          applyConfig("Display", "display", {
            screenOnSecs,
            units: displayUnits,
          })
        }
        applying={applyingSection === "Display"}
        disabled={disabled}
      >
        <ConfigNumber
          label="Screen On Duration"
          value={screenOnSecs}
          onChange={setScreenOnSecs}
          disabled={disabled || applyingSection !== null}
          min={0}
          max={3600}
          unit="seconds"
          description="How long the screen stays on after activity. 0 = always on."
        />
        <ConfigSelect
          label="Display Units"
          value={displayUnits}
          options={DISPLAY_UNITS}
          onChange={setDisplayUnits}
          disabled={disabled || applyingSection !== null}
        />
      </ConfigSection>

      {/* ═══ Channels ═══ */}
      <ChannelSection
        channelConfigs={channelConfigs}
        onSetChannel={onSetChannel}
        onClearChannel={onClearChannel}
        onCommit={onCommit}
        disabled={disabled}
        setStatus={setStatus}
      />

      {/* Status */}
      {status && (
        <div
          className={`px-4 py-2 rounded-lg text-sm ${
            status.includes("Failed")
              ? "bg-red-900/50 border border-red-700 text-red-300"
              : status.includes("success")
              ? "bg-brand-green/10 border border-brand-green text-bright-green"
              : "bg-deep-black text-muted"
          }`}
        >
          {status}
        </div>
      )}

      {/* Info */}
      <div className="bg-deep-black rounded-lg p-4 text-sm text-muted space-y-1">
        <p>
          Changes are written to the device's flash memory and persist across
          reboots.
        </p>
        <p>
          The device may briefly restart after applying new LoRa or device
          settings.
        </p>
      </div>
    </div>
  );
}

// ─── Channel Management Section ─────────────────────────────────
function ChannelSection({
  channelConfigs,
  onSetChannel,
  onClearChannel,
  onCommit,
  disabled,
  setStatus,
}: {
  channelConfigs: ChannelConfig[];
  onSetChannel: Props["onSetChannel"];
  onClearChannel: Props["onClearChannel"];
  onCommit: Props["onCommit"];
  disabled: boolean;
  setStatus: (s: string) => void;
}) {
  const [editChannels, setEditChannels] = useState<
    Array<{ index: number; name: string; role: number; pskHex: string }>
  >([]);
  const [saving, setSaving] = useState<number | null>(null);

  // Initialize edit state from device channel configs
  useEffect(() => {
    if (channelConfigs.length === 0) return;
    setEditChannels(
      channelConfigs.map((ch) => ({
        index: ch.index,
        name: ch.name,
        role: ch.role,
        pskHex: pskToHex(ch.psk),
      }))
    );
  }, [channelConfigs]);

  // Ensure we always show slots 0–7
  const slots = Array.from({ length: 8 }, (_, i) => {
    const existing = editChannels.find((ch) => ch.index === i);
    return existing ?? { index: i, name: "", role: 0, pskHex: "01" };
  });

  const updateSlot = (
    index: number,
    update: Partial<{ name: string; role: number; pskHex: string }>
  ) => {
    setEditChannels((prev) => {
      const idx = prev.findIndex((ch) => ch.index === index);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], ...update };
        return updated;
      }
      return [
        ...prev,
        { index, name: "", role: 0, pskHex: "01", ...update },
      ].sort((a, b) => a.index - b.index);
    });
  };

  const saveChannel = async (slot: typeof slots[0]) => {
    setSaving(slot.index);
    try {
      if (slot.role === 0 && slot.index !== 0) {
        await onClearChannel(slot.index);
      } else {
        await onSetChannel({
          index: slot.index,
          role: slot.role,
          settings: {
            name: slot.name,
            psk: hexToPsk(slot.pskHex),
          },
        });
      }
      await onCommit();
      setStatus(`Channel ${slot.index} saved successfully!`);
    } catch (err) {
      setStatus(
        `Failed: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setSaving(null);
    }
  };

  return (
    <details className="group bg-deep-black/50 rounded-lg border border-gray-700">
      <summary className="px-4 py-3 cursor-pointer text-gray-200 font-medium flex items-center justify-between hover:bg-gray-800 rounded-lg transition-colors">
        <span>Channels</span>
        <svg
          className="w-4 h-4 text-muted group-open:rotate-180 transition-transform"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </summary>
      <div className="px-4 pb-4 space-y-3">
        {slots.map((slot) => (
          <div
            key={slot.index}
            className={`p-3 rounded-lg border ${
              slot.role !== 0
                ? "border-gray-600 bg-deep-black/50"
                : "border-gray-700/50 bg-gray-900/30 opacity-60"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">
                {slot.index === 0 ? "Primary" : `Channel ${slot.index}`}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  slot.role === 1
                    ? "bg-brand-green/10 text-bright-green"
                    : slot.role === 2
                    ? "bg-blue-900/50 text-blue-400"
                    : "bg-secondary-dark text-muted"
                }`}
              >
                {CHANNEL_ROLES.find((r) => r.value === slot.role)?.label ?? "Disabled"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className="text-xs text-muted">Name</label>
                <input
                  type="text"
                  value={slot.name}
                  onChange={(e) =>
                    updateSlot(slot.index, { name: e.target.value })
                  }
                  disabled={disabled}
                  placeholder={slot.index === 0 ? "Primary" : "Channel name"}
                  className="w-full px-2 py-1.5 bg-secondary-dark rounded text-sm text-gray-200 border border-gray-600 focus:border-brand-green focus:outline-none disabled:opacity-50"
                />
              </div>
              {slot.index !== 0 && (
                <div>
                  <label className="text-xs text-muted">Role</label>
                  <select
                    value={slot.role}
                    onChange={(e) =>
                      updateSlot(slot.index, {
                        role: Number(e.target.value),
                      })
                    }
                    disabled={disabled}
                    className="w-full px-2 py-1.5 bg-secondary-dark rounded text-sm text-gray-200 border border-gray-600 focus:border-brand-green focus:outline-none disabled:opacity-50"
                  >
                    <option value={0}>Disabled</option>
                    <option value={2}>Secondary</option>
                  </select>
                </div>
              )}
            </div>

            {/* PSK */}
            <div className="mb-2">
              <label className="text-xs text-muted">Pre-Shared Key</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={slot.pskHex}
                  onChange={(e) =>
                    updateSlot(slot.index, {
                      pskHex: e.target.value.replace(/[^0-9a-fA-F]/g, ""),
                    })
                  }
                  disabled={disabled}
                  placeholder="01"
                  className="flex-1 px-2 py-1.5 bg-secondary-dark rounded text-xs font-mono text-gray-200 border border-gray-600 focus:border-brand-green focus:outline-none disabled:opacity-50"
                />
                <button
                  onClick={() =>
                    updateSlot(slot.index, { pskHex: "01" })
                  }
                  disabled={disabled}
                  className="px-2 py-1.5 text-xs bg-secondary-dark text-muted hover:text-gray-200 rounded disabled:opacity-50"
                  title="Default PSK"
                >
                  Def
                </button>
                <button
                  onClick={() =>
                    updateSlot(slot.index, {
                      pskHex: pskToHex(generateRandomPsk()),
                    })
                  }
                  disabled={disabled}
                  className="px-2 py-1.5 text-xs bg-secondary-dark text-muted hover:text-gray-200 rounded disabled:opacity-50"
                  title="Generate random 256-bit PSK"
                >
                  Rand
                </button>
                <button
                  onClick={() => updateSlot(slot.index, { pskHex: "00" })}
                  disabled={disabled}
                  className="px-2 py-1.5 text-xs bg-secondary-dark text-muted hover:text-gray-200 rounded disabled:opacity-50"
                  title="No encryption"
                >
                  None
                </button>
              </div>
            </div>

            <button
              onClick={() => saveChannel(slot)}
              disabled={disabled || saving !== null}
              className="w-full px-3 py-1.5 bg-brand-green hover:bg-brand-green/90 disabled:bg-gray-600 disabled:text-muted text-white text-xs font-medium rounded transition-colors"
            >
              {saving === slot.index ? "Saving..." : "Save Channel"}
            </button>
          </div>
        ))}
        <p className="text-xs text-muted">
          Changes are written to the device immediately. PSK "01" = default
          Meshtastic key. "00" = no encryption. Use "Rand" for a private
          channel.
        </p>
      </div>
    </details>
  );
}
