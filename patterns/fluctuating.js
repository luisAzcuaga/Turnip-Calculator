// Patrón FLUCTUANTE: variable, 60-140%
// TODO: Actualizar con algoritmo real del juego en Fase 3

/**
 * Calcula la volatilidad de los precios conocidos
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {number} - Volatilidad como porcentaje
 */
function calculateVolatility(knownPrices) {
  if (knownPrices.length < 2) return 0;

  const prices = knownPrices.map(p => p.price);
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const squaredDiffs = prices.map(p => Math.pow(p - avg, 2));
  const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;
  const stdDev = Math.sqrt(variance);

  return (stdDev / avg) * 100; // Volatilidad como porcentaje
}

/**
 * Calcula el rango de precios para el patrón Fluctuating
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
function calculateFluctuatingPattern(periodIndex, base, knownPrices = []) {
  // Calcular volatilidad para ajustar rangos
  const volatility = calculateVolatility(knownPrices);

  // Ajustar rangos según volatilidad observada
  let minMultiplier = 0.60;
  let maxMultiplier = 1.40;

  if (volatility > 0) {
    if (volatility < 10) {
      // Baja volatilidad: rangos más estrechos
      minMultiplier = 0.70;
      maxMultiplier = 1.20;
    } else if (volatility > 20) {
      // Alta volatilidad: rangos más amplios
      minMultiplier = 0.50;
      maxMultiplier = 1.50;
    }
    // Volatilidad media (10-20%): usar rangos por defecto (0.60-1.40)
  }

  // Si tenemos datos recientes, proyectar basándose en la última tendencia
  if (knownPrices.length > 0) {
    const lastKnown = knownPrices[knownPrices.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;

    if (periodsAhead > 0 && periodsAhead <= 2) {
      // Proyección de corto plazo: usar último precio como referencia
      const avgPrice = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
      const refPrice = (lastKnown.price + avgPrice) / 2; // Promedio entre último y media

      return {
        min: Math.round(refPrice * 0.85),
        max: Math.round(refPrice * 1.15)
      };
    }
  }

  // Fallback: usar rangos ajustados por volatilidad
  return {
    min: Math.round(base * minMultiplier),
    max: Math.round(base * maxMultiplier)
  };
}
