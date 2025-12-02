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
 *
 * FILOSOFÍA: Fluctuante es aleatorio por definición.
 * No tiene sentido "predecir" usando tendencias o promedios.
 * Cualquier precio entre 60-140% puede ocurrir en cualquier momento.
 */
function calculateFluctuatingPattern(periodIndex, base, knownPrices = []) {
  // Validación defensiva: si no hay precio base, no podemos predecir
  if (!base || base < BUY_PRICE_MIN || base > BUY_PRICE_MAX) {
    console.warn('Fluctuating pattern: precio base inválido', base);
    return { min: 0, max: 0 };
  }

  // Si tenemos un precio conocido para este período exacto, devolverlo
  const knownPrice = knownPrices.find(p => p.index === periodIndex);
  if (knownPrice) {
    return {
      min: knownPrice.price,
      max: knownPrice.price
    };
  }

  // Para todos los períodos desconocidos: rango completo del algoritmo
  // El patrón Fluctuante es aleatorio - puede estar en cualquier punto del rango
  // en cualquier momento, sin importar qué pasó antes.
  // Rango: 60-140% del precio base
  return {
    min: Math.round(base * 0.60),
    max: Math.round(base * 1.40)
  };
}
