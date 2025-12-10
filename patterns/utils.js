// Utilidades compartidas para los patrones de precios
// Funciones auxiliares usadas por múltiples patrones
// Usa constantes de constants.js (THRESHOLDS, PERIODS, etc.)

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
