import { PERIODS, RATES } from "../constants.js";
import { getPeriodName, priceCeil, priceFloor, priceRatio } from "./utils.js";

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
 * Scores how well the known prices fit the Fluctuating pattern.
 * @param {Array<{index: number, price: number}>} knownPrices - Known prices sorted by index
 * @param {number} buyPrice - Base buy price
 * @returns {{score: number, reasons: string[]}} - Score and reasoning
 */
export function scoreFluctuating(knownPrices, buyPrice) {
  const reasons = [];
  let score = 80; // Base score: most common pattern

  // EARLY DETECTION RULE:
  // All non-Fluctuating patterns start at most at 90% on Monday AM (Decreasing: 85-90%,
  // Spikes: pre-spike phase 40-90%). So any Monday AM price above 90% is exclusive to Fluctuating.
  // Monday PM is ambiguous: Small Spike can start there (spike phase 0: 90-140%), so it gets a smaller bonus.
  const mondayAM = knownPrices.find(p => p.index === PERIODS.MONDAY_AM);
  if (mondayAM && priceRatio(mondayAM.price, buyPrice) > RATES.FLUCTUATING.EXCLUSIVE_EARLY_MIN) {
    score += 80;
    reasons.push(`
      ✅ Precio del ${getPeriodName(PERIODS.MONDAY_AM)} mayor al ${RATES.FLUCTUATING.EXCLUSIVE_EARLY_MIN * 100}% del precio de compra (${buyPrice}).
      Sólo Fluctuante puede subir tan temprano.
    `);
  } else {
    const mondayPM = knownPrices.find(p => p.index === PERIODS.MONDAY_PM);
    if (mondayPM && priceRatio(mondayPM.price, buyPrice) > RATES.FLUCTUATING.EXCLUSIVE_EARLY_MIN) {
      score += 40;
      reasons.push(`
        ✅ Precio del ${getPeriodName(PERIODS.MONDAY_PM)} mayor al ${RATES.FLUCTUATING.EXCLUSIVE_EARLY_MIN * 100}% del precio de compra (${buyPrice}).
        Sugiere Fluctuante, pero aún no hay completa certeza.
      `);
    }
  }

  return { score, reasons };
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
