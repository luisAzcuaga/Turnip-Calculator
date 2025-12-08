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
  // Empieza en 85-90%, baja 3-5% cada período hasta mínimo 40%
  if (periodIndex < peakStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < peakStart);

    if (decreasingPhase.length >= 1) {
      const lastKnown = decreasingPhase[decreasingPhase.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;

      // Si tenemos al menos 2 precios, calcular tasa de decrecimiento observada
      if (decreasingPhase.length >= 2 && periodsAhead > 0) {
        const avgRate = decreasingPhase.slice(1).reduce((totalRate, current, i) => {
          const rate = (decreasingPhase[i].price - current.price) / decreasingPhase[i].price;
          return totalRate + rate;
        }, 0) / (decreasingPhase.length - 1);

        const projected = lastKnown.price * Math.pow(1 - avgRate, periodsAhead);
        return {
          min: Math.round(projected * 0.90),
          max: Math.round(projected * 1.10)
        };
      }

      // Si solo tenemos 1 precio o estamos prediciendo después del último conocido,
      // el máximo no puede ser mayor al último precio conocido (está bajando)
      if (periodsAhead > 0) {
        // Usar tasa de decrecimiento del algoritmo (3-5% por período)
        const minProjected = lastKnown.price * Math.pow(0.95, periodsAhead); // Baja 5%
        const maxProjected = lastKnown.price * Math.pow(0.97, periodsAhead); // Baja 3%

        return {
          min: Math.round(Math.max(base * 0.40, minProjected)),
          max: Math.round(Math.min(lastKnown.price, maxProjected))
        };
      }
    }

    // Sin datos suficientes: usar rangos del algoritmo del juego
    // Large Spike empieza 85-90%, baja 3-5% por período hasta mínimo 40%
    const minDecayPerPeriod = 0.03; // Baja mínima por período
    const maxDecayPerPeriod = 0.05; // Baja máxima por período

    // Calcular rango para este período
    // Peor caso: empieza en 85%, baja 5% por período
    const minRateStart = 0.85;
    const minRate = Math.max(0.40, minRateStart - (periodIndex * maxDecayPerPeriod));
    // Mejor caso: empieza en 90%, baja 3% por período
    const maxRateStart = 0.90;
    const maxRate = Math.max(0.40, maxRateStart - (periodIndex * minDecayPerPeriod));

    return {
      min: Math.round(base * minRate),
      max: Math.round(base * maxRate)
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
