import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { fetchUser, fetchTokenPrices, fetchTweets, fetchTokenDetail } from "../utils/db"; 
import { proposalGeneratorState } from "../utils/state";

export const dataFetchNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  const signalTokenAddress = state.signal?.tokenAddress; 

  console.log(`[Data Fetch] Fetching for Token: ${signalTokenAddress}`);

  // 1. Lấy thông tin User và Token Detail đồng thời
  const [user, tokenDetail] = await Promise.all([
    fetchUser(userId),
    fetchTokenDetail(signalTokenAddress)
  ]);
  
  // 2. Lấy giá và tweets
  const [tokenPrices, latestTweets] = await Promise.all([
    fetchTokenPrices(signalTokenAddress),
    fetchTweets(signalTokenAddress),
  ]);

  // 3. Trích xuất Balance dựa trên Schema balances mới
  let currentBalanceVal = "0";
  if (user && Array.isArray(user.balances)) {
     const found = user.balances.find((b: any) => b.tokenAddress === signalTokenAddress);
     if (found) {
         currentBalanceVal = found.balance;
         console.log(`[Data Fetch] ✅ User holds ${currentBalanceVal} ${tokenDetail?.symbol || ''}`);
     }
  }

  const userBalanceObj = {
      tokenAddress: signalTokenAddress || "unknown",
      balance: currentBalanceVal,
      totalAssetUsd: user?.totalAssetUsd || 0 
  };

  return {
    user: user || { _id: userId, name: "Unknown User" },
    tokenPrices: tokenPrices || [],
    latestTweets: latestTweets || [],
    userBalance: userBalanceObj,
    tokenDetail: tokenDetail || { symbol: "Unknown", name: "Unknown Token" }
  };
};