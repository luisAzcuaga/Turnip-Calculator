// App.js - Manejo de la interfaz de usuario

document.addEventListener('DOMContentLoaded', function () {
  const calculateBtn = document.getElementById('calculateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const buyPriceInput = document.getElementById('buyPrice');
  const resultsSection = document.getElementById('resultsSection');

  // Lista de inputs de precios
  const priceInputs = [
    'mon_am', 'mon_pm', 'tue_am', 'tue_pm',
    'wed_am', 'wed_pm', 'thu_am', 'thu_pm',
    'fri_am', 'fri_pm', 'sat_am', 'sat_pm'
  ];

  // Cargar datos guardados del localStorage
  loadSavedData();

  // Agregar listeners para autoguardado
  buyPriceInput.addEventListener('input', saveData);
  priceInputs.forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.addEventListener('input', saveData);
    }
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

    // Crear predictor y obtener resultados
    const predictor = new TurnipPredictor(buyPrice, knownPrices);
    const results = predictor.predict();

    // Mostrar resultados
    displayResults(results);
  }

  function clearEstimatedValues() {
    priceInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input && input.dataset.isEstimated === 'true') {
        // Limpiar el valor y los estilos
        input.value = '';
        input.classList.remove('estimated-value');
        delete input.dataset.isEstimated;
        delete input.dataset.min;
        delete input.dataset.max;
        input.title = '';
      }
    });
  }

  function displayResults(results) {
    // Mostrar sección de resultados
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');

    // Mostrar patrón con confianza y alternativas
    displayPattern(results.pattern, results.patternName, results.confidence, results.alternatives);

    // Llenar inputs con predicciones
    fillInputsWithPredictions(results.predictions);

    // Mostrar recomendaciones
    displayRecommendations(results.recommendation);

    // Mostrar mejor momento
    displayBestTime(results.bestTime);
  }

  function displayPattern(pattern, patternName, confidence, alternatives) {
    const patternBadge = document.getElementById('patternBadge');
    patternBadge.className = 'pattern-badge pattern-' + pattern;

    // Determinar nivel de confianza
    let confidenceClass = 'confidence-low';
    if (confidence >= 70) confidenceClass = 'confidence-high';
    else if (confidence >= 50) confidenceClass = 'confidence-medium';

    let html = `
      <div class="pattern-main">
        <span class="pattern-name">Patrón: ${patternName}</span>
        <span class="confidence-badge ${confidenceClass}">${confidence}% certeza</span>
      </div>
    `;

    // Mostrar alternativas si la confianza es baja o media
    if (confidence < 70 && alternatives && alternatives.length > 0) {
      html += `<div class="pattern-alternatives">`;
      html += `<small>También podría ser: `;
      html += alternatives.map(alt => `<strong>${alt.name}</strong>`).join(' o ');
      html += `</small></div>`;
    }

    patternBadge.innerHTML = html;
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
        input.value = avgEstimate;
        input.classList.add('estimated-value');
        input.classList.remove('confirmed-value');

        // Guardar los rangos como atributos de datos
        input.dataset.min = data.min;
        input.dataset.max = data.max;
        input.dataset.isEstimated = 'true';

        // Agregar tooltip con el rango
        input.title = `Estimado: ${data.min}-${data.max} bayas (click para editar)`;
      }
    });

    // Agregar event listeners para convertir estimados en confirmados al editar
    priceInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input && !input.dataset.hasEstimateListener) {
        input.addEventListener('focus', function() {
          if (this.dataset.isEstimated === 'true') {
            // Al hacer click en un valor estimado, limpiarlo para que el usuario pueda ingresar el real
            this.select();
          }
        });

        input.addEventListener('input', function() {
          if (this.dataset.isEstimated === 'true') {
            // Al modificar un valor estimado, marcarlo como confirmado
            this.classList.remove('estimated-value');
            this.classList.add('confirmed-value');
            delete this.dataset.isEstimated;
            delete this.dataset.min;
            delete this.dataset.max;
            this.title = '';
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
      buyPrice: buyPriceInput.value
    };

    priceInputs.forEach(id => {
      const input = document.getElementById(id);
      // Solo guardar valores confirmados, NO los estimados
      if (input && input.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });

    localStorage.setItem('turnipData', JSON.stringify(data));
  }

  function loadSavedData() {
    const savedData = localStorage.getItem('turnipData');
    if (savedData) {
      try {
        const data = JSON.parse(savedData);

        if (data.buyPrice) {
          buyPriceInput.value = data.buyPrice;
        }

        priceInputs.forEach(id => {
          if (data[id]) {
            const input = document.getElementById(id);
            if (input) {
              input.value = data[id];
            }
          }
        });
      } catch (e) {
        console.error('Error al cargar datos guardados:', e);
      }
    }
  }

  function clearAllData() {
    if (confirm('¿Estás seguro de que quieres borrar todos los datos?')) {
      // Limpiar inputs
      buyPriceInput.value = '';
      priceInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
          input.value = '';
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

  // Auto-calcular si hay datos guardados al cargar
  const savedData = localStorage.getItem('turnipData');
  if (savedData && buyPriceInput.value) {
    // Pequeño delay para que se vea la animación
    setTimeout(() => {
      calculatePrediction();
    }, 500);
  }
});