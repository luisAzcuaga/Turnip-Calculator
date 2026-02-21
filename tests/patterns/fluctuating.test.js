import { calculateFluctuatingPattern, reasonsToRejectFluctuating, scoreFluctuating } from "../../lib/patterns/fluctuating.js";
import { describe, expect, it } from "vitest";
import { RATES } from "../../lib/constants.js";

describe("patterns/fluctuating", () => {
  const base = 100;

  it("should return full fluctuating range (60-140%)", () => {
    const result = calculateFluctuatingPattern(base);
    expect(result.min).toBe(Math.floor(base * RATES.FLUCTUATING.MIN));
    expect(result.max).toBe(Math.ceil(base * RATES.FLUCTUATING.MAX));
  });

  it("should produce valid ranges for all buy prices", () => {
    for (let buyPrice = 90; buyPrice <= 110; buyPrice++) {
      const result = calculateFluctuatingPattern(buyPrice);
      expect(result.min).toBeLessThanOrEqual(result.max);
      expect(result.min).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("scoreFluctuating", () => {
  const base = 100;

  it("should give high score with Monday price above buy", () => {
    const prices = [{ index: 0, price: 105 }];
    const { score } = scoreFluctuating(prices, base);
    // Monday high: +80, base: +30 = 110
    expect(score).toBeGreaterThanOrEqual(110);
  });

  it("should give moderate score with prices in normal range", () => {
    const prices = [{ index: 4, price: 95 }];
    const { score } = scoreFluctuating(prices, base);
    // In range (60-140%): +50, base: +30 = 80
    expect(score).toBe(80);
  });

  it("should return reasons array", () => {
    const prices = [{ index: 0, price: 95 }];
    const { reasons } = scoreFluctuating(prices, base);
    expect(Array.isArray(reasons)).toBe(true);
    expect(reasons.length).toBeGreaterThan(0);
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
    expect(reasonsToRejectFluctuating(prices, base)).toBeNull();
  });

  it("should reject when price is outside 60-140% range", () => {
    // 160/100 = 1.60 > 1.40 → out of range
    const prices = [{ index: 0, price: 160 }];
    expect(reasonsToRejectFluctuating(prices, base)).not.toBeNull();
  });
});
