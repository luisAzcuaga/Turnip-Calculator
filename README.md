# 🥕 Predictor de Nabos - Animal Crossing New Horizons

Predictor de precios de nabos basado en los **algoritmos reales del juego** (extraídos por datamining).

100% estático, funciona offline, sin servidor necesario.

---

## 🚀 Cómo usar

1. **Descarga** todos los archivos en una carpeta
2. **Abre** `index.html` en tu navegador
3. **¡Listo!** Ya puedes usarlo

**Opcional:** Puedes deployarlo gratis en [Netlify](https://netlify.com) o [GitHub Pages](https://pages.github.com).

---

## 📖 Guía rápida

### Paso a paso:
1. **Ingresa tu precio de compra** del domingo (90-110 bayas)
2. **Selecciona el patrón de la semana anterior** (si lo sabes) → Mejora mucho la precisión
3. **Añade precios** conforme los veas en tu isla
4. **Haz clic en "Calcular Pronóstico"**
5. **Revisa las predicciones** y el nivel de confianza

### Colores:
- 🟠 **Naranja** = Precio estimado (click para editar si sabes el real)
- 🟢 **Verde** = Precio confirmado (ya lo ingresaste)

### Guardado automático:
Todos tus datos se guardan en el navegador. No necesitas hacer nada.

---

## 📊 Los 4 patrones de nabos

| Patrón | ALTA | BAJA | Mejor momento |
|--------|------|------|---------------|
| 📊 **Fluctuante** | 90-140% | 60-80% | Fase alta (90-140%) |
| 📉 **Decreciente** | 85-90% (solo inicio) | 40-90% (bajando) | Lunes AM 😢 |
| 📈 **Pico Chico** | 140-200% | 40-90% | Período 4 del pico (140-200%) |
| 🚀 **Pico Grande** | 200-600% 💰 | 40-90% | Período 3 del pico (200-600%) 🎉 |

**💡 Tip:** Lee [ALGORITHM.md](ALGORITHM.md) para entender cómo funciona cada patrón en detalle.

---

## 🔄 Cómo cambian los patrones cada semana

El juego NO elige patrones al azar. **El patrón de esta semana depende del de la semana anterior:**

| Semana pasada | Más probable esta semana |
|---------------|-------------------------|
| **Sin historial** | 35% Fluctuante |
| **Fluctuante** | **35% Pico Chico** |
| **Pico Grande** | **50% Fluctuante** |
| **Decreciente** | **45% Pico Grande** 🎉 |
| **Pico Chico** | **45% Fluctuante** |

### 💡 Insight clave:
**Si tuviste Decreciente la semana pasada, tienes 45% de probabilidad de Pico Grande esta semana.**

Por eso es importante seleccionar el patrón anterior en el predictor.

---

## 🎯 Sistema de confianza

El predictor te dice qué tan seguro está de sus predicciones:

### 🟢 **Alta (≥70%)**
- ✅ Predicciones muy confiables
- ✅ Muestra solo el patrón principal
- ✅ Puedes tomar decisiones con seguridad

### 🟡 **Media (50-69%)**
- ⚠️ Confianza moderada
- ⚠️ Muestra patrones alternativos
- ⚠️ Ingresa más precios para mejorar

### 🔴 **Baja (<50%)**
- ❌ Poca certeza
- ❌ Muchos patrones posibles
- ❌ Necesitas más datos

### Cómo aumentar la confianza:
1. **Ingresa más precios** (cada precio ayuda)
2. **Selecciona el patrón anterior** (+15% confianza base)
3. **Prioriza lunes-martes** (los primeros días identifican el patrón más rápido)

**Regla de oro:** Confianza ≥70% = predicciones en las que puedes confiar

---

## 💡 Consejos pro

### Para mejores predicciones:
- ✅ **SIEMPRE selecciona el patrón de la semana anterior** si lo sabes
- ✅ Ingresa precios lo antes posible (lunes-martes)
- ✅ Revisa precios AM y PM todos los días
- ✅ Espera a tener confianza ≥70% antes de tomar decisiones importantes
- ✅ Anota el patrón de cada semana para la siguiente

### Estrategias de venta:
- 🚀 **Pico Grande**: Espera a ver 200%+, ese es el momento
- 📈 **Pico Chico**: Vende cuando veas 150-190%
- 📊 **Fluctuante**: Vende cuando veas >110% (cualquier ganancia es buena)
- 📉 **Decreciente**: Vende INMEDIATAMENTE o busca otra isla

### Qué NO hacer:
- ❌ No esperes al sábado si tienes Decreciente
- ❌ No vendas muy temprano si ves señales de pico
- ❌ No tomes decisiones con confianza <50%
- ❌ No olvides anotar el patrón de cada semana

---

## ✨ Características

- ✅ **Algoritmos reales del juego** (extraídos por datamining)
- ✅ Predicciones basadas en el código oficial de Animal Crossing
- ✅ Sistema de probabilidades de transición entre patrones
- ✅ Detección automática con filtrado inteligente
- ✅ Niveles de confianza con porcentajes
- ✅ Guardado automático en el navegador
- ✅ **Funciona 100% offline** (después de la primera carga)
- ✅ Diseño responsive (móvil, tablet, desktop)
- ✅ Sin servidor, sin base de datos, sin complicaciones

---

## 🎮 Sobre los nabos en Animal Crossing

Los nabos son el "mercado de valores" de Animal Crossing:

- 🛒 **Domingo**: Perico vende nabos a 90-110 bayas
- 📈 **Lunes-Sábado**: El precio cambia 2 veces al día (AM/PM)
- 💀 **Domingo siguiente**: Los nabos se pudren (pierdes todo)
- 🎲 **Cada semana**: Tu isla tiene uno de los 4 patrones
- 🔄 **El patrón depende**: Del patrón de la semana anterior

**Objetivo:** Comprar barato el domingo, vender caro durante la semana.

---

## 🛠️ Personalización

Puedes modificar:
- **Colores y estilos**: `styles.css`
- **Textos e interfaz**: `index.html`
- **Parámetros del algoritmo**: `constants.js` (ratios, umbrales, probabilidades)
- **Lógica de predicción**: Archivos en `patterns/`

Todo el código está organizado y comentado. Los parámetros del algoritmo están centralizados en `constants.js` para fácil ajuste.

---

## 📚 Para saber más

- **[ALGORITHM.md](ALGORITHM.md)**: Explicación detallada de cómo funciona cada patrón
- **[Código del juego](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b)**: Algoritmos originales extraídos del juego
- **[r/acturnips](https://reddit.com/r/acturnips)**: Comunidad de intercambio de nabos

---

## 🙏 Créditos y Referencias

### Fuentes del algoritmo

- **[Código fuente del algoritmo](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b)** - Ninji (Treeki), abril 2020
- **[Nookipedia - Stalk Market](https://nookipedia.com/wiki/Stalk_Market)** - Documentación de mecánicas

### Agradecimientos

- **Ninji (Treeki)** - Datamining del algoritmo original
- **Comunidad de Animal Crossing** - Documentación y verificación
- Diseño inspirado en la estética del juego

---

## 📄 Licencia

Código abierto. Úsalo, modifícalo y compártelo libremente.

---

**¡Disfruta prediciendo tus nabos!** 🥕✨

_Si tienes dudas sobre cómo funcionan los patrones, lee [ALGORITHM.md](ALGORITHM.md)_
