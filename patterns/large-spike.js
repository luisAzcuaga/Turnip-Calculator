import { PERIODS, RATES } from "../constants.js";
import { calculateDecreasingPhaseRange, detectSpikePeakStart, priceCeil, priceFloor } from "./utils.js";

// LARGE SPIKE pattern: low → very high peak (up to 600%) → low
// Based on the actual datamined game algorithm (Pattern 1)
// Uses constants from constants.js (RATES, DECAY, VARIANCE, PERIODS)

/**
 * Calculates the price range for the Large Spike pattern
 * @param {number} periodIndex - Period index (0-11)
 * @param {number} base - Base buy price
 * @param {Array} knownPrices - Array of known prices with {index, price}
 * @returns {{min: number, max: number}} - Price range
 */
export default function calculateLargeSpikePattern(periodIndex, base, knownPrices = []) {
  // peakStart can be 2-7 per the game algorithm (Tuesday AM to Thursday PM)
  const peakStart = detectSpikePeakStart(knownPrices, PERIODS.LARGE_SPIKE_PEAK_START_MIN, PERIODS.SPIKE_PEAK_START_MAX, true, base);

  // Phase 1: DECREASING (periods 0 through peakStart-1)
  // Starts at 85-90%, drops 3-5% each period down to a minimum of 40%
  if (periodIndex < peakStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < peakStart);
    return calculateDecreasingPhaseRange(
      periodIndex, base, decreasingPhase, periodIndex,
      RATES.LARGE_SPIKE.START_MIN, RATES.LARGE_SPIKE.START_MAX, true
    );
  }

  // Phase 2: PEAK (5 consecutive periods from peakStart)
  const peakPhaseIndex = periodIndex - peakStart;

  if (peakPhaseIndex >= 0 && peakPhaseIndex < 5) {
    // Ranges per the game algorithm (from RATES.LARGE_SPIKE.PEAK_PHASES)
    const range = RATES.LARGE_SPIKE.PEAK_PHASES[peakPhaseIndex];
    return {
      min: priceFloor(base, range.min),
      max: priceCeil(base, range.max)
    };
  }

  // Phase 3: FINAL LOW (after the peak)
  return {
    min: priceFloor(base, RATES.LARGE_SPIKE.POST_PEAK_MIN),
    max: priceCeil(base, RATES.LARGE_SPIKE.POST_PEAK_MAX)
  };
}
