# Turnip Calculator

Animal Crossing: New Horizons turnip price predictor based on the datamined game algorithm. UI is in Spanish.

## Commands

- `npm test` — run tests (vitest)
- `npx vitest run` — run tests once (no watch)
- `npx vitest run tests/patterns/small-spike.test.js` — run a single test file
- `npm run lint` — eslint
- `npm run lint:fix` — eslint with auto-fix

## Project structure

```
lib/
  constants.js              # Rates, thresholds, period/day config
  turnip-pattern-predictor.js  # Main predictor: rejection → scoring → prediction
  patterns/
    fluctuating.js          # Fluctuante pattern
    large-spike.js          # Pico Grande pattern
    small-spike.js          # Pico Pequeño pattern
    decreasing.js           # Decreciente pattern
    utils.js                # Shared: spike detection, phase start, drop rate validation
  ui/
    controller.js           # DOM event handling, input collection
    rendering.js            # Results rendering
    chart.js                # Price trend chart
    sharing.js              # URL encode/decode for sharing
tests/                      # Mirrors lib/ structure
```

## Scenario shorthand format

Scenarios are written as pipe-delimited strings for quick reference:

```
buyPrice|previousPattern|monAM|monPM|tueAM|tuePM|wedAM|wedPM|thuAM|thuPM|friAM|friPM|satAM|satPM
```

- **buyPrice**: Sunday buy price (90-110)
- **previousPattern**: previous week's pattern as a single letter — `f` (fluctuating), `l` (large spike), `s` (small spike), `d` (decreasing)
- **Prices**: 12 selling periods, Mon AM through Sat PM. Empty positions for unknown prices.

Trailing empty prices are omitted. Examples:

| Shorthand | Meaning |
|---|---|
| `106\|d\|78\|99\|124\|184\|212` | Buy 106, prev decreasing, Mon AM–Wed AM known |
| `100\|f\|80\|75\|200` | Buy 100, prev fluctuating, Mon AM–Tue AM known |
| `107\|s\|94\|89\|85\|79\|102\|180` | Buy 107, prev small spike, Mon AM–Wed PM known |

This is also the format used for URL sharing (base64-encoded as the `?turnipData=` param).

## Pattern detection flow

1. **Rejection phase** (`reasonsToReject*`): eliminates impossible patterns based on known prices
2. **Scoring phase** (`score*`): ranks remaining patterns by data fit + prior probabilities
3. **Prediction phase** (`calculate*Pattern`): generates min/max price ranges per period

## Game algorithm: spike phases

Both spike patterns share the 90-140% → 140-200% transition (spike phase 0/1 → phase 2/3/4). The differentiator is the peak:

- **Small Spike**: 5 phases — [90-140%, 90-140%, 140-200%, **140-200% (TRUE MAX)**, 140-200%]
- **Large Spike**: 5 phases — [90-140%, 140-200%, **200-600% (TRUE MAX)**, 140-200%, 90-140%]

All percentages are relative to the buy price.

## Spike start detection (`detectSpikePhaseStart`)

Priority order:
1. Max price with declining prices after it → spike already passed, infer start from peak position
2. Trend reversal (decline → rise in consecutive prices)
3. Max is the latest known price and is in peak range (>=140%) → infer start from peak position
4. First significant rise (>30%)
5. Fallbacks (late week position, middle of valid range)
