declare module '@liamcottle/meshcore.js' {
  export class CayenneLpp {
    static LPP_DIGITAL_INPUT: number;
    static LPP_DIGITAL_OUTPUT: number;
    static LPP_ANALOG_INPUT: number;
    static LPP_ANALOG_OUTPUT: number;
    static LPP_GENERIC_SENSOR: number;
    static LPP_LUMINOSITY: number;
    static LPP_PRESENCE: number;
    static LPP_TEMPERATURE: number;
    static LPP_RELATIVE_HUMIDITY: number;
    static LPP_ACCELEROMETER: number;
    static LPP_BAROMETRIC_PRESSURE: number;
    static LPP_VOLTAGE: number;
    static LPP_CURRENT: number;
    static LPP_FREQUENCY: number;
    static LPP_PERCENTAGE: number;
    static LPP_ALTITUDE: number;
    static LPP_CONCENTRATION: number;
    static LPP_POWER: number;
    static LPP_DISTANCE: number;
    static LPP_ENERGY: number;
    static LPP_DIRECTION: number;
    static LPP_UNIXTIME: number;
    static LPP_GYROMETER: number;
    static LPP_COLOUR: number;
    static LPP_GPS: number;
    static LPP_SWITCH: number;
    static LPP_POLYLINE: number;
    static parse(
      bytes: Uint8Array,
    ): { channel: number; type: number; value: number | Record<string, number> }[];
  }

  export class WebBleConnection {
    static open(): Promise<WebBleConnection>;
    on(event: string, cb: (...args: unknown[]) => void): void;
    off(event: string, cb: (...args: unknown[]) => void): void;
    once(event: string, cb: (...args: unknown[]) => void): void;
    close(): Promise<void>;
    getSelfInfo(timeout?: number): Promise<unknown>;
    getContacts(): Promise<unknown[]>;
    getChannels(): Promise<unknown[]>;
    sendFloodAdvert(): Promise<void>;
    sendTextMessage(pubKey: Uint8Array, text: string, type?: number): Promise<unknown>;
    sendChannelTextMessage(channelIdx: number, text: string): Promise<void>;
  }

  export class WebSerialConnection {
    static open(): Promise<WebSerialConnection>;
    on(event: string, cb: (...args: unknown[]) => void): void;
    off(event: string, cb: (...args: unknown[]) => void): void;
    once(event: string, cb: (...args: unknown[]) => void): void;
    close(): Promise<void>;
    getSelfInfo(timeout?: number): Promise<unknown>;
    getContacts(): Promise<unknown[]>;
    getChannels(): Promise<unknown[]>;
    sendFloodAdvert(): Promise<void>;
    sendTextMessage(pubKey: Uint8Array, text: string, type?: number): Promise<unknown>;
    sendChannelTextMessage(channelIdx: number, text: string): Promise<void>;
  }

  export class SerialConnection {
    write(bytes: Uint8Array): Promise<void>;
    onDataReceived(value: Uint8Array): Promise<void>;
    onConnected(): Promise<void>;
    onDisconnected(): void;
    close(): Promise<void>;
    on(event: string, cb: (...args: unknown[]) => void): void;
    off(event: string, cb: (...args: unknown[]) => void): void;
    once(event: string, cb: (...args: unknown[]) => void): void;
    emit(event: string, ...args: unknown[]): void;
  }
}
