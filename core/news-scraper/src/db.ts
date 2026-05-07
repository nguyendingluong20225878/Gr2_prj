import mongoose from "mongoose";
import { connectToDatabase as sharedConnect } from "@gr2/shared/db/connection";
import { newsSiteTable } from "@gr2/shared/db/schema/news_sites";
import { tokensTable } from "@gr2/shared/db/schema/tokens";
import { newsArticlesTable } from "@gr2/shared/db/schema/news_articles";

/**
 * Đảm bảo kết nối Singleton
 * Tránh việc mở hàng trăm kết nối ảo khi chạy mapLimit concurrency cao
 */
export async function connectToDatabase() {
  // 0: disconnected, 1: connected, 2: connecting, 3: disconnecting
  if (mongoose.connection.readyState === 1) {
    return;
  }
  await sharedConnect();
}

export async function loadNewsSites() {
  await connectToDatabase();
  return newsSiteTable.find().lean();
}

export async function loadTokens() {
  await connectToDatabase();
  return tokensTable.find().lean();
}

/**
 * Sử dụng cơ chế Upsert thông minh
 * - $set: Cập nhật các nội dung có thể thay đổi
 * - $setOnInsert: Chỉ ghi một lần duy nhất lúc tạo mới (để giữ nguyên scrapedAt lịch sử)
 */
export async function upsertNewsArticle(article: any) {
  await connectToDatabase();
  
  const { articleUrl, scrapedAt, siteUrl, ...updateFields } = article;

  return newsArticlesTable.updateOne(
    { articleUrl: articleUrl },
    { 
      $set: { 
        ...updateFields, 
        updatedAt: new Date() 
      },
      $setOnInsert: { 
        articleUrl: articleUrl,
        siteUrl: siteUrl,
        scrapedAt: scrapedAt || new Date(),
        createdAt: new Date() 
      } 
    },
    { upsert: true }
  );
}

export async function findExistingArticleUrls(urls: string[]): Promise<Set<string>> {
  await connectToDatabase();
  if (!urls.length) return new Set<string>();

  const existing = await newsArticlesTable
    .find({ articleUrl: { $in: urls } })
    .select({ articleUrl: 1 })
    .lean();

  return new Set(existing.map((d: any) => String(d.articleUrl)));
}

export async function updateNewsSiteContent(siteId: string, content: string) {
  await connectToDatabase();
  return newsSiteTable.updateOne(
    { _id: siteId },
    { $set: { lastScrapedContent: content, lastScrapedAt: new Date() } }
  );
}