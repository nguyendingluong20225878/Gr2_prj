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
import { saveSignalToDb } from '../src/db-mapper';
import { detectSignalWithFinBertQuant } from '../src/quant-engine';
import { computeStage2Signals } from '../src/twitter-aggregator';

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
    const { newsArticlesTable } = await import('../../shared/src/db/schema/news_articles.js');
    const { sourceWeightsTable } = await import('../../shared/src/db/schema/source_weights.js');
    const { signalWeightsTable } = await import('../../shared/src/db/schema/signal_weights.js');

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
      coingeckoId: t.coingeckoId ?? null,
    }));
    console.log(`Loaded ${knownTokens.length} known tokens.`);

    // 3. Load News (48h) + weights
    const now = new Date();
    const since = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const recentNews = await newsArticlesTable
      .find({ scrapedAt: { $gte: since } })
      .sort({ scrapedAt: -1 })
      .limit(200)
      .lean();

    const siteWeights = await sourceWeightsTable.find().lean();
    const latestSignalWeights = await signalWeightsTable.find().sort({ updatedAt: -1 }).limit(1).lean();
    const dyn = latestSignalWeights[0]
      ? { wTwitter: latestSignalWeights[0].wTwitter, wNews: latestSignalWeights[0].wNews }
      : null;

    // 4. Token attribution for tweets: map symbol->coingeckoId (symbol-only matching recommended)
    const symbolToCg = new Map<string, string>();
    for (const t of knownTokens) {
      if (t.coingeckoId) symbolToCg.set(String(t.symbol).toUpperCase(), t.coingeckoId);
    }

    function escapeRegex(text: string): string {
      return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function strictSymbolRegex(symbol: string): RegExp | null {
      const s = symbol?.trim();
      if (!s || s.length < 2) return null;
      const escaped = escapeRegex(s);
      const isAllUpperLetters = /^[A-Z]{2,}$/.test(s);
      const flags = isAllUpperLetters ? "" : "i";
      return new RegExp(`(^|[^A-Za-z0-9])\\$?${escaped}([^A-Za-z0-9]|$)`, flags);
    }

    const tokenRegexes = knownTokens
      .map((t) => ({ symbol: String(t.symbol), re: strictSymbolRegex(String(t.symbol)) }))
      .filter((x) => !!x.re);

    const stage2Tweets = formattedTweets.map((t: any) => {
      const keys = new Set<string>();
      for (const tr of tokenRegexes) {
        if (tr.re!.test(t.text)) {
          const cg = symbolToCg.get(tr.symbol.toUpperCase());
          if (cg) keys.add(cg);
        }
      }
      return { ...t, tokenKeys: [...keys] };
    });

    // 5. Compute Stage2 signals (Twitter+News, z-score thresholds)
    console.log('🧠 Running Stage2 Quant (Twitter+News)...');

    const stage2Signals = await computeStage2Signals({
      tokenRefs: knownTokens.map((t: any) => ({ symbol: t.symbol, coingeckoId: t.coingeckoId })),
      tweets: stage2Tweets,
      newsArticles: recentNews as any,
      siteWeights: siteWeights.map((w: any) => ({ siteHost: w.siteHost, siteWeight: w.siteWeight })),
      dynamicWeights: dyn,
    });

    // 6. Save signals
    if (stage2Signals.length > 0) {
      console.log(`\n=== 🚀 PHÁT HIỆN ${stage2Signals.length} TÍN HIỆU (STAGE2) ===`);

      for (const signal of stage2Signals) {
        console.log(`------------------------------------------------`);
        console.log(`TokenKey:   ${signal.tokenKey}`);
        console.log(`Action:     ${signal.action} (Confidence: ${signal.confidencePct}%)`);
        console.log(`finalScore: ${signal.finalScore.toFixed(3)} z=${signal.zFinal.toFixed(2)}`);

        const tokenInfo = knownTokens.find((t: any) => t.coingeckoId === signal.tokenKey);
        const tokenName = tokenInfo?.name || signal.tokenKey;

        const signalToSave = {
          signalDetected: true,
          tokenSymbol: tokenInfo?.symbol || signal.tokenKey,
          tokenName,
          tokenAddress: signal.tokenKey, // use coingeckoId as token key
          action: signal.action,
          confidence: signal.confidencePct,
          reason: `Stage2 finalScore=${signal.finalScore.toFixed(3)} z=${signal.zFinal.toFixed(2)} wTw=${(signal.metadata as any).wTwitter} wNews=${(signal.metadata as any).wNews}`,
          relatedTweetIds: [],
          sources: signal.sources,
          type: "stage2_quant",
          tweetCount: (signal.metadata as any).nTweets,
          metadata: {
            ...signal.metadata,
            twitterScore: signal.twitterScore,
            newsScore: signal.newsScore,
            finalScore: signal.finalScore,
            zFinal: signal.zFinal,
          },
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