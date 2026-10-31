import { isOfferExpired } from '../../src/utils/offerHelper.js';
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

  test('parseFlexibleDate with isEndOfDay=true should set end-of-day time 23:59:59.999', () => {
    const parsed = parseFlexibleDate('2026-10-31', true);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.getHours()).toBe(23);
    expect(parsed.getMinutes()).toBe(59);
    expect(parsed.getSeconds()).toBe(59);
    expect(parsed.getMilliseconds()).toBe(999);
  });

  test('parseFlexibleDate with isEndOfDay=false should set start-of-day time 00:00:00.000', () => {
    const parsed = parseFlexibleDate('2026-10-31', false);
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.getHours()).toBe(0);
    expect(parsed.getMinutes()).toBe(0);
    expect(parsed.getSeconds()).toBe(0);
    expect(parsed.getMilliseconds()).toBe(0);
  });
});
