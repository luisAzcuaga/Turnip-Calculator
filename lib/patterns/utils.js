import { DAYS_CONFIG, DECAY, PERIODS, RATES, THRESHOLDS } from "../constants.js";

// Shared utilities for price patterns
// Helper functions used by multiple patterns
// Uses constants from constants.js (THRESHOLDS, PERIODS, RATES, DECAY, etc.)

// ============================================================================
// PRICE CALCULATION HELPERS
// ============================================================================

/**
 * Calculates the minimum price using floor (rounds down)
 * Use for lower bounds
 */
export function priceFloor(basePrice, rate) {
  return Math.floor(basePrice * rate);
}

/**
 * Calculates the maximum price using ceil (rounds up)
 * Use for upper bounds
 */
export function priceCeil(basePrice, rate) {
  return Math.ceil(basePrice * rate);
}

/**
 * Calculates the ratio of a price relative to the base price
 */
export function priceRatio(price, basePrice) {
  return price / basePrice;
}

/**
 * Validates whether the drop between two prices is valid per the game algorithm.
 * The game reduces the RATE (not the price) by 3-5 percentage points per period.
 * We use truncation because the game uses integer arithmetic internally.
 *
 * @param {number} previousPrice - Previous period's price
 * @param {number} currentPrice - Current period's price
 * @param {number} buyPrice - Base buy price
 * @returns {{valid: boolean, rateDrop: number}} - Whether it is valid and how much the rate dropped
 */
export function isValidRateDrop(previousPrice, currentPrice, buyPrice) {
  const previousRate = previousPrice / buyPrice;
  const currentRate = currentPrice / buyPrice;
  // Truncate to 2 decimals to simulate the game's integer arithmetic
  // This avoids discarding patterns due to floating-point precision errors
  // E.g.: 5.3% -> 5% (valid), 6.1% -> 6% (invalid)
  const rateDrop = Math.trunc((previousRate - currentRate) * 100) / 100;

  // The rate can drop at most 5 percentage points (0.05) per period
  return {
    valid: rateDrop <= DECAY.MAX_PER_PERIOD,
    rateDrop: rateDrop
  };
}

/**
 * Calculates the expected maximum for the Decreasing pattern at a given period
 */
export function decreasingMaxForPeriod(basePrice, periodIndex) {
  const rate = RATES.DECREASING.START_MAX - (periodIndex * DECAY.MIN_PER_PERIOD);
  return Math.ceil(basePrice * Math.max(RATES.FLOOR, rate));
}

/**
 * Calculates the expected minimum for the Decreasing pattern
 */
export function decreasingMin(basePrice) {
  return Math.floor(basePrice * RATES.FLOOR);
}

/**
 * Calculates the Large Spike range for Monday AM
 */
export function largeSpikeStartRange(basePrice) {
  return {
    min: Math.floor(basePrice * RATES.LARGE_SPIKE.START_MIN),
    max: Math.ceil(basePrice * RATES.LARGE_SPIKE.START_MAX),
  };
}

/**
 * Gets the human-readable name of a period
 */
export function getPeriodName(periodIndex) {
  return DAYS_CONFIG[periodIndex]?.name || `Período ${periodIndex}`;
}

/**
 * Gets the period range where a spike can start
 */
export function getSpikeStartRange(isLargeSpike) {
  return {
    min: isLargeSpike ? PERIODS.LARGE_SPIKE_START_MIN : PERIODS.SMALL_SPIKE_START_MIN,
    max: PERIODS.SPIKE_START_MAX,
    minName: isLargeSpike ? 'Martes PM' : 'Martes AM',
    maxName: 'Jueves PM',
  };
}

// ============================================================================
// PROJECTION HELPER FUNCTIONS
// ============================================================================

/**
 * Calculates the average rate drop between consecutive known prices.
 * The game reduces the rate (not the price) by 3-5 points per period.
 *
 * @param {Array} knownPrices - Array of known prices with {index, price}
 * @param {number} base - Base buy price
 * @returns {number} - Average rate drop per period
 */
export function calculateAvgRateDrop(knownPrices, base) {
  if (knownPrices.length < 2) {
    return 0;
  }

  const totalDrop = knownPrices.slice(1).reduce((sum, current, i) => {
    const prevRate = knownPrices[i].price / base;
    const currRate = current.price / base;
    const rateDrop = prevRate - currRate;
    return sum + rateDrop;
  }, 0);

  return totalDrop / (knownPrices.length - 1);
}

/**
 * Projects a future price based on the current rate and average rate drop.
 *
 * @param {number} lastKnownPrice - Last known price
 * @param {number} base - Base buy price
 * @param {number} avgRateDrop - Average rate drop per period
 * @param {number} periodsAhead - How many periods ahead to project
 * @returns {number} - Projected price
 */
