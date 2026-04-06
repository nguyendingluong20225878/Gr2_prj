import dotenv from 'dotenv';
import path from 'path';

// =======================
// 1. Load ENV
// =======================
const primary = dotenv.config();

if (!process.env.MONGODB_URI) {
  const rootEnv = path.resolve(__dirname, '../../.env');
  const alt = dotenv.config({ path: rootEnv });
}

// =======================
// 2. Imports
// =======================
import { saveSignalToDb } from '../src/persistence';
import { detectSignalWithFinBertQuant } from '../src/detector';

// =======================
// 3. DB helper
// =======================
async function waitForDbConnect(retries = 3, delayMs = 2000) {
  const { connectToDatabase, disconnectFromDatabase } = await import(
    '../../shared/src/db/connection.js'
  );
  await connectToDatabase();
  return { disconnectFromDatabase };
}

// =======================
// 4. Main runner
// =======================
(async () => {
  let disconnectFromDatabase: (() => Promise<void>) | undefined;

  try {
    if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is not set');

    console.log('🌱 Connecting to Database...');
    const db = await waitForDbConnect();
    disconnectFromDatabase = db.disconnectFromDatabase;

    // Load Resources from DB
    const { tweetTable } = await import('../../shared/src/db/schema/tweets.js');
    const { tokensTable } = await import('../../shared/src/db/schema/tokens.js');
    const { xAccountTable } = await import('../../shared/src/db/schema/x_accounts.js');

    //Tinh authorWeight tu followerCount
    const xAccounts = await xAccountTable.find().lean();

    //base metrix
    
    const followerMetrics = xAccounts
    .map((a: any) => Math.log(1 + Math.max(0, a.followerCount ?? 0))) //Duyet tung phan tu
    .filter((v: number) => Number.isFinite(v) && v >= 0); // Loai bo khong hop le
    // isFinite : so huu han

    //quantile
    function quantile(values: number[], q: number): number {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const pos = Math.floor((sorted.length - 1) * q);
      return sorted[Math.max(0, Math.min(sorted.length - 1, pos))];
    }
    const P50 = quantile(followerMetrics, 0.5);
    const P95 = quantile(followerMetrics, 0.95);

    //Bien do author effect
    const ALPHA = Number(process.env.AUTHOR_WEIGHT_ALPHA ?? 0.5);

/**
 * Compute authorWeight:
 *  - Nếu metric <= P50 => weight = 1.0
 *  - Nếu giữa P50 và P95 => interpolate tuyến tính 0..1
 *  - Nếu >= P95 => normalized = 1 => weight = 1 + ALPHA
 */
function computeAuthorWeight(followerCount: number | null | undefined): number {
  const m = Math.log(1 + Math.max(0, followerCount ?? 0));
  if (!Number.isFinite(m) || m <= P50) return 1.0;
  const denom = P95 > P50 ? (P95 - P50) : 1;
  const normalized = Math.max(0, Math.min(1, (m - P50) / denom));
  return 1 + ALPHA * normalized;
}
// Map nhanh authorId -> authorWeight
const authorWeightById = new Map<string, number>();
for (const acc of xAccounts) {
  const id = acc._id?.toString?.() ?? String(acc._id);
  const w = computeAuthorWeight(acc.followerCount ?? 0);
  authorWeightById.set(id, w);
}


    // 1. Lấy tất cả tweets mới chưa từng tạo signal
    // Lấy 10 tweet mới nhất
    let tweets = await tweetTable.find().sort({ tweetTime: -1 }).limit(10).lean();
    console.log(`Loaded ${tweets.length} latest tweets from DB.`);

    const formattedTweets = tweets.map((t: any) => {
      const authorId = t.authorId ?? t.author ?? 'unknown';
      const authorWeight = authorWeightById.get(authorId) ?? 1.0;
    
      return {
        id: t._id?.toString?.() ?? String(t._id),
        text: t.content,
        author: authorId,
        time: t.tweetTime ? new Date(t.tweetTime).toISOString() : new Date().toISOString(),
        url: t.url || '',
        // Engagement từ DB (null -> 0)
        replyCount: t.replyCount ?? 0,
        retweetCount: t.retweetCount ?? 0,
        likeCount: t.likeCount ?? 0,
        // AuthorWeight đã tính theo phân vị followers
        authorWeight,
      };
    });

    // 2. Lấy tối đa 100 tokens
    const dbTokens = await tokensTable.find().limit(100).lean();
    const knownTokens = dbTokens.map((t: any) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
    }));
    console.log(`Loaded ${knownTokens.length} known tokens.`);

    // 3. CHẠY PHÂN TÍCH (AGGREGATION MODE)
    console.log('🧠 Running FinBERT Quant Signal Detection...');

    const result = await detectSignalWithFinBertQuant({
      formattedTweets,
      knownTokens,
    });

    // 4. Xử lý kết quả
    if (result.signals && result.signals.length > 0) {
      console.log(`\n=== 🚀 PHÁT HIỆN ${result.signals.length} TÍN HIỆU ===`);
      
      for (const signal of result.signals) {
        console.log(`------------------------------------------------`);
        console.log(`Token:      ${signal.tokenSymbol}`);
        console.log(`Action:     ${signal.action} (Confidence: ${signal.confidence}%)`);
        console.log(`Reason:     ${signal.reason}`);
        console.log(`Sources:    ${signal.relatedTweetIds.length} tweets aggregated`);

        // Luôn lưu signal, nếu thiếu tokenAddress thì dùng tokenSymbol làm fallback
        const tokenInfo = knownTokens.find(t => t.symbol === signal.tokenSymbol);
        const tokenAddress = tokenInfo?.address || signal.tokenSymbol || "unknown_token";
        const tokenName = tokenInfo?.name || signal.tokenSymbol;
        // Map sang object Signal DB
        const signalToSave = {
          ...signal,
          tokenAddress,
          tokenName,
          type: "social_aggregation",
          tweetCount: signal.relatedTweetIds.length,
        };
        await saveSignalToDb(signalToSave);
        console.log(`✅ Saved to DB.`);
      }
    } else {
      console.log('\n=== 😴 KHÔNG TÌM THẤY TÍN HIỆU RÕ RÀNG ===');
      console.log('Có thể do tweet không liên quan hoặc thông tin trái chiều chưa đủ độ tin cậy.');
    }

    if (disconnectFromDatabase) await disconnectFromDatabase();
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err);
    if (disconnectFromDatabase) await disconnectFromDatabase();
    process.exit(1);
  }
})();