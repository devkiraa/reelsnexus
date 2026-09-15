# ReelNexus

Autonomous Multi-Channel YouTube Shorts Pipeline.

## Deployment Pipeline (Cloudflare Native)

This project has been fully migrated to use Cloudflare Workers AI for automated metadata generation, and Cloudflare Pages for the frontend dashboard. 

### Quick Start Deployment
Run the root deployment script to provision your database and ship the apps:
```bash
./deploy.sh
```

### Manual Deployment Steps
If you prefer to deploy manually, follow these steps:

1. **Log into Cloudflare:**
   ```bash
   npx wrangler login
   ```

2. **Create the D1 Database:**
   ```bash
   npx wrangler d1 create reelnexus_db
   ```
   *Copy the `database_id` from the output and paste it into `apps/worker/wrangler.toml`.*

3. **Run Remote Database Migrations:**
   ```bash
   cd apps/worker
   npx wrangler d1 execute reelnexus_db --remote --file=./migrations/0001_initial_schema.sql
   ```

4. **Set Worker Secrets:**
   ```bash
   npx wrangler secret put COLAB_API_KEY
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```
   *(Note: GCP credentials are now optional to boot, but required for the YouTube API OAuth flow to work)*

5. **Deploy the Edge Worker:**
   ```bash
   npm run deploy
   ```
   *Note your live Worker URL (e.g., `https://reelnexus-worker.<subdomain>.workers.dev`)*

6. **Deploy the Dashboard (Pages):**
   ```bash
   cd ../dashboard
   npm run deploy
   ```

## Local Development

1. **Worker:** `cd apps/worker && npm run dev`
2. **Dashboard:** `cd apps/dashboard && npm run dev`

## Colab Pipeline

Open `colab/colab_worker.py` (or the equivalent `.ipynb` notebook) in Google Colab, connect to a T4 GPU runtime, and run it to start polling the Cloudflare Worker for processing jobs.
