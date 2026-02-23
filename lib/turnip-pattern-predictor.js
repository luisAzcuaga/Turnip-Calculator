import {
  BUY_PRICE_MAX,  BUY_PRICE_MIN, CONFIDENCE, DAYS_CONFIG, DEFAULT_PROBABILITIES, PATTERNS,
  PATTERN_NAMES, TRANSITION_PROBABILITIES, TURNIP_PRICE_MAX, TURNIP_PRICE_MIN
} from "./constants.js";
import { calculateDecreasingPattern, reasonsToRejectDecreasing, scoreDecreasing } from "./patterns/decreasing.js";
import { calculateFluctuatingPattern, reasonsToRejectFluctuating, scoreFluctuating } from "./patterns/fluctuating.js";
import { calculateLargeSpikePattern, reasonsToRejectLargeSpike, scoreLargeSpike } from './patterns/large-spike.js';
import { calculateSmallSpikePattern, reasonsToRejectSmallSpike, scoreSmallSpike } from "./patterns/small-spike.js";

// Turnip Price Predictor - Animal Crossing New Horizons
// Based on the actual in-game patterns
export default class TurnipPatternPredictor {

  constructor(buyPrice, knownPrices = {}, previousPattern = null) {
    this.buyPrice = TurnipPatternPredictor.validateBuyPrice(buyPrice);
    this.knownPrices = TurnipPatternPredictor.validatePrices(knownPrices);
    this.previousPattern = PATTERNS[previousPattern?.toUpperCase()] || null

    // Rejection/low-probability reason tracking system
    this.rejectionReasons = {
      fluctuating: [],
      large_spike: [],
      decreasing: [],
      small_spike: []
    };

    // Score reason tracking system (positive and negative)
    this.scoreReasons = {
      fluctuating: [],
      large_spike: [],
      decreasing: [],
      small_spike: []
    };
  }

  // Validate buy price
  static validateBuyPrice(buyPrice) {
    if (buyPrice === undefined || buyPrice === null || buyPrice === '') {
      throw new Error('El precio de compra es obligatorio');
    }
    if (buyPrice < BUY_PRICE_MIN || buyPrice > BUY_PRICE_MAX) {
      throw new Error(
        `Precio de compra ${buyPrice} fuera de rango válido (${BUY_PRICE_MIN}-${BUY_PRICE_MAX})`
      );
    }

    return buyPrice;
  }

  // Validate known prices
  static validatePrices(knownPrices) {
    const validated = {};

    Object.entries(knownPrices).forEach(([key, price]) => {
      if (price === undefined || price === null || price === '') {
        return;
      }

      const numPrice = parseInt(price);

      if (isNaN(numPrice)) {
        console.warn(`Precio inválido para ${key}: ${price}`);
        return;
      }
      if (numPrice < TURNIP_PRICE_MIN || numPrice > TURNIP_PRICE_MAX) {
        console.warn(`Precio ${numPrice} para ${key} fuera de rango válido (${TURNIP_PRICE_MIN}-${TURNIP_PRICE_MAX}).`);
        return;
      }

      validated[key] = numPrice;
    });

    return validated;
  }

  // Get array of known prices with their indices
  getPriceArrayWithIndex() {
    return DAYS_CONFIG.flatMap((day, index) => {
      const price = this.knownPrices[day.key];
      if (price === undefined || price === null || price === '') return [];
      return { index, price };
    });
  }

  // Detect possible patterns based on known prices
  detectPossiblePatterns(knownPricesWithIndex) {
    if (knownPricesWithIndex.length === 0) {
      return Object.values(PATTERNS);
    }

    const possiblePatterns = [];

    const decreasingRejects = reasonsToRejectDecreasing(knownPricesWithIndex, this.buyPrice);
    if (decreasingRejects) this.rejectionReasons.decreasing.push(...decreasingRejects);
    else possiblePatterns.push(PATTERNS.DECREASING);

    const largeSpikeRejects = reasonsToRejectLargeSpike(knownPricesWithIndex, this.buyPrice);
    if (largeSpikeRejects) this.rejectionReasons.large_spike.push(...largeSpikeRejects);
    else possiblePatterns.push(PATTERNS.LARGE_SPIKE);

    const smallSpikeRejects = reasonsToRejectSmallSpike(knownPricesWithIndex, this.buyPrice);
    if (smallSpikeRejects) this.rejectionReasons.small_spike.push(...smallSpikeRejects);
    else possiblePatterns.push(PATTERNS.SMALL_SPIKE);

    const fluctuatingRejects = reasonsToRejectFluctuating(knownPricesWithIndex, this.buyPrice);
    if (fluctuatingRejects) this.rejectionReasons.fluctuating.push(...fluctuatingRejects);
    else possiblePatterns.push(PATTERNS.FLUCTUATING);

    if (possiblePatterns.length === 0) {
      // Falling back to fluctuating when all patterns are rejected.
      return [PATTERNS.FLUCTUATING]
    }

    return possiblePatterns;
  }

