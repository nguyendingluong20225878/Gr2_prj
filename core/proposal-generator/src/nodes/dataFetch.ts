import { LangGraphRunnableConfig } from "@langchain/langgraph";
import { 
  fetchUser, 
  fetchTokenPrices, 
  fetchTweets, 
  fetchUserBalances 
} from "../utils/db"; 
import { proposalGeneratorState } from "../utils/state";

export const dataFetchNode = async (
  state: typeof proposalGeneratorState.State,
  options: LangGraphRunnableConfig,
) => {
  const userId = options.configurable?.userId;
  // Lấy tokenAddress từ signal (đã được lưu bởi signalValidationNode)
  const address = state.signal?.tokenAddress; 

  console.log(`[Data Fetch] Fetching data for User: ${userId}, Address: ${address}`);

  const [user, tokenPrices, latestTweets, userBalance] = await Promise.all([
    fetchUser(userId),
    fetchTokenPrices(address),
    fetchTweets(address),
    fetchUserBalances(userId)
  ]);

  // ĐẢM BẢO DỮ LIỆU LUÔN TỒN TẠI ĐỂ TRÁNH LỖI Ở NODE TIẾP THEO
  return {
    // Nếu không có user trong DB, tạo object giả với ID hiện tại
    user: user || { id: userId, username: "dev-user" },
    
    // Luôn trả về mảng (dù rỗng) cho tokenPrices và latestTweets
    tokenPrices: tokenPrices || [],
    latestTweets: latestTweets || [],
    
    // Nếu không có balance, trả về object mặc định với số dư bằng 0
    userBalance: userBalance || { 
      tokenAddress: address || "unknown", 
      balance: "0", 
      updatedAt: new Date() 
    },
  };
};