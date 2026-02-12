import { describe, expect, it } from "vitest";

import { RATES } from "../../constants.js";
import calculateSmallSpikePattern from "../../patterns/small-spike.js";

describe("patterns/small-spike", () => {
  const base = 100;
  // Default peakStart with no known prices = WEDNESDAY_PM (5)
  const defaultPeakStart = 5;

  describe("without known prices (algorithm defaults)", () => {
    it("should return pre-peak decreasing range for period 0", () => {
      const result = calculateSmallSpikePattern(0, base);
      // Pre-peak: min = floor(100 * 0.40) = 40, max = ceil(100 * 0.90) = 90
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.START_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.START_MAX));
    });

    it("should always have min <= max for all periods", () => {
      for (let i = 0; i < 12; i++) {
        const result = calculateSmallSpikePattern(i, base);
        expect(result.min).toBeLessThanOrEqual(result.max);
      }
    });

    it("should have peak values above base price", () => {
      const results = Array.from({ length: 12 }, (_, i) =>
        calculateSmallSpikePattern(i, base)
      );
      const hasAboveBase = results.some(r => r.max > base);
      expect(hasAboveBase).toBe(true);
    });
  });

  describe("peak phase (initial periods)", () => {
    it("should use 90-140% range for first two peak periods", () => {
      // peakPhaseIndex 0 and 1 use PEAK_PHASE_INITIAL rates
      const result0 = calculateSmallSpikePattern(defaultPeakStart, base);
      const result1 = calculateSmallSpikePattern(defaultPeakStart + 1, base);

      for (const result of [result0, result1]) {
        expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MIN));
        expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MAX));
      }
    });
  });

  describe("peak phase (peak real - peakPhaseIndex 3)", () => {
    it("should show full theoretical range without known peak data", () => {
      const peakRealIndex = defaultPeakStart + 3; // period 8
      const result = calculateSmallSpikePattern(peakRealIndex, base);
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.PEAK_RATE_MAX));
    });
  });

  describe("peak phase (intermediate - peakPhaseIndex 2 & 4)", () => {
    it("should show intermediate range (1.4 to rate) - 1 bell", () => {
      const intermediateIndex = defaultPeakStart + 2; // period 7
      const result = calculateSmallSpikePattern(intermediateIndex, base);
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.PEAK_RATE_MAX - 1));
    });
  });

  describe("post-peak phase", () => {
    it("should return post-peak range for periods after the peak", () => {
      const postPeakIndex = defaultPeakStart + 5; // period 10
      const result = calculateSmallSpikePattern(postPeakIndex, base);
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.POST_PEAK_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.POST_PEAK_MAX));
    });
  });

  describe("with known prices", () => {
    it("should narrow peak real range when period 3 price is known", () => {
      // Trend reversal at index 2 → peakStart = 2
      // peakStart+2 (index 4) = peakPhaseIndex 2 (intermediate)
      // peakStart+3 (index 5) = peakPhaseIndex 3 (peak real)
      const knownPrices = [
        { index: 0, price: 85 },
        { index: 1, price: 80 },
        { index: 2, price: 95 },
        { index: 4, price: 155 }, // peakPhaseIndex 2
      ];
      const result = calculateSmallSpikePattern(5, base, knownPrices);
      // With peakPhaseIndex 2 known, peak real min should be period3price + 1
      expect(result.min).toBeGreaterThanOrEqual(156);
      expect(result.min).toBeLessThanOrEqual(result.max);
    });

    it("should return exact price when peak real period is known", () => {
      const knownPrices = [
        { index: 0, price: 85 },
        { index: 1, price: 80 },
        { index: 2, price: 95 },
        { index: 5, price: 180 }, // peakStart=2, peakPhaseIndex 3 = peak real
      ];
      const result = calculateSmallSpikePattern(5, base, knownPrices);
      expect(result.min).toBe(180);
      expect(result.max).toBe(180);
    });
  });

  describe("with various base prices (90-110)", () => {
    it("should produce valid ranges for all buy prices and periods", () => {
      for (let buyPrice = 90; buyPrice <= 110; buyPrice++) {
        for (let period = 0; period < 12; period++) {
          const result = calculateSmallSpikePattern(period, buyPrice);
          expect(result.min).toBeLessThanOrEqual(result.max);
          expect(result.min).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });
});
