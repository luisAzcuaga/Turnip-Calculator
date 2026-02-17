import { BUY_PRICE_MAX, BUY_PRICE_MIN, PERIODS, RATES, THRESHOLDS } from "../constants.js";
import { priceCeil, priceFloor } from "./utils.js";

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

/**
 * Detecta las fases de bajada en los precios conocidos
 * @param {Array} knownPrices - Array de precios conocidos ordenados por índice
 * @param {number} base - Precio base de compra
 * @returns {Array} - Array de fases detectadas con {startIndex, length}
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
        phases.push({ startIndex: phaseStart, length: phaseLength });
      }

      i = j;
    } else {
      i++;
    }
  }

  return phases;
}

/**
 * Verifica si un período cae dentro de una fase dada
 */
function isInPhase(periodIndex, phase) {
  return phase && periodIndex >= phase.startIndex && periodIndex <= phase.endIndex;
}

/**
 * Detecta si BAJA2 está en progreso basándose en los últimos precios conocidos
 * @param {Array} knownPrices - Precios conocidos ordenados por índice
 * @param {number} base - Precio base de compra
 * @param {Object} baja1 - Fase baja 1 detectada con {startIndex, endIndex}
 * @param {number} baja2ExpectedLength - Longitud esperada de BAJA2 (5 - baja1Length)
 * @returns {Object|null} - {startIndex, endIndex} de BAJA2 si detectada, null si no
 */
function detectBaja2InProgress(knownPrices, base, baja1, baja2ExpectedLength) {
  if (knownPrices.length < 2) return null;

  const lastPrice = knownPrices[knownPrices.length - 1];
  if (lastPrice.price / base >= RATES.FLUCTUATING.LOW_PHASE_THRESHOLD || lastPrice.index <= baja1.endIndex) {
    return null;
  }

  // Retroceder para encontrar el inicio de BAJA2
  let baja2Start = lastPrice.index;
  for (let i = knownPrices.length - 2; i >= 0; i--) {
    const p = knownPrices[i];
    if (p.price / base < RATES.FLUCTUATING.LOW_PHASE_THRESHOLD &&
        p.index > baja1.endIndex &&
        p.index === baja2Start - 1) {
      baja2Start = p.index;
    } else {
      break;
    }
  }

  return { startIndex: baja2Start, endIndex: baja2Start + baja2ExpectedLength - 1 };
}

/**
 * Analiza la estructura completa del patrón Fluctuante
 * @param {Array} knownPrices - Array de precios conocidos ordenados por índice
 * @param {number} base - Precio base de compra
 * @returns {Object|null} - Estructura detectada con {baja1, baja2} o null
 */
function analyzeFluctuatingStructure(knownPrices, base) {
  if (knownPrices.length === 0) return null;

  const lowPhases = detectFluctuatingPhases(knownPrices, base);

  if (lowPhases.length === 0) return { baja1: null, baja2: null };

  const baja1 = lowPhases[0];
  const baja1End = baja1.startIndex + baja1.length - 1;
  const baja1Phase = { startIndex: baja1.startIndex, endIndex: baja1End };

  if (lowPhases.length === 1) {
    return { baja1: baja1Phase, baja2: null };
  }

  const baja2 = lowPhases[1];
  const baja2End = baja2.startIndex + baja2.length - 1;

  return {
    baja1: baja1Phase,
    baja2: { startIndex: baja2.startIndex, endIndex: baja2End }
  };
}

/**
 * Calcula el rango de precios para el patrón Fluctuating
 * @param {number} periodIndex - Índice del período (0-11)
 * @param {number} base - Precio base de compra
 * @param {Array} knownPrices - Array de precios conocidos con {index, price}
 * @returns {{min: number, max: number}} - Rango de precios
 */
export default function calculateFluctuatingPattern(periodIndex, base, knownPrices = []) {
  // Validación defensiva: si no hay precio base, no podemos predecir
  if (!base || base < BUY_PRICE_MIN || base > BUY_PRICE_MAX) {
    console.warn('Fluctuating pattern: Precio base inválido', base);
    return { min: 0, max: 0 };
  }

  // Si tenemos un precio conocido para este período exacto, devolverlo
  const knownPrice = knownPrices.find(p => p.index === periodIndex);
  if (knownPrice) {
    return { min: knownPrice.price, max: knownPrice.price };
  }

  const LOW = {
    min: priceFloor(base, RATES.FLUCTUATING.LOW_PHASE_MIN),
    max: priceCeil(base, RATES.FLUCTUATING.LOW_PHASE_MAX)
  };
  const HIGH = {
    min: priceFloor(base, RATES.FLUCTUATING.HIGH_PHASE_MIN),
    max: priceCeil(base, RATES.FLUCTUATING.HIGH_PHASE_MAX)
  };

  // Analizar estructura y predecir según fase detectada
  const structure = analyzeFluctuatingStructure(knownPrices, base);

  if (structure && structure.baja1) {
    // Estructura completa: ambas fases bajas detectadas
    if (structure.baja2) {
      if (isInPhase(periodIndex, structure.baja1) || isInPhase(periodIndex, structure.baja2)) {
        return LOW;
      }
      return HIGH;
    }

    // Estructura parcial: solo BAJA1 detectada
    if (isInPhase(periodIndex, structure.baja1)) {
      return LOW;
    }

    const baja1Length = structure.baja1.endIndex - structure.baja1.startIndex + 1;
    const baja2 = detectBaja2InProgress(knownPrices, base, structure.baja1, 5 - baja1Length);

    if (baja2) {
      if (isInPhase(periodIndex, baja2)) return LOW;
      if (periodIndex > baja2.endIndex) return HIGH;
    }

    // Si estamos muy tarde y ya pasó BAJA1 temprano, debe ser ALTA
    if (periodIndex >= PERIODS.SATURDAY_AM && structure.baja1.startIndex <= PERIODS.THURSDAY_AM) {
      return HIGH;
    }
  }

  // Sin suficiente información: usar rango completo (60-140%)
  return {
    min: priceFloor(base, RATES.FLUCTUATING.MIN),
    max: priceCeil(base, RATES.FLUCTUATING.MAX)
  };
}
