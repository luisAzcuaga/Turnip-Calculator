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

    // Recopilar precios conocidos
    const knownPrices = {};
    priceInputs.forEach(id => {
      const input = document.getElementById(id);
      if (input && input.value) {
        knownPrices[id] = parseInt(input.value);
      }
    });

    // Crear predictor y obtener resultados
    const predictor = new TurnipPredictor(buyPrice, knownPrices);
    const results = predictor.predict();

    // Mostrar resultados
    displayResults(results);

    // Scroll suave a los resultados
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  function displayResults(results) {
    // Mostrar sección de resultados
    resultsSection.style.display = 'block';
    resultsSection.classList.add('fade-in');

    // Mostrar patrón
    displayPattern(results.pattern, results.patternName);

    // Mostrar tabla de predicciones
    displayPredictionsTable(results.predictions);

    // Mostrar recomendaciones
    displayRecommendations(results.recommendation);

    // Mostrar mejor momento
    displayBestTime(results.bestTime);
  }

  function displayPattern(pattern, patternName) {
    const patternBadge = document.getElementById('patternBadge');
    patternBadge.className = 'pattern-badge pattern-' + pattern;
    patternBadge.textContent = `Patrón: ${patternName}`;
  }

  function displayPredictionsTable(predictions) {
    const tbody = document.getElementById('predictionsBody');
    tbody.innerHTML = '';

    Object.entries(predictions).forEach(([key, data]) => {
      const row = document.createElement('tr');

      // Día/Turno
      const dayCell = document.createElement('td');
      dayCell.textContent = data.name;
      row.appendChild(dayCell);

      // Precio Actual
      const currentPriceCell = document.createElement('td');
      if (data.isConfirmed) {
        currentPriceCell.innerHTML = `<span class="price-confirmed">${data.confirmed} bayas ✓</span>`;
      } else {
        currentPriceCell.textContent = '-';
      }
      row.appendChild(currentPriceCell);

      // Rango Estimado
      const estimateCell = document.createElement('td');
      if (data.isConfirmed) {
        estimateCell.textContent = '-';
      } else {
        estimateCell.innerHTML = `<span class="price-estimate">${data.min}-${data.max} bayas</span>`;
      }
      row.appendChild(estimateCell);

      // Estado
      const statusCell = document.createElement('td');
      if (data.isConfirmed) {
        statusCell.innerHTML = '<span class="status-badge status-confirmed">Confirmado</span>';
      } else {
        // Marcar el mejor momento para vender
        if (data.max >= Math.max(...Object.values(predictions).map(p => p.max))) {
          statusCell.innerHTML = '<span class="status-badge status-best">⭐ Mejor momento</span>';
        } else {
          statusCell.innerHTML = '<span class="status-badge status-estimated">Estimado</span>';
        }
      }
      row.appendChild(statusCell);

      tbody.appendChild(row);
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
      if (input && input.value) {
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