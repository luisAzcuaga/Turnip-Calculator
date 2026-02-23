import { PERIODS, RATES, THRESHOLDS } from "../constants.js";
import {
  calculateDecreasingPhaseRange, detectLargeSpikeSequence, detectSpikeConfirmation, detectSpikePhaseStart,
  getPeriodName, isTooLateForSpike,
  priceCeil, priceFloor, priceRatio, validatePreSpikeSlope
} from "./utils.js";

// SMALL SPIKE pattern: similar to large but with a lower max (140-200%)
// Based on the actual datamined game algorithm (Pattern 3)
// Uses constants from constants.js (RATES, DECAY, VARIANCE, PERIODS)

/**
 * Checks whether the Small Spike pattern is consistent with the known prices.
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @param {number} buyPrice - Base buy price
 * @returns {string[]|null} - Array of rejection reasons, or null if pattern is still possible
 */
export function reasonsToRejectSmallSpike(knownPrices, buyPrice) {
  if (knownPrices.length === 0) return null;

  const rejectReasons = [];

  // 1. SINGLE-PRICE: Monday AM must be in pre-spike range (40-90%)
  const mondayAM = knownPrices.find(p => p.index === PERIODS.MONDAY_AM);
  if (mondayAM) {
    const mondayRatio = priceRatio(mondayAM.price, buyPrice);
    if (mondayRatio > RATES.SMALL_SPIKE.START_MAX) {
      const prePeakValidRange = `${RATES.SMALL_SPIKE.START_MIN * 100}%-${RATES.SMALL_SPIKE.START_MAX * 100}%`;
      rejectReasons.push(`
        Lunes AM ($${mondayAM.price}) está al ${Math.round(mondayRatio * 100)}% del precio base.
        Al inicio, los precios deben de estar en el rango ${prePeakValidRange}.
      `);

      return rejectReasons;
    }
  }

  // 2. SIMPLE AGGREGATES
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxRatio = priceRatio(maxPrice, buyPrice);
  const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

  if (maxRatio > RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
    rejectReasons.push(`
      Precio máximo $${maxPrice} (${Math.round(maxRatio * 100)}%) excede ${RATES.SMALL_SPIKE.PEAK_RATE_MAX * 100}%.
      Esto no es Pico Pequeño.
    `);
    return rejectReasons;
  }

  // 3. TIMING
  const lateCheck = isTooLateForSpike(knownPrices, 'Small Spike');
  if (lateCheck.tooLate) {
    rejectReasons.push(lateCheck.reason);
    return rejectReasons;
  }

  if (maxKnownIndex >= PERIODS.LAST_PERIOD && maxRatio < RATES.LARGE_SPIKE.START_MAX) {
    const peakRange = `${RATES.SMALL_SPIKE.PEAK_RATE_MIN * 100}%-${RATES.SMALL_SPIKE.PEAK_RATE_MAX * 100}%`;
    const lastPeriodName = getPeriodName(PERIODS.LAST_PERIOD);
    rejectReasons.push(`
      Es ${lastPeriodName} y el precio máximo fue $${maxPrice} (${Math.round(maxRatio * 100)}%).
      Pico Pequeño necesita un pico de ${peakRange}.
      El pico puede empezar entre ${getPeriodName(PERIODS.SMALL_SPIKE_START_MIN)} y ${getPeriodName(PERIODS.SPIKE_START_MAX)}.
    `);
    return rejectReasons;
  }

  if (maxRatio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && maxRatio < RATES.SMALL_SPIKE.PEAK_RATE_MAX && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
    return null;
  }

  // 4. SLOPE
  const slopeCheck = validatePreSpikeSlope(knownPrices, false, buyPrice);
  if (slopeCheck.invalid) {
    rejectReasons.push(slopeCheck.reason);
    return rejectReasons;
  }

  if (maxRatio < RATES.SMALL_SPIKE.PEAK_RATE_MIN && knownPrices.length >= 3) {
    const maxPriceData = knownPrices.find(p => p.price === maxPrice);
    const hasSharpDrop = knownPrices.filter(p => p.index > maxPriceData.index).some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);
    if (hasSharpDrop) {
      rejectReasons.push(`
        El precio máximo $${maxPrice} (${Math.round(maxRatio * 100)}%) no alcanzó el ${RATES.SMALL_SPIKE.PEAK_RATE_MIN * 100}% requerido para Pico Pequeño.
        Los precios subieron y bajaron sin formar un pico válido.
      `);
      return rejectReasons;
    }
  }

  // 5. COMPLEX: P1→P2 sequence
  const confirmation = detectSpikeConfirmation(knownPrices, buyPrice);
  if (confirmation.detected) {
    const confirmationRate = parseFloat(confirmation.percent) / 100;
    if (confirmationRate >= RATES.SMALL_SPIKE.PEAK_RATE_MIN) {
      const phase2Range = `${RATES.LARGE_SPIKE.SPIKE_PHASES[1].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[1].max * 100}%`;
      const smallSpikePhase2Range = `${RATES.SMALL_SPIKE.SPIKE_PHASES[0].min * 100}%-${RATES.SMALL_SPIKE.SPIKE_PHASES[0].max * 100}%`;
      rejectReasons.push(`
        ${confirmation.day} tiene $${confirmation.price} (${confirmation.percent}%). 
        El Período 2 del pico está en rango ${phase2Range}, lo cual es incompatible con Pico Pequeño (Pico Pequeño debe tener Período 2 en ${smallSpikePhase2Range}). Esto no es Pico Pequeño.
        `);
      return rejectReasons;
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
            const hasRisenAgain = knownPrices.filter(p => p.index > minPriceData.index).some(p => p.price > minAfterLocalMax * 1.5);
            if (hasRisenAgain) {
              rejectReasons.push(`
                Detectado patrón de múltiples subidas y bajadas: pico en $${curr.price} (${Math.round(localMaxRatio * 100)}%), cayó a $${minAfterLocalMax}, y subió de nuevo.
                Esto no es Pico Pequeño.
              `);
              return rejectReasons;
            }
          }
        }
      }
    }
  }

  return null;
}

