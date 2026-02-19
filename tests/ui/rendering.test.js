import { PATTERNS, PATTERN_NAMES } from '../../lib/constants.js';
import { buildProbabilityPanelHTML, buildRejectionReasonsHTML } from '../../lib/ui/rendering.js';
import { describe, expect, it } from "vitest";

// ─── buildProbabilityPanelHTML ────────────────────────────────────────────────

describe('buildProbabilityPanelHTML', () => {
  const allProbabilities = {
    [PATTERNS.FLUCTUATING]: 60,
    [PATTERNS.LARGE_SPIKE]: 25,
    [PATTERNS.SMALL_SPIKE]: 10,
    [PATTERNS.DECREASING]: 5
  };

  it('returns a non-empty HTML string', () => {
    const html = buildProbabilityPanelHTML(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  it('contains a .probability-item for every pattern (always all 4)', () => {
    const html = buildProbabilityPanelHTML(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    const matches = html.match(/class="probability-item/g);
    expect(matches).toHaveLength(4);
  });

  it('marks the primary pattern with primary-pattern class', () => {
    const html = buildProbabilityPanelHTML(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    expect(html).toContain('class="probability-item primary-pattern"');
  });

  it('does not mark non-primary patterns with primary-pattern class', () => {
    const html = buildProbabilityPanelHTML(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    // Exactly one div should carry the primary-pattern class
    const primaryCount = (html.match(/class="probability-item primary-pattern"/g) || []).length;
    expect(primaryCount).toBe(1);
  });

  it('sorts patterns by probability descending (highest first)', () => {
    const html = buildProbabilityPanelHTML(PATTERN_NAMES[PATTERNS.FLUCTUATING], allProbabilities);
    // Use pattern display names as anchors — they are unique in the output
    const posFluctuating = html.indexOf('Fluctuante');   // 60%
    const posLargeSpike  = html.indexOf('Pico Grande');  // 25%
    const posSmallSpike  = html.indexOf('Pico Pequeño'); // 10%
    const posDecreasing  = html.indexOf('Decreciente');  // 5%
    expect(posFluctuating).toBeLessThan(posLargeSpike);
    expect(posLargeSpike).toBeLessThan(posSmallSpike);
    expect(posSmallSpike).toBeLessThan(posDecreasing);
  });

  it('handles 0% probabilities for all non-primary patterns', () => {
    const probs = {
      [PATTERNS.FLUCTUATING]: 100,
      [PATTERNS.LARGE_SPIKE]: 0,
      [PATTERNS.SMALL_SPIKE]: 0,
      [PATTERNS.DECREASING]: 0
    };
    const html = buildProbabilityPanelHTML(PATTERN_NAMES[PATTERNS.FLUCTUATING], probs);
    expect(html).toContain('0%');
    expect(html).toContain('100%');
  });

  it('includes the MÁS PROBABLE badge for the primary pattern', () => {
    const html = buildProbabilityPanelHTML(PATTERN_NAMES[PATTERNS.LARGE_SPIKE], allProbabilities);
    expect(html).toContain('MÁS PROBABLE');
  });
});

// ─── buildRejectionReasonsHTML ────────────────────────────────────────────────

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

describe('buildRejectionReasonsHTML — primary section', () => {
  it('shows the primary pattern section when recommendations are provided', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 80, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Vende el Miércoles por la tarde'],
      [], 100
    );
    expect(html).toContain('⭐ Patrón más probable');
    expect(html).toContain('Vende el Miércoles por la tarde');
  });

  it('skips the primary section when recommendations are empty', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 80, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      [],
      [], 100
    );
    expect(html).not.toContain('⭐ Patrón más probable');
  });

  it('includes the primary pattern probability in the output', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 80, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación de prueba'],
      [], 100
    );
    expect(html).toContain('80%');
  });
});

describe('buildRejectionReasonsHTML — rejected patterns (0%)', () => {
  it('shows the descartados section when some patterns are at 0%', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(html).toContain('Patrones descartados');
  });

  it('includes rejection reasons for rejected patterns', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(html).toContain('Precio de lunes AM muy bajo');
  });

  it('omits the descartados section when no pattern is at 0%', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 70, [PATTERNS.LARGE_SPIKE]: 10, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 5 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(html).not.toContain('Patrones descartados');
  });
});

describe('buildRejectionReasonsHTML — unlikely patterns (>0%)', () => {
  it('shows the menos probables section when some non-primary patterns have >0%', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(html).toContain('Patrones menos probables');
  });

  it('includes score reasons for unlikely patterns that have them', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.LARGE_SPIKE,
      ['Recomendación'],
      [], 100
    );
    expect(html).toContain('Oscilaciones típicas del patrón');
  });

  it('shows fallback text when an unlikely pattern has no score reasons', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, { ...baseScoreReasons, [PATTERNS.SMALL_SPIKE]: [] },
      { [PATTERNS.FLUCTUATING]: 85, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 15, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(html).toContain('Sin señales fuertes a favor o en contra');
  });

  it('omits the menos probables section when all non-primary patterns are at 0%', () => {
    const html = buildRejectionReasonsHTML(
      baseRejectionReasons, baseScoreReasons,
      { [PATTERNS.FLUCTUATING]: 100, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 0, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      ['Recomendación'],
      [], 100
    );
    expect(html).not.toContain('Patrones menos probables');
  });
});

describe('buildRejectionReasonsHTML — fallback state', () => {
  it('skips the primary section but still shows unlikely patterns when recommendations are empty', () => {
    const html = buildRejectionReasonsHTML(
      {}, {},
      { [PATTERNS.FLUCTUATING]: 70, [PATTERNS.LARGE_SPIKE]: 10, [PATTERNS.SMALL_SPIKE]: 10, [PATTERNS.DECREASING]: 10 },
      PATTERNS.FLUCTUATING,
      [],
      [], 100
    );
    expect(html).not.toContain('⭐ Patrón más probable');
    expect(html).toContain('Patrones menos probables');
  });

  it('does not show the análisis fallback in normal conditions', () => {
    const html = buildRejectionReasonsHTML(
      {}, {},
      { [PATTERNS.FLUCTUATING]: 100, [PATTERNS.LARGE_SPIKE]: 0, [PATTERNS.SMALL_SPIKE]: 0, [PATTERNS.DECREASING]: 0 },
      PATTERNS.FLUCTUATING,
      [], [], 100
    );
    // Three patterns are at 0% → descartados section shows, fallback does NOT show
    expect(html).not.toContain('Análisis de patrones');
  });
});
