import { DAYS_CONFIG, PATTERNS, PATTERN_NAMES, PRICE_INPUT_IDS, RATES } from "../constants.js";
import { detectSpikeStart } from "../patterns/utils.js";

// Build HTML for the probability distribution panel
export function buildProbabilityPanelHTML(patternName, allProbabilities) {
  let html = `<div class="probability-distribution">
    <h4>Todos los Patrones Posibles</h4>
    <div class="probability-list">`;

  const patternsWithProb = Object.values(PATTERNS).map(key => ({
    key,
    name: PATTERN_NAMES[key],
    percentage: allProbabilities[key] || 0,
    isPrimary: PATTERN_NAMES[key] === patternName
  }));

  patternsWithProb.sort((a, b) => b.percentage - a.percentage);

  patternsWithProb.forEach(p => {
    const itemClass = p.isPrimary ? 'probability-item primary-pattern' : 'probability-item';
    const badge = p.isPrimary ? '<span class="primary-badge">MÁS PROBABLE</span>' : '';

    html += `
      <div class="${itemClass}">
        <div class="probability-header-row">
          <span class="probability-name">${p.name}</span>
          ${badge}
        </div>
        <div class="probability-bar-container">
          <div class="probability-bar-fill" style="width: ${p.percentage}%"></div>
          <span class="probability-value">${p.percentage}%</span>
        </div>
      </div>
    `;
  });

  html += `</div>
    <p class="probability-explanation">
      <small>Todos los patrones se muestran con sus probabilidades. Los patrones en 0% son incompatibles con los precios ingresados.</small>
    </p>
  </div>`;

  return html;
}

// Helper: Generate timing messages for spike patterns
// pricesArray: array of known sell prices (numbers, no nulls)
// buyPrice: integer buy price
function buildSpikeTimingMessages(patternKey, isPrimary, pricesArray, buyPrice) {
  let messages = '';

  if (patternKey !== PATTERNS.LARGE_SPIKE && patternKey !== PATTERNS.SMALL_SPIKE) {
    return messages;
  }

  const spikeDetection = detectSpikeStart(pricesArray, buyPrice);
  const spikeStarted = spikeDetection.detected;
  const spikeStartIndex = spikeDetection.startIndex;

  // Find the last period index that has a known price
  let lastKnownIndex = -1;
  for (let i = 0; i < PRICE_INPUT_IDS.length; i++) {
    if (pricesArray[i] !== undefined && pricesArray[i] !== null) {
      lastKnownIndex = i;
    }
  }

  if (spikeStarted && spikeStartIndex >= 0) {
    const spikeStartDay = DAYS_CONFIG[spikeStartIndex]?.name || '';
    const periodsToMax = patternKey === PATTERNS.LARGE_SPIKE ? 2 : 3;
    const maxPeriodIndex = spikeStartIndex + periodsToMax;
    const periodsUntilMax = maxPeriodIndex - lastKnownIndex;

    const spikePhase2Index = spikeStartIndex + 1;
    const isInSpikePhase1 = lastKnownIndex === spikeStartIndex;
    const hasSpikePhase2Data = lastKnownIndex >= spikePhase2Index;

    const uncertaintyPrefix = isPrimary ? '' : 'Puede que ';
    const conditionalPhrase = isPrimary ? '' : ' Si es correcto,';

    if (periodsUntilMax > 0) {
      const periodText = periodsUntilMax === 1 ? '1 período' : `${periodsUntilMax} períodos`;
      const maxRange = patternKey === PATTERNS.LARGE_SPIKE ? '200-600%' : '140-200%';

      if (isInSpikePhase1 && !hasSpikePhase2Data) {
        const spikePhase2Threshold = Math.round(buyPrice * RATES.SMALL_SPIKE.PEAK_RATE_MIN);
        const nextDay = DAYS_CONFIG[spikePhase2Index]?.name || 'siguiente período';
        messages += `<li class="pattern-tip">💡 <strong>${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.</strong> El siguiente precio (${nextDay}) será decisivo:`;

        if (patternKey === PATTERNS.LARGE_SPIKE) {
          messages += `<br/>&emsp;&emsp;• Si sube a <strong>≥${spikePhase2Threshold} bayas (≥140%)</strong> → Large Spike confirmado`;
        } else {
          const minThreshold = Math.floor(buyPrice * RATES.SMALL_SPIKE.SPIKE_PHASES[0].min);
          const maxThreshold = spikePhase2Threshold - 1;
          messages += `<br/>&emsp;&emsp;• Si se mantiene entre <strong>${minThreshold}-${maxThreshold} bayas (90-&lt;140%)</strong> → Small Spike confirmado`;
        }
        messages += `</li>`;
      } else {
        messages += `<li class="pattern-tip">💡 <strong>${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.</strong>${conditionalPhrase} El máximo (${maxRange}) será en <strong>${periodText} más</strong>.</li>`;
      }
    } else {
      messages += `<li class="pattern-tip">💡 <strong>${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.</strong>${conditionalPhrase} El máximo ya debería haber ocurrido o está ocurriendo ahora.</li>`;
    }
  } else {
    const spikeWindowText = patternKey === PATTERNS.LARGE_SPIKE
      ? 'Martes AM y Jueves PM (períodos 2-7)'
      : 'Lunes PM y Jueves PM (períodos 1-7)';
    messages += `<li class="pattern-tip">💡 <strong>Aún hay esperanza:</strong> El pico puede empezar entre <strong>${spikeWindowText}</strong>. Sigue checando los precios.</li>`;
  }

  return messages;
}

