// Patrón PICO PEQUEÑO: similar al grande pero pico menor (140-200%)
// Basado en el algoritmo real datamineado del juego (Pattern 3)

/**
 * Calcula el rango de precios para el patrón Small Spike
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
function calculateSmallSpikePattern(periodIndex, base, knownPrices = []) {
  // peakStart puede ser 2-9 según el algoritmo del juego
  const peakStart = detectSpikePeakStart(knownPrices, 2, 9, false);

  // Fase 1: DECRECIENTE (períodos 0 hasta peakStart-1)
  // Empieza en 40-90%, baja 3-5% cada período
  if (periodIndex < peakStart) {
    const decreasingPhase = knownPrices.filter(p => p.index < peakStart);

    if (decreasingPhase.length >= 2) {
      // Calcular tasa de decrecimiento observada
      const avgRate = decreasingPhase.slice(1).reduce((totalRate, current, i) => {
        const rate = (decreasingPhase[i].price - current.price) / decreasingPhase[i].price;
        return totalRate + rate;
      }, 0) / (decreasingPhase.length - 1);

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
    const initialRate = 0.65; // Promedio de 0.40-0.90
    const decayPerPeriod = 0.04; // Promedio de 0.03-0.05
    const rate = Math.max(0.40, initialRate - (periodIndex * decayPerPeriod));
    const price = base * rate;

    return {
      min: Math.round(price * 0.80),
      max: Math.round(price * 1.20)
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
      inferredRate = Math.max(1.4, Math.min(2.0, inferredRate));
    }

    // Rangos según el algoritmo exacto del juego
    if (peakPhaseIndex === 0 || peakPhaseIndex === 1) {
      // Períodos 1 y 2: 0.9-1.4
      return {
        min: Math.round(base * 0.90),
        max: Math.round(base * 1.40)
      };
    } else if (peakPhaseIndex === 3) {
      // Período 4: PICO REAL (rate * base)
      if (inferredRate) {
        return {
          min: Math.round(base * inferredRate * 0.95),
          max: Math.round(base * inferredRate * 1.05)
        };
      }
      return {
        min: Math.round(base * 1.40),
        max: Math.round(base * 2.00)
      };
    } else {
      // Períodos 3 y 5: (1.4 a rate) * base - 1 bell
      if (inferredRate) {
        return {
          min: Math.round(base * 1.40 - 1),
          max: Math.round(base * inferredRate - 1)
        };
      }
      return {
        min: Math.round(base * 1.40 - 1),
        max: Math.round(base * 2.00 - 1)
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
        min: Math.round(projected * 0.90),
        max: Math.round(projected * 1.10)
      };
    }
  }

  // Sin datos suficientes en fase final: usar rangos del algoritmo
  return {
    min: Math.round(base * 0.40),
    max: Math.round(base * 0.90)
  };
}
