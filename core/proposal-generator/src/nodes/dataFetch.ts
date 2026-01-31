import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { fetchUser, fetchTokenPrices, fetchTweets, fetchTokenDetail } from "../utils/db"; 
import { proposalGeneratorState } from "../utils/state";

export const dataFetchNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  // Lấy address từ signal
  const signalTokenAddress = state.signal?.tokenAddress; 

  console.log(`[Data Fetch] Fetching for Token Address: ${signalTokenAddress}`);

  // 1. Lấy thông tin User và Token Detail
  const [user, tokenDetail] = await Promise.all([
    fetchUser(userId),
    fetchTokenDetail(signalTokenAddress)
  ]);
  
  // 2. Lấy giá và tweets
  // fetchTokenPrices sẽ trả về array chứa object { priceUsd: "168.48", ... }
  const [tokenPrices, latestTweets] = await Promise.all([
    fetchTokenPrices(signalTokenAddress),
    fetchTweets(signalTokenAddress),
  ]);

  // 3. Trích xuất Balance
  let currentBalanceVal = "0";
  if (user && Array.isArray(user.balances)) {
     const found = user.balances.find((b: any) => b.tokenAddress === signalTokenAddress);
     if (found) {
         currentBalanceVal = found.balance;
         console.log(`[Data Fetch] ✅ User holds ${currentBalanceVal} ${tokenDetail?.symbol || 'Tokens'}`);
     } else {
         console.log(`[Data Fetch] ⚠️ User holds 0 ${tokenDetail?.symbol || 'Tokens'}`);
     }
  }

  // 4. Đóng gói dữ liệu balance
  const userBalanceObj = {
      tokenAddress: signalTokenAddress || "unknown",
      balance: currentBalanceVal, // Vẫn giữ string để xử lý sau
      totalAssetUsd: user?.totalAssetUsd || 0 
  };

  return {
    user: user || { _id: userId, name: "Unknown User" },
    tokenPrices: tokenPrices || [], // Đảm bảo luôn trả về mảng
    latestTweets: latestTweets || [],
    userBalance: userBalanceObj,
    tokenDetail: tokenDetail || { symbol: "Unknown", name: "Unknown Token", address: signalTokenAddress }
  };
};