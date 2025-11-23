// Predictor de Precios de Nabos - Animal Crossing New Horizons
// Basado en los patrones reales del juego

class TurnipPredictor {
  constructor(buyPrice, knownPrices = {}, previousPattern = null) {
    // Validar precio de compra
    if (buyPrice < BUY_PRICE_MIN || buyPrice > BUY_PRICE_MAX) {
      console.warn(`Precio de compra ${buyPrice} fuera de rango válido (${BUY_PRICE_MIN}-${BUY_PRICE_MAX})`);
    }

    this.buyPrice = buyPrice;
    this.knownPrices = this.validatePrices(knownPrices);
    this.previousPattern = previousPattern;
    this.patterns = {
      FLUCTUATING: 'fluctuating',
      LARGE_SPIKE: 'large_spike',
      DECREASING: 'decreasing',
      SMALL_SPIKE: 'small_spike'
    };

    this.patternNames = {
      'fluctuating': 'Fluctuante',
      'large_spike': 'Pico Grande',
      'decreasing': 'Decreciente',
      'small_spike': 'Pico Pequeño'
    };

    // Probabilidades por defecto (sin historial)
    this.defaultProbabilities = {
      'fluctuating': 0.35,
      'large_spike': 0.25,
      'decreasing': 0.15,
      'small_spike': 0.25
    };

    // Matriz de transición de patrones (basado en el código real de ACNH)
    // [patrón_anterior][patrón_actual] = probabilidad
    this.transitionProbabilities = {
      'fluctuating': {
        'fluctuating': 0.20,
        'large_spike': 0.30,
        'decreasing': 0.15,
        'small_spike': 0.35
      },
      'large_spike': {
        'fluctuating': 0.50,
        'large_spike': 0.05,
        'decreasing': 0.20,
        'small_spike': 0.25
      },
      'decreasing': {
        'fluctuating': 0.25,
        'large_spike': 0.45,
        'decreasing': 0.05,
        'small_spike': 0.25
      },
      'small_spike': {
        'fluctuating': 0.45,
        'large_spike': 0.25,
        'decreasing': 0.15,
        'small_spike': 0.15
      }
    };
  }

  // Validar precios conocidos
  validatePrices(knownPrices) {
    const validated = {};

    Object.entries(knownPrices).forEach(([key, price]) => {
      if (price === undefined || price === null || price === '') {
        return; // Skip empty values
      }

      const numPrice = parseInt(price);

      if (isNaN(numPrice)) {
        console.warn(`Precio inválido para ${key}: ${price}`);
        return;
      }

      if (numPrice < TURNIP_PRICE_MIN || numPrice > TURNIP_PRICE_MAX) {
        console.warn(`Precio ${numPrice} para ${key} fuera de rango válido (${TURNIP_PRICE_MIN}-${TURNIP_PRICE_MAX}). Ignorando.`);
        return;
      }

      validated[key] = numPrice;
    });

    return validated;
  }

  // Obtener array de precios conocidos con sus índices
  getPriceArrayWithIndices() {
    return DAYS_CONFIG
      .map((day, index) => ({ index, price: this.knownPrices[day.key], day: day.key }))
      .filter(({ price }) => price !== undefined && price !== null && price !== '')
      .map(({ index, price, day }) => ({ index, price: parseInt(price), day }));
  }

  // Detectar patrones posibles basados en los precios conocidos
  detectPossiblePatterns() {
    const knownPrices = this.getPriceArrayWithIndices();

    if (knownPrices.length === 0) {
      // Sin datos, todos los patrones son posibles
      return Object.values(this.patterns);
    }

    const possiblePatterns = [];

    // Verificar cada patrón
    if (this.isPossibleDecreasing(knownPrices)) {
      possiblePatterns.push(this.patterns.DECREASING);
    }
    if (this.isPossibleLargeSpike(knownPrices)) {
      possiblePatterns.push(this.patterns.LARGE_SPIKE);
    }
    if (this.isPossibleSmallSpike(knownPrices)) {
      possiblePatterns.push(this.patterns.SMALL_SPIKE);
    }
    if (this.isPossibleFluctuating(knownPrices)) {
      possiblePatterns.push(this.patterns.FLUCTUATING);
    }

    // Si ningún patrón encaja, devolver fluctuante como fallback
    return possiblePatterns.length > 0 ? possiblePatterns : [this.patterns.FLUCTUATING];
  }