export function projectPriceFromRate(lastKnownPrice, base, avgRateDrop, periodsAhead) {
  const lastKnownRate = lastKnownPrice / base;
  const projectedRate = lastKnownRate - (avgRateDrop * periodsAhead);
  return base * projectedRate;
}

/**
 * Detects the start of a spike by looking for trend reversals or significant rises
 * @param {Array} prices - Array of prices (can be plain numbers or objects with .price)
 * @param {number} buyPrice - Base buy price
 * @returns {{detected: boolean, startIndex: number}} - Whether detected and at which index
 */
export function detectSpikeStart(prices, buyPrice) {
  if (!prices || prices.length < 2) {
    return { detected: false, startIndex: -1 };
  }

  // Normalize the array (can come as numbers or as {price: X})
  const pricesArray = prices.map(p => typeof p === 'object' ? p.price : p);

  // Primary method: Look for trend reversal (was falling → now rising)
  // This correctly detects spikes that start with small rises (<10%)
  for (let i = 1; i < pricesArray.length; i++) {
    if (pricesArray[i] > pricesArray[i - 1]) {
      // Check if it was previously falling
      if (i >= 2 && pricesArray[i - 2] > pricesArray[i - 1]) {
        // Trend reversal detected
        return { detected: true, startIndex: i };
      }
      // If it's the first rise after the start and was below base
      if (i === 1 && pricesArray[i - 1] < buyPrice) {
        return { detected: true, startIndex: i };
      }
    }
  }

  // Fallback method: Look for significant rise >10%
  // Used when there's no clear trend reversal (e.g. first data point is already rising)
  for (let i = 1; i < pricesArray.length; i++) {
    if (pricesArray[i] > pricesArray[i - 1] * THRESHOLDS.SIGNIFICANT_RISE) {
      return { detected: true, startIndex: i };
    }
  }

  return { detected: false, startIndex: -1 };
}

/**
 * Dynamically detects where the spike phase starts in Spike patterns
 * @param {Array} knownPrices - Array of known prices with {index, price}
 * @param {number} minSpikeStart - Minimum index where the spike can start
 * @param {number} maxSpikeStart - Maximum index where the spike can start
 * @param {boolean} isLargeSpike - True if large spike, false if small
 * @param {number} buyPrice - Base buy price
 * @returns {number} - Estimated index where the spike starts
 */
export function detectSpikePhaseStart(knownPrices, minSpikeStart, maxSpikeStart, isLargeSpike, buyPrice) {
  if (knownPrices.length === 0) {
    return PERIODS.WEDNESDAY_PM; // Default: Wednesday PM (typical period)
  }

  // Find the maximum known price
  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const maxPriceData = knownPrices.find(p => p.price === maxPrice);
  const maxPriceIndex = maxPriceData?.index ?? -1;

  // Check if there are prices AFTER the max that are declining
  // This confirms the spike already occurred
  const pricesAfterMax = knownPrices.filter(p => p.index > maxPriceIndex);
  const hasDecliningPricesAfterMax = pricesAfterMax.length > 0 &&
    pricesAfterMax.some(p => p.price < maxPrice * 0.95); // Dropped at least 5%

  // PRIORITY 1: If the spike already passed (prices declining after the max),
  // use the max as reference to calculate spikeStart
  if (maxPriceData && hasDecliningPricesAfterMax) {
    const ratio = maxPrice / buyPrice;

    // Large Spike: max price at spike phase 3 (200-600%)
    if (isLargeSpike && ratio >= RATES.LARGE_SPIKE.PEAK_RATE_MIN) {
      const estimatedSpikeStart = Math.max(minSpikeStart, maxPriceData.index - 2);
      return Math.min(maxSpikeStart, estimatedSpikeStart);
    }

    // Small Spike: max price at spike phase 4 (140-200%)
    if (!isLargeSpike && ratio >= RATES.SMALL_SPIKE.PEAK_RATE_MIN) {
      const estimatedSpikeStart = Math.max(minSpikeStart, maxPriceData.index - 3);
      return Math.min(maxSpikeStart, estimatedSpikeStart);
    }
  }

  // PRIORITY 2: Look for trend reversal: was falling and now rising
  // This is more reliable than just looking for a big rise
  const trendReversal = knownPrices.findIndex((current, i) => {
    if (i < 2) return false; // Need at least 3 data points

    const prev = knownPrices[i - 1];
    const prevPrev = knownPrices[i - 2];

    // Was falling (prevPrev > prev) and now rising (current > prev)
    const wasFalling = prevPrev.price > prev.price;
    const nowRising = current.price > prev.price;

    return wasFalling && nowRising;
  });

  if (trendReversal !== -1) {
    // The reversal occurs at the current period, that's the spike start (Spike phase 1 = 90-140%)
    const estimatedStart = Math.max(minSpikeStart, knownPrices[trendReversal].index);
    return Math.min(maxSpikeStart, estimatedStart);
  }

  // Look for the first price that rises significantly (>30%)
  const firstSignificantRise = knownPrices.findIndex((current, i) => {
    if (i === 0) return false;

    const previous = knownPrices[i - 1];
    return current.price > previous.price * THRESHOLDS.MODERATE_RISE_MIN;
  });

  if (firstSignificantRise !== -1) {
    const estimatedStart = Math.max(minSpikeStart, knownPrices[firstSignificantRise].index);
    return Math.min(maxSpikeStart, estimatedStart);
  }

  // If there's a decreasing trend, the spike has probably passed or is near
  const lastKnownIndex = knownPrices[knownPrices.length - 1]?.index || PERIODS.WEDNESDAY_PM;

  // If we're in a late low phase, assume the spike will come soon
  if (lastKnownIndex >= PERIODS.WEDNESDAY_AM) {
    return Math.max(minSpikeStart, Math.min(maxSpikeStart, lastKnownIndex));
  }

  // Fallback: use the middle period of the valid range
  return Math.floor((minSpikeStart + maxSpikeStart) / 2);
}

