import {
  BUY_PRICE_MAX,  BUY_PRICE_MIN, CONFIDENCE, DAYS_CONFIG, DEFAULT_PROBABILITIES, PATTERNS, 
  PATTERN_NAMES, PERIODS, RATES, THRESHOLDS, TRANSITION_PROBABILITIES, TURNIP_PRICE_MAX, 
  TURNIP_PRICE_MIN
} from "./constants.js";
import {
  decreasingMaxForPeriod, decreasingMin, detectLargeSpikeSequence, detectSpikeStart, getPeriodName,
  getSpikeStartRange, isValidRateDrop, largeSpikeStartRange, priceRatio
} from "./patterns/utils.js";

import calculateDecreasingPattern from "./patterns/decreasing.js";
import calculateFluctuatingPattern from "./patterns/fluctuating.js";
import calculateLargeSpikePattern from './patterns/large-spike.js';
import calculateSmallSpikePattern from "./patterns/small-spike.js";

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
      // No data, all patterns are possible
      return Object.values(PATTERNS);
    }

    const possiblePatterns = [];

    // Check each pattern
    if (this.isPossibleDecreasing(knownPrices)) {
      possiblePatterns.push(PATTERNS.DECREASING);
    }
    if (this.isPossibleLargeSpike(knownPrices)) {
      possiblePatterns.push(PATTERNS.LARGE_SPIKE);
    }
    if (this.isPossibleSmallSpike(knownPrices)) {
      possiblePatterns.push(PATTERNS.SMALL_SPIKE);
    }
    if (this.isPossibleFluctuating(knownPrices)) {
      possiblePatterns.push(PATTERNS.FLUCTUATING);
    }

    // If no pattern matches, return fluctuating as fallback
    return possiblePatterns.length > 0 ? possiblePatterns : [PATTERNS.FLUCTUATING];
  }

  // Helper: Validates slope in pre-spike phase for both spike types
  // Returns { invalid: boolean, reason?: string }
  validatePreSpikeSlope(knownPrices, isLargeSpike) {
    const patternName = isLargeSpike ? 'Large Spike' : 'Small Spike';
    const minSpikeStart = isLargeSpike ? PERIODS.LARGE_SPIKE_START_MIN : PERIODS.SMALL_SPIKE_START_MIN;

    const spikeThreshold = this.buyPrice * RATES.LARGE_SPIKE.START_MAX;
    let spikeStarted = false;
    let previous = knownPrices[0];

    for (const current of knownPrices.slice(1)) {
      // Only validate if periods are consecutive
      if (current.index !== previous.index + 1) {
        spikeStarted = spikeStarted || previous.price >= spikeThreshold;
        previous = current;
        continue;
      }

      const ratio = priceRatio(current.price, previous.price);

      // Only validate rate drop in PRE-SPIKE phase
      if (!spikeStarted) {
        const rateValidation = isValidRateDrop(previous.price, current.price, this.buyPrice);

        if (!rateValidation.valid) {
          const prevPercent = ((previous.price / this.buyPrice) * 100).toFixed(1);
          const currPercent = ((current.price / this.buyPrice) * 100).toFixed(1);
          const dropPoints = (rateValidation.rateDrop * 100).toFixed(1);
          return {
            invalid: true,
            reason: `Precio cayó de ${previous.price} bayas (${prevPercent}%) a ${current.price} bayas (${currPercent}%), <strong>caída de ${dropPoints}%</strong>. ${patternName} solo puede bajar máximo 5% por período en fase pre-pico.`
          };
        }
      }

      // If it rises too early
      if (current.index < minSpikeStart && ratio > THRESHOLDS.SIGNIFICANT_RISE) {
        const risePercent = Math.round((ratio - 1) * 100);
        const spikeRange = getSpikeStartRange(isLargeSpike);
        return {
          invalid: true,
          reason: `Subió ${risePercent}% antes del período ${minSpikeStart}. ${patternName} no puede subir temprano. El pico solo puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`
        };
      }

      spikeStarted = spikeStarted || previous.price >= spikeThreshold;
      previous = current;
    }

    return { invalid: false };
  }

  // Helper: Checks if it's too late for a spike (no significant rises)
  isTooLateForSpike(knownPrices, spikeType) {
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // If we've reached Thursday PM or later, check for any significant rise
    if (maxKnownIndex >= PERIODS.THURSDAY_PM) {
      const hasSignificantRise = knownPrices.some((current, i) => {
        if (i === 0) return false;
        const previous = knownPrices[i - 1];
        return current.price > previous.price * THRESHOLDS.SIGNIFICANT_RISE;
      });

      if (!hasSignificantRise) {
        return {
          tooLate: true,
          reason: `Llegamos a ${getPeriodName(maxKnownIndex)} sin ninguna subida. ${spikeType} necesita empezar antes de Viernes AM (período 8) para que quepan los 5 períodos de pico.`
        };
      }
    }

    return { tooLate: false };
  }

  // Detects spike phase 2 to differentiate Large vs Small Spike
  // Spike phase 2 Large Spike: 140-200% | Spike phase 2 Small Spike: 90-140%
  detectSpikeConfirmation(knownPrices) {
    if (knownPrices.length < 2) return { detected: false };

    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const hasLargeSpikeConfirmed = (maxPrice / this.buyPrice) >= THRESHOLDS.LARGE_SPIKE_CONFIRMED;

    // Use helper to detect Large Spike P1->P2 sequence
    const sequence = detectLargeSpikeSequence(knownPrices, this.buyPrice);

    if (sequence.detected) {
      const { spikePhase2, hasDataAfterSequence } = sequence;
      const percent = (spikePhase2.rate * 100).toFixed(1);

      // Determine isLargeSpike based on context
      let isLargeSpike;
      if (hasLargeSpikeConfirmed) {
        isLargeSpike = true; // Max >200% confirms Large Spike
      } else if (!hasDataAfterSequence) {
        isLargeSpike = null; // Indeterminate - max may still come
      } else {
        isLargeSpike = false; // Prices after sequence never reached 200%
      }

      return {
        detected: true,
        isLargeSpike,
        price: spikePhase2.price,
        percent,
        day: getPeriodName(spikePhase2.index)
      };
    }

    // Indirect method: Detect spike start and verify Period 2
    const spikeDetection = detectSpikeStart(knownPrices, this.buyPrice);
    if (!spikeDetection.detected) return { detected: false };

    const spikeStartPrice = knownPrices[spikeDetection.startIndex];
    const spikeStartIndex = spikeStartPrice.index;
    const confirmationData = knownPrices.find(p => p.index === spikeStartIndex + 1);
    if (!confirmationData) return { detected: false };

    // CRITICAL: Only consider as spike sequence if the price RISES
    // If the price drops (e.g. 129 -> 107), it's not the real spike start
    if (confirmationData.price <= spikeStartPrice.price) {
      return { detected: false };
    }

    const confirmationRate = confirmationData.price / this.buyPrice;

    return {
      detected: true,
      isLargeSpike: confirmationRate >= THRESHOLDS.SMALL_SPIKE_MIN,
      price: confirmationData.price,
      percent: (confirmationRate * 100).toFixed(1),
      day: getPeriodName(spikeStartIndex + 1)
    };
  }

  // Check if the DECREASING pattern is possible
  isPossibleDecreasing(knownPrices) {
    // In the decreasing pattern, each price must be <= the previous
    // and all must be between 85% and 40% of the base price
    return knownPrices.every((current, i) => {
      const { price, index } = current;
      const expectedMax = decreasingMaxForPeriod(this.buyPrice, index);
      const expectedMin = decreasingMin(this.buyPrice);

      // Price must be within the decreasing pattern range
      if (price > expectedMax || price < expectedMin) {
        return false;
      }

      // Verify there are no increases (Decreasing only goes down)
      if (i > 0 && price > knownPrices[i - 1].price) {
        return false;
      }

      return true;
    });
  }

  // Check if the LARGE SPIKE pattern is possible
  // Validation priority: single-price -> simple aggregates -> complex analysis
  isPossibleLargeSpike(knownPrices) {
    if (knownPrices.length === 0) return true;

    // 1. SINGLE-PRICE: Monday AM (period 0) must be between 85-90% of base price
    const mondayAM = knownPrices.find(p => p.index === PERIODS.MONDAY_AM);
    if (mondayAM) {
      const startRange = largeSpikeStartRange(this.buyPrice);
      const mondayRatio = priceRatio(mondayAM.price, this.buyPrice);
      if (mondayAM.price < startRange.min) {
        this.rejectionReasons.large_spike.push(`Lunes AM (${mondayAM.price}) está muy bajo (${Math.round(mondayRatio * 100)}%). Large Spike debe empezar entre 85-90%.`);
        return false;
      }
      if (mondayAM.price > startRange.max) {
        this.rejectionReasons.large_spike.push(`Lunes AM (${mondayAM.price}) está muy alto (${Math.round(mondayRatio * 100)}%). Large Spike debe empezar entre 85-90%.`);
        return false;
      }
    }

    // 2. SIMPLE AGGREGATES: Precompute values used by multiple validations
    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const maxRatio = priceRatio(maxPrice, this.buyPrice);
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // If a very high price is found (200%+), it's definitely a large spike
    if (maxRatio >= THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
      return true;
    }

    // 3. TIMING: If too late without a rise, reject
    const lateCheck = this.isTooLateForSpike(knownPrices, 'Large Spike');
    if (lateCheck.tooLate) {
      this.rejectionReasons.large_spike.push(lateCheck.reason);
      return false;
    }

    // If very late (Saturday PM) and max was low, reject
    if (maxKnownIndex >= PERIODS.LAST_PERIOD && maxRatio < THRESHOLDS.SMALL_SPIKE_MIN) {
      const spikeRange = getSpikeStartRange(true);
      this.rejectionReasons.large_spike.push(`Es Sábado PM y el precio máximo fue solo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%). Large Spike necesita un pico de 200-600%. El pico puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
      return false;
    }

    // 4. SLOPE: Validate slope in pre-spike phase
    const slopeCheck = this.validatePreSpikeSlope(knownPrices, true);
    if (slopeCheck.invalid) {
      this.rejectionReasons.large_spike.push(slopeCheck.reason);
      return false;
    }

    // If the max is low (<140%) and there's a sharp drop after, reject
    if (maxRatio < THRESHOLDS.SMALL_SPIKE_MIN) {
      const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
      if (maxPriceIndex !== -1 && maxPriceIndex < knownPrices.length - 1) {
        const pricesAfterMax = knownPrices.slice(maxPriceIndex + 1);
        const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);
        if (hasSharpDrop) {
          this.rejectionReasons.large_spike.push(`El precio máximo fue ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) y luego cayó más de 40%. El pico ya pasó y fue muy bajo para Large Spike.`);
          return false;
        }
      }
    }

    // 5. COMPLEX: P1->P2 spike sequence analysis
    const confirmation = this.detectSpikeConfirmation(knownPrices);
    if (confirmation.detected) {
      if (confirmation.isLargeSpike === false) {
        this.rejectionReasons.large_spike.push(`${confirmation.day} tiene ${confirmation.price} bayas (${confirmation.percent}%). Large Spike necesita ≥140% en el Período 2 seguido de ≥200% en Período 3.`);
        return false;
      }
    }

    // Max in Small Spike range (140-200%) + late in the week -> probably not Large Spike
    if (maxRatio >= THRESHOLDS.SMALL_SPIKE_MIN && maxRatio < THRESHOLDS.SMALL_SPIKE_MAX && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
      if (!confirmation.detected || !confirmation.isLargeSpike) {
        const hasRapidIncrease = knownPrices.some((current, i) => {
          if (i === 0) return false;
          const previous = knownPrices[i - 1];
          return current.price > previous.price * THRESHOLDS.RAPID_INCREASE;
        });

        if (!hasRapidIncrease) {
          const spikeRange = getSpikeStartRange(true);
          this.rejectionReasons.large_spike.push(`Pico máximo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) está en rango de Small Spike (140-200%). Ya es tarde en la semana sin señales de Large Spike. Large Spike puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
          return false;
        }
      }
    }

    // Otherwise, keep as possible (spike may still come)
    return true;
  }

  // Check if the SMALL SPIKE pattern is possible
  // Validation priority: single-price -> simple aggregates -> complex analysis
  isPossibleSmallSpike(knownPrices) {
    if (knownPrices.length === 0) return true;

    // 1. SINGLE-PRICE: Monday AM (period 0) is always in pre-spike phase (40-90%)
    const mondayAM = knownPrices.find(p => p.index === PERIODS.MONDAY_AM);
    if (mondayAM) {
      const mondayRatio = priceRatio(mondayAM.price, this.buyPrice);
      if (mondayRatio > RATES.SMALL_SPIKE.START_MAX) {
        this.rejectionReasons.small_spike.push(`Lunes AM (${mondayAM.price}) está a ${Math.round(mondayRatio * 100)}% del precio base. Small Spike requiere que el período 0 esté en fase pre-pico (40-90%).`);
        return false;
      }
    }

    // 2. SIMPLE AGGREGATES: Precompute values used by multiple validations
    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const maxRatio = priceRatio(maxPrice, this.buyPrice);
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // If a very high price is found (> 200%), it can't be a small spike
    if (maxRatio > THRESHOLDS.SMALL_SPIKE_MAX) {
      this.rejectionReasons.small_spike.push(`Precio máximo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) excede 200%. Esto es Large Spike, no Small Spike.`);
      return false;
    }

    // 3. TIMING: If too late without a rise, reject
    const lateCheck = this.isTooLateForSpike(knownPrices, 'Small Spike');
    if (lateCheck.tooLate) {
      this.rejectionReasons.small_spike.push(lateCheck.reason);
      return false;
    }

    // If very late in the week (Saturday PM) and there was no significant spike
    if (maxKnownIndex >= PERIODS.LAST_PERIOD) {
      if (maxRatio < RATES.LARGE_SPIKE.START_MAX) {
        const spikeRange = getSpikeStartRange(false);
        this.rejectionReasons.small_spike.push(`Es Sábado PM y el precio máximo fue solo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%). Small Spike necesita un pico de 140-200%. El pico puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
        return false;
      }
    }

    // If max is in the perfect Small Spike range (140-200%)
    // and we're at Friday or later -> strong confirmation
    if (maxRatio >= THRESHOLDS.SMALL_SPIKE_MIN && maxRatio < THRESHOLDS.SMALL_SPIKE_MAX && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
      return true;
    }

    // 4. SLOPE: Validate slope in pre-spike phase
    const slopeCheck = this.validatePreSpikeSlope(knownPrices, false);
    if (slopeCheck.invalid) {
      this.rejectionReasons.small_spike.push(slopeCheck.reason);
      return false;
    }

    // If max didn't reach 140% and already dropped significantly -> invalid spike
    if (maxRatio < THRESHOLDS.SMALL_SPIKE_MIN && knownPrices.length >= 3) {
      const maxPriceData = knownPrices.find(p => p.price === maxPrice);
      if (maxPriceData) {
        const pricesAfterMax = knownPrices.filter(p => p.index > maxPriceData.index);
        const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);

        if (hasSharpDrop) {
          this.rejectionReasons.small_spike.push(`El precio máximo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) no alcanzó el 140% requerido para Small Spike. Los precios subieron y bajaron sin formar un pico válido.`);
          return false;
        }
      }
    }

    // 5. COMPLEX: P1->P2 spike sequence analysis
    const confirmation = this.detectSpikeConfirmation(knownPrices);
    if (confirmation.detected) {
      const confirmationRate = parseFloat(confirmation.percent) / 100;

      // P2 at 140%+ is IMPOSSIBLE for Small Spike
      // Small Spike: P1 (90-140%) → P2 (90-140%) → P3-4 (140-200% peak)
      // Large Spike: P1 (90-140%) → P2 (140-200%) → P3 (200-600% peak)
      if (confirmationRate >= THRESHOLDS.SMALL_SPIKE_MIN) {
        const spikeStatus = confirmation.isLargeSpike === true
          ? 'ya confirmado con pico >200%'
          : 'esperando el pico real de 200-600% en el siguiente período';
        this.rejectionReasons.small_spike.push(
          `${confirmation.day} tiene ${confirmation.price} bayas (${confirmation.percent}%). ` +
          `El Período 2 del pico está en rango 140-200%, lo cual es IMPOSIBLE para Small Spike ` +
          `(Small Spike debe tener Período 2 en 90-140%). Esto confirma Large Spike (${spikeStatus}).`
        );
        return false;
      }
    }

    // 6. PATTERN ANALYSIS: Detect multiple rise-fall cycles (-> Fluctuating, not Spike)
    if (knownPrices.length >= 4) {
      for (let i = 1; i < knownPrices.length - 1; i++) {
        const prev = knownPrices[i - 1];
        const curr = knownPrices[i];
        const next = knownPrices[i + 1];

        if (curr.price > prev.price && curr.price > next.price) {
          const localMaxRatio = curr.price / this.buyPrice;

          if (localMaxRatio >= 1.0) {
            const pricesAfterLocalMax = knownPrices.filter(p => p.index > curr.index);
            const minAfterLocalMax = Math.min(...pricesAfterLocalMax.map(p => p.price));
            const dropFromLocalMax = minAfterLocalMax / curr.price;

            if (dropFromLocalMax < 0.50) {
              const minPriceData = pricesAfterLocalMax.find(p => p.price === minAfterLocalMax);
              if (minPriceData) {
                const pricesAfterMin = knownPrices.filter(p => p.index > minPriceData.index);
                const hasRisenAgain = pricesAfterMin.some(p => p.price > minAfterLocalMax * 1.5);

                if (hasRisenAgain) {
                  this.rejectionReasons.small_spike.push(`Detectado patrón de múltiples subidas y bajadas: pico en ${curr.price} bayas (${Math.round(localMaxRatio * 100)}%), cayó a ${minAfterLocalMax} bayas, y subió de nuevo. Esto es Fluctuante, no Small Spike.`);
                  return false;
                }
              }
            }
          }
        }
      }
    }

    // Otherwise, keep as possible
    return true;
  }

  // Check if the FLUCTUATING pattern is possible
  isPossibleFluctuating(knownPrices) {
    // The fluctuating pattern allows prices between 60% and 140% of base
    const inRange = knownPrices.every(({ price }) => {
      const ratio = priceRatio(price, this.buyPrice);
      // If there are very high or very low prices, probably not fluctuating
      return ratio >= RATES.FLUCTUATING.MIN && ratio <= RATES.FLUCTUATING.MAX;
    });

    if (!inRange) {
      this.rejectionReasons.fluctuating.push(`Precio fuera del rango de Fluctuante (60-140%)`);
      return false;
    }

    return true;
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
