import { connectToDatabase } from "../../../shared/src/db/connection";
import { signalsTable } from "../../../shared/src/db/schema/signals";
import { usersTable } from "../../../shared/src/db/schema/users"; 
import { tokenPricesTable } from "../../../shared/src/db/schema/token_prices";
import { tweetTable } from "../../../shared/src/db/schema/tweets";
import { tokensTable } from "../../../shared/src/db/schema/tokens";
import { ProposalModel } from "../db/schema/proposals";

export async function fetchSignal(id: string) {
  if (!id) return null;
  await connectToDatabase();
  return await signalsTable.findById(id).lean();
}

export async function fetchUser(userId: string) {
  if (!userId) return null;
  await connectToDatabase();
  return await usersTable.findById(userId).lean();
}

export async function fetchTokenDetail(tokenAddress: string) {
  if (!tokenAddress) return null;
  await connectToDatabase();
  return await tokensTable.findOne({ address: tokenAddress }).lean();
}

export async function fetchTokenPrices(tokenAddress: string) {
  if (!tokenAddress) return [];
  await connectToDatabase();
  const price = await tokenPricesTable.findOne({ tokenAddress }).sort({ timestamp: -1 }).lean();
  return price ? [price] : [];
}

export async function fetchTweets(tokenAddress: string) {
  if (!tokenAddress) return [];
  await connectToDatabase();
  return await tweetTable.find({ 
    content: { $regex: tokenAddress, $options: "i" } 
  }).sort({ tweetTime: -1 }).limit(10).lean();
}

export async function saveProposalToDb(proposalData: any) {
  await connectToDatabase();
  // Sử dụng create để lưu trực tiếp object vào MongoDB qua Mongoose
  return await ProposalModel.create(proposalData);
}