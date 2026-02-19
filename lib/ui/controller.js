import {
  BUY_PRICE_MAX, BUY_PRICE_MIN, DEBOUNCE_DELAY, LOADING_DELAY, PRICE_INPUT_IDS, TURNIP_PRICE_MAX,
  TURNIP_PRICE_MIN
} from "../constants.js";

import { buildProbabilityPanelHTML, buildRejectionReasonsHTML } from "./rendering.js";
import { encodeToBase64, getDataFromURL } from "./sharing.js";
import TurnipPatternPredictor from "../turnip-pattern-predictor.js";

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

  // Collect confirmed (non-estimated) sell prices from the DOM
  collectConfirmedPrices() {
    const data = {};
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input?.value && input.dataset.isEstimated !== 'true') {
        data[id] = input.value;
      }
    });
    return data;
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
    const confirmedPrices = utils.collectConfirmedPrices();
    const knownPrices = {};
    Object.entries(confirmedPrices).forEach(([id, val]) => {
      knownPrices[id] = parseInt(val);
    });

    // Get previous pattern if selected
    const previousPattern = previousPatternSelect.value || null;

    // Create predictor and get results
    const predictor = new TurnipPatternPredictor(buyPrice, knownPrices, previousPattern);
    const results = predictor.predict();

    // Display results
    displayResults(results);

    // Collect current data from the DOM
    const data = {
      buyPrice: buyPriceInput.value,
      previousPattern: previousPatternSelect.value,
      ...utils.collectConfirmedPrices()
    };

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
    document.getElementById('confidencePanel').innerHTML = buildProbabilityPanelHTML(results.patternName, results.allProbabilities);

    // Fill inputs with predictions
    fillInputsWithPredictions(results.predictions);

    // Mark the best time to sell
    markBestSellingTime(results.bestSellDay);

    // Show debug info with integrated recommendations
    const pricesArray = PRICE_INPUT_IDS.map(id => {
      const val = document.getElementById(id)?.value;
      return val ? parseInt(val) : null;
    }).filter(p => p !== null);

    const debugDiv = document.getElementById('debugInfo');
    if (debugDiv) {
      debugDiv.innerHTML = buildRejectionReasonsHTML(
        results.rejectionReasons, results.scoreReasons, results.allProbabilities,
        results.pattern, results.recommendations, pricesArray, parseInt(buyPriceInput.value)
      );
    }
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

  function saveData() {
    // Don't save to localStorage if URL has a query param
    // (we are viewing data shared by someone else)
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('turnipData')) {
      return;
    }

    const data = {
      buyPrice: buyPriceInput.value,
      previousPattern: previousPatternSelect.value,
      ...utils.collectConfirmedPrices()
    };

    localStorage.setItem('turnipData', JSON.stringify(data));
  }

  function loadSavedData() {
    // Try loading from URL first, then from localStorage
    let data = getDataFromURL(window.location.search);
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

  function clearSharedView() {
    if (!confirm('¿Quieres volver a tus datos guardados?')) return;

    // Remove query param from URL
    const urlParams = new URLSearchParams(window.location.search);
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

    enableAllInputs();
    updateClearButton(false);
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
      resultsSection.style.display = 'none';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearLocalData() {
    if (!confirm('¿Estás seguro de que quieres borrar todos los datos?')) return;

    buyPriceInput.value = '';
    previousPatternSelect.value = '';
    PRICE_INPUT_IDS.forEach(id => {
      const input = document.getElementById(id);
      if (input) {
        input.value = '';
        utils.clearEstimatedValue(input);
      }
    });

    localStorage.removeItem('turnipData');
    resultsSection.style.display = 'none';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function clearAllData() {
    const hasQueryParam = new URLSearchParams(window.location.search).has('turnipData');
    if (hasQueryParam) {
      clearSharedView();
    } else {
      clearLocalData();
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
      previousPattern: previousPatternSelect.value,
      ...utils.collectConfirmedPrices()
    };

    const encodedData = encodeToBase64(data);
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