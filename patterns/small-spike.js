// Patrón PICO PEQUEÑO: similar al grande pero pico menor (140-200%)
// Basado en el algoritmo real datamineado del juego (Pattern 3)
// Usa constantes de constants.js (RATES, DECAY, VARIANCE, PERIODS)

/**
 * Calcula el rango de precios para el patrón Small Spike
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
function calculateSmallSpikePattern(periodIndex, base, knownPrices = []) {
  // peakStart puede ser 2-9 según el algoritmo del juego
  const peakStart = detectSpikePeakStart(knownPrices, PERIODS.SMALL_SPIKE_PEAK_START_MIN, PERIODS.SPIKE_PEAK_START_MAX, false);

  // Fase 1: DECRECIENTE (períodos 0 hasta peakStart-1)
  // Empieza en 40-90%, baja 3-5% cada período
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
    // Fase decreciente pre-pico: empieza 40-90%, baja 3-5% por período

    // Calcular rango para este período
    // Peor caso: empieza en 40% (mínimo fijo del juego)
    const minRate = RATES.SMALL_SPIKE.START_MIN; // Mínimo fijo del juego
    // Mejor caso: empieza en 90% y baja 3% por período
    const maxRate = Math.max(RATES.FLOOR, RATES.SMALL_SPIKE.START_MAX - (periodIndex * DECAY.MIN_PER_PERIOD));

    return {
      min: priceFloor(base, minRate),
      max: priceCeil(base, maxRate)
    };
  }

  // Fase 2: PICO (5 períodos consecutivos desde peakStart)
  const peakPhaseIndex = periodIndex - peakStart;

  if (peakPhaseIndex >= 0 && peakPhaseIndex < 5) {
    // Algoritmo real del juego (Pattern 3):
    // El juego elige un "rate" aleatorio entre 1.4-2.0
    // Período 0: 0.9-1.4
    // Período 1: 0.9-1.4
    // Período 2: (1.4 a rate) - 1 bell
    // Período 3: rate (PICO REAL)
    // Período 4: (1.4 a rate) - 1 bell

    // Intentar inferir el "rate" de los datos conocidos
    // IMPORTANTE: Solo inferir si ya vimos el período 3 (pico real) o posterior
    const peakPrices = knownPrices.filter(p =>
      p.index >= peakStart && p.index < peakStart + 5
    );

    let inferredRate = null;
    const hasPeakData = peakPrices.some(p => p.index >= peakStart + 3);

    if (hasPeakData) {
      // Ya pasó el pico real, podemos inferir el rate
      const maxInPeak = Math.max(...peakPrices.map(p => p.price));
      inferredRate = maxInPeak / base;
      // Asegurar que esté en el rango válido
      inferredRate = Math.max(RATES.SMALL_SPIKE.PEAK_RATE_MIN, Math.min(RATES.SMALL_SPIKE.PEAK_RATE_MAX, inferredRate));
    }

    // Rangos según el algoritmo exacto del juego
    if (peakPhaseIndex === 0 || peakPhaseIndex === 1) {
      // Períodos 1 y 2: 0.9-1.4
      return {
        min: priceFloor(base, RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MIN),
        max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MAX)
      };
    } else if (peakPhaseIndex === 3) {
      // Período 4: PICO REAL (rate * base)
      if (inferredRate) {
        return {
          min: Math.floor(base * inferredRate * VARIANCE.INFERRED_MIN),
          max: Math.ceil(base * inferredRate * VARIANCE.INFERRED_MAX)
        };
      }
      return {
        min: priceFloor(base, RATES.SMALL_SPIKE.PEAK_RATE_MIN),
        max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_RATE_MAX)
      };
    } else {
      // Períodos 3 y 5: (1.4 a rate) * base - 1 bell
      if (inferredRate) {
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.ceil(base * inferredRate - 1)
        };
      }
      return {
        min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
        max: Math.ceil(base * RATES.SMALL_SPIKE.PEAK_RATE_MAX - 1)
      };
    }
  }

  // Fase 3: DECRECIENTE FINAL (después del pico)
  const finalDecreasingPhase = knownPrices.filter(p => p.index >= peakStart + 5);

  if (finalDecreasingPhase.length >= 2) {
    // Calcular tasa de decrecimiento observada
    const avgRate = finalDecreasingPhase.slice(1).reduce((totalRate, current, i) => {
      const rate = (finalDecreasingPhase[i].price - current.price) / finalDecreasingPhase[i].price;
      return totalRate + rate;
    }, 0) / (finalDecreasingPhase.length - 1);

    const lastKnown = finalDecreasingPhase[finalDecreasingPhase.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;
    if (periodsAhead > 0) {
      const projected = lastKnown.price * Math.pow(1 - avgRate, periodsAhead);
      return {
        min: Math.floor(projected * VARIANCE.PROJECTED_MIN),
        max: Math.ceil(projected * VARIANCE.PROJECTED_MAX)
      };
    }
  }

  // Sin datos suficientes en fase final: usar rangos del algoritmo
  return {
    min: priceFloor(base, RATES.SMALL_SPIKE.POST_PEAK_MIN),
    max: priceCeil(base, RATES.SMALL_SPIKE.POST_PEAK_MAX)
  };
}
