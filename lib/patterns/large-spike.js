import { PERIODS, RATES, THRESHOLDS } from "../constants.js";
import {
  calculateDecreasingPhaseRange, detectLargeSpikeSequence, detectSpikeConfirmation, detectSpikePhaseStart,
  getSpikeStartRange, isTooLateForSpike, largeSpikeStartRange,
  priceCeil, priceFloor, priceRatio, validatePreSpikeSlope
} from "./utils.js";

// LARGE SPIKE pattern: low → very high spike (up to 600%) → low
// Based on the actual datamined game algorithm (Pattern 1)
// Uses constants from constants.js (RATES, DECAY, VARIANCE, PERIODS)

/**
 * Checks whether the Large Spike pattern is consistent with the known prices.
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @param {number} buyPrice - Base buy price
 * @returns {string[]|null} - Array of rejection reasons, or null if pattern is still possible
 */
export function reasonsToRejectLargeSpike(knownPrices, buyPrice) {
  if (knownPrices.length === 0) return null;

  const rejectReasons = [];

  // 1. SINGLE-PRICE: Monday AM must be between 85-90%
  const mondayAM = knownPrices.find(p => p.index === PERIODS.MONDAY_AM);
  if (mondayAM) {
    const startRange = largeSpikeStartRange(buyPrice);
    const mondayRatio = priceRatio(mondayAM.price, buyPrice);
    if (mondayAM.price < startRange.min || mondayAM.price > startRange.max) {
      const prePeakValidRange = `${RATES.LARGE_SPIKE.START_MIN * 100}%-${RATES.LARGE_SPIKE.START_MAX * 100}%`;
      rejectReasons.push(`Lunes AM ($${mondayAM.price}) está al ${Math.round(mondayRatio * 100)}% del precio base. 
      Al inicio, los precios deben de estar en el rango ${prePeakValidRange}.`);

      return rejectReasons;
    }
  }

  // 2. SIMPLE AGGREGATES
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxRatio = priceRatio(maxPrice, buyPrice);
  const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

  if (maxRatio >= RATES.LARGE_SPIKE.PEAK_RATE_MIN) return null;

  // 3. TIMING
  const lateCheck = isTooLateForSpike(knownPrices, 'Large Spike');
  if (lateCheck.tooLate) {
    rejectReasons.push(lateCheck.reason);
    return rejectReasons;
  }

  if (maxKnownIndex >= PERIODS.LAST_PERIOD && maxRatio < RATES.SMALL_SPIKE.PEAK_RATE_MIN) {
    const spikeRange = getSpikeStartRange(true);
    rejectReasons.push(`Es Sábado PM y el precio máximo fue solo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%). Large Spike necesita un pico de 200-600%. El pico puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
    return rejectReasons;
  }

  // 4. SLOPE
  const slopeCheck = validatePreSpikeSlope(knownPrices, true, buyPrice);
  if (slopeCheck.invalid) {
    rejectReasons.push(slopeCheck.reason);
    return rejectReasons;
  }

  if (maxRatio < RATES.SMALL_SPIKE.PEAK_RATE_MIN) {
    const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
    if (maxPriceIndex !== -1 && maxPriceIndex < knownPrices.length - 1) {
      const hasSharpDrop = knownPrices.slice(maxPriceIndex + 1).some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);
      if (hasSharpDrop) {
        rejectReasons.push(`El precio máximo fue ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) y luego cayó más de 40%. El pico ya pasó y fue muy bajo para Large Spike.`);
        return rejectReasons;
      }
    }
  }

  // 5. COMPLEX: P1→P2 sequence
  const confirmation = detectSpikeConfirmation(knownPrices, buyPrice);
  if (confirmation.detected && confirmation.isLargeSpike === false) {
    rejectReasons.push(`${confirmation.day} tiene ${confirmation.price} bayas (${confirmation.percent}%). Large Spike necesita ≥140% en el Período 2 seguido de ≥200% en Período 3.`);
    return rejectReasons;
  }

  if (maxRatio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && maxRatio < RATES.SMALL_SPIKE.PEAK_RATE_MAX && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
    if (!confirmation.detected || !confirmation.isLargeSpike) {
      const hasRapidIncrease = knownPrices.some((current, i) => {
        if (i === 0) return false;
        return current.price > knownPrices[i - 1].price * THRESHOLDS.RAPID_INCREASE;
      });
      if (!hasRapidIncrease) {
        const spikeRange = getSpikeStartRange(true);
        rejectReasons.push(`Pico máximo ${maxPrice} bayas (${Math.round(maxRatio * 100)}%) está en rango de Small Spike (140-200%). Ya es tarde en la semana sin señales de Large Spike. Large Spike puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
        return rejectReasons;
      }
    }
  }

  return null;
}

/**
 * Scores how well the known prices fit the Large Spike pattern.
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @param {number} buyPrice - Base buy price
 * @returns {{score: number, reasons: string[]}} - Score and reasoning
 */
