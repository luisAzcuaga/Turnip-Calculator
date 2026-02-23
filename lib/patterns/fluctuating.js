import { PERIODS, RATES } from "../constants.js";
import { priceCeil, priceFloor, priceRatio } from "./utils.js";

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
  let score = 0;
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const ratio = priceRatio(maxPrice, buyPrice);

  // EARLY DETECTION RULE:
  // A price above the buy price on Monday is a near-certain Fluctuating signal.
  // Large/Small Spike phases start at Tuesday AM (period 2) at the earliest.
  // Decreasing never exceeds the buy price.
  // The +80 score is sufficient — other patterns score much lower in this scenario.
  const mondayPrices = knownPrices.filter(p => p.index <= PERIODS.MONDAY_PM);
  if (mondayPrices.some(p => p.price > buyPrice)) {
    score += 80;
    const highMonday = mondayPrices.find(p => p.price > buyPrice);
    reasons.push(`✅ Precio alto el Lunes (${highMonday.price} > ${buyPrice}). Solo Fluctuante sube temprano.`);
  }

  // Bonus if max price is within the normal Fluctuating range (60-140%)
  if (ratio < RATES.FLUCTUATING.MAX && ratio > RATES.FLUCTUATING.MIN) {
    score += 50;
    reasons.push(`✅ Precios en rango moderado (${Math.round(ratio * 100)}%), típico de Fluctuante (60-140%)`);
  } else if (ratio < RATES.FLUCTUATING.MIN) {
    reasons.push(`⚠️ Precio muy bajo (${Math.round(ratio * 100)}%), menos común en Fluctuante`);
  } else if (ratio >= RATES.FLUCTUATING.MAX) {
    reasons.push(`⚠️ Precio alto detectado (${Math.round(ratio * 100)}%), podría ser un pico en lugar de Fluctuante`);
  }

  score += 30; // Base score (most common pattern)
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
