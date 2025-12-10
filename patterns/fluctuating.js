// Patrón FLUCTUANTE: alterna entre fases altas y bajas
// Basado en el algoritmo real datamineado del juego (Pattern 0)
// Usa constantes de constants.js (RATES, PERIODS, THRESHOLDS)
//
// Estructura del patrón (12 períodos totales):
// - Fase ALTA 1: 0-6 períodos, precios 90-140%
// - Fase BAJA 1: 2-3 períodos, empieza 60-80%, baja 4-10% por período
// - Fase ALTA 2: variable períodos, precios 90-140%
// - Fase BAJA 2: 3-2 períodos (complemento de BAJA 1), empieza 60-80%, baja 4-10%
// - Fase ALTA 3: resto de períodos, precios 90-140%
//
// REGLA CLAVE: decPhaseLen1 + decPhaseLen2 = 5 períodos SIEMPRE
// - Si BAJA1 tiene 3 períodos → BAJA2 tendrá 2 períodos
// - Si BAJA1 tiene 2 períodos → BAJA2 tendrá 3 períodos
//
// LÓGICA INTELIGENTE:
// - Detecta fases bajas completadas para deducir la longitud de la otra
// - Una vez detectadas ambas fases bajas, predice solo fase ALTA para el resto
// - Esto hace las predicciones MUCHO más precisas cuando hay suficientes datos

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
  if (ratio >= RATES.FLUCTUATING.LOW_PHASE_THRESHOLD) {
    return 'high';
  } else {
    return 'low';
  }
}

/**
 * Detecta las fases de bajada en los precios conocidos
 * @param {Array} knownPrices - Array de precios conocidos ordenados por índice
 * @param {number} base - Precio base de compra
 * @returns {Array} - Array de fases detectadas con {startIndex, length, type}
 */
function detectFluctuatingPhases(knownPrices, base) {
  if (knownPrices.length < 2) return [];

  const phases = [];
  let i = 0;

  while (i < knownPrices.length) {
    const current = knownPrices[i];
    const ratio = current.price / base;

    // Detectar inicio de fase baja (ratio < 85% y bajando)
    if (ratio < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD && i < knownPrices.length - 1) {
      const phaseStart = current.index;
      let phaseLength = 1;
      let j = i + 1;

      // Contar cuántos períodos consecutivos bajan
      while (j < knownPrices.length) {
        const next = knownPrices[j];
        const prev = knownPrices[j - 1];

        // Si el índice no es consecutivo, parar
        if (next.index !== prev.index + 1) break;

        // Si el precio sube significativamente (>5%), terminó la fase baja
        if (next.price > prev.price * THRESHOLDS.SLIGHT_RISE) break;

        // Si está en rango de fase alta (>85%), terminó la fase baja
        if (next.price / base >= RATES.FLUCTUATING.LOW_PHASE_THRESHOLD) break;

        phaseLength++;
        j++;
      }

      // Solo considerar fases bajas de 2 o 3 períodos
      if (phaseLength === 2 || phaseLength === 3) {
        phases.push({
          startIndex: phaseStart,
          length: phaseLength,
          type: 'low'
        });
      }

      i = j;
    } else {
      i++;
    }
  }

  return phases;
}

/**
 * Analiza la estructura completa del patrón Fluctuante
 * @param {Array} knownPrices - Array de precios conocidos ordenados por índice
 * @param {number} base - Precio base de compra
 * @returns {Object} - Estructura detectada con {alta1, baja1, alta2, baja2, alta3}
 */