  // Verificar si el patrón DECRECIENTE es posible
  isPossibleDecreasing(knownPrices) {
    // En patrón decreciente, cada precio debe ser <= al anterior
    // y todos deben estar entre 85% y 40% del precio base
    return knownPrices.every((current, i) => {
      const { price, index } = current;
      const expectedMax = this.buyPrice * (0.9 - (index * 0.03));
      const expectedMin = this.buyPrice * 0.40;

      // El precio debe estar en el rango del patrón decreciente
      if (price > expectedMax * 1.05 || price < expectedMin * 0.85) {
        return false;
      }

      // Verificar que no haya subidas significativas
      if (i > 0 && price > knownPrices[i - 1].price * 1.05) {
        return false;
      }

      return true;
    });
  }

  // Verificar si el patrón PICO GRANDE es posible
  isPossibleLargeSpike(knownPrices) {
    if (knownPrices.length === 0) return true;

    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const maxRatio = maxPrice / this.buyPrice;
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // Si encuentra un precio muy alto (200%+), definitivamente es pico grande
    if (maxRatio >= 2.0) {
      return true;
    }

    // Si el pico máximo está claramente en el rango de Small Spike (140-200%)
    // Y ya estamos tarde en la semana (viernes o después), rechazar Large Spike
    if (maxRatio >= 1.4 && maxRatio < 2.0 && maxKnownIndex >= 8) {
      // Buscar si hay señales claras de que es Large Spike
      // (ej: subidas muy rápidas que indiquen que aún viene el pico grande)
      const hasRapidIncrease = knownPrices.some((current, i) => {
        if (i === 0) return false;

        const previous = knownPrices[i - 1];
        // Subida de más de 100% en un período
        return current.price > previous.price * 2.0;
      });

      // Si no hay subidas muy rápidas y el pico está en rango de Small Spike,
      // es muy probable que sea Small Spike, no Large Spike
      if (!hasRapidIncrease) {
        return false;
      }
    }

    // Si estamos muy tarde (sábado PM) y el pico fue bajo, rechazar
    if (maxKnownIndex >= 11 && maxRatio < 1.4) {
      return false;
    }

    // En otros casos, mantener como posible (aún puede venir el pico)
    return true;
  }

  // Verificar si el patrón PICO PEQUEÑO es posible
  isPossibleSmallSpike(knownPrices) {
    if (knownPrices.length === 0) return true;

    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const maxRatio = maxPrice / this.buyPrice;
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // Si encuentra un precio muy alto (> 200%), no puede ser pico pequeño
    // (sería pico grande)
    if (maxRatio > 2.0) {
      return false;
    }

    // Si el pico está en el rango perfecto de Small Spike (140-200%)
    // Y ya estamos en viernes o después, es muy probable que sea Small Spike
    if (maxRatio >= 1.4 && maxRatio < 2.0 && maxKnownIndex >= 8) {
      return true; // Confirmación fuerte de Small Spike
    }

    // Si estamos muy tarde en la semana (sábado PM) y no hubo pico significativo
    if (maxKnownIndex >= 11) {
      // El pico ya debería haber ocurrido
      // Si el precio máximo fue < 90%, es muy improbable que sea pico pequeño
      if (maxRatio < 0.90) {
        return false;
      }
    }

    // En otros casos, mantener como posible
    return true;
  }

  // Verificar si el patrón FLUCTUANTE es posible
  isPossibleFluctuating(knownPrices) {
    // El patrón fluctuante permite precios entre 60% y 140% del base
    return knownPrices.every(({ price }) => {
      const ratio = price / this.buyPrice;
      // Si hay picos muy altos o muy bajos, probablemente no es fluctuante
      return ratio <= 1.5 && ratio >= 0.5;
    });
  }

  // Obtener probabilidades base según el patrón anterior
  getBaseProbabilities() {
    // Regla especial del juego: si previousPattern es un número >= 4, forzar Decreasing
    // (Esto es un failsafe del código original para valores inválidos)
    if (typeof this.previousPattern === 'number' && this.previousPattern >= 4) {
      return {
        'fluctuating': 0,
        'large_spike': 0,
        'decreasing': 1.0,
        'small_spike': 0
      };
    }

    // Si conocemos el patrón anterior, usar probabilidades de transición
    if (this.previousPattern && this.transitionProbabilities[this.previousPattern]) {
      return this.transitionProbabilities[this.previousPattern];
    }

    // Sin patrón anterior, usar probabilidades por defecto
    return this.defaultProbabilities;
  }

