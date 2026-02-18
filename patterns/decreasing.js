import { DECAY, RATES } from "../constants.js";
import { priceCeil, priceFloor } from "./utils.js";

// DECREASING pattern: steady decline
// Based on the actual datamined game algorithm (Pattern 2)
// Uses constants from constants.js (RATES, DECAY, VARIANCE)
//
// Game algorithm:
// - Initial rate: 90% minus 0-5% random (85-90%)
// - Each period: rate -= 3% + (0-2% random) = drops 3-5%

/**
 * Calculates the price range for the Decreasing pattern
 * @param {number} periodIndex - Period index (0-11)
 * @param {number} base - Base buy price
 * @param {Array} knownPrices - Array of known prices with {index, price}
 * @returns {{min: number, max: number}} - Price range
 */
export default function calculateDecreasingPattern(periodIndex, base, knownPrices = []) {
  // With any known price, project using game bounds: drops 3–5% per period
  if (knownPrices.length >= 1) {
    const lastKnown = knownPrices[knownPrices.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;

    if (periodsAhead > 0) {
      const lastRate = lastKnown.price / base;
      const minRate = Math.max(RATES.FLOOR, lastRate - (DECAY.MAX_PER_PERIOD * periodsAhead));
      const maxRate = Math.max(RATES.FLOOR, lastRate - (DECAY.MIN_PER_PERIOD * periodsAhead));
      return {
        min: priceFloor(base, minRate),
        max: priceCeil(base, maxRate)
      };
    } else if (periodsAhead === 0) {
      return { min: lastKnown.price, max: lastKnown.price };
    }
  }

  // Not enough data: use the game algorithm
  // Initial rate: 0.85-0.90
  // Decay per period: 0.03-0.05

  // Calculate min and max range
  // Worst case: starts at 0.85 and drops 0.05 per period
  // Best case: starts at 0.90 and drops 0.03 per period
  const minRate = Math.max(RATES.FLOOR, (RATES.DECREASING.START_MIN - (periodIndex * DECAY.MAX_PER_PERIOD)));
  const maxRate = Math.max(RATES.FLOOR, (RATES.DECREASING.START_MAX - (periodIndex * DECAY.MIN_PER_PERIOD)));

  return {
    min: priceFloor(base, minRate),
    max: priceCeil(base, maxRate)
  };
}
