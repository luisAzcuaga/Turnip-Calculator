// @vitest-environment happy-dom
import { PATTERNS, PATTERN_NAMES } from '../../lib/constants.js';
import { renderPatternDetail, renderProbabilityPanel } from '../../lib/ui/rendering.js';
import { beforeEach, describe, expect, it } from "vitest";

// Set up the DOM structure that rendering.js expects (mirrors index.html templates)
beforeEach(() => {
  document.body.innerHTML = `
    <div id="patternDetail">
      <section id="primarySection" hidden>
        <h3>⭐ Patrón más probable</h3>
        <ul class="pattern-list">
          <li class="primary-pattern">
            <strong id="primaryName"></strong> (<span id="primaryProb"></span>%):
            <ul id="primaryReasons"></ul>
          </li>
        </ul>
      </section>
      <section id="unlikelySection" hidden>
        <h3>📊 Patrones menos probables</h3>
        <p><small>Estos patrones son posibles pero menos probables según los datos:</small></p>
        <ul class="pattern-list" id="unlikelyList"></ul>
      </section>
      <section id="rejectedSection" hidden>
        <h3>🚫 Patrones descartados (0%)</h3>
        <p><small>Estos patrones rompen las reglas del algoritmo del juego con los datos ingresados:</small></p>
        <ul class="pattern-list" id="rejectedList"></ul>
      </section>
      <section id="fallbackSection" hidden>
        <h3>🔍 Análisis de patrones</h3>
        <p><small>No hay suficientes datos para descartar patrones alternativos.</small></p>
      </section>
    </div>

    <div id="patternSummary">
      <div class="probability-distribution">
        <h4>Todos los Patrones Posibles</h4>
        <div class="probability-list" id="probabilityList"></div>
      </div>
    </div>

    <template id="tmpl-probability-item">
      <div class="probability-item">
        <div class="probability-header-row">
          <span class="probability-name"></span>
          <span class="primary-badge" hidden>MÁS PROBABLE</span>
        </div>
        <div class="probability-bar-container">
          <div class="probability-bar-fill"></div>
          <span class="probability-value"></span>
        </div>
      </div>
    </template>

    <template id="tmpl-pattern-item">
      <li>
        <strong class="pattern-name"></strong> (<span class="pattern-prob"></span>%):
        <ul class="pattern-reasons"></ul>
      </li>
    </template>

    <template id="tmpl-spike-tip">
      <li class="spike-timing-tip"></li>
    </template>
  `;
});

// ─── renderProbabilityPanel ─────────────────────────────────────────────────

describe('renderProbabilityPanel', () => {
  const allProbabilities = {
    [PATTERNS.FLUCTUATING]: 60,
    [PATTERNS.LARGE_SPIKE]: 25,
    [PATTERNS.SMALL_SPIKE]: 10,
    [PATTERNS.DECREASING]: 5
  };

  it('renders probability items into the list', () => {
    renderProbabilityPanel(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    const items = document.querySelectorAll('.probability-item');
    expect(items).toHaveLength(4);
  });

  it('marks the primary pattern with primary-pattern class', () => {
    renderProbabilityPanel(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    expect(document.querySelector('.probability-item.primary-pattern')).not.toBeNull();
  });

  it('does not mark non-primary patterns with primary-pattern class', () => {
    renderProbabilityPanel(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    const primaryCount = document.querySelectorAll('.probability-item.primary-pattern').length;
    expect(primaryCount).toBe(1);
  });

  it('sorts patterns by probability descending (highest first)', () => {
    renderProbabilityPanel(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    const names = [...document.querySelectorAll('.probability-name')].map(el => el.textContent);
    expect(names).toEqual(['Fluctuante', 'Pico Grande', 'Pico Pequeño', 'Decreciente']);
  });

  it('handles 0% probabilities for all non-primary patterns', () => {
    const probs = {
      [PATTERNS.FLUCTUATING]: 100,
      [PATTERNS.LARGE_SPIKE]: 0,
      [PATTERNS.SMALL_SPIKE]: 0,
      [PATTERNS.DECREASING]: 0
    };
    renderProbabilityPanel(PATTERN_NAMES[PATTERNS.FLUCTUATING], probs);
    const text = document.getElementById('probabilityList').textContent;
    expect(text).toContain('0%');
    expect(text).toContain('100%');
  });

  it('includes the MÁS PROBABLE badge for the primary pattern', () => {
    renderProbabilityPanel(PATTERN_NAMES[PATTERNS.LARGE_SPIKE], allProbabilities);
    const badge = document.querySelector('.primary-badge:not([hidden])');
    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('MÁS PROBABLE');
  });
});

// ─── renderPatternDetail ────────────────────────────────────────────────────

const baseRejectionReasons = {
  [PATTERNS.FLUCTUATING]: [],
  [PATTERNS.LARGE_SPIKE]: ['Precio de lunes AM muy bajo'],
  [PATTERNS.SMALL_SPIKE]: [],
  [PATTERNS.DECREASING]: ['Precio superior al máximo permitido']
};

const baseScoreReasons = {
  [PATTERNS.FLUCTUATING]: ['Oscilaciones típicas del patrón'],
  [PATTERNS.LARGE_SPIKE]: [],
  [PATTERNS.SMALL_SPIKE]: [],
  [PATTERNS.DECREASING]: []
};

describe('renderPatternDetail — primary section', () => {
  it('shows the primary pattern section when recommendations are provided', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 80, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Vende el Miércoles por la tarde'],
      [], 100
    );
    expect(document.getElementById('primarySection').hidden).toBe(false);
    expect(document.getElementById('primaryReasons').textContent).toContain('Vende el Miércoles por la tarde');
  });

  it('skips the primary section when recommendations are empty', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 80, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      [],
      [], 100
    );
    expect(document.getElementById('primarySection').hidden).toBe(true);
  });

  it('includes the primary pattern probability in the output', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 80, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación de prueba'],
      [], 100
    );
    expect(document.getElementById('primaryProb').textContent).toBe('80');
  });
});

