import dotenv from 'dotenv';

dotenv.config();

async function main() {
  try {
    // Dynamic import AFTER dotenv is loaded
    const { processXScraping } = await import('../src/process');

    const accountId = process.env.SCRAPE_ACCOUNT_ID;
    if (!accountId) {
      console.error('SCRAPE_ACCOUNT_ID not set in env');
      process.exit(2);
    }

    console.log(
      'DEBUG: MONGODB_URI present?',
      Boolean(process.env.MONGODB_URI)
    );

    const result = await processXScraping({
      specificAccountId: accountId,
    });

    console.log(result);
    process.exit(result?.success ? 0 : 1);
  } catch (err) {
    console.error('Error running scraper (single):', err);
    process.exit(1);
  }
}

main();
