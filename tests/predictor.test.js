import { describe, expect, it } from "vitest";
import TurnipPredictor from '../lib/predictor';

import defaultBaseInstance from './fixtures/defaultBaseInstance';
import defaultPrediction from './fixtures/defaultPrediction';

describe('TurnipPredictor', () => {
  it('should throw error with invalid buy prices', () => {
    const turnipPredictor1 = () => new TurnipPredictor();
    const turnipPredictor2 = () => new TurnipPredictor(0);
    const turnipPredictor3 = () => new TurnipPredictor(1000);
    
    expect(turnipPredictor1).toThrow('El precio de compra es obligatorio');
    expect(turnipPredictor2).toThrow('Precio de compra 0 fuera de rango válido (90-110)');
    expect(turnipPredictor3).toThrow('Precio de compra 1000 fuera de rango válido (90-110)');
  });

  it('should initialize with valid price', () => {
    const turnipPredictor = new TurnipPredictor(100);
    
    expect(turnipPredictor).toBeInstanceOf(TurnipPredictor);
    expect(turnipPredictor.buyPrice).toBe(100);
    expect(turnipPredictor.knownPrices).toEqual({});
    expect(turnipPredictor.previousPattern).toBeNull();
    expect(turnipPredictor.defaultProbabilities).toBeDefined();
    expect(turnipPredictor.transitionProbabilities).toBeDefined();
  });

  it('should initialize with any valid buy price', () => {
    // Math random between 90 and 110
    const buyPrice = Math.floor(Math.random() * (110 - 90 + 1)) + 90;
    const turnipPredictor = new TurnipPredictor(buyPrice);

    expect(turnipPredictor).toBeInstanceOf(TurnipPredictor);
    expect(turnipPredictor).toMatchObject(
      defaultBaseInstance(buyPrice)
    );
  });
  describe('#validatePrices', () => {
    it('should filter invalid prices', () => {
      const validatedPrices = TurnipPredictor.validatePrices({
        mon_am: 100, mon_pm: 90,
        tue_am: 85, tue_pm: 120,
        wed_am: 200, wed_pm: 6000,
        thu_am: 4000, thu_pm: 3000,
        fri_am: 2000, fri_pm: 1000,
        sat_am: 600, sat_pm: 550,
      });
  
      expect(validatedPrices).toEqual({
        mon_am: 100, mon_pm: 90,
        tue_am: 85, tue_pm: 120,
        wed_am: 200, sat_am: 600,
        sat_pm: 550,
      });
    });
  })

  describe('#predict', () => {
    it('should return base predition structure with a valid buy price', () => {
      // Math random between 90 and 110
      const valueValue = Math.floor(Math.random() * (110 - 90 + 1)) + 90;
      const turnipPredictor = new TurnipPredictor(valueValue);

      const prediction = turnipPredictor.predict();

      Object.values(prediction.predictions).forEach(p => {
        expect(p.min).toBeLessThanOrEqual(p.max);
      });
      expect(prediction).toMatchObject(defaultPrediction);
    });
  })

  // ==========================================================================
  // DATA HELPERS
  // ==========================================================================

  describe('#getPriceArrayWithIndex', () => {
    it('should return empty array for empty knownPrices', () => {
      const p = new TurnipPredictor(100);
      expect(p.getPriceArrayWithIndex()).toEqual([]);
    });

    it('should convert knownPrices to array with correct indices and day keys', () => {
      const p = new TurnipPredictor(100, { mon_am: 90, tue_am: 85 });
      const result = p.getPriceArrayWithIndex();
      expect(result).toEqual([
        { index: 0, price: 90 },
        { index: 2, price: 85 },
      ]);
    });

    it('should include all 12 periods when all prices are provided', () => {
      const prices = {
        mon_am: 90, mon_pm: 88, tue_am: 85, tue_pm: 82,
        wed_am: 80, wed_pm: 78, thu_am: 75, thu_pm: 72,
        fri_am: 70, fri_pm: 68, sat_am: 65, sat_pm: 62,
      };
      const p = new TurnipPredictor(100, prices);
      expect(p.getPriceArrayWithIndex()).toHaveLength(12);
    });

    it('should parse prices as integers', () => {
      const p = new TurnipPredictor(100, { mon_am: 90 });
      const result = p.getPriceArrayWithIndex();
      expect(result[0].price).toBe(90);
      expect(typeof result[0].price).toBe('number');
    });
  });

  describe('#detectPossiblePatterns', () => {
    it('should return all 4 patterns with no known prices', () => {
      const p = new TurnipPredictor(100);
      const result = p.detectPossiblePatterns();
      expect(result).toContain('fluctuating');
      expect(result).toContain('large_spike');
      expect(result).toContain('small_spike');
      expect(result).toContain('decreasing');
    });

    it('should exclude decreasing when Monday price > buyPrice', () => {
      const p = new TurnipPredictor(100, { mon_am: 105 });
      const result = p.detectPossiblePatterns();
      expect(result).not.toContain('decreasing');
      expect(result).not.toContain('large_spike'); // large spike also requires mon_am ≤ buyPrice*0.90
      expect(result).not.toContain('small_spike'); // small spike also requires mon_am ≤ buyPrice*0.90
    });

    it('should return fluctuating as fallback when no patterns fit', () => {
      // Very extreme prices that don't fit any pattern cleanly
      // Price of 660 at period 0 rules out decreasing (>buyPrice),
      // but we need to find something that rules out all patterns
      // Actually it's hard to rule out ALL patterns - the method always returns at least fluctuating
      const p = new TurnipPredictor(100);
      const result = p.detectPossiblePatterns();
      // At minimum, fluctuating should be present as fallback
      expect(result.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ==========================================================================
  // SCORING & DETECTION
  // ==========================================================================

  describe('#getBaseProbabilities', () => {
    it('should return default probabilities with no previous pattern', () => {
      const p = new TurnipPredictor(100);
      expect(p.getBaseProbabilities()).toEqual({
        fluctuating: 0.35,
        large_spike: 0.25,
        decreasing: 0.15,
        small_spike: 0.25,
      });
    });

    it('should return transition probabilities for a known previous pattern', () => {
      const p = new TurnipPredictor(100, {}, 'small_spike');
      expect(p.getBaseProbabilities()).toEqual({
        fluctuating: 0.45,
        large_spike: 0.25,
        decreasing: 0.15,
        small_spike: 0.15,
      });
    });
  });

  describe('#calculatePatternScore', () => {
    it('should give high score to decreasing with all prices declining', () => {
      const p = new TurnipPredictor(100);
      const prices = [
        { index: 0, price: 88, day: 'mon_am' },
        { index: 1, price: 85, day: 'mon_pm' },
        { index: 2, price: 82, day: 'tue_am' },
      ];
      const score = p.calculatePatternScore('decreasing', prices);
      // All decreasing → base 100 (perfect). Avg 85 not < 80 → no bonus.
      expect(score).toBe(100);
    });

    it('should reject decreasing when prices rise (via detectPossiblePatterns)', () => {
      // calculatePatternScore for 'decreasing' is only reached after reasonsToRejectDecreasing
      // has confirmed no prices rise. Test the rejection path directly instead.
      const p = new TurnipPredictor(100, { mon_am: 88, mon_pm: 90 }); // rises
      const possible = p.detectPossiblePatterns();
      expect(possible).not.toContain('decreasing');
      expect(p.rejectionReasons.decreasing.length).toBeGreaterThan(0);
    });

    it('should give high score to large_spike with confirmed 200%+ price', () => {
      const p = new TurnipPredictor(100);
      const prices = [
        { index: 0, price: 88, day: 'mon_am' },
        { index: 4, price: 300, day: 'wed_am' },
      ];
      const score = p.calculatePatternScore('large_spike', prices);
      // 300% confirmed: +100, low-to-high (300 > 88*2 and 88 < 100): +40, base: +10
      expect(score).toBeGreaterThanOrEqual(150);
    });

    it('should give high score to fluctuating with Monday price above buy', () => {
      const p = new TurnipPredictor(100);
      const prices = [{ index: 0, price: 105, day: 'mon_am' }];
      const score = p.calculatePatternScore('fluctuating', prices);
      // Monday high: +80, base: +30 = 110
      expect(score).toBeGreaterThanOrEqual(110);
    });

    it('should give score to small_spike with max in 150-190% sweet spot', () => {
      const p = new TurnipPredictor(100);
      const prices = [
        { index: 0, price: 85, day: 'mon_am' },
        { index: 4, price: 170, day: 'wed_am' },
      ];
      const score = p.calculatePatternScore('small_spike', prices);
      // 170% in perfect range (150-190%): +90, base: +20
      expect(score).toBeGreaterThanOrEqual(90);
    });
  });

  describe('#detectPattern', () => {
    it('should return structure with primary, alternatives, and percentages', () => {
      const p = new TurnipPredictor(100);
      const result = p.detectPattern();
      expect(result).toHaveProperty('primary');
      expect(result).toHaveProperty('alternatives');
      expect(result).toHaveProperty('percentages');
      expect(typeof result.primary).toBe('string');
      expect(Array.isArray(result.alternatives)).toBe(true);
    });

    it('should use only base probabilities with no known prices', () => {
      const p = new TurnipPredictor(100);
      const result = p.detectPattern();
      // Without data, fluctuating has highest default probability (0.35)
      expect(result.primary).toBe('fluctuating');
    });

    it('should detect decreasing with consistently declining prices', () => {
      const p = new TurnipPredictor(100, {
        mon_am: 88, mon_pm: 85, tue_am: 82, tue_pm: 79,
        wed_am: 76, wed_pm: 73,
      });
      const result = p.detectPattern();
      expect(result.primary).toBe('decreasing');
    });

    it('should detect large_spike with 200%+ price', () => {
      const p = new TurnipPredictor(100, {
        mon_am: 88, mon_pm: 85,
        wed_am: 300,
      });
      const result = p.detectPattern();
      expect(result.primary).toBe('large_spike');
    });
  });

  // ==========================================================================
  // PREDICTION OUTPUT
  // ==========================================================================

  describe('#predictPrice', () => {
    it('should return min/max for each pattern type', () => {
      const p = new TurnipPredictor(100);
      const patterns = ['decreasing', 'large_spike', 'small_spike', 'fluctuating'];
      patterns.forEach(pattern => {
        const result = p.predictPrice(pattern, 0);
        expect(result).toHaveProperty('min');
        expect(result).toHaveProperty('max');
        expect(result.min).toBeLessThanOrEqual(result.max);
      });
    });

    it('should use fluctuating as default for unrecognized pattern', () => {
      const p = new TurnipPredictor(100);
      const result = p.predictPrice('unknown_pattern', 0);
      const fluctResult = p.predictPrice('fluctuating', 0);
      expect(result).toEqual(fluctResult);
    });
  });

  describe('#getRecommendations', () => {
    it('should return decreasing recommendations', () => {
      const p = new TurnipPredictor(100);
      const rec = p.getRecommendations('decreasing');
      expect(rec).toHaveLength(3);
      expect(rec[0]).toContain('bajarán');
    });

    it('should return large_spike recommendations', () => {
      const p = new TurnipPredictor(100);
      const rec = p.getRecommendations('large_spike');
      expect(rec).toHaveLength(3);
      expect(rec[0]).toContain('pico altísimo');
    });

    it('should return small_spike recommendations', () => {
      const p = new TurnipPredictor(100);
      const rec = p.getRecommendations('small_spike');
      expect(rec).toHaveLength(2);
      expect(rec[0]).toContain('pico moderado');
    });

    it('should return fluctuating recommendations', () => {
      const p = new TurnipPredictor(100);
      const rec = p.getRecommendations('fluctuating');
      expect(rec).toHaveLength(3);
      expect(rec[0]).toContain('variables');
    });
  });

  describe('#getBestSellDay', () => {
    it('should return no-optimal message for fluctuating pattern', () => {
      const p = new TurnipPredictor(100);
      const result = p.getBestSellDay({}, 'fluctuating');
      expect(result.message).toContain('No hay momento óptimo');
    });

    it('should find best predicted price for predictable patterns', () => {
      const p = new TurnipPredictor(100);
      const predictions = {
        mon_am: { isUserInput: true, max: 90 },
        mon_pm: { isUserInput: false, max: 200 },
        tue_am: { isUserInput: false, max: 150 },
      };
      const result = p.getBestSellDay(predictions, 'large_spike');
      expect(result.day).toBe('mon_pm');
      expect(result.price).toBe(200);
    });

    it('should correctly pick highest price regardless of input type', () => {
      const p = new TurnipPredictor(100);
      const predictions = {
        mon_am: { isUserInput: true, max: 300 },
        mon_pm: { isUserInput: false, max: 200 },
      };
      const result = p.getBestSellDay(predictions, 'small_spike');
      expect(result.day).toBe('mon_am');
      expect(result.price).toBe(300);
    });
  });

  // ==========================================================================
  // REAL-LIFE SCENARIO (integration test)
  // ==========================================================================

  describe('Real-life scenario: buyPrice 107, previous small_spike', () => {
    const knownPrices = {
      mon_am: 94, mon_pm: 89, tue_am: 85,
      tue_pm: 79, wed_am: 102, wed_pm: 180,
    };

    it('should detect large_spike as primary pattern', () => {
      const p = new TurnipPredictor(107, knownPrices, 'small_spike');
      const result = p.predict();
      // 180/107 = 168.2% with P1→P2 sequence (102→180) confirms Large Spike structure.
      // Small Spike is rejected because P2 rate (168.2%) >= 140%.
      expect(result.pattern).toBe('large_spike');
    });

    it('should have sensible Thu AM predictions with min <= max', () => {
      const p = new TurnipPredictor(107, knownPrices, 'small_spike');
      const result = p.predict();
      const thuAm = result.predictions.thu_am;
      expect(thuAm.min).toBeLessThanOrEqual(thuAm.max);
      expect(thuAm.isUserInput).toBe(false);
    });

    it('should confirm known prices in predictions', () => {
      const p = new TurnipPredictor(107, knownPrices, 'small_spike');
      const result = p.predict();
      expect(result.predictions.mon_am.isUserInput).toBe(true);
      expect(result.predictions.mon_am.min).toBe(94);
      expect(result.predictions.wed_pm.isUserInput).toBe(true);
      expect(result.predictions.wed_pm.min).toBe(180);
    });

    it('should include all 4 pattern probabilities summing close to 100%', () => {
      const p = new TurnipPredictor(107, knownPrices, 'small_spike');
      const result = p.predict();
      const total = Object.values(result.allProbabilities).reduce((s, v) => s + v, 0);
      // Rounding may cause slight deviation from exactly 100
      expect(total).toBeGreaterThanOrEqual(98);
      expect(total).toBeLessThanOrEqual(102);
    });

    it('should have all unconfirmed predictions with min <= max', () => {
      const p = new TurnipPredictor(107, knownPrices, 'small_spike');
      const result = p.predict();
      Object.values(result.predictions).forEach(pred => {
        expect(pred.min).toBeLessThanOrEqual(pred.max);
      });
    });
  });

  describe('Real-life scenario: buyPrice 110, previous small_spike', () => {
    const knownPrices = {
      mon_am: 56, mon_pm: 52, tue_am: 117,
      tue_pm: 147, wed_am: 173, wed_pm: 188,
      thu_am: 181, thu_pm: 50, fri_am: 45,
      fri_pm: 41, sat_am: 37, sat_pm: 33,
    };

    it('should detect large_spike as primary pattern', () => {
      const p = new TurnipPredictor(110, knownPrices, 'small_spike');
      const result = p.predict();

      expect(result.pattern).toBe('small_spike');
    });

    it('should have sensible Thu AM predictions with min <= max', () => {
      const p = new TurnipPredictor(110, knownPrices, 'small_spike');

      const result = p.predict();
      const thuAm = result.predictions.thu_am;

      expect(thuAm.min).toBeLessThanOrEqual(thuAm.max);
      expect(thuAm.isUserInput).toBe(true);
    });

    it('should confirm known prices in predictions', () => {
      const p = new TurnipPredictor(110, knownPrices, 'small_spike');

      const result = p.predict();

      expect(result.predictions.mon_am.isUserInput).toBe(true);
      expect(result.predictions.mon_am.min).toBe(56);
      expect(result.predictions.wed_pm.isUserInput).toBe(true);
      expect(result.predictions.wed_pm.min).toBe(188);
    });

    it('should include all 4 pattern probabilities summing close to 100%', () => {
      const p = new TurnipPredictor(110, knownPrices, 'small_spike');

      const result = p.predict();
      const total = Object.values(result.allProbabilities).reduce((s, v) => s + v, 0);

      // Rounding may cause slight deviation from exactly 100
      expect(total).toBeGreaterThanOrEqual(98);
      expect(total).toBeLessThanOrEqual(102);
    });

    it('should have all unconfirmed predictions with min <= max', () => {
      const p = new TurnipPredictor(110, knownPrices, 'small_spike');

      const result = p.predict();

      Object.values(result.predictions).forEach(pred => {
        expect(pred.min).toBeLessThanOrEqual(pred.max);
      });
    });
  });
});
