import { Hono } from 'hono';

export type Env = {
  DB: D1Database;
  AI: any;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  COLAB_API_KEY: string;
};

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.json({ status: 'ok', service: 'ReelNexus Worker API is running!', docs: 'See /api endpoints.' }));

// --- Helper Functions ---

async function getTrendingKeywords(niche: string): Promise<string[]> {
  try {
    const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(niche)}`);
    if (!response.ok) return [];
    const data = await response.json();
    if (Array.isArray(data) && data.length > 1 && Array.isArray(data[1])) {
      return data[1].slice(0, 5);
    }
    return [];
  } catch (e) {
    return [];
  }
}

async function generateVisionMetadata(env: Env, imageBase64: string, niche: string, trendingKeywords: string[]) {
  const prompt = `Analyze this video frame. Live trending search terms: ${JSON.stringify(trendingKeywords)}.

Generate YouTube Shorts metadata formatted strictly as JSON with keys:
* "title": Curiosity-hook title under 50 characters ending with #Shorts.
* "hook": 1-sentence pattern-interrupt text for the first 2 seconds.
* "loop_line": Closing sentence engineered for seamless looping.
* "description": 2 sentences with high-density search terms.
* "tags": Array of 4-6 hashtags.`;

  const binaryString = atob(imageBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const imageArray = [...bytes];

  try {
    const aiRes: any = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
      prompt,
      image: imageArray,
      max_tokens: 512
    });
    
    const content = aiRes?.response || '{}';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (e) {
    console.error('Metadata generation failed:', e);
    return null;
  }
}

// --- Auth & OAuth Endpoints ---

app.post('/api/auth/login', async (c) => {
  return c.json({ message: 'Login endpoint' });
});

app.get('/api/auth/youtube/connect', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({
      error: "GCP_NOT_CONFIGURED",
      message: "YouTube OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your worker secrets."
    }, 400);
  }

  const channelId = c.req.query('channel_id');
  if (!channelId) return c.json({ error: 'Missing channel_id' }, 400);

  const redirectUri = new URL('/api/auth/youtube/callback', c.req.url).toString();
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.readonly'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  authUrl.searchParams.set('state', channelId);

  return c.redirect(authUrl.toString());
});

app.get('/api/auth/youtube/callback', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({
      error: "GCP_NOT_CONFIGURED",
      message: "YouTube OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your worker secrets."
    }, 400);
  }

  const code = c.req.query('code');
  const channelId = c.req.query('state');
  const error = c.req.query('error');

  if (error || !code || !channelId) {
    return c.redirect('http://localhost:3000/channels?error=oauth_failed');
  }

  const redirectUri = new URL('/api/auth/youtube/callback', c.req.url).toString();

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) {
      throw new Error(await tokenResponse.text());
    }

    const data: any = await tokenResponse.json();
    
    if (data.refresh_token) {
      await c.env.DB.prepare(`UPDATE channels SET youtube_refresh_token = ? WHERE id = ?`)
        .bind(data.refresh_token, channelId)
        .run();
    }
    
    return c.redirect('http://localhost:3000/channels?success=true');
  } catch (e) {
    console.error('OAuth token exchange failed:', e);
    return c.redirect('http://localhost:3000/channels?error=token_exchange_failed');
  }
});

// --- Channel Endpoints ---

app.get('/api/channels', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM channels').all();
  return c.json(results);
});

app.post('/api/channels', async (c) => {
  const body = await c.req.json();
  const id = crypto.randomUUID();
  
  await c.env.DB.prepare(
    `INSERT INTO channels (id, channel_name, niche, watermark_url, target_drive_folder_id) 
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, body.channel_name, body.niche, body.watermark_url, body.target_drive_folder_id).run();
  
  return c.json({ id, ...body }, 201);
});

app.post('/api/channels/:id/token', async (c) => {
  const colabKey = c.req.header('X-Colab-Key');
  if (colabKey !== c.env.COLAB_API_KEY) return c.json({ error: 'Unauthorized' }, 401);
  
  const id = c.req.param('id');
  const { access_token, refresh_token } = await c.req.json();
  
  if (refresh_token) {
    await c.env.DB.prepare(`UPDATE channels SET youtube_refresh_token = ? WHERE id = ?`).bind(refresh_token, id).run();
  }
  return c.json({ success: true });
});