function analyzeFluctuatingStructure(knownPrices, base) {
  if (knownPrices.length === 0) {
    return null;
  }

  const lowPhases = detectFluctuatingPhases(knownPrices, base);

  if (lowPhases.length === 0) {
    // Sin fases bajas detectadas aún
    // Solo podemos decir que los períodos conocidos son ALTA1
    const lastKnownIndex = Math.max(...knownPrices.map(p => p.index));
    return {
      alta1: { startIndex: 0, endIndex: lastKnownIndex },
      baja1: null,
      alta2: null,
      baja2: null,
      alta3: null
    };
  }

  const baja1 = lowPhases[0];
  const baja1End = baja1.startIndex + baja1.length - 1;

  // ALTA1 = todo lo que viene antes de BAJA1
  const alta1 = {
    startIndex: 0,
    endIndex: baja1.startIndex - 1,
    length: baja1.startIndex
  };

  // Si no hay segunda fase baja detectada
  if (lowPhases.length === 1) {
    const lastKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // Buscar si hay precios después de BAJA1
    const pricesAfterBaja1 = knownPrices.filter(p => p.index > baja1End);

    if (pricesAfterBaja1.length === 0) {
      // No hay datos después de BAJA1
      return {
        alta1,
        baja1: { startIndex: baja1.startIndex, endIndex: baja1End, length: baja1.length },
        alta2: null,
        baja2: null,
        alta3: null
      };
    }

    // Hay datos después de BAJA1, pero no detectamos BAJA2 completa
    // ALTA2 o ALTA3 están en progreso
    return {
      alta1,
      baja1: { startIndex: baja1.startIndex, endIndex: baja1End, length: baja1.length },
      alta2: { startIndex: baja1End + 1, endIndex: lastKnownIndex }, // En progreso
      baja2: null,
      alta3: null
    };
  }

  // Tenemos ambas fases bajas detectadas
  const baja2 = lowPhases[1];
  const baja2End = baja2.startIndex + baja2.length - 1;

  // ALTA2 = períodos entre BAJA1 y BAJA2
  const alta2 = {
    startIndex: baja1End + 1,
    endIndex: baja2.startIndex - 1,
    length: baja2.startIndex - (baja1End + 1)
  };

  // ALTA3 = períodos después de BAJA2 hasta el final (período 11)
  const alta3Length = 7 - alta1.length - alta2.length;
  const alta3 = {
    startIndex: baja2End + 1,
    endIndex: PERIODS.LAST_PERIOD,
    length: alta3Length
  };

  return {
    alta1,
    baja1: { startIndex: baja1.startIndex, endIndex: baja1End, length: baja1.length },
    alta2,
    baja2: { startIndex: baja2.startIndex, endIndex: baja2End, length: baja2.length },
    alta3
  };
}

