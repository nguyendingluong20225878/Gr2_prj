    # Project: Web3 Investment Signal System

## Domain
Phân tích dữ liệu Web3 (Twitter, News) → tạo tín hiệu định lượng → suy luận gợi ý đầu tư.

## Pipeline (Core Architecture)
Raw Data → ML Scoring → Normalization → Source Blending → Persistence

---

## Data Sources
- Twitter (KOLs, founder)
- News (CoinDesk, The Block,...)

---

## Signal Generation (NO LLM)

### 1. Sentiment (FinBERT)
Input:
- Tweet text
- News: title + summary

Process:
- finBertProbs(text) → (bullish, bearish, neutral)
- baseScore = bullish - bearish ∈ [-1, 1]

---

### 2. News Scoring

For each article:
- Recency weight:
  M_r = 1 → 1.5 (newer = higher)                    

- SiteWeight (dynamic, from backtest)

Score:
S_news_i = baseScore * M_r * SiteWeight

---

### 3. Twitter Scoring

For each tweet:

- baseScore (FinBERT)

- Engagement multiplier:
  1 + log(1 + engagement) / P90(batch)

- Author weight:
  based on follower percentile

Raw score:
rawScore = baseScore * authorWeight * engagementMultiplier

---

### 4. Normalization (IMPORTANT)

All scores → Z-score:

z = (x - μ) / σ

→ remove noise + detect outliers

---

### 5. Aggregation (per token)

Group by token:

- News_Score(token) = weighted avg(S_news_i_norm)
- Twitter_Score(token) = weighted avg(z_tweet)

Weights:
- News: M_r * SiteWeight
- Twitter: authorWeight * engagementMultiplier

---

### 6. Backtest (Dynamic Weighting)

- IC (Information Coefficient):
  correlation(score, future price)

→ update:
- SiteWeight
- AuthorWeight

---

## Output (Quant Layer)

Per token:
- Clean sentiment score
- Market signal strength

---

## AI Reasoning Layer

Input:
- Quant scores (ground truth)
- Raw text (tweets/news)
- RAG (project info + history)

LLM nhiệm vụ:
- Generate rationaleSummary
- Output suggestion (buy/sell)

---

## Core Rules

- LLM KHÔNG làm tính toán
- ML + Math = ground truth
- Z-score để loại nhiễu
- Weighting để phản ánh độ tin cậy nguồn
- Backtest để tự học

---

## Current Focus
- Signal detector (quant pipeline)
- LLM reasoning integration