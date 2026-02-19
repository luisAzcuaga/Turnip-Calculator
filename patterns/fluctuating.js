import { BUY_PRICE_MAX, BUY_PRICE_MIN, PERIODS, RATES, THRESHOLDS } from "../constants.js";
import { priceCeil, priceFloor, priceRatio } from "./utils.js";

// FLUCTUATING pattern: alternates between high and low phases
// Based on the actual datamined game algorithm (Pattern 0)
// Uses constants from constants.js (RATES, PERIODS, THRESHOLDS)
//
// Pattern structure (12 total periods):
// - HIGH phase 1: 0-6 periods, prices 90-140%
// - LOW phase 1: 2-3 periods, starts 60-80%, drops 4-10% per period
// - HIGH phase 2: variable periods, prices 90-140%
// - LOW phase 2: 3-2 periods (complement of LOW 1), starts 60-80%, drops 4-10%
// - HIGH phase 3: remaining periods, prices 90-140%
//
// KEY RULE: decPhaseLen1 + decPhaseLen2 = 5 periods ALWAYS
// - If LOW1 has 3 periods -> LOW2 will have 2 periods
// - If LOW1 has 2 periods -> LOW2 will have 3 periods

/**
 * Detects low phases in the known prices
 * @param {Array} knownPrices - Array of known prices sorted by index
 * @param {number} base - Base buy price
 * @returns {Array} - Array of detected phases with {startIndex, length}
 */
function detectFluctuatingPhases(knownPrices, base) {
  if (knownPrices.length < 2) return [];

  const phases = [];
  let i = 0;

  while (i < knownPrices.length) {
    const current = knownPrices[i];
    const ratio = current.price / base;

    // Detect start of low phase (ratio < 85% and declining)
    if (ratio < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD && i < knownPrices.length - 1) {
      const phaseStart = current.index;
      let phaseLength = 1;
      let j = i + 1;

      // Count how many consecutive periods are declining
      while (j < knownPrices.length) {
        const next = knownPrices[j];
        const prev = knownPrices[j - 1];

        // If the index is not consecutive, stop
        if (next.index !== prev.index + 1) break;

        // If the price rises significantly (>5%), the low phase ended
        if (next.price > prev.price * THRESHOLDS.SLIGHT_RISE) break;

        // If it is in the high phase range (>85%), the low phase ended
        if (next.price / base >= RATES.FLUCTUATING.LOW_PHASE_THRESHOLD) break;

        phaseLength++;
        j++;
      }

      // Only consider low phases of 2 or 3 periods
      if (phaseLength === 2 || phaseLength === 3) {
        phases.push({ startIndex: phaseStart, length: phaseLength });
      }

      i = j;
    } else {
      i++;
    }
  }

  return phases;
}

/**
 * Checks whether a period falls within a given phase
 */
function isInPhase(periodIndex, phase) {
  return phase && periodIndex >= phase.startIndex && periodIndex <= phase.endIndex;
}

/**
 * Detects whether LOW2 is in progress based on the latest known prices
 * @param {Array} knownPrices - Known prices sorted by index
 * @param {number} base - Base buy price
 * @param {Object} lowPhase1 - Detected low phase 1 with {startIndex, endIndex}
 * @param {number} lowPhase2ExpectedLength - Expected length of LOW2 (5 - lowPhase1Length)
 * @returns {Object|null} - {startIndex, endIndex} of LOW2 if detected, null otherwise
 */
function detectLowPhase2InProgress(knownPrices, base, lowPhase1, lowPhase2ExpectedLength) {
  if (knownPrices.length < 2) return null;

  const lastPrice = knownPrices[knownPrices.length - 1];
  if (lastPrice.price / base >= RATES.FLUCTUATING.LOW_PHASE_THRESHOLD || lastPrice.index <= lowPhase1.endIndex) {
    return null;
  }

  // Walk backwards to find the start of LOW2
  let lowPhase2Start = lastPrice.index;
  for (let i = knownPrices.length - 2; i >= 0; i--) {
    const p = knownPrices[i];
    if (p.price / base < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD &&
        p.index > lowPhase1.endIndex &&
        p.index === lowPhase2Start - 1) {
      lowPhase2Start = p.index;
    } else {
      break;
    }
  }

  return { startIndex: lowPhase2Start, endIndex: lowPhase2Start + lowPhase2ExpectedLength - 1 };
}

