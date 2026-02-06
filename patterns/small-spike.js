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
export default function calculateSmallSpikePattern(periodIndex, base, knownPrices = []) {
  // peakStart puede ser 1-7 según el algoritmo del juego (Lunes PM a Jueves PM)
  const peakStart = detectSpikePeakStart(knownPrices, PERIODS.SMALL_SPIKE_PEAK_START_MIN, PERIODS.SPIKE_PEAK_START_MAX, false, base);

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

    // Obtener precios conocidos de períodos específicos del pico
    const period3Price = knownPrices.find(p => p.index === peakStart + 2);
    const period4Price = knownPrices.find(p => p.index === peakStart + 3);
    const period5Price = knownPrices.find(p => p.index === peakStart + 4);

    // Inferir el rate SOLO cuando tengamos datos precisos
    // Período 4 define el rate exacto
    // Períodos 3 y 5 nos dan una pista del rate (son rate - 1)
    let inferredRate = null;

    if (period4Price) {
      // Si vimos el período 4, sabemos el rate exacto
      inferredRate = period4Price.price / base;
    } else if (period3Price || period5Price) {
      // Si vimos período 3 o 5, podemos inferir el rate con buena precisión
      // Período 3/5 = (1.4 a rate) - 1, entonces rate >= (precio + 1) / base
      const knownPeriod = period3Price || period5Price;
      inferredRate = (knownPeriod.price + 1) / base;
      // Asegurar que esté en el rango válido (1.4-2.0)
      inferredRate = Math.max(RATES.SMALL_SPIKE.PEAK_RATE_MIN, Math.min(RATES.SMALL_SPIKE.PEAK_RATE_MAX, inferredRate));
    }
    // Si solo tenemos períodos 1 y/o 2, NO inferir el rate (no hay suficiente info)

    // Rangos según el algoritmo exacto del juego
    if (peakPhaseIndex === 0 || peakPhaseIndex === 1) {
      // Períodos 1 y 2: 0.9-1.4
      return {
        min: priceFloor(base, RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MIN),
        max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_PHASE_INITIAL_MAX)
      };
    } else if (peakPhaseIndex === 3) {
      // Período 4: PICO REAL (rate * base) - SIN varianza, es el rate exacto

      // Si ya vimos el período 4, usar ese valor exacto
      if (period4Price) {
        return {
          min: period4Price.price,
          max: period4Price.price
        };
      }

      // Si vimos el período 3, sabemos que período 4 >= período 3 + 1
      if (period3Price) {
        return {
          min: period3Price.price + 1,
          max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_RATE_MAX)
        };
      }

      // Si vimos el período 5, podemos inferir el rate y mostrar valor exacto
      if (period5Price && inferredRate) {
        const exactPrice = Math.round(base * inferredRate);
        return {
          min: exactPrice,
          max: exactPrice
        };
      }

      // Sin datos suficientes: rango teórico completo
      return {
        min: priceFloor(base, RATES.SMALL_SPIKE.PEAK_RATE_MIN),
        max: priceCeil(base, RATES.SMALL_SPIKE.PEAK_RATE_MAX)
      };
    } else {
      // Períodos 3 y 5: (1.4 a rate) * base - 1 bell

      // Si tenemos el rate inferido (de período 4), usarlo para acotar el rango
      if (inferredRate && period4Price) {
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.ceil(base * inferredRate - 1)
        };
      }

      // Si vimos el período 3 o 5 (el otro), usar ese precio como referencia
      if (peakPhaseIndex === 2 && period5Price) {
        // Estamos calculando período 3, pero ya vimos período 5
        // Ambos usan la misma fórmula, así que pueden ser similares
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.max(period5Price.price, Math.ceil(base * inferredRate - 1))
        };
      }

      if (peakPhaseIndex === 4 && period3Price) {
        // Estamos calculando período 5, pero ya vimos período 3
        return {
          min: Math.floor(base * RATES.SMALL_SPIKE.PEAK_RATE_MIN - 1),
          max: Math.max(period3Price.price, Math.ceil(base * inferredRate - 1))
        };
      }

      // Sin datos suficientes: rango teórico completo
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
