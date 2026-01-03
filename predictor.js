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

    // Sistema de tracking de razones de rechazo/baja probabilidad
    this.rejectionReasons = {
      'fluctuating': [],
      'large_spike': [],
      'decreasing': [],
      'small_spike': []
    };

    // Sistema de tracking de razones de score (positivas y negativas)
    this.scoreReasons = {
      'fluctuating': [],
      'large_spike': [],
      'decreasing': [],
      'small_spike': []
    };

    // Probabilidades por defecto (sin historial) - desde constants.js
    this.defaultProbabilities = DEFAULT_PROBABILITIES;

    // Matriz de transición de patrones (basado en el código real de ACNH) - desde constants.js
    this.transitionProbabilities = TRANSITION_PROBABILITIES;
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

  // Helper: Verifica si llegamos tarde para un spike (sin subidas significativas)
  isTooLateForSpike(knownPrices, spikeType) {
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // Si llegamos a Jueves PM o después, verificar si hubo subida significativa
    if (maxKnownIndex >= PERIODS.THURSDAY_PM) {
      const hasSignificantRise = knownPrices.some((current, i) => {
        if (i === 0) return false;
        const previous = knownPrices[i - 1];
        return current.price > previous.price * THRESHOLDS.SIGNIFICANT_RISE;
      });

      if (!hasSignificantRise) {
        return {
          tooLate: true,
          reason: `Llegamos a ${getPeriodName(maxKnownIndex)} sin ninguna subida. ${spikeType} necesita empezar antes de Viernes AM (período 8) para que quepan los 5 períodos de pico.`
        };
      }
    }

    return { tooLate: false };
  }

  // Helper: Detecta Período 2 del pico para diferenciar Large vs Small Spike
  // Período 2 Large Spike: 140-200% (sin overlap con Small Spike)
  // Período 2 Small Spike: 90-140% (sin overlap con Large Spike)
  detectPhase1Spike(knownPrices) {
    if (knownPrices.length < 2) return { detected: false };

    // Buscar el inicio del pico (primera subida significativa >10%)
    let spikeStartIndex = -1;
    for (let i = 1; i < knownPrices.length; i++) {
      const current = knownPrices[i];
      const previous = knownPrices[i - 1];
      if (current.price > previous.price * THRESHOLDS.SIGNIFICANT_RISE) {
        spikeStartIndex = current.index;
        break;
      }
    }

    if (spikeStartIndex === -1) return { detected: false };

    // Buscar Período 2 (segundo período del pico, peakStart + 1)
    const phase1Index = spikeStartIndex + 1;
    const phase1Data = knownPrices.find(p => p.index === phase1Index);

    if (!phase1Data) return { detected: false };

    const phase1Rate = phase1Data.price / this.buyPrice;
    const phase1Percent = (phase1Rate * 100).toFixed(1);

    // Período 2 ≥ 140% = Large Spike confirmado
    if (phase1Rate >= 1.40) {
      return {
        detected: true,
        isLargeSpike: true,
        phase1Price: phase1Data.price,
        phase1Percent: phase1Percent,
        phase1Day: getPeriodName(phase1Index)
      };
    }

    // Período 2 < 140% = Small Spike confirmado
    return {
      detected: true,
      isLargeSpike: false,
      phase1Price: phase1Data.price,
      phase1Percent: phase1Percent,
      phase1Day: getPeriodName(phase1Index)
    };
  }

  // Verificar si el patrón DECRECIENTE es posible
  isPossibleDecreasing(knownPrices) {
    // REGLA DE DETECCIÓN TEMPRANA:
    // Si el LUNES tiene precio alto (>100%), NO puede ser Decreasing
    // Decreasing NUNCA sube del precio de compra (máx 90%)
    const mondayPrices = knownPrices.filter(p => p.index <= PERIODS.MONDAY_PM);
    if (mondayPrices.some(p => p.price > this.buyPrice)) {
      return false; // Precio alto el Lunes = NO es Decreasing
    }

    // En patrón decreciente, cada precio debe ser <= al anterior
    // y todos deben estar entre 85% y 40% del precio base
    return knownPrices.every((current, i) => {
      const { price, index } = current;
      const expectedMax = decreasingMaxForPeriod(this.buyPrice, index);
      const expectedMin = decreasingMin(this.buyPrice);

      // El precio debe estar en el rango del patrón decreciente
      if (price > expectedMax || price < expectedMin) {
        return false;
      }

      // Verificar que no haya subidas (Decreasing solo baja)
      if (i > 0 && price > knownPrices[i - 1].price) {
        return false;
      }

      return true;
    });
  }

  // Verificar si el patrón PICO GRANDE es posible
  isPossibleLargeSpike(knownPrices) {
    if (knownPrices.length === 0) return true;

    // VALIDACIÓN CRÍTICA: Si llegamos tarde sin subida, rechazar
    const lateCheck = this.isTooLateForSpike(knownPrices, 'Large Spike');
    if (lateCheck.tooLate) {
      this.rejectionReasons.large_spike.push(lateCheck.reason);
      return false;
    }

    // VALIDACIÓN PERÍODO 2: Si detectamos Período 2 del pico, podemos confirmar o rechazar definitivamente
    const phase1Check = this.detectPhase1Spike(knownPrices);
    if (phase1Check.detected) {
      if (!phase1Check.isLargeSpike) {
        // Período 2 < 140% = definitivamente Small Spike, no Large Spike
        this.rejectionReasons.large_spike.push(`${phase1Check.phase1Day} tiene ${phase1Check.phase1Price} bayas (${phase1Check.phase1Percent}%). Large Spike necesita ≥140% en el Período 2. Esto es Small Spike.`);
        return false;
      }
      // Si isLargeSpike = true, continuar con más validaciones (puede ser Large Spike)
    }

    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const maxRatio = priceRatio(maxPrice, this.buyPrice);
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // Si encuentra un precio muy alto (200%+), definitivamente es pico grande
    if (maxRatio >= THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
      return true;
    }

    // VALIDACIÓN 1: Lunes AM (período 0) debe estar entre 85-90% del precio base
    const mondayAM = knownPrices.find(p => p.index === PERIODS.MONDAY_AM);
    if (mondayAM) {
      const startRange = largeSpikeStartRange(this.buyPrice);
      const mondayRatio = priceRatio(mondayAM.price, this.buyPrice);
      // Si está por debajo de 85%, no es Large Spike
      if (mondayAM.price < startRange.min) {
        this.rejectionReasons.large_spike.push(`Lunes AM (${mondayAM.price}) está muy bajo (${Math.round(mondayRatio * 100)}%). Large Spike debe empezar entre 85-90%.`);
        return false;
      }
      // Si está por encima de 90%, no es Large Spike
      if (mondayAM.price > startRange.max) {
        this.rejectionReasons.large_spike.push(`Lunes AM (${mondayAM.price}) está muy alto (${Math.round(mondayRatio * 100)}%). Large Spike debe empezar entre 85-90%.`);
        return false;
      }
    }

    // VALIDACIÓN 2 y 3: Validar pendiente en fase pre-pico
    // Large Spike NO puede bajar >5 puntos del RATE por período
    // Large Spike NO debería subir significativamente antes del pico
    const hasInvalidSlope = knownPrices.slice(1).some((current, i) => {
      const previous = knownPrices[i];

      // Solo validar si los períodos son consecutivos
      if (current.index !== previous.index + 1) return false;

      const ratio = priceRatio(current.price, previous.price);

      // Detectar si ya empezó el pico: si algún precio anterior fue ≥90% del buyPrice
      // Si ya estamos en el pico, NO validar caída del rate (el pico puede bajar >5%)
      const spikeStarted = knownPrices.slice(0, i + 1).some(p => p.price >= this.buyPrice * RATES.LARGE_SPIKE.START_MAX);

      // Solo validar caída del rate en fase PRE-PICO
      if (!spikeStarted) {
        // Validar usando el RATE (precio/buyPrice), no el precio directamente
        // El juego reduce el rate 3-5 puntos por período, no el precio
        const rateValidation = isValidRateDrop(previous.price, current.price, this.buyPrice);

        // Si el rate baja más de 5 puntos porcentuales, NO es Large Spike
        if (!rateValidation.valid) {
          const prevPercent = ((previous.price / this.buyPrice) * 100).toFixed(1);
          const currPercent = ((current.price / this.buyPrice) * 100).toFixed(1);
          const dropPoints = (rateValidation.rateDrop * 100).toFixed(1);
          this.rejectionReasons.large_spike.push(`Precio cayó de ${previous.price} (${prevPercent}%) a ${current.price} (${currPercent}%), <strong>caída de ${dropPoints}%</strong>. Large Spike solo puede bajar máximo 5% por período en fase pre-pico.`);
          return true;
        }
      }

      // Si sube más de 10% en fase temprana (antes de período 3),
      // probablemente ya empezó el pico (pero Large Spike empieza en período 3+)
      if (current.index < PERIODS.LARGE_SPIKE_PEAK_START_MIN && ratio > THRESHOLDS.SIGNIFICANT_RISE) {
        const risePercent = Math.round((ratio - 1) * 100);
        const spikeRange = getSpikeStartRange(true);
        this.rejectionReasons.large_spike.push(`Subió ${risePercent}% antes del período ${PERIODS.LARGE_SPIKE_PEAK_START_MIN}. Large Spike no puede subir temprano. El pico solo puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
        return true;
      }

      return false;
    });

    if (hasInvalidSlope) return false;

    // BUG FIX: Si el "pico" es bajo (<140%) y hay caída dramática después, rechazar
    // Esto indica que el pico ya pasó y fue muy bajo para ser Large Spike
    if (maxRatio < THRESHOLDS.SMALL_SPIKE_MIN) {
      const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
      if (maxPriceIndex !== -1 && maxPriceIndex < knownPrices.length - 1) {
        const pricesAfterMax = knownPrices.slice(maxPriceIndex + 1);
        // Si después del "pico" hay caída >40%, el pico ya pasó
        const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);
        if (hasSharpDrop) {
          this.rejectionReasons.large_spike.push(`El precio máximo fue ${maxPrice} (${Math.round(maxRatio * 100)}%) y luego cayó más de 40%. El pico ya pasó y fue muy bajo para Large Spike.`);
          return false;
        }
      }
    }

    // Si el pico máximo está claramente en el rango de Small Spike (140-200%)
    // Y ya estamos tarde en la semana (viernes o después), rechazar Large Spike
    // PERO: Si Phase 1 ya confirmó que es Large Spike, respetar esa confirmación
    if (maxRatio >= THRESHOLDS.SMALL_SPIKE_MIN && maxRatio < THRESHOLDS.SMALL_SPIKE_MAX && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
      // Si Phase 1 confirmó Large Spike, no aplicar esta validación
      if (!phase1Check.detected || !phase1Check.isLargeSpike) {
        // Buscar si hay señales claras de que es Large Spike
        // (ej: subidas muy rápidas que indiquen que aún viene el pico grande)
        const hasRapidIncrease = knownPrices.some((current, i) => {
          if (i === 0) return false;
          const previous = knownPrices[i - 1];
          // Subida de más de 100% en un período
          return current.price > previous.price * THRESHOLDS.RAPID_INCREASE;
        });

        // Si no hay subidas muy rápidas y el pico está en rango de Small Spike,
        // es muy probable que sea Small Spike, no Large Spike
        if (!hasRapidIncrease) {
          const spikeRange = getSpikeStartRange(true);
          this.rejectionReasons.large_spike.push(`Pico máximo ${maxPrice} (${Math.round(maxRatio * 100)}%) está en rango de Small Spike (140-200%). Ya es tarde en la semana sin señales de Large Spike. Large Spike puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
          return false;
        }
      }
    }

    // Si estamos muy tarde (sábado PM) y el pico fue bajo, rechazar
    if (maxKnownIndex >= PERIODS.LAST_PERIOD && maxRatio < THRESHOLDS.SMALL_SPIKE_MIN) {
      const spikeRange = getSpikeStartRange(true);
      this.rejectionReasons.large_spike.push(`Es Sábado PM y el precio máximo fue solo ${maxPrice} (${Math.round(maxRatio * 100)}%). Large Spike necesita un pico de 200-600%. El pico puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
      return false;
    }

    // En otros casos, mantener como posible (aún puede venir el pico)
    return true;
  }

  // Verificar si el patrón PICO PEQUEÑO es posible
  isPossibleSmallSpike(knownPrices) {
    if (knownPrices.length === 0) return true;

    // VALIDACIÓN CRÍTICA: Si llegamos tarde sin subida, rechazar
    const lateCheck = this.isTooLateForSpike(knownPrices, 'Small Spike');
    if (lateCheck.tooLate) {
      this.rejectionReasons.small_spike.push(lateCheck.reason);
      return false;
    }

    // VALIDACIÓN PERÍODO 2: Si detectamos Período 2 del pico, podemos confirmar o rechazar definitivamente
    const phase1Check = this.detectPhase1Spike(knownPrices);
    if (phase1Check.detected) {
      if (phase1Check.isLargeSpike) {
        // Período 2 ≥ 140% = definitivamente Large Spike, no Small Spike
        this.rejectionReasons.small_spike.push(`${phase1Check.phase1Day} tiene ${phase1Check.phase1Price} bayas (${phase1Check.phase1Percent}%). Small Spike debe ser <140% en el Período 2. Esto es Large Spike.`);
        return false;
      }
      // Si isLargeSpike = false, continuar con más validaciones (puede ser Small Spike)
    }

    const maxPrice = Math.max(...knownPrices.map(p => p.price));
    const maxRatio = priceRatio(maxPrice, this.buyPrice);
    const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

    // Si encuentra un precio muy alto (> 200%), no puede ser pico pequeño
    // (sería pico grande)
    if (maxRatio > THRESHOLDS.SMALL_SPIKE_MAX) {
      this.rejectionReasons.small_spike.push(`Precio máximo ${maxPrice} (${Math.round(maxRatio * 100)}%) excede 200%. Esto es Large Spike, no Small Spike.`);
      return false;
    }

    // VALIDACIÓN: Validar pendiente en fase pre-pico
    // Small Spike NO puede bajar >5 puntos del RATE por período en fase decreciente
    const hasInvalidSmallSpikeSlope = knownPrices.slice(1).some((current, i) => {
      const previous = knownPrices[i];

      // Solo validar si los períodos son consecutivos
      if (current.index !== previous.index + 1) return false;

      const ratio = priceRatio(current.price, previous.price);

      // Detectar si ya empezó el pico: si algún precio anterior fue ≥90% del buyPrice
      // Si ya estamos en el pico, NO validar caída del rate (el pico puede bajar >5%)
      const spikeStarted = knownPrices.slice(0, i + 1).some(p => p.price >= this.buyPrice * RATES.LARGE_SPIKE.START_MAX);

      // Solo validar caída del rate en fase PRE-PICO
      if (!spikeStarted) {
        // Validar usando el RATE (precio/buyPrice), no el precio directamente
        // El juego reduce el rate 3-5 puntos por período, no el precio
        const rateValidation = isValidRateDrop(previous.price, current.price, this.buyPrice);

        // Si el rate baja más de 5 puntos porcentuales, NO es Small Spike
        // Probablemente es Decreasing o Fluctuating
        if (!rateValidation.valid) {
          const prevPercent = ((previous.price / this.buyPrice) * 100).toFixed(1);
          const currPercent = ((current.price / this.buyPrice) * 100).toFixed(1);
          const dropPoints = (rateValidation.rateDrop * 100).toFixed(1);
          this.rejectionReasons.small_spike.push(`Precio cayó de ${previous.price} (${prevPercent}%) a ${current.price} (${currPercent}%), <strong>caída de ${dropPoints}%</strong>. Small Spike solo puede bajar máximo 5% por período en fase pre-pico.`);
          return true;
        }
      }

      // Si sube muy temprano antes del período 2 (Martes AM),
      // podría no ser Small Spike (el pico empieza en período 2+)
      if (current.index < PERIODS.SMALL_SPIKE_PEAK_START_MIN && ratio > THRESHOLDS.SIGNIFICANT_RISE) {
        const risePercent = Math.round((ratio - 1) * 100);
        const spikeRange = getSpikeStartRange(false);
        this.rejectionReasons.small_spike.push(`Subió ${risePercent}% antes del período ${PERIODS.SMALL_SPIKE_PEAK_START_MIN}. Small Spike no puede subir temprano. El pico solo puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
        return true;
      }

      return false;
    });

    if (hasInvalidSmallSpikeSlope) return false;

    // Si el pico está en el rango perfecto de Small Spike (140-200%)
    // Y ya estamos en viernes o después, es muy probable que sea Small Spike
    if (maxRatio >= THRESHOLDS.SMALL_SPIKE_MIN && maxRatio < THRESHOLDS.SMALL_SPIKE_MAX && maxKnownIndex >= PERIODS.LATE_WEEK_START) {
      return true; // Confirmación fuerte de Small Spike
    }

    // Si estamos muy tarde en la semana (sábado PM) y no hubo pico significativo
    if (maxKnownIndex >= PERIODS.LAST_PERIOD) {
      // El pico ya debería haber ocurrido
      // Si el precio máximo fue < 90%, es muy improbable que sea pico pequeño
      if (maxRatio < RATES.LARGE_SPIKE.START_MAX) {
        const spikeRange = getSpikeStartRange(false);
        this.rejectionReasons.small_spike.push(`Es Sábado PM y el precio máximo fue solo ${maxPrice} (${Math.round(maxRatio * 100)}%). Small Spike necesita un pico de 140-200%. El pico puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`);
        return false;
      }
    }

    // En otros casos, mantener como posible
    return true;
  }

  // Verificar si el patrón FLUCTUANTE es posible
  isPossibleFluctuating(knownPrices) {
    // El patrón fluctuante permite precios entre 60% y 140% del base
    const inRange = knownPrices.every(({ price }) => {
      const ratio = priceRatio(price, this.buyPrice);
      // Si hay picos muy altos o muy bajos, probablemente no es fluctuante
      return ratio <= THRESHOLDS.FLUCTUATING_MAX_RATIO && ratio >= THRESHOLDS.FLUCTUATING_MIN_RATIO;
    });

    if (!inRange) {
      this.rejectionReasons.fluctuating.push(`Precio fuera del rango de Fluctuante (60-140%)`);
      return false;
    }

    // El patrón fluctuante debe ALTERNAR entre fases altas y bajas
    // Verificar tendencias decrecientes sostenidas
    if (knownPrices.length >= 2) {
      const { consecutiveDecreases, maxConsecutiveDecreases, decreasesFromStart } = knownPrices
        .slice(1)
        .reduce(
          (acc, current, i) => {
            const previous = knownPrices[i];

            // Verificar si está bajando (con margen de error del 2%)
            if (current.price < previous.price * THRESHOLDS.FLUCTUATING_DROP) {
              acc.consecutiveDecreases++;
              acc.maxConsecutiveDecreases = Math.max(acc.maxConsecutiveDecreases, acc.consecutiveDecreases);

              // Contar si baja desde el inicio
              if (i + 1 === acc.decreasesFromStart + 1) {
                acc.decreasesFromStart++;
              }
            } else {
              acc.consecutiveDecreases = 0;
            }

            return acc;
          },
          { consecutiveDecreases: 0, maxConsecutiveDecreases: 0, decreasesFromStart: 0 }
        );

      // CRÍTICO: Si baja 2+ períodos desde el INICIO (3 precios bajando), no es Fluctuante
      // Fluctuante debe empezar con fase ALTA o alternar, no bajar desde el inicio
      if (decreasesFromStart >= 2) {
        const numPrices = decreasesFromStart + 1;
        this.rejectionReasons.fluctuating.push(`${numPrices} precios bajando consecutivamente desde el inicio (${knownPrices.slice(0, numPrices).map(p => p.price).join(' → ')}). Fluctuante debe alternar entre fases altas y bajas, no bajar constantemente.`);
        return false;
      }

      // Si hay 4+ períodos consecutivos bajando en cualquier punto, no es fluctuante
      if (maxConsecutiveDecreases >= 4) {
        this.rejectionReasons.fluctuating.push(`${maxConsecutiveDecreases + 1} precios bajando consecutivamente. Fluctuante permite máx 3 en una fase baja.`);
        return false;
      }
    }

    return true;
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

      return {
        primary: primaryPattern,
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

      // MEJORA #3: Ajustar peso de datos vs probabilidades
      // Combinar scores: mantener peso mínimo de 30% para probabilidades
      // Con 0 precios: 100% probabilidades
      // Con 4 precios: 50% probabilidades, 50% datos
      // Con 8+ precios: 70% datos, 30% probabilidades (mínimo)
      const dataWeight = Math.min(knownPrices.length / CONFIDENCE.DATA_PERIODS_FOR_MAX, CONFIDENCE.MAX_DATA_WEIGHT);
      const probWeight = 1 - dataWeight; // Min 30% peso a probabilidades

      scores[pattern] = (dataScore * dataWeight) + (probabilityScore * probWeight);
    });

    // Ordenar patrones por score
    const sortedPatterns = possiblePatterns.sort((a, b) => scores[b] - scores[a]);
    const bestPattern = sortedPatterns[0];

    // Convertir scores a porcentajes
    const totalScore = Object.values(scores).reduce((sum, score) => sum + score, 0);
    const percentages = {};
    Object.keys(scores).forEach(pattern => {
      percentages[pattern] = totalScore > 0 ? Math.round((scores[pattern] / totalScore) * 100) : 0;
    });

    return {
      primary: bestPattern,
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

        if (isDecreasing) {
          score = 100;
          this.scoreReasons.decreasing.push(`✅ Todos los precios bajan consecutivamente (patrón perfecto de Decreciente)`);
        } else {
          score = 20;
          this.scoreReasons.decreasing.push(`❌ Hay precios que suben (Decreciente solo baja)`);
        }

        // Bonus si el promedio es bajo
        if (avgPrice < this.buyPrice * THRESHOLDS.DECREASING_LOW_AVG) {
          score += 30;
          this.scoreReasons.decreasing.push(`✅ Promedio bajo (${Math.round(avgPrice)} < ${Math.round(THRESHOLDS.DECREASING_LOW_AVG * 100)}% del base)`);
        }
        break;

      case this.patterns.LARGE_SPIKE:
        // Bonus si hay un pico muy alto (200%+)
        if (ratio >= THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
          score += 100;
          this.scoreReasons.large_spike.push(`✅ ¡Pico enorme detectado! ${maxPrice} (${Math.round(ratio * 100)}%) confirma Large Spike`);
        } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio < THRESHOLDS.LARGE_SPIKE_CONFIRMED) {
          // Rango ambiguo: podría ser Small Spike o Large Spike
          if (ratio < THRESHOLDS.LARGE_SPIKE_NEAR_LIMIT) {
            score += 10;
            this.scoreReasons.large_spike.push(`⚠️ Precio máximo ${maxPrice} (${Math.round(ratio * 100)}%) está en rango ambiguo, más cerca de Small Spike`);
          } else {
            score += 30;
            this.scoreReasons.large_spike.push(`⚠️ Precio máximo ${maxPrice} (${Math.round(ratio * 100)}%) cerca del límite de Large Spike (190-200%)`);
          }
        } else {
          score += 5;
          this.scoreReasons.large_spike.push(`⏳ Esperando confirmación. Máximo ${maxPrice} (${Math.round(ratio * 100)}%) es válido para fase inicial, el siguiente período debe estar entre 140-200% para confirmar Pico Grande`);
        }

        // Bonus si hay fase baja seguida de pico muy rápido
        const hasLowToHigh = knownPrices.some((p, i) =>
          i > 0 && p.price > knownPrices[i-1].price * THRESHOLDS.RAPID_INCREASE && knownPrices[i-1].price < this.buyPrice
        );
        if (hasLowToHigh) {
          score += 40;
          this.scoreReasons.large_spike.push(`✅ Detectada subida rápida desde fase baja (señal de pico grande)`);
        }

        score += 10; // Base score reducido (menos común que Small Spike)
        break;

      case this.patterns.SMALL_SPIKE:
        // MEJORA #1: Flag para detectar si el patrón está descartado
        let smallSpikeRejected = false;

        // Bonus si hay pico moderado en el rango exacto de Small Spike
        if (ratio >= THRESHOLDS.SMALL_SPIKE_MIN && ratio < THRESHOLDS.SMALL_SPIKE_MAX) {
          // Dentro del rango perfecto de Small Spike
          if (ratio >= THRESHOLDS.SMALL_SPIKE_PERFECT_MIN && ratio <= THRESHOLDS.SMALL_SPIKE_PERFECT_MAX) {
            score += 90;
            this.scoreReasons.small_spike.push(`✅ ¡Pico perfecto! ${maxPrice} (${Math.round(ratio * 100)}%) en rango ideal de Small Spike (150-190%)`);
          } else {
            score += 70;
            this.scoreReasons.small_spike.push(`✅ Pico detectado ${maxPrice} (${Math.round(ratio * 100)}%) en rango de Small Spike (140-200%)`);
          }
        } else if (ratio >= THRESHOLDS.SMALL_SPIKE_PRE_PEAK && ratio < THRESHOLDS.SMALL_SPIKE_MIN) {
          score += 40;
          this.scoreReasons.small_spike.push(`⚠️ Precio ${maxPrice} (${Math.round(ratio * 100)}%) podría ser pre-pico de Small Spike`);

          // MEJORA #1: Verificar si hubo caída dramática post-"pico"
          const maxPriceIndex = knownPrices.findIndex(p => p.price === maxPrice);
          if (maxPriceIndex !== -1 && maxPriceIndex < knownPrices.length - 1) {
            const pricesAfterMax = knownPrices.slice(maxPriceIndex + 1);
            const hasSharpDrop = pricesAfterMax.some(p => p.price < maxPrice * THRESHOLDS.SHARP_DROP);

            if (hasSharpDrop) {
              smallSpikeRejected = true;
              score = 0;
              this.scoreReasons.small_spike.push(`❌ El "pico" de ${maxPrice} cayó >40% después. Small Spike necesita pico ≥140%`);
            }
          }
        } else if (ratio >= THRESHOLDS.SMALL_SPIKE_MAX) {
          smallSpikeRejected = true;
          score = 0;
          this.scoreReasons.small_spike.push(`❌ Precio ${maxPrice} (${Math.round(ratio * 100)}%) excede 200% (esto es Large Spike)`);
        } else {
          // ratio < SMALL_SPIKE_PRE_PEAK (1.2)
          this.scoreReasons.small_spike.push(`⏳ Esperando confirmación. Máximo ${maxPrice} (${Math.round(ratio * 100)}%) es válido para fase inicial. Si el siguiente período se mantiene en 90-140%, sugiere Pico Pequeño`);
        }

        // Solo aplicar bonuses si el patrón no fue rechazado
        if (!smallSpikeRejected) {
          // Bonus si hay fase baja seguida de subida moderada
          const hasModerateIncrease = knownPrices.some((p, i) =>
            i > 0 && p.price > knownPrices[i-1].price * THRESHOLDS.MODERATE_RISE_MIN && p.price < knownPrices[i-1].price * THRESHOLDS.MODERATE_RISE_MAX
          );
          if (hasModerateIncrease) {
            score += 20;
            this.scoreReasons.small_spike.push(`✅ Detectada subida moderada (señal de pico pequeño)`);
          }

          score += 20; // Base score
        }
        break;

      case this.patterns.FLUCTUATING:
        // REGLA DE DETECCIÓN TEMPRANA:
        // Si el LUNES tiene precio alto (>100%), es casi seguro Fluctuante
        // Los picos de Large/Small Spike empiezan en período 2+ (Martes+)
        // Decreasing nunca sube del precio base
        const mondayPrices = knownPrices.filter(p => p.index <= PERIODS.MONDAY_PM);
        if (mondayPrices.some(p => p.price > this.buyPrice)) {
          score += 80;
          const highMonday = mondayPrices.find(p => p.price > this.buyPrice);
          this.scoreReasons.fluctuating.push(`✅ Precio alto el Lunes (${highMonday.price} > ${this.buyPrice}). Solo Fluctuante sube temprano.`);
        }

        // Bonus si los precios varían pero sin extremos
        if (ratio < THRESHOLDS.FLUCTUATING_MODERATE_MAX && ratio > THRESHOLDS.FLUCTUATING_MODERATE_MIN) {
          score += 50;
          this.scoreReasons.fluctuating.push(`✅ Precios en rango moderado (${Math.round(ratio * 100)}%), típico de Fluctuante (60-140%)`);
        } else if (ratio < THRESHOLDS.FLUCTUATING_MODERATE_MIN) {
          this.scoreReasons.fluctuating.push(`⚠️ Precio muy bajo (${Math.round(ratio * 100)}%), menos común en Fluctuante`);
        } else if (ratio >= THRESHOLDS.FLUCTUATING_MODERATE_MAX) {
          this.scoreReasons.fluctuating.push(`⚠️ Precio alto detectado (${Math.round(ratio * 100)}%), podría ser un pico en lugar de Fluctuante`);
        }

        // Penalizar fuertemente tendencias decrecientes sostenidas
        // El patrón fluctuante debe ALTERNAR entre fases altas y bajas, no solo bajar
        let consecutiveDecreases = 0;
        let maxConsecutiveDecreases = 0;
        let decreasesFromStart = 0;

        // Verificar si baja desde el inicio (sin fase alta previa)
        let allDecreasingFromStart = true;
        for (let i = 1; i < knownPrices.length; i++) {
          if (knownPrices[i].price < knownPrices[i - 1].price * THRESHOLDS.FLUCTUATING_DROP) {
            consecutiveDecreases++;
            maxConsecutiveDecreases = Math.max(maxConsecutiveDecreases, consecutiveDecreases);
            if (i === decreasesFromStart + 1) {
              decreasesFromStart++;
            }
          } else {
            consecutiveDecreases = 0;
            allDecreasingFromStart = false;
          }
        }

        // Si llegamos aquí, el patrón NO fue descartado
        // Las penalizaciones ahora son solo para casos límite
        if (maxConsecutiveDecreases === 3) {
          score -= 20;
          this.scoreReasons.fluctuating.push(`⚠️ 3 períodos bajando consecutivos (límite máximo de una fase baja en Fluctuante)`);
        } else if (maxConsecutiveDecreases === 2) {
          score -= 10;
          this.scoreReasons.fluctuating.push(`⚠️ 2 períodos bajando consecutivos (posible fase baja en Fluctuante)`);
        } else if (maxConsecutiveDecreases === 1 || knownPrices.length === 1) {
          // Solo 1 bajada o sin suficientes datos
          this.scoreReasons.fluctuating.push(`ℹ️ Sin suficientes datos para confirmar alternancia de fases`);
        }

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
      primaryPercentage: patternResult.percentages[pattern],
      allProbabilities: allProbabilities,
      alternatives: patternResult.alternatives.map(alt => ({
        pattern: alt.pattern,
        name: this.patternNames[alt.pattern],
        percentage: alt.percentage
      })),
      predictions: predictions,
      recommendation: this.getRecommendation(pattern),
      bestTime: this.getBestTime(predictions, pattern),
      rejectionReasons: this.rejectionReasons,
      scoreReasons: this.scoreReasons
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
    if (last > secondLast * THRESHOLDS.RISING_THRESHOLD) return 'rising';  // Subiendo rápido
    if (last > secondLast) return 'increasing';    // Subiendo
    if (last < secondLast * THRESHOLDS.FALLING_THRESHOLD) return 'falling'; // Bajando rápido
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

  getBestTime(predictions, pattern) {
    // Si es Fluctuante, no tiene sentido buscar "mejor momento"
    // El patrón es aleatorio por diseño - cualquier día puede ser el mejor
    if (pattern === this.patterns.FLUCTUATING) {
      return {
        pattern: 'fluctuating',
        message: 'No hay momento óptimo predecible en patrón aleatorio'
      };
    }

    // Para patrones predecibles (Spikes, Decreasing), buscar el máximo
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
      pattern: 'predictable',
      day: bestDay,
      price: bestPrice,
      isConfirmed: bestIsConfirmed
    };
  }
}
