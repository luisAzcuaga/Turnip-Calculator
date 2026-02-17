import { PERIODS, RATES } from "../constants.js";
import { calculateDecreasingPhaseRange, detectSpikePhaseStart, priceCeil, priceFloor } from "./utils.js";

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
export default function calculateSmallSpikePattern(periodIndex, base, knownPrices = []) {
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
