import { isOfferExpired, ensureEndOfDayIst, ensureStartOfDayIst } from '../../src/utils/offerHelper.js';
import { parseFlexibleDate } from '../../src/utils/date.util.js';

describe('Offer Expiration and Date Handling Unit Tests', () => {
  const currentTestTime = new Date('2026-10-31T05:59:57.000Z'); // 11:29:57 AM IST on Oct 31, 2026
  const tomorrowTime = new Date('2026-11-01T06:00:00.000Z'); // Next day

  test('should NOT mark offer as expired if validTo is today at 00:00:00 UTC', () => {
    const validToMidnightUtc = new Date('2026-10-31T00:00:00.000Z');
    expect(isOfferExpired(validToMidnightUtc, currentTestTime)).toBe(false);
  });

  test('should NOT mark offer as expired if validTo is today at midnight IST (18:30 UTC previous day)', () => {
    const validToMidnightIst = new Date('2026-10-30T18:30:00.000Z');
    expect(isOfferExpired(validToMidnightIst, currentTestTime)).toBe(false);
  });

  test('should NOT mark offer as expired if validTo is today at 23:59:59.999 UTC', () => {
    const validToEndOfDayUtc = new Date('2026-10-31T23:59:59.999Z');
    expect(isOfferExpired(validToEndOfDayUtc, currentTestTime)).toBe(false);
  });

  test('should mark offer as expired if validTo was yesterday', () => {
    const validToYesterday = new Date('2026-10-30T00:00:00.000Z');
    expect(isOfferExpired(validToYesterday, currentTestTime)).toBe(true);
  });

  test('should mark today offer as expired when tomorrow arrives', () => {
    const validToToday = new Date('2026-10-31T00:00:00.000Z');
    expect(isOfferExpired(validToToday, tomorrowTime)).toBe(true);
  });

  test('ensureEndOfDayIst should produce end of day in IST and not be expired now', () => {
    const endOfDay = ensureEndOfDayIst('2026-10-31T00:00:00.000Z');
    expect(endOfDay).toBeInstanceOf(Date);
    // In UTC, 23:59:59.999+05:30 is 18:29:59.999Z
    expect(endOfDay.toISOString()).toBe('2026-10-31T18:29:59.999Z');
    // Against 12:00 PM IST (06:30 UTC), it is strictly in the future
    expect(endOfDay > currentTestTime).toBe(true);
  });

  test('ensureStartOfDayIst should produce start of day in IST', () => {
    const startOfDay = ensureStartOfDayIst('2026-10-31T00:00:00.000Z');
    expect(startOfDay).toBeInstanceOf(Date);
    // In UTC, 00:00:00.000+05:30 is 18:30:00.000Z of previous day
    expect(startOfDay.toISOString()).toBe('2026-10-30T18:30:00.000Z');
  });

  test('parseFlexibleDate with isEndOfDay=true should set end-of-day IST timestamp', () => {
    const parsed = parseFlexibleDate('2026-10-31', true);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe('2026-10-31T18:29:59.999Z');
  });

  test('parseFlexibleDate with isEndOfDay=false should set start-of-day IST timestamp', () => {
    const parsed = parseFlexibleDate('2026-10-31', false);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe('2026-10-30T18:30:00.000Z');
  });
});