/**
 * Analyzes the complete structure of the Fluctuating pattern
 * @param {Array} knownPrices - Array of known prices sorted by index
 * @param {number} base - Base buy price
 * @returns {Object|null} - Detected structure with {lowPhase1, lowPhase2} or null
 */
function analyzeFluctuatingStructure(knownPrices, base) {
  if (knownPrices.length === 0) return null;

  const lowPhases = detectFluctuatingPhases(knownPrices, base);

  if (lowPhases.length === 0) return { lowPhase1: null, lowPhase2: null };

  const first = lowPhases[0];
  const firstEnd = first.startIndex + first.length - 1;
  const lowPhase1 = { startIndex: first.startIndex, endIndex: firstEnd };

  if (lowPhases.length === 1) {
    return { lowPhase1, lowPhase2: null };
  }

  const second = lowPhases[1];
  const secondEnd = second.startIndex + second.length - 1;

  return {
    lowPhase1,
    lowPhase2: { startIndex: second.startIndex, endIndex: secondEnd }
  };
}

/**
 * Calculates the price range for the Fluctuating pattern
 * @param {number} periodIndex - Period index (0-11)
 * @param {number} base - Base buy price
 * @param {Array} knownPrices - Array of known prices with {index, price}
 * @returns {{min: number, max: number}} - Price range
 */
/**
 * Checks whether the Fluctuating pattern is consistent with the known prices.
 * Returns { rejectReasons: string[] }
 */
export function reasonsToRejectFluctuating(knownPrices, buyPrice) {
  const rejectReasons = [];

  const inRange = knownPrices.every(({ price }) => {
    const ratio = priceRatio(price, buyPrice);
    return ratio >= RATES.FLUCTUATING.MIN && ratio <= RATES.FLUCTUATING.MAX;
  });

  if (!inRange) {
    rejectReasons.push(`Precio fuera del rango de Fluctuante (60-140%)`);
    return rejectReasons;
  }

  return null;
}

export function calculateFluctuatingPattern(periodIndex, base, knownPrices = []) {
  // Defensive validation: cannot predict without a base price
  if (!base || base < BUY_PRICE_MIN || base > BUY_PRICE_MAX) {
    console.warn('Fluctuating pattern: Precio base inválido', base);
    return { min: 0, max: 0 };
  }

  // If we have a known price for this exact period, return it
  const knownPrice = knownPrices.find(p => p.index === periodIndex);
  if (knownPrice) {
    return { min: knownPrice.price, max: knownPrice.price };
  }

  const LOW = {
    min: priceFloor(base, RATES.FLUCTUATING.LOW_PHASE_MIN),
    max: priceCeil(base, RATES.FLUCTUATING.LOW_PHASE_MAX)
  };
  const HIGH = {
    min: priceFloor(base, RATES.FLUCTUATING.HIGH_PHASE_MIN),
    max: priceCeil(base, RATES.FLUCTUATING.HIGH_PHASE_MAX)
  };

  // Analyze structure and predict based on detected phase
  const structure = analyzeFluctuatingStructure(knownPrices, base);

  if (structure && structure.lowPhase1) {
    // Full structure: both low phases detected
    if (structure.lowPhase2) {
      if (isInPhase(periodIndex, structure.lowPhase1) || isInPhase(periodIndex, structure.lowPhase2)) {
        return LOW;
      }
      return HIGH;
    }

    // Partial structure: only LOW1 detected
    if (isInPhase(periodIndex, structure.lowPhase1)) {
      return LOW;
    }

    const lowPhase1Length = structure.lowPhase1.endIndex - structure.lowPhase1.startIndex + 1;
    const lowPhase2 = detectLowPhase2InProgress(knownPrices, base, structure.lowPhase1, 5 - lowPhase1Length);

    if (lowPhase2) {
      if (isInPhase(periodIndex, lowPhase2)) return LOW;
      if (periodIndex > lowPhase2.endIndex) return HIGH;
    }

    // If we are late in the week and LOW1 occurred early, this must be HIGH
    if (periodIndex >= PERIODS.SATURDAY_AM && structure.lowPhase1.startIndex <= PERIODS.THURSDAY_AM) {
      return HIGH;
    }
  }

  // Not enough information: use full range (60-140%)
  return {
    min: priceFloor(base, RATES.FLUCTUATING.MIN),
    max: priceCeil(base, RATES.FLUCTUATING.MAX)
  };
}
