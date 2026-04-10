import { DAYS_CONFIG, PATTERNS, PATTERN_NAMES, PRICE_INPUT_IDS, RATES } from "../constants.js";
import { detectSpikeStart } from "../patterns/utils.js";

// Cache template lookups
const tmplProbItem = () => document.getElementById('tmpl-probability-item');
const tmplPatternItem = () => document.getElementById('tmpl-pattern-item');
const tmplSpikeTip = () => document.getElementById('tmpl-spike-tip');

// Fill the probability distribution panel (#patternSummary)
export function renderProbabilityPanel(patternName, allProbabilities) {
  const list = document.getElementById('probabilityList');
  list.innerHTML = '';

  const patternsWithProb = Object.values(PATTERNS).map(key => ({
    key,
    name: PATTERN_NAMES[key],
    percentage: allProbabilities[key] || 0,
    isPrimary: PATTERN_NAMES[key] === patternName
  }));

  patternsWithProb.sort((a, b) => b.percentage - a.percentage);

  patternsWithProb.forEach(p => {
    const clone = tmplProbItem().content.cloneNode(true);
    const item = clone.querySelector('.probability-item');

    if (p.isPrimary) item.classList.add('primary-pattern');

    clone.querySelector('.probability-name').textContent = p.name;
    clone.querySelector('.probability-value').textContent = `${p.percentage}%`;
    clone.querySelector('.probability-bar-fill').style.width = `${p.percentage}%`;

    const badge = clone.querySelector('.primary-badge');
    if (p.isPrimary) badge.hidden = false;

    list.appendChild(clone);
  });
}

// Helper: build a list of <li> reason elements from an array of strings
function appendReasons(ul, reasons) {
  reasons.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });
}

// Helper: Generate and append spike timing <li> into a target <ul>
function appendSpikeTimingMessage(targetUl, patternKey, isPrimary, pricesArray, buyPrice) {
  if (patternKey !== PATTERNS.LARGE_SPIKE && patternKey !== PATTERNS.SMALL_SPIKE) return;

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

  const clone = tmplSpikeTip().content.cloneNode(true);
  const li = clone.querySelector('.spike-timing-tip');

  const uncertaintyPrefix = isPrimary ? '' : 'Puede que ';
  const conditionalPhrase = isPrimary ? '' : ' Si es correcto,';

  if (spikeStarted && spikeStartIndex >= 0) {
    const spikeStartDay = DAYS_CONFIG[spikeStartIndex]?.name || '';
    const periodsToMax = patternKey === PATTERNS.LARGE_SPIKE ? 2 : 3;
    const maxPeriodIndex = spikeStartIndex + periodsToMax;
    const periodsUntilMax = maxPeriodIndex - lastKnownIndex;

    const spikePhase2Index = spikeStartIndex + 1;
    const isInSpikePhase1 = lastKnownIndex === spikeStartIndex;
    const hasSpikePhase2Data = lastKnownIndex >= spikePhase2Index;

    if (periodsUntilMax > 0) {
      const periodText = periodsUntilMax === 1 ? '1 período' : `${periodsUntilMax} períodos`;
      const maxRange = patternKey === PATTERNS.LARGE_SPIKE ? '200-600%' : '140-200%';

      if (isInSpikePhase1 && !hasSpikePhase2Data) {
        const spikePhase2Threshold = Math.round(buyPrice * RATES.SMALL_SPIKE.PEAK_RATE_MIN);
        const nextDay = DAYS_CONFIG[spikePhase2Index]?.name || 'siguiente período';

        let detailText;
        if (patternKey === PATTERNS.LARGE_SPIKE) {
          detailText = `\n\u2003\u2003• Si sube a ≥${spikePhase2Threshold} bayas (≥140%) → Large Spike confirmado`;
        } else {
          const minThreshold = Math.floor(buyPrice * RATES.SMALL_SPIKE.SPIKE_PHASES[0].min);
          const maxThreshold = spikePhase2Threshold - 1;
          detailText = `\n\u2003\u2003• Si se mantiene entre ${minThreshold}-${maxThreshold} bayas (90-<140%) → Small Spike confirmado`;
        }

        li.textContent = `💡 ${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}. El siguiente precio (${nextDay}) será decisivo:${detailText}`;
      } else {
        li.textContent = `💡 ${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.${conditionalPhrase} El máximo (${maxRange}) será en ${periodText} más.`;
      }
    } else {
      li.textContent = `💡 ${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.${conditionalPhrase} El máximo ya debería haber ocurrido o está ocurriendo ahora.`;
    }
  } else {
    const spikeWindowText = patternKey === PATTERNS.LARGE_SPIKE
      ? 'Martes AM y Jueves PM (períodos 2-7)'
      : 'Lunes PM y Jueves PM (períodos 1-7)';
    li.textContent = `💡 Aún hay esperanza: El pico puede empezar entre ${spikeWindowText}. Sigue checando los precios.`;
  }

  targetUl.appendChild(clone);
}