/**
 * Scores how well the known prices fit the Small Spike pattern.
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @param {number} buyPrice - Base buy price
 * @returns {{score: number, reasons: string[]}} - Score and reasoning
 */
export function scoreSmallSpike(knownPrices, buyPrice) {
  const reasons = [];
  let score = 0;
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const ratio = maxPrice / buyPrice;

  // Flag to detect if the pattern has been rejected
  let smallSpikeRejected = false;

  // Bonus if there's a moderate max in the exact Small Spike range
  if (ratio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && ratio < RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
    // Within the Small Spike peak range (140-200%).
    // The "ideal" sub-range (150-190%) is less ambiguous with Large Spike and scores highest.
    const peakRange = `${RATES.SMALL_SPIKE.PEAK_RATE_MIN * 100}%-${RATES.SMALL_SPIKE.PEAK_RATE_MAX * 100}%`;
    if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio <= THRESHOLDS.SMALL_SPIKE_PERFECT_MAX) {
      score += 90;
      reasons.push(`
        ✅ ¡Pico perfecto! $${maxPrice} (${Math.round(ratio * 100)}%) en rango ideal de Pico Pequeño (${peakRange})
      `);
    } else {
      score += 70;
      reasons.push(`
        ✅ Pico detectado $${maxPrice} (${Math.round(ratio * 100)}%) en rango de Pico Pequeño (${peakRange})
      `);
    }
  } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PRE_PEAK && ratio < RATES.SMALL_SPIKE.PEAK_RATE_MIN) {
    score += 40;
    reasons.push(`
      ⚠️ Precio $${maxPrice} (${Math.round(ratio * 100)}%) podría ser pre-pico de Pico Pequeño
    `);

    // Check if there was a dramatic drop after the max
    const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
    if (maxPriceIndex < knownPrices.length - 1) {
      const pricesAfterMax = knownPrices.slice(maxPriceIndex + 1);
      const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);

      if (hasSharpDrop) {
        smallSpikeRejected = true;
        score = 0;
        reasons.push(`
          ❌ El precio máximo $${maxPrice} no alcanzó ${RATES.SMALL_SPIKE.PEAK_RATE_MIN * 100}%.
          Los precios subieron y bajaron sin formar un pico válido.
        `);
      }
    }
  } else if (ratio >= RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
    smallSpikeRejected = true;
    score = 0;
    reasons.push(`
      ❌ Precio $${maxPrice} (${Math.round(ratio * 100)}%) excede ${RATES.SMALL_SPIKE.PEAK_RATE_MAX * 100}%.
      Esto no es Pico Pequeño.
    `);
  } else {
    const initialPhaseRange = `${RATES.SMALL_SPIKE.SPIKE_PHASES[0].min * 100}%-${RATES.SMALL_SPIKE.SPIKE_PHASES[0].max * 100}%`;
    const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
    if (maxPriceIndex < knownPrices.length - 1) {
      const pricesAfterMax = knownPrices.slice(maxPriceIndex + 1);
      const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);

      if (hasSharpDrop) {
        smallSpikeRejected = true;
        score = 0;
        reasons.push(`
          ❌ El precio máximo $${maxPrice} (${Math.round(ratio * 100)}%) no alcanzó ${RATES.SMALL_SPIKE.PEAK_RATE_MIN * 100}%.
          Los precios subieron y bajaron sin formar un pico válido.
        `);
      } else {
        reasons.push(`
          ⏳ Esperando confirmación. Máximo $${maxPrice} (${Math.round(ratio * 100)}%) es válido para fase inicial.
          Si el siguiente período se mantiene en ${initialPhaseRange}, sugiere Pico Pequeño
        `);
      }
    } else {
      reasons.push(`
        ⏳ Esperando confirmación.
        Máximo $${maxPrice} (${Math.round(ratio * 100)}%) es válido para fase inicial.
        Si el siguiente período se mantiene en ${initialPhaseRange}, sugiere Pico Pequeño
      `);
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
      reasons.push(`✅ Detectada subida moderada (señal de pico pequeño)`);
    }

    // Penalize if the sequence also matches Large Spike P1→P2
    // BUT: if the max is already in ideal Small Spike range (140-200%), penalize less
    const lsSequence = detectLargeSpikeSequence(knownPrices, buyPrice);
    if (lsSequence.detected && !lsSequence.hasDataAfterSequence) {
      const { spikePhase1, spikePhase2 } = lsSequence;
      // If the max is in ideal Small Spike range, it's more likely Small Spike
      const peakRange = `${RATES.LARGE_SPIKE.SPIKE_PHASES[2].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[2].max * 100}%`;
      if (ratio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && ratio < RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
        score -= 15;
        reasons.push(`
          ⚠️ La secuencia ${Math.round(spikePhase1.rate * 100)}% → ${Math.round(spikePhase2.rate * 100)}% también podría ser Pico Grande, pero el pico de ${Math.round(ratio * 100)}% es consistente con Pico Pequeño.
        `);
      } else {
        score -= 50;
        reasons.push(`
          ⚠️ La secuencia ${Math.round(spikePhase1.rate * 100)}% → ${Math.round(spikePhase2.rate * 100)}% también coincide con Pico Grande.
          El pico real podría ser mayor (${peakRange}).
        `);
      }
    }

    score += 20; // Base score
  }

  return { score, reasons };
}

/**
 * Calculates the price range for the Small Spike pattern for a given period.
 * @param {number} periodIndex - Period index (0-11)
 * @param {number} base - Base buy price
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @returns {{min: number, max: number}} - Predicted price range for the period
 */
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
        min: priceFloor(base, RATES.SMALL_SPIKE.SPIKE_PHASES[0].min),
        max: priceCeil(base, RATES.SMALL_SPIKE.SPIKE_PHASES[0].max)
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
