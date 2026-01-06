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
function calculateLargeSpikePattern(periodIndex, base, knownPrices = []) {
  // peakStart puede ser 2-7 según el algoritmo del juego (Martes AM a Jueves PM)
  const peakStart = detectSpikePeakStart(knownPrices, PERIODS.LARGE_SPIKE_PEAK_START_MIN, PERIODS.SPIKE_PEAK_START_MAX, true, base);

  // Fase 1: DECRECIENTE (períodos 0 hasta peakStart-1)
  // Empieza en 85-90%, baja 3-5% cada período hasta mínimo 40%
  if (periodIndex < peakStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < peakStart);

    if (decreasingPhase.length >= 1) {
      const lastKnown = decreasingPhase[decreasingPhase.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;

      // Si tenemos al menos 2 precios, calcular tasa de decrecimiento observada del RATE
      if (decreasingPhase.length >= 2 && periodsAhead > 0) {
        const avgRateDrop = calculateAvgRateDrop(decreasingPhase, base);
        const projected = projectPriceFromRate(lastKnown.price, base, avgRateDrop, periodsAhead);
        return {
          min: Math.floor(projected * VARIANCE.PROJECTED_MIN),
          max: Math.ceil(projected * VARIANCE.PROJECTED_MAX)
        };
      }

      // Si solo tenemos 1 precio o estamos prediciendo después del último conocido,
      // el máximo no puede ser mayor al último precio conocido (está bajando)
      if (periodsAhead > 0) {
        // Usar tasa de decrecimiento del algoritmo (3-5 puntos del rate por período)
        const lastKnownRate = lastKnown.price / base;
        const minProjectedRate = lastKnownRate - (DECAY.MAX_PER_PERIOD * periodsAhead); // Baja 5 puntos
        const maxProjectedRate = lastKnownRate - (DECAY.MIN_PER_PERIOD * periodsAhead); // Baja 3 puntos
        const minProjected = base * Math.max(RATES.FLOOR, minProjectedRate);
        const maxProjected = base * maxProjectedRate;

        return {
          min: Math.floor(Math.max(base * RATES.FLOOR, minProjected)),
          max: Math.ceil(Math.min(lastKnown.price, maxProjected))
        };
      }
    }

    // Sin datos suficientes: usar rangos del algoritmo del juego
    // Large Spike empieza 85-90%, baja 3-5% por período hasta mínimo 40%

    // Calcular rango para este período
    // Peor caso: empieza en 85%, baja 5% por período
    const minRate = Math.max(RATES.FLOOR, RATES.LARGE_SPIKE.START_MIN - (periodIndex * DECAY.MAX_PER_PERIOD));
    // Mejor caso: empieza en 90%, baja 3% por período
    const maxRate = Math.max(RATES.FLOOR, RATES.LARGE_SPIKE.START_MAX - (periodIndex * DECAY.MIN_PER_PERIOD));

    return {
      min: priceFloor(base, minRate),
      max: priceCeil(base, maxRate)
    };
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
