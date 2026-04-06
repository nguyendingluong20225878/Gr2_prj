import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const newsArticleSchema = new Schema(
  {
    siteUrl: { type: String, required: true, index: true },
    articleUrl: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "" },
    summary: { type: String, default: "" },
    content: { type: String, default: "" },
    publishedAt: { type: Date, default: null },
    detectedTokens: { type: [String], default: [], index: true },
    raw: { type: Schema.Types.Mixed, default: null },
    scrapedAt: { type: Date, required: true, default: Date.now, index: true },
  },
  {
    collection: "news_articles",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

newsArticleSchema.index({ siteUrl: 1, scrapedAt: -1 });

export type NewsArticleSchema = InferSchemaType<typeof newsArticleSchema>;
export type NewsArticleDocument = HydratedDocument<NewsArticleSchema>;
export type NewsArticleSelect = NewsArticleDocument;
export type NewsArticleInsert = NewsArticleSchema;

export const newsArticlesTable: Model<NewsArticleSchema> =
  (mongoose.models.NewsArticle as Model<NewsArticleSchema>) ??
  model<NewsArticleSchema>("NewsArticle", newsArticleSchema);
