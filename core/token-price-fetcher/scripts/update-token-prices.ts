// scripts/update-token-prices.ts
import "dotenv/config";
import { connectToDatabase } from "@gr2/shared";
import { TokenPriceService } from "../src/services/token-price-service.js";

async function main() {
  await connectToDatabase();
  await TokenPriceService.updatePrices();
  process.exit(0);
}

main();
