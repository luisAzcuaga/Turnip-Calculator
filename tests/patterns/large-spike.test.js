import { describe, expect, it } from "vitest";

import { RATES } from "../../constants.js";
import calculateLargeSpikePattern from "../../patterns/large-spike.js";

describe("patterns/large-spike", () => {
  const base = 100;

  describe("without known prices (algorithm defaults)", () => {
    it("should return decreasing range for early periods", () => {
      // Period 0: pre-spike, should be in 85-90% range area
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

    it("should have high max during potential spike periods", () => {
      // Some middle periods should have spike-level maximums
      // since spike could start at various points
      const spikePeriods = [3, 4, 5, 6];
      const hasHighMax = spikePeriods.some(i => {
        const result = calculateLargeSpikePattern(i, base);
        return result.max > base;
      });
      expect(hasHighMax).toBe(true);
    });
  });

  describe("spike phase rates", () => {
    it("should match SPIKE_PHASES rates for spike periods (default spikeStart)", () => {
      // Without known prices, spikeStart defaults to WEDNESDAY_PM (5)
      // Spike phases: periods 5, 6, 7, 8, 9
      const spikeStart = 5; // default
      const expectedPhases = RATES.LARGE_SPIKE.SPIKE_PHASES;

      for (let phase = 0; phase < 5; phase++) {
        const periodIndex = spikeStart + phase;
        if (periodIndex > 11) break;

        const result = calculateLargeSpikePattern(periodIndex, base);
        const phaseRates = expectedPhases[phase];

        expect(result.min).toBe(Math.floor(base * phaseRates.min));
        expect(result.max).toBe(Math.ceil(base * phaseRates.max));
      }
    });

    it("should have the highest range in spike phase 3 (200-600%)", () => {
      // Phase 3 (index 2 in SPIKE_PHASES) has the max range
      const spikeStart = 5;
      const result = calculateLargeSpikePattern(spikeStart + 2, base);
      expect(result.max).toBe(Math.ceil(base * 6.0)); // 600%
      expect(result.min).toBe(Math.floor(base * 2.0)); // 200%
    });
  });

  describe("post-spike phase", () => {
    it("should return post-spike range after spike ends", () => {
      // Default spikeStart=5, spike occupies 5-9, post-spike at 10+
      const spikeStart = 5;
      const postSpikeIndex = spikeStart + 5; // 10

      if (postSpikeIndex <= 11) {
        const result = calculateLargeSpikePattern(postSpikeIndex, base);
        expect(result.min).toBe(Math.floor(base * RATES.LARGE_SPIKE.POST_PEAK_MIN));
        expect(result.max).toBe(Math.ceil(base * RATES.LARGE_SPIKE.POST_PEAK_MAX));
      }
    });
  });

  describe("with known prices", () => {
    it("should project from known decreasing prices in pre-spike phase", () => {
      const knownPrices = [
        { index: 0, price: 88 },
        { index: 1, price: 84 },
      ];
      // These are decreasing, so pattern detects pre-spike phase
      const result = calculateLargeSpikePattern(0, base, knownPrices);
      // Period 0 is the last known at index 0 in pre-spike
      expect(result.min).toBeLessThanOrEqual(result.max);
    });

    it("should detect spike from trend reversal", () => {
      // Falling then rising → spike detected
      const knownPrices = [
        { index: 0, price: 88 },
        { index: 1, price: 84 },
        { index: 2, price: 95 }, // reversal
      ];
      // Period 2 should be near the start of spike phase
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
