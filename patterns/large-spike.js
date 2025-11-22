// Patrón PICO GRANDE: bajo → pico altísimo (hasta 600%) → bajo
// Basado en el algoritmo real datamineado del juego (Pattern 1)

/**
 * Calcula el rango de precios para el patrón Large Spike
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
function calculateLargeSpikePattern(periodIndex, base, knownPrices = []) {
  // peakStart puede ser 3-9 según el algoritmo del juego
  const peakStart = detectSpikePeakStart(knownPrices, 3, 9, true);

  // Fase 1: DECRECIENTE (períodos 0 hasta peakStart-1)
  // Empieza en 85-90%, baja 3-5% cada período
  if (periodIndex < peakStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < peakStart);

    if (decreasingPhase.length >= 2) {
      // Calcular tasa de decrecimiento observada
      let totalRate = 0;
      for (let i = 1; i < decreasingPhase.length; i++) {
        const rate = (decreasingPhase[i - 1].price - decreasingPhase[i].price) / decreasingPhase[i - 1].price;
        totalRate += rate;
      }
      const avgRate = totalRate / (decreasingPhase.length - 1);

      const lastKnown = decreasingPhase[decreasingPhase.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;
      if (periodsAhead > 0) {
        const projected = lastKnown.price * Math.pow(1 - avgRate, periodsAhead);
        return {
          min: Math.round(projected * 0.90),
          max: Math.round(projected * 1.10)
        };
      }
    }

    // Sin datos suficientes: usar rangos del algoritmo
    const initialRate = 0.875; // Promedio de 0.85-0.90
    const decayPerPeriod = 0.04; // Promedio de 0.03-0.05
    const rate = Math.max(0.40, initialRate - (periodIndex * decayPerPeriod));
    const price = base * rate;

    return {
      min: Math.round(price * 0.85),
      max: Math.round(price * 1.10)
    };
  }

  // Fase 2: PICO (5 períodos consecutivos desde peakStart)
  const peakPhaseIndex = periodIndex - peakStart;

  if (peakPhaseIndex >= 0 && peakPhaseIndex < 5) {
    // Rangos según el algoritmo del juego:
    // peakStart+0: 90-140%
    // peakStart+1: 140-200%
    // peakStart+2: 200-600% (PICO MÁXIMO)
    // peakStart+3: 140-200%
    // peakStart+4: 90-140%
    const peakPhaseRanges = [
      { min: 0.90, max: 1.40 },
      { min: 1.40, max: 2.00 },
      { min: 2.00, max: 6.00 },
      { min: 1.40, max: 2.00 },
      { min: 0.90, max: 1.40 }
    ];

    const range = peakPhaseRanges[peakPhaseIndex];
    return {
      min: Math.round(base * range.min),
      max: Math.round(base * range.max)
    };
  }

  // Fase 3: BAJA FINAL (después del pico)
  return {
    min: Math.round(base * 0.40),
    max: Math.round(base * 0.90)
  };
}
