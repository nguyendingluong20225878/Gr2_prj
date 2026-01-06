# Token Price Update Batch Job

A small batch job that periodically updates token prices stored in the database using the Jupiter price API.

## Features

- Fetch token prices from Jupiter API (`https://api.jup.ag/price/v2`).
- Persist latest prices and historical price records in MongoDB.
- Run periodically (default: every 10 minutes) or in one-time mode.
- Optionally fetch price for a specific token.

## Quickstart (local development)

### Quickstart (local development)

```bash
# One-time mode (update all token prices once)
pnpm run job:token-price

# CRON mode (background periodic execution)
pnpm run job:token-price:cron

# Fetch price for a specific token
cd apps/token-price-job
pnpm run dev -- --token=<TOKEN_ADDRESS>
```

### Per-package execution (inside the app directory)

```bash
# Change to directory
cd apps/token-price-job

# Install dependencies
pnpm install

# Development mode (one-time run)
pnpm run dev

# CRON mode (background periodic execution)
pnpm run dev:cron

# Fetch price for a specific token
pnpm run dev -- --token=<TOKEN_ADDRESS>
```

## Environment variables

### Environment variables

Create a `.env` file and set the following variables:

```
# MongoDB connection string (required for persistence)
MONGODB_URI="mongodb://localhost:27017/your-db"
PRICE_UPDATE_CRON="*/10 * * * *"
JUPITER_API_URL="https://api.jup.ag/price/v2"
```

- `MONGODB_URI`: MongoDB connection string (used to persist token prices and history)

- `PRICE_UPDATE_CRON`: Cron expression for periodic updates (default: `*/10 * * * *`).
- `JUPITER_API_URL`: Jupiter API endpoint for token prices.

## Deployment

### AWS Lambda

1. Create a Lambda function
2. Set environment variables
3. Prepare the deployment package:

```bash
pnpm build
cd dist
zip -r ../function.zip .
```

4. Configure a CloudWatch Events rule to schedule the function

### AWS ECS / Fargate

You can also run it as a container using a Dockerfile:

```bash
# Build image
docker build -t token-price-job .

# Run container (one-time)
docker run --env-file .env token-price-job

# Run container (CRON mode)
docker run --env-file .env token-price-job --cron
```

### Vercel Cron Jobs

To use Vercel Cron Jobs, add the following to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/update-token-prices",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

Then create a corresponding API endpoint in your Next.js application.