  // Detect the most likely pattern with confidence info
  scorePossiblePatterns(knownPricesWithIndex) {
    const possiblePatterns = this.detectPossiblePatterns(knownPricesWithIndex);
    const baseProbabilities = TRANSITION_PROBABILITIES[this.previousPattern] || DEFAULT_PROBABILITIES;

    const scoreFunctions = {
      [PATTERNS.DECREASING]: scoreDecreasing,
      [PATTERNS.LARGE_SPIKE]: scoreLargeSpike,
      [PATTERNS.SMALL_SPIKE]: scoreSmallSpike,
      [PATTERNS.FLUCTUATING]: scoreFluctuating,
    };

    // Compute a score for each possible pattern.
    // With no price data, scores are purely probability-based.
    // With price data, blend pattern-fit score with prior probability:
    //   0 prices → 100% probability, 4 prices → 50/50, 8+ prices → 70% data
    const scores = {};
    possiblePatterns.forEach(pattern => {
      const probabilityScore = (baseProbabilities[pattern] || 0) * 100;
      if (knownPricesWithIndex.length === 0) {
        scores[pattern] = probabilityScore;
      } else {
        const { score: dataScore, reasons } = scoreFunctions[pattern](knownPricesWithIndex, this.buyPrice);
        this.scoreReasons[pattern].push(...reasons);
        const dataWeight = Math.min(knownPricesWithIndex.length / CONFIDENCE.DATA_PERIODS_FOR_MAX, CONFIDENCE.MAX_DATA_WEIGHT);
        const probWeight = 1 - dataWeight;
        scores[pattern] = (dataScore * dataWeight) + (probabilityScore * probWeight);
      }
    });

    // Sort by score and normalize to percentages
    const sortedPatterns = possiblePatterns.sort((a, b) => scores[b] - scores[a]);
    const totalScore = Object.values(scores).reduce((sum, s) => sum + s, 0);
    const percentages = {};
    Object.keys(scores).forEach(pattern => {
      percentages[pattern] = totalScore > 0 ? Math.round((scores[pattern] / totalScore) * 100) : 0;
    });

    return {
      primary: sortedPatterns[0],
      alternatives: sortedPatterns.slice(1, 3).map(p => ({
        pattern: p,
        percentage: percentages[p]
      })),
      scores,
      percentages
    };
  }

  predictPrice(pattern, periodIndex, knownPricesWithIndex) {
    switch (pattern) {
    case PATTERNS.DECREASING:
      return calculateDecreasingPattern(periodIndex, this.buyPrice, knownPricesWithIndex);

    case PATTERNS.LARGE_SPIKE:
      return calculateLargeSpikePattern(periodIndex, this.buyPrice, knownPricesWithIndex);

    case PATTERNS.SMALL_SPIKE:
      return calculateSmallSpikePattern(periodIndex, this.buyPrice, knownPricesWithIndex);

    case PATTERNS.FLUCTUATING:
    default:
      return calculateFluctuatingPattern(this.buyPrice);
    }
  }

  getRecommendations(pattern) {
    let rec = [];

    switch (pattern) {
    case PATTERNS.DECREASING:
      rec.push('📉 Los precios solo bajarán toda la semana');
      rec.push('💡 Vende HOY o visita otra isla');
      rec.push('🏃‍♂️ No esperes, solo empeorarán');
      break;

    case PATTERNS.LARGE_SPIKE:
      rec.push('💰 Espera un pico altísimo (puede llegar a 200-600%)');
      rec.push('⏰ ¡Revisa los precios cada turno!');
      rec.push('✨ Este es el MEJOR patrón posible');
      break;

    case PATTERNS.SMALL_SPIKE:
      rec.push('💵 Espera un pico moderado (140-200%)');
      rec.push('👍 Buena oportunidad para ganancias');
      break;

    case PATTERNS.FLUCTUATING:
    default:
      // Special case since it's the sole pattern that remains after all are rejected.
      if (this.rejectionReasons.fluctuating.length > 0) {
        rec.push(`⚠️ ${[this.rejectionReasons.fluctuating]}`);
      } else {
        rec.push('🎲 Precios variables durante la semana');
        rec.push('✅ Vende cuando supere tu precio de compra');
        rec.push('⚖️ Patrón impredecible, mantente atento');
      }
      break;
    }

    return rec;
  }

  getBestSellDay(predictions, pattern) {
    if (pattern === PATTERNS.FLUCTUATING) {
      return null;
    }

    let bestPrice = 0;
    let bestDay = '';

    Object.entries(predictions).forEach(([key, data]) => {
      if (data.max > bestPrice) {
        bestPrice = data.max;
        bestDay = key;
      }
    });

    return { day: bestDay, price: bestPrice };
  }

  predictWeekPrices(primaryPattern, knownPricesWithIndex) {
    const weekPredictions = {};
    DAYS_CONFIG.forEach((day, index) => {
      const price = this.knownPrices[day.key];
      if (price !== undefined && price !== null && price !== '') {
        weekPredictions[day.key] = {
          min: parseInt(price),
          max: parseInt(price),
          isUserInput: true
        };
      } else {
        const estimate = this.predictPrice(primaryPattern, index, knownPricesWithIndex);
        weekPredictions[day.key] = {
          min: estimate.min,
          max: estimate.max,
          isUserInput: false
        };
      }
    });

    return weekPredictions;
  }

  execute() {
    const knownPricesWithIndex = this.getPriceArrayWithIndex();
    const patternsResults = this.scorePossiblePatterns(knownPricesWithIndex);
    const predictions = this.predictWeekPrices(patternsResults.primary, knownPricesWithIndex);

    return {
      pattern: patternsResults.primary,
      patternName: PATTERN_NAMES[patternsResults.primary],
      allProbabilities: {
        fluctuating: patternsResults.percentages['fluctuating'] || 0,
        large_spike: patternsResults.percentages['large_spike'] || 0,
        decreasing: patternsResults.percentages['decreasing'] || 0,
        small_spike: patternsResults.percentages['small_spike'] || 0
      },
      alternatives: patternsResults.alternatives.map(alt => ({
        pattern: alt.pattern,
        name: PATTERN_NAMES[alt.pattern],
        percentage: alt.percentage
      })),
      predictions: predictions,
      recommendations: this.getRecommendations(patternsResults.primary),
      bestSellDay: this.getBestSellDay(predictions, patternsResults.primary),
      rejectionReasons: this.rejectionReasons,
      scoreReasons: this.scoreReasons
    };
  }
}
