# 🎮 Cómo funcionan los patrones de nabos

Esta guía explica cómo funciona cada patrón de precios en Animal Crossing: New Horizons, basado en los algoritmos reales del juego.

## 📊 Los 4 patrones del juego

Animal Crossing tiene 4 patrones que se repiten cada semana. Cada uno funciona diferente:

---

### 📉 Patrón DECRECIENTE (Pattern 2)

**¿Cómo funciona?**
- Empieza entre **85-90%** del precio de compra
- Cada período (AM/PM) **baja 3-5%**
- Es una bajada constante toda la semana

**Ejemplo práctico:**
```
Compraste a: 100 bayas

Lunes AM:   87  (87% - empieza alto)
Lunes PM:   83  (baja ~4%)
Martes AM:  79  (baja ~5%)
Martes PM:  75  (baja ~5%)
Miércoles:  70-65
Jueves:     62-57
Viernes:    54-49
Sábado:     46-41
```

**¿Cuándo vender?**
- ¡Lo antes posible! Este es el peor patrón
- Busca otra isla con mejor patrón
- Nunca esperes al final de la semana

**🎯 Probabilidad de transición:**
- Si tuviste este patrón, la próxima semana tienes **45% de probabilidad de Pico Grande** 🎉

---

### 📊 Patrón FLUCTUANTE (Pattern 0)

**¿Cómo funciona?**
- Alterna entre **fases ALTAS** y **fases BAJAS**
- **Fase ALTA**: Precios entre 90-140% (puede haber ganancia pequeña)
- **Fase BAJA**: Precios entre 60-80%, bajando 4-10% por período
- Es impredecible porque las fases son aleatorias

**Estructura semanal:**
```
12 períodos totales (Lunes AM → Sábado PM)

Fase ALTA  (0-6 períodos)  → 90-140%
Fase BAJA  (2-3 períodos)  → 60-80%, bajando
Fase ALTA  (variable)      → 90-140%
Fase BAJA  (2-3 períodos)  → 60-80%, bajando
Fase ALTA  (resto)         → 90-140%
```

**🎯 REGLA CLAVE del juego:**
```
decPhaseLen1 + decPhaseLen2 = 5 períodos SIEMPRE
```
- Si la primera fase baja tiene **3 períodos** → la segunda tendrá **2 períodos**
- Si la primera fase baja tiene **2 períodos** → la segunda tendrá **3 períodos**

**🧠 Predicción inteligente:**

El predictor ahora **detecta automáticamente** las fases bajas completadas:

1. **Detecta fase baja**: 2 o 3 períodos consecutivos bajando (<85% del precio base)
2. **Deduce la otra fase**: Usa la regla de suma = 5 para saber la longitud de la segunda fase
3. **Predice con precisión**: Una vez que ambas fases bajas pasaron, solo predice fase ALTA (90-140%)

**Ejemplo práctico:**
```
Compraste a: 100 bayas

Lunes:      110, 95   (fase alta)
Martes AM:  75        ← EMPIEZA fase baja 1
Martes PM:  68        (bajando)
Miércoles AM: 60      (bajando) = 3 períodos
                      ✓ El predictor detecta: fase baja de 3 períodos
                      → Deduce: la segunda será de 2 períodos

Miércoles PM: 90      (vuelve a fase alta)
Jueves AM:  95, 130   (fase alta)
Jueves PM:  70        ← EMPIEZA fase baja 2
Viernes AM: 65        (bajando) = 2 períodos
                      ✓ El predictor confirma: segunda fase baja de 2 períodos
                      → Total: 3 + 2 = 5 períodos ✓

Viernes PM: ???       → PREDICCIÓN: 90-140% (solo fase ALTA)
Sábado:     ???, ???  → PREDICCIÓN: 90-140% (solo fase ALTA)
                      Ya no predice 60-140%, ahora sabe que solo puede ser fase alta
```

