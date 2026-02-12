import { describe, expect, it } from "vitest";
import TurnipPredictor from '../predictor';

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
        "mon_am": 100, "mon_pm": 90,
        "tue_am": 85, "tue_pm": 120,
        "wed_am": 200, "wed_pm": 6000,
        "thu_am": 4000, "thu_pm": 3000,
        "fri_am": 2000, "fri_pm": 1000,
        "sat_am": 600, "sat_pm": 550,
      });
  
      expect(validatedPrices).toEqual({
        "mon_am": 100, "mon_pm": 90,
        "tue_am": 85, "tue_pm": 120,
        "wed_am": 200, "sat_am": 600,
        "sat_pm": 550,
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
});
