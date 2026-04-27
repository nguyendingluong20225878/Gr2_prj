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

// Define Tweet interface locally if not fully exported from shared, or import it
interface Tweet {
  time: string;
  data: string;
  url: string;
  username?: string;
  replyCount?: number | null;
  retweetCount?: number | null;
  likeCount?: number | null;
}

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

  const docs = await xAccountTable.find().lean();

  return docs.map((d: any) => ({
    id: d._id,
    displayName: d.displayName ?? undefined,
    profileImageUrl: d.profileImageUrl ?? undefined,
    lastTweetUpdatedAt: d.lastTweetUpdatedAt ?? null,
  }));
};

// =============================
//          LƯU TWEETS
// =============================
// FIX: Thêm tham số followerCount để lưu vào xAccountTable
export const saveTweets = async (
  accountId: string,
  tweets: Tweet[],
  followerCount?: number | null
): Promise<Date | null> => {
  await initDB();

  if (!tweets.length) return null;

  try {
    await logProcessing("X-Scraper", `Saving ${tweets.length} tweets for ${accountId}`);

    // 1. Chuẩn bị documents
    const tweetDocuments = tweets.map((t) => {
      const idMatch = t.url.match(/\/status\/(\d+)/);
      return {
        tweetId: idMatch ? idMatch[1] : t.url,
        authorId: accountId,
        url: t.url,
        replyCount: t.replyCount ?? null,
        retweetCount: t.retweetCount ?? null, 
        likeCount: t.likeCount ?? null,
        content: t.data,
        tweetTime: new Date(t.time),
        isSignalGenerated: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    });

    // Bắt lỗi rành mạch để biết tại sao không vào DB:
   try {
      const result = await tweetTable.insertMany(tweetDocuments, { ordered: false });
      // Xử lý thông minh: Trả về số lượng tuỳ theo phiên bản Mongoose
      const insertedCount = Array.isArray(result) ? result.length : (result as any).insertedCount || 1;
      console.log(`[DB SUCCESS] Đã chèn mới thành công ${insertedCount} tweets vào MongoDB!`);
    } catch (err: any) {
      // Bắt chính xác lỗi BulkWrite (trùng lặp ID)
      if (err.code === 11000 || (err.writeErrors && err.writeErrors.some((e: any) => e.code === 11000))) {
        console.log(`[DB INFO] Hệ thống đã loại bỏ các bài bị trùng lặp (Duplicate Key) an toàn.`);
      } else {
        console.error(`[DB FATAL ERROR] Lỗi Mongoose:`, err.message);
      }
    }

    // 3. Cập nhật thời gian và Follower Count cho Account
    const newest = tweets
      .map((t) => new Date(t.time))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    const updateData: any = {};
    if (newest) updateData.lastTweetUpdatedAt = newest;
    if (followerCount !== undefined && followerCount !== null) {
      updateData.followerCount = followerCount; // <-- ĐÃ FIX: Cập nhật Follower để tính AuthorWeight
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