  // Detectar el patrón más probable con información de confianza
  detectPattern() {
    const possiblePatterns = this.detectPossiblePatterns();
    const knownPrices = this.getPriceArrayWithIndices();
    const baseProbabilities = this.getBaseProbabilities();

    // Si no hay datos de precios, usar solo las probabilidades base
    if (knownPrices.length === 0) {
      // Calcular porcentajes basados en probabilidades
      const percentages = {};
      let totalProb = 0;

      possiblePatterns.forEach(pattern => {
        const prob = baseProbabilities[pattern] || 0;
        percentages[pattern] = prob;
        totalProb += prob;
      });

      // Normalizar a 100%
      if (totalProb > 0) {
        Object.keys(percentages).forEach(pattern => {
          percentages[pattern] = Math.round((percentages[pattern] / totalProb) * 100);
        });
      }

      // Encontrar el patrón más probable
      const sortedByProb = possiblePatterns.sort((a, b) =>
        (baseProbabilities[b] || 0) - (baseProbabilities[a] || 0)
      );
      const primaryPattern = sortedByProb[0];

      // Confianza base dependiendo de si conocemos el patrón anterior
      const baseConfidence = this.previousPattern ? 50 : 35;

      return {
        primary: primaryPattern,
        confidence: baseConfidence,
        alternatives: sortedByProb.slice(1, 3).map(p => ({
          pattern: p,
          percentage: percentages[p]
        })),
        percentages: percentages
      };
    }

    // Calcular score combinando probabilidades base con análisis de datos
    const scores = {};
    possiblePatterns.forEach(pattern => {
      const dataScore = this.calculatePatternScore(pattern, knownPrices);
      const probabilityScore = (baseProbabilities[pattern] || 0) * 100; // Convertir a escala 0-100

      // Combinar scores: mantener peso mínimo de 40% para probabilidades
      // Con 0 precios: 100% probabilidades
      // Con 6 precios: 50% probabilidades
      // Con 12 precios: 40% probabilidades (mínimo)
      const dataWeight = Math.min(knownPrices.length / 12, 0.6); // Max 60% peso a datos
      const probWeight = 1 - dataWeight; // Min 40% peso a probabilidades

      scores[pattern] = (dataScore * dataWeight) + (probabilityScore * probWeight);
    });

    // Ordenar patrones por score
    const sortedPatterns = possiblePatterns.sort((a, b) => scores[b] - scores[a]);
    const bestPattern = sortedPatterns[0];
    const bestScore = scores[bestPattern];

    // Calcular confianza basada en la cantidad de datos y la diferencia de scores
    const dataConfidence = Math.min(knownPrices.length * 8, 40); // Max 40% por cantidad de datos

    // Bonus de confianza si conocemos el patrón anterior
    const historyBonus = this.previousPattern ? 15 : 0;

    let scoreConfidence = 30; // Base
    if (sortedPatterns.length > 1) {
      const secondScore = scores[sortedPatterns[1]];
      const scoreDiff = bestScore - secondScore;
      scoreConfidence = Math.min(scoreDiff, 60); // Max 60% por diferencia de score
    }

    // Bonus: si los top 2 patrones son ambos picos (large/small), sabemos que ES un pico
    const spikePatterns = [this.patterns.LARGE_SPIKE, this.patterns.SMALL_SPIKE];
    let patternFamilyBonus = 0;
    if (sortedPatterns.length > 1) {
      const topTwo = [sortedPatterns[0], sortedPatterns[1]];
      const bothAreSpikes = topTwo.every(p => spikePatterns.includes(p));
      if (bothAreSpikes) {
        patternFamilyBonus = 25; // Sabemos que es un pico, solo dudamos del tamaño
      }
    }

    // Bonus: si el mejor score es alto (>70), dar confianza base por certeza absoluta
    let absoluteScoreBonus = 0;
    if (bestScore > 70) {
      absoluteScoreBonus = Math.min(Math.round((bestScore - 70) / 2), 15);
    }

    const totalConfidence = Math.min(
      dataConfidence + scoreConfidence + historyBonus + patternFamilyBonus + absoluteScoreBonus,
      100
    );

    // Convertir scores a porcentajes
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const percentages = {};
    Object.keys(scores).forEach(pattern => {
      percentages[pattern] = totalScore > 0 ? Math.round((scores[pattern] / totalScore) * 100) : 0;
    });

    return {
      primary: bestPattern,
      confidence: Math.round(totalConfidence),
      alternatives: sortedPatterns.slice(1, 3).map(p => ({
        pattern: p,
        percentage: percentages[p]
      })),
      scores: scores,
      percentages: percentages
    };
  }