**¿Cuándo vender?**
- Cuando veas precios sobre el precio de compra (110%+)
- No esperes picos enormes, no van a pasar
- Vende en los días que estén en fase alta
- **💡 Si ya pasaron las 2 fases bajas, el resto de la semana será fase alta (90-140%)**

---

### 📈 Patrón PICO CHICO (Small Spike - Pattern 3)

**¿Cómo funciona?**
- Hay un **pico moderado** durante la semana
- El pico puede empezar entre **martes y sábado** (período 2-9)
- El pico dura **5 períodos** con precios creciendo y luego bajando

**Estructura del pico:**
```
Fase BAJA     → 40-90% (antes del pico)
Pico período 1 → 90-140%
Pico período 2 → 90-140%
Pico período 3 → 140-200% menos 1 baya
Pico período 4 → 140-200%  ← PICO MÁXIMO
Pico período 5 → 140-200% menos 1 baya
Después       → 40-90% (baja)
```

**Ejemplo práctico:**
```
Compraste a: 100 bayas

Lunes:      85-75    (fase baja)
Martes AM:  70       (aún bajo)
Martes PM:  90       (empieza pico - período 1)
Miércoles AM: 120    (período 2)
Miércoles PM: 169    (período 3 - cerca del máximo menos 1)
Jueves AM:  170      ← MÁXIMO (período 4 - 170%)
Jueves PM:  169      (período 5 - cerca del máximo menos 1)
Viernes:    80-70    (ya pasó)
Sábado:     65-55    (terminó)
```

**¿Cuándo vender?**
- En el **cuarto período del pico** (es el más alto)
- Si ves un precio entre **140-200%**, probablemente estás en el pico
- No esperes más después del pico, baja rápido

**💡 Cómo identificarlo:**
- Si ves un precio de **150-190%** y es jueves/viernes, es muy probable que sea Pico Chico

---

### 🚀 Patrón PICO GRANDE (Large Spike - Pattern 1)

**¿Cómo funciona?**
- Hay un **pico ENORME** durante la semana
- El pico puede empezar entre **miércoles y sábado** (período 3-9)
- El pico dura **5 períodos** con precios MUY altos

**Estructura del pico:**
```
Fase BAJA     → 40-90% (antes del pico)
Pico período 1 → 90-140%
Pico período 2 → 140-200%
Pico período 3 → 200-600%  ← PICO MÁXIMO 💰
Pico período 4 → 140-200%
Pico período 5 → 90-140%
Después       → 40-90% (baja)
```

**Ejemplo práctico:**
```
Compraste a: 100 bayas

Lunes:      80-75    (fase baja)
Martes:     70-65    (aún bajo)
Miércoles AM: 90     (empieza pico)
Miércoles PM: 150    (subiendo rápido)
Jueves AM:  450      ← MÁXIMO (450%) 💰💰💰
Jueves PM:  180      (ya bajó)
Viernes:    95-85    (terminó)
Sábado:     70-60    (ya pasó)
```

**¿Cuándo vender?**
- En el **tercer período del pico** (200-600%)
- Si ves un precio sobre **200%**, ¡VENDE! Ese es el momento
- Es el mejor patrón para ganar bayas

**💡 Cómo identificarlo:**
- Si ves un precio **sobre 200%** (el doble de lo que pagaste), es Pico Grande
- Usualmente el pico es a mitad de semana (miércoles-jueves)

---

## 🎯 Sistema de detección de patrones

El predictor analiza los precios que ingresas y **descarta** patrones imposibles:

### ✅ Qué descarta cada patrón:

**Decreciente se descarta si:**
- Hay precios que suben significativamente (más de 5%)
- Ya que este patrón solo baja

**Fluctuante se descarta si:**
- Hay precios extremadamente altos (>150%)
- Hay precios extremadamente bajos (<50%)
- **Hay 4+ períodos consecutivos bajando** (máx. permitido: 3 por fase baja)
- Ya que este patrón es moderado y aleatorio
- **Bonus**: Si detecta fases bajas (2 o 3 períodos), deduce automáticamente la longitud de la otra fase

