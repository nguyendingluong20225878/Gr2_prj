import { connectToDatabase } from "../../../shared/src/db/connection";
import { signalsTable } from "../../../shared/src/db/schema/signals";
import { usersTable } from "../../../shared/src/db/schema/users"; 
import { tokenPricesTable } from "../../../shared/src/db/schema/token_prices";
import { tweetTable } from "../../../shared/src/db/schema/tweets";
import { mongoose } from "../../../shared/src/db/connection";

/**
 * Lấy thông tin tín hiệu theo ID
 */
export async function fetchSignal(id: string) {
  if (!id) return null;
  await connectToDatabase();
  return await signalsTable.findById(id).lean();
}

/**
 * Lấy thông tin người dùng
 */
export async function fetchUser(userId: string) {
  if (!userId) return null;
  await connectToDatabase();
  return await usersTable.findById(userId).lean();
}

/**
 * Lấy giá token gần nhất
 */
export async function fetchTokenPrices(tokenAddress: string) {
  if (!tokenAddress) return [];
  await connectToDatabase();
  const price = await tokenPricesTable.findOne({ tokenAddress }).sort({ timestamp: -1 }).lean();
  return price ? [price] : [];
}

/**
 * Lấy các tweet liên quan đến token
 */
export async function fetchTweets(tokenAddress: string) {
  if (!tokenAddress) return [];
  await connectToDatabase();
  return await tweetTable.find({ 
    content: { $regex: tokenAddress, $options: "i" } 
  }).sort({ tweetTime: -1 }).limit(10).lean();
}