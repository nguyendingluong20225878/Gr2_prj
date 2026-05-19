import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Model,
  Schema,
  model,
} from "mongoose";

const hyperparameterConfigSchema = new Schema(
  {
    name: { type: String, required: true, index: true },
    status: {
      type: String,
      enum: ["ACTIVE", "CANDIDATE", "ARCHIVED", "REJECTED"],
      required: true,
      index: true,
    },
    params: { type: Schema.Types.Mixed, required: true },
    metrics: { type: Schema.Types.Mixed, default: {} },
    trainWindow: {
      from: { type: Date, required: true },
      to: { type: Date, required: true },
    },
    validationWindow: {
      from: { type: Date, default: null },
      to: { type: Date, default: null },
    },
    promotedAt: { type: Date, default: null },
  },
  {
    collection: "hyperparameter_configs",
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

hyperparameterConfigSchema.index(
  { name: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "ACTIVE" },
  }
);

export type HyperparameterConfigSchema =
  InferSchemaType<typeof hyperparameterConfigSchema>;
export type HyperparameterConfigDocument =
  HydratedDocument<HyperparameterConfigSchema>;

export const hyperparameterConfigsTable: Model<HyperparameterConfigSchema> =
  (mongoose.models.HyperparameterConfig as Model<HyperparameterConfigSchema>) ??
  model<HyperparameterConfigSchema>(
    "HyperparameterConfig",
    hyperparameterConfigSchema
  );
