// Constants.js - Shared constants across the application
// Based on the datamined algorithm from Animal Crossing: New Horizons

// ============================================================================
// DAY/PERIOD CONFIGURATION
// ============================================================================

// Days/periods configuration - single source of truth
export const DAYS_CONFIG = [
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

// Extract just the keys for convenience (when only IDs are needed)
export const PRICE_INPUT_IDS = DAYS_CONFIG.map(d => d.key);

// ============================================================================
// PATTERNS
// ============================================================================

// Pattern keys (internal identifiers)
export const PATTERNS = {
  FLUCTUATING: 'fluctuating',
  LARGE_SPIKE: 'large_spike',
  SMALL_SPIKE: 'small_spike',
  DECREASING: 'decreasing'
};

// Pattern display names (Spanish)
export const PATTERN_NAMES = {
  fluctuating: 'Fluctuante',
  large_spike: 'Pico Grande',
  small_spike: 'Pico Pequeño',
  decreasing: 'Decreciente'
};

// Encoding map: pattern name → single letter (for URL compression)
export const PATTERN_ENCODE_MAP = {
  fluctuating: 'f',
  large_spike: 'l',
  small_spike: 's',
  decreasing: 'd'
};

// Decoding map: single letter → pattern name (for URL decompression)
export const PATTERN_DECODE_MAP = {
  f: 'fluctuating',
  l: 'large_spike',
  s: 'small_spike',
  d: 'decreasing'
};

// ============================================================================
// KEY PERIODS (DAYS_CONFIG indices)
// ============================================================================

export const PERIODS = {
  MONDAY_AM: 0,    // Pre-spike validation (Large/Small Spike Monday AM check)
  MONDAY_PM: 1,    // Fluctuating high-phase detection cutoff
  WEDNESDAY_AM: 4, // Spike phase start fallback threshold
  WEDNESDAY_PM: 5, // Default spike start estimate when no data
  THURSDAY_AM: 6,  // Fluctuating: late-week high-phase inference
  THURSDAY_PM: 7,  // "Too late for spike" detection cutoff
  SATURDAY_AM: 10, // Fluctuating: late-week high-phase inference

  // Semantic aliases
  SMALL_SPIKE_START_MIN: 1,   // Monday PM   — earliest Small Spike start
  LARGE_SPIKE_START_MIN: 2,   // Tuesday AM  — earliest Large Spike start
  SPIKE_START_MAX: 7,         // Thursday PM — latest start for 5 spike periods
  LATE_WEEK_START: 8,         // Friday AM
  LAST_PERIOD: 11,            // Saturday PM
};

// ============================================================================
// PRICE VALIDATION
// ============================================================================

// Turnip price validation (per Animal Crossing Wiki)
export const TURNIP_PRICE_MIN = 9;
export const TURNIP_PRICE_MAX = 660;
export const BUY_PRICE_MIN = 90;
export const BUY_PRICE_MAX = 110;

// ============================================================================
// PRICE RATIOS (percentages of base price)
// ============================================================================

export const RATES = {
  // Global floor - no price drops below this
  FLOOR: 0.40,  // 40%

  // === DECREASING PATTERN ===
  DECREASING: {
    START_MIN: 0.85,  // 85% - worst case start
    START_MAX: 0.90,  // 90% - best case start
  },

  // === LARGE SPIKE PATTERN ===
  LARGE_SPIKE: {
    // Pre-spike phase
    START_MIN: 0.85,  // 85%
    START_MAX: 0.90,  // 90%

    // Spike phases (5 periods)
    SPIKE_PHASES: [
      { min: 0.90, max: 1.40 },  // Spike phase 1 [0]: initial rise
      { min: 1.40, max: 2.00 },  // Spike phase 2 [1]: sharp rise
      { min: 2.00, max: 6.00 },  // Spike phase 3 [2]: MAXIMUM
      { min: 1.40, max: 2.00 },  // Spike phase 4 [3]: decline
      { min: 0.90, max: 1.40 },  // Spike phase 5 [4]: final decline
    ],

    // Peak phase aliases (SPIKE_PHASES[2]) — mirrors SMALL_SPIKE naming
    PEAK_RATE_MIN: 2.00,  // 200% — floor of peak phase
    PEAK_RATE_MAX: 6.00,  // 600% — ceiling of peak phase

    // Post-spike phase
    POST_PEAK_MIN: 0.40,
    POST_PEAK_MAX: 0.90,
  },

  // === SMALL SPIKE PATTERN ===
  SMALL_SPIKE: {
    // Pre-spike phase
    START_MIN: 0.40,  // 40% - can start very low
    START_MAX: 0.90,  // 90%

    // Spike range (the game picks a random "rate")
    PEAK_RATE_MIN: 1.40,  // 140%
    PEAK_RATE_MAX: 2.00,  // 200%

    // Spike phases (5 consecutive periods)
    // Phases 2 & 4 are rate-dependent: actual price = ceil(rate × base) − 1 bell
    SPIKE_PHASES: [
      { min: 0.90, max: 1.40 },  // Phase 0: initial rise
      { min: 0.90, max: 1.40 },  // Phase 1: initial rise (same range)
      { min: 1.40, max: 2.00 },  // Phase 2: intermediate (rate − 1 bell, bounded by peak range)
      { min: 1.40, max: 2.00 },  // Phase 3: TRUE MAX (exact rate)
      { min: 1.40, max: 2.00 },  // Phase 4: intermediate decline (rate − 1 bell)
    ],

    // Post-spike phase
    POST_PEAK_MIN: 0.40,
    POST_PEAK_MAX: 0.90,
  },

  // === FLUCTUATING PATTERN ===
  FLUCTUATING: {
    // General range
    MIN: 0.60,  // 60%
    MAX: 1.40,  // 140%

    // High phase
    HIGH_PHASE_MIN: 0.90,  // 90%
    HIGH_PHASE_MAX: 1.40,  // 140%

    // Low phase
    LOW_PHASE_MIN: 0.60,   // 60%
    LOW_PHASE_MAX: 0.80,   // 80%

    // Threshold for detecting low phase
    LOW_PHASE_THRESHOLD: 0.85,  // < 85% = low phase
  },
};

// ============================================================================
// DECAY RATES
// ============================================================================

export const DECAY = {
  MIN_PER_PERIOD: 0.03,  // 3% - best case (drops less)
  MAX_PER_PERIOD: 0.05,  // 5% - worst case (drops more)
};

// ============================================================================
// DETECTION THRESHOLDS
// ============================================================================

export const THRESHOLDS = {
  // === Detection ranges ===
  SMALL_SPIKE_PERFECT_MIN: 1.50,   // 150% - "perfect" range
  SMALL_SPIKE_PERFECT_MAX: 1.90,   // 190%
  SMALL_SPIKE_PRE_PEAK: 1.20,      // 120% - possible pre-peak
  LARGE_SPIKE_NEAR_LIMIT: 1.90,    // 190% - near the limit

  // === Price changes ===
  SIGNIFICANT_RISE: 1.10,          // 10% rise = significant
  MODERATE_RISE_MIN: 1.30,         // 30% rise = moderate
  MODERATE_RISE_MAX: 2.00,         // up to 100%
  RAPID_INCREASE: 2.00,            // 100% = doubles price
  SHARP_DROP: 0.60,                // Drop to 60% = dramatic


  // === Decreasing ===
  DECREASING_LOW_AVG: 0.80,        // Average < 80% = strong signal

  // === Phase detection ===
  RISING_THRESHOLD: 1.20,          // >20% = rising fast
  FALLING_THRESHOLD: 0.90,         // <90% = falling fast
  SLIGHT_RISE: 1.05,               // 5% rise
};

// ============================================================================
// TRANSITION PROBABILITIES
// ============================================================================

// Default probabilities (no history)
export const DEFAULT_PROBABILITIES = {
  fluctuating: 0.35,
  large_spike: 0.25,
  decreasing: 0.15,
  small_spike: 0.25,
};

// Transition matrix (previous pattern -> current pattern)
export const TRANSITION_PROBABILITIES = {
  fluctuating: {
    fluctuating: 0.20,
    large_spike: 0.30,
    decreasing: 0.15,
    small_spike: 0.35,
  },
  large_spike: {
    fluctuating: 0.50,
    large_spike: 0.05,
    decreasing: 0.20,
    small_spike: 0.25,
  },
  decreasing: {
    fluctuating: 0.25,
    large_spike: 0.45,
    decreasing: 0.05,
    small_spike: 0.25,
  },
  small_spike: {
    fluctuating: 0.45,
    large_spike: 0.25,
    decreasing: 0.15,
    small_spike: 0.15,
  },
};

// ============================================================================
// UI CONFIGURATION
// ============================================================================

export const DEBOUNCE_DELAY = 300; // ms
export const LOADING_DELAY = 100; // ms

// Weights for confidence calculation
export const CONFIDENCE = {
  MAX_DATA_WEIGHT: 0.70,           // Max 70% weight to data
  DATA_PERIODS_FOR_MAX: 8,         // 8 periods to reach max weight
};
