import { DECAY, RATES } from "../../constants.js";
import { calculateDecreasingPattern, isPossibleDecreasing } from "../../patterns/decreasing.js";
import { describe, expect, it } from "vitest";


describe("patterns/decreasing", () => {
  const base = 100;

  describe("without known prices", () => {
    it("should return algorithm range for period 0", () => {
      const result = calculateDecreasingPattern(0, base);
      // min: floor(100 * max(0.40, 0.85 - 0*0.05)) = floor(100*0.85) = 85
      // max: ceil(100 * max(0.40, 0.90 - 0*0.03)) = ceil(100*0.90) = 90
      expect(result.min).toBe(85);
      expect(result.max).toBe(90);
    });

    it("should decrease over time", () => {
      const period0 = calculateDecreasingPattern(0, base);
      const period5 = calculateDecreasingPattern(5, base);
      const period11 = calculateDecreasingPattern(11, base);

      expect(period5.max).toBeLessThan(period0.max);
      expect(period11.max).toBeLessThan(period5.max);
      expect(period5.min).toBeLessThanOrEqual(period0.min);
    });

    it("should never go below FLOOR rate (40%)", () => {
      for (let i = 0; i < 12; i++) {
        const result = calculateDecreasingPattern(i, base);
        expect(result.min).toBeGreaterThanOrEqual(Math.floor(base * RATES.FLOOR));
      }
    });

    it("should always have min <= max", () => {
      for (let i = 0; i < 12; i++) {
        const result = calculateDecreasingPattern(i, base);
        expect(result.min).toBeLessThanOrEqual(result.max);
      }
    });

    it("should work with non-round base prices", () => {
      const result = calculateDecreasingPattern(0, 97);
      // min: floor(97 * 0.85) = floor(82.45) = 82
      // max: ceil(97 * 0.90) = ceil(87.3) = 88
      expect(result.min).toBe(82);
      expect(result.max).toBe(88);
    });
  });

  describe("with known prices", () => {
    it("should return exact price when period matches last known", () => {
      const knownPrices = [
        { index: 0, price: 88 },
        { index: 1, price: 84 },
      ];
      const result = calculateDecreasingPattern(1, base, knownPrices);
      expect(result.min).toBe(84);
      expect(result.max).toBe(84);
    });

    it("should project future prices using game bounds from last known price", () => {
      const knownPrices = [
        { index: 0, price: 88 }, // rate 0.88
        { index: 1, price: 84 }, // rate 0.84
      ];
      // For period 3 (2 periods ahead of index 1), rate 0.84:
      // worst case: 0.84 - (5% * 2) = 0.74 → floor(100 * 0.74) = 74
      // best case:  0.84 - (3% * 2) = 0.78 → ceil(100 * 0.78)  = 78
      const result = calculateDecreasingPattern(3, base, knownPrices);
      expect(result.min).toBe(Math.floor(base * (0.84 - DECAY.MAX_PER_PERIOD * 2)));
      expect(result.max).toBe(Math.ceil(base * (0.84 - DECAY.MIN_PER_PERIOD * 2)));
    });

    it("should use algorithm defaults when predicting before known prices", () => {
      const knownPrices = [
        { index: 5, price: 70 },
        { index: 6, price: 66 },
      ];
      // Period 0 is before known data, periodsAhead would be negative
      // Falls through to algorithm defaults
      const result = calculateDecreasingPattern(0, base, knownPrices);
      expect(result.min).toBe(85);
      expect(result.max).toBe(90);
    });
  });

  describe("with all valid buy prices (90-110)", () => {
    it("should produce valid ranges for all periods", () => {
      for (let buyPrice = 90; buyPrice <= 110; buyPrice++) {
        for (let period = 0; period < 12; period++) {
          const result = calculateDecreasingPattern(period, buyPrice);
          expect(result.min).toBeLessThanOrEqual(result.max);
          expect(result.min).toBeGreaterThan(0);
          expect(result.max).toBeLessThanOrEqual(buyPrice);
        }
      }
    });
  });
});

describe("isPossibleDecreasing", () => {
  const base = 100;

  it("should accept a strictly decreasing series within valid range", () => {
    // decreasingMaxForPeriod(100, 0) = ceil(100 * 0.90) = 90
    // decreasingMin(100) = floor(100 * 0.40) = 40
    const prices = [
      { index: 0, price: 88 },
      { index: 1, price: 85 },
      { index: 2, price: 82 },
    ];
    expect(isPossibleDecreasing(prices, base).possible).toBe(true);
  });

  it("should reject when Monday price exceeds decreasingMax", () => {
    const prices = [{ index: 0, price: 105 }];
    expect(isPossibleDecreasing(prices, base).possible).toBe(false);
  });

  it("should reject when any price rises compared to previous", () => {
    const prices = [
      { index: 0, price: 88 },
      { index: 1, price: 90 }, // rises
    ];
    expect(isPossibleDecreasing(prices, base).possible).toBe(false);
  });

  it("should reject when price exceeds decreasingMaxForPeriod", () => {
    // At period 0, max = ceil(100 * 0.90) = 90. Price 95 > 90 → rejected
    const prices = [{ index: 0, price: 95 }];
    expect(isPossibleDecreasing(prices, base).possible).toBe(false);
  });

  it("should reject when price falls below decreasingMin", () => {
    // decreasingMin(100) = floor(100 * 0.40) = 40. Price 35 < 40 → rejected
    const prices = [{ index: 0, price: 35 }];
    expect(isPossibleDecreasing(prices, base).possible).toBe(false);
  });
});
