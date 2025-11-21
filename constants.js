// Constants.js - Shared constants across the application

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

// Turnip price validation (según Animal Crossing Wiki)
const TURNIP_PRICE_MIN = 9;
const TURNIP_PRICE_MAX = 660;
const BUY_PRICE_MIN = 90;
const BUY_PRICE_MAX = 110;

// Debounce configuration
const DEBOUNCE_DELAY = 300; // ms
const LOADING_DELAY = 100; // ms
