import { expect} from 'vitest'

export default {
  allProbabilities: {
    decreasing: expect.any(Number),
    fluctuating: expect.any(Number),
    large_spike: expect.any(Number),
    small_spike: expect.any(Number),
  },
  alternatives: [
    {
      name: "Pico Grande",
      pattern: "large_spike",
      percentage: expect.any(Number),
    },
    {
      name: "Pico Pequeño",
      pattern: "small_spike",
      percentage: expect.any(Number),
    },
  ],
  bestSellDay: null,
  pattern: "fluctuating",
  patternName: "Fluctuante",
  predictions: {
    mon_am: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    mon_pm: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    tue_am: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    tue_pm: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    wed_am: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    wed_pm: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    thu_am: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    thu_pm: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    fri_am: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    fri_pm: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    sat_am: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
    sat_pm: {
      isUserInput: false,
      max: expect.any(Number),
      min: expect.any(Number),
    },
  },
  recommendations: [
    "🎲 Precios variables durante la semana",
    "✅ Vende cuando supere tu precio de compra",
    "⚖️ Patrón impredecible, mantente atento",
  ],
  rejectionReasons: {
    decreasing: [],
    fluctuating: [],
    large_spike: [],
    small_spike: [],
  },
  scoreReasons: {
    decreasing: [],
    fluctuating: [],
    large_spike: [],
    small_spike: [],
  },
}