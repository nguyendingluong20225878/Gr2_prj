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
import { detectSignalWithLlm } from '../src/detector';
import { saveSignalToDb } from '../src/persistence';

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

    // 1. Lấy Tweets mới nhất
    const tweets = await tweetTable.find().sort({ tweetTime: -1 }).limit(10).lean(); // Lấy 10 tweet mới nhất
    console.log(`Loaded ${tweets.length} tweets from DB.`);

    const formattedTweets = tweets.map((t: any) => ({
      id: t._id?.toString?.() ?? String(t._id),
      text: t.content,
      author: t.authorId ?? t.author ?? 'unknown',
      time: t.tweetTime ? new Date(t.tweetTime).toISOString() : new Date().toISOString(),
      url: t.url || '',
    }));

    // 2. Lấy Tokens
    const dbTokens = await tokensTable.find().limit(20).lean(); // Lấy 20 token đầu tiên
    const knownTokens = dbTokens.map((t: any) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.name,
    }));
    console.log(`Loaded ${knownTokens.length} known tokens.`);

    // 3. CHẠY PHÂN TÍCH (AGGREGATION MODE)
    console.log('🧠 Running AI Aggregation Analysis...');
    
    const result = await detectSignalWithLlm({
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

        // Tìm address để lưu vào DB
        const tokenInfo = knownTokens.find(t => t.symbol === signal.tokenSymbol);
        
        // Map sang object Signal DB
        const signalToSave = {
           ...signal,
           tokenAddress: tokenInfo?.address || "unknown",
           // Thêm metadata
           type: "social_aggregation",
           tweetCount: signal.relatedTweetIds.length,
        };

        await saveSignalToDb(signalToSave as any);
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