// Patrón DECRECIENTE: bajada constante
// Basado en el algoritmo real datamineado del juego (Pattern 2)
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
function calculateDecreasingPattern(periodIndex, base, knownPrices = []) {
  // Si tenemos datos conocidos, estimar la tasa de decrecimiento real
  if (knownPrices.length >= 2) {
    // Calcular tasa de decrecimiento promedio entre precios conocidos
    let totalRate = 0;
    for (let i = 1; i < knownPrices.length; i++) {
      const prevPrice = knownPrices[i - 1].price;
      const currPrice = knownPrices[i].price;
      const rate = (prevPrice - currPrice) / prevPrice;
      totalRate += rate;
    }
    const avgDecayRate = totalRate / (knownPrices.length - 1);

    // Proyectar desde el último precio conocido
    const lastKnown = knownPrices[knownPrices.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;

    if (periodsAhead > 0) {
      const projected = lastKnown.price * Math.pow(1 - avgDecayRate, periodsAhead);
      return {
        min: Math.round(projected * 0.95),
        max: Math.round(projected * 1.05)
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
  // Tasa inicial: 0.85-0.90 (promedio: 0.875)
  // Decrecimiento por período: 0.03-0.05 (promedio: 0.04)

  // Calcular el precio para este período usando el algoritmo
  // rate = initialRate - (periodIndex * decayPerPeriod)
  const initialRate = 0.875; // Promedio de 0.85-0.90
  const minDecayPerPeriod = 0.03;
  const maxDecayPerPeriod = 0.05;

  // Calcular rango mínimo y máximo
  const minRate = Math.max(0.40, (0.85 - (periodIndex * maxDecayPerPeriod)));
  const maxRate = Math.max(0.40, (0.90 - (periodIndex * minDecayPerPeriod)));

  return {
    min: Math.round(base * minRate),
    max: Math.round(base * maxRate)
  };
}
