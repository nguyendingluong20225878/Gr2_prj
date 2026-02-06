import {
  Logger,
  LogLevel,
  Tweet,
  xAccountTable,
  tweetTable,
  connectToDatabase,
  logProcessing,
  logSuccess,
  logFailed,
} from "@gr2/shared";
import { XAccount } from "../../shared/src/types/x-account";

const log = new Logger("XScaper");

let dbInitialized = false;
async function initDB() {
  if (!dbInitialized) {
    await connectToDatabase();
    dbInitialized = true;
  }
}

// =============================
//      LẤY DANH SÁCH ACCOUNT
// =============================
export const getAllXAccounts = async (): Promise<XAccount[]> => {
  await initDB();

  const docs = await xAccountTable.find().lean();//lean" để lấy plain JS object, js thuần 
  // khong co methods cua mongoose 

  return docs.map((d) => ({
    id: d._id,
    displayName: d.displayName ?? undefined,
    profileImageUrl: d.profileImageUrl ?? undefined,
    lastTweetUpdatedAt: d.lastTweetUpdatedAt ?? null,
  }));
};

// =============================
//          LƯU TWEETS
// =============================
export const saveTweets = async (
  accountId: string,
  tweets: Tweet[],
): Promise<Date | null> => {
  await initDB();

  if (!tweets.length) return null;

  try {
    await logProcessing(
      "X-Scraper",
      `Saving ${tweets.length} tweets from account ${accountId}...`,
      { accountId, tweetCount: tweets.length }
    );

    const tweetDocuments = tweets.map((t) => ({
      authorId: accountId,
      url: t.url,
      retweetCount: t.retweetCount ?? null,
      replyCount: t.replyCount ?? null,
      likeCount: t.likeCount ?? null,
      content: t.data,
      tweetTime: new Date(t.time),
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    await tweetTable.insertMany(tweetDocuments, { ordered: false }).catch(() => {});

    const newest = tweets
      .map((t) => new Date(t.time))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    if (newest) {
      const updateResult = await xAccountTable.updateOne(
  { _id: accountId }, // accountId PHẢI = _id trong x_accounts
  { $set: { lastTweetUpdatedAt: newest } }
);

console.log(
  "[DEBUG] update lastTweetUpdatedAt",
  { accountId, newest, matched: updateResult.matchedCount }
);

    }

    await logSuccess(
      "X-Scraper",
      `Successfully saved ${tweets.length} tweets`,
      { accountId, tweetCount: tweets.length, newestTweetTime: newest }
    );

    return newest ?? null;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await logFailed(
      "X-Scraper",
      `Failed to save tweets: ${errorMessage}`,
      { accountId, error: errorMessage }
    );
    throw error;
  }
};
