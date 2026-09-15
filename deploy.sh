#!/bin/bash
# ReelNexus Deployment Script

echo "1. Ensuring you are logged in to Cloudflare..."
npx wrangler login

echo "2. Creating D1 Database..."
npx wrangler d1 create reelnexus_db

echo ">>> IMPORTANT: Copy the database_id from the output above and paste it into apps/worker/wrangler.toml before continuing! <<<"
read -p "Press Enter to continue after updating wrangler.toml..."

echo "3. Running Remote Database Migrations..."
cd apps/worker
npx wrangler d1 execute reelnexus_db --remote --file=./migrations/0001_initial_schema.sql

echo "4. Setting Worker Secrets..."
npx wrangler secret put COLAB_API_KEY
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET

echo "5. Deploying Worker..."
npm run deploy
cd ../..

echo "6. Deploying Dashboard..."
cd apps/dashboard
npm run deploy
cd ../..

echo "Deployment complete!"
