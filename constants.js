// Constants.js - Shared constants across the application
// Basado en el algoritmo datamineado de Animal Crossing: New Horizons

// ============================================================================
// CONFIGURACIÓN DE DÍAS/PERÍODOS
// ============================================================================

// Days/periods configuration - single source of truth
const DAYS_CONFIG = [
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
const PRICE_INPUT_IDS = DAYS_CONFIG.map(d => d.key);

// ============================================================================
// PATRONES
// ============================================================================

// Pattern keys (internal identifiers)
const PATTERNS = {
  FLUCTUATING: 'fluctuating',
  LARGE_SPIKE: 'large_spike',
  SMALL_SPIKE: 'small_spike',
  DECREASING: 'decreasing'
};

// Pattern display names (español)
const PATTERN_NAMES = {
  'fluctuating': 'Fluctuante',
  'large_spike': 'Pico Grande',
  'small_spike': 'Pico Pequeño',
  'decreasing': 'Decreciente'
};

// Encoding map: pattern name → single letter (for URL compression)
const PATTERN_ENCODE_MAP = {
  'fluctuating': 'f',
  'large_spike': 'l',
  'small_spike': 's',
  'decreasing': 'd'
};

// Decoding map: single letter → pattern name (for URL decompression)
const PATTERN_DECODE_MAP = {
  'f': 'fluctuating',
  'l': 'large_spike',
  's': 'small_spike',
  'd': 'decreasing'
};

// ============================================================================
// PERÍODOS CLAVE (índices de DAYS_CONFIG)
// ============================================================================

const PERIODS = {
  MONDAY_AM: 0,
  MONDAY_PM: 1,     // Inicio mínimo Small Spike (período 1)
  TUESDAY_AM: 2,    // Inicio mínimo Large Spike (período 2)
  TUESDAY_PM: 3,
  WEDNESDAY_AM: 4,
  WEDNESDAY_PM: 5,
  THURSDAY_AM: 6,
  THURSDAY_PM: 7,   // Último inicio posible para picos (período 7)
  FRIDAY_AM: 8,     // "Tarde en la semana"
  FRIDAY_PM: 9,
  SATURDAY_AM: 10,
  SATURDAY_PM: 11,  // Último período

  // Alias semánticos
  SMALL_SPIKE_PEAK_START_MIN: 1,  // Lunes PM
  LARGE_SPIKE_PEAK_START_MIN: 2,  // Martes AM
  SPIKE_PEAK_START_MAX: 7,        // Jueves PM (ambos) - último inicio posible para 5 períodos
  LATE_WEEK_START: 8,             // Viernes AM
  LAST_PERIOD: 11,                // Sábado PM
};

// ============================================================================
// VALIDACIÓN DE PRECIOS
// ============================================================================

// Turnip price validation (según Animal Crossing Wiki)
const TURNIP_PRICE_MIN = 9;
const TURNIP_PRICE_MAX = 660;
const BUY_PRICE_MIN = 90;
const BUY_PRICE_MAX = 110;

// ============================================================================
// RATIOS DE PRECIO (porcentajes del precio base)
// ============================================================================

const RATES = {
  // Piso global - ningún precio baja de aquí
  FLOOR: 0.40,  // 40%

  // === PATRÓN DECRECIENTE (Decreasing) ===
  DECREASING: {
    START_MIN: 0.85,  // 85% - inicio peor caso
    START_MAX: 0.90,  // 90% - inicio mejor caso
    FLOOR: 0.40,      // 40% - piso mínimo
  },

  // === PATRÓN PICO GRANDE (Large Spike) ===
  LARGE_SPIKE: {
    // Fase pre-pico
    START_MIN: 0.85,  // 85%
    START_MAX: 0.90,  // 90%
    FLOOR: 0.40,      // 40%

    // Fases del pico (5 períodos)
    PEAK_PHASES: [
      { min: 0.90, max: 1.40 },  // Período 1: subida inicial
      { min: 1.40, max: 2.00 },  // Período 2: subida fuerte
      { min: 2.00, max: 6.00 },  // Período 3: PICO MÁXIMO ⭐
      { min: 1.40, max: 2.00 },  // Período 4: bajada
      { min: 0.90, max: 1.40 },  // Período 5: bajada final
    ],

    // Fase post-pico
    POST_PEAK_MIN: 0.40,
    POST_PEAK_MAX: 0.90,
  },

  // === PATRÓN PICO PEQUEÑO (Small Spike) ===
  SMALL_SPIKE: {
    // Fase pre-pico
    START_MIN: 0.40,  // 40% - puede empezar muy bajo
    START_MAX: 0.90,  // 90%
    FLOOR: 0.40,      // 40%

    // Rango del pico (el juego elige un "rate" aleatorio)
    PEAK_RATE_MIN: 1.40,  // 140%
    PEAK_RATE_MAX: 2.00,  // 200%

    // Fases del pico
    // Período 1 y 2: 0.9-1.4
    // Período 3: (1.4 a rate) - 1 bell (intermedio)
    // Período 4: rate (PICO REAL) ⭐
    // Período 5: (1.4 a rate) - 1 bell (intermedio)
    PEAK_PHASE_INITIAL_MIN: 0.90,
    PEAK_PHASE_INITIAL_MAX: 1.40,

    // Fase post-pico
    POST_PEAK_MIN: 0.40,
    POST_PEAK_MAX: 0.90,
  },

  // === PATRÓN FLUCTUANTE (Fluctuating) ===
  FLUCTUATING: {
    // Rango general
    MIN: 0.60,  // 60%
    MAX: 1.40,  // 140%

    // Fase alta
    HIGH_PHASE_MIN: 0.90,  // 90%
    HIGH_PHASE_MAX: 1.40,  // 140%

    // Fase baja
    LOW_PHASE_MIN: 0.60,   // 60%
    LOW_PHASE_MAX: 0.80,   // 80%

    // Umbral para detectar fase baja
    LOW_PHASE_THRESHOLD: 0.85,  // < 85% = fase baja
  },
};

// ============================================================================
// TASAS DE DECRECIMIENTO
// ============================================================================

const DECAY = {
  // Tasa de decrecimiento por período
  MIN_PER_PERIOD: 0.03,  // 3% - mejor caso (baja menos)
  MAX_PER_PERIOD: 0.05,  // 5% - peor caso (baja más)

  // Para proyecciones con precio conocido
  BEST_CASE_MULTIPLIER: 0.97,   // Baja 3% por período
  WORST_CASE_MULTIPLIER: 0.95,  // Baja 5% por período
};

// ============================================================================
// UMBRALES DE DETECCIÓN
// ============================================================================

const THRESHOLDS = {
  // === Confirmación de patrones ===
  LARGE_SPIKE_CONFIRMED: 2.0,      // ≥200% confirma Large Spike
  SMALL_SPIKE_MIN: 1.40,           // ≥140% puede ser Small Spike
  SMALL_SPIKE_MAX: 2.00,           // <200% para ser Small Spike

  // === Rangos de detección ===
  SMALL_SPIKE_PERFECT_MIN: 1.50,   // 150% - rango "perfecto"
  SMALL_SPIKE_PERFECT_MAX: 1.90,   // 190%
  SMALL_SPIKE_PRE_PEAK: 1.20,      // 120% - posible pre-pico
  LARGE_SPIKE_NEAR_LIMIT: 1.90,    // 190% - cerca del límite

  // === Cambios de precio ===
  SIGNIFICANT_RISE: 1.10,          // 10% subida = significativa
  MODERATE_RISE_MIN: 1.30,         // 30% subida = moderada
  MODERATE_RISE_MAX: 2.00,         // hasta 100%
  RAPID_INCREASE: 2.00,            // 100% = duplica precio
  SHARP_DROP: 0.60,                // Caída a 60% = dramática

  // === Fluctuante ===
  FLUCTUATING_DROP: 0.98,          // 2% caída para detectar tendencia
  FLUCTUATING_RISE: 1.02,          // 2% subida para detectar tendencia
  FLUCTUATING_MIN_RATIO: 0.50,     // 50% mínimo
  FLUCTUATING_MAX_RATIO: 1.50,     // 150% máximo
  FLUCTUATING_MODERATE_MIN: 0.80,  // 80%
  FLUCTUATING_MODERATE_MAX: 1.50,  // 150%
  FLUCTUATING_MAX_CONSECUTIVE_INCREASES: 2,  // Máximo 2 subidas consecutivas (3 precios = pico)
  FLUCTUATING_MAX_CONSECUTIVE_DECREASES: 3,  // Máximo 3 bajadas consecutivas (4 precios)

  // === Decreasing ===
  DECREASING_LOW_AVG: 0.80,        // Promedio < 80% = señal fuerte

  // === Detección de fases ===
  RISING_THRESHOLD: 1.20,          // >20% = subiendo rápido
  FALLING_THRESHOLD: 0.90,         // <90% = bajando rápido
  SLIGHT_RISE: 1.05,               // 5% subida
};

// ============================================================================
// VARIANZAS DE PROYECCIÓN
// ============================================================================

const VARIANCE = {
  // Con 2+ precios conocidos (±10%)
  PROJECTED_MIN: 0.90,
  PROJECTED_MAX: 1.10,

  // Con 1 precio conocido / inferencias (±5%)
  INFERRED_MIN: 0.95,
  INFERRED_MAX: 1.05,
};

// ============================================================================
// PROBABILIDADES DE TRANSICIÓN
// ============================================================================

// Probabilidades por defecto (sin historial)
const DEFAULT_PROBABILITIES = {
  fluctuating: 0.35,
  large_spike: 0.25,
  decreasing: 0.15,
  small_spike: 0.25,
};

// Matriz de transición (patrón anterior → patrón actual)
const TRANSITION_PROBABILITIES = {
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
// CONFIGURACIÓN DE UI
// ============================================================================

const DEBOUNCE_DELAY = 300; // ms
const LOADING_DELAY = 100; // ms

// Pesos para cálculo de confianza
const CONFIDENCE = {
  MAX_DATA_WEIGHT: 0.70,           // Máximo 70% peso a datos
  DATA_PERIODS_FOR_MAX: 8,         // 8 períodos para alcanzar máximo peso
};
