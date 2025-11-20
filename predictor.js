// Predictor de Precios de Nabos - Animal Crossing New Horizons
// Basado en los patrones reales del juego

class TurnipPredictor {
  constructor(buyPrice, knownPrices = {}, previousPattern = null) {
    this.buyPrice = buyPrice;
    this.knownPrices = knownPrices;
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

  // Obtener array de precios conocidos con sus índices
  getPriceArrayWithIndices() {
    const days = ['mon_am', 'mon_pm', 'tue_am', 'tue_pm', 'wed_am', 'wed_pm',
      'thu_am', 'thu_pm', 'fri_am', 'fri_pm', 'sat_am', 'sat_pm'];

    const result = [];
    days.forEach((day, index) => {
      const price = this.knownPrices[day];
      if (price !== undefined && price !== null && price !== '') {
        result.push({ index, price: parseInt(price), day });
      }
    });
    return result;
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
    let hasLowPhase = false;

    for (let i = 0; i < knownPrices.length; i++) {
      const price = knownPrices[i].price;
      const ratio = price / this.buyPrice;

      // Si encuentra un precio muy alto (200%+), es probable pico grande
      if (ratio >= 2.0) {
        hasHighPeak = true;
      }

      // Si encuentra precios bajos al inicio (< 90%), es consistente con pico grande
      if (i < 6 && ratio < 0.9) {
        hasLowPhase = true;
      }

      // Si encuentra precios muy bajos tarde en la semana Y no hay pico, no puede ser pico grande
      if (i >= 8 && ratio < 0.6 && !hasHighPeak) {
        return false;
      }
    }

    // Si ya pasó la mitad de la semana y no hay picos altos, es menos probable
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));
    if (maxKnownIndex > 7 && !hasHighPeak) {
      // Verificar si hay al menos un precio moderadamente alto
      const maxPrice = Math.max(...knownPrices.map(p => p.price));
      if (maxPrice < this.buyPrice * 1.4) {
        return false;
      }
    }

