import {
  BUY_PRICE_MAX,  BUY_PRICE_MIN, CONFIDENCE, DAYS_CONFIG, DEFAULT_PROBABILITIES, PATTERNS,
  PATTERN_NAMES, PERIODS, RATES, THRESHOLDS, TRANSITION_PROBABILITIES, TURNIP_PRICE_MAX,
  TURNIP_PRICE_MIN
} from "./constants.js";
import { calculateDecreasingPattern, reasonsToRejectDecreasing } from "./patterns/decreasing.js";
import { calculateFluctuatingPattern, reasonsToRejectFluctuating } from "./patterns/fluctuating.js";
import { calculateLargeSpikePattern, reasonsToRejectLargeSpike } from './patterns/large-spike.js';
import { calculateSmallSpikePattern, reasonsToRejectSmallSpike } from "./patterns/small-spike.js";
import { detectLargeSpikeSequence } from "./patterns/utils.js";

// Turnip Price Predictor - Animal Crossing New Horizons
// Based on the actual in-game patterns
export default class TurnipPatternPredictor {
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
    this.knownPrices = TurnipPatternPredictor.validatePrices(knownPrices);
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

  // Get base probabilities based on previous pattern
  getBaseProbabilities() {
    return this.previousPattern
      ? this.transitionProbabilities[this.previousPattern]
      : this.defaultProbabilities;
  }

  // Detect the most likely pattern with confidence info
  scorePossiblePatterns(knownPricesWithIndex) {
    const possiblePatterns = this.detectPossiblePatterns(knownPricesWithIndex);
    const baseProbabilities = this.getBaseProbabilities();

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
        const dataScore = this.calculatePatternScore(pattern, knownPricesWithIndex);
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

  // Calculate how well the data fits a pattern
  calculatePatternScore(pattern, knownPrices) {
    let score = 0;
    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const avgPrice = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
    const ratio = maxPrice / this.buyPrice;

    switch (pattern) {
    case PATTERNS.DECREASING:
      // reasonsToRejectDecreasing already gates this — any increasing price rejects the pattern.
      // If we reach here, all prices are confirmed non-increasing.
      score = 100;
      this.scoreReasons.decreasing.push(`✅ Todos los precios bajan consecutivamente (patrón perfecto de Decreciente)`);

      // Bonus if average is below 80% of buy price — confirms a strong overall decline.
      // At 3-5% drop per period, reaching a low average is a reliable Decreasing signal.
      if (avgPrice < this.buyPrice * THRESHOLDS.DECREASING_LOW_AVG) {
        score += 30;
        this.scoreReasons.decreasing.push(`✅ Promedio bajo (${Math.round(avgPrice)} < ${Math.round(THRESHOLDS.DECREASING_LOW_AVG * 100)}% del base)`);
      }
      break;

    case PATTERNS.LARGE_SPIKE:
      // Bonus if there's a very high max (200%+)
      if (ratio >= RATES.LARGE_SPIKE.PEAK_RATE_MIN) {
        score += 100;
        this.scoreReasons.large_spike.push(`✅ ¡Pico enorme detectado! ${maxPrice} bayas (${Math.round(ratio * 100)}%) confirma Large Spike`);
      } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio < RATES.LARGE_SPIKE.PEAK_RATE_MIN) {
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
        if (spikePhase2.rate >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && spikePhase2.rate < RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
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
      if (ratio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && ratio < RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
        // Within the Small Spike peak range (140-200%).
        // The "ideal" sub-range (150-190%) is less ambiguous with Large Spike and scores highest.
        if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio <= THRESHOLDS.SMALL_SPIKE_PERFECT_MAX) {
          score += 90;
          this.scoreReasons.small_spike.push(`✅ ¡Pico perfecto! ${maxPrice} bayas (${Math.round(ratio * 100)}%) en rango ideal de Small Spike (140-200%)`);
        } else {
          score += 70;
          this.scoreReasons.small_spike.push(`✅ Pico detectado ${maxPrice} bayas (${Math.round(ratio * 100)}%) en rango de Small Spike (140-200%)`);
        }
      } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PRE_PEAK && ratio < RATES.SMALL_SPIKE.PEAK_RATE_MIN) {
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
      } else if (ratio >= RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
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
          if (ratio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && ratio < RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
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
      // A price above the buy price on Monday is a near-certain Fluctuating signal.
      // Large/Small Spike phases start at Tuesday AM (period 2) at the earliest.
      // Decreasing never exceeds the buy price.
      // The +80 score is sufficient — other patterns score much lower in this scenario.
      const mondayPrices = knownPrices.filter(p => p.index <= PERIODS.MONDAY_PM);
      if (mondayPrices.some(p => p.price > this.buyPrice)) {
        score += 80;
        const highMonday = mondayPrices.find(p => p.price > this.buyPrice);
        this.scoreReasons.fluctuating.push(`✅ Precio alto el Lunes (${highMonday.price} > ${this.buyPrice}). Solo Fluctuante sube temprano.`);
      }

      // Bonus if max price is within the normal Fluctuating range (60-140%)
      if (ratio < RATES.FLUCTUATING.MAX && ratio > RATES.FLUCTUATING.MIN) {
        score += 50;
        this.scoreReasons.fluctuating.push(`✅ Precios en rango moderado (${Math.round(ratio * 100)}%), típico de Fluctuante (60-140%)`);
      } else if (ratio < RATES.FLUCTUATING.MIN) {
        this.scoreReasons.fluctuating.push(`⚠️ Precio muy bajo (${Math.round(ratio * 100)}%), menos común en Fluctuante`);
      } else if (ratio >= RATES.FLUCTUATING.MAX) {
        this.scoreReasons.fluctuating.push(`⚠️ Precio alto detectado (${Math.round(ratio * 100)}%), podría ser un pico en lugar de Fluctuante`);
      }

      score += 30; // Base score (most common pattern)
      break;
    }

    return score;
  }

  predict() {
    const knownPricesWithIndex = this.getPriceArrayWithIndex();
    const patternResult = this.scorePossiblePatterns(knownPricesWithIndex);
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
        const estimate = this.predictPrice(pattern, index, knownPricesWithIndex);
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
