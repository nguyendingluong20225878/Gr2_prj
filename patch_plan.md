## Issue 1
- Mô tả:
  - `core/news-scraper/src/process.ts/buildTokenMatchers` dùng regex flag `"i"` cho toàn pattern.
  - Bare ticker như `IN`, `ON`, `AI` có thể match từ thường trong news, làm `detectedTokens` sai và gây signal/proposal sai.
- Giải pháp:
  - Bỏ flag `"i"`.
  - Chỉ cho phép bare ticker match dạng uppercase.
  - Vẫn giữ `$TOKEN` và `$token` cho cashtag.
  - Với token name, chỉ match `Name Capitalized` hoặc `NAME`, tránh match từ thường phổ biến.
- Tại sao chọn cách này:
  - Minimal change, chỉ đổi matcher.
  - Không phá flow news scraper và signal detector.
  - Giảm false-positive mà vẫn giữ các pattern crypto phổ biến.
- Code fix:
```ts
const symbolUpper = escapeRegex(symbol);
const symbolLower = escapeRegex(symbol.toLowerCase());
const parts = [`\\$${symbolUpper}`, `\\$${symbolLower}`, symbolUpper];

const name = (token.name ?? "").trim();
if (
  name &&
  name.length >= 4 &&
  name.toUpperCase() !== symbol &&
  !["THE", "AND", "USD", "USDT"].includes(name.toUpperCase())
) {
  const nameCapitalized = escapeRegex(
    name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  );
  const nameUpper = escapeRegex(name.toUpperCase());
  parts.push(nameCapitalized, nameUpper);
}

matchers.push({
  symbol,
  regex: new RegExp(`(?<![a-zA-Z0-9])(?:${parts.join("|")})(?![a-zA-Z0-9])`),
});
```

## Issue 2
- Mô tả:
  - `core/signal-detector/scripts/run-quant.ts` upsert signal theo `tokenSymbol + createdAt >= startOfDay`.
  - Mỗi lần cron chạy có thể update lại signal đã `PROCESSED` và set `status: "RAW"`.
- Giải pháp:
  - Không reset `status` khi update document đã tồn tại.
  - Chỉ set `status: "RAW"` trong `$setOnInsert`.
  - Nếu cần cập nhật signal trong ngày, chỉ cập nhật score/metadata, không ép Layer3 xử lý lại.
- Tại sao chọn cách này:
  - Minimal change nhất để chặn reprocessing loop.
  - Giữ khóa token/ngày hiện tại, chưa cần migration event identity.
  - Không phá dashboard đang đọc document signal mới nhất trong ngày.
- Code fix:
```ts
update: {
  $set: {
    tokenSymbol: symbol,
    tokenAddress: finalAddress,
    quantScore: res.quantScore || 0,
    confidence: res.confidence || 0,
    suggestionType: res.suggestionType || "hold",
    sentimentType: res.sentimentType || "neutral",
    sources: res.sources || [],
    metadata: { /* giữ logic hiện tại */ },
    uncertaintyEntropy: res.uncertaintyEntropy ?? res.volatilityFlag ?? 0,
    realizedVolatility: res.realizedVolatility ?? null,
    signalMode: res.signalMode ?? res.metadata?.signalMode ?? null,
    updatedAt: new Date(),
  },
  $setOnInsert: {
    createdAt: new Date(),
    detectedAt: new Date(),
    status: "RAW",
  },
},
```

## Issue 3
- Mô tả:
  - `core/x-scaper/src/db.ts/saveTweets` nuốt lỗi insert non-duplicate.
  - Sau lỗi fatal, code vẫn update `lastTweetUpdatedAt`, gây mất tweet vĩnh viễn.
- Giải pháp:
  - Phân biệt duplicate-only với lỗi insert thật.
  - Với lỗi non-duplicate: throw để nhảy ra catch tổng và không update checkpoint.
  - Chỉ update `lastTweetUpdatedAt` sau khi persistence thành công hoặc chỉ có duplicate key hợp lệ.
- Tại sao chọn cách này:
  - Giữ behavior bỏ qua duplicate hiện tại.
  - Chặn data loss ở checkpoint boundary.
  - Không cần đổi schema hoặc flow scraper.
