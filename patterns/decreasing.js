// Patrón DECRECIENTE: bajada constante del 90% al 40%
// TODO: Actualizar con algoritmo real del juego en Fase 3

/**
 * Calcula el rango de precios para el patrón Decreasing
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
function calculateDecreasingPattern(periodIndex, base, knownPrices = []) {
  // Si tenemos datos conocidos, calcular la tasa real observada
  let observedRate = null;
  if (knownPrices.length >= 2) {
    // Calcular tasa de decrecimiento promedio entre precios conocidos
    let totalRateChange = 0;
    let rateCount = 0;

    for (let i = 1; i < knownPrices.length; i++) {
      const prevPrice = knownPrices[i - 1].price;
      const currPrice = knownPrices[i].price;
      const rateChange = (prevPrice - currPrice) / prevPrice;
      totalRateChange += rateChange;
      rateCount++;
    }

    observedRate = totalRateChange / rateCount;
  }

  // Si estamos prediciendo un período para el cual ya pasamos datos conocidos,
  // usar la tasa observada para proyectar
  if (observedRate !== null && knownPrices.length > 0) {
    const lastKnown = knownPrices[knownPrices.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;

    if (periodsAhead > 0) {
      // Proyectar desde el último precio conocido
      const projected = lastKnown.price * Math.pow(1 - observedRate, periodsAhead);
      return {
        min: Math.round(projected * 0.90),
        max: Math.round(projected * 1.10)
      };
    }
  }

  // Fallback: usar tasa conservadora por defecto
  const rate = 0.90 - (periodIndex * 0.025);
  const price = Math.round(base * Math.max(0.40, rate));

  return {
    min: Math.round(price * 0.90),
    max: Math.round(price * 1.05)
  };
}
