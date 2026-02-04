import mongoose, { InferSchemaType, Schema, model, Model } from "mongoose";

const xAccountSchema = new Schema(
  {
    _id: { type: String, required: true },
    displayName: String,
    profileImageUrl: String,
    lastTweetUpdatedAt: { type: Date, default: null },
    userIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
  },
  {
    collection: "x_accounts",
    timestamps: true,
  }
);

xAccountSchema.index({ lastTweetUpdatedAt: -1 });

export type XAccountSchema = InferSchemaType<typeof xAccountSchema>;
export type XAccountInsert = XAccountSchema;

export const xAccountTable: Model<XAccountSchema> =
  (mongoose.models.XAccount as Model<XAccountSchema>) ??
  model<XAccountSchema>("XAccount", xAccountSchema);