- Code fix:
```ts
let persistenceOk = false;

try {
  const result = await tweetTable.insertMany(tweetDocuments, { ordered: false });
  persistenceOk = true;
  console.log(`[DB SUCCESS] Đã chèn mới thành công ${result.length} tweets vào MongoDB!`);
} catch (err: any) {
  const duplicateOnly =
    err.code === 11000 ||
    (Array.isArray(err.writeErrors) &&
      err.writeErrors.length > 0 &&
      err.writeErrors.every((e: any) => e.code === 11000));

  if (duplicateOnly) {
    persistenceOk = true;
    const inserted = err.insertedDocs ? err.insertedDocs.length : 0;
    console.log(`[DB INFO] Duplicate Key: Đã lưu ${inserted} bài viết mới, bỏ qua bài cũ.`);
  } else {
    console.error(`[DB FATAL ERROR] Lỗi Mongoose:`, err.message);
    throw err;
  }
}

if (!persistenceOk) return null;
```

## Issue 4
- Mô tả:
  - `run-quant.ts` build `historicalData` bằng `signals.quantScore`.
  - `alpha-analyzer.ts` lại coi `history[].unifiedRaw` là raw score trước chuẩn hóa.
  - Gây double-normalization và score drift.
- Giải pháp:
  - Lấy raw baseline từ `metadata.scoreComponents.unifiedRaw` nếu có.
  - Fallback sang `quantScore` chỉ để tương thích dữ liệu cũ.
  - Không đổi contract của `evaluateAlphaAndCross`.
- Tại sao chọn cách này:
  - Ít thay đổi nhất, sửa đúng nguồn history.
  - Không cần migration ngay.
  - Dữ liệu cũ vẫn chạy được.
- Code fix:
```ts
const pastSignals = await db.collection(targetCollection).find({
  createdAt: { $gte: sevenDaysAgo }
}).project({
  tokenSymbol: 1,
  quantScore: 1,
  "metadata.scoreComponents.unifiedRaw": 1,
  createdAt: 1,
}).toArray();

pastSignals.forEach((sig: any) => {
  const sym = sig.tokenSymbol as string;
  if (!sym) return;

  const raw = Number(sig.metadata?.scoreComponents?.unifiedRaw ?? sig.quantScore);
  if (!Number.isFinite(raw)) return;

  if (!historicalData[sym]) historicalData[sym] = [];
  historicalData[sym].push({
    unifiedRaw: raw,
    timestamp: new Date(sig.createdAt).getTime(),
  });
});
```

## Issue 5
- Mô tả:
  - `core/signal-detector/src/alpha-analyzer.ts/evaluateAlphaAndCross` filter finite cho EMA nhưng tính MAD bằng raw history.
  - Một giá trị `NaN/null/undefined` có thể làm `finalScore` thành `NaN` và token bị drop silently.
- Giải pháp:
  - Dùng cùng `historyValues` đã filter finite cho cả EMA và MAD.
  - Nếu history finite không đủ 3 điểm, xử lý như cold-start.
  - Chỉ push final signal khi `finalScore` finite.
- Tại sao chọn cách này:
  - Minimal change trong numeric guard.
  - Không thay đổi công thức khi dữ liệu hợp lệ.
  - Chặn silent NaN propagation.
- Code fix:
```ts
const historyValues = history
  .map(h => Number(h.unifiedRaw))
  .filter(value => Number.isFinite(value));

if (historyValues.length < 3) {
  state.timeZ = state.unifiedRaw;
} else {
  const ema7 = historyValues.slice(1).reduce(
    (ema, value) => calcEMA(value, ema, 7),
    historyValues[0]
  );
  const mad7 = calcMAD(historyValues);
  const safeMad = Number.isFinite(mad7) ? Math.max(mad7 * 1.4826, 0.01) : 0.01;
  state.timeZ = (state.unifiedRaw - ema7) / safeMad;
}

if (!Number.isFinite(state.finalScore)) continue;
```

## Issue 6
- Mô tả:
  - `core/signal-detector/src/document-processor.ts/processDocuments` build text news bằng `` `${doc.title}\n${doc.summary}` ``.
  - `summary` thiếu có thể thành `"undefined"` hoặc bỏ qua `content`.
  - `knownTokens.map` gọi `token.symbol.trim()` và `token.name.trim()` không guard null.
- Giải pháp:
  - Chuẩn hóa token trước khi compile, bỏ record thiếu symbol/name không hợp lệ.
  - Build `textToScore` từ các field có thật: title, summary, content.
  - Skip FinBERT nếu text rỗng.
- Tại sao chọn cách này:
  - Giảm input nhiễu cho FinBERT.
  - Không đổi scoring API.
  - Tránh crash toàn batch vì một token record lỗi.
