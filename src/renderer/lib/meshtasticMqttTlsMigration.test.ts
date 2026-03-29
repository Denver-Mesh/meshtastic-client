import { describe, expect, it } from 'vitest';

import type { MQTTSettings } from '@/renderer/lib/types';

import {
  isLiamBrokerSettings,
  isMeshtasticOfficialBrokerSettings,
  MESHTASTIC_LIAM_1883,
  MESHTASTIC_OFFICIAL_1883,
  MESHTASTIC_OFFICIAL_8883,
  meshtasticMqttErrorUserHint,
} from './meshtasticMqttTlsMigration';

describe('Meshtastic official broker presets', () => {
  it('1883 and 8883 share host and credentials', () => {
    expect(MESHTASTIC_OFFICIAL_1883.server).toBe(MESHTASTIC_OFFICIAL_8883.server);
    expect(MESHTASTIC_OFFICIAL_1883.username).toBe(MESHTASTIC_OFFICIAL_8883.username);
    expect(MESHTASTIC_OFFICIAL_1883.port).toBe(1883);
    expect(MESHTASTIC_OFFICIAL_8883.port).toBe(8883);
  });

  it('isMeshtasticOfficialBrokerSettings matches public host', () => {
    const s: MQTTSettings = { ...MESHTASTIC_OFFICIAL_8883 };
    expect(isMeshtasticOfficialBrokerSettings(s)).toBe(true);
    expect(isMeshtasticOfficialBrokerSettings({ ...s, server: 'other.example' })).toBe(false);
  });
});

describe('Liam broker preset', () => {
  it('uses port 1883 with uplink credentials', () => {
    expect(MESHTASTIC_LIAM_1883.server).toBe('mqtt.meshtastic.liamcottle.net');
    expect(MESHTASTIC_LIAM_1883.port).toBe(1883);
    expect(MESHTASTIC_LIAM_1883.username).toBe('uplink');
    expect(MESHTASTIC_LIAM_1883.password).toBe('uplink');
  });

  it('isLiamBrokerSettings matches liam host', () => {
    expect(isLiamBrokerSettings(MESHTASTIC_LIAM_1883)).toBe(true);
    expect(
      isLiamBrokerSettings({ ...MESHTASTIC_LIAM_1883, server: 'MQTT.MESHTASTIC.LIAMCOTTLE.NET' }),
    ).toBe(true);
    expect(isLiamBrokerSettings({ ...MESHTASTIC_LIAM_1883, server: 'mqtt.meshtastic.org' })).toBe(
      false,
    );
    expect(isLiamBrokerSettings(MESHTASTIC_OFFICIAL_8883)).toBe(false);
  });
});

describe('meshtasticMqttErrorUserHint', () => {
  it('appends guidance for expired certificate', () => {
    const h = meshtasticMqttErrorUserHint('certificate has expired');
    expect(h).toContain('Allow insecure TLS');
    expect(h).toContain('certificate has expired');
  });

  it('returns other errors unchanged', () => {
    expect(meshtasticMqttErrorUserHint('connack timeout')).toBe('connack timeout');
  });
});
