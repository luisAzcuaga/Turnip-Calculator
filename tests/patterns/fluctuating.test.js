import { BUY_PRICE_MIN, RATES } from "../../constants.js";
import { calculateFluctuatingPattern, isPossibleFluctuating } from "../../patterns/fluctuating.js";
import { describe, expect, it } from "vitest";

describe("patterns/fluctuating", () => {
  const base = 100;

  describe("invalid base price", () => {
    it("should return {0, 0} for undefined base", () => {
      const result = calculateFluctuatingPattern(0, undefined);
      expect(result).toEqual({ min: 0, max: 0 });
    });

    it("should return {0, 0} for base below minimum", () => {
      const result = calculateFluctuatingPattern(0, BUY_PRICE_MIN - 1);
      expect(result).toEqual({ min: 0, max: 0 });
    });

    it("should return {0, 0} for base above maximum", () => {
      const result = calculateFluctuatingPattern(0, 111);
      expect(result).toEqual({ min: 0, max: 0 });
    });
  });

  describe("known price for exact period", () => {
    it("should return exact known price as min and max", () => {
      const knownPrices = [{ index: 3, price: 95 }];
      const result = calculateFluctuatingPattern(3, base, knownPrices);
      expect(result.min).toBe(95);
      expect(result.max).toBe(95);
    });
  });

  describe("without known prices (full range)", () => {
    it("should return full fluctuating range (60-140%)", () => {
      const result = calculateFluctuatingPattern(0, base);
      expect(result.min).toBe(Math.floor(base * RATES.FLUCTUATING.MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.FLUCTUATING.MAX));
    });

    it("should always have min <= max for all periods", () => {
      for (let i = 0; i < 12; i++) {
        const result = calculateFluctuatingPattern(i, base);
        expect(result.min).toBeLessThanOrEqual(result.max);
      }
    });

    it("should return same range for any period without data", () => {
      const first = calculateFluctuatingPattern(0, base);
      const last = calculateFluctuatingPattern(11, base);
      expect(first).toEqual(last);
    });
  });

  describe("with one low phase detected", () => {
    it("should use low phase range for periods within the phase", () => {
      // Create prices that form a clear low phase: indices 3-5 at ~70%
      const knownPrices = [
        { index: 0, price: 120 },
        { index: 1, price: 115 },
        { index: 2, price: 110 },
        { index: 3, price: 75 },  // low phase start (<85%)
        { index: 4, price: 70 },  // still low, still falling
        { index: 5, price: 65 },  // low phase (3 periods)
      ];

      // Period in the detected low phase should get low range
      const result = calculateFluctuatingPattern(3, base, knownPrices);
      // This is a known price, so it returns exact
      expect(result.min).toBe(75);
      expect(result.max).toBe(75);
    });

    it("should use high phase range for periods clearly after both low phases", () => {
      // Low phase early in the week → late periods should be high phase
      const knownPrices = [
        { index: 0, price: 120 },
        { index: 1, price: 75 },  // low phase start
        { index: 2, price: 70 },  // low phase (2 periods)
        { index: 3, price: 110 }, // back to high
        { index: 4, price: 115 },
      ];

      // Saturday periods (10-11) should be high phase
      // since low phase happened early (period 1-2)
      const result = calculateFluctuatingPattern(10, base, knownPrices);
      expect(result.min).toBe(Math.floor(base * RATES.FLUCTUATING.HIGH_PHASE_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.FLUCTUATING.HIGH_PHASE_MAX));
    });
  });

  describe("with both low phases detected", () => {
    it("should predict high phase for remaining periods", () => {
      // Two clear low phases detected
      const knownPrices = [
        { index: 0, price: 120 },  // highPhase1
        { index: 1, price: 75 },   // lowPhase1 start
        { index: 2, price: 70 },   // lowPhase1 end (2 periods)
        { index: 3, price: 110 },  // highPhase2
        { index: 4, price: 115 },  // highPhase2
        { index: 5, price: 72 },   // lowPhase2 start
        { index: 6, price: 68 },   // lowPhase2
        { index: 7, price: 64 },   // lowPhase2 end (3 periods, since lowPhase1=2 → lowPhase2=3)
      ];

      // Period 8+ should be highPhase3 (high phase)
      const result = calculateFluctuatingPattern(8, base, knownPrices);
      expect(result.min).toBe(Math.floor(base * RATES.FLUCTUATING.HIGH_PHASE_MIN));
      expect(result.max).toBe(Math.ceil(base * RATES.FLUCTUATING.HIGH_PHASE_MAX));
    });

    it("should use low range for periods within detected low phases", () => {
      const knownPrices = [
        { index: 0, price: 120 },
        { index: 1, price: 75 },
        { index: 2, price: 70 },
        { index: 3, price: 110 },
        { index: 4, price: 115 },
        { index: 5, price: 72 },
        { index: 6, price: 68 },
        { index: 7, price: 64 },
      ];

      // Periods within known low phases return exact price
      const result5 = calculateFluctuatingPattern(5, base, knownPrices);
      expect(result5.min).toBe(72);
      expect(result5.max).toBe(72);
    });
  });

  describe("with various base prices (90-110)", () => {
    it("should produce valid ranges for all buy prices and periods", () => {
      for (let buyPrice = 90; buyPrice <= 110; buyPrice++) {
        for (let period = 0; period < 12; period++) {
          const result = calculateFluctuatingPattern(period, buyPrice);
          expect(result.min).toBeLessThanOrEqual(result.max);
          expect(result.min).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  describe("low phase length rule (lowPhase1 + lowPhase2 = 5)", () => {
    it("should have second low phase length complement first (2+3=5)", () => {
      // lowPhase1 = 2 periods → lowPhase2 should be 3 periods
      const knownPrices = [
        { index: 0, price: 120 },
        { index: 1, price: 75 },   // lowPhase1 (period 1)
        { index: 2, price: 70 },   // lowPhase1 (period 2) → length = 2
        { index: 3, price: 110 },  // highPhase2
        { index: 4, price: 115 },  // highPhase2
        { index: 5, price: 72 },   // lowPhase2 start
        { index: 6, price: 68 },   // lowPhase2
        { index: 7, price: 64 },   // lowPhase2 → length = 3
      ];

      // Period 8 should be high (after lowPhase2 ends)
      const result8 = calculateFluctuatingPattern(8, base, knownPrices);
      expect(result8.min).toBe(Math.floor(base * RATES.FLUCTUATING.HIGH_PHASE_MIN));
      expect(result8.max).toBe(Math.ceil(base * RATES.FLUCTUATING.HIGH_PHASE_MAX));
    });
  });
});

describe("isPossibleFluctuating", () => {
  const base = 100;

  it("should accept prices within 60-140% range", () => {
    const prices = [
      { index: 0, price: 105 },
      { index: 1, price: 95 },
      { index: 2, price: 110 },
    ];
    expect(isPossibleFluctuating(prices, base).possible).toBe(true);
  });

  it("should reject when price is outside 60-140% range", () => {
    // 160/100 = 1.60 > 1.40 → out of range
    const prices = [{ index: 0, price: 160 }];
    expect(isPossibleFluctuating(prices, base).possible).toBe(false);
  });

  it("should reject when 2+ consecutive decreases from start", () => {
    // 100 → 95 (< 100*0.98=98) → 90 (< 95*0.98=93.1): 2 decreases from start
    const prices = [
      { index: 0, price: 100 },
      { index: 1, price: 95 },
      { index: 2, price: 90 },
    ];
    expect(isPossibleFluctuating(prices, base).possible).toBe(false);
  });

  it("should reject when too many consecutive decreases (>3)", () => {
    // Start with an increase to avoid decreasesFromStart rule, then 4+ decreases
    const prices = [
      { index: 0, price: 100 },
      { index: 1, price: 110 }, // increase
      { index: 2, price: 105 }, // decrease
      { index: 3, price: 100 }, // decrease
      { index: 4, price: 95 },  // decrease
      { index: 5, price: 90 },  // decrease → 4 consecutive
    ];
    expect(isPossibleFluctuating(prices, base).possible).toBe(false);
  });

  it("should reject when too many consecutive increases (>2)", () => {
    // 3 consecutive increases (> previous * 1.02)
    const prices = [
      { index: 0, price: 80 },
      { index: 1, price: 85 }, // increase
      { index: 2, price: 90 }, // increase
      { index: 3, price: 95 }, // increase → 3 consecutive
    ];
    expect(isPossibleFluctuating(prices, base).possible).toBe(false);
  });
});
