# 🥕 Predictor de Nabos - Animal Crossing New Horizons

Calculadora de precios de nabos basada en los **algoritmos reales del juego**.

Predice cuándo vender tus nabos para ganar el máximo de bayas.

---

## ✨ Features

- 🎯 **Predicciones precisas** basadas en los algoritmos del juego (datamining)
- 🧠 **Sistema inteligente** que aprende de tus precios y descarta patrones imposibles
- 📊 **Nivel de confianza** te dice qué tan seguras son las predicciones
- 🔄 **Probabilidades de transición** usa el patrón de la semana anterior para predecir mejor
- 💾 **Guardado automático** en tu navegador
- ⚡ **100% offline** - no necesita internet después de cargar
- 📱 **Responsive** - funciona en móvil, tablet y desktop

---

## 🎮 ¿Qué son los nabos?

Los nabos son el "mercado de valores" de Animal Crossing:

- **Domingo**: Perico los vende a 90-110 bayas
- **Lunes a Sábado**: El precio cambia 2 veces al día (mañana/tarde)
- **Siguiente domingo**: Los nabos se pudren y pierdes todo
- **Cada semana**: Tu isla tiene uno de 4 patrones de precios

**Tu objetivo:** Comprar barato el domingo, vender caro durante la semana.

---

## 📊 Los 4 Patrones (explicados simple)

### 📉 Decreciente
**El peor patrón.**

Los precios solo bajan toda la semana. Empiezan en 85-90% y caen gradualmente hasta 40%.

**Qué hacer:** Vende HOY o visita otra isla. Solo va a empeorar.

---

### 📊 Fluctuante
**El patrón aleatorio.**

Los precios suben y bajan sin patrón claro. Puede llegar hasta 140% pero también bajar a 60%.

Alterna entre "fases altas" (90-140%) y "fases bajas" (60-80%).

**Qué hacer:** Vende cuando veas precios arriba de lo que pagaste (100%+). No esperes picos gigantes, no van a pasar.

---

### 📈 Pico Pequeño
**Pico moderado.**

Los precios están bajos la mayor parte de la semana, pero hay un **pico de 5 períodos** donde suben hasta 140-200%.

El pico puede aparecer cualquier día de la semana.

**Qué hacer:** Espera el pico (140-200%) y vende ahí. Después del pico, baja rápido.

**Cómo identificarlo:**
- Ves precios subiendo gradualmente (90% → 120% → 170%)
- El pico máximo está entre 140-200%

---

### 🚀 Pico Grande
**¡El MEJOR patrón!**

Como el Pico Pequeño, pero MUCHO más alto. El **pico puede llegar hasta 600%** 💰

El pico dura 5 períodos y alcanza su máximo en el **tercer período** (200-600%).

**Qué hacer:** Espera a ver precios de 200%+ y vende inmediatamente. ¡Ese es el momento!

**Cómo identificarlo:**
- Ves una subida ENORME de golpe (90% → 160% → 450%)
- El pico está entre 200-600%

**Diferencia clave entre Pico Grande y Pico Pequeño:**
- **Pico Grande**: El segundo período del pico sube a 140%+ (subida dramática), luego el tercer período llega a 200-600%
- **Pico Pequeño**: El segundo período se mantiene en 90-140% (subida gradual), luego llega a 140-200%

---

## 🎯 Cómo Usar el Predictor

### Paso a paso:
1. Ingresa tu **precio de compra** del domingo
2. **Selecciona el patrón de la semana anterior** (si lo recuerdas) → Mejora mucho la precisión
3. Ingresa precios conforme los veas en tu isla
4. Haz clic en **"Calcular Pronóstico"**
5. Revisa las predicciones y el **nivel de confianza**

### Nivel de Confianza:
- 🟢 **Alta (≥70%)**: Puedes confiar en las predicciones
- 🟡 **Media (50-69%)**: Necesitas más datos
- 🔴 **Baja (<50%)**: Muy poca información, ingresa más precios

### Cómo aumentar la confianza:
1. **Ingresa más precios** (especialmente lunes-martes)
2. **Selecciona el patrón anterior** si lo sabes
3. Espera a tener ≥70% antes de tomar decisiones importantes

---

## 🔄 Probabilidades de Transición

**Importante:** El juego NO elige patrones al azar. El patrón de esta semana **depende del patrón anterior**.

| Semana pasada | Más probable esta semana |
|---------------|--------------------------|
| **Decreciente** | **45% Pico Grande** 🎉 |
| **Pico Grande** | **50% Fluctuante** |
| **Fluctuante** | **35% Pico Pequeño** |
| **Pico Pequeño** | **45% Fluctuante** |

**💡 Insight clave:**
Si tuviste **Decreciente** la semana pasada, tienes alta probabilidad de **Pico Grande** esta semana.

Por eso es importante **anotar el patrón cada semana** y seleccionarlo en el predictor.

---

## 💡 Consejos de Venta

### Estrategias por patrón:

**🚀 Pico Grande**
- Espera a ver **200%+** → ESE es el momento
- Es el mejor patrón, no vendas muy temprano

**📈 Pico Pequeño**
- Vende cuando veas **150-190%**
- No va a subir más de 200%

**📊 Fluctuante**
- Vende cuando veas **>110%** (cualquier ganancia es buena)
- Es impredecible, no esperes picos enormes

**📉 Decreciente**
- Vende **INMEDIATAMENTE** o busca otra isla
- Solo va a empeorar cada día

### Qué NO hacer:
- ❌ No esperes al sábado si tienes Decreciente
- ❌ No vendas muy temprano si ves señales de pico
- ❌ No tomes decisiones con confianza <50%
- ❌ No olvides anotar el patrón cada semana

---

## 📚 Para saber más

- **[ALGORITHM.md](ALGORITHM.md)**: Documentación técnica detallada de los algoritmos
- **[Código original del juego](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b)**: Datamining por Ninji/Treeki (2020)

---

## 🙏 Créditos

- **Ninji (Treeki)** - Datamining del algoritmo original
- **Comunidad de r/acturnips** - Verificación y documentación
- Basado en el código real de Animal Crossing: New Horizons

---

**¡Disfruta prediciendo tus nabos!** 🥕✨
