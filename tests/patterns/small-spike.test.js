import { calculateSmallSpikePattern, reasonsToRejectSmallSpike, scoreSmallSpike } from "../../lib/patterns/small-spike.js";
import { describe, expect, it } from "vitest";
import { RATES } from "../../lib/constants.js";

describe("patterns/small-spike", () => {
  const base = 100;
  // Default spikeStart with no known prices = WEDNESDAY_PM (5)
  const defaultSpikeStart = 5;

  describe("without known prices (algorithm defaults)", () => {
    it("should return pre-spike decreasing range for period 0", () => {
      const result = calculateSmallSpikePattern(0, base);
      // Pre-spike: min = floor(100 * 0.40) = 40, max = ceil(100 * 0.90) = 90
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.START_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.START_MAX));
    });

    it("should always have min <= max for all periods", () => {
      for (let i = 0; i < 12; i++) {
        const result = calculateSmallSpikePattern(i, base);
        expect(result.min).toBeLessThanOrEqual(result.max);
      }
    });

    it("should have spike values above base price", () => {
      const results = Array.from({ length: 12 }, (_, i) =>
        calculateSmallSpikePattern(i, base)
      );
      const hasAboveBase = results.some(r => r.max > base);
      expect(hasAboveBase).toBe(true);
    });
  });

  describe("spike phase (initial periods)", () => {
    it("should use 90-140% range for first two spike periods", () => {
      // spikePhaseIndex 0 and 1 use SPIKE_PHASES[0] rates
      const result0 = calculateSmallSpikePattern(defaultSpikeStart, base);
      const result1 = calculateSmallSpikePattern(defaultSpikeStart + 1, base);

      for (const result of [result0, result1]) {
        expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.SPIKE_PHASES[0].min));
        expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.SPIKE_PHASES[0].max));
      }
    });
  });

  describe("spike phase (true max - spikePhaseIndex 3)", () => {
    it("should show full theoretical range without known spike data", () => {
      const trueMaxIndex = defaultSpikeStart + 3; // period 8
      const result = calculateSmallSpikePattern(trueMaxIndex, base);
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.PEAK_RATE_MAX));
    });
  });

  describe("spike phase (intermediate - spikePhaseIndex 2 & 4)", () => {
    it("should show intermediate range (1.4 to rate) - 1 bell", () => {
      const intermediateIndex = defaultSpikeStart + 2; // period 7
      const result = calculateSmallSpikePattern(intermediateIndex, base);
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.PEAK_RATE_MAX - 1));
    });
  });

  describe("post-spike phase", () => {
    it("should return post-spike range for periods after the spike", () => {
      const postSpikeIndex = defaultSpikeStart + 5; // period 10
      const result = calculateSmallSpikePattern(postSpikeIndex, base);
      expect(result.min).toBe(Math.floor(base * RATES.SMALL_SPIKE.POST_PEAK_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.SMALL_SPIKE.POST_PEAK_MAX));
    });
  });

  describe("with known prices", () => {
    it("should narrow true max range when spike phase 3 price is known", () => {
      // Trend reversal at index 2 → spikeStart = 2
      // spikeStart+2 (index 4) = spikePhaseIndex 2 (intermediate)
      // spikeStart+3 (index 5) = spikePhaseIndex 3 (true max)
      const knownPrices = [
        { index: 0, price: 85 },
        { index: 1, price: 80 },
        { index: 2, price: 95 },
        { index: 4, price: 155 }, // spikePhaseIndex 2
      ];
      const result = calculateSmallSpikePattern(5, base, knownPrices);
      // With spikePhaseIndex 2 known, true max min should be period3price + 1
      expect(result.min).toBeGreaterThanOrEqual(156);
      expect(result.min).toBeLessThanOrEqual(result.max);
    });

    it("should return exact price when true max period is known", () => {
      const knownPrices = [
        { index: 0, price: 85 },
        { index: 1, price: 80 },
        { index: 2, price: 95 },
        { index: 5, price: 180 }, // spikeStart=2, spikePhaseIndex 3 = true max
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

describe("scoreSmallSpike", () => {
  const base = 100;

  it("should give high score with max in 150-190% sweet spot", () => {
    const prices = [
      { index: 0, price: 85 },
      { index: 4, price: 170 },
    ];
    const { score } = scoreSmallSpike(prices, base);
    // 170% in perfect range (150-190%): +90, base: +20
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it("should reject when max exceeds 200%", () => {
    const prices = [{ index: 4, price: 210 }];
    const { score } = scoreSmallSpike(prices, base);
    expect(score).toBe(0);
  });

  it("should return reasons array", () => {
    const prices = [{ index: 0, price: 85 }];
    const { reasons } = scoreSmallSpike(prices, base);
    expect(Array.isArray(reasons)).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
  });
});

describe("isPossibleSmallSpike", () => {
  const base = 100;

  it("should return true for empty prices", () => {
    expect(reasonsToRejectSmallSpike([], base)).toBeNull();
  });

  it("should reject when max price exceeds 200%", () => {
    const prices = [{ index: 4, price: 210 }];
    expect(reasonsToRejectSmallSpike(prices, base)).not.toBeNull();
  });

  it("should reject when too late (Thursday PM+) with no significant rise", () => {
    const prices = [
      { index: 0, price: 88 },
      { index: 1, price: 85 },
      { index: 7, price: 82 },
    ];
    expect(reasonsToRejectSmallSpike(prices, base)).not.toBeNull();
  });

  it("should reject when confirmation P2 rate >= 140% (confirms Large Spike)", () => {
    // P1→P2: 110 (1.10) → 160 (1.60). P2 at 160% >= 140% → impossible for Small Spike
    const prices = [
      { index: 3, price: 110 },
      { index: 4, price: 160 },
    ];
    expect(reasonsToRejectSmallSpike(prices, base)).not.toBeNull();
  });

  it("should accept prices with moderate max in 140-200% range late in week", () => {
    const prices = [
      { index: 0, price: 85 },
      { index: 1, price: 82 },
      { index: 6, price: 160 },
      { index: 8, price: 80 },
    ];
    expect(reasonsToRejectSmallSpike(prices, base)).toBeNull();
  });
});
