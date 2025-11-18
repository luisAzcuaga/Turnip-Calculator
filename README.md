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
4. Los datos se guardan automáticamente en tu navegador

### Patrones detectados

#### 🚀 Pico Grande (Large Spike)
- El mejor patrón posible
- Precios muy altos (200-600 bayas)
- Usualmente ocurre miércoles PM o jueves AM
- ¡Vende cuando veas el pico!

#### 📈 Pico Pequeño (Small Spike)
- Buen patrón para ganancias moderadas
- Precios de 120-200 bayas
- Usualmente ocurre el jueves
- Vende cuando veas subir los precios

#### 📊 Fluctuante (Fluctuating)
- Precios variables durante la semana
- Puede haber pequeñas subidas y bajadas
- Vende cuando supere tu precio de compra

#### ⚠️ Decreciente (Decreasing)
- El peor patrón
- Los precios solo bajan toda la semana
- ¡Vende inmediatamente o visita otra isla!

## ✨ Características

- ✅ Detección automática de patrones
- ✅ Predicción de rangos de precios
- ✅ Recomendaciones personalizadas
- ✅ Guardado automático de datos
- ✅ Diseño responsive (funciona en móvil)
- ✅ Interfaz inspirada en Animal Crossing
- ✅ 100% estático (no requiere servidor)
- ✅ Funciona offline después de la primera carga

## 💡 Consejos

- Actualiza los precios a medida que los descubres
- Revisa los precios AM y PM todos los días
- No esperes al último momento si tienes patrón decreciente
- Usa la función de visitantes en el juego para mejores precios
- Los patrones son independientes cada semana

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