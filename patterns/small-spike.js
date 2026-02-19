import { PERIODS, RATES, THRESHOLDS } from "../constants.js";
import {
  calculateDecreasingPhaseRange, detectSpikeConfirmation, detectSpikePhaseStart,
  getSpikeStartRange, isTooLateForSpike,
  priceCeil, priceFloor, priceRatio, validatePreSpikeSlope
} from "./utils.js";

// SMALL SPIKE pattern: similar to large but with a lower max (140-200%)
// Based on the actual datamined game algorithm (Pattern 3)
// Uses constants from constants.js (RATES, DECAY, VARIANCE, PERIODS)

/**
 * Calculates the price range for the Small Spike pattern
 * @param {number} periodIndex - Period index (0-11)
 * @param {number} base - Base buy price
 * @param {Array} knownPrices - Array of known prices with {index, price}
 * @returns {{min: number, max: number}} - Price range
 */
/**
 * Checks whether the Small Spike pattern is consistent with the known prices.
 * Returns { possible: boolean, reasons: string[] }
 */
export function isPossibleSmallSpike(knownPrices, buyPrice) {
  if (knownPrices.length === 0) return { possible: true, reasons: [] };

  const reasons = [];

  // 1. SINGLE-PRICE: Monday AM must be in pre-spike range (40-90%)
  const mondayAM = knownPrices.find(p => p.index === PERIODS.MONDAY_AM);
  if (mondayAM) {
    const mondayRatio = priceRatio(mondayAM.price, buyPrice);
    if (mondayRatio > RATES.SMALL_SPIKE.START_MAX) {
      reasons.push(`Lunes AM (${mondayAM.price}) está a ${Math.round(mondayRatio * 100)}% del precio base. Small Spike requiere que el período 0 esté en fase pre-pico (40-90%).`);
      return { possible: false, reasons };
    }
  }

  // 2. SIMPLE AGGREGATES
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxRatio = priceRatio(maxPrice, buyPrice);
  const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

  if (maxRatio > THRESHOLDS.SMALL_SPIKE_MAX) {
    reasons.push(`Precio máximo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) excede 200%. Esto es Large Spike, no Small Spike.`);
    return { possible: false, reasons };
  }

  // 3. TIMING
  const lateCheck = isTooLateForSpike(knownPrices, 'Small Spike');
  if (lateCheck.tooLate) {
    reasons.push(lateCheck.reason);
    return { possible: false, reasons };
  }

  if (maxKnownIndex >= PERIODS.LAST_PERIOD && maxRatio < RATES.LARGE_SPIKE.START_MAX) {
    const spikeRange = getSpikeStartRange(false);
    reasons.push(`Es Sábado PM y el precio máximo fue solo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%). Small Spike necesita un pico de 140-200%. El pico puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
    return { possible: false, reasons };
  }

  if (maxRatio >= THRESHOLDS.SMALL_SPIKE_MIN && maxRatio < THRESHOLDS.SMALL_SPIKE_MAX && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
    return { possible: true, reasons: [] };
  }

  // 4. SLOPE
  const slopeCheck = validatePreSpikeSlope(knownPrices, false, buyPrice);
  if (slopeCheck.invalid) {
    reasons.push(slopeCheck.reason);
    return { possible: false, reasons };
  }

  if (maxRatio < THRESHOLDS.SMALL_SPIKE_MIN && knownPrices.length >= 3) {
    const maxPriceData = knownPrices.find(p => p.price === maxPrice);
    if (maxPriceData) {
      const hasSharpDrop = knownPrices.filter(p => p.index > maxPriceData.index).some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);
      if (hasSharpDrop) {
        reasons.push(`El precio máximo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) no alcanzó el 140% requerido para Small Spike. Los precios subieron y bajaron sin formar un pico válido.`);
        return { possible: false, reasons };
      }
    }
  }

  // 5. COMPLEX: P1→P2 sequence
  const confirmation = detectSpikeConfirmation(knownPrices, buyPrice);
  if (confirmation.detected) {
    const confirmationRate = parseFloat(confirmation.percent) / 100;
    if (confirmationRate >= THRESHOLDS.SMALL_SPIKE_MIN) {
      const spikeStatus = confirmation.isLargeSpike === true
        ? 'ya confirmado con pico >200%'
        : 'esperando el pico real de 200-600% en el siguiente período';
      reasons.push(
        `${confirmation.day} tiene ${confirmation.price} bayas (${confirmation.percent}%). ` +
        `El Período 2 del pico está en rango 140-200%, lo cual es IMPOSIBLE para Small Spike ` +
        `(Small Spike debe tener Período 2 en 90-140%). Esto confirma Large Spike (${spikeStatus}).`
      );
      return { possible: false, reasons };
    }
  }

  // 6. PATTERN ANALYSIS: Multiple rise-fall cycles → Fluctuating, not Spike
  if (knownPrices.length >= 4) {
    for (let i = 1; i < knownPrices.length - 1; i++) {
      const prev = knownPrices[i - 1];
      const curr = knownPrices[i];
      const next = knownPrices[i + 1];

      if (curr.price > prev.price && curr.price > next.price) {
        const localMaxRatio = curr.price / buyPrice;

        if (localMaxRatio >= 1.0) {
          const pricesAfterLocalMax = knownPrices.filter(p => p.index > curr.index);
          const minAfterLocalMax = Math.min(...pricesAfterLocalMax.map(p => p.price));
          const dropFromLocalMax = minAfterLocalMax / curr.price;

          if (dropFromLocalMax < 0.50) {
            const minPriceData = pricesAfterLocalMax.find(p => p.price === minAfterLocalMax);
            if (minPriceData) {
              const hasRisenAgain = knownPrices.filter(p => p.index > minPriceData.index).some(p => p.price > minAfterLocalMax * 1.5);
              if (hasRisenAgain) {
                reasons.push(`Detectado patrón de múltiples subidas y bajadas: pico en ${curr.price} bayas (${Math.round(localMaxRatio * 100)}%), cayó a ${minAfterLocalMax} bayas, y subió de nuevo. Esto es Fluctuante, no Small Spike.`);
                return { possible: false, reasons };
              }
            }
          }
        }
      }
    }
  }

  return { possible: true, reasons: [] };
}

export function calculateSmallSpikePattern(periodIndex, base, knownPrices = []) {
  // spikeStart can be 1-7 per the game algorithm (Monday PM to Thursday PM)
  const spikeStart = detectSpikePhaseStart(knownPrices, PERIODS.SMALL_SPIKE_START_MIN, PERIODS.SPIKE_START_MAX, false, base);

  // Phase 1: DECREASING (periods 0 through spikeStart-1)
  // Starts at 40-90%, drops 3-5% each period
  if (periodIndex < spikeStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < spikeStart);
    return calculateDecreasingPhaseRange(
      periodIndex, base, decreasingPhase, periodIndex,
      RATES.SMALL_SPIKE.START_MIN, RATES.SMALL_SPIKE.START_MAX, false
    );
  }

  // Phase 2: SPIKE (5 consecutive periods from spikeStart)
  const spikePhaseIndex = periodIndex - spikeStart;

  if (spikePhaseIndex >= 0 && spikePhaseIndex < 5) {
    // Actual game algorithm (Pattern 3):
    // The game picks a random "rate" between 1.4-2.0
    // Spike phase 0: 0.9-1.4
    // Spike phase 1: 0.9-1.4
    // Spike phase 2: (1.4 to rate) - 1 bell
    // Spike phase 3: rate (TRUE MAX)
    // Spike phase 4: (1.4 to rate) - 1 bell

    // Get known prices for specific spike periods
    const spikePhase3Price = knownPrices.find(p => p.index === spikeStart + 2);
    const spikePhase4Price = knownPrices.find(p => p.index === spikeStart + 3);
    const spikePhase5Price = knownPrices.find(p => p.index === spikeStart + 4);

    // Infer the rate ONLY when we have precise data
    // Spike phase 3 defines the exact rate
    // Spike phases 2 and 4 give a hint of the rate (they are rate - 1)
    let inferredRate = null;

    if (spikePhase4Price) {
      // If we saw spike phase 3, we know the exact rate
      inferredRate = spikePhase4Price.price / base;
    } else if (spikePhase3Price || spikePhase5Price) {
      // If we saw spike phase 2 or 4, we can infer the rate with good precision
      // Spike phase 2/4 = (1.4 to rate) - 1, so rate >= (price + 1) / base
      const knownPeriod = spikePhase3Price || spikePhase5Price;
      inferredRate = (knownPeriod.price + 1) / base;
      // Clamp to valid range (1.4-2.0)
      inferredRate = Math.max(RATES.SMALL_SPIKE.PEAK_RATE_MIN, Math.min(RATES.SMALL_SPIKE.PEAK_RATE_MAX, inferredRate));
    }
    // If we only have spike phases 0 and/or 1, do NOT infer the rate (not enough info)

    // Ranges per the exact game algorithm
    if (spikePhaseIndex === 0 || spikePhaseIndex === 1) {
      // Spike phases 0 and 1: 0.9-1.4
      return {
        min: priceFloor(base, RATES.SMALL_SPIKE.SPIKE_PHASE_INITIAL_MIN),
        max: priceCeil(base, RATES.SMALL_SPIKE.SPIKE_PHASE_INITIAL_MAX)
      };
    } else if (spikePhaseIndex === 3) {
      // Spike phase 3: TRUE MAX (rate * base) - no variance, it is the exact rate

      // If we already saw spike phase 3, use that exact value
      if (spikePhase4Price) {
        return {
          min: spikePhase4Price.price,
          max: spikePhase4Price.price
        };
      }

      // If we saw spike phase 2, we know spike phase 3 >= spike phase 2 + 1
      if (spikePhase3Price) {
        return {
          min: spikePhase3Price.price + 1,
          max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_RATE_MAX)
        };
      }

      // If we saw spike phase 4, we can infer the rate and show the exact value
      if (spikePhase5Price && inferredRate) {
        const exactPrice = Math.round(base * inferredRate);
        return {
          min: exactPrice,
          max: exactPrice
        };
      }

      // Not enough data: full theoretical range
      return {
        min: priceFloor(base, RATES.SMALL_SPIKE.PEAK_RATE_MIN),
        max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_RATE_MAX)
      };
    } else {
      // Spike phases 2 and 4: (1.4 to rate) * base - 1 bell

      // If we have the inferred rate (from spike phase 3), use it to narrow the range
      if (inferredRate && spikePhase4Price) {
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.ceil(base * inferredRate - 1)
        };
      }

      // If we saw the other spike phase (2 or 4), use that price as reference
      if (spikePhaseIndex === 2 && spikePhase5Price) {
        // Calculating spike phase 2, but we already saw spike phase 4
        // Both use the same formula, so they can be similar
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.max(spikePhase5Price.price, Math.ceil(base * inferredRate - 1))
        };
      }

      if (spikePhaseIndex === 4 && spikePhase3Price) {
        // Calculating spike phase 4, but we already saw spike phase 2
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.max(spikePhase3Price.price, Math.ceil(base * inferredRate - 1))
        };
      }

      // Not enough data: full theoretical range
      return {
        min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
        max: Math.ceil(base * RATES.SMALL_SPIKE.PEAK_RATE_MAX - 1)
      };
    }
  }

  // Phase 3: FINAL DECREASING (after the spike)
  const phaseStart = spikeStart + 5;
  const finalDecreasingPhase = knownPrices.filter(p => p.index >= phaseStart);
  return calculateDecreasingPhaseRange(
    periodIndex, base, finalDecreasingPhase, periodIndex - phaseStart,
    RATES.SMALL_SPIKE.POST_PEAK_MIN, RATES.SMALL_SPIKE.POST_PEAK_MAX, true
  );
}
