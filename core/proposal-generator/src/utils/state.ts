// Local lightweight type aliases to avoid importing shared runtime at build-time
type ProposalInsert = any;
type SignalSelect = any;
type TokenPriceSelect = any;
type TweetSelect = any;
type UserBalanceSelect = any;
type UserSelect = any;

import type { BaseMessage } from "@langchain/core/messages";
import { Annotation, MemorySaver, messagesStateReducer } from "@langchain/langgraph";

export const memory = new MemorySaver();

export const proposalGeneratorState = (Annotation as any).Root({
  // Mảng tin nhắn hội thoại
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),

  // Thông tin người dùng
  user: Annotation<UserSelect | null>({
    reducer: (oldValue: UserSelect | null, newValue: UserSelect | null) => newValue ?? oldValue,
    default: () => null,
  }),

  // Tín hiệu thị trường từ detector
  signal: Annotation<SignalSelect | null>({
    reducer: (oldValue: SignalSelect | null, newValue: SignalSelect | null) => newValue ?? oldValue,
    default: () => null,
  }),

  // Thông tin chi tiết Token (Name, Symbol) từ DB Tokens
  tokenDetail: Annotation<any | null>({
    reducer: (oldValue: any | null, newValue: any | null) => newValue ?? oldValue,
    default: () => null,
  }),

  // Giá thị trường của Token
  tokenPrices: Annotation<TokenPriceSelect[] | null>({
    reducer: (oldValue: TokenPriceSelect[] | null, newValue: TokenPriceSelect[] | null) => newValue ?? oldValue,
    default: () => null,
  }),

  // Các tweet liên quan để làm bằng chứng
  latestTweets: Annotation<TweetSelect[] | null>({
    reducer: (oldValue: TweetSelect[] | null, newValue: TweetSelect[] | null) => newValue ?? oldValue,
    default: () => null,
  }),

  // Số dư ví của người dùng đối với Token này
  userBalance: Annotation<UserBalanceSelect | null>({
    reducer: (oldValue: UserBalanceSelect | null, newValue: UserBalanceSelect | null) => newValue ?? oldValue,
    default: () => null,
  }),

  // Đối tượng đề xuất đầu tư cuối cùng
  proposal: Annotation<ProposalInsert | null>({
    reducer: (oldValue: ProposalInsert | null, newValue: ProposalInsert | null) => newValue ?? oldValue,
    default: () => null,
  }),
});