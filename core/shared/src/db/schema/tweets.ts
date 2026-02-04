import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const tweetSchema = new Schema(
  {
    authorId: { type: String, ref: "XAccount", required: true, index: true },
    url: { type: String, required: true },
    content: { type: String, required: true },
    retweetCount: { type: Number, default: null },
    replyCount: { type: Number, default: null },
    likeCount: { type: Number, default: null },
    tweetTime: { type: Date, required: true },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    collection: "tweets",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

tweetSchema.index({ tweetTime: -1 });

export type TweetSchema = InferSchemaType<typeof tweetSchema>;
export type TweetDocument = HydratedDocument<TweetSchema>;
export type TweetSelect = TweetSchema;
export type TweetInsert = TweetSchema;

export const tweetTable: Model<TweetSchema> =
  (mongoose.models.Tweet as Model<TweetSchema>) ??
  model<TweetSchema>("Tweet", tweetSchema);
