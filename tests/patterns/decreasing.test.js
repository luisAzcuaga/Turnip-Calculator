import { RATES, VARIANCE } from "../../constants.js";
import { describe, expect, it } from "vitest";

import calculateDecreasingPattern from "../../patterns/decreasing.js";

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

    it("should project future prices with variance from 2+ known prices", () => {
      const knownPrices = [
        { index: 0, price: 88 }, // rate 0.88
        { index: 1, price: 84 }, // rate 0.84, drop = 0.04
      ];
      // avgRateDrop = 0.04
      // For period 3 (2 periods ahead of index 1):
      // projected rate = 0.84 - (0.04 * 2) = 0.76
      // projected price = 100 * 0.76 = 76
      // min = floor(76 * 0.95) = floor(72.2) = 72
      // max = ceil(76 * 1.05) = ceil(79.8) = 80
      const result = calculateDecreasingPattern(3, base, knownPrices);
      expect(result.min).toBe(Math.floor(76 * VARIANCE.INFERRED_MIN));
      expect(result.max).toBe(Math.ceil(76 * VARIANCE.INFERRED_MAX));
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
