import "dotenv/config";
import { connectToDatabase, tokensTable } from "@gr2/shared";
// DANH SÁCH TOP TOKENS SOLANA (Hardcoded - Dùng khi mạng lỗi)
// Bao gồm: Native, Stablecoins, Top Ecosystem, Top Memes
const TOP_TOKENS = [
  {
    symbol: "SOL",
    name: "Wrapped SOL",
    address: "So11111111111111111111111111111111111111112",
    decimals: 9,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png"
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    address: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png"
  },
  {
    symbol: "USDT",
    name: "USDT",
    address: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.png"
  },
  {
    symbol: "JUP",
    name: "Jupiter",
    address: "JUPyiwrYJFskUPiHa7hkeR8VUtkqjsSr0amuo9sC99Q",
    decimals: 6,
    logoURI: "https://static.jup.ag/jup/icon.png"
  },
  {
    symbol: "BONK",
    name: "Bonk",
    address: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    logoURI: "https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I"
  },
  {
    symbol: "WIF",
    name: "dogwifhat",
    address: "EKpQGSJtjMFqKZ9KQanSqErztviXZt16Fkh41k614kJy",
    decimals: 6,
    logoURI: "https://static.jup.ag/tokens/WIF.png"
  },
  {
    symbol: "RAY",
    name: "Raydium",
    address: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
    decimals: 6,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R/logo.png"
  },
  {
    symbol: "RENDER",
    name: "Render Token",
    address: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof",
    decimals: 8,
    logoURI: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof/logo.png"
  },
  {
    symbol: "PYTH",
    name: "Pyth Network",
    address: "HZ1JovNiVvGrGNiiYvfX3JBCvfJzZYDVxh5gMszMM66q",
    decimals: 6,
    logoURI: "https://static.jup.ag/tokens/PYTH.png"
  },
  {
    symbol: "JTO",
    name: "Jito",
    address: "jtojtomePA8beP8AuQc6eKS59uyYPqK6aI8VqWf3HKq",
    decimals: 9,
    logoURI: "https://static.jup.ag/tokens/JTO.png"
  }
];

async function main() {
  console.log(" Đang kết nối tới MongoDB...");
  await connectToDatabase();

  console.log(` Đang sử dụng danh sách Offline (${TOP_TOKENS.length} tokens)...`);
  console.log(" Bắt đầu lưu vào Database...");

  const bulkOps = TOP_TOKENS.map((token) => ({
    updateOne: {
      filter: { address: token.address },
      update: {
        $set: {
          address: token.address,
          symbol: token.symbol,
          name: token.name,
          decimals: token.decimals,
          iconUrl: token.logoURI || "",
          type: "normal",
        },
      },
      upsert: true,
    },
  }));

  try {
    await tokensTable.bulkWrite(bulkOps as any);
    console.log(" Hoàn tất import danh sách Token (Offline Mode)!");
  } catch (error) {
    console.error(" Có lỗi xảy ra khi lưu DB:", error);
  }

  process.exit(0);
}

main();