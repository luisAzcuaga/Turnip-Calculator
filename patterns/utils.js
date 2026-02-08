import { DAYS_CONFIG, DECAY, PERIODS, RATES, THRESHOLDS } from "../constants.js";

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
export function priceFloor(basePrice, rate) {
  return Math.floor(basePrice * rate);
}

/**
 * Calcula el precio máximo usando ceil (redondea hacia arriba)
 * Usar para límites superiores
 */
export function priceCeil(basePrice, rate) {
  return Math.ceil(basePrice * rate);
}

/**
 * Calcula el ratio de un precio respecto al precio base
 */
export function priceRatio(price, basePrice) {
  return price / basePrice;
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
export function isValidRateDrop(previousPrice, currentPrice, buyPrice) {
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
export function decreasingMaxForPeriod(basePrice, periodIndex) {
  const rate = RATES.DECREASING.START_MAX - (periodIndex * DECAY.MIN_PER_PERIOD);
  return Math.ceil(basePrice * Math.max(RATES.FLOOR, rate));
}

/**
 * Calcula el mínimo esperado para patrón Decreasing
 */
export function decreasingMin(basePrice) {
  return Math.floor(basePrice * RATES.FLOOR);
}

/**
 * Calcula el rango de Large Spike para Lunes AM
 */
export function largeSpikeStartRange(basePrice) {
  return {
    min: Math.floor(basePrice * RATES.LARGE_SPIKE.START_MIN),
    max: Math.ceil(basePrice * RATES.LARGE_SPIKE.START_MAX),
  };
}

/**
 * Obtiene el nombre legible de un período
 */
export function getPeriodName(periodIndex) {
  return DAYS_CONFIG[periodIndex]?.name || `Período ${periodIndex}`;
}

/**
 * Obtiene el rango de períodos donde puede empezar un pico
 */
export function getSpikeStartRange(isLargeSpike) {
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
export function calculateAvgRateDrop(knownPrices, base) {
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
export function projectPriceFromRate(lastKnownPrice, base, avgRateDrop, periodsAhead) {
  const lastKnownRate = lastKnownPrice / base;
  const projectedRate = lastKnownRate - (avgRateDrop * periodsAhead);
  return base * projectedRate;
}

/**
 * Detecta el inicio del pico buscando inversiones de tendencia o subidas significativas
 * @param {Array} prices - Array de precios (puede ser simple array de números o array de objetos con .price)
 * @param {number} buyPrice - Precio base de compra
 * @returns {{detected: boolean, startIndex: number}} - Si se detectó y en qué índice
 */
export function detectSpikeStart(prices, buyPrice) {
  if (!prices || prices.length < 2) {
    return { detected: false, startIndex: -1 };
  }

  // Normalizar el array (puede venir como números o como {price: X})
  const pricesArray = prices.map(p => typeof p === 'object' ? p.price : p);

  // Método principal: Buscar inversión de tendencia (estaba bajando → ahora sube)
  // Esto detecta correctamente picos que empiezan con subidas pequeñas (<10%)
  for (let i = 1; i < pricesArray.length; i++) {
    if (pricesArray[i] > pricesArray[i - 1]) {
      // Verificar si antes estaba bajando
      if (i >= 2 && pricesArray[i - 2] > pricesArray[i - 1]) {
        // Inversión de tendencia detectada
        return { detected: true, startIndex: i };
      }
      // Si es la primera subida después del inicio y estaba bajo
      if (i === 1 && pricesArray[i - 1] < buyPrice) {
        return { detected: true, startIndex: i };
      }
    }
  }

  // Método fallback: Buscar subida significativa >10%
  // Se usa cuando no hay inversión de tendencia clara (ej: primer dato ya está subiendo)
  for (let i = 1; i < pricesArray.length; i++) {
    if (pricesArray[i] > pricesArray[i - 1] * THRESHOLDS.SIGNIFICANT_RISE) {
      return { detected: true, startIndex: i };
    }
  }

  return { detected: false, startIndex: -1 };
}

/**
 * Detecta dinámicamente dónde empieza la fase de pico en patrones de Spike
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @param {number} minPeakStart - Índice mínimo donde puede empezar el pico
 * @param {number} maxPeakStart - Índice máximo donde puede empezar el pico
 * @param {boolean} isLargeSpike - True si es pico grande, false si es pequeño
 * @param {number} buyPrice - Precio base de compra
 * @returns {number} - Índice estimado donde empieza el pico
 */
export function detectSpikePeakStart(knownPrices, minPeakStart, maxPeakStart, isLargeSpike, buyPrice) {
  if (knownPrices.length === 0) {
    return PERIODS.WEDNESDAY_PM; // Default: miércoles PM (período típico)
  }

  // Buscar el precio máximo conocido
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxPriceData = knownPrices.find(p => p.price === maxPrice);
  const maxPriceIndex = maxPriceData?.index ?? -1;

  // Verificar si hay precios DESPUÉS del máximo que estén bajando
  // Esto confirma que el pico ya ocurrió
  const pricesAfterMax = knownPrices.filter(p => p.index > maxPriceIndex);
  const hasDecliningPricesAfterMax = pricesAfterMax.length > 0 &&
    pricesAfterMax.some(p => p.price < maxPrice * 0.95); // Bajó al menos 5%

  // PRIORIDAD 1: Si el pico ya pasó (precios bajando después del máximo),
  // usar el máximo como referencia para calcular peakStart
  if (maxPriceData && hasDecliningPricesAfterMax) {
    const ratio = maxPrice / buyPrice;

    // Large Spike: pico máximo en período 3 del pico (200-600%)
    if (isLargeSpike && ratio >= THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 2);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }

    // Small Spike: pico máximo en período 4 del pico (140-200%)
    if (!isLargeSpike && ratio >= THRESHOLDS.SMALL_SPIKE_MIN) {
      const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 3);
      return Math.min(maxPeakStart, estimatedPeakStart);
    }
  }

  // PRIORIDAD 2: Buscar inversión de tendencia: estaba bajando y ahora sube
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
    // La inversión ocurre en el período actual, ese es el inicio del pico (Período 1 = 90-140%)
    const estimatedStart = Math.max(minPeakStart, knownPrices[trendReversal].index);
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

/**
 * Detecta secuencia Período 1 (90-140%) → Período 2 (140-200%) de Large Spike
 * @param {Array} knownPrices - Array de precios conocidos con índices
 * @param {number} buyPrice - Precio base de compra
 * @returns {Object} - { detected, period1, period2, hasPricesAfter } o { detected: false }
 */
export function detectLargeSpikeSequence(knownPrices, buyPrice) {
  if (knownPrices.length < 2) return { detected: false };

  const p1Range = RATES.LARGE_SPIKE.PEAK_PHASES[0]; // 90-140%
  const p2Range = RATES.LARGE_SPIKE.PEAK_PHASES[1]; // 140-200%

  // Buscar precio en rango P2 (140-200%) con precio anterior en rango P1 (90-140%)
  for (const current of knownPrices) {
    const rate = current.price / buyPrice;

    if (rate >= p2Range.min && rate < p2Range.max) {
      const previousPeriod = knownPrices.find(p => p.index === current.index - 1);

      if (previousPeriod) {
        const prevRate = previousPeriod.price / buyPrice;

        if (prevRate >= p1Range.min && prevRate < p1Range.max) {
          const pricesAfter = knownPrices.filter(p => p.index > current.index);
          return {
            detected: true,
            period1: { price: previousPeriod.price, rate: prevRate, index: previousPeriod.index },
            period2: { price: current.price, rate: rate, index: current.index, day: getPeriodName(current.index) },
            hasPricesAfter: pricesAfter.length > 0
          };
        }
      }
    }
  }

  return { detected: false };
}
