import { PERIODS, RATES, THRESHOLDS } from "../constants.js";
import {
  calculateDecreasingPhaseRange, detectLargeSpikeSequence, detectSpikeConfirmation, detectSpikePhaseStart,
  getPeriodName,
  isTooLateForSpike, largeSpikeStartRange,
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
  const maxKnownIndex = knownPrices.at(-1).index;
  if (maxRatio >= RATES.LARGE_SPIKE.PEAK_RATE_MIN) return null;

  // 3. TIMING
  const lateCheck = isTooLateForSpike(knownPrices, 'Large Spike');
  if (lateCheck.tooLate) {
    rejectReasons.push(lateCheck.reason);
    return rejectReasons;
  }

  if (maxKnownIndex >= PERIODS.LAST_PERIOD && maxRatio < RATES.SMALL_SPIKE.PEAK_RATE_MIN) {
    const peakRange = `${RATES.LARGE_SPIKE.SPIKE_PHASES[2].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[2].max * 100}%`;
    const lastPeriodName = getPeriodName(PERIODS.LAST_PERIOD);
    rejectReasons.push(`
      Es ${lastPeriodName} y el precio máximo fue $${maxPrice} (${Math.round(maxRatio * 100)}%).
      Pico Grande necesita un pico de ${peakRange}.
      El pico puede empezar entre ${getPeriodName(PERIODS.LARGE_SPIKE_START_MIN)} y ${getPeriodName(PERIODS.SPIKE_START_MAX)}.
    `);
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
    if (maxPriceIndex < knownPrices.length - 1) {
      const hasSharpDrop = knownPrices.slice(maxPriceIndex + 1).some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);
      if (hasSharpDrop) {
        rejectReasons.push(`
          El precio máximo fue $${maxPrice} (${Math.round(maxRatio * 100)}%) y luego cayó más de 40%.
          El pico ya pasó y fue muy bajo para Pico Grande.`);
        return rejectReasons;
      }
    }
  }

  // 5. COMPLEX: P1→P2 sequence
  const confirmation = detectSpikeConfirmation(knownPrices, buyPrice);
  if (confirmation.detected && confirmation.isLargeSpike === false) {
    const secondPhaseRange = `${RATES.LARGE_SPIKE.SPIKE_PHASES[1].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[1].max * 100}%`;
    const thirdPhaseRange = `${RATES.LARGE_SPIKE.SPIKE_PHASES[2].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[2].max * 100}%`;
    rejectReasons.push(
      `${confirmation.day} tiene $${confirmation.price} (${confirmation.percent}%).
      Pico Grande necesita ${secondPhaseRange} en el Período 2 seguido de ${thirdPhaseRange} en Período 3.`);
    return rejectReasons;
  }

  if (maxRatio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
    if (!confirmation.detected || !confirmation.isLargeSpike) {
      const hasRapidIncrease = knownPrices.some((current, i) => {
        if (i === 0) return false;
        return current.price > knownPrices[i - 1].price * THRESHOLDS.RAPID_INCREASE;
      });
      if (!hasRapidIncrease) {
        const secondPhaseRange = `${RATES.LARGE_SPIKE.SPIKE_PHASES[1].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[1].max * 100}%`;
        rejectReasons.push(`
          Pico máximo $${maxPrice} (${Math.round(maxRatio * 100)}%) no está en rango de Pico Grande (${secondPhaseRange}).
        Ya es tarde en la semana sin señales de Pico Grande. Pico Grande puede empezar entre ${getPeriodName(PERIODS.LARGE_SPIKE_START_MIN)} y ${getPeriodName(PERIODS.SPIKE_START_MAX)}`);
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
  const maxPriceRatio = priceRatio(maxPrice, buyPrice);

  // Bonus if there's a very high max (200%+)
  if (maxPriceRatio >= RATES.LARGE_SPIKE.PEAK_RATE_MIN) {
    score += 100;
    reasons.push(`
      ✅ ¡Pico enorme detectado! $${maxPrice} corresponde al ${Math.round(maxPriceRatio * 100)}% del precio base. Esto confirma Pico Grande
      `);
  } else if (maxPriceRatio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && maxPriceRatio < RATES.LARGE_SPIKE.PEAK_RATE_MIN) {
    // Ambiguous range: could be Small Spike or Large Spike
    if (maxPriceRatio < THRESHOLDS.LARGE_SPIKE_NEAR_LIMIT) {
      score += 10;
      reasons.push(`
        ⚠️ Precio máximo $${maxPrice} corresponde al ${Math.round(maxPriceRatio * 100)}% del precio base.
        Esto aún es ambiguo para terminar pico grande.
        `);
    } else {
      score += 30;
      const nearLimitRange = `${THRESHOLDS.LARGE_SPIKE_NEAR_LIMIT * 100}%-${RATES.LARGE_SPIKE.PEAK_RATE_MIN * 100}%`;
      reasons.push(`
        ⚠️ El precio máximo hasta ahora es de $${maxPrice} (${Math.round(maxPriceRatio * 100)}%) cerca del límite de Pico Grande (${nearLimitRange})
        `);
    }
  } else {
    score += 5;
    const secondPhaseRange = `${RATES.LARGE_SPIKE.SPIKE_PHASES[1].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[1].max * 100}%`;
    reasons.push(`
      ⏳ Esperando confirmación. El máximo hasta ahora es de $${maxPrice} (${Math.round(maxPriceRatio * 100)}%) válido para fase inicial.
      El siguiente período debe estar entre ${secondPhaseRange} para confirmar Pico Grande`);
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
    const thirdPhaseRange = `${RATES.LARGE_SPIKE.SPIKE_PHASES[2].min * 100}%-${RATES.LARGE_SPIKE.SPIKE_PHASES[2].max * 100}%`;

    score += 30;
    reasons.push(`
        ⚠️ Secuencia ${Math.round(spikePhase1.rate * 100)}% → ${Math.round(spikePhase2.rate * 100)}% es ambigua. Podría ser Pico Grande (esperando ${thirdPhaseRange}).
        `);
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
