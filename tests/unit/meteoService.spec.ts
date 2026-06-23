import { describe, it, expect } from 'vitest';
import {
  meteoSnapshotCoversToday,
  type MeteoSnapshot,
} from 'src/modules/time/meteoService';

function makeSnapshot(firstDay: string): MeteoSnapshot {
  return {
    location: { latitude: 52.2, longitude: 21.0, name: 'Warsaw' },
    current: {
      temperature: 10,
      apparentTemperature: 9,
      humidity: 50,
      windSpeed: 2,
      weatherCode: 0,
      rainChance: 0,
    },
    days: [{ date: firstDay, dayIndex: 0, hours: [] }],
    fetchedAt: Date.now(),
  };
}

describe('meteoSnapshotCoversToday', () => {
  it('returns true when the first forecast day matches the device date', () => {
    const today = new Date();
    const key = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    expect(meteoSnapshotCoversToday(makeSnapshot(key))).toBe(true);
  });

  it('returns false when the cache starts on a previous day', () => {
    expect(meteoSnapshotCoversToday(makeSnapshot('2020-01-01'))).toBe(false);
  });

  it('returns false for empty snapshots', () => {
    expect(meteoSnapshotCoversToday(null)).toBe(false);
    expect(meteoSnapshotCoversToday({ ...makeSnapshot('2020-01-01'), days: [] })).toBe(false);
  });
});
