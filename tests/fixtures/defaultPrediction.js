import { expect} from 'vitest'

export default {
  "allProbabilities": {
    "decreasing": expect.any(Number),
    "fluctuating": expect.any(Number),
    "large_spike": expect.any(Number),
    "small_spike": expect.any(Number),
  },
  "alternatives": [
    {
      "name": "Pico Grande",
      "pattern": "large_spike",
      "percentage": expect.any(Number),
    },
    {
      "name": "Pico Pequeño",
      "pattern": "small_spike",
      "percentage": expect.any(Number),
    },
  ],
  "bestTime": {
    "message": "No hay momento óptimo predecible en patrón aleatorio",
    "pattern": "fluctuating",
  },
  "pattern": "fluctuating",
  "patternName": "Fluctuante",
  "predictions": {
    "mon_am": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Lunes AM",
    },
    "mon_pm": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Lunes PM",
    },
    "tue_am": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Martes AM",
    },
    "tue_pm": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Martes PM",
    },
    "wed_am": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Miércoles AM",
    },
    "wed_pm": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Miércoles PM",
    },
    "thu_am": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Jueves AM",
    },
    "thu_pm": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Jueves PM",
    },
    "fri_am": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Viernes AM",
    },
    "fri_pm": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Viernes PM",
    },
    "sat_am": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Sábado AM",
    },
    "sat_pm": {
      "isUserInput": false,
      "max": expect.any(Number),
      "min": expect.any(Number),
      "name": "Sábado PM",
    },
  },
  "primaryPercentage": 35,
  "recommendation": [
    "🎲 Precios variables durante la semana",
    "✅ Vende cuando supere tu precio de compra",
    "⚖️ Patrón impredecible, mantente atento",
  ],
  "rejectionReasons": {
    "decreasing": [],
    "fluctuating": [],
    "large_spike": [],
    "small_spike": [],
  },
  "scoreReasons": {
    "decreasing": [],
    "fluctuating": [],
    "large_spike": [],
    "small_spike": [],
  },
}