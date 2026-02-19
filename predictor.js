import {
  BUY_PRICE_MAX,  BUY_PRICE_MIN, CONFIDENCE, DAYS_CONFIG, DEFAULT_PROBABILITIES, PATTERNS, 
  PATTERN_NAMES, PERIODS, THRESHOLDS, TRANSITION_PROBABILITIES, TURNIP_PRICE_MAX,
  TURNIP_PRICE_MIN
} from "./constants.js";
import { detectLargeSpikeSequence } from "./patterns/utils.js";

import calculateDecreasingPattern, { isPossibleDecreasing } from "./patterns/decreasing.js";
import calculateFluctuatingPattern, { isPossibleFluctuating } from "./patterns/fluctuating.js";
import calculateLargeSpikePattern, { isPossibleLargeSpike } from './patterns/large-spike.js';
import calculateSmallSpikePattern, { isPossibleSmallSpike } from "./patterns/small-spike.js";

// Turnip Price Predictor - Animal Crossing New Horizons
// Based on the actual in-game patterns
export default class TurnipPredictor {
  constructor(buyPrice, knownPrices = {}, previousPattern = null) {
    if (buyPrice === undefined || buyPrice === null || buyPrice === '') {
      throw new Error('El precio de compra es obligatorio');
    }
    if (buyPrice < BUY_PRICE_MIN || buyPrice > BUY_PRICE_MAX) {
      throw new Error(
        `Precio de compra ${buyPrice} fuera de rango válido (${BUY_PRICE_MIN}-${BUY_PRICE_MAX})`
      );
    }

    this.buyPrice = buyPrice;
    this.knownPrices = TurnipPredictor.validatePrices(knownPrices);
    this.previousPattern = Object.values(PATTERNS).includes(previousPattern)
      ? previousPattern
      : null;

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

    // Default probabilities (no history) - from constants.js
    this.defaultProbabilities = DEFAULT_PROBABILITIES;

    // Pattern transition matrix (based on actual ACNH code) - from constants.js
    this.transitionProbabilities = TRANSITION_PROBABILITIES;
  }

