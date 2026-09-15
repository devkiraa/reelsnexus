# ReelNexus Deployment Script for Windows
Write-Host "1. Ensuring you are logged in to Cloudflare..." -ForegroundColor Cyan
npx wrangler login

Write-Host "2. Skipping D1 creation since you already created cc481adb-aca6-4272-84b7-7e755229fb5a" -ForegroundColor Cyan

Write-Host "3. Running Remote Database Migrations..." -ForegroundColor Cyan
Set-Location "apps\worker"
npx wrangler d1 execute reelnexus_db --remote --file=.\migrations\0001_initial_schema.sql

Write-Host "4. Setting Worker Secrets (Optional)..." -ForegroundColor Cyan
Write-Host "Run these commands manually if you haven't set your secrets yet:"
Write-Host "npx wrangler secret put COLAB_API_KEY"
Write-Host "npx wrangler secret put GOOGLE_CLIENT_ID"
Write-Host "npx wrangler secret put GOOGLE_CLIENT_SECRET"

Write-Host "5. Deploying Worker..." -ForegroundColor Cyan
npm run deploy
Set-Location "..\.."

Write-Host "6. Deploying Dashboard..." -ForegroundColor Cyan
Set-Location "apps\dashboard"
npm run deploy
Set-Location "..\.."

Write-Host "Deployment complete!" -ForegroundColor Green
