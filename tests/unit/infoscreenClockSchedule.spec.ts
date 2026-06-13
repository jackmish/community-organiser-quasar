import { describe, expect, it } from 'vitest';
import {
  alignedClockSlotKey,
  isAlignedClockMinute,
  msUntilNextClockTick,
  nextAlignedClockTime,
} from 'src/modules/infoscreen/infoscreenClockSchedule';

function at(h: number, m: number, s = 0, ms = 0): Date {
  const d = new Date(2026, 5, 13, h, m, s, ms);
  return d;
}

describe('infoscreenClockSchedule', () => {
  it('aligns next tick to wall-clock boundaries for 15 minutes', () => {
    expect(nextAlignedClockTime(at(8, 7, 30), 15)).toEqual(at(8, 15, 0, 0));
    expect(nextAlignedClockTime(at(8, 15, 0), 15)).toEqual(at(8, 15, 0, 0));
    expect(nextAlignedClockTime(at(8, 15, 1), 15)).toEqual(at(8, 30, 0, 0));
  });

  it('detects aligned minutes for interval presets', () => {
    expect(isAlignedClockMinute(at(8, 0), 15)).toBe(true);
    expect(isAlignedClockMinute(at(8, 15), 15)).toBe(true);
    expect(isAlignedClockMinute(at(8, 14, 59), 15)).toBe(false);
    expect(isAlignedClockMinute(at(8, 10), 10)).toBe(true);
    expect(isAlignedClockMinute(at(9, 0), 60)).toBe(true);
    expect(isAlignedClockMinute(at(9, 30), 60)).toBe(false);
  });

  it('builds stable slot keys within the same aligned window', () => {
    expect(alignedClockSlotKey(at(8, 14, 59), 15)).toBe(alignedClockSlotKey(at(8, 14, 0), 15));
    expect(alignedClockSlotKey(at(8, 15, 0), 15)).not.toBe(
      alignedClockSlotKey(at(8, 14, 0), 15),
    );
  });

  it('returns zero remaining exactly on aligned minute', () => {
    expect(msUntilNextClockTick(at(8, 15, 0), 15)).toBe(0);
  });
});