export function scoreLargeSpike(knownPrices, buyPrice) {
  const reasons = [];
  let score = 0;
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const ratio = maxPrice / buyPrice;

  // Bonus if there's a very high max (200%+)
  if (ratio >= RATES.LARGE_SPIKE.PEAK_RATE_MIN) {
    score += 100;
    reasons.push(`✅ ¡Pico enorme detectado! ${maxPrice} bayas (${Math.round(ratio * 100)}%) confirma Large Spike`);
  } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio < RATES.LARGE_SPIKE.PEAK_RATE_MIN) {
    // Ambiguous range: could be Small Spike or Large Spike
    if (ratio < THRESHOLDS.LARGE_SPIKE_NEAR_LIMIT) {
      score += 10;
      reasons.push(`⚠️ Precio máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) está en rango ambiguo, más cerca de Small Spike`);
    } else {
      score += 30;
      reasons.push(`⚠️ Precio máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) cerca del límite de Large Spike (190-200%)`);
    }
  } else {
    score += 5;
    reasons.push(`⏳ Esperando confirmación. Máximo ${maxPrice} bayas (${Math.round(ratio * 100)}%) es válido para fase inicial, el siguiente período debe estar entre 140-200% para confirmar Pico Grande`);
  }

  // Bonus if there's a low phase followed by a very rapid spike
  const hasLowToHigh = knownPrices.some((p, i) =>
    i > 0 && p.price > knownPrices[i-1].price * THRESHOLDS.RAPID_INCREASE && knownPrices[i-1].price < buyPrice
  );
  if (hasLowToHigh) {
    score += 40;
    reasons.push(`✅ Detectada subida rápida desde fase baja (señal de pico grande)`);
  }

  // Bonus if we detect a Large Spike P1->P2 sequence with no prices after
  const lsSequence = detectLargeSpikeSequence(knownPrices, buyPrice);
  if (lsSequence.detected && !lsSequence.hasDataAfterSequence) {
    const { spikePhase1, spikePhase2 } = lsSequence;
    // If P2 is in Small Spike range (140-200%), bonus is smaller because it's ambiguous
    // The max could be Small Spike; the 200-600% may not come
    if (spikePhase2.rate >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && spikePhase2.rate < RATES.SMALL_SPIKE.PEAK_RATE_MAX) {
      score += 30; // Bonus reducido - ambiguo
      reasons.push(`⚠️ Secuencia ${Math.round(spikePhase1.rate * 100)}% → ${Math.round(spikePhase2.rate * 100)}% es ambigua. Podría ser Large Spike (esperando 200-600%) o el pico de Small Spike.`);
    } else {
      score += 80;
      reasons.push(`✅ Secuencia Large Spike: ${spikePhase1.price} bayas (${Math.round(spikePhase1.rate * 100)}%) → ${spikePhase2.price} bayas (${Math.round(spikePhase2.rate * 100)}%). El pico real (200-600%) puede venir en el siguiente período.`);
    }
  }

  score += 10; // Reduced base score (less common than Small Spike)
  return { score, reasons };
}

/**
 * Calculates the price range for the Large Spike pattern for a given period.
 * @param {number} periodIndex - Period index (0-11)
 * @param {number} base - Base buy price
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @returns {{min: number, max: number}} - Predicted price range for the period
 */
export function calculateLargeSpikePattern(periodIndex, base, knownPrices = []) {
  // spikeStart can be 2-7 per the game algorithm (Tuesday AM to Thursday PM)
  const spikeStart = detectSpikePhaseStart(knownPrices, PERIODS.LARGE_SPIKE_START_MIN, PERIODS.SPIKE_START_MAX, true, base);

  // Phase 1: DECREASING (periods 0 through spikeStart-1)
  // Starts at 85-90%, drops 3-5% each period down to a minimum of 40%
  if (periodIndex < spikeStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < spikeStart);
    return calculateDecreasingPhaseRange(
      periodIndex, base, decreasingPhase, periodIndex,
      RATES.LARGE_SPIKE.START_MIN, RATES.LARGE_SPIKE.START_MAX, true
    );
  }

  // Phase 2: SPIKE (5 consecutive periods from spikeStart)
  const spikePhaseIndex = periodIndex - spikeStart;

  if (spikePhaseIndex >= 0 && spikePhaseIndex < 5) {
    // Ranges per the game algorithm (from RATES.LARGE_SPIKE.SPIKE_PHASES)
    const range = RATES.LARGE_SPIKE.SPIKE_PHASES[spikePhaseIndex];
    return {
      min: priceFloor(base, range.min),
      max: priceCeil(base, range.max)
    };
  }

  // Phase 3: FINAL LOW (after the spike)
  return {
    min: priceFloor(base, RATES.LARGE_SPIKE.POST_PEAK_MIN),
    max: priceCeil(base, RATES.LARGE_SPIKE.POST_PEAK_MAX)
  };
}
