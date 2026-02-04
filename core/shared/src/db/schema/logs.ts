import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Schema,
  Model,
} from "mongoose";

const STATUS_TYPES = ["processing", "success", "failed"] as const;

const logSchema = new Schema(
  {
    step: { type: String, required: true, index: true },
    message: { type: String, required: true },
    status: {
      type: String,
      enum: STATUS_TYPES,
      required: true,
    },
    metadata: { type: Schema.Types.Mixed },
  },
  {
    collection: "logs",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  },
);

logSchema.index({ createdAt: -1 });

export type LogSchema = InferSchemaType<typeof logSchema>;
export type LogDocument = HydratedDocument<LogSchema>;
export type LogSelect = LogDocument;
export type LogInsert = LogSchema;

export const logsTable: Model<LogSchema> =
  (mongoose.models.Log as Model<LogSchema>) ??
  mongoose.model<LogSchema>("Log", logSchema);
