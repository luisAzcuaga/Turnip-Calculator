import { priceCeil, priceFloor, priceRatio } from "./utils.js";
import { RATES } from "../constants.js";

/**
 * Checks whether the Fluctuating pattern is consistent with the known prices.
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @param {number} buyPrice - Base buy price
 * @returns {string[]|null} - Array of rejection reasons, or null if pattern is still possible
 */
export function reasonsToRejectFluctuating(knownPrices, buyPrice) {
  const rejectReasons = [];

  const inRange = knownPrices.every(({ price }) => {
    const ratio = priceRatio(price, buyPrice);
    return ratio >= RATES.FLUCTUATING.MIN && ratio <= RATES.FLUCTUATING.MAX;
  });

  if (!inRange) {
    rejectReasons.push(`
      Algún precio está fuera del rango de Fluctuante (${RATES.FLUCTUATING.MIN * 100}-${RATES.FLUCTUATING.MAX * 100}%)
      `);
    return rejectReasons;
  }

  return null;
}

/**
 * Returns the price range for the Fluctuating pattern.
 * Prices fluctuate unpredictably, so only the full range (60-140%) can be returned.
 * @param {number} base - Base buy price
 * @returns {{min: number, max: number}} - Full fluctuating range (60-140%)
 */
export function calculateFluctuatingPattern(base) {
  return {
    min: priceFloor(base, RATES.FLUCTUATING.MIN),
    max: priceCeil(base, RATES.FLUCTUATING.MAX)
  };
}