/**
 * Calcula el rango de precios para el patrón Fluctuating
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 *
 * LÓGICA MEJORADA:
 * - Detecta fases bajas completadas (2 o 3 períodos consecutivos bajando)
 * - Deduce la longitud de la otra fase baja (deben sumar 5 períodos total)
 * - Predice fase ALTA (90-140%) para todo lo que viene después de ambas fases bajas
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

  // Analizar la estructura completa del patrón
  const structure = analyzeFluctuatingStructure(knownPrices, base);

  // Si podemos analizar la estructura, usar predicciones precisas
  if (structure) {
    // Si tenemos estructura completa (ambas fases bajas detectadas)
    if (structure.baja2 && structure.alta3) {
      // Sabemos exactamente dónde está cada fase
      if (periodIndex >= structure.alta3.startIndex) {
        // Estamos en ALTA3
        return {
          min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
        };
      } else if (periodIndex >= structure.baja2.startIndex && periodIndex <= structure.baja2.endIndex) {
        // Estamos en BAJA2
        return {
          min: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MAX)
        };
      } else if (periodIndex >= structure.alta2.startIndex && periodIndex < structure.baja2.startIndex) {
        // Estamos en ALTA2
        return {
          min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
        };
      } else if (periodIndex >= structure.baja1.startIndex && periodIndex <= structure.baja1.endIndex) {
        // Estamos en BAJA1
        return {
          min: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MAX)
        };
      } else if (periodIndex < structure.baja1.startIndex) {
        // Estamos en ALTA1
        return {
          min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
        };
      }
    }

    // Si tenemos BAJA1 pero no BAJA2 completa
    if (structure.baja1 && !structure.baja2) {
      const baja2ExpectedLength = 5 - structure.baja1.length;

      // Buscar si estamos en medio de BAJA2
      const lastPrice = knownPrices[knownPrices.length - 1];
      const lastRatio = lastPrice.price / base;

      if (lastRatio < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD && lastPrice.index > structure.baja1.endIndex) {
        // Estamos en BAJA2 en progreso
        // Calcular dónde empieza y termina BAJA2
        let baja2Start = lastPrice.index;
        for (let i = knownPrices.length - 2; i >= 0; i--) {
          const p = knownPrices[i];
          if (p.price / base < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD && p.index > structure.baja1.endIndex && p.index === baja2Start - 1) {
            baja2Start = p.index;
          } else {
            break;
          }
        }

        const baja2End = baja2Start + baja2ExpectedLength - 1;

        // Predecir según la fase
        if (periodIndex >= baja2Start && periodIndex <= baja2End) {
          // BAJA2
          return {
            min: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MIN),
            max: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MAX)
          };
        } else if (periodIndex > baja2End) {
          // ALTA3 (después de BAJA2)
          return {
            min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
            max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
          };
        }
      }

      // No estamos en BAJA2 aún
      // Si estamos muy tarde (período 10-11) y ya pasó BAJA1 temprano, debe ser ALTA
      if (periodIndex >= PERIODS.SATURDAY_AM && structure.baja1.startIndex <= PERIODS.THURSDAY_AM) {
        return {
          min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
        };
      }
    }
  }

  // Fallback al método anterior
  const lowPhases = detectFluctuatingPhases(knownPrices, base);

  // Si detectamos al menos una fase baja, podemos hacer predicciones más precisas
  if (lowPhases.length > 0) {
    // Regla: decPhaseLen1 + decPhaseLen2 = 5
    const firstPhase = lowPhases[0];
    const secondPhaseExpectedLength = 5 - firstPhase.length; // 2 o 3

    // Determinar si estamos prediciendo un período que está en una fase conocida
    for (const phase of lowPhases) {
      const phaseEnd = phase.startIndex + phase.length - 1;

      // Si estamos dentro de una fase baja conocida, usar rango de fase baja
      if (periodIndex >= phase.startIndex && periodIndex <= phaseEnd) {
        return {
          min: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MAX)
        };
      }
    }

    // Si tenemos 2 fases bajas detectadas, todo lo demás es fase ALTA
    if (lowPhases.length >= 2) {
      const lastPhase = lowPhases[lowPhases.length - 1];
      const lastPhaseEnd = lastPhase.startIndex + lastPhase.length - 1;

      // Si estamos después de la segunda fase baja, debe ser fase ALTA
      if (periodIndex > lastPhaseEnd) {
        return {
          min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
        };
      }
    }

    // Si solo tenemos 1 fase baja, buscar si estamos EN MEDIO de la segunda fase baja
    if (lowPhases.length === 1) {
      const lastKnownIndex = Math.max(...knownPrices.map(p => p.index));
      const firstPhaseEnd = firstPhase.startIndex + firstPhase.length - 1;

      // MEJORA: Detectar si estamos en medio de BAJA2
      // Buscar el último precio conocido y ver si está en fase baja
      if (knownPrices.length >= 2) {
        const lastPrice = knownPrices[knownPrices.length - 1];
        const lastRatio = lastPrice.price / base;

        // Si el último precio está en fase baja (<85%) y viene DESPUÉS de BAJA1
        if (lastRatio < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD && lastPrice.index > firstPhaseEnd) {
          // Buscar cuántos períodos llevamos en esta nueva fase baja
          let baja2StartIndex = lastPrice.index;
          let baja2CurrentLength = 1;

          // Retroceder para encontrar el inicio de BAJA2
          for (let i = knownPrices.length - 2; i >= 0; i--) {
            const prevPrice = knownPrices[i];
            const prevRatio = prevPrice.price / base;

            // Si el anterior también está en fase baja y es consecutivo
            if (prevRatio < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD && prevPrice.index === baja2StartIndex - 1 && prevPrice.index > firstPhaseEnd) {
              baja2StartIndex = prevPrice.index;
              baja2CurrentLength++;
            } else {
              break;
            }
          }

          // Estamos en BAJA2, predecir los períodos restantes
          const baja2ExpectedEnd = baja2StartIndex + secondPhaseExpectedLength - 1;

          // Si estamos prediciendo un período dentro de BAJA2
          if (periodIndex >= baja2StartIndex && periodIndex <= baja2ExpectedEnd) {
            return {
              min: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MIN),
              max: Math.round(base * RATES.FLUCTUATING.LOW_PHASE_MAX)
            };
          }

          // Si estamos prediciendo después de BAJA2, debe ser ALTA3
          if (periodIndex > baja2ExpectedEnd) {
            return {
              min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
              max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
            };
          }
        }
      }

      // Estrategia conservadora: usar rango completo si no estamos seguros
      // pero si estamos MUY tarde en la semana (período 10-11) y ya vimos
      // una fase baja completa, es muy probable que sea fase ALTA
      if (periodIndex >= PERIODS.SATURDAY_AM && firstPhase.startIndex <= PERIODS.THURSDAY_AM) {
        // Ya vimos la primera fase baja temprano, estamos en sábado
        // Es muy probable que ya pasaron ambas fases bajas
        return {
          min: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MIN),
          max: Math.round(base * RATES.FLUCTUATING.HIGH_PHASE_MAX)
        };
      }
    }
  }

  // Sin suficiente información: usar rango completo del algoritmo
  // El patrón Fluctuante es aleatorio - puede estar en cualquier punto del rango
  // Rango: 60-140% del precio base
  return {
    min: Math.round(base * RATES.FLUCTUATING.MIN),
    max: Math.round(base * RATES.FLUCTUATING.MAX)
  };
}
