# 🥕 Turnip Price Predictor - Animal Crossing New Horizons

Price calculator based on the **actual in-game algorithm**.

Predicts when to sell your turnips to maximize your Bells.

---

## ✨ Features

- 🎯 **Precise predictions** based on the datamined game algorithm
- 🧠 **Smart detection** that learns from your prices and eliminates impossible patterns
- 📊 **Real-time probabilities** showing how likely each pattern is
- 🔄 **Transition probabilities** using last week's pattern to improve predictions
- 💾 **Auto-save** in your browser
- ⚡ **100% offline** after initial load
- 📱 **Responsive** — works on mobile, tablet, and desktop

---

## 🎮 What are Turnips?

Turnips are the "stock market" of Animal Crossing:

- **Sunday**: Daisy Mae sells them at 90–110 Bells
- **Monday to Saturday**: Prices change twice a day (AM/PM)
- **Next Sunday**: Turnips rot and you lose everything
- **Each week**: Your island follows one of 4 price patterns

**Your goal:** Buy cheap on Sunday, sell high during the week.

---

## 📊 The 4 Patterns

### 📉 Decreasing
**The worst pattern.**

Prices only fall throughout the week. They start at 85–90% of the buy price and gradually drop to 40%.

**What to do:** Sell today or visit another island. It only gets worse.

---

### 📊 Fluctuating
**The random pattern.**

Prices alternate between high phases (90–140%) and low phases (60–80%) without a clear structure.

**What to do:** Sell whenever you see prices above your buy price (100%+). Don't wait for huge spikes — they won't come.

---

### 📈 Small Spike
**A moderate spike.**

Prices are low most of the week, but there's a **5-period spike** where they rise to 140–200%.

The spike can start on any day (Monday PM through Thursday PM).

**What to do:** Wait for the spike (140–200%) and sell there. After the spike, prices drop fast.

**How to identify it:**
- Prices rising gradually (90% → 120% → 170%)
- Spike peak between 140–200%

---

### 🚀 Large Spike
**The best pattern!**

Like Small Spike, but much higher. The **spike can reach up to 600%** 💰

The spike lasts 5 periods and peaks in **the third period** (200–600%).

**What to do:** Wait for 200%+ prices and sell immediately. That's the moment!

**How to identify it:**
- A dramatic jump all at once (90% → 160% → 450%)
- Spike peak between 200–600%

**Key difference between Large and Small Spike:**
- **Large Spike**: Spike phase 2 jumps to 140%+ (dramatic rise), then phase 3 reaches 200–600%
- **Small Spike**: Spike phase 2 stays at 90–140% (gradual rise), then phases 3–4 reach 140–200%

---

## 🎯 How to Use the Predictor

1. Enter your **Sunday buy price**
2. **Select last week's pattern** (if you remember it) → greatly improves accuracy
3. Enter prices as you see them on your island
4. Click **"Calculate Forecast"**
5. Review the **probabilities** for each pattern

**Tips to improve predictions:**
1. **Enter more prices** (especially Monday–Tuesday) — each price helps eliminate patterns
2. **Select the previous pattern** if you know it — shifts the base probabilities
3. **Wait until you have several prices** before making important decisions

---

## 🔄 Transition Probabilities

**Important:** The game does **not** pick patterns randomly. This week's pattern depends on last week's.

| Last week | Most likely this week |
|-----------|----------------------|
| **Decreasing** | **45% Large Spike** 🎉 |
| **Large Spike** | **50% Fluctuating** |
| **Fluctuating** | **35% Small Spike** |
| **Small Spike** | **45% Fluctuating** |

💡 If you had **Decreasing** last week, you have a high chance of **Large Spike** this week — so it's worth tracking your pattern each week.

---

## 💡 Selling Strategies

**🚀 Large Spike**
- Wait for **200%+** — that's the moment
- Don't sell too early; this is the best pattern

**📈 Small Spike**
- Sell when you see **140–200%**
- That's the maximum for this pattern

**📊 Fluctuating**
- Sell when above **110%** (any profit is good)
- Unpredictable — don't wait for huge spikes

**📉 Decreasing**
- Sell **immediately** or find another island
- It only gets worse each day

### What NOT to do:
- ❌ Don't wait until Saturday if you have Decreasing
- ❌ Don't sell too early if you see spike signals
- ❌ Don't make decisions with too few data points
- ❌ Don't forget to note your pattern each week

---

## 📚 References

- **[ALGORITHM.md](ALGORITHM.md)**: Technical documentation of the prediction algorithm
- **[Original game code](https://gist.github.com/Treeki/85be14d297c80c8b3c0a76375743325b)**: Datamined by Ninji/Treeki (2020)

---

## 🙏 Credits

- **Ninji (Treeki)** — Original algorithm datamining
- **r/acturnips community** — Verification and documentation
- Based on the actual Animal Crossing: New Horizons source code
