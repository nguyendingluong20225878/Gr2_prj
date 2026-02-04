import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  Model,
} from "mongoose";

const newsSiteSchema = new Schema(
  {
    url: { type: String, required: true, unique: true },
    title: { type: String },
    content: { type: String },
    userIds: {
      type: [Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    lastScraped: { type: Date },
  },
  {
    collection: "news_sites",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

export type NewsSiteSchema = InferSchemaType<typeof newsSiteSchema>;
export type NewsSiteDocument = HydratedDocument<NewsSiteSchema>;
export type NewsSiteSelect = NewsSiteDocument;
export type NewsSiteInsert = NewsSiteSchema;

export const newsSiteTable: Model<NewsSiteSchema> =
  (mongoose.models.NewsSite as Model<NewsSiteSchema>) ??
  mongoose.model<NewsSiteSchema>("NewsSite", newsSiteSchema);
