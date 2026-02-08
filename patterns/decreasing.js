import { DECAY, RATES, VARIANCE } from "../constants.js";
import { calculateAvgRateDrop, priceCeil, priceFloor, projectPriceFromRate } from "./utils.js";

// Patrón DECRECIENTE: bajada constante
// Basado en el algoritmo real datamineado del juego (Pattern 2)
// Usa constantes de constants.js (RATES, DECAY, VARIANCE)
//
// Algoritmo del juego:
// - Tasa inicial: 90% menos 0-5% aleatorio (85-90%)
// - Cada período: tasa -= 3% + (0-2% aleatorio) = baja 3-5%

/**
 * Calcula el rango de precios para el patrón Decreasing
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
export default function calculateDecreasingPattern(periodIndex, base, knownPrices = []) {
  // Si tenemos datos conocidos, estimar la tasa de decrecimiento real del RATE
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
      // Mismo período, devolver el precio conocido
      return {
        min: lastKnown.price,
        max: lastKnown.price
      };
    }
  }

  // Sin datos suficientes: usar el algoritmo del juego
  // Tasa inicial: 0.85-0.90
  // Decrecimiento por período: 0.03-0.05

  // Calcular rango mínimo y máximo
  // Peor caso: empieza en 0.85 y baja 0.05 por período
  // Mejor caso: empieza en 0.90 y baja 0.03 por período
  const minRate = Math.max(RATES.FLOOR, (RATES.DECREASING.START_MIN - (periodIndex * DECAY.MAX_PER_PERIOD)));
  const maxRate = Math.max(RATES.FLOOR, (RATES.DECREASING.START_MAX - (periodIndex * DECAY.MIN_PER_PERIOD)));

  return {
    min: priceFloor(base, minRate),
    max: priceCeil(base, maxRate)
  };
}
