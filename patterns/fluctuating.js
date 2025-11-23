// Patrón FLUCTUANTE: alterna entre fases altas y bajas
// Basado en el algoritmo real datamineado del juego (Pattern 0)
//
// Estructura del patrón (12 períodos totales):
// - Fase ALTA 1: 0-6 períodos, precios 90-140%
// - Fase BAJA 1: 2-3 períodos, empieza 60-80%, baja 4-10% por período
// - Fase ALTA 2: variable períodos, precios 90-140%
// - Fase BAJA 2: 3-2 períodos (complemento de BAJA 1), empieza 60-80%, baja 4-10%
// - Fase ALTA 3: resto de períodos, precios 90-140%
//
// Nota: Las longitudes exactas de las fases son aleatorias en cada semana,
// por lo que sin conocer el patrón exacto, debemos usar rangos amplios.

/**
 * Detecta si el precio actual está en fase alta o baja
 * @param {number} price - Precio actual
 * @param {number} base - Precio base
 * @returns {string} - 'high' o 'low'
 */
function detectPhase(price, base) {
  const ratio = price / base;
  // Fase alta: 90-140%
  // Fase baja: 60-80% (y bajando)
  if (ratio >= 0.85) {
    return 'high';
  } else {
    return 'low';
  }
}

/**
 * Calcula el rango de precios para el patrón Fluctuating
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
function calculateFluctuatingPattern(periodIndex, base, knownPrices = []) {
  // Si tenemos datos recientes, intentar detectar la fase actual
  if (knownPrices.length > 0) {
    const lastKnown = knownPrices[knownPrices.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;

    if (periodsAhead === 0) {
      // Mismo período, devolver el precio conocido
      return {
        min: lastKnown.price,
        max: lastKnown.price
      };
    }

    if (periodsAhead > 0 && periodsAhead <= 2) {
      const lastPhase = detectPhase(lastKnown.price, base);

      if (lastPhase === 'high') {
        // Si estamos en fase alta, el siguiente período podría:
        // 1) Seguir alto (90-140%)
        // 2) Empezar a bajar (60-80%)
        // Usar rango amplio que cubra ambas posibilidades
        return {
          min: Math.round(base * 0.60),
          max: Math.round(base * 1.40)
        };
      } else {
        // Si estamos en fase baja, podría:
        // 1) Seguir bajando (4-10% menos)
        // 2) Volver a fase alta (90-140%)

        // Proyectar bajada desde el último conocido
        const projectedLow = lastKnown.price * 0.90; // Baja ~10%

        return {
          min: Math.round(Math.max(base * 0.40, projectedLow * 0.85)),
          max: Math.round(base * 1.40) // Podría subir a fase alta
        };
      }
    }

    // Para predicciones a más largo plazo, analizar la tendencia general
    if (knownPrices.length >= 2) {
      const recentPrices = knownPrices.slice(-3); // Últimos 3 precios
      const avgRecent = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;

      // Usar el promedio reciente como referencia
      return {
        min: Math.round(avgRecent * 0.70),
        max: Math.round(avgRecent * 1.30)
      };
    }
  }

  // Sin datos conocidos: usar rangos completos del algoritmo
  // Fases altas: 90-140%
  // Fases bajas: 40-80% (considerando el decrecimiento)
  return {
    min: Math.round(base * 0.60),
    max: Math.round(base * 1.40)
  };
}
