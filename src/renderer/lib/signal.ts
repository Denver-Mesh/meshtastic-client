export function rssiToSignalLevel(rssi: number | null | undefined): 0 | 1 | 2 | 3 | 4 {
  if (rssi == null) return 0;
  if (rssi > -60) return 4;
  if (rssi > -70) return 3;
  if (rssi > -80) return 2;
  if (rssi > -90) return 1;
  return 0;
}
