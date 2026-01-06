import dotenv from 'dotenv';
import path from 'path';

// =======================
// 1. Load ENV
// =======================
const primary = dotenv.config();

if (!process.env.MONGODB_URI) {
  const rootEnv = path.resolve(__dirname, '../../.env');
  const alt = dotenv.config({ path: rootEnv });
  console.log(
    'dotenv primary:',
    primary.error ? 'not loaded' : 'loaded',
    'alt:',
    alt.error ? 'not loaded' : `loaded from ${rootEnv}`
  );
}

console.log('DEBUG: MONGODB_URI present?', Boolean(process.env.MONGODB_URI));

// =======================
// 2. Imports (safe ones)
// =======================
import { detectSignalWithLlm } from '../src/detector';
import { saveSignalToDb } from '../src/persistence';

// =======================
// 3. DB helper
// =======================
async function waitForDbConnect(retries = 3, delayMs = 2000) {
  const { connectToDatabase, disconnectFromDatabase } = await import(
    '../../shared/src/db/connection'
  );

  let lastErr: any = null;

  for (let i = 0; i < retries; i++) {
    try {
      const conn = await connectToDatabase();
      return { conn, disconnectFromDatabase };
    } catch (err) {
      lastErr = err;
      console.warn(`connectToDatabase attempt ${i + 1} failed:`, err);
      if (i + 1 < retries) {
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastErr;
}

// =======================
// 4. Main runner
// =======================
(async () => {
  // ⚠️ khai báo ở scope ngoài
  let disconnectFromDatabase: (() => Promise<void>) | undefined;

  try {
    if (!process.env.MONGODB_URI) {
      throw new Error('MONGODB_URI is not set');
    }

    // ---- Connect DB
    const db = await waitForDbConnect(3, 2000);
    disconnectFromDatabase = db.disconnectFromDatabase;

    // ---- Import models AFTER DB connect
    const { tweetTable } = await import(
      '../../shared/src/db/schema/tweets'
    );

    // ---- Fetch tweets
    const tweets = await tweetTable
      .find()
      .sort({ tweetTime: -1 })
      .limit(10)
      .lean();

    const formattedTweets = tweets.map((t: any) => ({
      id: t._id?.toString?.() ?? String(t._id),
      text: t.content,
      author: t.authorId ?? t.author ?? 'unknown',
      time: t.tweetTime
        ? new Date(t.tweetTime).toISOString()
        : new Date().toISOString(),
      url: t.url || '',
    }));

    // ---- Known tokens (demo)
    const knownTokens = [
      {
        address: 'EPjF...',
        symbol: 'USDC',
        name: 'USD Coin',
      },
    ];

    // ---- Detect signal
    const result = await detectSignalWithLlm({
      formattedTweets,
      knownTokens,
    });

    console.log('Detection result:', result);

    // ---- Save if valid
    if (result.signalDetected) {
      await saveSignalToDb(result);
      console.log('Signal saved to DB');
    }

    // ---- Clean exit
    if (disconnectFromDatabase) {
      await disconnectFromDatabase();
    }

    process.exit(0);
  } catch (err) {
    console.error('Error in run-detection:', err);

    // ---- Always try to cleanup
    try {
      if (disconnectFromDatabase) {
        await disconnectFromDatabase();
      }
    } catch {
      // ignore cleanup errors
    }

    process.exit(1);
  }
})();
