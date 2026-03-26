import type { Types } from '@meshtastic/core';

import type { NobleBleSessionId } from './types';
import { WebBluetoothManager } from './webbluetooth-ble-manager';

export class TransportWebBluetoothIpc implements Types.Transport {
  private readonly sessionId: NobleBleSessionId;
  private _fromDeviceController: ReadableStreamDefaultController<Types.DeviceOutput> | null = null;
  private _fromRadioUnsub: (() => void) | null = null;
  private _bleManager: WebBluetoothManager | null = null;

  public readonly toDevice: WritableStream<Uint8Array>;
  public readonly fromDevice: ReadableStream<Types.DeviceOutput>;

  constructor(sessionId: NobleBleSessionId) {
    this.sessionId = sessionId;

    this.fromDevice = new ReadableStream<Types.DeviceOutput>({
      start: (controller) => {
        this._fromDeviceController = controller;
      },
      cancel: () => {
        if (this._bleManager) {
          this._bleManager.disconnect().catch(console.error);
          this._bleManager = null;
        }
        this._fromDeviceController = null;
      },
    });

    this.toDevice = new WritableStream<Uint8Array>({
      write: async (chunk) => {
        console.debug('[TransportWebBluetoothIpc] toRadio bytes', chunk.length);
        if (this._bleManager) {
          await this._bleManager.writeToRadio(chunk);
        }
      },
      close: () => {
        if (this._bleManager) {
          this._bleManager.disconnect().catch(console.error);
          this._bleManager = null;
        }
      },
    });
  }

  async requestDevice(): Promise<{ deviceId: string; deviceName: string }> {
    this._bleManager = new WebBluetoothManager(this.sessionId);
    const device = await this._bleManager.requestDevice();
    return {
      deviceId: device.id,
      deviceName: device.name ?? 'Unknown Device',
    };
  }

  async connect(): Promise<void> {
    if (!this._bleManager) {
      throw new Error('No device selected. Call requestDevice() first.');
    }
    await this._bleManager.connect();
  }

  async disconnect(): Promise<void> {
    if (this._bleManager) {
      await this._bleManager.disconnect();
      this._bleManager = null;
    }
  }

  isConnected(): boolean {
    return this._bleManager?.isConnected() ?? false;
  }

  getDeviceInfo(): { deviceId: string; deviceName: string } | null {
    return this._bleManager?.getDeviceInfo() ?? null;
  }
}
