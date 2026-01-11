// import { connectToDatabase, disconnectFromDatabase, mongoose } from ".";
// import { initialTokens, mockSignal, mockTokenPrices, mockTweets, mockUser, mockUserBalances, staticProposals } from "../constants";
// import { logger } from "../utils";
// import { InterestRateInsert, interestRatesTable } from "./schema/interest_rates";
// import { NewsSiteInsert, newsSiteTable } from "./schema/news_sites";
// import { ProposalInsert, proposalTable } from "./schema/proposals";
// import { SignalInsert, signalsTable } from "./schema/signals";
// import { TokenInsert, tokensTable } from "./schema/tokens";
// import { TokenPriceInsert, tokenPricesTable } from "./schema/token_prices";
// import { TweetInsert, tweetTable } from "./schema/tweets";
// import { UserDocument, UserInsert, usersTable } from "./schema/users";
// import { xAccountTable } from "./schema/x_accounts";
// import { Types } from "mongoose";

// // Nếu muốn reset các collection trước khi seed, bật biến này
// const RESET_BEFORE_SEED = false;

// async function resetCollections() {
//   const collections = [
//     "users", "tokens", "proposals", "x_accounts",
//     "news_sites", "token_prices", "tweets",
//     "signals", "interest_rates"
//   ];
//   await connectToDatabase();
//   for (const name of collections) {
//     const db = mongoose.connection.db; 
//     await db!.collection(name).deleteMany({});
//     console.log(`Đã xóa collection: ${name}`);
//   }
// }

// const seedUsers = async (): Promise<UserDocument[]> => {
//   const usersData = [
//     {
//       name: "Nguyễn Văn A",
//       age: 30,
//       email: "nguyenvana@example.com",
//       tradeStyle: "conservative",
//       totalAssetUsd: 1_000_000,
//       cryptoInvestmentUsd: 100_000,
//       walletAddress: "Fgkki5sVbKpdLF28nvahDyrYeUQ5Cn7VJ8WTXHzLWEB5",
//       emailVerified: null,
//       riskTolerance: "medium",
//       notificationEnabled: false,
//       balances: [],
//     },
//     {
//       name: "Trần Thị B",
//       age: 25,
//       email: "tranthib@example.com",
//       tradeStyle: "moderate",
//       totalAssetUsd: 1_000_000,
//       cryptoInvestmentUsd: 100_000,
//       walletAddress: "6R57iMy4cxpMBWu6wNP8648HoTEbim8fDK2ZWFdYPJ5D",
//       emailVerified: null,
//       riskTolerance: "medium",
//       notificationEnabled: false,
//       balances: [],
//     },
//     {
//       name: "Lê Văn C",
//       age: 35,
//       email: "levanc@example.com",
//       tradeStyle: "aggressive",
//       totalAssetUsd: 1_000_000,
//       cryptoInvestmentUsd: 100_000,
//       walletAddress: "6yVF82TqGTwvix2tCGzxUhWGKkBB185sTU7A2bvACnF2",
//       emailVerified: null,
//       riskTolerance: "medium",
//       notificationEnabled: false,
//       balances: [],
//     },
//   ];

//   const generatedUsers: UserDocument[] = [];

//   for (const u of usersData) {
//     const existingUser = await usersTable.findOne({ email: u.email });
//     if (existingUser) {
//       console.log(`Người dùng "${u.name}" đã tồn tại. Bỏ qua.`);
//       generatedUsers.push(existingUser);
//     } else {
//       const user = new usersTable(u);
//       await user.save();
//       console.log(`Đã chèn người dùng: "${user.name}"`);
//       generatedUsers.push(user);
//     }
//   }

//   return generatedUsers;
// };

// const seedProposals = async (generatedUsers: UserDocument[]) => {
//   logger.debug("seedProposals", "Chuẩn bị chèn proposals...");

//   const allPotentialProposals: ProposalInsert[] = generatedUsers.flatMap(user =>
//     staticProposals.map(staticProposal => ({
//       ...staticProposal,
//       userId: user._id,
//     }))
//   );

//   if (!allPotentialProposals.length) return;

//   const existingProposals = await proposalTable.find({}, { title: 1, userId: 1 }).lean() as unknown as Array<{ title: string; userId: Types.ObjectId }>;

//   const existingSet = new Set(existingProposals.map(p => `${p.title}-${p.userId.toString()}`));

//   const proposalsToInsert = allPotentialProposals.filter(p => p.userId && !existingSet.has(`${p.title}-${p.userId.toString()}`));

//   if (!proposalsToInsert.length) {
//     logger.info("seedProposals", "Tất cả proposals đã tồn tại.");
//     return;
//   }

//   await proposalTable.insertMany(proposalsToInsert);

//   proposalsToInsert.forEach(p => {
//     const user = generatedUsers.find(u => u._id.toString() === p.userId?.toString());
//     console.log(`Đã chèn proposal "${p.title}" cho người dùng "${user?.name ?? "Unknown"}"`);
//   });
// };

// const seedMockUser = async (): Promise<UserDocument | null> => {
//   const existingUser = await usersTable.findOne({ email: mockUser.email });
//   if (existingUser) return existingUser;

//   const user = new usersTable({
//     ...mockUser,
//     balances: [],
//   });

//   await user.save();
//   console.log(`Đã chèn mock user "${mockUser.name}"`);
//   return user;
// };

// const seedMockUserBalances = async (userId: string) => {
//   const user = await usersTable.findById(userId);
//   if (!user) return;

//   user.balances = mockUserBalances.map(b => ({
//     tokenAddress: b.tokenAddress,
//     balance: b.balance,
//     updatedAt: b.updatedAt,
//   })) as any;

//   await user.save();
//   console.log(`Đã chèn ${mockUserBalances.length} mock user balances cho user ${userId}`);
// };

// const seedMockTokenPrices = async () => {
//   for (const price of mockTokenPrices) {
//     const existingPrice = await tokenPricesTable.findOne({ tokenAddress: price.tokenAddress });
//     if (!existingPrice) {
//       await tokenPricesTable.create(price);
//       console.log(`Đã chèn giá token mock cho ${price.tokenAddress}`);
//     }
//   }
// };

// const seedMockTweets = async () => {
//   for (const tweet of mockTweets) {
//     const existingTweet = await tweetTable.findOne({ url: tweet.url });
//     if (!existingTweet) {
//       await tweetTable.create(tweet);
//       console.log(`Đã chèn tweet ${tweet.url}`);
//     }
//   }
// };

// const seedMockSignal = async () => {
//   const existingSignal = await signalsTable.findOne({
//     tokenAddress: mockSignal.tokenAddress,
//     detectedAt: mockSignal.detectedAt,
//   });
//   if (!existingSignal) {
//     await signalsTable.create(mockSignal);
//     console.log(`Đã chèn mock signal cho token ${mockSignal.tokenAddress}`);
//   }
// };

// async function seed() {
//   await connectToDatabase();

//   if (RESET_BEFORE_SEED) await resetCollections();

//   const users = await seedUsers();
//   await seedProposals(users);

//   const mockUserDoc = await seedMockUser();
//   if (mockUserDoc) {
//     await seedMockUserBalances(mockUserDoc._id.toString());
//   }

//   await seedMockTokenPrices();
//   await seedMockTweets();
//   await seedMockSignal();

//   console.log("Seed dữ liệu hoàn tất!");
//   await disconnectFromDatabase();
// }

// seed().catch(err => {
//   console.error("Seed thất bại:", err);
// });