    return true;
  }

  // Verificar si el patrón PICO PEQUEÑO es posible
  isPossibleSmallSpike(knownPrices) {
    let hasModerateSpike = false;
    let hasTooHighSpike = false;

    for (let i = 0; i < knownPrices.length; i++) {
      const price = knownPrices[i].price;
      const ratio = price / this.buyPrice;

      // Si encuentra un precio muy alto (> 200%), no puede ser pico pequeño
      if (ratio > 2.0) {
        hasTooHighSpike = true;
      }

      // Si encuentra un precio moderadamente alto (140-200%), es consistente
      if (ratio >= 1.4 && ratio <= 2.0) {
        hasModerateSpike = true;
      }
    }

    if (hasTooHighSpike) {
      return false;
    }

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

    const totalConfidence = Math.min(dataConfidence + scoreConfidence + historyBonus, 100);

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

    const days = [
      { key: 'mon_am', name: 'Lunes AM' },
      { key: 'mon_pm', name: 'Lunes PM' },
      { key: 'tue_am', name: 'Martes AM' },
      { key: 'tue_pm', name: 'Martes PM' },
      { key: 'wed_am', name: 'Miércoles AM' },
      { key: 'wed_pm', name: 'Miércoles PM' },
      { key: 'thu_am', name: 'Jueves AM' },
      { key: 'thu_pm', name: 'Jueves PM' },
      { key: 'fri_am', name: 'Viernes AM' },
      { key: 'fri_pm', name: 'Viernes PM' },
      { key: 'sat_am', name: 'Sábado AM' },
      { key: 'sat_pm', name: 'Sábado PM' }
    ];

    days.forEach((day, index) => {
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

    return {
      pattern: pattern,
      patternName: this.patternNames[pattern],
      confidence: patternResult.confidence,
      primaryPercentage: patternResult.percentages[pattern],
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

  // Patrón PICO GRANDE: bajo → pico altísimo (hasta 600%) → bajo
  largeSpikePattern(periodIndex, base, knownPrices = []) {
    const phase = this.detectPricePhase(knownPrices);
    const peak = this.findPeakInKnownPrices(knownPrices);

    // Si ya encontramos el pico y estamos después de él
    if (peak && peak.index < periodIndex && phase === 'decreasing') {
      // Post-pico: ajustar basándose en la caída desde el pico
      const periodsAfterPeak = periodIndex - peak.index;
      const decayRate = 0.15; // 15% de caída por período post-pico
      const projected = peak.price * Math.pow(1 - decayRate, periodsAfterPeak);

      return {
        min: Math.round(projected * 0.85),
        max: Math.round(projected * 1.15)
      };
    }

    // Si estamos en fase de subida rápida (probable pico)
    if (phase === 'rising' && knownPrices.length > 0) {
      const lastKnown = knownPrices[knownPrices.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;

      if (periodsAhead > 0 && periodsAhead <= 2) {
        // Estamos cerca del pico, proyectar con tasa de crecimiento alta
        const growthRate = 0.5; // 50% de crecimiento por período
        const projected = lastKnown.price * Math.pow(1 + growthRate, periodsAhead);

        return {
          min: Math.round(projected * 0.80),
          max: Math.round(projected * 1.20)
        };
      }
    }

    // Ajustar fase baja si tenemos datos
    if (periodIndex <= 4 && knownPrices.length > 0) {
      const avgLowPhase = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
      const floorLevel = avgLowPhase / base; // Nivel del "piso" observado

      return {
        min: Math.round(base * Math.max(0.40, floorLevel * 0.90)),
        max: Math.round(base * Math.max(0.90, floorLevel * 1.10))
      };
    }

    // Fallback: usar predicción estándar
    // Fase 1 (períodos 0-1): Decreciente 85-50%
    if (periodIndex <= 1) {
      return {
        min: Math.round(base * 0.50),
        max: Math.round(base * 0.85)
      };
    }

    // Fase 2 (períodos 2-4): Bajo continuo 40-90%
    if (periodIndex <= 4) {
      return {
        min: Math.round(base * 0.40),
        max: Math.round(base * 0.90)
      };
    }

    // Fase 3 (períodos 5-7): ¡PICO! 90-600%
    if (periodIndex <= 7) {
      // El pico máximo suele ser en período 6 (miércoles PM / jueves AM)
      if (periodIndex === 5 || periodIndex === 6) {
        return {
          min: Math.round(base * 1.40),
          max: Math.round(base * 6.00)
        };
      } else {
        return {
          min: Math.round(base * 0.90),
          max: Math.round(base * 2.00)
        };
      }
    }

    // Fase 4 (períodos 8-11): Post-pico bajo 40-90%
    return {
      min: Math.round(base * 0.40),
      max: Math.round(base * 0.90)
    };
  }

  // Patrón PICO PEQUEÑO: similar al grande pero pico menor (140-200%)
  smallSpikePattern(periodIndex, base, knownPrices = []) {
    const phase = this.detectPricePhase(knownPrices);
    const peak = this.findPeakInKnownPrices(knownPrices);

    // Si ya encontramos el pico y estamos después de él
    if (peak && peak.index < periodIndex && phase === 'decreasing') {
      // Post-pico: ajustar basándose en la caída desde el pico
      const periodsAfterPeak = periodIndex - peak.index;
      const decayRate = 0.12; // 12% de caída por período post-pico
      const projected = peak.price * Math.pow(1 - decayRate, periodsAfterPeak);

      return {
        min: Math.round(projected * 0.85),
        max: Math.round(projected * 1.15)
      };
    }

    // Si estamos en fase de subida (probable pico)
    if ((phase === 'rising' || phase === 'increasing') && knownPrices.length > 0) {
      const lastKnown = knownPrices[knownPrices.length - 1];
      const periodsAhead = periodIndex - lastKnown.index;

      if (periodsAhead > 0 && periodsAhead <= 2) {
        // Estamos cerca del pico, proyectar con tasa de crecimiento moderada
        const growthRate = 0.25; // 25% de crecimiento por período
        const projected = lastKnown.price * Math.pow(1 + growthRate, periodsAhead);

        return {
          min: Math.round(projected * 0.85),
          max: Math.round(projected * 1.15)
        };
      }
    }

    // Ajustar fase baja si tenemos datos
    if (periodIndex <= 4 && knownPrices.length > 0) {
      const avgLowPhase = knownPrices.reduce((sum, p) => sum + p.price, 0) / knownPrices.length;
      const floorLevel = avgLowPhase / base;

      return {
        min: Math.round(base * Math.max(0.40, floorLevel * 0.90)),
        max: Math.round(base * Math.max(0.90, floorLevel * 1.10))
      };
    }

    // Fallback: usar predicción estándar
    // Fase 1 (períodos 0-2): Decreciente
    if (periodIndex <= 2) {
      return {
        min: Math.round(base * 0.40),
        max: Math.round(base * 0.90)
      };
    }

    // Fase 2 (períodos 3-4): Bajo
    if (periodIndex <= 4) {
      return {
        min: Math.round(base * 0.60),
        max: Math.round(base * 0.80)
      };
    }

    // Fase 3 (períodos 5-9): Pico moderado
    if (periodIndex <= 9) {
      // El pico suele ser jueves/viernes
      if (periodIndex >= 6 && periodIndex <= 8) {
        return {
          min: Math.round(base * 1.40),
          max: Math.round(base * 2.00)
        };
      } else {
        return {
          min: Math.round(base * 0.90),
          max: Math.round(base * 1.40)
        };
      }
    }

    // Fase 4 (períodos 10-11): Decreciente final
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
