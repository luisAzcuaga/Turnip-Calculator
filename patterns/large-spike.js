import { PERIODS, RATES } from "../constants.js";
import { calculateDecreasingPhaseRange, detectSpikePeakStart, priceCeil, priceFloor } from "./utils.js";

// Patrón PICO GRANDE: bajo → pico altísimo (hasta 600%) → bajo
// Basado en el algoritmo real datamineado del juego (Pattern 1)
// Usa constantes de constants.js (RATES, DECAY, VARIANCE, PERIODS)

/**
 * Calcula el rango de precios para el patrón Large Spike
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
export default function calculateLargeSpikePattern(periodIndex, base, knownPrices = []) {
  // peakStart puede ser 2-7 según el algoritmo del juego (Martes AM a Jueves PM)
  const peakStart = detectSpikePeakStart(knownPrices, PERIODS.LARGE_SPIKE_PEAK_START_MIN, PERIODS.SPIKE_PEAK_START_MAX, true, base);

  // Fase 1: DECRECIENTE (períodos 0 hasta peakStart-1)
  // Empieza en 85-90%, baja 3-5% cada período hasta mínimo 40%
  if (periodIndex < peakStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < peakStart);
    return calculateDecreasingPhaseRange(
      periodIndex, base, decreasingPhase, periodIndex,
      RATES.LARGE_SPIKE.START_MIN, RATES.LARGE_SPIKE.START_MAX, true
    );
  }

  // Fase 2: PICO (5 períodos consecutivos desde peakStart)
  const peakPhaseIndex = periodIndex - peakStart;

  if (peakPhaseIndex >= 0 && peakPhaseIndex < 5) {
    // Rangos según el algoritmo del juego (desde RATES.LARGE_SPIKE.PEAK_PHASES)
    const range = RATES.LARGE_SPIKE.PEAK_PHASES[peakPhaseIndex];
    return {
      min: priceFloor(base, range.min),
      max: priceCeil(base, range.max)
    };
  }

  // Fase 3: BAJA FINAL (después del pico)
  return {
    min: priceFloor(base, RATES.LARGE_SPIKE.POST_PEAK_MIN),
    max: priceCeil(base, RATES.LARGE_SPIKE.POST_PEAK_MAX)
  };
}
