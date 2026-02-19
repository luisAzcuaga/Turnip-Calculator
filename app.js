import { BUY_PRICE_MAX, BUY_PRICE_MIN, DAYS_CONFIG, DEBOUNCE_DELAY, LOADING_DELAY, PATTERNS, PATTERN_DECODE_MAP, PATTERN_ENCODE_MAP, PATTERN_NAMES, PRICE_INPUT_IDS, RATES, THRESHOLDS, TURNIP_PRICE_MAX, TURNIP_PRICE_MIN } from "./constants.js";

import TurnipPredictor from "./predictor.js";
import { detectSpikeStart } from "./patterns/utils.js";

// App.js - User interface handling

// Utility functions
const utils = {
  // Debounce function to limit save frequency
  debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Add multiple event listeners to an element
  addEventListeners(element, events, handler) {
    events.forEach(event => element.addEventListener(event, handler));
  },

  // Manage estimated value styling and attributes
  setEstimatedValue(input, min, max) {
    input.dataset.isEstimated = 'true';
    input.dataset.min = min;
    input.dataset.max = max;
    input.classList.add('estimated-value');
    input.classList.remove('confirmed-value');
    input.placeholder = `${min}-${max}`;
    input.title = `Rango estimado: ${min}-${max} bayas`;
  },

  clearEstimatedValue(input) {
    input.value = '';
    input.placeholder = '-';
    input.classList.remove('estimated-value');
    delete input.dataset.isEstimated;
    delete input.dataset.min;
    delete input.dataset.max;
    input.title = '';
  },

  convertToConfirmedValue(input) {
    input.classList.remove('estimated-value');
    input.classList.add('confirmed-value');
    delete input.dataset.isEstimated;
    delete input.dataset.min;
    delete input.dataset.max;
    input.title = '';
  },

  // Encode data to base64 for URL
  // Compact format: buyPrice|pattern|price1|price2|...|price12
  // pattern: f=fluctuating, l=large_spike, s=small_spike, d=decreasing, empty=none
  encodeToBase64(data) {
    try {
      // Build compact string
      const chunks = [
        data.buyPrice || '',
        PATTERN_ENCODE_MAP[data.previousPattern] || ''
      ];

      // Add prices in order
      PRICE_INPUT_IDS.forEach(id => {
        chunks.push(data[id] || '');
      });

      // Remove trailing empty values to save space
      while (chunks.length > 2 && chunks[chunks.length - 1] === '') {
        chunks.pop();
      }

      const compactString = chunks.join('|');
      return btoa(compactString);
    } catch (e) {
      console.error('Error encoding data to base64:', e);
      return null;
    }
  },

  // Decode base64 from URL to data
  // Compact format: buyPrice|pattern|price1|price2|...|price12
  decodeFromBase64(base64String) {
    try {
      if (!base64String || typeof base64String !== 'string') {
        return null;
      }

      const decoded = atob(base64String);
      const chunks = decoded.split('|');

      if (chunks.length < 2) {
        return null;
      }

      const data = {
        buyPrice: chunks[0] || '',
        previousPattern: PATTERN_DECODE_MAP[chunks[1]] || ''
      };

      // Reconstruct prices from remaining chunks
      PRICE_INPUT_IDS.forEach((id, index) => {
        const value = chunks[index + 2];
        if (value) {
          data[id] = value;
        }
      });

      return data;
    } catch (e) {
      console.error('Error decoding data from base64:', e);
      return null;
    }
  },

  // Get data from URL
  getDataFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const encoded = urlParams.get('turnipData');
    return encoded ? this.decodeFromBase64(encoded) : null;
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const calculateBtn = document.getElementById('calculateBtn');
  const shareBtn = document.getElementById('shareBtn');
  const clearBtn = document.getElementById('clearBtn');
  const buyPriceInput = document.getElementById('buyPrice');
  const previousPatternSelect = document.getElementById('previousPattern');
  const resultsSection = document.getElementById('resultsSection');

  // Flag to prevent saving during initial load
  let isLoading = true;

  // Debounced version of saveData
  const debouncedSaveData = utils.debounce(saveData, DEBOUNCE_DELAY);

  // Wrapper to skip saving during initial load
  const saveDataIfNotLoading = () => !isLoading && debouncedSaveData();

  // Load saved data from localStorage
  loadSavedData();

  // Check for query params and disable inputs
  const urlParams = new URLSearchParams(window.location.search);
  const hasQueryParam = urlParams.has('turnipData');
  if (hasQueryParam) {
    disableAllInputs();
    updateClearButton(true);
  }

  // Deactivate loading flag after a short delay
  setTimeout(() => isLoading = false, LOADING_DELAY);

  // Add listeners for auto-save
  utils.addEventListeners(buyPriceInput, ['input', 'change'], saveDataIfNotLoading);
  utils.addEventListeners(previousPatternSelect, ['change'], saveDataIfNotLoading);
  PRICE_INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    if (input) utils.addEventListeners(input, ['input', 'change'], saveDataIfNotLoading);
  });

  // Add listeners to update rate badges
  utils.addEventListeners(buyPriceInput, ['input', 'change'], updateRateBadges);
  PRICE_INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    if (input) utils.addEventListeners(input, ['input', 'change'], updateRateBadges);
  });

  // Calculate button event
  calculateBtn.addEventListener('click', calculatePrediction);

  // Clear button event
  clearBtn.addEventListener('click', clearAllData);

  // Set up share button
  updateShareButton();

  // Allow calculating with Enter on the buy price field
  buyPriceInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      calculatePrediction();
    }
  });

  function calculatePrediction() {
    const buyPrice = parseInt(buyPriceInput.value);

    if (!buyPrice || buyPrice < BUY_PRICE_MIN || buyPrice > BUY_PRICE_MAX) {
      alert(`⚠️ Por favor ingresa un precio de compra válido (entre ${BUY_PRICE_MIN} y ${BUY_PRICE_MAX} bayas)`);
      buyPriceInput.focus();
      return;
    }

    // Clear previous estimated values before recalculating
    clearEstimatedValues();

    // Collect known prices (confirmed only)
    const knownPrices = {};
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      // Only take values that are NOT estimated
      if (input && input.value && input.dataset.isEstimated !== 'true') {
        knownPrices[id] = parseInt(input.value);
      }
    });

    // Get previous pattern if selected
    const previousPattern = previousPatternSelect.value || null;

    // Create predictor and get results
    const predictor = new TurnipPredictor(buyPrice, knownPrices, previousPattern);
    const results = predictor.predict();

    // Display results
    displayResults(results);

    // Collect current data from the DOM
    const data = {
      buyPrice: buyPriceInput.value,
      previousPattern: previousPatternSelect.value
    };

    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      // Only include confirmed values, NOT estimated ones
      if (input?.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });

    // Check if there is already a query param
    const urlParams = new URLSearchParams(window.location.search);
    const hasQueryParam = urlParams.has('turnipData');
    if (hasQueryParam) return;

    // Only update local storage when there is no queryParams
    localStorage.setItem('turnipData', JSON.stringify(data));
  }

  function clearEstimatedValues() {
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input && input.dataset.isEstimated === 'true') {
        utils.clearEstimatedValue(input);
      }
    });
  }

  function displayResults(results) {
    // Show results section
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');

    // Show pattern probability distribution
    displayProbabilityPanel(results.patternName, results.allProbabilities);

    // Fill inputs with predictions
    fillInputsWithPredictions(results.predictions);

    // Mark the best time to sell
    markBestSellingTime(results.bestSellDay);

    // Show debug info with integrated recommendations
    displayRejectionReasons(results.rejectionReasons, results.scoreReasons, results.allProbabilities, results.pattern, results.recommendations);
  }

  function displayProbabilityPanel(patternName, allProbabilities) {
    const panel = document.getElementById('confidencePanel');

    // Show probability distribution - ALWAYS ALL 4 PATTERNS
    let html = `<div class="probability-distribution">
      <h4>Todos los Patrones Posibles</h4>
      <div class="probability-list">`;

    // Create list with all patterns and sort by probability (most likely first)
    const allPatterns = Object.values(PATTERNS).map(key => ({
      key: key,
      name: PATTERN_NAMES[key]
    }));

    // Add probabilities and sort descending
    const patternsWithProb = allPatterns.map(p => ({
      ...p,
      percentage: allProbabilities[p.key] || 0,
      isPrimary: p.name === patternName
    }));

    // Sort by probability (highest to lowest)
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

    panel.innerHTML = html;
  }

  function fillInputsWithPredictions(predictions) {
    Object.entries(predictions).forEach(([key, data]) => {
      const input = document.getElementById(key);
      if (!input) return;

      // If the field already has a confirmed value, do nothing
      if (data.isUserInput) {
        input.classList.remove('estimated-value');
        input.classList.add('confirmed-value');
        return;
      }

      // If empty, show placeholder with the estimated range
      if (!input.value) {
        // Set estimated value (placeholder shows range)
        utils.setEstimatedValue(input, data.min, data.max);
      }
    });

    // Add event listeners to convert estimated values to confirmed on edit
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input && !input.dataset.hasEstimateListener) {
        input.addEventListener('input', function() {
          // Convert to confirmed only if it has text
          if (this.dataset.isEstimated === 'true') {
            if (this.value.trim() !== '') {
              utils.convertToConfirmedValue(this);
            }
            // If cleared, do NOT revert to estimated here
            // (it will be recalculated on the next prediction)
          }
        });

        input.dataset.hasEstimateListener = 'true';
      }
    });
  }

  function markBestSellingTime(bestTime) {
    // Remove "best time" class from all inputs
    document.querySelectorAll('.best-selling-time').forEach(input => {
      input.classList.remove('best-selling-time');
    });

    if (!bestTime.day) {
      return;
    }

    const input = document.getElementById(bestTime.day);
    if (!input) return;

    // Add class to apply animated glow
    input.classList.add('best-selling-time');
    input.title = `⭐ Mejor momento para vender: hasta ${bestTime.price} bayas`;
  }

  // Helper: Generate timing messages for spike patterns
  function generateSpikeTimingMessages(patternKey, isPrimary) {
    let messages = '';

    if (patternKey !== PATTERNS.LARGE_SPIKE && patternKey !== PATTERNS.SMALL_SPIKE) {
      return messages;
    }

    // Detect if the spike has started using shared utility
    const pricesArray = PRICE_INPUT_IDS.map(id => {
      const val = document.getElementById(id)?.value;
      return val ? parseInt(val) : null;
    }).filter(p => p !== null);

    const buyPrice = parseInt(buyPriceInput.value);
    const spikeDetection = detectSpikeStart(pricesArray, buyPrice);

    let spikeStarted = spikeDetection.detected;
    let spikeStartIndex = spikeDetection.startIndex;
    let lastKnownIndex = -1;

    // Find last period with a known price
    for (let i = 0; i < PRICE_INPUT_IDS.length; i++) {
      const val = document.getElementById(PRICE_INPUT_IDS[i])?.value;
      if (val && parseInt(val)) {
        lastKnownIndex = i;
      }
    }

    if (spikeStarted && spikeStartIndex >= 0) {
      const spikeStartDay = DAYS_CONFIG[spikeStartIndex]?.name || '';
      // Large Spike: spike phase 3 (spikeStart + 2, relative to spike)
      // Small Spike: spike phase 4 (spikeStart + 3, relative to spike)
      const periodsToMax = patternKey === PATTERNS.LARGE_SPIKE ? 2 : 3;
      const maxPeriodIndex = spikeStartIndex + periodsToMax;
      const periodsUntilMax = maxPeriodIndex - lastKnownIndex;

      // Detect if we are in phase 1 (start of spike) and haven't seen phase 2 yet
      const spikePhase2Index = spikeStartIndex + 1;
      const isInSpikePhase1 = lastKnownIndex === spikeStartIndex;
      const hasSpikePhase2Data = lastKnownIndex >= spikePhase2Index;

      const uncertaintyPrefix = isPrimary ? '' : 'Puede que ';
      const conditionalPhrase = isPrimary ? '' : ' Si es correcto,';

      if (periodsUntilMax > 0) {
        const periodText = periodsUntilMax === 1 ? '1 período' : `${periodsUntilMax} períodos`;
        const maxRange = patternKey === PATTERNS.LARGE_SPIKE ? '200-600%' : '140-200%';

        // If in phase 1 and we haven't seen phase 2, mention that phase 2 is decisive
        if (isInSpikePhase1 && !hasSpikePhase2Data) {
          const spikePhase2Threshold = Math.round(buyPrice * THRESHOLDS.SMALL_SPIKE_MIN);
          const nextDay = DAYS_CONFIG[spikePhase2Index]?.name || 'siguiente período';
          messages += `<li style="color: #4a90e2;">💡 <strong>${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.</strong> El siguiente precio (${nextDay}) será decisivo:`;

          if (patternKey === PATTERNS.LARGE_SPIKE) {
            messages += `<br/>&emsp;&emsp;• Si sube a <strong>≥${spikePhase2Threshold} bayas (≥140%)</strong> → Large Spike confirmado`;
          } else { // small_spike
            const minThreshold = Math.floor(buyPrice * RATES.LARGE_SPIKE.SPIKE_PHASES[0].min);
            const maxThreshold = spikePhase2Threshold - 1; // < 140%
            messages += `<br/>&emsp;&emsp;• Si se mantiene entre <strong>${minThreshold}-${maxThreshold} bayas (90-&lt;140%)</strong> → Small Spike confirmado`;
          }
          messages += `</li>`;
        } else {
          messages += `<li style="color: #4a90e2;">💡 <strong>${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.</strong>${conditionalPhrase} El máximo (${maxRange}) será en <strong>${periodText} más</strong>.</li>`;
        }
      } else {
        messages += `<li style="color: #4a90e2;">💡 <strong>${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.</strong>${conditionalPhrase} El máximo ya debería haber ocurrido o está ocurriendo ahora.</li>`;
      }
    } else {
      const spikeWindowText = patternKey === PATTERNS.LARGE_SPIKE ? 'Martes AM y Jueves PM (períodos 2-7)' : 'Lunes PM y Jueves PM (períodos 1-7)';
      messages += `<li style="color: #4a90e2;">💡 <strong>Aún hay esperanza:</strong> El pico puede empezar entre <strong>${spikeWindowText}</strong>. Sigue checando los precios.</li>`;
    }

    return messages;
  }

  function displayRejectionReasons(rejectionReasons, scoreReasons, allProbabilities, primaryPattern, recommendations) {
    const debugDiv = document.getElementById('debugInfo');
    if (!debugDiv) return;

    let html = '';

    // Section 0: Recommendations (at the top)
    if (recommendations && recommendations.length > 0) {
      const primaryPatternName = PATTERN_NAMES[primaryPattern] || 'Desconocido';
      const primaryProbability = allProbabilities[primaryPattern] || 0;
      html += `<h3>⭐ Patrón más probable</h3>`;
      html += '<ul class="rejection-list">';
      html += `<li class="primary-pattern"><strong>${primaryPatternName}</strong> (${primaryProbability}%):`;
      html += '<ul>';
      recommendations.forEach(rec => {
        html += `<li>${rec}</li>`;
      });
      // Add timing messages for spike patterns
      html += generateSpikeTimingMessages(primaryPattern, true);
      html += '</ul>';
      html += '</li>';
      html += '</ul>';
    }

    // Separate rejected patterns (0%) vs unlikely ones (>0%)
    const patternsToShow = Object.keys(PATTERN_NAMES).filter(key => key !== primaryPattern);
    const rejected = patternsToShow.filter(key => allProbabilities[key] === 0);
    const unlikely = patternsToShow.filter(key => allProbabilities[key] > 0);

    // Sort unlikely patterns by probability descending
    unlikely.sort((a, b) => allProbabilities[b] - allProbabilities[a]);

    // Section 1: Unlikely patterns (>0%)
    if (unlikely.length > 0) {
      html += '<h3>📊 Patrones menos probables</h3>';
      html += '<p><small>Estos patrones son posibles pero menos probables según los datos:</small></p>';
      html += '<ul class="rejection-list">';
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
        // Add timing info for spike patterns
        html += generateSpikeTimingMessages(key, false);
        html += '</ul>';
        html += '</li>';
      });
      html += '</ul>';
    }

    // Section 2: Rejected patterns (0%)
    if (rejected.length > 0) {
      html += '<h3>🚫 Patrones descartados (0%)</h3>';
      html += '<p><small>Estos patrones rompen las reglas del algoritmo del juego con los datos ingresados:</small></p>';
      html += '<ul class="rejection-list">';
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

    // If there are none
    if (rejected.length === 0 && unlikely.length === 0) {
      html = '<h3>🔍 Análisis de patrones</h3>';
      html += '<p><small>No hay suficientes datos para descartar patrones alternativos.</small></p>';
    }

    debugDiv.innerHTML = html;
  }

  function saveData() {
    // Don't save to localStorage if URL has a query param
    // (we are viewing data shared by someone else)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('turnipData')) {
      return;
    }

    const data = {
      buyPrice: buyPriceInput.value,
      previousPattern: previousPatternSelect.value
    };

    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      // Only save confirmed values, NOT estimated ones
      if (input?.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });

    localStorage.setItem('turnipData', JSON.stringify(data));
  }

  function loadSavedData() {
    // Try loading from URL first, then from localStorage
    let data = utils.getDataFromURL();
    let isFromURL = false;

    if (data) {
      isFromURL = true;
    } else {
      const savedData = localStorage.getItem('turnipData');
      if (!savedData) return;

      try {
        data = JSON.parse(savedData);
      } catch (e) {
        console.error('Error al cargar datos guardados:', e);
        return;
      }
    }

    // Validate that data is a valid object
    if (!data || typeof data !== 'object') {
      console.error('Datos corruptos detectados');
      if (isFromURL) {
        alert('⚠️ El enlace contiene datos corruptos. No se cargó ninguna información.');
      }
      return;
    }

    // Load data into the inputs
    try {
      if (data.buyPrice) buyPriceInput.value = data.buyPrice;
      if (data.previousPattern) previousPatternSelect.value = data.previousPattern;

      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (data[id] && input) input.value = data[id];
      });
    } catch (e) {
      console.error('Error al aplicar datos:', e);
      // On error, clear all inputs to avoid inconsistent state
      buyPriceInput.value = '';
      previousPatternSelect.value = '';
      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (input) input.value = '';
      });
      if (isFromURL) {
        alert('⚠️ Error al cargar los datos del enlace. No se cargó ninguna información.');
      }
    }
  }

  function clearAllData() {
    // Check for query params
    const urlParams = new URLSearchParams(window.location.search);
    const hasQueryParam = urlParams.has('turnipData');

    if (hasQueryParam) {
      // Rollback mode: remove query param and load data from localStorage
      if (!confirm('¿Quieres volver a tus datos guardados?')) return;

      // Remove query param from URL
      urlParams.delete('turnipData');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);

      // Clear inputs first
      buyPriceInput.value = '';
      previousPatternSelect.value = '';
      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.value = '';
          utils.clearEstimatedValue(input);
        }
      });

      // Enable all inputs
      enableAllInputs();

      // Update clear button
      updateClearButton(false);

      // Update share button (show again)
      updateShareButton();

      // Load data from localStorage
      const savedData = localStorage.getItem('turnipData');
      if (savedData) {
        try {
          const data = JSON.parse(savedData);
          if (data.buyPrice) buyPriceInput.value = data.buyPrice;
          if (data.previousPattern) previousPatternSelect.value = data.previousPattern;

          PRICE_INPUT_IDS.forEach(id => {
            const input = document.getElementById(id);
            if (data[id] && input) input.value = data[id];
          });

          // Auto-calculate if there is a buy price
          if (buyPriceInput.value) {
            setTimeout(() => {
              calculatePrediction();
              updateRateBadges();
            }, 300);
          }
        } catch (e) {
          console.error('Error al cargar datos de localStorage:', e);
        }
      } else {
        // Hide results if there is no saved data
        resultsSection.style.display = 'none';
      }

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Normal mode: clear everything
      if (!confirm('¿Estás seguro de que quieres borrar todos los datos?')) return;

      // Clear inputs
      buyPriceInput.value = '';
      previousPatternSelect.value = '';
      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.value = '';
          utils.clearEstimatedValue(input);
        }
      });

      // Clear localStorage
      localStorage.removeItem('turnipData');

      // Hide results
      resultsSection.style.display = 'none';

      // Scroll to top
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function shareData() {
    const buyPrice = parseInt(buyPriceInput.value);

    if (!buyPrice || buyPrice < BUY_PRICE_MIN || buyPrice > BUY_PRICE_MAX) {
      alert('⚠️ Por favor ingresa un precio de compra válido antes de compartir');
      buyPriceInput.focus();
      return;
    }

    // Collect current data from the DOM
    const data = {
      buyPrice: buyPriceInput.value,
      previousPattern: previousPatternSelect.value
    };

    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      // Only include confirmed values, NOT estimated ones
      if (input?.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });

    const encodedData = utils.encodeToBase64(data);
    if (!encodedData) {
      alert('⚠️ Error al generar el enlace para compartir');
      return;
    }

    // Copy URL to clipboard
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?turnipData=${encodedData}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('✅ URL copiado al portapapeles!\n\nAhora puedes compartirlo con tus amigos.');
    }).catch(() => {
      // Fallback if clipboard copy fails
      alert('🔗 URL generado:\n\n' + url + '\n\nCopia este link para compartir tus datos.');
    });
  }

  function disableAllInputs() {
    buyPriceInput.disabled = true;
    previousPatternSelect.disabled = true;
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = true;
    });
    calculateBtn.disabled = true;
  }

  function enableAllInputs() {
    buyPriceInput.disabled = false;
    previousPatternSelect.disabled = false;
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.disabled = false;
    });
    calculateBtn.disabled = false;
  }

  function updateClearButton(isQueryParamMode) {
    if (isQueryParamMode) {
      clearBtn.textContent = 'Volver a mis datos';
      clearBtn.title = 'Eliminar datos compartidos y volver a tus datos guardados';
    } else {
      clearBtn.textContent = 'Limpiar';
      clearBtn.title = 'Borrar todos los datos';
    }
  }

  function updateShareButton() {
    const urlParams = new URLSearchParams(window.location.search);
    const hasQueryParam = urlParams.has('turnipData');
    if (!hasQueryParam) {
      shareBtn.onclick = shareData;
      shareBtn.title = 'Generar URL para compartir';
      shareBtn.style.display = '';
    } else {
      shareBtn.style.display = 'none';
    }
  }

  // Update rate badges
  function updateRateBadges() {
    const buyPrice = parseInt(buyPriceInput.value);
    if (!buyPrice || buyPrice < BUY_PRICE_MIN || buyPrice > BUY_PRICE_MAX) {
      // Clear all badges if there is no valid base price
      document.querySelectorAll('.rate-badge').forEach(badge => {
        badge.textContent = '';
        badge.className = 'rate-badge';
      });
      return;
    }

    let previousPrice = null;
    PRICE_INPUT_IDS.forEach((id, index) => {
      const input = document.getElementById(id);
      const badge = document.querySelector(`.rate-badge[data-for="${id}"]`);

      if (!input || !badge) return;

      const price = parseInt(input.value);

      if (!price || price < TURNIP_PRICE_MIN || price > TURNIP_PRICE_MAX) {
        // Clear badge if there is no valid price
        badge.textContent = '';
        badge.className = 'rate-badge';
        return;
      }

      // Calculate rate relative to base price
      const rate = (price / buyPrice);
      const ratePercent = (rate * 100).toFixed(1);

      // Determine arrow and class based on previous price
      let arrow = '';
      let className = 'rate-badge neutral';

      if (previousPrice !== null && index > 0) {
        if (price > previousPrice) {
          arrow = '↑';
          className = 'rate-badge rising';
        } else if (price < previousPrice) {
          arrow = '↓';
          className = 'rate-badge falling';
        }
      }

      // Update badge
      badge.textContent = `${arrow}${ratePercent}%`;
      badge.className = className;

      // Save price for next iteration
      previousPrice = price;
    });
  }

  // Auto-calculate if saved data exists on load (localStorage or URL)
  if (buyPriceInput.value) {
    // Short delay so the animation is visible
    setTimeout(() => {
      calculatePrediction();
      updateRateBadges(); // Update badges too
    }, 500);
  }
});