  // Validate known prices
  static validatePrices(knownPrices) {
    const validated = {};

    Object.entries(knownPrices).forEach(([key, price]) => {
      if (price === undefined || price === null || price === '') {
        return; // Skip empty values
      }

      const numPrice = parseInt(price);

      if (isNaN(numPrice)) {
        console.warn(`Precio inválido para ${key}: ${price}`);
        return;
      }

      if (numPrice < TURNIP_PRICE_MIN || numPrice > TURNIP_PRICE_MAX) {
        console.warn(
          `Precio ${numPrice} para ${key} fuera de rango válido (${TURNIP_PRICE_MIN}-${TURNIP_PRICE_MAX}).`
        );
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
  detectPossiblePatterns() {
    const knownPrices = this.getPriceArrayWithIndex();

    if (knownPrices.length === 0) {
      return Object.values(PATTERNS);
    }

    const possiblePatterns = [];

    const decreasing = isPossibleDecreasing(knownPrices, this.buyPrice);
    if (decreasing.possible) possiblePatterns.push(PATTERNS.DECREASING);
    else this.rejectionReasons.decreasing.push(...decreasing.reasons);

    const largeSpike = isPossibleLargeSpike(knownPrices, this.buyPrice);
    if (largeSpike.possible) possiblePatterns.push(PATTERNS.LARGE_SPIKE);
    else this.rejectionReasons.large_spike.push(...largeSpike.reasons);

    const smallSpike = isPossibleSmallSpike(knownPrices, this.buyPrice);
    if (smallSpike.possible) possiblePatterns.push(PATTERNS.SMALL_SPIKE);
    else this.rejectionReasons.small_spike.push(...smallSpike.reasons);

    const fluctuating = isPossibleFluctuating(knownPrices, this.buyPrice);
    if (fluctuating.possible) possiblePatterns.push(PATTERNS.FLUCTUATING);
    else this.rejectionReasons.fluctuating.push(...fluctuating.reasons);

    return possiblePatterns.length > 0 ? possiblePatterns : [PATTERNS.FLUCTUATING];
  }



  // Get base probabilities based on previous pattern
  getBaseProbabilities() {
    return this.previousPattern
      ? this.transitionProbabilities[this.previousPattern]
      : this.defaultProbabilities;
  }

  // Detect the most likely pattern with confidence info
  detectPattern() {
    const possiblePatterns = this.detectPossiblePatterns();
    const knownPrices = this.getPriceArrayWithIndex();
    const baseProbabilities = this.getBaseProbabilities();

    // If no price data, use base probabilities only
    if (knownPrices.length === 0) {
      // Calculate percentages based on probabilities
      const percentages = {};
      let totalProb = 0;

      possiblePatterns.forEach(pattern => {
        const prob = baseProbabilities[pattern] || 0;
        percentages[pattern] = prob;
        totalProb += prob;
      });

      // Normalize to 100%
      if (totalProb > 0) {
        Object.keys(percentages).forEach(pattern => {
          percentages[pattern] = Math.round((percentages[pattern] / totalProb) * 100);
        });
      }

      // Find the most likely pattern
      const sortedByProb = possiblePatterns.sort((a, b) =>
        (baseProbabilities[b] || 0) - (baseProbabilities[a] || 0)
      );
      const primaryPattern = sortedByProb[0];

      return {
        primary: primaryPattern,
        alternatives: sortedByProb.slice(1, 3).map(p => ({
          pattern: p,
          percentage: percentages[p]
        })),
        percentages: percentages
      };
    }

    // Calculate score combining base probabilities with data analysis
    const scores = {};
    possiblePatterns.forEach(pattern => {
      const dataScore = this.calculatePatternScore(pattern, knownPrices);
      const probabilityScore = (baseProbabilities[pattern] || 0) * 100; // Convert to 0-100 scale

      // IMPROVEMENT #3: Adjust data vs probability weight
      // Combine scores: keep minimum 30% weight for probabilities
      // With 0 prices: 100% probabilities
      // With 4 prices: 50% probabilities, 50% data
      // With 8+ prices: 70% data, 30% probabilities (minimum)
      const dataWeight = Math.min(knownPrices.length / CONFIDENCE.DATA_PERIODS_FOR_MAX, CONFIDENCE.MAX_DATA_WEIGHT);
      const probWeight = 1 - dataWeight; // Min 30% weight for probabilities

      scores[pattern] = (dataScore * dataWeight) + (probabilityScore * probWeight);
    });

    // Sort patterns by score
    const sortedPatterns = possiblePatterns.sort((a, b) => scores[b] - scores[a]);
    const bestPattern = sortedPatterns[0];

    // Convert scores to percentages
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const percentages = {};
    Object.keys(scores).forEach(pattern => {
      percentages[pattern] = totalScore > 0 ? Math.round((scores[pattern] / totalScore) * 100) : 0;
    });

    return {
      primary: bestPattern,
      alternatives: sortedPatterns.slice(1, 3).map(p => ({
        pattern: p,
        percentage: percentages[p]
      })),
      scores: scores,
      percentages: percentages
    };
  }

  // Calculate how well the data fits a pattern
  calculatePatternScore(pattern, knownPrices) {
    let score = 0;
    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const avgPrice = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
    const ratio = maxPrice / this.buyPrice;

    switch (pattern) {
    case PATTERNS.DECREASING:
      // Penalize if there are increases
      const isDecreasing = knownPrices.every((current, i) => {
        if (i === 0) return true;

        return current.price <= knownPrices[i - 1].price;
      });

      if (isDecreasing) {
        score = 100;
        this.scoreReasons.decreasing.push(`✅ Todos los precios bajan consecutivamente (patrón perfecto de Decreciente)`);
      } else {
        score = 20;
        this.scoreReasons.decreasing.push(`❌ Hay precios que suben (Decreciente solo baja)`);
      }

      // Bonus if average is low
      if (avgPrice < this.buyPrice * THRESHOLDS.DECREASING_LOW_AVG) {
        score += 30;
        this.scoreReasons.decreasing.push(`✅ Promedio bajo (${Math.round(avgPrice)} < ${Math.round(THRESHOLDS.DECREASING_LOW_AVG * 100)}% del base)`);
      }
      break;

    case PATTERNS.LARGE_SPIKE:
      // Bonus if there's a very high max (200%+)
      if (ratio >= THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
        score += 100;
        this.scoreReasons.large_spike.push(`✅ ¡Pico enorme detectado! ${maxPrice} bayas (${Math.round(ratio * 100)}%) confirma Large Spike`);
      } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio < THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
        // Ambiguous range: could be Small Spike or Large Spike
        if (ratio < THRESHOLDS.LARGE_SPIKE_NEAR_LIMIT) {
          score += 10;
          this.scoreReasons.large_spike.push(`⚠️ Precio máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) está en rango ambiguo, más cerca de Small Spike`);
        } else {
          score += 30;
          this.scoreReasons.large_spike.push(`⚠️ Precio máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) cerca del límite de Large Spike (190-200%)`);
        }
      } else {
        score += 5;
        this.scoreReasons.large_spike.push(`⏳ Esperando confirmación. Máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) es válido para fase inicial, el siguiente período debe estar entre 140-200% para confirmar Pico Grande`);
      }

      // Bonus if there's a low phase followed by a very rapid spike
      const hasLowToHigh = knownPrices.some((p, i) =>
        i > 0 && p.price > knownPrices[i-1].price * THRESHOLDS.RAPID_INCREASE && knownPrices[i-1].price < this.buyPrice
      );
      if (hasLowToHigh) {
        score += 40;
        this.scoreReasons.large_spike.push(`✅ Detectada subida rápida desde fase baja (señal de pico grande)`);
      }

      // Bonus if we detect a Large Spike P1->P2 sequence with no prices after
      const lsSequence = detectLargeSpikeSequence(knownPrices, this.buyPrice);
      if (lsSequence.detected && !lsSequence.hasDataAfterSequence) {
        const { spikePhase1, spikePhase2 } = lsSequence;
        // If P2 is in Small Spike range (140-200%), bonus is smaller because it's ambiguous
        // The max could be Small Spike; the 200-600% may not come
        if (spikePhase2.rate >= THRESHOLDS.SMALL_SPIKE_MIN && spikePhase2.rate < THRESHOLDS.SMALL_SPIKE_MAX) {
          score += 30; // Bonus reducido - ambiguo
          this.scoreReasons.large_spike.push(`⚠️ Secuencia ${Math.round(spikePhase1.rate * 100)}% → ${Math.round(spikePhase2.rate * 100)}% es ambigua. Podría ser Large Spike (esperando 200-600%) o el pico de Small Spike.`);
        } else {
          score += 80;
          this.scoreReasons.large_spike.push(`✅ Secuencia Large Spike: ${spikePhase1.price} bayas (${Math.round(spikePhase1.rate * 100)}%) → ${spikePhase2.price} bayas (${Math.round(spikePhase2.rate * 100)}%). El pico real (200-600%) puede venir en el siguiente período.`);
        }
      }

      score += 10; // Reduced base score (less common than Small Spike)
      break;

    case PATTERNS.SMALL_SPIKE:
      // Flag to detect if the pattern has been rejected
      let smallSpikeRejected = false;

      // Bonus if there's a moderate max in the exact Small Spike range
      if (ratio >= THRESHOLDS.SMALL_SPIKE_MIN && ratio < THRESHOLDS.SMALL_SPIKE_MAX) {
        // Within the perfect Small Spike range
        if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio <= THRESHOLDS.SMALL_SPIKE_PERFECT_MAX) {
          score += 90;
          this.scoreReasons.small_spike.push(`✅ ¡Pico perfecto! ${maxPrice} bayas (${Math.round(ratio * 100)}%) en rango ideal de Small Spike (140-200%)`);
        } else {
          score += 70;
          this.scoreReasons.small_spike.push(`✅ Pico detectado ${maxPrice} bayas (${Math.round(ratio * 100)}%) en rango de Small Spike (140-200%)`);
        }
      } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PRE_PEAK && ratio < THRESHOLDS.SMALL_SPIKE_MIN) {
        score += 40;
        this.scoreReasons.small_spike.push(`⚠️ Precio ${maxPrice} bayas (${Math.round(ratio * 100)}%) podría ser pre-pico de Small Spike`);

        // Check if there was a dramatic drop after the max
        const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
        if (maxPriceIndex !== -1 && maxPriceIndex < knownPrices.length - 1) {
          const pricesAfterMax = knownPrices.slice(maxPriceIndex + 1);
          const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);

          if (hasSharpDrop) {
            smallSpikeRejected = true;
            score = 0;
            this.scoreReasons.small_spike.push(`❌ El precio máximo ${maxPrice} bayas no alcanzó 140%. Los precios subieron y bajaron sin formar un pico válido.`);
          }
        }
      } else if (ratio >= THRESHOLDS.SMALL_SPIKE_MAX) {
        smallSpikeRejected = true;
        score = 0;
        this.scoreReasons.small_spike.push(`❌ Precio ${maxPrice} bayas (${Math.round(ratio * 100)}%) excede 200% (esto es Large Spike)`);
      } else {
        // ratio < SMALL_SPIKE_PRE_PEAK (1.2)
        // Check if prices rose and fell without reaching 140% threshold (no valid spike)
        const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
        if (maxPriceIndex !== -1 && maxPriceIndex < knownPrices.length - 1) {
          const pricesAfterMax = knownPrices.slice(maxPriceIndex + 1);
          const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);

          if (hasSharpDrop) {
            smallSpikeRejected = true;
            score = 0;
            this.scoreReasons.small_spike.push(`❌ El precio máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) no alcanzó 140%. Los precios subieron y bajaron sin formar un pico válido.`);
          } else {
            this.scoreReasons.small_spike.push(`⏳ Esperando confirmación. Máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) es válido para fase inicial. Si el siguiente período se mantiene en 90-140%, sugiere Pico Pequeño`);
          }
        } else {
          this.scoreReasons.small_spike.push(`⏳ Esperando confirmación. Máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) es válido para fase inicial. Si el siguiente período se mantiene en 90-140%, sugiere Pico Pequeño`);
        }
      }

      // Only apply bonuses if the pattern was not rejected
      if (!smallSpikeRejected) {
        // Bonus if there's a low phase followed by a moderate rise
        const hasModerateIncrease = knownPrices.some((p, i) =>
          i > 0 && p.price > knownPrices[i-1].price * THRESHOLDS.MODERATE_RISE_MIN && p.price < knownPrices[i-1].price * THRESHOLDS.MODERATE_RISE_MAX
        );
        if (hasModerateIncrease) {
          score += 20;
          this.scoreReasons.small_spike.push(`✅ Detectada subida moderada (señal de pico pequeño)`);
        }

        // Penalize if the sequence also matches Large Spike P1→P2
        // BUT: if the max is already in ideal Small Spike range (140-200%), penalize less
        const lsSequence = detectLargeSpikeSequence(knownPrices, this.buyPrice);
        if (lsSequence.detected && !lsSequence.hasDataAfterSequence) {
          const { spikePhase1, spikePhase2 } = lsSequence;
          // If the max is in ideal Small Spike range, it's more likely Small Spike
          if (ratio >= THRESHOLDS.SMALL_SPIKE_MIN && ratio < THRESHOLDS.SMALL_SPIKE_MAX) {
            score -= 15; // Smaller penalty - max is already in Small Spike range
            this.scoreReasons.small_spike.push(`ℹ️ La secuencia ${Math.round(spikePhase1.rate * 100)}% → ${Math.round(spikePhase2.rate * 100)}% también podría ser Large Spike, pero el pico de ${Math.round(ratio * 100)}% es consistente con Small Spike.`);
          } else {
            score -= 50;
            this.scoreReasons.small_spike.push(`⚠️ La secuencia ${Math.round(spikePhase1.rate * 100)}% → ${Math.round(spikePhase2.rate * 100)}% también coincide con Large Spike. El pico real podría ser mayor (200-600%).`);
          }
        }

        score += 20; // Base score
      }
      break;

    case PATTERNS.FLUCTUATING:
      // EARLY DETECTION RULE:
      // If MONDAY has a high price (>100%), it's almost certainly Fluctuating
      // Large/Small Spike spikes start at period 2+ (Tuesday+)
      // Decreasing never rises above base price
      const mondayPrices = knownPrices.filter(p => p.index <= PERIODS.MONDAY_PM);
      if (mondayPrices.some(p => p.price > this.buyPrice)) {
        score += 80;
        const highMonday = mondayPrices.find(p => p.price > this.buyPrice);
        this.scoreReasons.fluctuating.push(`✅ Precio alto el Lunes (${highMonday.price} > ${this.buyPrice}). Solo Fluctuante sube temprano.`);
      }

      // Bonus if prices vary but without extremes
      if (ratio < THRESHOLDS.FLUCTUATING_MODERATE_MAX && ratio > THRESHOLDS.FLUCTUATING_MODERATE_MIN) {
        score += 50;
        this.scoreReasons.fluctuating.push(`✅ Precios en rango moderado (${Math.round(ratio * 100)}%), típico de Fluctuante (60-140%)`);
      } else if (ratio < THRESHOLDS.FLUCTUATING_MODERATE_MIN) {
        this.scoreReasons.fluctuating.push(`⚠️ Precio muy bajo (${Math.round(ratio * 100)}%), menos común en Fluctuante`);
      } else if (ratio >= THRESHOLDS.FLUCTUATING_MODERATE_MAX) {
        this.scoreReasons.fluctuating.push(`⚠️ Precio alto detectado (${Math.round(ratio * 100)}%), podría ser un pico en lugar de Fluctuante`);
      }

      // Heavily penalize sustained decreasing trends
      // The fluctuating pattern must ALTERNATE between high and low phases, not just decline
      let consecutiveDecreases = 0;
      let maxConsecutiveDecreases = 0;
      let decreasesFromStart = 0;

      // Check if declining from the start (no prior high phase)
      for (let i = 1; i < knownPrices.length; i++) {
        if (knownPrices[i].price < knownPrices[i - 1].price * THRESHOLDS.FLUCTUATING_DROP) {
          consecutiveDecreases++;
          maxConsecutiveDecreases = Math.max(maxConsecutiveDecreases, consecutiveDecreases);
          if (i === decreasesFromStart + 1) {
            decreasesFromStart++;
          }
        } else {
          consecutiveDecreases = 0;
        }
      }

      // If we reach here, the pattern was NOT rejected
      // Penalties are now only for edge cases
      if (maxConsecutiveDecreases === 3) {
        score -= 20;
        this.scoreReasons.fluctuating.push(`⚠️ 3 períodos bajando consecutivos (límite máximo de una fase baja en Fluctuante)`);
      } else if (maxConsecutiveDecreases === 2) {
        score -= 10;
        this.scoreReasons.fluctuating.push(`⚠️ 2 períodos bajando consecutivos (posible fase baja en Fluctuante)`);
      } else if (maxConsecutiveDecreases === 1 || knownPrices.length === 1) {
        // Only 1 decrease or insufficient data
        this.scoreReasons.fluctuating.push(`ℹ️ Sin suficientes datos para confirmar alternancia de fases`);
      }

      score += 30; // Base score (most common pattern)
      break;
    }

