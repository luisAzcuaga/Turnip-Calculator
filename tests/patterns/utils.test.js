import { PERIODS, RATES } from "../../constants.js";
import {
  calculateAvgRateDrop,
  decreasingMaxForPeriod,
  decreasingMin,
  detectLargeSpikeSequence,
  detectSpikePeakStart,
  detectSpikeStart,
  getPeriodName,
  getSpikeStartRange,
  isValidRateDrop,
  largeSpikeStartRange,
  priceCeil,
  priceFloor,
  priceRatio,
  projectPriceFromRate,
} from "../../patterns/utils.js";
import { describe, expect, it } from "vitest";

describe("patterns/utils", () => {
  // ============================================================================
  // priceFloor
  // ============================================================================
  describe("priceFloor", () => {
    it("should return Math.floor(base * rate)", () => {
      expect(priceFloor(100, 0.85)).toBe(85);
      expect(priceFloor(100, 0.90)).toBe(90);
    });

    it("should floor fractional results", () => {
      // 97 * 0.85 = 82.45 → 82
      expect(priceFloor(97, 0.85)).toBe(82);
    });

    it("should handle rate of 1.0", () => {
      expect(priceFloor(100, 1.0)).toBe(100);
    });

    it("should handle high rates", () => {
      expect(priceFloor(100, 6.0)).toBe(600);
    });
  });

  // ============================================================================
  // priceCeil
  // ============================================================================
  describe("priceCeil", () => {
    it("should return Math.ceil(base * rate)", () => {
      expect(priceCeil(100, 0.90)).toBe(90);
      expect(priceCeil(100, 1.40)).toBe(140);
    });

    it("should ceil fractional results", () => {
      // 97 * 0.90 = 87.3 → 88
      expect(priceCeil(97, 0.90)).toBe(88);
    });

    it("should handle exact results without adding", () => {
      expect(priceCeil(100, 0.50)).toBe(50);
    });
  });

  // ============================================================================
  // priceRatio
  // ============================================================================
  describe("priceRatio", () => {
    it("should return the ratio of price to base", () => {
      expect(priceRatio(90, 100)).toBe(0.9);
      expect(priceRatio(140, 100)).toBe(1.4);
    });

    it("should return 1.0 when price equals base", () => {
      expect(priceRatio(100, 100)).toBe(1.0);
    });

    it("should handle prices above base", () => {
      expect(priceRatio(600, 100)).toBe(6.0);
    });
  });

  // ============================================================================
  // isValidRateDrop
  // ============================================================================
  describe("isValidRateDrop", () => {
    const buyPrice = 100;

    it("should validate a 3% rate drop (minimum decay)", () => {
      // prev rate = 0.90, current rate = 0.87 → drop = 0.03
      const result = isValidRateDrop(90, 87, buyPrice);
      expect(result.valid).toBe(true);
      expect(result.rateDrop).toBe(0.03);
    });

    it("should validate a 5% rate drop (maximum decay)", () => {
      // prev rate = 0.90, current rate = 0.85 → drop = 0.05
      const result = isValidRateDrop(90, 85, buyPrice);
      expect(result.valid).toBe(true);
      expect(result.rateDrop).toBe(0.05);
    });

    it("should invalidate a drop larger than 5%", () => {
      // prev rate = 0.90, current rate = 0.83 → drop = 0.07
      const result = isValidRateDrop(90, 83, buyPrice);
      expect(result.valid).toBe(false);
      expect(result.rateDrop).toBe(0.07);
    });

    it("should validate zero drop", () => {
      const result = isValidRateDrop(85, 85, buyPrice);
      expect(result.valid).toBe(true);
      expect(result.rateDrop).toBe(0);
    });

    it("should truncate fractional rate drops to 2 decimals", () => {
      // Simulates game integer arithmetic truncation
      // 0.85 - 0.8 in IEEE 754 = 0.04999... → trunc(4.999...) = 4 → 0.04
      // This is intentional: mirrors the game's integer arithmetic
      const result = isValidRateDrop(85, 80, buyPrice);
      expect(result.rateDrop).toBe(0.04);
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // decreasingMaxForPeriod
  // ============================================================================
  describe("decreasingMaxForPeriod", () => {
    const base = 100;

    it("should return max at period 0 using START_MAX - 0*MIN_DECAY", () => {
      // rate = 0.90 - (0 * 0.03) = 0.90 → ceil(100 * 0.90) = 90
      expect(decreasingMaxForPeriod(base, 0)).toBe(90);
    });

    it("should decrease by MIN_DECAY per period", () => {
      const period1 = decreasingMaxForPeriod(base, 1);
      const period2 = decreasingMaxForPeriod(base, 2);
      // Monotonically decreasing
      expect(period1).toBeLessThan(decreasingMaxForPeriod(base, 0));
      expect(period2).toBeLessThan(period1);
    });

    it("should not go below FLOOR (0.40)", () => {
      // Even at late periods, should respect the floor
      for (let i = 0; i < 20; i++) {
        expect(decreasingMaxForPeriod(base, i)).toBeGreaterThanOrEqual(Math.ceil(base * RATES.FLOOR));
      }
    });
  });

  // ============================================================================
  // decreasingMin
  // ============================================================================
  describe("decreasingMin", () => {
    it("should return floor(base * FLOOR_RATE)", () => {
      // floor(100 * 0.40) = 40
      expect(decreasingMin(100)).toBe(40);
    });

    it("should floor fractional results", () => {
      // floor(97 * 0.40) = floor(38.8) = 38
      expect(decreasingMin(97)).toBe(38);
    });
  });

  // ============================================================================
  // largeSpikeStartRange
  // ============================================================================
  describe("largeSpikeStartRange", () => {
    it("should return min/max for large spike start", () => {
      const range = largeSpikeStartRange(100);
      // min = floor(100 * 0.85) = 85
      // max = ceil(100 * 0.90) = 90
      expect(range.min).toBe(85);
      expect(range.max).toBe(90);
    });

    it("should handle non-round base prices", () => {
      const range = largeSpikeStartRange(97);
      // min = floor(97 * 0.85) = floor(82.45) = 82
      // max = ceil(97 * 0.90) = ceil(87.3) = 88
      expect(range.min).toBe(82);
      expect(range.max).toBe(88);
    });
  });

  // ============================================================================
  // getPeriodName
  // ============================================================================
  describe("getPeriodName", () => {
    it("should return the name for valid indices", () => {
      expect(getPeriodName(0)).toBe("Lunes AM");
      expect(getPeriodName(1)).toBe("Lunes PM");
      expect(getPeriodName(11)).toBe("Sábado PM");
    });

    it("should return fallback for out-of-range index", () => {
      expect(getPeriodName(12)).toBe("Período 12");
      expect(getPeriodName(99)).toBe("Período 99");
    });
  });

  // ============================================================================
  // getSpikeStartRange
  // ============================================================================
  describe("getSpikeStartRange", () => {
    it("should return large spike range (Martes AM to Jueves PM)", () => {
      const range = getSpikeStartRange(true);
      expect(range.min).toBe(PERIODS.LARGE_SPIKE_PEAK_START_MIN); // 2
      expect(range.max).toBe(PERIODS.SPIKE_PEAK_START_MAX); // 7
      expect(range.minName).toBe("Martes PM");
      expect(range.maxName).toBe("Jueves PM");
    });

    it("should return small spike range (Lunes PM to Jueves PM)", () => {
      const range = getSpikeStartRange(false);
      expect(range.min).toBe(PERIODS.SMALL_SPIKE_PEAK_START_MIN); // 1
      expect(range.max).toBe(PERIODS.SPIKE_PEAK_START_MAX); // 7
      expect(range.minName).toBe("Martes AM");
      expect(range.maxName).toBe("Jueves PM");
    });
  });

  // ============================================================================
  // calculateAvgRateDrop
  // ============================================================================
  describe("calculateAvgRateDrop", () => {
    const base = 100;

    it("should return 0 with fewer than 2 prices", () => {
      expect(calculateAvgRateDrop([], base)).toBe(0);
      expect(calculateAvgRateDrop([{ index: 0, price: 85 }], base)).toBe(0);
    });

    it("should calculate average rate drop between consecutive prices", () => {
      const knownPrices = [
        { index: 0, price: 90 }, // rate 0.90
        { index: 1, price: 86 }, // rate 0.86 → drop = 0.04
      ];
      const avg = calculateAvgRateDrop(knownPrices, base);
      expect(avg).toBeCloseTo(0.04, 5);
    });

    it("should average across multiple drops", () => {
      const knownPrices = [
        { index: 0, price: 90 }, // rate 0.90
        { index: 1, price: 87 }, // rate 0.87 → drop = 0.03
        { index: 2, price: 82 }, // rate 0.82 → drop = 0.05
      ];
      // avg = (0.03 + 0.05) / 2 = 0.04
      const avg = calculateAvgRateDrop(knownPrices, base);
      expect(avg).toBeCloseTo(0.04, 5);
    });
  });

  // ============================================================================
  // projectPriceFromRate
  // ============================================================================
  describe("projectPriceFromRate", () => {
    const base = 100;

    it("should project a future price based on rate drop", () => {
      // lastKnown = 85 → rate = 0.85
      // avgDrop = 0.04, periodsAhead = 2
      // projected rate = 0.85 - (0.04 * 2) = 0.77
      // projected price = 100 * 0.77 = 77
      expect(projectPriceFromRate(85, base, 0.04, 2)).toBeCloseTo(77, 5);
    });

    it("should return same price with 0 periods ahead", () => {
      expect(projectPriceFromRate(85, base, 0.04, 0)).toBeCloseTo(85, 5);
    });

    it("should handle 1 period ahead", () => {
      // rate = 0.85 - 0.04 = 0.81 → 100 * 0.81 = 81
      expect(projectPriceFromRate(85, base, 0.04, 1)).toBeCloseTo(81, 5);
    });
  });

  // ============================================================================
  // detectSpikeStart
  // ============================================================================
  describe("detectSpikeStart", () => {
    const buyPrice = 100;

    it("should return not detected for null/empty input", () => {
      expect(detectSpikeStart(null, buyPrice)).toEqual({ detected: false, startIndex: -1 });
      expect(detectSpikeStart([], buyPrice)).toEqual({ detected: false, startIndex: -1 });
      expect(detectSpikeStart([80], buyPrice)).toEqual({ detected: false, startIndex: -1 });
    });

    it("should detect trend reversal (falling then rising)", () => {
      // 90 → 85 → 95: falling then rising at index 2
      const prices = [90, 85, 95];
      const result = detectSpikeStart(prices, buyPrice);
      expect(result.detected).toBe(true);
      expect(result.startIndex).toBe(2);
    });

    it("should detect first rise after being below buyPrice", () => {
      // 80 → 95: below buyPrice then rises at index 1
      const prices = [80, 95];
      const result = detectSpikeStart(prices, buyPrice);
      expect(result.detected).toBe(true);
      expect(result.startIndex).toBe(1);
    });

    it("should detect significant rise (>10% fallback)", () => {
      // 100 → 115: >10% rise detected
      const prices = [100, 115];
      const result = detectSpikeStart(prices, buyPrice);
      expect(result.detected).toBe(true);
      expect(result.startIndex).toBe(1);
    });

    it("should handle object prices with .price property", () => {
      const prices = [{ price: 90 }, { price: 85 }, { price: 95 }];
      const result = detectSpikeStart(prices, buyPrice);
      expect(result.detected).toBe(true);
      expect(result.startIndex).toBe(2);
    });

    it("should not detect spike in steadily declining prices", () => {
      const prices = [90, 87, 84, 81, 78];
      const result = detectSpikeStart(prices, buyPrice);
      expect(result.detected).toBe(false);
    });
  });

  // ============================================================================
  // detectSpikePeakStart
  // ============================================================================
  describe("detectSpikePeakStart", () => {
    const buyPrice = 100;
    const minPeakStart = PERIODS.LARGE_SPIKE_PEAK_START_MIN; // 2
    const maxPeakStart = PERIODS.SPIKE_PEAK_START_MAX; // 7

    it("should return default (Wednesday PM) with no known prices", () => {
      const result = detectSpikePeakStart([], minPeakStart, maxPeakStart, true, buyPrice);
      expect(result).toBe(PERIODS.WEDNESDAY_PM); // 5
    });

    it("should detect peak from trend reversal", () => {
      // Falling then rising: peak starts where rise begins
      const knownPrices = [
        { index: 0, price: 88 },
        { index: 1, price: 84 },
        { index: 2, price: 90 }, // reversal here
      ];
      const result = detectSpikePeakStart(knownPrices, minPeakStart, maxPeakStart, true, buyPrice);
      expect(result).toBe(2);
    });

    it("should detect peak from confirmed large spike (>200%)", () => {
      const knownPrices = [
        { index: 3, price: 85 },
        { index: 4, price: 350 }, // 350% = confirmed large spike peak
        { index: 5, price: 150 }, // declining after max
      ];
      const result = detectSpikePeakStart(knownPrices, minPeakStart, maxPeakStart, true, buyPrice);
      // Max at index 4, peak 3rd period → peakStart = max(2, 4-2) = 2
      expect(result).toBe(2);
    });

    it("should clamp to min/max peak start range", () => {
      // Trend reversal at index 0, but min is 2
      const knownPrices = [
        { index: 0, price: 90 },
        { index: 1, price: 85 },
        { index: 2, price: 95 },
      ];
      const result = detectSpikePeakStart(knownPrices, minPeakStart, maxPeakStart, true, buyPrice);
      expect(result).toBeGreaterThanOrEqual(minPeakStart);
      expect(result).toBeLessThanOrEqual(maxPeakStart);
    });

    it("should use middle of range as fallback", () => {
      // Early decreasing prices with no rise or peak signal
      const knownPrices = [
        { index: 0, price: 88 },
        { index: 1, price: 85 },
      ];
      const result = detectSpikePeakStart(knownPrices, minPeakStart, maxPeakStart, true, buyPrice);
      expect(result).toBeGreaterThanOrEqual(minPeakStart);
      expect(result).toBeLessThanOrEqual(maxPeakStart);
    });
  });

  // ============================================================================
  // detectLargeSpikeSequence
  // ============================================================================
  describe("detectLargeSpikeSequence", () => {
    const buyPrice = 100;

    it("should return not detected with fewer than 2 prices", () => {
      expect(detectLargeSpikeSequence([], buyPrice).detected).toBe(false);
      expect(detectLargeSpikeSequence([{ index: 0, price: 90 }], buyPrice).detected).toBe(false);
    });

    it("should detect P1 (90-140%) → P2 (140-200%) sequence", () => {
      const knownPrices = [
        { index: 3, price: 110 }, // rate 1.10 → P1 range (0.90-1.40)
        { index: 4, price: 160 }, // rate 1.60 → P2 range (1.40-2.00)
      ];
      const result = detectLargeSpikeSequence(knownPrices, buyPrice);
      expect(result.detected).toBe(true);
      expect(result.period1.index).toBe(3);
      expect(result.period2.index).toBe(4);
    });

    it("should not detect when sequence is not consecutive", () => {
      const knownPrices = [
        { index: 3, price: 110 }, // P1 range
        { index: 5, price: 160 }, // P2 range but not consecutive
      ];
      const result = detectLargeSpikeSequence(knownPrices, buyPrice);
      expect(result.detected).toBe(false);
    });

    it("should not detect when rates are outside expected ranges", () => {
      const knownPrices = [
        { index: 3, price: 80 },  // rate 0.80 → below P1 range
        { index: 4, price: 160 }, // rate 1.60 → P2 range
      ];
      const result = detectLargeSpikeSequence(knownPrices, buyPrice);
      expect(result.detected).toBe(false);
    });

    it("should report if there are prices after the sequence", () => {
      const knownPrices = [
        { index: 3, price: 110 },
        { index: 4, price: 160 },
        { index: 5, price: 400 }, // price after sequence
      ];
      const result = detectLargeSpikeSequence(knownPrices, buyPrice);
      expect(result.detected).toBe(true);
      expect(result.hasPricesAfter).toBe(true);
    });

    it("should report no prices after when sequence is at end", () => {
      const knownPrices = [
        { index: 3, price: 110 },
        { index: 4, price: 160 },
      ];
      const result = detectLargeSpikeSequence(knownPrices, buyPrice);
      expect(result.detected).toBe(true);
      expect(result.hasPricesAfter).toBe(false);
    });
  });
});
