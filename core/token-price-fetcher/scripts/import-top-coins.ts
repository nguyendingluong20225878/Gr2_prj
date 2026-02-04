// scripts/import-top-coins.ts
import "dotenv/config";
import { connectToDatabase } from "@gr2/shared";
import { TokenListService } from "../src/services/token-list-service.js";

async function main() {
  await connectToDatabase();
  await TokenListService.importTopCoins(100);
  process.exit(0);
}

main();
