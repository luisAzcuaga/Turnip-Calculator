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
  }
};

document.addEventListener('DOMContentLoaded', function () {
  const calculateBtn = document.getElementById('calculateBtn');
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

  // Desactivar flag de carga después de un pequeño delay
  setTimeout(() => isLoading = false, LOADING_DELAY);

  // Agregar listeners para autoguardado
  utils.addEventListeners(buyPriceInput, ['input', 'change'], saveDataIfNotLoading);
  utils.addEventListeners(previousPatternSelect, ['change'], saveDataIfNotLoading);
  PRICE_INPUT_IDS.forEach(id => {
    const input = document.getElementById(id);
    if (input) utils.addEventListeners(input, ['input', 'change'], saveDataIfNotLoading);
  });

  // Evento del botón calcular
  calculateBtn.addEventListener('click', calculatePrediction);

  // Evento del botón limpiar
  clearBtn.addEventListener('click', clearAllData);

  // Permitir calcular con Enter en el campo de precio de compra
  buyPriceInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
      calculatePrediction();
    }
  });

  function calculatePrediction() {
    const buyPrice = parseInt(buyPriceInput.value);

    if (!buyPrice || buyPrice < 90 || buyPrice > 110) {
      alert('⚠️ Por favor ingresa un precio de compra válido (entre 90 y 110 bayas)');
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

    // Mostrar patrón con confianza y alternativas
    displayPattern(results.patternName, results.confidence, results.allProbabilities);

    // Llenar inputs con predicciones
    fillInputsWithPredictions(results.predictions);

    // Mostrar recomendaciones
    displayRecommendations(results.recommendation);

    // Mostrar mejor momento
    displayBestTime(results.bestTime);

    // Mostrar razones de rechazo/baja probabilidad
    displayRejectionReasons(results.rejectionReasons, results.scoreReasons, results.allProbabilities, results.pattern);
  }

  function displayPattern(patternName, confidence, allProbabilities) {
    // Panel de confianza (lateral derecho) - shows all pattern info
    displayConfidencePanel(confidence, patternName, allProbabilities);
  }

  function displayConfidencePanel(confidence, patternName, allProbabilities) {
    const confidencePanel = document.getElementById('confidencePanel');

    // Determinar nivel de confianza
    let confidenceClass = 'confidence-low';
    let confidenceLabel = 'Baja';
    let confidenceIcon = '🔴';
    let confidenceMessage = 'Ingresa más precios para mejorar la precisión';

    if (confidence >= 70) {
      confidenceClass = 'confidence-high';
      confidenceLabel = 'Alta';
      confidenceIcon = '🟢';
      confidenceMessage = 'Predicción muy confiable';
    } else if (confidence >= 50) {
      confidenceClass = 'confidence-medium';
      confidenceLabel = 'Media';
      confidenceIcon = '🟡';
      confidenceMessage = 'Predicción moderadamente confiable';
    }

    let html = `
      <div class="confidence-meter ${confidenceClass}">
      <div class="confidence-header">
        <h3>Confianza del Cálculo</h3>
      </div>
        <div class="confidence-percentage">${confidenceIcon} ${confidence}%</div>
        <div class="confidence-bar">
          <div class="confidence-bar-fill" style="width: ${confidence}%"></div>
        </div>
        <div class="confidence-level">${confidenceLabel}</div>
        <div class="confidence-message">${confidenceMessage}</div>
        <p class="probability-explanation">
          <small>Los porcentajes (%) indican la probabilidad de cada patrón.
          La confianza muestra qué tan precisas son estas estimaciones (más datos = mayor confianza).</small>
        </p>
      </div>
    `;

    // Mostrar distribución de probabilidades - SIEMPRE LOS 4 PATRONES
    html += `<div class="probability-distribution">
      <h4>Todos los Patrones Posibles</h4>
      <div class="probability-list">`;

    // Crear lista con todos los patrones y ordenar por probabilidad (más probable primero)
    const allPatterns = [
      { key: 'large_spike', name: 'Pico Grande' },
      { key: 'small_spike', name: 'Pico Pequeño' },
      { key: 'decreasing', name: 'Decreciente' },
      { key: 'fluctuating', name: 'Fluctuante' }
    ];

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

    confidencePanel.innerHTML = html;
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

  function displayRecommendations(recommendations) {
    const recommendationsDiv = document.getElementById('recommendations');
    recommendationsDiv.innerHTML = '<h3>💡 Recomendaciones</h3><ul></ul>';

    const ul = recommendationsDiv.querySelector('ul');
    recommendations.forEach(rec => {
      const li = document.createElement('li');
      li.textContent = rec;
      ul.appendChild(li);
    });
  }

  function displayBestTime(bestTime) {
    const bestTimeDiv = document.getElementById('bestTime');

    // Caso especial: patrón Fluctuante (aleatorio)
    if (bestTime.pattern === 'fluctuating') {
      bestTimeDiv.innerHTML = `
                <h3>⚠️ Patrón Fluctuante Detectado</h3>
                <p>No hay momento óptimo predecible. Los precios son aleatorios.</p>
                <p><strong>Consejo:</strong> Vende cuando veas un precio que te satisfaga.</p>
            `;
      return;
    }

    // Patrones predecibles (Spikes, Decreasing)
    if (bestTime.isConfirmed) {
      bestTimeDiv.innerHTML = `
                <h3>⭐ Mejor precio confirmado</h3>
                <p>${bestTime.day}: ${bestTime.price} bayas</p>
            `;
    } else {
      bestTimeDiv.innerHTML = `
                <h3>⭐ Mejor momento estimado para vender</h3>
                <p>${bestTime.day}: hasta ${bestTime.price} bayas (estimado)</p>
            `;
    }
  }

  function displayRejectionReasons(rejectionReasons, scoreReasons, allProbabilities, primaryPattern) {
    const debugDiv = document.getElementById('debugInfo');
    if (!debugDiv) return;

    // Mapeo de nombres de patrones
    const patternNames = {
      'large_spike': 'Pico Grande',
      'small_spike': 'Pico Pequeño',
      'decreasing': 'Decreciente',
      'fluctuating': 'Fluctuante'
    };

    // Separar patrones descartados (0%) vs improbables (>0%)
    const patternsToShow = Object.keys(patternNames).filter(key => key !== primaryPattern);
    const rejected = patternsToShow.filter(key => allProbabilities[key] === 0);
    const unlikely = patternsToShow.filter(key => allProbabilities[key] > 0);

    // Ordenar improbables por probabilidad descendente
    unlikely.sort((a, b) => allProbabilities[b] - allProbabilities[a]);

    let html = '';

    // Sección 1 Patrones improbables (>0%)
    if (unlikely.length > 0) {
      html += '<h3>🔍 Patrones menos probables</h3>';
      html += '<p><small>Estos patrones son posibles pero menos probables según los datos:</small></p>';
      html += '<ul class="rejection-list">';
      unlikely.forEach(key => {
        const name = patternNames[key];
        const prob = allProbabilities[key];
        const scores = scoreReasons[key] || [];

        html += `<li><strong>${name}</strong> (${prob}%):`;
        if (scores.length > 0) {
          html += '<ul>';
          scores.forEach(reason => {
            html += `<li>${reason}</li>`;
          });
          html += '</ul>';
        } else {
          html += ' <em>Sin señales fuertes a favor o en contra</em>';
        }
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
        const name = patternNames[key];
        const rejections = rejectionReasons[key] || [];

        html += `<li><strong>${name}</strong>:`;
        if (rejections.length > 0) {
          html += '<ul>';
          rejections.forEach(reason => {
            html += `<li>${reason}</li>`;
          });
          html += '</ul>';
        } else {
          html += ' <em>Incompatible con los datos actuales</em>';
        }
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
    const savedData = localStorage.getItem('turnipData');
    if (!savedData) return;

    try {
      const data = JSON.parse(savedData);

      if (data.buyPrice) buyPriceInput.value = data.buyPrice;
      if (data.previousPattern) previousPatternSelect.value = data.previousPattern;

      PRICE_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (data[id] && input) input.value = data[id];
      });
    } catch (e) {
      console.error('Error al cargar datos guardados:', e);
    }
  }

  function clearAllData() {
    if (!confirm('¿Estás seguro de que quieres borrar todos los datos?')) return;

    // Limpiar inputs
    buyPriceInput.value = '';
    previousPatternSelect.value = '';
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input) input.value = '';
    });

    // Limpiar localStorage
    localStorage.removeItem('turnipData');

    // Ocultar resultados
    resultsSection.style.display = 'none';

    // Scroll al inicio
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Auto-calcular si hay datos guardados al cargar
  const savedData = localStorage.getItem('turnipData');
  if (savedData && buyPriceInput.value) {
    // Pequeño delay para que se vea la animación
    setTimeout(() => {
      calculatePrediction();
    }, 500);
  }
});