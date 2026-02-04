import { TokenPriceService } from "./services/token-price-service.js";

//core function to run the token price update process
export async function processTokenPrices(options?: { specificTokenAddress?: string }): Promise<{
  success: boolean;
  message: string;
  data?: any;
}> {
  const tokenPriceService = new TokenPriceService();
  const startTime = new Date();

  try {
    console.log(`[${startTime.toISOString()}] Starting token price update process`);

    // If requesting price for a specific token
    if (options?.specificTokenAddress) {
      console.log(`Fetching price for token ${options.specificTokenAddress}`);
      const price = await tokenPriceService.getTokenPrice(options.specificTokenAddress);

      if (price) {
        return {
          success: true,
          message: `Successfully fetched price for token ${options.specificTokenAddress}`,
          data: { tokenAddress: options.specificTokenAddress, price },
        };
      } else {
        return {
          success: false,
          message: `Failed to fetch price for token ${options.specificTokenAddress}`,
        };
      }
    }

    // If updating prices for all tokens
    await tokenPriceService.updateAllTokenPrices();

    return {
      success: true,
      message: "All token prices updated successfully",
    }; 
  } catch (error) {
    console.error("Error occurred during processing:", error);
    return {
      success: false,
      message: "An error occurred during processing",
      data: { error: String(error) },
    };
  } finally {
    const endTime = new Date();
    const executionTime = endTime.getTime() - startTime.getTime();
    console.log(`[${endTime.toISOString()}] Processing complete (${executionTime}ms)`);
  }
}