/**
 * Detects Large Spike sequence: Spike phase 1 (90-140%) → Spike phase 2 (140-200%)
 * @param {Array} knownPrices - Array of known prices with indices
 * @param {number} buyPrice - Base buy price
 * @returns {Object} - { detected, spikePhase1, spikePhase2, hasDataAfterSequence } or { detected: false }
 */
export function detectLargeSpikeSequence(knownPrices, buyPrice) {
  if (knownPrices.length < 2) return { detected: false };

  const p1Range = RATES.LARGE_SPIKE.SPIKE_PHASES[0]; // 90-140%
  const p2Range = RATES.LARGE_SPIKE.SPIKE_PHASES[1]; // 140-200%

  // Look for price in P2 range (140-200%) with previous price in P1 range (90-140%)
  for (const current of knownPrices) {
    const rate = current.price / buyPrice;

    if (rate >= p2Range.min && rate < p2Range.max) {
      const previousPeriod = knownPrices.find(p => p.index === current.index - 1);

      if (previousPeriod) {
        const prevRate = previousPeriod.price / buyPrice;

        if (prevRate >= p1Range.min && prevRate < p1Range.max) {
          const pricesAfter = knownPrices.filter(p => p.index > current.index);
          return {
            detected: true,
            spikePhase1: { price: previousPeriod.price, rate: prevRate, index: previousPeriod.index },
            spikePhase2: { price: current.price, rate: rate, index: current.index },
            hasDataAfterSequence: pricesAfter.length > 0
          };
        }
      }
    }
  }

  return { detected: false };
}

// ============================================================================
// SPIKE VALIDATION HELPERS
// ============================================================================

/**
 * Validates the slope in the pre-spike phase for both spike types.
 * Returns { invalid: boolean, reason?: string }
 */
export function validatePreSpikeSlope(knownPrices, isLargeSpike, buyPrice) {
  const patternName = isLargeSpike ? 'Large Spike' : 'Small Spike';
  const minSpikeStart = isLargeSpike ? PERIODS.LARGE_SPIKE_START_MIN : PERIODS.SMALL_SPIKE_START_MIN;
  const spikeThreshold = buyPrice * RATES.LARGE_SPIKE.START_MAX;
  let spikeStarted = false;
  let previous = knownPrices[0];

  for (const current of knownPrices.slice(1)) {
    if (current.index !== previous.index + 1) {
      spikeStarted = spikeStarted || previous.price >= spikeThreshold;
      previous = current;
      continue;
    }

    const ratio = priceRatio(current.price, previous.price);

    if (!spikeStarted) {
      const rateValidation = isValidRateDrop(previous.price, current.price, buyPrice);
      if (!rateValidation.valid) {
        const prevPercent = ((previous.price / buyPrice) * 100).toFixed(1);
        const currPercent = ((current.price / buyPrice) * 100).toFixed(1);
        const dropPoints = (rateValidation.rateDrop * 100).toFixed(1);
        return {
          invalid: true,
          reason: `Precio cayó de ${previous.price} bayas (${prevPercent}%) a ${current.price} bayas (${currPercent}%), <strong>caída de ${dropPoints}%</strong>. ${patternName} solo puede bajar máximo 5% por período en fase pre-pico.`
        };
      }
    }

    if (current.index < minSpikeStart && ratio > THRESHOLDS.SIGNIFICANT_RISE) {
      const risePercent = Math.round((ratio - 1) * 100);
      const spikeRange = getSpikeStartRange(isLargeSpike);
      return {
        invalid: true,
        reason: `Subió ${risePercent}% antes del período ${minSpikeStart}. ${patternName} no puede subir temprano. El pico solo puede empezar entre ${spikeRange.minName} y ${spikeRange.maxName} (períodos ${spikeRange.min}-${spikeRange.max}).`
      };
    }

    spikeStarted = spikeStarted || previous.price >= spikeThreshold;
    previous = current;
  }

  return { invalid: false };
}

