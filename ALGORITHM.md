# Turnip Price Prediction Algorithm

Technical documentation of the price patterns implemented in this predictor.

---

## The 4 Patterns

Animal Crossing has 4 price patterns that alternate weekly according to transition probabilities.

### 1. Decreasing (Pattern 2)

**Structure:**
- Starts at 85–90% of the buy price
- Drops 3–5% per period
- Floor: 40%

**Projection:**
```
Initial rate = 0.85–0.90
Each period:  rate -= 0.03–0.05
Price = base × max(0.40, rate)
```

**Detection:**
- With 2+ known prices: calculates the observed rate drop and projects future periods with ±10% variance
- With 1 known price: projects using 3–5% drop range per period

---

### 2. Fluctuating (Pattern 0)

**Structure:**
- Alternates between HIGH phases (90–140%) and LOW phases (60–80%)
- 2 low phases that always sum to exactly 5 periods (2+3 or 3+2)
- 3 high phases (variable duration)

**Phases:**
```
HIGH 1 (0–6 periods)   → 90–140%
LOW  1 (2–3 periods)   → 60–80%, drops 4–10%
HIGH 2 (variable)      → 90–140%
LOW  2 (3–2 periods)   → 60–80%, drops 4–10%
HIGH 3 (remainder)     → 90–140%
```

**Game rule:**
```
lowPhaseLen1 + lowPhaseLen2 = 5 periods ALWAYS
```

**Detection:**
1. Detects completed low phases (2 or 3 consecutive periods <85% and falling)
2. Infers the length of the second low phase (5 − first phase)
3. Once both low phases are identified, predicts only HIGH phase (90–140%) for the remainder

**Validation:**
- Rejected if >2 consecutive increases (indicates a spike)
- Rejected if >3 consecutive decreases (exceeds a low phase)
- Rejected if declining from the very start with no prior high phase

---

### 3. Large Spike (Pattern 1)

**Structure:**
- Pre-spike decreasing phase: 85–90%, dropping 3–5% per period
- 5-period spike (starts between periods 2–7)
- Post-spike phase: 40–90%

**Spike phases:**
```
Phase 1: 90–140%   (initial rise)
Phase 2: 140–200%  ⭐ (sharp rise — key differentiator)
Phase 3: 200–600%  (PEAK)
Phase 4: 140–200%
Phase 5: 90–140%
```

**Key differentiator:**
- Phase 2 ≥ 140% confirms Large Spike
- Phase 2 < 140% rules out Large Spike (Small Spike instead)

**Validation:**
- Monday AM must be between 85–90%
- Rate cannot drop >5% per period in the pre-spike phase
- Cannot rise significantly before period 2
- Rejected if we reach Thursday PM or later without any significant rise

---

### 4. Small Spike (Pattern 3)

**Structure:**
- Pre-spike decreasing phase: 40–90%, dropping 3–5% per period
- 5-period spike (starts between periods 1–7)
- Post-spike phase: 40–90%

**Spike phases:**
```
Phase 1: 90–140%
Phase 2: 90–140%   ⭐ (stays below 140% — key differentiator)
Phase 3: 140–200% − 1 Bell
Phase 4: 140–200%  (PEAK — the actual random rate)
Phase 5: 140–200% − 1 Bell
```

**Rate inference:**
- The game picks a random rate between 1.40–2.00
- Phase 4 = base × rate (the real peak)
- Phases 3 and 5 = base × rate − 1 Bell
- If phase 4 is known: exact rate determined
- If phase 3 or 5 is known: rate ≥ (price + 1) / base

**Key differentiator:**
- Phase 2 < 140% confirms Small Spike
- Phase 2 ≥ 140% rules out Small Spike (Large Spike instead)

**Validation:**
- Rate cannot drop >5% per period in the pre-spike phase
- Cannot rise significantly before period 1
- Rejected if we reach Thursday PM or later without any significant rise
- Rejected if the peak exceeds 200%

---

## Pattern Detection System

### Rejection