- Code fix:
```ts
const compiledTokens: CompiledToken[] = knownTokens
  .map(token => ({
    ...token,
    symbol: String(token.symbol ?? "").trim(),
    name: String(token.name ?? "").trim(),
  }))
  .filter(token => token.symbol.length >= 2 && token.name.length >= 2)
  .map(token => {
    const symUpper = escapeRegex(token.symbol.toUpperCase());
    const symLower = escapeRegex(token.symbol.toLowerCase());
    const nameCapitalized = escapeRegex(
      token.name.charAt(0).toUpperCase() + token.name.slice(1).toLowerCase()
    );
    const nameUpper = escapeRegex(token.name.toUpperCase());

    return {
      ...token,
      symbolRegex: new RegExp(`(?<![a-zA-Z0-9])(?:[\\$#]${symUpper}|[\\$#]${symLower}|${symUpper})(?![a-zA-Z0-9])`),
      nameRegex: new RegExp(`(?<![a-zA-Z0-9])(?:${nameCapitalized}|${nameUpper})(?![a-zA-Z0-9])`),
    };
  });

const textToScore = isTweet
  ? String(doc.text || "").trim()
  : [doc.title, doc.summary, doc.content].filter(Boolean).join("\n").trim();

if (!textToScore) continue;
```

## Issue 7
- Mô tả:
  - `core/layer3/src/workflow.ts/processSignal` không copy `uncertaintyEntropy`, `realizedVolatility`, `signalMode` từ signal sang proposal.
  - Proposal mất cảnh báo cold-start/uncertainty ở layer người dùng.
- Giải pháp:
  - Mở rộng `RawSignal` type.
  - Copy thêm 3 field vào `$set`.
  - Copy `detectedAt` để phục vụ backtest.
- Tại sao chọn cách này:
  - Chỉ bổ sung field, không đổi logic LLM.
  - Proposal giữ đúng metadata từ quant ground truth.
  - Hỗ trợ cả UI và backtest.
- Code fix:
```ts
type RawSignal = {
  // giữ field hiện tại
  detectedAt?: Date;
  uncertaintyEntropy?: number;
  realizedVolatility?: number | null;
  signalMode?: string | null;
  metadata?: {
    scoreComponents?: Record<string, unknown>;
    uncertaintyEntropy?: number;
    signalMode?: string;
  };
};

$set: {
  tokenSymbol: signal.tokenSymbol,
  tokenAddress: signal.tokenAddress,
  suggestionType: signal.suggestionType,
  sentimentType: signal.sentimentType,
  quantScore: signal.quantScore,
  confidence: signal.confidence,
  volatilityFlag: signal.volatilityFlag ?? null,
  uncertaintyEntropy: signal.uncertaintyEntropy ?? signal.metadata?.uncertaintyEntropy ?? null,
  realizedVolatility: signal.realizedVolatility ?? null,
  signalMode: signal.signalMode ?? signal.metadata?.signalMode ?? null,
  detectedAt: signal.detectedAt ?? null,
  scoreComponents: signal.metadata?.scoreComponents ?? {},
  expiresAt: signal.expiresAt ?? null,
  sources: signal.sources ?? [],
  rationaleSummary: finalState.rationaleSummary,
  executionStatus: "PENDING",
  updatedAt: new Date(),
}
```

## Issue 8
- Mô tả:
  - `apps/web/app/api/proposals/route.ts/GET` default action thành `"BUY"` khi thiếu `action/suggestionType`.
  - Code còn override action bằng keyword trong title.
- Giải pháp:
  - Chuẩn hóa action từ `action` hoặc `suggestionType` hợp lệ.
  - Nếu thiếu field, trả `"HOLD"` hoặc `"UNKNOWN"` thay vì `"BUY"`.
  - Không override action bằng title.
- Tại sao chọn cách này:
  - API không tự suy luận sai recommendation.
  - Giữ backward-compatible output `action`.
  - Tránh presentation layer override quant/proposal ground truth.
- Code fix:
```ts
function normalizeAction(value?: string): "BUY" | "SELL" | "HOLD" | "UNKNOWN" {
  const upper = String(value ?? "").toUpperCase();
  if (upper === "BUY" || upper === "SELL" || upper === "HOLD") return upper;
  return "UNKNOWN";
}

