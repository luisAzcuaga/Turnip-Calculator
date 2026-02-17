import { DECAY, RATES, VARIANCE } from "../constants.js";
import { calculateAvgRateDrop, priceCeil, priceFloor, projectPriceFromRate } from "./utils.js";

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
  // If we have known data, estimate the actual rate of decline
  if (knownPrices.length >= 2) {
    const lastKnown = knownPrices[knownPrices.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;

    if (periodsAhead > 0) {
      const avgRateDrop = calculateAvgRateDrop(knownPrices, base);
      const projected = projectPriceFromRate(lastKnown.price, base, avgRateDrop, periodsAhead);
      return {
        min: Math.floor(projected * VARIANCE.INFERRED_MIN),
        max: Math.ceil(projected * VARIANCE.INFERRED_MAX)
      };
    } else if (periodsAhead === 0) {
      // Same period, return the known price
      return {
        min: lastKnown.price,
        max: lastKnown.price
      };
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
