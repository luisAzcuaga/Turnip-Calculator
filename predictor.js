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
    for (let i = 0; i < knownPrices.length; i++) {
      const price = knownPrices[i].price;
      const expectedMax = this.buyPrice * (0.9 - (knownPrices[i].index * 0.03));
      const expectedMin = this.buyPrice * 0.40;

      // El precio debe estar en el rango del patrón decreciente
      if (price > expectedMax * 1.05 || price < expectedMin * 0.85) {
        return false;
      }

      // Verificar que no haya subidas significativas
      if (i > 0 && price > knownPrices[i - 1].price * 1.05) {
        return false;
      }
    }
    return true;
  }

  // Verificar si el patrón PICO GRANDE es posible
  isPossibleLargeSpike(knownPrices) {
    let hasHighPeak = false;

    for (let i = 0; i < knownPrices.length; i++) {
      const price = knownPrices[i].price;
      const ratio = price / this.buyPrice;

      // Si encuentra un precio muy alto (200%+), definitivamente es pico grande
      if (ratio >= 2.0) {
        hasHighPeak = true;
        break; // Ya confirmamos que es posible
      }
    }

    // Si ya vimos un pico alto, es posible
    if (hasHighPeak) {
      return true;
    }

    // Si estamos muy tarde en la semana (después del sábado AM) y no hubo pico alto
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));
    if (maxKnownIndex >= 10) {
      // El pico ya debería haber ocurrido
      // Verificar si al menos hay precios que indiquen fase de pico
      const maxPrice = Math.max(...knownPrices.map(p => p.price));
      const maxRatio = maxPrice / this.buyPrice;

      // Si el precio máximo fue < 140%, es muy improbable que sea pico grande
      if (maxRatio < 1.4) {
        return false;
      }
    }

    // En otros casos, mantener como posible (aún puede venir el pico)
    return true;
  }

  // Verificar si el patrón PICO PEQUEÑO es posible
  isPossibleSmallSpike(knownPrices) {
    for (let i = 0; i < knownPrices.length; i++) {
      const price = knownPrices[i].price;
      const ratio = price / this.buyPrice;

      // Si encuentra un precio muy alto (> 200%), no puede ser pico pequeño
      // (sería pico grande)
      if (ratio > 2.0) {
        return false;
      }
    }

    // Si estamos muy tarde en la semana (después del sábado PM) y no hubo pico
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));
    if (maxKnownIndex >= 11) {
      // El pico ya debería haber ocurrido
      const maxPrice = Math.max(...knownPrices.map(p => p.price));
      const maxRatio = maxPrice / this.buyPrice;

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
    for (let i = 0; i < knownPrices.length; i++) {
      const price = knownPrices[i].price;
      const ratio = price / this.buyPrice;

      // Si hay picos muy altos o muy bajos, probablemente no es fluctuante
      if (ratio > 1.5 || ratio < 0.5) {
        return false;
      }
    }
    return true;
  }

  // Obtener probabilidades base según el patrón anterior
  getBaseProbabilities() {
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

      // Combinar scores: más peso a los datos si tenemos muchos, más a probabilidades si tenemos pocos
      const dataWeight = Math.min(knownPrices.length / 12, 0.7); // Max 70% peso a datos
      const probWeight = 1 - dataWeight;

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
    const minPrice = Math.min(...knownPrices.map(p => p.price));
    const avgPrice = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
    const ratio = maxPrice / this.buyPrice;

    switch (pattern) {
      case this.patterns.DECREASING:
        // Penalizar si hay subidas
        let isDecreasing = true;
        for (let i = 1; i < knownPrices.length; i++) {
          if (knownPrices[i].price > knownPrices[i - 1].price) {
            isDecreasing = false;
          }
        }
        score = isDecreasing ? 100 : 20;
        // Bonus si el promedio es bajo
        if (avgPrice < this.buyPrice * 0.8) score += 30;
        break;

      case this.patterns.LARGE_SPIKE:
        // Bonus si hay un pico muy alto
        if (ratio >= 2.0) score += 80;
        else if (ratio >= 1.5) score += 40;

        // Bonus si hay fase baja seguida de pico
        const hasLowToHigh = knownPrices.some((p, i) =>
          i > 0 && p.price > knownPrices[i-1].price * 1.5 && knownPrices[i-1].price < this.buyPrice
        );
        if (hasLowToHigh) score += 30;
        score += 20; // Base score
        break;

      case this.patterns.SMALL_SPIKE:
        // Bonus si hay pico moderado
        if (ratio >= 1.4 && ratio < 2.0) score += 70;
        else if (ratio >= 1.2 && ratio < 1.4) score += 40;
        score += 20;
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
      recommendation: this.getRecommendation(pattern, predictions),
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
    // Si tenemos datos conocidos, calcular la tasa real observada
    let observedRate = null;
    if (knownPrices.length >= 2) {
      // Calcular tasa de decrecimiento promedio entre precios conocidos
      let totalRateChange = 0;
      let rateCount = 0;

      for (let i = 1; i < knownPrices.length; i++) {
        const prevPrice = knownPrices[i - 1].price;
        const currPrice = knownPrices[i].price;
        const rateChange = (prevPrice - currPrice) / prevPrice;
        totalRateChange += rateChange;
        rateCount++;
      }

      observedRate = totalRateChange / rateCount;
    }

    // Si estamos prediciendo un período para el cual ya pasamos datos conocidos,
    // usar la tasa observada para proyectar
    if (observedRate !== null && knownPrices.length > 0) {
      const lastKnown = knownPrices[knownPrices.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;

      if (periodsAhead > 0) {
        // Proyectar desde el último precio conocido
        const projected = lastKnown.price * Math.pow(1 - observedRate, periodsAhead);
        return {
          min: Math.round(projected * 0.90),
          max: Math.round(projected * 1.10)
        };
      }
    }

    // Fallback: usar tasa conservadora por defecto
    const rate = 0.90 - (periodIndex * 0.025);
    const price = Math.round(base * Math.max(0.40, rate));

    return {
      min: Math.round(price * 0.90),
      max: Math.round(price * 1.05)
    };
  }

  // Detecta dinámicamente dónde empieza la fase de pico en patrones de Spike
  // Basado en análisis de precios conocidos
  detectSpikePeakStart(knownPrices, minPeakStart, maxPeakStart, isLargeSpike) {
    if (knownPrices.length === 0) {
      return 6; // Default: miércoles PM (período típico)
    }

    // Buscar el primer precio que sube significativamente desde fase baja
    for (let i = 1; i < knownPrices.length; i++) {
      const current = knownPrices[i];
      const previous = knownPrices[i - 1];

      // Detectar subida significativa (transición a fase de pico)
      if (current.price > previous.price * 1.3) {
        // Este es probablemente el inicio de la fase de pico
        const estimatedStart = Math.max(minPeakStart, current.index);
        return Math.min(maxPeakStart, estimatedStart);
      }
    }

    // Buscar el precio máximo conocido
    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const maxPriceData = knownPrices.find(p => p.price === maxPrice);

    if (maxPriceData) {
      const baseEstimate = knownPrices[0]?.price || 100;
      const ratio = maxPrice / baseEstimate;

      // Large Spike: pico máximo en 200-600%
      if (isLargeSpike && ratio >= 2.0) {
        // El pico máximo está en peakStart+2
        const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 2);
        return Math.min(maxPeakStart, estimatedPeakStart);
      }

      // Small Spike: pico máximo en 140-200%
      if (!isLargeSpike && ratio >= 1.4) {
        // El pico máximo está en peakStart+2, +3, o +4
        const estimatedPeakStart = Math.max(minPeakStart, maxPriceData.index - 3);
        return Math.min(maxPeakStart, estimatedPeakStart);
      }
    }

    // Si hay tendencia decreciente, el pico probablemente ya pasó o está cerca
    const lastKnownIndex = knownPrices[knownPrices.length - 1]?.index || 5;

    // Si estamos en fase baja tardía, asumir que el pico será pronto
    if (lastKnownIndex >= 4) {
      return Math.max(minPeakStart, Math.min(maxPeakStart, lastKnownIndex));
    }

    // Fallback: usar período medio del rango válido
    return Math.floor((minPeakStart + maxPeakStart) / 2);
  }

  // Patrón PICO GRANDE: bajo → pico altísimo (hasta 600%) → bajo
  // Basado en el algoritmo real datamineado del juego (Pattern 1)
  largeSpikePattern(periodIndex, base, knownPrices = []) {
    // peakStart puede ser 3-9 según el algoritmo del juego
    const peakStart = this.detectSpikePeakStart(knownPrices, 3, 9, true);

    // Fase 1: DECRECIENTE (períodos 0 hasta peakStart-1)
    // Empieza en 85-90%, baja 3-5% cada período
    if (periodIndex < peakStart) {
      const decreasingPhase = knownPrices.filter(p => p.index < peakStart);

      if (decreasingPhase.length >= 2) {
        // Calcular tasa de decrecimiento observada
        let totalRate = 0;
        for (let i = 1; i < decreasingPhase.length; i++) {
          const rate = (decreasingPhase[i - 1].price - decreasingPhase[i].price) / decreasingPhase[i - 1].price;
          totalRate += rate;
        }
        const avgRate = totalRate / (decreasingPhase.length - 1);

        const lastKnown = decreasingPhase[decreasingPhase.length - 1];
        const periodsAhead = periodIndex - lastKnown.index;
        if (periodsAhead > 0) {
          const projected = lastKnown.price * Math.pow(1 - avgRate, periodsAhead);
          return {
            min: Math.round(projected * 0.90),
            max: Math.round(projected * 1.10)
          };
        }
      }

      // Sin datos suficientes: usar rangos del algoritmo
      const initialRate = 0.875; // Promedio de 0.85-0.90
      const decayPerPeriod = 0.04; // Promedio de 0.03-0.05
      const rate = Math.max(0.40, initialRate - (periodIndex * decayPerPeriod));
      const price = base * rate;

      return {
        min: Math.round(price * 0.85),
        max: Math.round(price * 1.10)
      };
    }

    // Fase 2: PICO (5 períodos consecutivos desde peakStart)
    const peakPhaseIndex = periodIndex - peakStart;

    if (peakPhaseIndex >= 0 && peakPhaseIndex < 5) {
      // Rangos según el algoritmo del juego:
      // peakStart+0: 90-140%
      // peakStart+1: 140-200%
      // peakStart+2: 200-600% (PICO MÁXIMO)
      // peakStart+3: 140-200%
      // peakStart+4: 90-140%
      const peakPhaseRanges = [
        { min: 0.90, max: 1.40 },
        { min: 1.40, max: 2.00 },
        { min: 2.00, max: 6.00 },
        { min: 1.40, max: 2.00 },
        { min: 0.90, max: 1.40 }
      ];

      const range = peakPhaseRanges[peakPhaseIndex];
      return {
        min: Math.round(base * range.min),
        max: Math.round(base * range.max)
      };
    }

    // Fase 3: BAJA FINAL (después del pico)
    return {
      min: Math.round(base * 0.40),
      max: Math.round(base * 0.90)
    };
  }

  // Patrón PICO PEQUEÑO: similar al grande pero pico menor (140-200%)
  // Basado en el algoritmo real datamineado del juego (Pattern 3)
  smallSpikePattern(periodIndex, base, knownPrices = []) {
    // peakStart puede ser 2-9 según el algoritmo del juego
    const peakStart = this.detectSpikePeakStart(knownPrices, 2, 9, false);

    // Fase 1: DECRECIENTE (períodos 0 hasta peakStart-1)
    // Empieza en 40-90%, baja 3-5% cada período
    if (periodIndex < peakStart) {
      const decreasingPhase = knownPrices.filter(p => p.index < peakStart);

      if (decreasingPhase.length >= 2) {
        // Calcular tasa de decrecimiento observada
        let totalRate = 0;
        for (let i = 1; i < decreasingPhase.length; i++) {
          const rate = (decreasingPhase[i - 1].price - decreasingPhase[i].price) / decreasingPhase[i - 1].price;
          totalRate += rate;
        }
        const avgRate = totalRate / (decreasingPhase.length - 1);

        const lastKnown = decreasingPhase[decreasingPhase.length - 1];
        const periodsAhead = periodIndex - lastKnown.index;
        if (periodsAhead > 0) {
          const projected = lastKnown.price * Math.pow(1 - avgRate, periodsAhead);
          return {
            min: Math.round(projected * 0.90),
            max: Math.round(projected * 1.10)
          };
        }
      }

      // Sin datos suficientes: usar rangos del algoritmo
      const initialRate = 0.65; // Promedio de 0.40-0.90
      const decayPerPeriod = 0.04; // Promedio de 0.03-0.05
      const rate = Math.max(0.40, initialRate - (periodIndex * decayPerPeriod));
      const price = base * rate;

      return {
        min: Math.round(price * 0.80),
        max: Math.round(price * 1.20)
      };
    }

    // Fase 2: PICO (5 períodos consecutivos desde peakStart)
    const peakPhaseIndex = periodIndex - peakStart;

    if (peakPhaseIndex >= 0 && peakPhaseIndex < 5) {
      // Rangos según el algoritmo del juego:
      // peakStart+0: 90-140%
      // peakStart+1: 90-140%
      // peakStart+2: 140-200%
      // peakStart+3: 140-200% (usualmente el pico máximo)
      // peakStart+4: 140-200%
      const peakPhaseRanges = [
        { min: 0.90, max: 1.40 },
        { min: 0.90, max: 1.40 },
        { min: 1.40, max: 2.00 },
        { min: 1.40, max: 2.00 },
        { min: 1.40, max: 2.00 }
      ];

      const range = peakPhaseRanges[peakPhaseIndex];
      return {
        min: Math.round(base * range.min),
        max: Math.round(base * range.max)
      };
    }

    // Fase 3: DECRECIENTE FINAL (después del pico)
    const finalDecreasingPhase = knownPrices.filter(p => p.index >= peakStart + 5);

    if (finalDecreasingPhase.length >= 2) {
      // Calcular tasa de decrecimiento observada
      let totalRate = 0;
      for (let i = 1; i < finalDecreasingPhase.length; i++) {
        const rate = (finalDecreasingPhase[i - 1].price - finalDecreasingPhase[i].price) / finalDecreasingPhase[i - 1].price;
        totalRate += rate;
      }
      const avgRate = totalRate / (finalDecreasingPhase.length - 1);

      const lastKnown = finalDecreasingPhase[finalDecreasingPhase.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;
      if (periodsAhead > 0) {
        const projected = lastKnown.price * Math.pow(1 - avgRate, periodsAhead);
        return {
          min: Math.round(projected * 0.90),
          max: Math.round(projected * 1.10)
        };
      }
    }

    // Sin datos suficientes en fase final: usar rangos del algoritmo
    return {
      min: Math.round(base * 0.40),
      max: Math.round(base * 0.90)
    };
  }

  // Patrón FLUCTUANTE: variable, 60-140%
  fluctuatingPattern(periodIndex, base, knownPrices = []) {
    // Calcular volatilidad para ajustar rangos
    const volatility = this.calculateVolatility(knownPrices);

    // Ajustar rangos según volatilidad observada
    let minMultiplier = 0.60;
    let maxMultiplier = 1.40;

    if (volatility > 0) {
      if (volatility < 10) {
        // Baja volatilidad: rangos más estrechos
        minMultiplier = 0.70;
        maxMultiplier = 1.20;
      } else if (volatility > 20) {
        // Alta volatilidad: rangos más amplios
        minMultiplier = 0.50;
        maxMultiplier = 1.50;
      }
      // Volatilidad media (10-20%): usar rangos por defecto (0.60-1.40)
    }

    // Si tenemos datos recientes, proyectar basándose en la última tendencia
    if (knownPrices.length > 0) {
      const lastKnown = knownPrices[knownPrices.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;

      if (periodsAhead > 0 && periodsAhead <= 2) {
        // Proyección de corto plazo: usar último precio como referencia
        const avgPrice = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
        const refPrice = (lastKnown.price + avgPrice) / 2; // Promedio entre último y media

        return {
          min: Math.round(refPrice * 0.85),
          max: Math.round(refPrice * 1.15)
        };
      }
    }

    // Fallback: usar rangos ajustados por volatilidad
    return {
      min: Math.round(base * minMultiplier),
      max: Math.round(base * maxMultiplier)
    };
  }

  getRecommendation(pattern, predictions) {
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

    Object.entries(predictions).forEach(([key, data]) => {
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
