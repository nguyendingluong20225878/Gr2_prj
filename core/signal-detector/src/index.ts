// Public types
export type { KnownTokenType, LlmSignalResponse, Source } from "./types";

// Public schema and types
//export { LlmSignalResponseSchema, type LlmSignalResponseType } from "./schema";

// Model factory
//export { defaultSignalChatModel } from "./model";

// Prompt template and helpers
export { buildKnownTokensBlock, signalPromptTemplate } from "./prompt";

// Main detection function
export { detectSignalWithLlm } from "./detector";
export { detectSignalWithFinBertQuant } from "./detector";
export { computeStage2Signals } from "./stage2";
// Persistence helpers (optional): map and save to shared Mongo signals collection
export { mapLlmResponseToSignalInsert, saveSignalToDb } from "./persistence";

// End of public API
