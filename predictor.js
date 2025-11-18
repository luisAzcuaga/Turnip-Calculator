// Predictor de Precios de Nabos - Animal Crossing New Horizons
// Versión para aplicación web

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

  // Detectar el patrón más probable
  detectPattern() {
    const prices = this.getPriceArray();

    if (prices.length < 2) {
      return this.patterns.FLUCTUATING;
    }

    if (this.isDecreasing(prices)) {
      return this.patterns.DECREASING;
    }

    if (this.hasLargeSpike(prices)) {
      return this.patterns.LARGE_SPIKE;
    }

    if (this.hasSmallSpike(prices)) {
      return this.patterns.SMALL_SPIKE;
    }

    return this.patterns.FLUCTUATING;
  }

  getPriceArray() {
    const days = ['mon_am', 'mon_pm', 'tue_am', 'tue_pm', 'wed_am', 'wed_pm',
      'thu_am', 'thu_pm', 'fri_am', 'fri_pm', 'sat_am', 'sat_pm'];
    return days.map(day => this.knownPrices[day]).filter(p => p !== undefined && p !== null && p !== '');
  }

  isDecreasing(prices) {
    if (prices.length < 3) return false;
    for (let i = 1; i < prices.length; i++) {
      if (prices[i] > prices[i - 1]) return false;
    }
    return true;
  }

  hasLargeSpike(prices) {
    const maxPrice = Math.max(...prices);
    return maxPrice > this.buyPrice * 1.8;
  }

  hasSmallSpike(prices) {
    const maxPrice = Math.max(...prices);
    return maxPrice > this.buyPrice * 1.3 && maxPrice <= this.buyPrice * 1.8;
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
        const estimate = this.predictPrice(pattern, index, day.key);
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

  predictPrice(pattern, index, dayKey) {
    const base = this.buyPrice;

    switch (pattern) {
      case this.patterns.DECREASING:
        return this.decreasingPattern(index, base);

      case this.patterns.LARGE_SPIKE:
        return this.largeSpikePattern(index, base, dayKey);

      case this.patterns.SMALL_SPIKE:
        return this.smallSpikePattern(index, base, dayKey);

      case this.patterns.FLUCTUATING:
      default:
        return this.fluctuatingPattern(index, base);
    }
  }

  decreasingPattern(index, base) {
    const decreaseRate = 0.03 + (index * 0.02);
    const price = Math.round(base * (1 - decreaseRate));
    return {
      min: Math.max(40, Math.round(price * 0.9)),
      max: Math.round(price * 1.05)
    };
  }

  largeSpikePattern(index, base, dayKey) {
    if (dayKey === 'wed_pm' || dayKey === 'thu_am') {
      return {
        min: Math.round(base * 1.4),
        max: Math.round(base * 6.0)
      };
    } else if (dayKey === 'wed_am' || dayKey === 'thu_pm') {
      return {
        min: Math.round(base * 1.2),
        max: Math.round(base * 2.0)
      };
    } else if (index < 4) {
      return {
        min: Math.round(base * 0.6),
        max: Math.round(base * 0.9)
      };
    } else {
      return {
        min: Math.round(base * 0.4),
        max: Math.round(base * 0.9)
      };
    }
  }

  smallSpikePattern(index, base, dayKey) {
    if (dayKey === 'thu_am' || dayKey === 'thu_pm') {
      return {
        min: Math.round(base * 1.2),
        max: Math.round(base * 2.0)
      };
    } else if (index < 4) {
      return {
        min: Math.round(base * 0.6),
        max: Math.round(base * 0.9)
      };
    } else {
      return {
        min: Math.round(base * 0.4),
        max: Math.round(base * 0.9)
      };
    }
  }

  fluctuatingPattern(index, base) {
    return {
      min: Math.round(base * 0.6),
      max: Math.round(base * 1.4)
    };
  }

  getRecommendation(pattern, predictions) {
    let rec = [];

    switch (pattern) {
      case this.patterns.DECREASING:
        rec.push('⚠️ Patrón DECRECIENTE detectado');
        rec.push('📉 Los precios seguirán bajando toda la semana');
        rec.push('💡 Vende lo antes posible o visita otra isla');
        rec.push('🏃‍♂️ No esperes mejores precios, solo empeorarán');
        break;

      case this.patterns.LARGE_SPIKE:
        rec.push('🚀 ¡Patrón de PICO GRANDE detectado!');
        rec.push('💰 Espera un pico muy alto (puede llegar a 400-600 bayas)');
        rec.push('📅 Probablemente entre miércoles PM y jueves AM');
        rec.push('⏰ ¡Revisa los precios cada turno sin falta!');
        rec.push('✨ Este es el mejor patrón posible');
        break;

      case this.patterns.SMALL_SPIKE:
        rec.push('📈 Patrón de PICO PEQUEÑO detectado');
        rec.push('💵 Espera un pico moderado (120-200 bayas)');
        rec.push('📅 Probablemente el jueves');
        rec.push('👍 Buena oportunidad para obtener ganancias');
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