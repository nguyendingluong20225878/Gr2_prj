import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { fetchUser, fetchTokenPrices, fetchTweets } from "../utils/db"; 
import { proposalGeneratorState } from "../utils/state";

export const dataFetchNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  // Lấy địa chỉ Token từ tín hiệu (Ví dụ: So11111111111111111111111111111111111111112)
  const signalTokenAddress = state.signal?.tokenAddress; 

  console.log(`[Data Fetch] Fetching data for User: ${userId}, Token Address: ${signalTokenAddress}`);

  // 1. Fetch User (Lấy toàn bộ object User bao gồm cả mảng balances)
  const user = await fetchUser(userId);
  
  // 2. Fetch dữ liệu thị trường song song
  const [tokenPrices, latestTweets] = await Promise.all([
    fetchTokenPrices(signalTokenAddress),
    fetchTweets(signalTokenAddress),
  ]);

  // 3. LOGIC MỚI: Trích xuất Balance từ mảng 'balances' bên trong User
  let currentBalanceVal = "0";
  
  if (user && Array.isArray(user.balances)) {
     console.log(`[Data Fetch] Found user wallet with ${user.balances.length} tokens.`);
     
     // Tìm token trùng khớp với tín hiệu
     const found = user.balances.find((b: any) => b.tokenAddress === signalTokenAddress);
     
     if (found) {
         currentBalanceVal = found.balance;
         console.log(`[Data Fetch] ✅ User holds ${currentBalanceVal} of this token.`);
     } else {
         console.log(`[Data Fetch] ⚠️ User does not hold this token.`);
     }
  } else {
      console.log(`[Data Fetch] User has no balance records.`);
  }

  // 4. Tạo object userBalance chuẩn để đưa vào Prompt cho AI
  const userBalanceObj = {
      tokenAddress: signalTokenAddress || "unknown",
      balance: currentBalanceVal,
      // Có thể thêm tổng tài sản để AI cân đối rủi ro
      totalAssetUsd: user?.totalAssetUsd || 0 
  };

  return {
    // Trả về user (nếu null thì fallback về object rỗng để tránh lỗi)
    user: user || { _id: userId, name: "Unknown User" },
    tokenPrices: tokenPrices || [],
    latestTweets: latestTweets || [],
    userBalance: userBalanceObj, // <--- Dữ liệu đã xử lý chính xác
  };
};