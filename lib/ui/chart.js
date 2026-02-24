import { DAYS_CONFIG } from "../constants.js";

let priceChartInstance = null;

function buildChartData(predictions, buyPrice, labelCount) {
  const rangeMax = [];
  const rangeMin = [];
  const confirmedLine = [];

  DAYS_CONFIG.forEach((day, index) => {
    const prediction = predictions[day.key];
    const next = DAYS_CONFIG[index + 1] ? predictions[DAYS_CONFIG[index + 1].key] : null;
    const isLastConfirmed = prediction.isUserInput && (!next || !next.isUserInput);

    if (prediction.isUserInput) {
      // Only anchor the band at the transition point to avoid tension artifacts
      rangeMax.push(isLastConfirmed ? prediction.min : null);
      rangeMin.push(isLastConfirmed ? prediction.min : null);
      confirmedLine.push(prediction.min);
    } else {
      rangeMax.push(prediction.max);
      rangeMin.push(prediction.min);
      confirmedLine.push(null);
    }
  });

  return {
    rangeMax,
    rangeMin,
    buyPriceLine: Array(labelCount).fill(buyPrice),
    confirmedLine
  };
}

export function displayPriceChart(predictions, buyPrice) {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;

  const labels = DAYS_CONFIG.map(d => d.name);
  const { rangeMax, rangeMin, buyPriceLine, confirmedLine } = buildChartData(predictions, buyPrice, labels.length);

  if (priceChartInstance) {
    const datasets = priceChartInstance.data.datasets;
    datasets[0].data = rangeMax;
    datasets[1].data = rangeMin;
    datasets[2].data = buyPriceLine;
    datasets[3].data = confirmedLine;
    datasets[3].pointRadius = confirmedLine.map(v => v !== null ? 5 : 0);
    priceChartInstance.update();
    return;
  }

  const ctx = canvas.getContext('2d');
  priceChartInstance = new Chart(ctx, { // eslint-disable-line no-undef
    type: 'line',
    data: {
      labels,
      datasets: [
        // Upper band boundary — fills down to lower band
        {
          label: 'Rango estimado',
          data: rangeMax,
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 1,
          pointRadius: 0,
          fill: '+1',
          backgroundColor: 'rgba(76, 175, 80, 0.5)',
          tension: 0.3
        },
        // Lower band boundary
        {
          label: 'Mínimo',
          data: rangeMin,
          borderColor: 'rgba(76, 175, 80, 1)',
          borderWidth: 1,
          pointRadius: 0,
          fill: false,
          tension: 0.3
        },
        // Buy price reference line
        {
          label: 'Precio de compra',
          data: buyPriceLine,
          borderColor: 'rgba(158, 158, 158, 0.5)',
          borderWidth: 1,
          borderDash: [6, 4],
          pointRadius: 0,
          fill: false
        },
        // Confirmed prices — solid line with dots
        {
          label: 'Confirmado',
          data: confirmedLine,
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 2.5,
          pointRadius: confirmedLine.map(v => v !== null ? 5 : 0),
          pointBackgroundColor: 'rgba(33, 150, 243, 1)',
          pointBorderColor: 'white',
          pointBorderWidth: 2,
          fill: false,
          spanGaps: false,
          tension: 0.3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            filter: (item) => item.text !== 'Mínimo',
            usePointStyle: true,
            font: { size: 12 }
          },
          onClick: function(e, legendItem, legend) {
            const chart = legend.chart;
            if (legendItem.datasetIndex === 0) {
              const hidden = !chart.getDatasetMeta(0).hidden;
              chart.getDatasetMeta(0).hidden = hidden;
              chart.getDatasetMeta(1).hidden = hidden;
              chart.update();
            } else {
              Chart.defaults.plugins.legend.onClick.call(this, e, legendItem, legend); // eslint-disable-line no-undef
            }
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.85)',
          padding: 12,
          titleFont: { size: 14, weight: 'bold' },
          bodyFont: { size: 13 },
          callbacks: {
            label: function(context) {
              if (context.dataset.label === 'Mínimo') return null;
              if (context.parsed.y === null) return null;

              const confirmedDataset = context.chart.data.datasets.find(d => d.label === 'Confirmado');
              const isConfirmedPoint = confirmedDataset?.data[context.dataIndex] !== null;
              if (context.dataset.label === 'Rango estimado' && isConfirmedPoint) return null;

              if (context.dataset.label === 'Rango estimado') {
                const minimoDataset = context.chart.data.datasets.find(d => d.label === 'Mínimo');
                const min = minimoDataset?.data[context.dataIndex];
                return `Rango estimado: ${min} – ${context.parsed.y} bayas`;
              }

              return `${context.dataset.label}: ${context.parsed.y} bayas`;
            }
          }
        }
      },
      scales: {
        y: {
          suggestedMin: 0,
          title: {
            display: true,
            text: 'Precio (bayas)',
            font: { size: 14, weight: 'bold' }
          },
          grid: {
            color: 'rgba(0, 0, 0, 0.08)'
          }
        },
        x: {
          ticks: {
            callback: function(_val, index) {
              return window.innerWidth < 500 ? null : this.getLabelForValue(index);
            },
            maxRotation: 45,
            minRotation: 0
          },
          grid: {
            display: false
          }
        }
      }
    }
  });
}
