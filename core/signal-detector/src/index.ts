// Public types
export type { KnownTokenType, QuantSignalResponse, Source } from "./types";


// Model factory
//export { defaultSignalChatModel } from "./model";

// Prompt template and helpers
export { buildKnownTokensBlock, signalPromptTemplate } from "./prompt";

// Main detection function
// export { detectSignalWithLlm } from "./quant-engine";
export { detectSignalWithFinBertQuant } from "./quant-engine";
// export { computeStage2Signals } from "./twitter-aggregator";
// Persistence helpers (optional): map and save to shared Mongo signals collection
export { mapQuantToMongoInsert, saveSignalToDb } from "./db-mapper";

// End of public API