const action = normalizeAction(p.action ?? p.suggestionType);
```

## Issue 9
- Mô tả:
  - `core/research/backtest/engine.ts/resolveDetectedAt` ưu tiên `proposal.detectedAt`, nhưng Layer3 chưa copy field này.
  - Backtest hiện dễ lấy `createdAt` của proposal thay vì thời điểm signal detected.
- Giải pháp:
  - Sau Issue 7, proposal có `detectedAt`.
  - Trong backtest, nếu proposal cũ thiếu `detectedAt`, lookup signal bằng `signalId` để lấy `signal.detectedAt`.
- Tại sao chọn cách này:
  - Không làm hỏng proposal cũ.
  - Backtest mới dùng timestamp đúng khi dữ liệu có sẵn.
  - Fallback hiện tại vẫn giữ để tránh crash.
- Code fix:
```ts
async function resolveDetectedAt(proposal: any): Promise<Date> {
  if (proposal.detectedAt) return new Date(proposal.detectedAt);

  if (proposal.signalId) {
    const signal = await signalsTable
      .findById(proposal.signalId, { detectedAt: 1, createdAt: 1 })
      .lean();
    const source = signal?.detectedAt ?? signal?.createdAt;
    if (source) return new Date(source);
  }

  const source = proposal.createdAt ?? proposal.updatedAt;
  return source ? new Date(source) : new Date();
}
```

## Issue 10
- Mô tả:
  - `core/run/src/index.ts/start` comment toàn bộ bước X scraper.
  - Cron mỗi phút chạy quant/Layer3 trên dữ liệu X cũ.
- Giải pháp:
  - Bật lại X scraper bằng env flag, default an toàn là bật khi có credential.
  - Nếu chưa muốn scrape trong môi trường dev, set `RUN_X_SCRAPER=false`.
- Tại sao chọn cách này:
  - Minimal change, không bắt buộc mọi môi trường phải chạy scraper.
  - Production pipeline không bị “realtime giả”.
  - Giữ lock hiện có để tránh chạy chồng.
- Code fix:
```ts
const shouldRunXScraper = process.env.RUN_X_SCRAPER !== "false";

if (shouldRunXScraper) {
  logger.info("Bước 1: Cào dữ liệu từ X...");
  const scraperPath = path.resolve(
    __dirname,
    "../../x-scaper/scripts/run-scraper.ts"
  );

  execSync(`npx tsx ${scraperPath}`, {
    stdio: "inherit",
    env: process.env,
  });

  logger.info("Bước 1 hoàn thành: Cào dữ liệu từ X.");
}
```

## Issue 11
- Mô tả:
  - `core/signal-detector/src/finbert.ts` comment nói timeout 10 giây nhưng code dùng 40 giây.
  - Dễ gây hiểu sai khi tuning cron/batch latency.
- Giải pháp:
  - Sửa comment cho đúng 40 giây, hoặc đưa timeout thành env var.
  - Minimal nhất: sửa comment.
- Tại sao chọn cách này:
  - Không đổi runtime behavior.
  - Giảm rủi ro vận hành do documentation sai.
- Code fix:
```ts
// Timeout 40 giây cho request FinBERT để tránh treo batch quá lâu.
```

## Issue 12
- Mô tả:
  - `apps/web/app/api/signals/[id]/route.ts` định nghĩa local `SignalSchema` có field `symbol`, trong khi schema chuẩn dùng `tokenSymbol`.
  - Schema drift làm API detail dễ đọc sai field.
- Giải pháp:
  - Đổi local schema/type sang `tokenSymbol`.
  - Nếu cần tương thích dữ liệu cũ, có thể giữ `symbol?: string` optional nhưng không dùng làm field chính.
- Tại sao chọn cách này:
  - Chỉnh type/schema boundary, không đổi dữ liệu DB.
  - Giảm rủi ro bug khi thêm validation hoặc field mới.
- Code fix:
```ts
const SignalSchema = new Schema(
  {
    tokenSymbol: String,
    tokenAddress: String,
    quantScore: Number,
    confidence: Number,
    suggestionType: String,
    sentimentType: String,
    sources: Array,
    metadata: Schema.Types.Mixed,
  },
  { strict: false }
);
```

## Issue 13
- Mô tả:
  - `core/token-price-fetcher/src/services/token-price-service.ts/updatePrices` gọi `bulkWrite` cả khi `bulkOps.length === 0`.
  - Khi CoinGecko trả data rỗng, job có thể fail không cần thiết.
- Giải pháp:
  - Guard trước `bulkWrite`.
  - Log rõ không có giá nào cần update.
- Tại sao chọn cách này:
  - Minimal change.
  - Không đổi logic giá khi có dữ liệu hợp lệ.
  - Làm cron price update kết thúc sạch trong case empty batch.
- Code fix:
```ts
if (bulkOps.length === 0) {
  this.logger.warn("No token prices to update.");
  return;
}

await tokenPriceTable.bulkWrite(bulkOps);
```