// Fill the pattern detail panel (#patternDetail)
export function renderPatternDetail(rejectionReasons, scoreReasons, allProbabilities, primaryPattern, recommendations, pricesArray, buyPrice) {
  // Reset all sections
  const primarySection = document.getElementById('primarySection');
  const unlikelySection = document.getElementById('unlikelySection');
  const rejectedSection = document.getElementById('rejectedSection');
  const fallbackSection = document.getElementById('fallbackSection');

  primarySection.hidden = true;
  unlikelySection.hidden = true;
  rejectedSection.hidden = true;
  fallbackSection.hidden = true;

  // Section 0: Primary pattern recommendations
  if (recommendations && recommendations.length > 0) {
    const primaryPatternName = PATTERN_NAMES[primaryPattern] || 'Desconocido';
    const primaryProbability = allProbabilities[primaryPattern] || 0;

    document.getElementById('primaryName').textContent = primaryPatternName;
    document.getElementById('primaryProb').textContent = primaryProbability;

    const reasonsList = document.getElementById('primaryReasons');
    reasonsList.innerHTML = '';
    appendReasons(reasonsList, recommendations);
    appendSpikeTimingMessage(reasonsList, primaryPattern, true, pricesArray, buyPrice);

    primarySection.hidden = false;
  }

  const patternsToShow = Object.keys(PATTERN_NAMES).filter(key => key !== primaryPattern);
  const rejected = patternsToShow.filter(key => allProbabilities[key] === 0);
  const unlikely = patternsToShow.filter(key => allProbabilities[key] > 0);

  unlikely.sort((a, b) => allProbabilities[b] - allProbabilities[a]);

  // Section 1: Unlikely patterns (>0%)
  if (unlikely.length > 0) {
    const list = document.getElementById('unlikelyList');
    list.innerHTML = '';

    unlikely.forEach(key => {
      const clone = tmplPatternItem().content.cloneNode(true);
      const li = clone.querySelector('li');
      li.classList.add('unlikely-pattern');

      clone.querySelector('.pattern-name').textContent = PATTERN_NAMES[key];
      clone.querySelector('.pattern-prob').textContent = allProbabilities[key];

      const reasonsUl = clone.querySelector('.pattern-reasons');
      const scores = scoreReasons[key] || [];
      if (scores.length > 0) {
        appendReasons(reasonsUl, scores);
      } else {
        appendReasons(reasonsUl, ['Sin señales fuertes a favor o en contra']);
      }
      appendSpikeTimingMessage(reasonsUl, key, false, pricesArray, buyPrice);

      list.appendChild(clone);
    });

    unlikelySection.hidden = false;
  }

  // Section 2: Rejected patterns (0%)
  if (rejected.length > 0) {
    const list = document.getElementById('rejectedList');
    list.innerHTML = '';

    rejected.forEach(key => {
      const clone = tmplPatternItem().content.cloneNode(true);
      clone.querySelector('.pattern-name').textContent = PATTERN_NAMES[key];
      clone.querySelector('.pattern-prob').textContent = 0;

      const reasonsUl = clone.querySelector('.pattern-reasons');
      const rejections = rejectionReasons[key] || [];
      if (rejections.length > 0) {
        appendReasons(reasonsUl, rejections);
      } else {
        appendReasons(reasonsUl, ['Incompatible con los datos actuales']);
      }

      list.appendChild(clone);
    });

    rejectedSection.hidden = false;
  }

  // Fallback
  if (rejected.length === 0 && unlikely.length === 0) {
    fallbackSection.hidden = false;
  }
}
