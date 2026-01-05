# Algoritmo de Predicción de Precios de Nabos

Documentación técnica de los patrones de precios implementados en este calculador.

---

## Los 4 Patrones

Animal Crossing tiene 4 patrones de precios que se alternan semanalmente según probabilidades de transición.

### 1. Decreciente (Pattern 2)

**Estructura:**
- Empieza: 85-90% del precio base
- Decrecimiento: 3-5% por período
- Piso mínimo: 40%

**Implementación:**
```
Rate inicial = 0.85-0.90
Por cada período: rate -= 0.03-0.05
Precio = base × max(0.40, rate)
```

**Detección inteligente:**
- Con 2+ precios conocidos: calcula tasa de decrecimiento real del rate observado
- Proyecta períodos futuros usando tasa calculada con ±5% varianza

---

### 2. Fluctuante (Pattern 0)

**Estructura:**
- Alterna entre fases ALTAS (90-140%) y fases BAJAS (60-80%)
- 2 fases bajas que suman exactamente 5 períodos (2+3 o 3+2)
- 3 fases altas (variable duración)

**Fases:**
```
ALTA 1 (0-6 períodos)    → 90-140%
BAJA 1 (2-3 períodos)    → 60-80%, baja 4-10%
ALTA 2 (variable)        → 90-140%
BAJA 2 (3-2 períodos)    → 60-80%, baja 4-10%
ALTA 3 (resto)           → 90-140%
```

**Regla del juego:**
```
decPhaseLen1 + decPhaseLen2 = 5 períodos SIEMPRE
```

**Detección inteligente:**
1. Detecta fases bajas completadas (2 o 3 períodos consecutivos <85% bajando)
2. Deduce longitud de la segunda fase baja (5 - primera fase)
3. Una vez detectadas ambas fases bajas, predice solo fase ALTA (90-140%) para el resto

**Restricciones de validación:**
- Rechaza si >2 incrementos consecutivos (indica Spike)
- Rechaza si >3 decrementos consecutivos (excede fase baja)
- Rechaza si baja desde el inicio sin fase alta

---

### 3. Pico Grande (Large Spike - Pattern 1)

**Estructura:**
- Fase decreciente pre-pico: 85-90% bajando 3-5% por período
- Pico de 5 períodos (empieza entre período 3-7)
- Fase post-pico: 40-90%

**Fases del pico:**
```
Período 1: 90-140%   (subida inicial)
Período 2: 140-200%  ⭐ (sube dramáticamente)
Período 3: 200-600%  (PICO MÁXIMO)
Período 4: 140-200%
Período 5: 90-140%
```

**Diferenciador clave:**
- Período 2 ≥ 140% confirma Large Spike
- Período 2 < 140% descarta Large Spike (es Small Spike)

**Validaciones:**
- Lunes AM debe estar entre 85-90%
- Rate no puede bajar >5% por período en fase pre-pico
- No puede subir significativamente antes del período 3
- Rechaza si llegamos tarde (≥Jueves PM) sin subida significativa

---

### 4. Pico Pequeño (Small Spike - Pattern 3)

**Estructura:**
- Fase decreciente pre-pico: 40-90% bajando 3-5% por período
- Pico de 5 períodos (empieza entre período 2-7)
- Fase post-pico: 40-90%

**Fases del pico:**
```
Período 1: 90-140%
Período 2: 90-140%   ⭐ (se mantiene, NO sube a 140%+)
Período 3: 140-200% menos 1 baya
Período 4: 140-200%  (PICO MÁXIMO, rate exacto)
Período 5: 140-200% menos 1 baya
```

**Implementación del rate:**
- El juego elige un rate aleatorio entre 1.4-2.0
- Período 4 = base × rate (pico real)
- Períodos 3 y 5 = base × rate - 1 baya

**Diferenciador clave:**
- Período 2 < 140% confirma Small Spike
- Período 2 ≥ 140% descarta Small Spike (es Large Spike)

**Inferencia del rate:**
- Si tenemos período 4: rate conocido exacto
- Si tenemos período 3 o 5: rate ≥ (precio + 1) / base
- Permite predicciones precisas del resto del pico

**Validaciones:**
- Rate no puede bajar >5% por período en fase pre-pico
- No puede subir significativamente antes del período 2
- Rechaza si llegamos tarde (≥Jueves PM) sin subida significativa
- Rechaza si el pico máximo excede 200%

---

## Sistema de Detección de Patrones

### Rechazo automático

Cada patrón se rechaza si no cumple sus reglas:

**Decreciente:**
- ❌ Lunes con precio >100%
- ❌ Cualquier subida significativa

**Fluctuante:**
- ❌ Precios fuera de 60-140%
- ❌ >2 incrementos consecutivos
- ❌ >3 decrementos consecutivos
- ❌ Baja desde el inicio (≥2 períodos)

**Large Spike:**
- ❌ Período 2 del pico <140%
- ❌ Lunes AM fuera de 85-90%
- ❌ Rate baja >5% por período en pre-pico
- ❌ Sube temprano (antes del período 3)
- ❌ Tarde sin subida (≥Jueves PM)

