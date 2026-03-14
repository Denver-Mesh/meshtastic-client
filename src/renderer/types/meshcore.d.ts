declare module '@liamcottle/meshcore.js' {
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