**Pico Chico se descarta si:**
- Hay precios sobre 200% (eso es Pico Grande)
- Ya que su máximo es 200%

**Pico Grande se descarta si:**
- Es tarde en la semana (después del jueves) y no hay picos altos
- El pico máximo es entre 140-200% sin aumentos rápidos
- **El "pico" es bajo (<140%) y después hay caída dramática (>40%)**
- Ya que necesita tener el pico grande de 200-600%

---

## 📈 Sistema de confianza

La confianza indica qué tan seguro está el predictor:

### 🟢 Alta confianza (≥70%)
- Tienes suficientes datos
- Un patrón destaca claramente sobre los demás
- **Las predicciones son muy confiables**

### 🟡 Confianza media (50-69%)
- Tienes algunos datos
- Hay 2-3 patrones posibles
- **Ingresa más precios para estar más seguro**

### 🔴 Baja confianza (<50%)
- Pocos datos ingresados
- Muchos patrones son posibles
- **Necesitas más datos para predicciones útiles**

### Cómo aumentar la confianza:
1. **Ingresa más precios** (cada precio suma)
2. **Selecciona el patrón de la semana anterior** (+15% confianza base)
3. **Prioriza los primeros días** (lunes-martes identifican el patrón más rápido)

---

## 🔄 Probabilidades de transición (cómo cambian los patrones)

El juego NO elige patrones al azar. El patrón de esta semana **depende** del patrón de la semana anterior:

| Semana anterior → | Esta semana puede ser: |
|-------------------|------------------------|
| **Primera vez / No sabes** | 35% Fluctuante, 25% Pico Grande, 25% Pico Chico, 15% Decreciente |
| **Fluctuante** | 20% Fluctuante, 30% Pico Grande, **35% Pico Chico**, 15% Decreciente |
| **Pico Grande** | **50% Fluctuante**, 5% Pico Grande, 25% Pico Chico, 20% Decreciente |
| **Decreciente** | 25% Fluctuante, **45% Pico Grande** 🎉, 25% Pico Chico, 5% Decreciente |
| **Pico Chico** | **45% Fluctuante**, 25% Pico Grande, 15% Pico Chico, 15% Decreciente |

### 💡 Insights clave:
- Si tuviste **Decreciente**, esta semana tienes **45% de probabilidad de Pico Grande** (¡buenas noticias!)
- Si tuviste **Pico Grande**, casi siempre viene **Fluctuante** (50%)
- **Decreciente raramente se repite** (solo 5%)
- **Pico Grande raramente se repite** (solo 5%)

**Por eso es importante anotar el patrón de cada semana en el predictor**

---

## 🧠 Predicciones dinámicas

El predictor **aprende** de los datos que ingresas:

### Si detecta que estás en PICO:
- Identifica en qué período del pico estás
- Proyecta cuándo va a ser el máximo
- Te dice cuándo vender

### Si detecta que estás en fase BAJA:
- Calcula tu tasa de decrecimiento real
- Proyecta precios futuros con esa tasa
- Te avisa si es Decreciente (para que vendas ya)

### Si detecta FLUCTUANTE:
- **Detecta fases bajas completadas** (2 o 3 períodos consecutivos bajando)
- **Deduce la longitud de la segunda fase baja** (deben sumar 5 períodos)
- **Predice con precisión**: Una vez que ambas fases bajas pasaron, solo muestra fase ALTA (90-140%)
- Te muestra cuándo es mejor vender basándose en las fases detectadas

**Resultado:** Cuantos más precios ingreses, más precisas son las predicciones.

---

## 📚 Referencias

Estos algoritmos están basados en el **código real del juego** que la comunidad extrajo (datamining):
- [Código original en GitHub](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b)
- Análisis de la comunidad de r/acturnips
- Animal Crossing Wiki

---

**💡 Para una guía de uso más simple:** Este documento explica cómo funciona el juego por dentro. Si solo quieres usar el predictor sin conocer los detalles técnicos, lee el [README.md](README.md).
