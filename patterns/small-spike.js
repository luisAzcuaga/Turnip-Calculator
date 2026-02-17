import { PERIODS, RATES } from "../constants.js";
import { calculateDecreasingPhaseRange, detectSpikePeakStart, priceCeil, priceFloor } from "./utils.js";

// SMALL SPIKE pattern: similar to large but with a lower peak (140-200%)
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
  // peakStart can be 1-7 per the game algorithm (Monday PM to Thursday PM)
  const peakStart = detectSpikePeakStart(knownPrices, PERIODS.SMALL_SPIKE_PEAK_START_MIN, PERIODS.SPIKE_PEAK_START_MAX, false, base);

  // Phase 1: DECREASING (periods 0 through peakStart-1)
  // Starts at 40-90%, drops 3-5% each period
  if (periodIndex < peakStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < peakStart);
    return calculateDecreasingPhaseRange(
      periodIndex, base, decreasingPhase, periodIndex,
      RATES.SMALL_SPIKE.START_MIN, RATES.SMALL_SPIKE.START_MAX, false
    );
  }

  // Phase 2: PEAK (5 consecutive periods from peakStart)
  const peakPhaseIndex = periodIndex - peakStart;

  if (peakPhaseIndex >= 0 && peakPhaseIndex < 5) {
    // Actual game algorithm (Pattern 3):
    // The game picks a random "rate" between 1.4-2.0
    // Peak phase 0: 0.9-1.4
    // Peak phase 1: 0.9-1.4
    // Peak phase 2: (1.4 to rate) - 1 bell
    // Peak phase 3: rate (TRUE PEAK)
    // Peak phase 4: (1.4 to rate) - 1 bell

    // Get known prices for specific peak periods
    const peakPhase3Price = knownPrices.find(p => p.index === peakStart + 2);
    const peakPhase4Price = knownPrices.find(p => p.index === peakStart + 3);
    const peakPhase5Price = knownPrices.find(p => p.index === peakStart + 4);

    // Infer the rate ONLY when we have precise data
    // Peak phase 3 defines the exact rate
    // Peak phases 2 and 4 give a hint of the rate (they are rate - 1)
    let inferredRate = null;

    if (peakPhase4Price) {
      // If we saw peak phase 3, we know the exact rate
      inferredRate = peakPhase4Price.price / base;
    } else if (peakPhase3Price || peakPhase5Price) {
      // If we saw peak phase 2 or 4, we can infer the rate with good precision
      // Peak phase 2/4 = (1.4 to rate) - 1, so rate >= (price + 1) / base
      const knownPeriod = peakPhase3Price || peakPhase5Price;
      inferredRate = (knownPeriod.price + 1) / base;
      // Clamp to valid range (1.4-2.0)
      inferredRate = Math.max(RATES.SMALL_SPIKE.PEAK_RATE_MIN, Math.min(RATES.SMALL_SPIKE.PEAK_RATE_MAX, inferredRate));
    }
    // If we only have peak phases 0 and/or 1, do NOT infer the rate (not enough info)

    // Ranges per the exact game algorithm
    if (peakPhaseIndex === 0 || peakPhaseIndex === 1) {
      // Peak phases 0 and 1: 0.9-1.4
      return {
        min: priceFloor(base, RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MIN),
        max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MAX)
      };
    } else if (peakPhaseIndex === 3) {
      // Peak phase 3: TRUE PEAK (rate * base) - no variance, it is the exact rate

      // If we already saw peak phase 3, use that exact value
      if (peakPhase4Price) {
        return {
          min: peakPhase4Price.price,
          max: peakPhase4Price.price
        };
      }

      // If we saw peak phase 2, we know peak phase 3 >= peak phase 2 + 1
      if (peakPhase3Price) {
        return {
          min: peakPhase3Price.price + 1,
          max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_RATE_MAX)
        };
      }

      // If we saw peak phase 4, we can infer the rate and show the exact value
      if (peakPhase5Price && inferredRate) {
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
      // Peak phases 2 and 4: (1.4 to rate) * base - 1 bell

      // If we have the inferred rate (from peak phase 3), use it to narrow the range
      if (inferredRate && peakPhase4Price) {
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.ceil(base * inferredRate - 1)
        };
      }

      // If we saw the other peak phase (2 or 4), use that price as reference
      if (peakPhaseIndex === 2 && peakPhase5Price) {
        // Calculating peak phase 2, but we already saw peak phase 4
        // Both use the same formula, so they can be similar
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.max(peakPhase5Price.price, Math.ceil(base * inferredRate - 1))
        };
      }

      if (peakPhaseIndex === 4 && peakPhase3Price) {
        // Calculating peak phase 4, but we already saw peak phase 2
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.max(peakPhase3Price.price, Math.ceil(base * inferredRate - 1))
        };
      }

      // Not enough data: full theoretical range
      return {
        min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
        max: Math.ceil(base * RATES.SMALL_SPIKE.PEAK_RATE_MAX - 1)
      };
    }
  }

  // Phase 3: FINAL DECREASING (after the peak)
  const phaseStart = peakStart + 5;
  const finalDecreasingPhase = knownPrices.filter(p => p.index >= phaseStart);
  return calculateDecreasingPhaseRange(
    periodIndex, base, finalDecreasingPhase, periodIndex - phaseStart,
    RATES.SMALL_SPIKE.POST_PEAK_MIN, RATES.SMALL_SPIKE.POST_PEAK_MAX, true
  );
}
