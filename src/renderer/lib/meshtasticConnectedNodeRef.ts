/** Meshtastic node id while the Meshtastic radio is connected (for cross-protocol Foreign LoRa). */
let connectedMyNodeNum = 0;

export function setMeshtasticConnectedMyNodeNum(nodeNum: number): void {
  connectedMyNodeNum = nodeNum;
}

export function getMeshtasticConnectedMyNodeNum(): number {
  return connectedMyNodeNum;
}
