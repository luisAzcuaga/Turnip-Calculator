// Utilidades compartidas para los patrones de precios
// Funciones auxiliares usadas por múltiples patrones
// Usa constantes de constants.js (THRESHOLDS, PERIODS, etc.)

/**
 * Calcula el promedio de caída del rate entre precios conocidos consecutivos.
 * El juego reduce el rate (no el precio) en 3-5 puntos por período.
 *
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @param {number} base - Precio base de compra
 * @returns {number} - Promedio de puntos que baja el rate por período
 */
function calculateAvgRateDrop(knownPrices, base) {
  if (knownPrices.length < 2) {
    return 0;
  }

  const totalDrop = knownPrices.slice(1).reduce((sum, current, i) => {
    const prevRate = knownPrices[i].price / base;
    const currRate = current.price / base;
    const rateDrop = prevRate - currRate;
    return sum + rateDrop;
  }, 0);

  return totalDrop / (knownPrices.length - 1);
}

/**
 * Proyecta un precio futuro basándose en el rate actual y caída promedio del rate.
 *
 * @param {number} lastKnownPrice - Último precio conocido
 * @param {number} base - Precio base de compra
 * @param {number} avgRateDrop - Promedio de caída del rate por período
 * @param {number} periodsAhead - Cuántos períodos hacia adelante proyectar
 * @returns {number} - Precio proyectado
 */
function projectPriceFromRate(lastKnownPrice, base, avgRateDrop, periodsAhead) {
  const lastKnownRate = lastKnownPrice / base;
  const projectedRate = lastKnownRate - (avgRateDrop * periodsAhead);
  return base * projectedRate;
}

/**
 * Detecta dinámicamente dónde empieza la fase de pico en patrones de Spike
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @param {number} minPeakStart - Índice mínimo donde puede empezar el pico
 * @param {number} maxPeakStart - Índice máximo donde puede empezar el pico
 * @param {boolean} isLargeSpike - True si es pico grande, false si es pequeño
 * @returns {number} - Índice estimado donde empieza el pico
 */
function detectSpikePeakStart(knownPrices, minPeakStart, maxPeakStart, isLargeSpike) {
  if (knownPrices.length === 0) {
    return PERIODS.WEDNESDAY_PM; // Default: miércoles PM (período típico)
  }

  // Buscar el primer precio que sube significativamente desde fase baja
  const firstSignificantRise = knownPrices.findIndex((current, i) => {
    if (i === 0) return false;

    const previous = knownPrices[i - 1];
    // Detectar subida significativa (transición a fase de pico)
    return current.price > previous.price * THRESHOLDS.MODERATE_RISE_MIN;
  });

  if (firstSignificantRise !== -1) {
    // Este es probablemente el inicio de la fase de pico
    const estimatedStart = Math.max(minPeakStart, knownPrices[firstSignificantRise].index);
    return Math.min(maxPeakStart, estimatedStart);
  }

  // Buscar el precio máximo conocido
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxPriceData = knownPrices.find(p => p.price === maxPrice);

  if (maxPriceData) {
    const baseEstimate = knownPrices[0]?.price || 100;
    const ratio = maxPrice / baseEstimate;

    // Large Spike: pico máximo en 200-600%
    if (isLargeSpike && ratio >= THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
      // El pico máximo está en peakStart+2
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 2);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }

    // Small Spike: pico máximo en 140-200%
    if (!isLargeSpike && ratio >= THRESHOLDS.SMALL_SPIKE_MIN) {
      // El pico máximo está en peakStart+3 (período 4 del pico)
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 3);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }
  }

  // Si hay tendencia decreciente, el pico probablemente ya pasó o está cerca
  const lastKnownIndex = knownPrices[knownPrices.length - 1]?.index || PERIODS.WEDNESDAY_PM;

  // Si estamos en fase baja tardía, asumir que el pico será pronto
  if (lastKnownIndex >= PERIODS.WEDNESDAY_AM) {
    return Math.max(minPeakStart, Math.min(maxPeakStart, lastKnownIndex));
  }

  // Fallback: usar período medio del rango válido
  return Math.floor((minPeakStart + maxPeakStart) / 2);
}
