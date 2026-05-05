import { useCallback, useEffect, useRef } from 'react';

import type { ConnectParams } from '../lib/drivers/ConnectionDriver';
import { ConnectionDriver } from '../lib/drivers/ConnectionDriver';

export function useConnect() {
  const teardownRef = useRef<(() => void) | null>(null);

  const connect = useCallback(async (params: ConnectParams) => {
    teardownRef.current?.();
    teardownRef.current = null;
    const driver = new ConnectionDriver();
    teardownRef.current = await driver.connect(params);
  }, []);

  const disconnect = useCallback(() => {
    teardownRef.current?.();
    teardownRef.current = null;
  }, []);

  useEffect(
    () => () => {
      teardownRef.current?.();
    },
    [],
  );

  return { connect, disconnect };
}
