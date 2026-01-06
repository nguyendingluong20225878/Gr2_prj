import { connectToDatabase, mongoose } from "../../../shared/src/db/connection";
import { signalsTable } from "../../../shared/src/db/schema/signals";
import { usersTable } from "../../../shared/src/db/schema/users"; 
import { tokenPricesTable } from "../../../shared/src/db/schema/token_prices";
import { tweetTable } from "../../../shared/src/db/schema/tweets";
// DÒNG 6: Đã sửa đường dẫn để khớp với cấu trúc src/db/schema/proposals.ts
import { getProposalModel } from "../../../shared/src/db/schema/proposals"; 

// Tắt buffering để nhận lỗi ngay lập tức nếu mất kết nối thay vì treo 10s
mongoose.set("bufferCommands", false);

export async function fetchLatestSignal() {
  await connectToDatabase();
  return await signalsTable.findOne().sort({ createdAt: -1 }).lean();
}

export async function fetchSignal(id: string) {
  if (!id) return null;
  await connectToDatabase();
  return await signalsTable.findById(id).lean();
}

export async function fetchUser(userIdOrUsername: string) {
  if (!userIdOrUsername) return null;
  await connectToDatabase();
  if (mongoose.Types.ObjectId.isValid(userIdOrUsername)) {
    return await usersTable.findById(userIdOrUsername).lean();
  } else {
    return await usersTable.findOne({ 
      $or: [{ username: userIdOrUsername }, { id: userIdOrUsername }] 
    }).lean();
  }
}

export async function fetchTokenPrices(tokenAddress: string) {
  if (!tokenAddress) return [];
  await connectToDatabase();
  const price = await tokenPricesTable.findOne({ tokenAddress }).lean();
  return price ? [price] : [];
}

export async function fetchTweets(tokenAddress: string) {
  if (!tokenAddress) return [];
  await connectToDatabase();
  return await tweetTable.find({ 
    content: { $regex: tokenAddress, $options: "i" } 
  }).sort({ tweetTime: -1 }).limit(10).lean();
}

export async function fetchUserBalances(userId: string) {
  if (!userId) return null;
  await connectToDatabase();
  const user: any = await fetchUser(userId);
  return user?.balances && user.balances.length > 0 ? user.balances[0] : null;
}

/**
 * Hàm lưu Proposal vào MongoDB
 */
export async function saveProposalToDb(proposalData: any) {
  // Đảm bảo đã gọi kết nối trước khi thực hiện thao tác ghi
  await connectToDatabase();
  
  // Kiểm tra trạng thái kết nối (1 = Connected) để tránh lỗi buffering timeout
  if (mongoose.connection.readyState !== 1) {
    throw new Error(`MongoDB chưa sẵn sàng. Trạng thái hiện tại: ${mongoose.connection.readyState}`);
  }

  try {
    const Proposal = getProposalModel();
    const proposal = new Proposal(proposalData);
    return await proposal.save();
  } catch (error) {
    console.error("Lỗi nghiêm trọng trong saveProposalToDb:", error);
    throw error;
  }
}