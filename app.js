import { DEBOUNCE_DELAY, LOADING_DELAY, PRICE_INPUT_IDS, BUY_PRICE_MIN, BUY_PRICE_MAX, PATTERNS, PATTERN_NAMES, TURNIP_PRICE_MIN, TURNIP_PRICE_MAX, DAYS_CONFIG, THRESHOLDS, RATES, PATTERN_ENCODE_MAP, PATTERN_DECODE_MAP } from "./constants.js";

import TurnipPredictor from "./predictor.js";
import { detectSpikeStart } from "./patterns/utils.js";

// App.js - Manejo de la interfaz de usuario

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

  // Flag para prevenir guardado durante carga inicial
  let isLoading = true;

  // Versión debounced de saveData
  const debouncedSaveData = utils.debounce(saveData, DEBOUNCE_DELAY);

  // Wrapper para evitar guardado durante carga inicial
  const saveDataIfNotLoading = () => !isLoading && debouncedSaveData();

  // Cargar datos guardados del localStorage
  loadSavedData();

  // Verificar si hay query params y deshabilitar inputs
  const urlParams = new URLSearchParams(window.location.search);
  const hasQueryParam = urlParams.has('turnipData');
  if (hasQueryParam) {
    disableAllInputs();
    updateClearButton(true);
  }

  // Desactivar flag de carga después de un pequeño delay
  setTimeout(() => isLoading = false, LOADING_DELAY);

  // Agregar listeners para autoguardado
  utils.addEventListeners(buyPriceInput, ['input', 'change'], saveDataIfNotLoading);
  utils.addEventListeners(previousPatternSelect, ['change'], saveDataIfNotLoading);
  PRICE_INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    if (input) utils.addEventListeners(input, ['input', 'change'], saveDataIfNotLoading);
  });

  // Agregar listeners para actualizar rate badges
  utils.addEventListeners(buyPriceInput, ['input', 'change'], updateRateBadges);
  PRICE_INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    if (input) utils.addEventListeners(input, ['input', 'change'], updateRateBadges);
  });

  // Evento del botón calcular
  calculateBtn.addEventListener('click', calculatePrediction);

  // Evento del botón limpiar
  clearBtn.addEventListener('click', clearAllData);

  // Configurar botón compartir
  updateShareButton();

  // Permitir calcular con Enter en el campo de precio de compra
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

    // Limpiar valores estimados previos antes de recalcular
    clearEstimatedValues();

    // Recopilar precios conocidos (solo los confirmados)
    const knownPrices = {};
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      // Solo tomar valores que NO son estimados
      if (input && input.value && input.dataset.isEstimated !== 'true') {
        knownPrices[id] = parseInt(input.value);
      }
    });

    // Obtener patrón anterior si está seleccionado
    const previousPattern = previousPatternSelect.value || null;

    // Crear predictor y obtener resultados
    const predictor = new TurnipPredictor(buyPrice, knownPrices, previousPattern);
    const results = predictor.predict();

    // Mostrar resultados
    displayResults(results);

    // Recopilar datos actuales del DOM
    const data = {
      buyPrice: buyPriceInput.value,
      previousPattern: previousPatternSelect.value
    };

    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      // Solo incluir valores confirmados, NO los estimados
      if (input?.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });

    // Verificar si ya hay query param
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
    // Mostrar sección de resultados
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');

    // Mostrar distribución de probabilidades de patrones
    displayProbabilityPanel(results.patternName, results.allProbabilities);

    // Llenar inputs con predicciones
    fillInputsWithPredictions(results.predictions);

    // Marcar el mejor momento para vender
    markBestSellingTime(results.bestTime);

    // Mostrar debug info con recomendaciones integradas
    displayRejectionReasons(results.rejectionReasons, results.scoreReasons, results.allProbabilities, results.pattern, results.recommendation);
  }

  function displayProbabilityPanel(patternName, allProbabilities) {
    const panel = document.getElementById('confidencePanel');

    // Mostrar distribución de probabilidades - SIEMPRE LOS 4 PATRONES
    let html = `<div class="probability-distribution">
      <h4>Todos los Patrones Posibles</h4>
      <div class="probability-list">`;

    // Crear lista con todos los patrones y ordenar por probabilidad (más probable primero)
    const allPatterns = Object.values(PATTERNS).map(key => ({
      key: key,
      name: PATTERN_NAMES[key]
    }));

    // Agregar probabilidades y ordenar descendente
    const patternsWithProb = allPatterns.map(p => ({
      ...p,
      percentage: allProbabilities[p.key] || 0,
      isPrimary: p.name === patternName
    }));

    // Ordenar por probabilidad (mayor a menor)
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

      // Si el campo ya tiene un valor confirmado, no hacer nada
      if (data.isConfirmed) {
        input.classList.remove('estimated-value');
        input.classList.add('confirmed-value');
        return;
      }

      // Si no tiene valor, mostrar placeholder con el rango estimado
      if (!input.value) {
        // Set estimated value (placeholder shows range)
        utils.setEstimatedValue(input, data.min, data.max);
      }
    });

    // Agregar event listeners para convertir estimados en confirmados al editar
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input && !input.dataset.hasEstimateListener) {
        input.addEventListener('input', function() {
          // Convertir a confirmado solo si tiene texto
          if (this.dataset.isEstimated === 'true') {
            if (this.value.trim() !== '') {
              utils.convertToConfirmedValue(this);
            }
            // Si borra todo, NO reconvertir a estimado aquí
            // (se recalculará en el próximo cálculo)
          }
        });

        input.dataset.hasEstimateListener = 'true';
      }
    });
  }

  function markBestSellingTime(bestTime) {
    // Limpiar clase de "mejor momento" de todos los inputs
    document.querySelectorAll('.best-selling-time').forEach(input => {
      input.classList.remove('best-selling-time');
    });

    // Solo marcar para patrones predecibles
    if (bestTime.pattern === PATTERNS.FLUCTUATING || !bestTime.day) {
      return;
    }

    // Convertir nombre del día a input ID
    // ej: "Sábado AM" → "sat_am"
    const dayToId = {
      'Lunes AM': 'mon_am',
      'Lunes PM': 'mon_pm',
      'Martes AM': 'tue_am',
      'Martes PM': 'tue_pm',
      'Miércoles AM': 'wed_am',
      'Miércoles PM': 'wed_pm',
      'Jueves AM': 'thu_am',
      'Jueves PM': 'thu_pm',
      'Viernes AM': 'fri_am',
      'Viernes PM': 'fri_pm',
      'Sábado AM': 'sat_am',
      'Sábado PM': 'sat_pm'
    };

    const inputId = dayToId[bestTime.day];
    if (!inputId) return;

    const input = document.getElementById(inputId);
    if (!input) return;

    // Añadir clase para aplicar glow animado
    input.classList.add('best-selling-time');
    input.title = `⭐ Mejor momento para vender: hasta ${bestTime.price} bayas`;
  }

  // Helper: Generar mensajes de timing para patrones de pico
  function generateSpikeTimingMessages(patternKey, isPrimary) {
    let messages = '';

    if (patternKey !== PATTERNS.LARGE_SPIKE && patternKey !== PATTERNS.SMALL_SPIKE) {
      return messages;
    }

    // Detectar si ya comenzó el pico usando función compartida
    const pricesArray = PRICE_INPUT_IDS.map(id => {
      const val = document.getElementById(id)?.value;
      return val ? parseInt(val) : null;
    }).filter(p => p !== null);

    const buyPrice = parseInt(buyPriceInput.value);
    const spikeDetection = detectSpikeStart(pricesArray, buyPrice);

    let spikeStarted = spikeDetection.detected;
    let spikeStartIndex = spikeDetection.startIndex;
    let lastKnownIndex = -1;

    // Encontrar último período con precio conocido
    for (let i = 0; i < PRICE_INPUT_IDS.length; i++) {
      const val = document.getElementById(PRICE_INPUT_IDS[i])?.value;
      if (val && parseInt(val)) {
        lastKnownIndex = i;
      }
    }

    if (spikeStarted && spikeStartIndex >= 0) {
      const spikeStartDay = DAYS_CONFIG[spikeStartIndex]?.name || '';
      // Large Spike: máximo en Período 3 (peakStart + 2, zero-indexed)
      // Small Spike: máximo en Período 4 (peakStart + 3, zero-indexed)
      const peaksInPhase = patternKey === PATTERNS.LARGE_SPIKE ? 2 : 3;
      const maxPeriodIndex = spikeStartIndex + peaksInPhase;
      const periodsUntilMax = maxPeriodIndex - lastKnownIndex;

      // Detectar si estamos en Período 1 (inicio del pico) y aún no vimos Período 2
      const period2Index = spikeStartIndex + 1;
      const isInPeriod1 = lastKnownIndex === spikeStartIndex;
      const hasPeriod2Data = lastKnownIndex >= period2Index;

      const uncertaintyPrefix = isPrimary ? '' : 'Puede que ';
      const conditionalPhrase = isPrimary ? '' : ' Si es correcto,';

      if (periodsUntilMax > 0) {
        const periodText = periodsUntilMax === 1 ? '1 período' : `${periodsUntilMax} períodos`;
        const maxRange = patternKey === PATTERNS.LARGE_SPIKE ? '200-600%' : '140-200%';

        // Si estamos en Período 1 y no hemos visto Período 2, mencionar que Período 2 es decisivo
        if (isInPeriod1 && !hasPeriod2Data) {
          const period2Threshold = Math.round(buyPrice * THRESHOLDS.SMALL_SPIKE_MIN);
          const nextDay = DAYS_CONFIG[period2Index]?.name || 'siguiente período';
          messages += `<li style="color: #4a90e2;">💡 <strong>${uncertaintyPrefix}El pico comenzó en ${spikeStartDay}.</strong> El siguiente precio (${nextDay}) será decisivo:`;

          if (patternKey === PATTERNS.LARGE_SPIKE) {
            messages += `<br/>&emsp;&emsp;• Si sube a <strong>≥${period2Threshold} bayas (≥140%)</strong> → Large Spike confirmado`;
          } else { // small_spike
            const minThreshold = Math.floor(buyPrice * RATES.LARGE_SPIKE.PEAK_PHASES[0].min);
            const maxThreshold = period2Threshold - 1; // < 140%
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
      const period = patternKey === PATTERNS.LARGE_SPIKE ? 'Martes AM y Jueves PM (períodos 2-7)' : 'Lunes PM y Jueves PM (períodos 1-7)';
      messages += `<li style="color: #4a90e2;">💡 <strong>Aún hay esperanza:</strong> El pico puede empezar entre <strong>${period}</strong>. Sigue checando los precios.</li>`;
    }

    return messages;
  }

  function displayRejectionReasons(rejectionReasons, scoreReasons, allProbabilities, primaryPattern, recommendations) {
    const debugDiv = document.getElementById('debugInfo');
    if (!debugDiv) return;

    let html = '';

    // Sección 0: Recomendaciones (al inicio)
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
      // Agregar mensajes de timing para patrones de pico
      html += generateSpikeTimingMessages(primaryPattern, true);
      html += '</ul>';
      html += '</li>';
      html += '</ul>';
    }

    // Separar patrones descartados (0%) vs improbables (>0%)
    const patternsToShow = Object.keys(PATTERN_NAMES).filter(key => key !== primaryPattern);
    const rejected = patternsToShow.filter(key => allProbabilities[key] === 0);
    const unlikely = patternsToShow.filter(key => allProbabilities[key] > 0);

    // Ordenar improbables por probabilidad descendente
    unlikely.sort((a, b) => allProbabilities[b] - allProbabilities[a]);

    // Sección 1 Patrones improbables (>0%)
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
        // Añadir información de timing para patrones de pico
        html += generateSpikeTimingMessages(key, false);
        html += '</ul>';
        html += '</li>';
      });
      html += '</ul>';
    }

    // Sección 2: Patrones descartados (0%)
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

    // Si no hay ninguno
    if (rejected.length === 0 && unlikely.length === 0) {
      html = '<h3>🔍 Análisis de patrones</h3>';
      html += '<p><small>No hay suficientes datos para descartar patrones alternativos.</small></p>';
    }

    debugDiv.innerHTML = html;
  }

  function saveData() {
    // No guardar en localStorage si hay query param en el URL
    // (estamos viendo datos compartidos por alguien más)
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
      // Solo guardar valores confirmados, NO los estimados
      if (input?.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });

    localStorage.setItem('turnipData', JSON.stringify(data));
  }

  function loadSavedData() {
    // Intentar cargar primero desde URL, luego desde localStorage
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

    // Validar que data sea un objeto válido
    if (!data || typeof data !== 'object') {
      console.error('Datos corruptos detectados');
      if (isFromURL) {
        alert('⚠️ El enlace contiene datos corruptos. No se cargó ninguna información.');
      }
      return;
    }

    // Cargar datos en los inputs
    try {
      if (data.buyPrice) buyPriceInput.value = data.buyPrice;
      if (data.previousPattern) previousPatternSelect.value = data.previousPattern;

      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (data[id] && input) input.value = data[id];
      });
    } catch (e) {
      console.error('Error al aplicar datos:', e);
      // Si hay error, limpiar todos los inputs para evitar estado inconsistente
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
    // Verificar si hay query params
    const urlParams = new URLSearchParams(window.location.search);
    const hasQueryParam = urlParams.has('turnipData');

    if (hasQueryParam) {
      // Modo rollback: eliminar query param y cargar datos de localStorage
      if (!confirm('¿Quieres volver a tus datos guardados?')) return;

      // Eliminar query param de la URL
      urlParams.delete('turnipData');
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '');
      window.history.replaceState({}, '', newUrl);

      // Limpiar inputs primero
      buyPriceInput.value = '';
      previousPatternSelect.value = '';
      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.value = '';
          utils.clearEstimatedValue(input);
        }
      });

      // Habilitar todos los inputs
      enableAllInputs();

      // Actualizar botón limpiar
      updateClearButton(false);

      // Actualizar botón compartir (mostrar nuevamente)
      updateShareButton();

      // Cargar datos de localStorage
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

          // Auto-calcular si hay precio de compra
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
        // Ocultar resultados si no hay datos guardados
        resultsSection.style.display = 'none';
      }

      // Scroll al inicio
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Modo normal: limpiar todo
      if (!confirm('¿Estás seguro de que quieres borrar todos los datos?')) return;

      // Limpiar inputs
      buyPriceInput.value = '';
      previousPatternSelect.value = '';
      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.value = '';
          utils.clearEstimatedValue(input);
        }
      });

      // Limpiar localStorage
      localStorage.removeItem('turnipData');

      // Ocultar resultados
      resultsSection.style.display = 'none';

      // Scroll al inicio
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

    // Recopilar datos actuales del DOM
    const data = {
      buyPrice: buyPriceInput.value,
      previousPattern: previousPatternSelect.value
    };

    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      // Solo incluir valores confirmados, NO los estimados
      if (input?.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });

    const encodedData = utils.encodeToBase64(data);
    if (!encodedData) {
      alert('⚠️ Error al generar el enlace para compartir');
      return;
    }

    // Copiar URL al portapapeles
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?turnipData=${encodedData}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('✅ URL copiado al portapapeles!\n\nAhora puedes compartirlo con tus amigos.');
    }).catch(() => {
      // Fallback si no se puede copiar
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

  // Función para actualizar badges de rate
  function updateRateBadges() {
    const buyPrice = parseInt(buyPriceInput.value);
    if (!buyPrice || buyPrice < BUY_PRICE_MIN || buyPrice > BUY_PRICE_MAX) {
      // Limpiar todos los badges si no hay precio base válido
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
        // Limpiar badge si no hay precio válido
        badge.textContent = '';
        badge.className = 'rate-badge';
        return;
      }

      // Calcular rate respecto al precio base
      const rate = (price / buyPrice);
      const ratePercent = (rate * 100).toFixed(1);

      // Determinar flecha y clase según precio anterior
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

      // Actualizar badge
      badge.textContent = `${arrow}${ratePercent}%`;
      badge.className = className;

      // Guardar precio para siguiente iteración
      previousPrice = price;
    });
  }

  // Auto-calcular si hay datos guardados al cargar (localStorage o URL)
  if (buyPriceInput.value) {
    // Pequeño delay para que se vea la animación
    setTimeout(() => {
      calculatePrediction();
      updateRateBadges(); // Actualizar badges también
    }, 500);
  }
});