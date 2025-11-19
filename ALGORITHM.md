# 🧮 Documentación Técnica del Algoritmo

Este documento explica en detalle cómo funciona el sistema de predicción de nabos.

## 📊 Sistema de puntuación (Scoring)

Cada patrón recibe puntos según qué tan bien coincide con los datos ingresados:

### Patrón Decreciente
- **+100 puntos**: Si todos los precios bajan consistentemente
- **+30 puntos**: Si el promedio de precios es bajo (<70% del base)
- **Descartado**: Si hay subidas significativas (>5%)

### Pico Grande (Large Spike)
- **+80 puntos**: Si hay precios >200% del base
- **+30 puntos**: Si hay transición de fase baja a alta
- **Descartado**: Si es tarde en la semana sin picos altos

### Pico Pequeño (Small Spike)
- **+70 puntos**: Si hay pico moderado (140-200%)
- **+40 puntos**: Si hay pico menor (120-140%)
- **Descartado**: Si hay precios >200% del base

### Fluctuante
- **+50 puntos**: Si varía sin extremos
- **+30 puntos**: Base (es el patrón más común)
- **Descartado**: Si hay extremos muy altos (>150%) o muy bajos (<50%)

## 🔄 Conversión a porcentajes

1. **Suma total**: Se suman todos los puntos de patrones válidos
   ```
   Ejemplo: Fluctuante (90) + Pico Pequeño (60) + Pico Grande (50) = 200 pts
   ```

2. **Porcentaje individual**: `(puntos del patrón / total) × 100`
   ```
   Fluctuante: 90/200 = 45%
   Pico Pequeño: 60/200 = 30%
   Pico Grande: 50/200 = 25%
   ```

## 🎯 Cálculo de confianza

La confianza total se calcula con dos componentes:

### Confianza por cantidad de datos (max 40%)
```
cantidad de precios × 8 = confianza (máximo 40%)
```
- 1 precio = 8%
- 2 precios = 16%
- 3 precios = 24%
- 4 precios = 32%
- 5+ precios = 40%

### Confianza por diferencia entre patrones (max 60%)
```
diferencia entre 1er y 2do lugar
```
- Si 1er lugar tiene 85% y 2do tiene 15% → diferencia = 70% (muy alta confianza)
- Si 1er lugar tiene 45% y 2do tiene 35% → diferencia = 10% (baja confianza)

### Confianza total
```
confianza total = confianza por datos + confianza por diferencia (max 100%)
```

### Niveles de confianza
- **🟢 Alta (≥70%)**: Muestra solo el patrón principal
- **🟡 Media (50-69%)**: Muestra patrones alternativos
- **🔴 Baja (<50%)**: Necesita más datos

## 🧠 Sistema de ajuste dinámico

El predictor utiliza tres métodos auxiliares para análisis en tiempo real:

### `detectPricePhase(knownPrices)`

Detecta la tendencia actual de precios:

```javascript
const last = prices[prices.length - 1];
const secondLast = prices[prices.length - 2];

if (last > secondLast * 1.2) return 'rising';     // Subida rápida >20%
if (last > secondLast) return 'increasing';       // Subida moderada
if (last < secondLast * 0.9) return 'falling';    // Bajada rápida >10%
if (last < secondLast) return 'decreasing';       // Bajada moderada
return 'stable';                                   // Sin cambios
```

**Uso:** Determina si estamos en fase de subida (pre-pico), bajada (post-pico), o estable.

### `findPeakInKnownPrices(knownPrices)`

Identifica el precio máximo y su posición:

```javascript
return {
  price: maxPrice,  // Precio más alto observado
  index: maxIndex   // En qué período ocurrió
};
```

**Uso:** Detecta si ya pasó el pico y desde cuándo proyectar la caída.

### `calculateVolatility(knownPrices)`

Calcula la desviación estándar como porcentaje del promedio:

```javascript
const avg = average(prices);
const variance = average(prices.map(p => (p - avg)²));
const stdDev = sqrt(variance);
return (stdDev / avg) * 100;  // Volatilidad %
```

**Resultados:**
- **<10%**: Baja volatilidad (precios estables)
- **10-20%**: Volatilidad media (normal)
- **>20%**: Alta volatilidad (muy variable)

**Uso:** Ajusta rangos de predicción en patrón fluctuante.

## 📈 Ajuste dinámico por patrón

### Pico Grande (Large Spike)

#### Post-pico
Si ya pasó el pico, proyecta caída del **15% por período**:
```javascript
const periodsAfterPeak = currentPeriod - peakIndex;
const projected = peakPrice × (1 - 0.15)^periodsAfterPeak;
```

#### Fase de subida
Si detecta subida rápida (>20%), proyecta crecimiento del **50% por período**:
```javascript
const periodsAhead = currentPeriod - lastKnownIndex;
const projected = lastKnownPrice × (1 + 0.50)^periodsAhead;
```

#### Ajuste de piso
En fase baja, ajusta el "piso" basándose en promedios observados:
```javascript
const avgLowPhase = average(knownPrices);
const floorLevel = avgLowPhase / basePrice;
```

### Pico Pequeño (Small Spike)

Similar al Pico Grande pero con tasas más conservadoras:
- **Post-pico**: Caída del **12% por período**
- **Fase de subida**: Crecimiento del **25% por período**

### Fluctuante (Fluctuating)

Ajusta rangos basándose en volatilidad:

#### Baja volatilidad (<10%)
```javascript
minMultiplier = 0.70;  // 70% del base
maxMultiplier = 1.20;  // 120% del base
// Rango estrecho = más precisión
```

