import dotenv from 'dotenv'

// Load .env ngay lập tức trước khi dùng process.env
dotenv.config()

async function main() {
  try {
    // Debug: kiểm tra biến môi trường
    console.log('DEBUG: MONGODB_URI present?', Boolean(process.env.MONGODB_URI))

    // Dynamic import BÊN TRONG async function (KHÔNG còn top-level await)
    const { processXScraping } = await import('../src/process')

    const result = await processXScraping()
    console.log(result)

    process.exit(result?.success ? 0 : 1)
  } catch (err) {
    console.error('Error running scraper:', err)
    process.exit(1)
  }
}

main()