  // Calcular qué tan bien encajan los datos con un patrón
  calculatePatternScore(pattern, knownPrices) {
    let score = 0;
    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const avgPrice = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
    const ratio = maxPrice / this.buyPrice;

    switch (pattern) {
      case this.patterns.DECREASING:
        // Penalizar si hay subidas
        const isDecreasing = knownPrices.every((current, i) => {
          if (i === 0) return true;

          return current.price <= knownPrices[i - 1].price;
        });
        score = isDecreasing ? 100 : 20;
        // Bonus si el promedio es bajo
        if (avgPrice < this.buyPrice * 0.8) score += 30;
        break;

      case this.patterns.LARGE_SPIKE:
        // Bonus si hay un pico muy alto (200%+)
        if (ratio >= 2.0) {
          score += 100; // Confirmación definitiva de Large Spike
        } else if (ratio >= 1.5 && ratio < 2.0) {
          // Rango ambiguo: podría ser Small Spike o Large Spike
          // Penalizar si está muy cerca del límite de Small Spike
          if (ratio < 1.9) {
            score += 10; // Penalización: probablemente sea Small Spike
          } else {
            score += 30; // Cerca del límite de Large Spike (190-200%)
          }
        } else {
          // Ratio < 1.5: muy improbable que sea Large Spike
          score += 5;
        }

        // Bonus si hay fase baja seguida de pico muy rápido
        const hasLowToHigh = knownPrices.some((p, i) =>
          i > 0 && p.price > knownPrices[i-1].price * 2.0 && knownPrices[i-1].price < this.buyPrice
        );
        if (hasLowToHigh) score += 40;

        score += 10; // Base score reducido (menos común que Small Spike)
        break;

      case this.patterns.SMALL_SPIKE:
        // Bonus si hay pico moderado en el rango exacto de Small Spike
        if (ratio >= 1.4 && ratio < 2.0) {
          // Dentro del rango perfecto de Small Spike
          if (ratio >= 1.5 && ratio <= 1.9) {
            score += 90; // Rango ideal de Small Spike
          } else {
            score += 70; // En los bordes del rango
          }
        } else if (ratio >= 1.2 && ratio < 1.4) {
          score += 40; // Podría ser pre-pico de Small Spike
        } else if (ratio >= 2.0) {
          // Definitivamente NO es Small Spike
          score = 0;
        }

        // Bonus si hay fase baja seguida de subida moderada
        const hasModerateIncrease = knownPrices.some((p, i) =>
          i > 0 && p.price > knownPrices[i-1].price * 1.3 && p.price < knownPrices[i-1].price * 2.0
        );
        if (hasModerateIncrease) score += 20;

        score += 20; // Base score
        break;

      case this.patterns.FLUCTUATING:
        // Bonus si los precios varían pero sin extremos
        if (ratio < 1.5 && ratio > 0.8) score += 50;
        score += 30; // Base score (más común)
        break;
    }

    return score;
  }

  predict() {
    const patternResult = this.detectPattern();
    const pattern = patternResult.primary;
    const predictions = {};

    DAYS_CONFIG.forEach((day, index) => {
      const price = this.knownPrices[day.key];
      if (price !== undefined && price !== null && price !== '') {
        predictions[day.key] = {
          name: day.name,
          confirmed: parseInt(price),
          min: parseInt(price),
          max: parseInt(price),
          isConfirmed: true
        };
      } else {
        const estimate = this.predictPrice(pattern, index);
        predictions[day.key] = {
          name: day.name,
          confirmed: null,
          min: estimate.min,
          max: estimate.max,
          isConfirmed: false
        };
      }
    });

    // Asegurar que tenemos probabilidades para los 4 patrones
    const allProbabilities = {
      'fluctuating': patternResult.percentages['fluctuating'] || 0,
      'large_spike': patternResult.percentages['large_spike'] || 0,
      'decreasing': patternResult.percentages['decreasing'] || 0,
      'small_spike': patternResult.percentages['small_spike'] || 0
    };

    return {
      pattern: pattern,
      patternName: this.patternNames[pattern],
      confidence: patternResult.confidence,
      primaryPercentage: patternResult.percentages[pattern],
      allProbabilities: allProbabilities,
      alternatives: patternResult.alternatives.map(alt => ({
        pattern: alt.pattern,
        name: this.patternNames[alt.pattern],
        percentage: alt.percentage
      })),
      predictions: predictions,
      recommendation: this.getRecommendation(pattern),
      bestTime: this.getBestTime(predictions)
    };
  }

  predictPrice(pattern, periodIndex) {
    const base = this.buyPrice;
    const knownPricesArray = this.getPriceArrayWithIndices();

    switch (pattern) {
      case this.patterns.DECREASING:
        return this.decreasingPattern(periodIndex, base, knownPricesArray);

      case this.patterns.LARGE_SPIKE:
        return this.largeSpikePattern(periodIndex, base, knownPricesArray);

      case this.patterns.SMALL_SPIKE:
        return this.smallSpikePattern(periodIndex, base, knownPricesArray);

      case this.patterns.FLUCTUATING:
      default:
        return this.fluctuatingPattern(periodIndex, base, knownPricesArray);
    }
  }

