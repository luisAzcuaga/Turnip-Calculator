// Utilidades compartidas para los patrones de precios
// Funciones auxiliares usadas por múltiples patrones

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
    return 6; // Default: miércoles PM (período típico)
  }

  // Buscar el primer precio que sube significativamente desde fase baja
  for (let i = 1; i < knownPrices.length; i++) {
    const current = knownPrices[i];
    const previous = knownPrices[i - 1];

    // Detectar subida significativa (transición a fase de pico)
    if (current.price > previous.price * 1.3) {
      // Este es probablemente el inicio de la fase de pico
      const estimatedStart = Math.max(minPeakStart, current.index);
      return Math.min(maxPeakStart, estimatedStart);
    }
  }

  // Buscar el precio máximo conocido
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxPriceData = knownPrices.find(p => p.price === maxPrice);

  if (maxPriceData) {
    const baseEstimate = knownPrices[0]?.price || 100;
    const ratio = maxPrice / baseEstimate;

    // Large Spike: pico máximo en 200-600%
    if (isLargeSpike && ratio >= 2.0) {
      // El pico máximo está en peakStart+2
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 2);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }

    // Small Spike: pico máximo en 140-200%
    if (!isLargeSpike && ratio >= 1.4) {
      // El pico máximo está en peakStart+2, +3, o +4
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 3);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }
  }

  // Si hay tendencia decreciente, el pico probablemente ya pasó o está cerca
  const lastKnownIndex = knownPrices[knownPrices.length - 1]?.index || 5;

  // Si estamos en fase baja tardía, asumir que el pico será pronto
  if (lastKnownIndex >= 4) {
    return Math.max(minPeakStart, Math.min(maxPeakStart, lastKnownIndex));
  }

  // Fallback: usar período medio del rango válido
  return Math.floor((minPeakStart + maxPeakStart) / 2);
}
