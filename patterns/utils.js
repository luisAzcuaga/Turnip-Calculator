// Utilidades compartidas para los patrones de precios
// Funciones auxiliares usadas por múltiples patrones
// Usa constantes de constants.js (THRESHOLDS, PERIODS, RATES, DECAY, etc.)

// ============================================================================
// FUNCIONES HELPER DE CÁLCULO DE PRECIOS
// ============================================================================

/**
 * Calcula el precio mínimo usando floor (redondea hacia abajo)
 * Usar para límites inferiores
 */
function priceFloor(basePrice, rate) {
  return Math.floor(basePrice * rate);
}

/**
 * Calcula el precio máximo usando ceil (redondea hacia arriba)
 * Usar para límites superiores
 */
function priceCeil(basePrice, rate) {
  return Math.ceil(basePrice * rate);
}

/**
 * Calcula un precio usando round (redondeo estándar)
 * Usar para estimaciones generales
 */
function priceRound(basePrice, rate) {
  return Math.round(basePrice * rate);
}

/**
 * Calcula el ratio de un precio respecto al precio base
 */
function priceRatio(price, basePrice) {
  return price / basePrice;
}

/**
 * Verifica si un precio está dentro de un rango
 */
function isInRange(price, min, max) {
  return price >= min && price <= max;
}

/**
 * Calcula el mínimo permitido después de una caída del 5%
 * @deprecated Usar isValidRateDrop() para validación correcta basada en rate
 */
function minAfterDrop(previousPrice) {
  return Math.floor(previousPrice * DECAY.WORST_CASE_MULTIPLIER);
}

/**
 * Valida si la caída entre dos precios es válida según el algoritmo del juego.
 * El juego reduce el RATE (no el precio) entre 3-5 puntos porcentuales por período.
 * Usamos truncate porque el juego usa aritmética de enteros internamente.
 *
 * @param {number} previousPrice - Precio del período anterior
 * @param {number} currentPrice - Precio del período actual
 * @param {number} buyPrice - Precio base de compra
 * @returns {{valid: boolean, rateDrop: number}} - Si es válido y cuánto bajó el rate
 */
function isValidRateDrop(previousPrice, currentPrice, buyPrice) {
  const previousRate = previousPrice / buyPrice;
  const currentRate = currentPrice / buyPrice;
  // Truncar a 2 decimales para simular aritmética de enteros del juego
  // Esto evita descartar patrones por errores de precisión flotante
  // Ej: 5.3% → 5% (válido), 6.1% → 6% (inválido)
  const rateDrop = Math.trunc((previousRate - currentRate) * 100) / 100;

  // El rate puede bajar máximo 5 puntos porcentuales (0.05) por período
  return {
    valid: rateDrop <= DECAY.MAX_PER_PERIOD,
    rateDrop: rateDrop
  };
}

/**
 * Calcula el máximo esperado para patrón Decreasing en un período dado
 */
function decreasingMaxForPeriod(basePrice, periodIndex) {
  const rate = RATES.DECREASING.START_MAX - (periodIndex * DECAY.MIN_PER_PERIOD);
  return Math.ceil(basePrice * Math.max(RATES.FLOOR, rate));
}

/**
 * Calcula el mínimo esperado para patrón Decreasing
 */
function decreasingMin(basePrice) {
  return Math.floor(basePrice * RATES.FLOOR);
}

/**
 * Calcula el rango de Large Spike para Lunes AM
 */
function largeSpikeStartRange(basePrice) {
  return {
    min: Math.floor(basePrice * RATES.LARGE_SPIKE.START_MIN),
    max: Math.ceil(basePrice * RATES.LARGE_SPIKE.START_MAX),
  };
}

/**
 * Obtiene el nombre legible de un período
 */
function getPeriodName(periodIndex) {
  return DAYS_CONFIG[periodIndex]?.name || `Período ${periodIndex}`;
}

/**
 * Obtiene el rango de períodos donde puede empezar un pico
 */
function getSpikeStartRange(isLargeSpike) {
  return {
    min: isLargeSpike ? PERIODS.LARGE_SPIKE_PEAK_START_MIN : PERIODS.SMALL_SPIKE_PEAK_START_MIN,
    max: PERIODS.SPIKE_PEAK_START_MAX,
    minName: isLargeSpike ? 'Martes PM' : 'Martes AM',
    maxName: 'Jueves PM',
  };
}

// ============================================================================
// FUNCIONES HELPER DE PROYECCIÓN
// ============================================================================

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

  // Buscar el precio máximo conocido primero (más confiable si existe)
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxPriceData = knownPrices.find(p => p.price === maxPrice);
  const baseEstimate = knownPrices[0]?.price || 100;

  if (maxPriceData) {
    const ratio = maxPrice / baseEstimate;

    // Large Spike: pico máximo en período 3 del pico (200-600%)
    if (isLargeSpike && ratio >= THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
      // El pico máximo está en peakStart+2 (período 3)
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 2);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }

    // Small Spike: pico máximo en período 4 del pico (140-200%)
    if (!isLargeSpike && ratio >= THRESHOLDS.SMALL_SPIKE_MIN) {
      // El pico máximo está en peakStart+3 (período 4 del pico)
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 3);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }
  }

  // Buscar inversión de tendencia: estaba bajando y ahora sube
  // Esto es más confiable que buscar solo una subida grande
  const trendReversal = knownPrices.findIndex((current, i) => {
    if (i < 2) return false; // Necesitamos al menos 3 puntos

    const prev = knownPrices[i - 1];
    const prevPrev = knownPrices[i - 2];

    // Estaba bajando (prevPrev > prev) y ahora sube (current > prev)
    const wasFalling = prevPrev.price > prev.price;
    const nowRising = current.price > prev.price;

    return wasFalling && nowRising;
  });

  if (trendReversal !== -1) {
    // La inversión ocurre en el período actual, el pico empezó en el anterior
    const estimatedStart = Math.max(minPeakStart, knownPrices[trendReversal - 1].index);
    return Math.min(maxPeakStart, estimatedStart);
  }

  // Buscar el primer precio que sube significativamente (>30%)
  const firstSignificantRise = knownPrices.findIndex((current, i) => {
    if (i === 0) return false;

    const previous = knownPrices[i - 1];
    return current.price > previous.price * THRESHOLDS.MODERATE_RISE_MIN;
  });

  if (firstSignificantRise !== -1) {
    const estimatedStart = Math.max(minPeakStart, knownPrices[firstSignificantRise].index);
    return Math.min(maxPeakStart, estimatedStart);
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