  // Métodos auxiliares para ajuste dinámico
  detectPricePhase(knownPrices) {
    if (knownPrices.length < 2) return 'unknown';

    const prices = knownPrices.map(p => p.price);
    const last = prices[prices.length - 1];
    const secondLast = prices[prices.length - 2];

    // Detectar tendencia reciente
    if (last > secondLast * 1.2) return 'rising';  // Subiendo rápido
    if (last > secondLast) return 'increasing';    // Subiendo
    if (last < secondLast * 0.9) return 'falling'; // Bajando rápido
    if (last < secondLast) return 'decreasing';    // Bajando
    return 'stable';                               // Estable
  }

  findPeakInKnownPrices(knownPrices) {
    if (knownPrices.length === 0) return null;

    let maxPrice = 0;
    let maxIndex = -1;

    knownPrices.forEach(p => {
      if (p.price > maxPrice) {
        maxPrice = p.price;
        maxIndex = p.index;
      }
    });

    return { price: maxPrice, index: maxIndex };
  }

  calculateVolatility(knownPrices) {
    if (knownPrices.length < 2) return 0;

    const prices = knownPrices.map(p => p.price);
    const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
    const squaredDiffs = prices.map(p => Math.pow(p - avg, 2));
    const variance = squaredDiffs.reduce((sum, d) => sum + d, 0) / prices.length;
    const stdDev = Math.sqrt(variance);

    return (stdDev / avg) * 100; // Volatilidad como porcentaje
  }

  // Patrón DECRECIENTE: bajada constante del 90% al 40%
  decreasingPattern(periodIndex, base, knownPrices = []) {
    return calculateDecreasingPattern(periodIndex, base, knownPrices);
  }

  // Patrón PICO GRANDE: bajo → pico altísimo (hasta 600%) → bajo
  // Basado en el algoritmo real datamineado del juego (Pattern 1)
  largeSpikePattern(periodIndex, base, knownPrices = []) {
    return calculateLargeSpikePattern(periodIndex, base, knownPrices);
  }

  // Patrón PICO PEQUEÑO: similar al grande pero pico menor (140-200%)
  // Basado en el algoritmo real datamineado del juego (Pattern 3)
  smallSpikePattern(periodIndex, base, knownPrices = []) {
    return calculateSmallSpikePattern(periodIndex, base, knownPrices);
  }

  // Patrón FLUCTUANTE: variable, 60-140%
  fluctuatingPattern(periodIndex, base, knownPrices = []) {
    return calculateFluctuatingPattern(periodIndex, base, knownPrices);
  }

  getRecommendation(pattern) {
    let rec = [];

    switch (pattern) {
      case this.patterns.DECREASING:
        rec.push('📉 Los precios solo bajarán toda la semana');
        rec.push('💡 Vende HOY o visita otra isla');
        rec.push('🏃‍♂️ No esperes, solo empeorarán');
        break;

      case this.patterns.LARGE_SPIKE:
        rec.push('💰 Espera un pico altísimo (puede llegar a 400-600 bayas)');
        rec.push('📅 El pico suele ser miércoles-jueves');
        rec.push('⏰ ¡Revisa los precios cada turno!');
        rec.push('✨ Este es el MEJOR patrón posible');
        break;

      case this.patterns.SMALL_SPIKE:
        rec.push('💵 Espera un pico moderado (140-200 bayas)');
        rec.push('📅 El pico suele ser jueves-viernes');
        rec.push('👍 Buena oportunidad para ganancias');
        break;

      case this.patterns.FLUCTUATING:
      default:
        rec.push('🎲 Precios variables durante la semana');
        rec.push('✅ Vende cuando supere tu precio de compra');
        rec.push('⚖️ Patrón impredecible, mantente atento');
        break;
    }

    return rec;
  }

  getBestTime(predictions) {
    let bestPrice = 0;
    let bestDay = '';
    let bestIsConfirmed = false;

    Object.values(predictions).forEach((data) => {
      const maxPrice = data.isConfirmed ? data.confirmed : data.max;
      if (maxPrice > bestPrice) {
        bestPrice = maxPrice;
        bestDay = data.name;
        bestIsConfirmed = data.isConfirmed;
      }
    });

    return {
      day: bestDay,
      price: bestPrice,
      isConfirmed: bestIsConfirmed
    };
  }
}
