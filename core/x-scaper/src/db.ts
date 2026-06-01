import {
  Logger,
  xAccountTable,
  tweetTable,
  connectToDatabase,
  logProcessing,
  logSuccess,
  logFailed,
} from "@gr2/shared";
import { XAccount } from "../../shared/src/types/x-account";

// FIX 1: Cập nhật Data Contract để đón dữ liệu Retweet từ Scraper
interface Tweet {
  time: string;
  data: string;
  url: string;
  username?: string;
  replyCount?: number | null;
  retweetCount?: number | null;
  likeCount?: number | null;
  isRetweet?: boolean;
  originalUsername?: string;
}

const log = new Logger("XScaper");

let dbInitialized = false;
async function initDB() {
  if (!dbInitialized) {
    await connectToDatabase();
    dbInitialized = true;
  }
}

export const getAllXAccounts = async (): Promise<XAccount[]> => {
  await initDB();
  const docs = await xAccountTable.find().lean();
  return docs.map((d: any) => ({
    id: d._id,
    displayName: d.displayName ?? undefined,
    profileImageUrl: d.profileImageUrl ?? undefined,
    lastTweetUpdatedAt: d.lastTweetUpdatedAt ?? null,
  }));
};

export const saveTweets = async (
  accountId: string,
  tweets: Tweet[],
  followerCount?: number | null
): Promise<Date | null> => {
  await initDB();
  if (!tweets.length) return null;

  try {
    await logProcessing("X-Scraper", `Saving ${tweets.length} tweets for ${accountId}`);

    const tweetDocuments = tweets.map((t) => {
      const rawId = t.url.split("/status/")[1];
      const cleanTweetId = rawId ? rawId.split("?")[0] : t.url;

      return {
        tweetId: cleanTweetId,
        authorId: accountId, // Vẫn là account mục tiêu (timeline)
        
        // FIX 1: Lưu trữ cờ Retweet và Author gốc để Quant phân tích Sentiment
        isRetweet: t.isRetweet || false,
        originalAuthorUsername: t.originalUsername || accountId, 
        
        url: t.url,
        replyCount: t.replyCount ?? 0,
        retweetCount: t.retweetCount ?? 0, 
        likeCount: t.likeCount ?? 0,
        content: t.data,
        tweetTime: new Date(t.time), // Bug 2 đã được chặn từ tầng Scraper, Date ở đây đảm bảo 100% hợp lệ
        isSignalGenerated: false,
      };
    });

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
        console.log(`[DB INFO] Duplicate Key: Đã lưu ${inserted} bài viết mới, hệ thống tự động bỏ qua các bài cũ.`);
      } else {
        console.error(`[DB FATAL ERROR] Lỗi Mongoose:`, err.message);
        throw err;
      }
    }

    if (!persistenceOk) return null;

    const newest = tweets
      .map((t) => new Date(t.time))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const updateData: any = {};
    if (newest) updateData.lastTweetUpdatedAt = newest;
    if (followerCount !== undefined && followerCount !== null) {
      updateData.followerCount = followerCount; 
    }

    if (Object.keys(updateData).length > 0) {
      await xAccountTable.updateOne(
        { _id: accountId },
        { $set: updateData }
      );
    }

    await logSuccess("X-Scraper", `Successfully saved tweets for ${accountId}`);
    return newest ?? null;
  } catch (error: any) {
    console.error("[DB] Lỗi tổng thể khi saveTweets:", error.message);
    await logFailed("X-Scraper", `Error saving tweets for ${accountId}: ${error.message}`);
    return null;
  }
};
