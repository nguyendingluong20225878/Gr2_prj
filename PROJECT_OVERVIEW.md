    # Project: Web3 Signal Analytics & Trading Decision System

    ## Goal
    Phân tích dữ liệu Web3 (Twitter, News) → tạo tín hiệu định lượng → đưa ra quyết định BUY/SELL → đánh giá bằng backtest.

    ---

    ## Core Architecture
    Pipeline:
    Raw Data → ML Scoring → Normalization → Aggregation → AI Reasoning → Backtest

    - ML/Math: tạo signal (ground truth)
    - LLM: suy luận + chốt BUY/SELL + giải thích
    - RAG: cung cấp context (project info, history)
    - LangGraph: điều phối toàn bộ pipeline reasoning
    - Backtest: đánh giá độ chính xác

    ---

    ## Main Modules

    ### 1. Data Collection
    - Twitter scraping (KOLs, founder)
    - News scraping (CoinDesk, The Block,...)
    - Token filtering (regex)

    ---

    ### 2. Signal Detector (Quant Core)
    - Sentiment (FinBERT)
    - Weighting:
    - Twitter: author + engagement
    - News: recency + source
    - Z-score normalization (loại nhiễu)
    - Aggregation theo token

    Output:
    - sentiment_score (normalized)
    - signal_strength

    ---

    ### 3. AI Reasoning (LangGraph Pipeline)

    Input:
    - Quant signals (ground truth)
    - Raw text (tweets/news)
    - RAG context (project + history)

    Process:
    - Validate signal
    - Combine context
    - Generate decision

    Output:
    - suggestion: BUY / SELL / HOLD
    - rationaleSummary (giải thích)

    ---

    ### 4. Backtest System
    - So sánh signal với biến động giá (24h–48h)
    - Metrics:
    - IC (Information Coefficient)
    - win rate
    - Update dynamic weights:
    - SiteWeight
    - AuthorWeight

    ---

    ### 5. Visualization / API
    - Hiển thị:
    - signal theo token
    - decision (BUY/SELL)
    - historical performance

    ---

    ## Core Rules

    - ML/Math = ground truth (không override bởi LLM)
    - LLM chỉ reasoning + explain
    - Z-score để loại nhiễu
    - Backtest để validate & update weight
    - Không cá nhân hóa (no user profile)

    ---
  ## Tech Stack
    - Node.js (Express)
    - MongoDB
    - FinBERT
    - LLM
    - LangGraph
    - Statistical methods (Z-score, IC)
    ## Current Status

    ### ✅ Done
    - Data fetching
    - Basic sentiment scoring

    ### 🟡 In Progress
    - Aggregation + normalization
    - LangGraph reasoning flow

    ### 🔴 Need Work
    - Backtest system
    - Decision consistency

    ---

  

    ---

    ## Current Focus
    - Hoàn thiện quant pipeline
    - Xây dựng LangGraph decision flow
    - Implement backtest


IF signal mạnh (quant) 
    → LLM confirm + explain

IF signal yếu / conflict
    → LLM phân tích + HOLD

IF overbought (RSI cao)
    → SELL hoặc HOLD