#### Volatilidad media (10-20%)
```javascript
minMultiplier = 0.60;  // 60% del base
maxMultiplier = 1.40;  // 140% del base
// Rango normal
```

#### Alta volatilidad (>20%)
```javascript
minMultiplier = 0.50;  // 50% del base
maxMultiplier = 1.50;  // 150% del base
// Rango amplio = más incertidumbre
```

#### Proyección de corto plazo
Para períodos cercanos (1-2 períodos adelante):
```javascript
const avgPrice = average(allKnownPrices);
const refPrice = (lastPrice + avgPrice) / 2;  // Promedio entre último y media
return { min: refPrice * 0.85, max: refPrice * 1.15 };
```

### Decreciente (Decreasing)

Calcula la tasa real de decrecimiento observada:

```javascript
// Para cada par de precios consecutivos
const rateChange = (prevPrice - currPrice) / prevPrice;
totalRateChange += rateChange;

// Promedio de todas las tasas
const observedRate = totalRateChange / numberOfPairs;

// Proyección
const periodsAhead = currentPeriod - lastKnownIndex;
const projected = lastKnownPrice × (1 - observedRate)^periodsAhead;
```

**Ejemplo:**
- Base: 92, Lunes AM: 86, Lunes PM: 83, Martes AM: 79
- Tasa 1: (86-83)/86 = 3.5%
- Tasa 2: (83-79)/83 = 4.8%
- Tasa promedio: ~4.15%
- Martes PM proyectado: 79 × (1 - 0.0415) ≈ 76
- Rango: 68-84 (±10%)

## 📋 Ejemplo completo: Escenario paso a paso

### Escenario 1: Sin datos
```
Input: Base = 100
Scores: Todos los patrones = 25 pts (sin información)
Percentages: 25% cada uno
Confidence: 0% (sin datos)
Result: "Ingresa más datos" - 🔴
```

### Escenario 2: 2 precios bajando
```
Input: Base = 100, Lunes AM = 85, Lunes PM = 80
Scores:
  - Decreciente: 100 pts (bajan consistentemente)
  - Fluctuante: 50 pts (posible)
  - Pico Grande: 30 pts (fase baja posible)
  - Pico Pequeño: 30 pts (fase baja posible)
Total: 210 pts

Percentages:
  - Decreciente: 100/210 = 48%
  - Fluctuante: 50/210 = 24%
  - Pico Grande: 30/210 = 14%
  - Pico Pequeño: 30/210 = 14%

Confidence:
  - Por datos: 2 × 8 = 16%
  - Por diferencia: 48 - 24 = 24%
  - Total: 40% 🔴

Result: "Patrón Decreciente (48%) - También podría ser Fluctuante (24%)"
```

### Escenario 3: 5 precios con pico alto
```
Input: Base = 100, Lunes AM = 85, Lunes PM = 80, Martes AM = 90, Martes PM = 250, Miércoles AM = 280

Scores:
  - Pico Grande: 80 + 30 = 110 pts (precio >200% + transición)
  - Pico Pequeño: 0 pts (descartado, >200%)
  - Fluctuante: 0 pts (descartado, extremo alto)
  - Decreciente: 0 pts (descartado, subida)
Total: 110 pts

Percentages:
  - Pico Grande: 110/110 = 100%

Confidence:
  - Por datos: 5 × 8 = 40%
  - Por diferencia: 100 - 0 = 60%
  - Total: 100% 🟢

Dynamic Adjustment:
  - Phase detected: 'rising' (280 > 250 × 1.2 = 300, NO)
  - Phase detected: 'increasing' (280 > 250, YES)
  - Peak found: 280 at period 4
  - Next periods: Project 15% decline from peak

Result: "Patrón Pico Grande (100%) [100% confianza - 🟢]"
        "Recomendación: Estás en el pico - vende ahora o espera un período más"
```

## 🔧 Parámetros configurables

En `predictor.js` puedes ajustar:

### Rangos de patrones
```javascript
// Patrón Decreciente
decreasingPattern() {
  const baseRate = 0.025;  // 2.5% de caída base
  const startMultiplier = 0.90;  // Empieza al 90%
  const endMultiplier = 0.40;    // Termina al 40%
}

// Pico Grande
largeSpikePattern() {
  const maxSpikeMultiplier = 6.0;  // Hasta 600%
  const minSpikeMultiplier = 1.4;  // Mínimo 140%
}
```

### Tasas de ajuste dinámico
```javascript
// Tasa de crecimiento en fase de subida
const growthRate = 0.50;  // 50% para Pico Grande
const growthRate = 0.25;  // 25% para Pico Pequeño

// Tasa de caída post-pico
const decayRate = 0.15;  // 15% para Pico Grande
const decayRate = 0.12;  // 12% para Pico Pequeño
```

### Umbrales de volatilidad
```javascript
if (volatility < 10) {
  // Baja volatilidad
} else if (volatility > 20) {
  // Alta volatilidad
}
```

## 🎓 Notas sobre precisión

- Las predicciones son **aproximaciones** basadas en data mining de la comunidad
- La precisión aumenta con más datos (especialmente primeros días de la semana)
- Los algoritmos se basan en patrones observados, no en código oficial del juego
- Para predicciones 100% precisas, consulta herramientas que usan datamining directo como **Turnip Prophet**

## 📚 Referencias

- [Animal Crossing Wiki - Turnip Patterns](https://animalcrossing.fandom.com/wiki/White_turnip)
- Datos de la comunidad de r/acturnips
- Análisis de patrones de jugadores

---

**Nota:** Este documento es para desarrolladores y usuarios avanzados. La mayoría de usuarios solo necesitan leer el [README.md](README.md).
