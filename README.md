# 🥕 Predictor de Nabos - Animal Crossing New Horizons

Una aplicación web estática para predecir los precios de los nabos en Animal Crossing: New Horizons. **No requiere internet después de la primera carga** - funciona completamente offline.

## 🚀 Cómo usar

1. Descarga todos los archivos en una carpeta
2. Abre `index.html` en tu navegador
3. ¡Listo! Ya puedes usarlo

**Opcional:** También puedes deployarlo gratis en [Netlify](https://netlify.com) o [GitHub Pages](https://pages.github.com) arrastrando los archivos.

## 📖 Uso básico

1. **Ingresa el precio de compra** del domingo (90-110 bayas)
2. **Añade los precios** que vayas descubriendo durante la semana
3. **Haz clic en "Calcular Pronóstico"** para ver las predicciones
4. **Colores**: 🟠 Naranja = estimado (click para editar) | 🟢 Verde = confirmado
5. Los datos se guardan automáticamente en tu navegador

## 🎯 Sistema de confianza

El predictor muestra:
- **Porcentajes de probabilidad (%)**: Qué tan probable es cada patrón (suman 100%)
- **Nivel de confianza**: Qué tan precisas son las predicciones
  - 🟢 **Alta (≥70%)**: Muy confiable, muestra solo el patrón principal
  - 🟡 **Media (50-69%)**: Confianza moderada, muestra alternativas
  - 🔴 **Baja (<50%)**: Poca certeza, ingresa más datos

**Regla de oro:** Más precios = más confianza. Confianza >70% = predicciones muy confiables.

## 📊 Patrones de precios

| Patrón | Rango de precios | Cuándo vender | Nota |
|--------|-----------------|---------------|------|
| 🚀 **Pico Grande** | 200-600% | Miércoles-Jueves | ¡EL MEJOR! Espera el pico máximo |
| 📈 **Pico Pequeño** | 140-200% | Jueves-Viernes | Buenas ganancias |
| 📊 **Fluctuante** | 60-140% | Cuando supere compra | Impredecible |
| ⚠️ **Decreciente** | 40-90% (bajando) | ¡AHORA! o visita otra isla | EL PEOR |

### 🧠 Ajuste dinámico inteligente

El predictor **aprende de tus datos** y ajusta las predicciones en tiempo real:

- **Pico Grande/Pequeño**: Detecta en qué fase estás (baja/subida/pico/post-pico) y proyecta crecimiento o caída
- **Fluctuante**: Calcula volatilidad y ajusta rangos (poco variable = rangos estrechos, muy variable = rangos amplios)
- **Decreciente**: Calcula tu tasa de caída real y proyecta usando esa tasa específica

**Resultado:** Las predicciones mejoran con cada precio que ingresas.

_Para detalles técnicos del algoritmo, consulta [ALGORITHM.md](ALGORITHM.md)_

## ✨ Características

- ✅ Detección automática de patrones con filtrado inteligente
- ✅ Sistema de confianza con porcentajes de probabilidad
- ✅ Ajuste dinámico que aprende de tus datos
- ✅ Inputs unificados con estimaciones visuales
- ✅ Guardado automático (localStorage)
- ✅ Diseño responsive (móvil, tablet, desktop)
- ✅ **Funciona offline** después de la primera carga
- ✅ 100% estático, no requiere servidor

## 💡 Consejos

### Para mejores predicciones:
- **Ingresa más datos**: Cada precio adicional aumenta la precisión
- **Prioriza lunes-martes**: Los primeros días identifican el patrón rápidamente
- **Recalcula frecuentemente**: Cada nuevo precio mejora las estimaciones
- **Espera confianza >70%**: A partir de ahí las predicciones son muy confiables

### Para jugar mejor:
- Revisa los precios AM y PM todos los días
- Si tienes patrón decreciente, no esperes - vende ya o visita otra isla
- Si la confianza es baja, espera más datos antes de tomar decisiones
- Los patrones se reinician cada semana (domingo)

## 🎮 Sobre los nabos en Animal Crossing

Los nabos son el "mercado de valores" de Animal Crossing:
- 🛒 Compras el domingo de Perico (90-110 bayas)
- 📈 Precios cambian 2 veces al día: AM/PM (lunes a sábado)
- 💀 Se pudren después del sábado
- 🎲 Cada isla tiene uno de 4 patrones cada semana

## 🛠️ Personalización

Puedes modificar fácilmente:
- **Colores**: Edita `styles.css`
- **Textos**: Edita `index.html` y `predictor.js`
- **Lógica de predicción**: Ajusta los multiplicadores en `predictor.js`

## 📄 Licencia

Código abierto. Úsalo, modifícalo y compártelo libremente.

## 🙏 Créditos

- Inspirado en la comunidad de Animal Crossing
- Patrones basados en data mining de jugadores
- Diseño inspirado en la estética del juego

---

¡Disfruta prediciendo tus nabos! 🥕✨
