// App.js - Manejo de la interfaz de usuario

// Utility functions
const utils = {
  // Debounce function to limit save frequency
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  },

  // Add multiple event listeners to an element
  addEventListeners(element, events, handler) {
    events.forEach(event => element.addEventListener(event, handler));
  },

  // Manage estimated value styling and attributes
  setEstimatedValue(input, min, max, avgEstimate) {
    input.dataset.isEstimated = 'true';
    input.dataset.min = min;
    input.dataset.max = max;
    input.classList.add('estimated-value');
    input.classList.remove('confirmed-value');
    input.value = avgEstimate;
    input.title = `Promedio: ${avgEstimate} (rango: ${min}-${max} bayas)`;
  },

  clearEstimatedValue(input) {
    input.value = '';
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
    priceInputs.forEach(id => {
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
        // Remover indicador de rango
        const rangeIndicator = input.parentElement.querySelector('.range-indicator');
        rangeIndicator?.remove();
      }
    });
  }

  function displayResults(results) {
    // Mostrar sección de resultados
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');

    // Mostrar patrón con confianza y alternativas
    displayPattern(results.pattern, results.patternName, results.confidence, results.primaryPercentage, results.alternatives);

    // Llenar inputs con predicciones
    fillInputsWithPredictions(results.predictions);

    // Mostrar recomendaciones
    displayRecommendations(results.recommendation);

    // Mostrar mejor momento
    displayBestTime(results.bestTime);
  }

  function displayPattern(pattern, patternName, confidence, primaryPercentage, alternatives) {
    const patternBadge = document.getElementById('patternBadge');
    patternBadge.className = 'pattern-badge pattern-' + pattern;

    // Mostrar solo el patrón y porcentaje en el badge
    let html = `
      <div class="pattern-main">
        <span class="pattern-name">Patrón: ${patternName} (${primaryPercentage}%)</span>
      </div>
    `;

    // Mostrar alternativas si la confianza es baja o media
    if (confidence < 70 && alternatives && alternatives.length > 0) {
      html += `<div class="pattern-alternatives">`;
      html += `<small>También podría ser: `;
      html += alternatives.map(alt => `<strong>${alt.name}</strong> (${alt.percentage}%)`).join(' o ');
      html += `</small></div>`;
    }

    patternBadge.innerHTML = html;

    // Panel de confianza (lateral derecho)
    displayConfidencePanel(confidence, primaryPercentage, patternName, alternatives);
  }

  function displayConfidencePanel(confidence, primaryPercentage, patternName, alternatives) {
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
      <div class="confidence-header">
        <h3>Confianza del Cálculo</h3>
      </div>
      <div class="confidence-meter ${confidenceClass}">
        <div class="confidence-percentage">${confidenceIcon} ${confidence}%</div>
        <div class="confidence-bar">
          <div class="confidence-bar-fill" style="width: ${confidence}%"></div>
        </div>
        <div class="confidence-level">${confidenceLabel}</div>
        <div class="confidence-message">${confidenceMessage}</div>
      </div>
    `;

    // Mostrar distribución de probabilidades
    html += `<div class="probability-distribution">
      <h4>Distribución de Probabilidades</h4>
      <div class="probability-list">`;

    // Agregar todas las probabilidades
    const allPatterns = [{ name: patternName, percentage: primaryPercentage }];
    if (alternatives && alternatives.length > 0) {
      alternatives.forEach(alt => {
        allPatterns.push({ name: alt.name, percentage: alt.percentage });
      });
    }

    // Ordenar por porcentaje descendente
    allPatterns.sort((a, b) => b.percentage - a.percentage);

    allPatterns.forEach(p => {
      html += `
        <div class="probability-item">
          <span class="probability-name">${p.name}</span>
          <div class="probability-bar-container">
            <div class="probability-bar-fill" style="width: ${p.percentage}%"></div>
            <span class="probability-value">${p.percentage}%</span>
          </div>
        </div>
      `;
    });

    html += `</div></div>`;

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

      // Si no tiene valor, llenar con el promedio del rango estimado
      if (!input.value) {
        const avgEstimate = Math.round((data.min + data.max) / 2);

        // Set estimated value (sets flag BEFORE value to prevent race condition)
        utils.setEstimatedValue(input, data.min, data.max, avgEstimate);

        // Agregar indicador de rango visual
        const parent = input.parentElement;
        let rangeIndicator = parent.querySelector('.range-indicator');
        if (!rangeIndicator) {
          rangeIndicator = document.createElement('div');
          rangeIndicator.className = 'range-indicator';
          parent.appendChild(rangeIndicator);
        }
        rangeIndicator.textContent = `${data.min}-${data.max}`;
      } else if (input.dataset.isEstimated !== 'true') {
        // Remover indicador si es confirmado
        input.parentElement.querySelector('.range-indicator')?.remove();
      }
    });

    // Agregar event listeners para convertir estimados en confirmados al editar
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input && !input.dataset.hasEstimateListener) {
        input.addEventListener('focus', function() {
          if (this.dataset.isEstimated === 'true') this.select();
        });

        input.addEventListener('input', function() {
          if (this.dataset.isEstimated === 'true') {
            utils.convertToConfirmedValue(this);
            this.parentElement.querySelector('.range-indicator')?.remove();
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