Each pattern is rejected if it violates its rules:

**Decreasing:**
- ❌ Monday with price >100%
- ❌ Any significant increase

**Fluctuating:**
- ❌ Prices outside 60–140%
- ❌ >2 consecutive increases
- ❌ >3 consecutive decreases
- ❌ Declining from the start (≥2 periods with no prior high phase)

**Large Spike:**
- ❌ Spike phase 2 < 140%
- ❌ Monday AM outside 85–90%
- ❌ Rate drops >5% per period in pre-spike phase
- ❌ Rises too early (before period 2)
- ❌ Too late without a rise (≥ Thursday PM)

**Small Spike:**
- ❌ Spike phase 2 ≥ 140%
- ❌ Peak exceeds 200%
- ❌ Rate drops >5% per period in pre-spike phase
- ❌ Rises too early (before period 1)
- ❌ Too late without a rise (≥ Thursday PM)

### Pattern Scoring

Combines transition probabilities with live price data:

```javascript
score = (dataScore × dataWeight) + (probabilityScore × probWeight)

dataWeight = min(knownPrices.length / 8, 0.70)  // Up to 70% weight on data
probWeight = 1 − dataWeight                      // Minimum 30% weight on probabilities
```

**Data score** is computed from:
- Confirmations (spike detected, consecutive drops, etc.)
- Signals (rapid rises, low averages, etc.)
- Penalties (out-of-range prices, conflicting patterns, etc.)

---

## Transition Probabilities

The current pattern depends on the previous one:

| Previous | Fluctuating | Large Spike | Decreasing | Small Spike |
|----------|-------------|-------------|------------|-------------|
| **First time** | 35% | 25% | 15% | 25% |
| **Fluctuating** | 20% | 30% | 15% | **35%** |
| **Large Spike** | **50%** | 5% | 20% | 25% |
| **Decreasing** | 25% | **45%** | 5% | 25% |
| **Small Spike** | **45%** | 25% | 15% | 15% |

**Key insights:**
- Large Spike and Decreasing rarely repeat (5% each)
- After Decreasing: 45% Large Spike
- After Large Spike: 50% Fluctuating

---

## Algorithm Constants

Defined in `constants.js`:

### RATES
Price ratios (as a percentage of the buy price):
```javascript
DECREASING:   { START_MIN: 0.85, START_MAX: 0.90, FLOOR: 0.40 }
LARGE_SPIKE:  { START_MIN: 0.85, START_MAX: 0.90, SPIKE_PHASES: [...] }
SMALL_SPIKE:  { PEAK_RATE_MIN: 1.40, PEAK_RATE_MAX: 2.00, ... }
FLUCTUATING:  { MIN: 0.60, MAX: 1.40, HIGH: 0.90–1.40, LOW: 0.60–0.80 }
```

### DECAY
Drop rates per period:
```javascript
MIN_PER_PERIOD: 0.03  // 3% — best case
MAX_PER_PERIOD: 0.05  // 5% — worst case
```

### THRESHOLDS
Detection thresholds:
```javascript
LARGE_SPIKE_CONFIRMED: 2.0       // ≥200% confirms Large Spike
SMALL_SPIKE_MIN: 1.40            // ≥140% may be Small Spike
SMALL_SPIKE_MAX: 2.00            // <200% for Small Spike
SIGNIFICANT_RISE: 1.10           // 10% = significant rise
FLUCTUATING_MAX_CONSECUTIVE_INCREASES: 2
FLUCTUATING_MAX_CONSECUTIVE_DECREASES: 3
```

### PERIODS
Period indices (0 = Monday AM, 11 = Saturday PM):
```javascript
SMALL_SPIKE_START_MIN: 1   // Monday PM
LARGE_SPIKE_START_MIN: 2   // Tuesday AM
SPIKE_START_MAX: 7         // Thursday PM (both) — latest start for 5 periods
```

---

## References

- [Original datamined code](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b) (Ninji/Treeki, April 2020)
- r/acturnips community
- Animal Crossing Wiki
