### 1. Mục đích thư mục

`layer3` tạo proposal/rationale từ signals. Nó không thay thế quant score; nó giải thích quyết định đã có bằng Gemini thông qua LangGraph.

### 2. Thành phần bên trong

- `src/agent.ts`: LangGraph với node `reasoning`, gọi Gemini 2.5 Flash.
- `src/workflow.ts`: batch workflow đọc RAW signals, enrich source content, upsert proposal, update signal status.
- `src/state.ts`: `ProposalState` contract.
- `scripts/run-layer3.ts`: script runner.
- `tests`: proposal generation tests/mockdata.

### 3. Luồng hoạt động

`runLayer3Batch` tìm `signals` status `RAW`, validate required fields, resolve source content từ `news_articles`/`tweets`, invoke graph, upsert `proposals` by `signalId`, set signal `PROCESSED`.

### 4. Dependency

Depends on `@gr2/shared`, `@langchain/langgraph`, `@langchain/core`, Gemini API key in env.

### 5. Logic quan trọng

Prompt yêu cầu output một đoạn văn tiếng Việt, khẳng định BUY/SELL/HOLD, trích Z-score/confidence, giải thích dựa trên source content, thêm câu cold-start nếu confidence <= 40%.

<!-- ### 6. Rủi ro / vấn đề

- `reasoningNode` gọi Gemini bằng raw `fetch`, không có retry/backoff.
- Safety settings are set to `BLOCK_NONE`; cần governance rõ ràng.
- `sourceContentLimit` default 100000 rất lớn; có thể tốn token/latency.
- Nếu LLM fail, signal bị set `FAILED` nhưng không có detailed error field trong shared signal schema.

### 7. Cách cải thiện

- Thêm retry, timeout, model/version metadata.
- Giảm/segment source content và summarize evidence trước khi prompt.
- Lưu `rationalePromptVersion`, `llmModel`, `finishReason`, token usage.
 -->
