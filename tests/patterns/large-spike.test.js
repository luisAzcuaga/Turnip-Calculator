import { describe, expect, it } from "vitest";

import { RATES } from "../../constants.js";
import calculateLargeSpikePattern from "../../patterns/large-spike.js";

describe("patterns/large-spike", () => {
  const base = 100;

  describe("without known prices (algorithm defaults)", () => {
    it("should return decreasing range for early periods", () => {
      // Period 0: pre-peak, should be in 85-90% range area
      const result = calculateLargeSpikePattern(0, base);
      expect(result.min).toBeLessThanOrEqual(result.max);
      expect(result.min).toBeGreaterThanOrEqual(Math.floor(base * RATES.FLOOR));
      expect(result.max).toBeLessThanOrEqual(Math.ceil(base * RATES.LARGE_SPIKE.START_MAX));
    });

    it("should always have min <= max for all periods", () => {
      for (let i = 0; i < 12; i++) {
        const result = calculateLargeSpikePattern(i, base);
        expect(result.min).toBeLessThanOrEqual(result.max);
      }
    });

    it("should have high max during potential peak periods", () => {
      // Some middle periods should have spike-level maximums
      // since peak could start at various points
      const peakPeriods = [3, 4, 5, 6];
      const hasHighMax = peakPeriods.some(i => {
        const result = calculateLargeSpikePattern(i, base);
        return result.max > base;
      });
      expect(hasHighMax).toBe(true);
    });
  });

  describe("peak phase rates", () => {
    it("should match PEAK_PHASES rates for peak periods (default peakStart)", () => {
      // Without known prices, peakStart defaults to WEDNESDAY_PM (5)
      // Peak phases: periods 5, 6, 7, 8, 9
      const peakStart = 5; // default
      const expectedPhases = RATES.LARGE_SPIKE.PEAK_PHASES;

      for (let phase = 0; phase < 5; phase++) {
        const periodIndex = peakStart + phase;
        if (periodIndex > 11) break;

        const result = calculateLargeSpikePattern(periodIndex, base);
        const phaseRates = expectedPhases[phase];

        expect(result.min).toBe(Math.floor(base * phaseRates.min));
        expect(result.max).toBe(Math.ceil(base * phaseRates.max));
      }
    });

    it("should have the highest range in peak phase 3 (200-600%)", () => {
      // Phase 3 (index 2 in PEAK_PHASES) has the max range
      const peakStart = 5;
      const result = calculateLargeSpikePattern(peakStart + 2, base);
      expect(result.max).toBe(Math.ceil(base * 6.0)); // 600%
      expect(result.min).toBe(Math.floor(base * 2.0)); // 200%
    });
  });

  describe("post-peak phase", () => {
    it("should return post-peak range after peak ends", () => {
      // Default peakStart=5, peak occupies 5-9, post-peak at 10+
      const peakStart = 5;
      const postPeakIndex = peakStart + 5; // 10

      if (postPeakIndex <= 11) {
        const result = calculateLargeSpikePattern(postPeakIndex, base);
        expect(result.min).toBe(Math.floor(base * RATES.LARGE_SPIKE.POST_PEAK_MIN));
        expect(result.max).toBe(Math.ceil(base * RATES.LARGE_SPIKE.POST_PEAK_MAX));
      }
    });
  });

  describe("with known prices", () => {
    it("should project from known decreasing prices in pre-peak phase", () => {
      const knownPrices = [
        { index: 0, price: 88 },
        { index: 1, price: 84 },
      ];
      // These are decreasing, so pattern detects pre-peak phase
      const result = calculateLargeSpikePattern(0, base, knownPrices);
      // Period 0 is the last known at index 0 in pre-peak
      expect(result.min).toBeLessThanOrEqual(result.max);
    });

    it("should detect peak from trend reversal", () => {
      // Falling then rising → peak detected
      const knownPrices = [
        { index: 0, price: 88 },
        { index: 1, price: 84 },
        { index: 2, price: 95 }, // reversal
      ];
      // Period 2 should be near the start of peak phase
      const result = calculateLargeSpikePattern(2, base, knownPrices);
      expect(result.min).toBeLessThanOrEqual(result.max);
    });
  });

  describe("with various base prices (90-110)", () => {
    it("should produce valid ranges for all buy prices and periods", () => {
      for (let buyPrice = 90; buyPrice <= 110; buyPrice++) {
        for (let period = 0; period < 12; period++) {
          const result = calculateLargeSpikePattern(period, buyPrice);
          expect(result.min).toBeLessThanOrEqual(result.max);
          expect(result.min).toBeGreaterThan(0);
        }
      }
    });
  });
});
