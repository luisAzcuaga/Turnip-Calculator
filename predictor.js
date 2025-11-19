// Predictor de Precios de Nabos - Animal Crossing New Horizons
// Basado en los patrones reales del juego

class TurnipPredictor {
  constructor(buyPrice, knownPrices = {}) {
    this.buyPrice = buyPrice;
    this.knownPrices = knownPrices;
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

  // Detectar el patrón más probable
  detectPattern() {
    const possiblePatterns = this.detectPossiblePatterns();
    const knownPrices = this.getPriceArrayWithIndices();

    // Si solo hay un patrón posible, devolverlo
    if (possiblePatterns.length === 1) {
      return possiblePatterns[0];
    }

    // Si hay múltiples patrones, elegir el más probable basado en los datos
    if (knownPrices.length === 0) {
      return this.patterns.FLUCTUATING; // Default sin datos
    }

    // Calcular score para cada patrón posible
    const scores = {};
    possiblePatterns.forEach(pattern => {
      scores[pattern] = this.calculatePatternScore(pattern, knownPrices);
    });

    // Devolver el patrón con mayor score
    let bestPattern = possiblePatterns[0];
    let bestScore = scores[bestPattern];

    possiblePatterns.forEach(pattern => {
      if (scores[pattern] > bestScore) {
        bestScore = scores[pattern];
        bestPattern = pattern;
      }
    });

    return bestPattern;
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
    const pattern = this.detectPattern();
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
      predictions: predictions,
      recommendation: this.getRecommendation(pattern, predictions),
      bestTime: this.getBestTime(predictions)
    };
  }

  predictPrice(pattern, periodIndex) {
    const base = this.buyPrice;

    switch (pattern) {
      case this.patterns.DECREASING:
        return this.decreasingPattern(periodIndex, base);

      case this.patterns.LARGE_SPIKE:
        return this.largeSpikePattern(periodIndex, base);

      case this.patterns.SMALL_SPIKE:
        return this.smallSpikePattern(periodIndex, base);

      case this.patterns.FLUCTUATING:
      default:
        return this.fluctuatingPattern(periodIndex, base);
    }
  }

  // Patrón DECRECIENTE: bajada constante del 85% al 40%
  decreasingPattern(periodIndex, base) {
    const rate = 0.85 - (periodIndex * 0.04);
    const price = Math.round(base * Math.max(0.40, rate));

    return {
      min: Math.round(price * 0.90),
      max: Math.round(price * 1.05)
    };
  }

  // Patrón PICO GRANDE: bajo → pico altísimo (hasta 600%) → bajo
  largeSpikePattern(periodIndex, base) {
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
  smallSpikePattern(periodIndex, base) {
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
  fluctuatingPattern(periodIndex, base) {
    // Los precios fluctúan pero generalmente entre estos rangos
    // Pueden subir y bajar sin patrón claro
    return {
      min: Math.round(base * 0.60),
      max: Math.round(base * 1.40)
    };
  }

  getRecommendation(pattern, predictions) {
    let rec = [];

    switch (pattern) {
      case this.patterns.DECREASING:
        rec.push('⚠️ Patrón DECRECIENTE detectado');
        rec.push('📉 Los precios solo bajarán toda la semana');
        rec.push('💡 Vende HOY o visita otra isla');
        rec.push('🏃‍♂️ No esperes, solo empeorarán');
        break;

      case this.patterns.LARGE_SPIKE:
        rec.push('🚀 ¡Patrón de PICO GRANDE detectado!');
        rec.push('💰 Espera un pico altísimo (puede llegar a 400-600 bayas)');
        rec.push('📅 El pico suele ser miércoles-jueves');
        rec.push('⏰ ¡Revisa los precios cada turno!');
        rec.push('✨ Este es el MEJOR patrón posible');
        break;

      case this.patterns.SMALL_SPIKE:
        rec.push('📈 Patrón de PICO PEQUEÑO detectado');
        rec.push('💵 Espera un pico moderado (140-200 bayas)');
        rec.push('📅 El pico suele ser jueves-viernes');
        rec.push('👍 Buena oportunidad para ganancias');
        break;

      case this.patterns.FLUCTUATING:
      default:
        rec.push('📊 Patrón FLUCTUANTE detectado');
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
