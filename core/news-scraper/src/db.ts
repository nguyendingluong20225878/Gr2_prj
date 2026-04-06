import { connectToDatabase } from "../../shared/src/db/connection.js";
import { newsSiteTable } from "../../shared/src/db/schema/news_sites.js";
import { tokensTable } from "../../shared/src/db/schema/tokens.js";
import { newsArticlesTable } from "../../shared/src/db/schema/news_articles.js";

export async function loadNewsSites() {
  await connectToDatabase();
  return newsSiteTable.find().lean();
}

export async function loadTokens() {
  await connectToDatabase();
  return tokensTable.find().lean();
}

export async function upsertNewsArticle(article: any) {
  await connectToDatabase();
  return newsArticlesTable.updateOne(
    { articleUrl: article.articleUrl },
    { $set: article },
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
  await newsSiteTable.updateOne(
    { _id: siteId as any },
    { $set: { content, lastScraped: new Date() } }
  );
}