app.get('/api/channels/:id/scheduled', async (c) => {
  const colabKey = c.req.header('X-Colab-Key');
  if (colabKey !== c.env.COLAB_API_KEY) return c.json({ error: 'Unauthorized' }, 401);
  const id = c.req.param('id');
  // Returns number of uploads in last 24h, and the latest scheduled post time for 4-hour spacing
  const { results: recentJobs } = await c.env.DB.prepare(
    `SELECT youtube_scheduled_publish_utc FROM render_jobs 
     WHERE channel_id = ? AND status IN ('PUBLISHED', 'SCHEDULED')
     ORDER BY created_at DESC LIMIT 10`
  ).bind(id).all();

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  
  let uploadsLast24h = 0;
  let latestScheduled = now;

  for (const job of recentJobs) {
    if (job.youtube_scheduled_publish_utc) {
      const scheduledTime = new Date(job.youtube_scheduled_publish_utc as string).getTime();
      if (scheduledTime > latestScheduled) {
        latestScheduled = scheduledTime;
      }
      if (scheduledTime > oneDayAgo && scheduledTime < now + (24 * 60 * 60 * 1000)) {
         // rough approximation of 24h quota usage 
         uploadsLast24h++;
      }
    }
  }

  return c.json({ 
    uploads_last_24h: uploadsLast24h, 
    latest_scheduled_utc: new Date(latestScheduled).toISOString() 
  });
});

// --- Jobs Endpoints ---

app.get('/api/jobs', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM render_jobs ORDER BY created_at DESC').all();
  return c.json(results);
});

// Colab Worker Endpoints

app.post('/api/jobs/claim', async (c) => {
  const colabKey = c.req.header('X-Colab-Key');
  if (colabKey !== c.env.COLAB_API_KEY) return c.json({ error: 'Unauthorized' }, 401);
  
  const job = await c.env.DB.prepare(
    `SELECT * FROM render_jobs WHERE status = 'PENDING' LIMIT 1`
  ).first();

  if (!job) return c.json({ message: 'No pending jobs' }, 404);
  
  const channel = await c.env.DB.prepare(`SELECT * FROM channels WHERE id = ?`).bind(job.channel_id).first();
  const jobData: Record<string, any> = { ...job, youtube_token_data: null, channel_niche: channel?.niche || 'entertainment', target_drive_folder_id: channel?.target_drive_folder_id || null };
  
  if (channel && channel.youtube_refresh_token) {
    jobData.youtube_token_data = {
       refresh_token: channel.youtube_refresh_token,
       client_id: c.env.GOOGLE_CLIENT_ID,
       client_secret: c.env.GOOGLE_CLIENT_SECRET,
       channel_id: channel.id
    };
  }

  await c.env.DB.prepare(`UPDATE render_jobs SET status = 'PROCESSING' WHERE id = ?`).bind(job.id).run();
  return c.json(jobData);
});

app.post('/api/jobs/complete', async (c) => {
  const colabKey = c.req.header('X-Colab-Key');
  if (colabKey !== c.env.COLAB_API_KEY) return c.json({ error: 'Unauthorized' }, 401);
  
  const body = await c.req.json();
  const jobId = body.job_id;
  const newStatus = body.status || 'READY_TO_POST';
  const imageBase64 = body.keyframe_base64;
  const niche = body.niche || 'general';
  const youtubeVideoId = body.youtube_video_id;
  const publishUtc = body.youtube_scheduled_publish_utc;

  let aiTitle = "Generated Hook Title 🔥";
  let aiDescription = "Generated engaging SEO description for Shorts.";
  let aiTags = "shorts,viral,trending";

  if (imageBase64) {
    const keywords = await getTrendingKeywords(niche);
    const meta = await generateVisionMetadata(c.env, imageBase64, niche, keywords);
    
    if (meta) {
      aiTitle = meta.title || aiTitle;
      aiDescription = meta.description || aiDescription;
      aiTags = Array.isArray(meta.tags) ? meta.tags.join(',') : (meta.tags || aiTags);
    }
  }
  
  await c.env.DB.prepare(
    `UPDATE render_jobs SET 
      status = ?, 
      ai_title = ?, 
      ai_description = ?, 
      ai_tags = ?,
      youtube_video_id = ?,
      youtube_scheduled_publish_utc = ?
    WHERE id = ?`
  ).bind(newStatus, aiTitle, aiDescription, aiTags, youtubeVideoId || null, publishUtc || null, jobId).run();

  return c.json({ message: 'Job complete', id: jobId });
});

export default {
  fetch: app.fetch
};
