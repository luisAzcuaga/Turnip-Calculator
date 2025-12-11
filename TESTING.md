# Testing Guide

## Método recomendado para testing

### Opción 1: Archivo HTML simple (MÁS RÁPIDO)

1. **Crear archivo HTML de test** (ej: `test_simple.html`):
   ```html
   <!DOCTYPE html>
   <html>
   <head><title>Test</title></head>
   <body>
   <div id="output"></div>

   <!-- Cargar todas las dependencias en orden -->
   <script src="constants.js"></script>
   <script src="patterns/utils.js"></script>
   <script src="patterns/decreasing.js"></script>
   <script src="patterns/large-spike.js"></script>
   <script src="patterns/small-spike.js"></script>
   <script src="patterns/fluctuating.js"></script>
   <script src="predictor.js"></script>

   <script>
   // Tu código de test aquí
   const pred = new TurnipPredictor(107, {mon_am: 97, ...}, 'fluctuating');
   const result = pred.predict();
   document.getElementById('output').innerHTML = `Resultado: ${result.patternName}`;
   </script>
   </body>
   </html>
   ```

2. **Abrir directamente en el navegador**:
   - Arrastra el archivo al navegador, O
   - Doble click en el archivo, O
   - `explorer.exe test_simple.html` (WSL)
   - `open test_simple.html` (Mac)

3. **Ver resultados**: Ya están en la página

### Opción 2: Consola del navegador

1. Abre `index.html` en el navegador
2. F12 → Console
3. Pega tu código de test:
   ```javascript
   const test = new TurnipPredictor(107, {mon_am: 97, ...}, 'fluctuating');
   console.log(test.predict());
   ```

## ❌ NO hacer (problemas comunes)

### ❌ Node.js directo
```bash
node test.js  # NO funciona - los archivos no están en formato CommonJS/ESM
```
**Por qué falla**: Los archivos están diseñados para navegador, no para Node.js

### ❌ require() en Node.js
```javascript
const predictor = require('./predictor.js');  # NO funciona
```
**Por qué falla**: No hay `module.exports`, es código de navegador

### ❌ VM context en Node.js
```javascript
vm.runInContext(code, context);  # NO funciona bien con dependencias
```
**Por qué falla**: Problemas de contexto y orden de carga

## ✅ Ejemplos de tests

### Test de validación de spike

Archivo: `test_simple.html`
```html
<script>
const test1 = new TurnipPredictor(107, {
  mon_am: 97, mon_pm: 92, tue_am: 87, tue_pm: 84,
  wed_am: 80, wed_pm: 75, thu_am: 70, thu_pm: 68
}, 'fluctuating');

const result = test1.predict();
console.log('Large Spike:', result.allProbabilities.large_spike, '% (esperado 0%)');
console.log('Small Spike:', result.allProbabilities.small_spike, '% (esperado 0%)');
console.log('Razones:', test1.rejectionReasons);
</script>
```

## Tips para debugging

1. **Usa la consola del navegador** (F12) - muestra errores claros
2. **Inspecciona objetos** - click en objetos en console para expandir
3. **Breakpoints** - En la pestaña Sources, agrega breakpoints en el código
4. **console.log everywhere** - Cuando dudes, agrega console.logs

## Resumen

- ✅ **Mejor método**: Crear HTML simple → abrir en navegador
- ✅ **Segundo mejor**: Console del navegador con index.html abierto
- ❌ **Evitar**: Node.js directo, VM, require()