**Small Spike:**
- ❌ Período 2 del pico ≥140%
- ❌ Pico máximo >200%
- ❌ Rate baja >5% por período en pre-pico
- ❌ Sube temprano (antes del período 2)
- ❌ Tarde sin subida (≥Jueves PM)

### Scoring de patrones

Combina probabilidades de transición con análisis de datos reales:

```javascript
score = (dataScore × dataWeight) + (probabilityScore × probWeight)

dataWeight = min(knownPrices.length / 8, 0.70)  // Max 70% peso a datos
probWeight = 1 - dataWeight                      // Min 30% peso a probabilidades
```

**Data Score** se calcula según:
- Confirmaciones (pico detectado, bajadas consecutivas, etc.)
- Señales (subidas rápidas, promedios bajos, etc.)
- Penalizaciones (fuera de rango, patrones incorrectos, etc.)

---

## Probabilidades de Transición

El patrón actual depende del patrón anterior:

| Anterior | Fluctuante | Large Spike | Decreasing | Small Spike |
|----------|-----------|-------------|------------|-------------|
| **Primera vez** | 35% | 25% | 15% | 25% |
| **Fluctuante** | 20% | 30% | 15% | **35%** |
| **Large Spike** | **50%** | 5% | 20% | 25% |
| **Decreasing** | 25% | **45%** | 5% | 25% |
| **Small Spike** | **45%** | 25% | 15% | 15% |

**Insights:**
- Large Spike y Decreasing raramente se repiten (5%)
- Después de Decreasing: 45% Large Spike
- Después de Large Spike: 50% Fluctuante

---

## Constantes del Algoritmo

Definidas en `constants.js`:

### RATES
Ratios de precio (porcentaje del precio base):
```javascript
DECREASING: { START_MIN: 0.85, START_MAX: 0.90, FLOOR: 0.40 }
LARGE_SPIKE: { START_MIN: 0.85, START_MAX: 0.90, PEAK_PHASES: [...] }
SMALL_SPIKE: { PEAK_RATE_MIN: 1.40, PEAK_RATE_MAX: 2.00, ... }
FLUCTUATING: { MIN: 0.60, MAX: 1.40, HIGH: 0.90-1.40, LOW: 0.60-0.80 }
```

### DECAY
Tasas de decrecimiento:
```javascript
MIN_PER_PERIOD: 0.03  // 3% - mejor caso
MAX_PER_PERIOD: 0.05  // 5% - peor caso
```

### THRESHOLDS
Umbrales de detección:
```javascript
LARGE_SPIKE_CONFIRMED: 2.0       // ≥200% confirma Large Spike
SMALL_SPIKE_MIN: 1.40            // ≥140% puede ser Small Spike
SMALL_SPIKE_MAX: 2.00            // <200% para Small Spike
SIGNIFICANT_RISE: 1.10           // 10% = subida significativa
FLUCTUATING_MAX_CONSECUTIVE_INCREASES: 2
FLUCTUATING_MAX_CONSECUTIVE_DECREASES: 3
```

### PERIODS
Índices de períodos (0 = Lunes AM, 11 = Sábado PM):
```javascript
SMALL_SPIKE_PEAK_START_MIN: 1   // Lunes PM
LARGE_SPIKE_PEAK_START_MIN: 2   // Martes AM
SPIKE_PEAK_START_MAX: 7         // Jueves PM
```

---

## Mejoras sobre el Algoritmo Original

Este calculador implementa mejoras sobre el gist original (2020):

### 1. Detección de Período 2 del Pico
- **Original:** No diferencia automáticamente Large vs Small Spike
- **Actual:** Detecta período 2 y confirma/rechaza definitivamente basándose en si ≥140%

### 2. Predicción Inteligente de Fluctuante
- **Original:** Solo genera rangos aleatorios por fase
- **Actual:** Detecta fases bajas completadas y deduce la segunda automáticamente

### 3. Sistema de Rechazo con Razones
- **Original:** Solo genera rangos
- **Actual:** Sistema completo de validación que rechaza patrones imposibles con explicaciones

### 4. Validación de Rate Drop
- **Original:** No valida pendientes
- **Actual:** Rechaza Spikes si el rate baja >5% por período en pre-pico

### 5. Proyección Dinámica
- **Original:** Rangos fijos
- **Actual:** Calcula tasa de decrecimiento real observada y proyecta con varianza

### 6. Sistema de Scoring
- **Original:** No existe
- **Actual:** Combina probabilidades de transición con análisis de datos (30-70% peso ajustable)

### 7. Restricciones de Alternancia
- **Original:** Permite cualquier secuencia en Fluctuante
- **Actual:** Rechaza >2 incrementos o >3 decrementos consecutivos

---

## Referencias

- [Código original datamineado](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b) (Ninji/Treeki, abril 2020)
- Comunidad de r/acturnips
- Animal Crossing Wiki

**Nota:** El gist original es de la versión 1.0-1.1 del juego. Este calculador implementa mejoras adicionales de detección y validación.