describe('renderPatternDetail — rejected patterns (0%)', () => {
  it('shows the descartados section when some patterns are at 0%', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(document.getElementById('rejectedSection').hidden).toBe(false);
  });

  it('includes rejection reasons for rejected patterns', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(document.getElementById('rejectedList').textContent).toContain('Precio de lunes AM muy bajo');
  });

  it('omits the descartados section when no pattern is at 0%', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 70, [PATTERNS.LARGE_SPIKE]: 10, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 5 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(document.getElementById('rejectedSection').hidden).toBe(true);
  });
});

describe('renderPatternDetail — unlikely patterns (>0%)', () => {
  it('shows the menos probables section when some non-primary patterns have >0%', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(document.getElementById('unlikelySection').hidden).toBe(false);
  });

  it('includes score reasons for unlikely patterns that have them', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.LARGE_SPIKE,
      ['Recomendación'],
      [], 100
    );
    expect(document.getElementById('unlikelyList').textContent).toContain('Oscilaciones típicas del patrón');
  });

  it('shows fallback text when an unlikely pattern has no score reasons', () => {
    renderPatternDetail(
      baseRejectionReasons, { ...baseScoreReasons, [PATTERNS.SMALL_SPIKE]: [] },
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(document.getElementById('unlikelyList').textContent).toContain('Sin señales fuertes a favor o en contra');
  });

  it('omits the menos probables section when all non-primary patterns are at 0%', () => {
    renderPatternDetail(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 100, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 0, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(document.getElementById('unlikelySection').hidden).toBe(true);
  });
});

describe('renderPatternDetail — fallback state', () => {
  it('skips the primary section but still shows unlikely patterns when recommendations are empty', () => {
    renderPatternDetail(
      {}, {},
      { [PATTERNS.FLUCTUATING]: 70, [PATTERNS.LARGE_SPIKE]: 10, [PATTERNS.SMALL_SPIKE]: 10, [PATTERNS.DECREASING]: 10 },
      PATTERNS.FLUCTUATING,
      [],
      [], 100
    );
    expect(document.getElementById('primarySection').hidden).toBe(true);
    expect(document.getElementById('unlikelySection').hidden).toBe(false);
  });

  it('does not show the análisis fallback in normal conditions', () => {
    renderPatternDetail(
      {}, {},
      { [PATTERNS.FLUCTUATING]: 100, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 0, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      [], [], 100
    );
    // Three patterns are at 0% → descartados section shows, fallback does NOT show
    expect(document.getElementById('fallbackSection').hidden).toBe(true);
  });
});