// Build HTML for the pattern analysis panel (rejection reasons, scores, recommendations)
// pricesArray: array of known sell prices (numbers, no nulls), used for spike timing messages
// buyPrice: integer buy price
export function buildRejectionReasonsHTML(rejectionReasons, scoreReasons, allProbabilities, primaryPattern, recommendations, pricesArray, buyPrice) {
  let html = '';

  // Section 0: Recommendations (at the top)
  if (recommendations && recommendations.length > 0) {
    const primaryPatternName = PATTERN_NAMES[primaryPattern] || 'Desconocido';
    const primaryProbability = allProbabilities[primaryPattern] || 0;
    html += `<h3>⭐ Patrón más probable</h3>`;
    html += '<ul class="pattern-list">';
    html += `<li class="primary-pattern"><strong>${primaryPatternName}</strong> (${primaryProbability}%):`;
    html += '<ul>';
    recommendations.forEach(rec => {
      html += `<li>${rec}</li>`;
    });
    html += buildSpikeTimingMessages(primaryPattern, true, pricesArray, buyPrice);
    html += '</ul>';
    html += '</li>';
    html += '</ul>';
  }

  const patternsToShow = Object.keys(PATTERN_NAMES).filter(key => key !== primaryPattern);
  const rejected = patternsToShow.filter(key => allProbabilities[key] === 0);
  const unlikely = patternsToShow.filter(key => allProbabilities[key] > 0);

  unlikely.sort((a, b) => allProbabilities[b] - allProbabilities[a]);

  // Section 1: Unlikely patterns (>0%)
  if (unlikely.length > 0) {
    html += '<h3>📊 Patrones menos probables</h3>';
    html += '<p><small>Estos patrones son posibles pero menos probables según los datos:</small></p>';
    html += '<ul class="pattern-list">';
    unlikely.forEach(key => {
      const name = PATTERN_NAMES[key];
      const prob = allProbabilities[key];
      const scores = scoreReasons[key] || [];

      html += `<li class="unlikely-pattern"><strong>${name}</strong> (${prob}%):`;
      html += '<ul>';
      if (scores.length > 0) {
        scores.forEach(reason => {
          html += `<li>${reason}</li>`;
        });
      } else {
        html += '<li>Sin señales fuertes a favor o en contra</li>';
      }
      html += buildSpikeTimingMessages(key, false, pricesArray, buyPrice);
      html += '</ul>';
      html += '</li>';
    });
    html += '</ul>';
  }

  // Section 2: Rejected patterns (0%)
  if (rejected.length > 0) {
    html += '<h3>🚫 Patrones descartados (0%)</h3>';
    html += '<p><small>Estos patrones rompen las reglas del algoritmo del juego con los datos ingresados:</small></p>';
    html += '<ul class="pattern-list">';
    rejected.forEach(key => {
      const name = PATTERN_NAMES[key];
      const rejections = rejectionReasons[key] || [];

      html += `<li><strong>${name}</strong>:`;
      html += '<ul>';
      if (rejections.length > 0) {
        rejections.forEach(reason => {
          html += `<li>${reason}</li>`;
        });
      } else {
        html += '<li>Incompatible con los datos actuales</li>';
      }
      html += '</ul>';
      html += '</li>';
    });
    html += '</ul>';
  }

  if (rejected.length === 0 && unlikely.length === 0) {
    html = '<h3>🔍 Análisis de patrones</h3>';
    html += '<p><small>No hay suficientes datos para descartar patrones alternativos.</small></p>';
  }

  return html;
}
