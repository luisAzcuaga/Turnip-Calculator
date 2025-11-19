# 🥕 Predictor de Nabos - Animal Crossing New Horizons

Una aplicación web estática para predecir los precios de los nabos en Animal Crossing: New Horizons.

## 📁 Archivos incluidos

- `index.html` - Página principal
- `styles.css` - Estilos CSS
- `predictor.js` - Lógica del predictor
- `app.js` - Interacción con el usuario
- `README.md` - Este archivo

## 🚀 Cómo usar

### Opción 1: Abrir localmente
1. Descarga todos los archivos en una carpeta
2. Abre `index.html` en tu navegador
3. ¡Listo! Ya puedes usarlo

### Opción 2: Servidor local
Si quieres usar un servidor local (opcional):

```bash
# Con Python 3
python -m http.server 8000

# Con Node.js (requiere npx)
npx serve

# Con PHP
php -S localhost:8000
```

Luego abre tu navegador en `http://localhost:8000`

### Opción 3: Deployar en sitios estáticos

#### GitHub Pages
1. Crea un repositorio en GitHub
2. Sube todos los archivos
3. Ve a Settings > Pages
4. Selecciona la rama main como source
5. Tu sitio estará en `https://tu-usuario.github.io/nombre-repo`

#### Netlify
1. Ve a [netlify.com](https://netlify.com)
2. Arrastra la carpeta con todos los archivos
3. ¡Listo! Te dan una URL automáticamente

#### Vercel
1. Ve a [vercel.com](https://vercel.com)
2. Importa el proyecto desde GitHub o sube los archivos
3. Despliega con un clic

#### Cloudflare Pages
1. Ve a [pages.cloudflare.com](https://pages.cloudflare.com)
2. Conecta tu repositorio de GitHub
3. Despliega automáticamente

## 📖 Cómo funciona

### Uso básico
1. **Ingresa el precio de compra** del domingo (entre 90-110 bayas)
2. **Añade los precios** que vayas descubriendo durante la semana
3. **Haz clic en "Calcular Pronóstico"** para ver las predicciones
4. Los campos vacíos se llenan automáticamente con estimaciones (en naranja)
5. Los valores que ingresas se marcan en verde (confirmados)
6. Click en un valor estimado para editarlo y convertirlo en confirmado
7. Los datos se guardan automáticamente en tu navegador

### 🎯 Sistema de confianza y porcentajes

El predictor muestra dos tipos de información:

#### 📊 Porcentajes de probabilidad
- Cada patrón tiene un **porcentaje (%)** que indica su probabilidad
- Los porcentajes suman 100% entre todos los patrones posibles
- **Ejemplo:** Fluctuante (45%), Pico Pequeño (30%), Pico Grande (25%)

#### ✅ Confianza del cálculo
- Un indicador de **qué tan precisas** son las predicciones
- Depende de dos factores:
  - **Cantidad de datos**: Más precios ingresados = mayor confianza (max 40%)
  - **Diferencia entre patrones**: Si un patrón destaca claramente = mayor confianza (max 60%)
- **Niveles de confianza:**
  - 🟢 **Alta (≥70%)**: El patrón detectado es muy probable, no muestra alternativas
  - 🟡 **Media (50-69%)**: Hay certeza moderada, muestra patrones alternativos
  - 🔴 **Baja (<50%)**: Poca certeza, necesitas ingresar más datos

#### 📈 Cómo se calculan los porcentajes

1. **Sistema de puntuación (scoring)**:
   - Cada patrón recibe puntos según qué tan bien coincide con tus datos
   - Patrón Decreciente: +100 pts si todos los precios bajan, +30 pts si el promedio es bajo
   - Pico Grande: +80 pts si hay precios >200% del base, +30 pts si hay fase baja→alta
   - Pico Pequeño: +70 pts si hay pico moderado (140-200%), +40 pts si hay pico (120-140%)
   - Fluctuante: +50 pts si varía sin extremos, +30 pts base (más común)

2. **Conversión a porcentajes**:
   - Se suman todos los puntos: Ejemplo total = 200 pts
   - Porcentaje = (puntos del patrón / total) × 100
   - Fluctuante 90 pts → 90/200 = 45%
   - Pico Pequeño 60 pts → 60/200 = 30%
   - Pico Grande 50 pts → 50/200 = 25%

3. **Cálculo de confianza general**:
   - Confianza por datos = cantidad de precios × 8 (máximo 40%)
   - Confianza por diferencia = diferencia entre 1° y 2° lugar (máximo 60%)
   - Confianza total = suma de ambas (máximo 100%)

#### 💡 Ejemplo práctico

**Escenario 1: Sin datos**
```
Patrón: Fluctuante (25%)  [25% confianza - 🔴]
También podría ser: Pico Grande (25%) o Pico Pequeño (25%)
```
- Todos los patrones son igual de probables
- Muy baja confianza (faltan datos)

**Escenario 2: 2 precios ingresados (ambos bajando)**
```
Patrón: Decreciente (55%)  [46% confianza - 🔴]
También podría ser: Fluctuante (25%) o Pico Grande (20%)
```
- El patrón decreciente lidera pero aún no es seguro
- Confianza baja-media (solo 2 datos)

**Escenario 3: 5 precios ingresados (bajando, luego pico alto)**
```
Patrón: Pico Grande (85%)  [88% confianza - 🟢]
```
- Muy clara la tendencia de pico grande
- Alta confianza (muchos datos + clara diferencia)
- No muestra alternativas

### Patrones detectados

#### 🚀 Pico Grande (Large Spike)
- El mejor patrón posible
- **Características:**
  - Precios muy altos (hasta 600% del precio base)
  - Fase 1: Bajada inicial (85-50% del base)
  - Fase 2: Precios bajos (40-90%)
  - Fase 3: ¡PICO! (140-600%) - Usualmente miércoles PM o jueves AM
  - Fase 4: Bajada post-pico (40-90%)
- **Cuándo vender:** En el pico máximo (período 5-7, especialmente 6)
- **Detección:** Precio >200% del base o potencial para ello

#### 📈 Pico Pequeño (Small Spike)
- Buen patrón para ganancias moderadas
- **Características:**
  - Pico moderado (140-200% del precio base)
  - Fase 1: Decreciente (40-90%, períodos 0-2)
  - Fase 2: Precios bajos (60-80%, períodos 3-4)
  - Fase 3: Pico moderado (140-200%, períodos 6-8 - jueves/viernes)
  - Fase 4: Decreciente final (40-90%)
- **Cuándo vender:** Durante el pico del jueves o viernes
- **Detección:** Precio entre 140-200% del base (no más alto)

#### 📊 Fluctuante (Fluctuating)
- Patrón impredecible con variaciones
- **Características:**
  - Precios variables entre 60-140% del base
  - Sin patrón claro de subidas o bajadas
  - Puede tener pequeños picos pero no extremos
- **Cuándo vender:** Cuando supere tu precio de compra
- **Detección:** Sin picos muy altos ni precios muy bajos, variación moderada

#### ⚠️ Decreciente (Decreasing)
- El peor patrón posible
- **Características:**
  - Bajada constante del 90% al 40% del precio base
  - Cada período baja ~2.5% adicional (tasa conservadora)
  - **Ajuste dinámico:** Si hay precios confirmados, calcula la tasa real observada y proyecta hacia adelante
  - Sin picos ni subidas
  - Todos los precios van hacia abajo
- **Cuándo vender:** ¡INMEDIATAMENTE! o visita otra isla
- **Detección:** Todos los precios conocidos bajan progresivamente
- **Ejemplo de ajuste dinámico:**
  - Base: 92, Lunes AM: 86, Lunes PM: 83, Martes AM: 79
  - Tasa observada: ~4% por período
  - Martes PM proyectado: 79 × (1 - 0.04) ≈ 76 (rango: 68-84)

### 🔍 Filtrado de patrones imposibles

El predictor elimina patrones que no pueden ser basándose en tus datos:

- **Decreciente:** Descartado si hay subidas significativas (>5%)
- **Pico Grande:** Descartado si es tarde en la semana sin picos altos
- **Pico Pequeño:** Descartado si hay precios >200% del base
- **Fluctuante:** Descartado si hay extremos muy altos (>150%) o muy bajos (<50%)

### 📊 Visualización de estimaciones

Los valores estimados se muestran de forma clara e informativa:

**Indicadores visuales:**
- **Valor en input:** Muestra el promedio del rango (ej: 75)
- **Rango debajo:** Muestra el rango completo (ej: 65-85)
- **Tooltip mejorado:** "Promedio: 75 (rango: 65-85 bayas)"
- **Color naranja:** Indica que es un valor estimado (click para editar)
- **Color verde:** Indica que es un valor confirmado por el usuario

**Ajuste dinámico:**
- Cada vez que ingresas un precio real, el predictor recalcula
- Las estimaciones futuras se ajustan basándose en la tendencia observada
- Especialmente útil en patrón decreciente para proyecciones más precisas

## ✨ Características

- ✅ **Detección automática de patrones** con filtrado inteligente
- ✅ **Sistema de confianza** con porcentajes de probabilidad
- ✅ **Patrones alternativos** cuando la certeza es baja
- ✅ **Predicción de rangos de precios** basada en fases del patrón
- ✅ **Inputs unificados**: campos se llenan automáticamente con estimaciones
- ✅ **Indicadores visuales**: naranja (estimado) vs verde (confirmado)
- ✅ **Recomendaciones personalizadas** según el patrón detectado
- ✅ **Guardado automático** de datos (localStorage)
- ✅ **Diseño responsive**: 3 columnas (desktop), 2 (tablet), 1 (móvil)
- ✅ **Interfaz inspirada** en Animal Crossing
- ✅ **100% estático** (no requiere servidor)
- ✅ **Funciona offline** después de la primera carga

## 💡 Consejos de uso

### Para obtener mejores predicciones:
- **Ingresa más datos**: Cada precio adicional aumenta la confianza del cálculo
- **Prioriza los primeros días**: Los precios de lunes-martes ayudan mucho a identificar el patrón
- **No confíes en estimados**: Los valores naranjas son solo aproximaciones, ingresa los reales
- **Recalcula frecuentemente**: Cada vez que ingreses un nuevo precio, vuelve a calcular
- **Confianza >70%**: A partir de este punto las predicciones son muy confiables

### Para jugar mejor:
- Revisa los precios AM y PM todos los días
- No esperes al último momento si tienes patrón decreciente
- Si la confianza es baja, espera a tener más datos antes de vender
- Usa la función de visitantes en el juego para encontrar mejores precios
- Los patrones son independientes cada semana (se reinicia el domingo)

## 🎮 Sobre los nabos en Animal Crossing

Los nabos son un sistema de "mercado de valores" en Animal Crossing donde:
- Compras nabos el domingo de Perico (90-110 bayas)
- Los precios cambian 2 veces al día (AM/PM) de lunes a sábado
- Los nabos se pudren después del sábado
- Cada isla tiene uno de 4 patrones posibles cada semana

## 📱 Compatibilidad

- ✅ Chrome, Firefox, Safari, Edge (versiones modernas)
- ✅ Dispositivos móviles (iOS y Android)
- ✅ Tablets
- ✅ No requiere conexión a internet (después de cargar)

## 🛠️ Personalización

Puedes modificar fácilmente:
- **Colores**: Edita `styles.css` (busca los colores hex como `#66bb6a`)
- **Textos**: Edita `index.html` y los mensajes en `predictor.js`
- **Lógica de predicción**: Ajusta los multiplicadores en `predictor.js`

## 🐛 Problemas conocidos

- Los algoritmos son aproximaciones basadas en la comunidad
- Para predicciones 100% precisas, consulta herramientas como Turnip Prophet
- Los datos se guardan en el navegador (se pierden si borras caché)

## 📄 Licencia

Este proyecto es de código abierto. Úsalo, modifícalo y compártelo libremente.

## 🙏 Créditos

- Inspirado en la comunidad de Animal Crossing
- Patrones basados en data mining de jugadores
- Diseño inspirado en la estética del juego

## 📞 Soporte

Si encuentras algún error o tienes sugerencias:
- Los precios son aproximaciones, no garantías
- Siempre confía en tu instinto de jugador

---

¡Disfruta prediciendo tus nabos! 🥕✨