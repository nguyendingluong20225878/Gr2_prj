import mongoose, {
  HydratedDocument,
  InferSchemaType,
  Model,
  Schema,
  model,
} from "mongoose";

//Các trạng thái : ưu thích rủi ro ,phòng thủ, căng thẳng, luân chuyển, hỗn hợp
const REGIME_TYPES = ["risk_on", "defensive", "stress", "rotation", "mixed"];

const rollingMetricSchema = new Schema(
  {
    tokenSymbol: { type: String, required: true, index: true },
    tokenAddress: { type: String, default: null, index: true },
    windowHours: { type: Number, required: true, index: true },// Số giờ của cửa sổ cuộn
    asOf: { type: Date, required: true, index: true },//Thời điểm tính toán DL
    returnPct: { type: Number, required: true, default: 0 },//% Lợi nhuận
    returnVol: { type: Number, required: true, default: 0 }, // Biến động lợi nhuận
    corrToBtc: { type: Number, required: true, default: 0 },//Hệ số tương quan với BTC
    betaToBtc: { type: Number, required: true, default: 0.75 },//Beta so với BTC
    corrToEth: { type: Number, required: false, default: null },//Hệ số tương quan với ETH
    sampleCount: { type: Number, required: true, default: 0 },//Số lượng mẫu trong cửa sổ cuộn
    marketRegime: {
      type: String,
      enum: REGIME_TYPES,
      required: true,
      default: "mixed",
      index: true,
    },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  {
    collection: "rolling_metrics",//ép mongo luwu tên 
    timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" },
  }
);

rollingMetricSchema.index(
  { tokenSymbol: 1, windowHours: 1, asOf: 1 },
  { unique: true }//ko có 2 bản ghi nào có cùng tokenSymbol, windowHours và asOf
);
rollingMetricSchema.index({ asOf: -1, windowHours: 1 });
rollingMetricSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });

export type MarketRegime = (typeof REGIME_TYPES)[number];
export type RollingMetricSchema = InferSchemaType<typeof rollingMetricSchema>;
export type RollingMetricDocument = HydratedDocument<RollingMetricSchema>;

export const rollingMetricsTable: Model<RollingMetricSchema> =
  (mongoose.models.RollingMetric as Model<RollingMetricSchema>) ??
  model<RollingMetricSchema>("RollingMetric", rollingMetricSchema);