/**
 * Checks if it's too late for a spike (no significant rises by Thursday PM+).
 * Returns { tooLate: boolean, reason?: string }
 */
export function isTooLateForSpike(knownPrices, spikeType) {
  const maxKnownIndex = Math.max(...knownPrices.map(p => p.index));

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

/**
 * Detects spike P1→P2 sequence to differentiate Large vs Small Spike.
 * Returns { detected: boolean, isLargeSpike?: boolean|null, price?, percent?, day? }
 */
export function detectSpikeConfirmation(knownPrices, buyPrice) {
  if (knownPrices.length < 2) return { detected: false };

  const maxPrice = Math.max(...knownPrices.map(p => p.price));
  const hasLargeSpikeConfirmed = (maxPrice / buyPrice) >= RATES.LARGE_SPIKE.PEAK_RATE_MIN;
  const sequence = detectLargeSpikeSequence(knownPrices, buyPrice);

  if (sequence.detected) {
    const { spikePhase2, hasDataAfterSequence } = sequence;
    const percent = (spikePhase2.rate * 100).toFixed(1);

    let isLargeSpike;
    if (hasLargeSpikeConfirmed) {
      isLargeSpike = true;
    } else if (!hasDataAfterSequence) {
      isLargeSpike = null;
    } else {
      isLargeSpike = false;
    }

    return { detected: true, isLargeSpike, price: spikePhase2.price, percent, day: getPeriodName(spikePhase2.index) };
  }

  const spikeDetection = detectSpikeStart(knownPrices, buyPrice);
  if (!spikeDetection.detected) return { detected: false };

  const spikeStartPrice = knownPrices[spikeDetection.startIndex];
  const spikeStartIndex = spikeStartPrice.index;
  const confirmationData = knownPrices.find(p => p.index === spikeStartIndex + 1);
  if (!confirmationData) return { detected: false };

  if (confirmationData.price <= spikeStartPrice.price) return { detected: false };

  const confirmationRate = confirmationData.price / buyPrice;
  return {
    detected: true,
    isLargeSpike: confirmationRate >= RATES.SMALL_SPIKE.PEAK_RATE_MIN,
    price: confirmationData.price,
    percent: (confirmationRate * 100).toFixed(1),
    day: getPeriodName(spikeStartIndex + 1)
  };
}

/**
 * Calculates the price range for a decreasing phase (pre-spike or post-spike).
 * Consolidates shared logic between large-spike and small-spike.
 *
 * @param {number} periodIndex - Absolute period index (0-11)
 * @param {number} base - Base buy price
 * @param {Array} phaseKnownPrices - Known prices already filtered to this phase
 * @param {number} periodsIntoPhase - Periods elapsed since phase start (for no-data branch)
 * @param {number} startMinRate - Minimum rate at phase start
 * @param {number} startMaxRate - Maximum rate at phase start
 * @param {boolean} decayMinRate - If true, minRate decays per period; if false, it's fixed
 * @returns {{min: number, max: number}} - Price range
 */
export function calculateDecreasingPhaseRange(
  periodIndex, base, phaseKnownPrices, periodsIntoPhase,
  startMinRate, startMaxRate, decayMinRate
) {
  if (phaseKnownPrices.length >= 1) {
    const lastKnown = phaseKnownPrices[phaseKnownPrices.length - 1];
    const periodsAhead = periodIndex - lastKnown.index;

    // Project using game bounds: drops 3–5% per period from the last known price
    if (periodsAhead > 0) {
      const lastKnownRate = lastKnown.price / base;
      const minProjectedRate = lastKnownRate - (DECAY.MAX_PER_PERIOD * periodsAhead);
      const maxProjectedRate = lastKnownRate - (DECAY.MIN_PER_PERIOD * periodsAhead);
      const minProjected = base * Math.max(RATES.FLOOR, minProjectedRate);
      const maxProjected = base * maxProjectedRate;
      return {
        min: Math.floor(Math.max(base * RATES.FLOOR, minProjected)),
        max: Math.ceil(Math.min(lastKnown.price, maxProjected))
      };
    }
  }

  // No data: use game algorithm ranges
  const minRate = decayMinRate
    ? Math.max(RATES.FLOOR, startMinRate - (periodsIntoPhase * DECAY.MAX_PER_PERIOD))
    : startMinRate;
  const maxRate = Math.max(RATES.FLOOR, startMaxRate - (periodsIntoPhase * DECAY.MIN_PER_PERIOD));
  return {
    min: priceFloor(base, minRate),
    max: priceCeil(base, maxRate)
  };
}