    return score;
  }

  predict() {
    const patternResult = this.detectPattern();
    const pattern = patternResult.primary;
    const predictions = {};

    DAYS_CONFIG.forEach((day, index) => {
      const price = this.knownPrices[day.key];
      if (price !== undefined && price !== null && price !== '') {
        predictions[day.key] = {
          min: parseInt(price),
          max: parseInt(price),
          isUserInput: true
        };
      } else {
        const estimate = this.predictPrice(pattern, index);
        predictions[day.key] = {
          min: estimate.min,
          max: estimate.max,
          isUserInput: false
        };
      }
    });

    // Ensure we have probabilities for all 4 patterns
    const allProbabilities = {
      fluctuating: patternResult.percentages['fluctuating'] || 0,
      large_spike: patternResult.percentages['large_spike'] || 0,
      decreasing: patternResult.percentages['decreasing'] || 0,
      small_spike: patternResult.percentages['small_spike'] || 0
    };

    return {
      pattern: pattern,
      patternName: PATTERN_NAMES[pattern],
      primaryPercentage: patternResult.percentages[pattern],
      allProbabilities: allProbabilities,
      alternatives: patternResult.alternatives.map(alt => ({
        pattern: alt.pattern,
        name: PATTERN_NAMES[alt.pattern],
        percentage: alt.percentage
      })),
      predictions: predictions,
      recommendations: this.getRecommendations(pattern),
      bestSellDay: this.getBestSellDay(predictions, pattern),
      rejectionReasons: this.rejectionReasons,
      scoreReasons: this.scoreReasons
    };
  }

  predictPrice(pattern, periodIndex) {
    const base = this.buyPrice;
    const knownPricesArray = this.getPriceArrayWithIndex();

    switch (pattern) {
    case PATTERNS.DECREASING:
      return calculateDecreasingPattern(periodIndex, base, knownPricesArray);

    case PATTERNS.LARGE_SPIKE:
      return calculateLargeSpikePattern(periodIndex, base, knownPricesArray);

    case PATTERNS.SMALL_SPIKE:
      return calculateSmallSpikePattern(periodIndex, base, knownPricesArray);

    case PATTERNS.FLUCTUATING:
    default:
      return calculateFluctuatingPattern(periodIndex, base, knownPricesArray);
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
      rec.push('🎲 Precios variables durante la semana');
      rec.push('✅ Vende cuando supere tu precio de compra');
      rec.push('⚖️ Patrón impredecible, mantente atento');
      break;
    }

    return rec;
  }

  getBestSellDay(predictions, pattern) {
    if (pattern === PATTERNS.FLUCTUATING) {
      return { message: 'No hay momento óptimo predecible en patrón aleatorio' };
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
}
