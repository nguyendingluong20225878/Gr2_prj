import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  model,
  Model,
} from "mongoose";

const sessionSchema = new Schema(
  {
    sessionToken: { type: String, required: true, unique: true },
    userId: { type: String, required: true, index: true },
    expires: { type: Date, required: true },
  },
  {
    collection: "sessions",
    timestamps: false,
  },
);

export type SessionSchema = InferSchemaType<typeof sessionSchema>;
export type SessionDocument = HydratedDocument<SessionSchema>;
export type SessionSelect = SessionDocument;
export type SessionInsert = SessionSchema;

export const sessionsTable: Model<SessionSchema> =
  (mongoose.models.Session as Model<SessionSchema>) ??
  model<SessionSchema>("Session", sessionSchema);
