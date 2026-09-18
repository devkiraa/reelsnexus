import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { File } from 'megajs';

export type Env = {
  DB: D1Database;
  AI: any;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  COLAB_API_KEY: string;
  FRONTEND_URL: string;
};

const app = new Hono<{ Bindings: Env }>();

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Colab-Key'],
}));

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

  const frontendUrl = c.env.FRONTEND_URL || 'https://reelnexus-dashboard.pages.dev';

  if (error || !code || !channelId) {
    return c.redirect(`${frontendUrl}/?error=oauth_failed`);
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
    
    return c.redirect(`${frontendUrl}/?success=true&access_token=${data.access_token}&refresh_token=${data.refresh_token}`);
  } catch (e) {
    console.error('OAuth token exchange failed:', e);
    return c.redirect(`${frontendUrl}/?error=token_exchange_failed`);
  }
});

app.get('/api/auth/drive/connect', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "GCP_NOT_CONFIGURED" }, 400);
  }

  const redirectUri = new URL('/api/auth/drive/callback', c.req.url).toString();
  const scopes = [
    'https://www.googleapis.com/auth/drive'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');

  return c.redirect(authUrl.toString());
});

app.get('/api/auth/drive/callback', async (c) => {
  const code = c.req.query('code');
  const error = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL || 'https://reelnexus-dashboard.pages.dev';

  if (error || !code) {
    return c.redirect(`${frontendUrl}/ingest?error=drive_oauth_failed`);
  }

  const redirectUri = new URL('/api/auth/drive/callback', c.req.url).toString();

  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: c.env.GOOGLE_CLIENT_ID || '',
        client_secret: c.env.GOOGLE_CLIENT_SECRET || '',
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri
      }).toString()
    });

    if (!tokenResponse.ok) throw new Error(await tokenResponse.text());
    const data: any = await tokenResponse.json();
    
    if (data.refresh_token) {
      await c.env.DB.prepare(
        `INSERT INTO global_settings (key, value) VALUES ('master_drive_refresh_token', ?) 
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(data.refresh_token).run();
    }
    
    return c.redirect(`${frontendUrl}/ingest?success=drive_connected`);
  } catch (e) {
    console.error('Drive OAuth failed:', e);
    return c.redirect(`${frontendUrl}/ingest?error=drive_token_exchange_failed`);
  }
});

// --- Settings & Master Drive Endpoints ---

app.get('/api/drive/proxy-thumbnail', async (c) => {
  const url = c.req.query('url');
  if (!url) return c.body(null, 400);
  
  const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (!setting || !setting.value) return c.body(null, 401);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID || '',
      client_secret: c.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: setting.value as string,
      grant_type: 'refresh_token'
    }).toString()
  });
  const tokenData: any = await tokenResponse.json();
  if (!tokenData.access_token) return c.body(null, 401);

  const imgRes = await fetch(url, { headers: { Authorization: `Bearer ${tokenData.access_token}` } });
  return new Response(imgRes.body, {
    headers: { 'Content-Type': imgRes.headers.get('Content-Type') || 'image/jpeg' }
  });
});

app.get('/api/drive/proxy-video', async (c) => {
  const fileId = c.req.query('fileId');
  if (!fileId) return c.body(null, 400);
  
  const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (!setting || !setting.value) return c.body(null, 401);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID || '',
      client_secret: c.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: setting.value as string,
      grant_type: 'refresh_token'
    }).toString()
  });
  const tokenData: any = await tokenResponse.json();
  if (!tokenData.access_token) return c.body(null, 401);

  // We need to pass through Range headers for proper video seeking and playback
  const headers: Record<string, string> = { Authorization: `Bearer ${tokenData.access_token}` };
  const range = c.req.header('Range');
  if (range) headers['Range'] = range;

  const videoRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, { headers });
  
  const responseHeaders = new Headers();
  responseHeaders.set('Content-Type', videoRes.headers.get('Content-Type') || 'video/mp4');
  responseHeaders.set('Accept-Ranges', 'bytes');
  
  const contentLength = videoRes.headers.get('Content-Length');
  if (contentLength) responseHeaders.set('Content-Length', contentLength);
  
  const contentRange = videoRes.headers.get('Content-Range');
  if (contentRange) responseHeaders.set('Content-Range', contentRange);

  return new Response(videoRes.body, {
    status: videoRes.status,
    headers: responseHeaders
  });
});

app.get('/api/settings', async (c) => {
  const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  return c.json({ has_master_drive: !!setting });
});

app.get('/api/drive/folders', async (c) => {
  const parentId = c.req.query('parentId') || 'root';
  
  const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (!setting || !setting.value) return c.json({ error: 'Master Drive not connected' }, 401);

  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.env.GOOGLE_CLIENT_ID || '',
      client_secret: c.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: setting.value as string,
      grant_type: 'refresh_token'
    }).toString()
  });
  const tokenData: any = await tokenResponse.json();
  if (!tokenData.access_token) return c.json({ error: 'Failed to refresh Master Drive token' }, 401);

  const q = `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name`, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` }
  });
  
  const driveData: any = await driveRes.json();
  return c.json(driveData.files || []);
});

// --- Channel Endpoints ---

app.get('/api/channels', async (c) => {
  const { results } = await c.env.DB.prepare('SELECT * FROM channels ORDER BY created_at DESC').all();
  return c.json(results);
});

app.put('/api/channels/:id/watermark', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  await c.env.DB.prepare(
    `UPDATE channels SET 
      watermark_type = ?, 
      watermark_text = ?, 
      watermark_x = ?, 
      watermark_y = ?, 
      watermark_font_size = ?, 
      watermark_font_color = ?, 
      watermark_bg_enabled = ?, 
      watermark_bg_color = ?, 
      watermark_bg_opacity = ?, 
      watermark_opacity = ?,
      watermark_font_family = ?,
      watermark_border_radius = ?,
      watermark_padding = ?
    WHERE id = ?`
  ).bind(
    body.watermark_type || 'text',
    body.watermark_text || '',
    body.watermark_x !== undefined ? body.watermark_x : 0.065,
    body.watermark_y !== undefined ? body.watermark_y : 0.145,
    body.watermark_font_size !== undefined ? body.watermark_font_size : 36,
    body.watermark_font_color || '#FFFFFF',
    body.watermark_bg_enabled ? 1 : 0,
    body.watermark_bg_color || '#000000',
    body.watermark_bg_opacity !== undefined ? body.watermark_bg_opacity : 0.40,
    body.watermark_opacity !== undefined ? body.watermark_opacity : 0.85,
    body.watermark_font_family || 'Inter',
    body.watermark_border_radius !== undefined ? body.watermark_border_radius : 4,
    body.watermark_padding !== undefined ? body.watermark_padding : 4,
    id
  ).run();
  
  return c.json({ success: true });
});

app.put('/api/channels/:id/settings', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  await c.env.DB.prepare(
    `UPDATE channels SET 
      target_timezone = ?, 
      contact_email = ?
    WHERE id = ?`
  ).bind(
    body.target_timezone || 'UTC',
    body.contact_email || '',
    id
  ).run();
  
  return c.json({ success: true });
});

app.get('/api/youtube/discover-channels', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader) return c.json({ error: 'Missing Authorization header' }, 401);
  
  const response = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true', {
    headers: { Authorization: authHeader }
  });
  const data = await response.json();
  return c.json(data);
});

app.post('/api/projects/import', async (c) => {
  const body = await c.req.json();
  
  await c.env.DB.prepare(
    `INSERT INTO channels (id, channel_name, niche, channel_handle, avatar_url, subscriber_count, youtube_refresh_token, watermark_text) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET 
       channel_name = excluded.channel_name,
       channel_handle = excluded.channel_handle,
       avatar_url = excluded.avatar_url,
       subscriber_count = excluded.subscriber_count,
       youtube_refresh_token = excluded.youtube_refresh_token,
       watermark_text = excluded.watermark_text`
  ).bind(
    body.id, body.channel_name, body.niche || 'entertainment', body.channel_handle || null, 
    body.avatar_url || null, body.subscriber_count || 0, body.refresh_token || null, body.watermark_text || null
  ).run();
  
  return c.json({ success: true, id: body.id }, 201);
});

app.post('/api/ingest/scan', async (c) => {
  const { folder_url, channel_id } = await c.req.json();
  if (!folder_url || !channel_id) return c.json({ error: 'Missing parameters' }, 400);

  const channel = await c.env.DB.prepare(`SELECT * FROM channels WHERE id = ?`).bind(channel_id).first();
  if (!channel) return c.json({ error: 'Channel not found' }, 404);

  let sourceType = 'gdrive';
  let folderName = 'Ingested Folder';
  let clips: any[] = [];

  try {
      if (folder_url.includes('drive.google.com')) {
      sourceType = 'gdrive';
      const match = folder_url.match(/folders\/([a-zA-Z0-9-_]+)/);
      if (!match) return c.json({ error: 'Invalid Google Drive folder URL' }, 400);
      const driveFolderId = match[1];

      const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
      if (!setting || !setting.value) return c.json({ error: 'Master Drive not connected' }, 400);

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: c.env.GOOGLE_CLIENT_ID || '',
          client_secret: c.env.GOOGLE_CLIENT_SECRET || '',
          refresh_token: setting.value as string,
          grant_type: 'refresh_token'
        }).toString()
      });
      
      const tokenData: any = await tokenResponse.json();
      if (!tokenData.access_token) return c.json({ error: 'Failed to refresh Master Drive token' }, 401);

      let driveFiles: any[] = [];
      let pageToken = '';
      
      do {
        const queryParams = new URLSearchParams({
          q: `'${driveFolderId}' in parents and mimeType contains 'video/' and trashed=false`,
          fields: 'nextPageToken, files(id,name,size,thumbnailLink)',
          pageSize: '1000'
        });
        if (pageToken) queryParams.append('pageToken', pageToken);
        
        const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?${queryParams.toString()}`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` }
        });
        
        const driveData: any = await driveRes.json();
        if (driveData.error) throw new Error(driveData.error.message);
        
        driveFiles = driveFiles.concat(driveData.files || []);
        pageToken = driveData.nextPageToken || '';
      } while (pageToken);

      clips = driveFiles.map((f: any) => ({
        file_id: f.id,
        file_name: f.name,
        file_size: parseInt(f.size || '0', 10),
        thumbnail: f.thumbnailLink ? `/api/drive/proxy-thumbnail?url=${encodeURIComponent(f.thumbnailLink)}` : null,
        source_url: `https://drive.google.com/file/d/${f.id}/view`
      }));

    } else if (folder_url.includes('mega.nz')) {
      sourceType = 'mega';
      const folder = File.fromURL(folder_url);
      await folder.loadAttributes();
      folderName = folder.name || 'MEGA Folder';
      
      clips = (folder.children || [])
        .filter((child: any) => !child.directory && child.name && child.name.match(/\.(mp4|mov|webm)$/i))
        .map((child: any) => ({
          file_id: child.handle || child.id || crypto.randomUUID(),
          file_name: child.name,
          file_size: child.size || 0,
          source_url: folder_url
        }));
    } else {
      return c.json({ error: 'Unsupported URL. Only Google Drive and MEGA are supported.' }, 400);
    }

    // Check existing jobs to mark already queued files
    const fileIds = clips.map(c => c.file_id);
    let existingIds = new Set();
    
    if (fileIds.length > 0) {
      // Chunking for SQLite limitations on placeholders
      const chunkSize = 50;
      for (let i = 0; i < fileIds.length; i += chunkSize) {
        const chunk = fileIds.slice(i, i + chunkSize);
        const placeholders = chunk.map(() => '?').join(',');
        const query = `SELECT source_file_id FROM render_jobs WHERE channel_id = ? AND source_file_id IN (${placeholders})`;
        const existing = await c.env.DB.prepare(query).bind(channel_id, ...chunk).all();
        existing.results.forEach((row: any) => existingIds.add(row.source_file_id));
      }
    }

    clips = clips.map(clip => ({
      ...clip,
      is_already_queued: existingIds.has(clip.file_id)
    }));

    return c.json({
      source_type: sourceType,
      folder_name: folderName,
      total_found: clips.length,
      clips
    });
  } catch (e: any) {
    console.error('Scan error:', e);
    return c.json({ error: 'Failed to scan folder', details: e.message }, 500);
  }
});

app.post('/api/ingest/enqueue', async (c) => {
  const { channel_id, source_type, items } = await c.req.json();
  if (!channel_id || !items || !Array.isArray(items)) return c.json({ error: 'Invalid payload' }, 400);

  let enqueued = 0;
  for (const item of items) {
    const jobId = crypto.randomUUID();
    await c.env.DB.prepare(
      `INSERT INTO render_jobs (id, channel_id, source_type, source_url, source_file_id, raw_drive_id, file_name, file_size, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'IDLE')`
    ).bind(
      jobId, 
      channel_id, 
      source_type, 
      item.source_url, 
      item.file_id, 
      source_type === 'gdrive' ? item.file_id : 'mega_placeholder', // Keep legacy raw_drive_id non-null
      item.file_name, 
      item.file_size
    ).run();
    enqueued++;
  }

  return c.json({ success: true, enqueued });
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
  const channelId = c.req.query('channel_id');
  const status = c.req.query('status') || 'ALL';
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = parseInt(c.req.query('limit') || '10', 10);
  const search = c.req.query('search') || '';
  const sortBy = c.req.query('sort_by') || 'name_asc';

  if (!channelId) return c.json({ error: 'Missing channel_id' }, 400);

  let query = 'SELECT * FROM render_jobs WHERE channel_id = ?';
  let countQuery = 'SELECT COUNT(*) as total FROM render_jobs WHERE channel_id = ?';
  const params: any[] = [channelId];

  if (status !== 'ALL') {
    query += ' AND status = ?';
    countQuery += ' AND status = ?';
    params.push(status);
  }

  if (search) {
    query += ' AND file_name LIKE ?';
    countQuery += ' AND file_name LIKE ?';
    params.push(`%${search}%`);
  }

  if (sortBy === 'name_asc') {
    query += ' ORDER BY LENGTH(file_name) ASC, file_name ASC';
  } else if (sortBy === 'name_desc') {
    query += ' ORDER BY LENGTH(file_name) DESC, file_name DESC';
  } else {
    query += ' ORDER BY created_at DESC';
  }

  query += ' LIMIT ? OFFSET ?';
  
  const countParams = [...params];
  const offset = (page - 1) * limit;
  params.push(limit, offset);

  const [jobsResult, countResult] = await Promise.all([
    c.env.DB.prepare(query).bind(...params).all(),
    c.env.DB.prepare(countQuery).bind(...countParams).first<{ total: number }>()
  ]);

  const total = countResult?.total || 0;
  return c.json({
    data: jobsResult.results,
    total,
    page,
    totalPages: Math.ceil(total / limit)
  });
});

app.delete('/api/jobs/:id', async (c) => {
  const id = c.req.param('id');
  
  // Ensure the job is only idle, pending, or failed (don't delete jobs that are processing or published)
  const result = await c.env.DB.prepare(`DELETE FROM render_jobs WHERE id = ? AND status IN ('IDLE', 'PENDING', 'FAILED')`).bind(id).run();
  
  if (result.meta.changes === 0) {
    return c.json({ error: 'Job not found or cannot be deleted in its current state.' }, 400);
  }
  
  return c.json({ success: true });
});

app.post('/api/jobs/:id/publish-now', async (c) => {
  const id = c.req.param('id');
  
  const job = await c.env.DB.prepare(`SELECT * FROM render_jobs WHERE id = ?`).bind(id).first();
  if (!job || !job.youtube_video_id) return c.json({ error: 'Job not found or missing youtube_video_id' }, 404);
  
  const channel = await c.env.DB.prepare(`SELECT youtube_access_token FROM channels WHERE id = ?`).bind(job.channel_id).first();
  if (!channel || !channel.youtube_access_token) return c.json({ error: 'Channel YouTube token missing' }, 400);

  // Call YouTube API to update privacy status to public
  const ytBody = {
    id: job.youtube_video_id,
    snippet: {
      title: job.ai_title || "Untitled",
      description: job.ai_description || "",
      tags: job.ai_tags ? (job.ai_tags as string).split(',') : [],
      categoryId: "22"
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false
    }
  };

  const ytRes = await fetch('https://youtube.googleapis.com/youtube/v3/videos?part=snippet,status', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${channel.youtube_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ytBody)
  });

  if (!ytRes.ok) {
    const err = await ytRes.text();
    console.error("YouTube Publish Now Failed", err);
    return c.json({ error: 'Failed to publish YouTube video', details: err }, 500);
  }

  const result = await c.env.DB.prepare(`UPDATE render_jobs SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(id).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Failed to update job status.' }, 500);
  }
  
  return c.json({ success: true, status: 'PUBLISHED' });
});

app.post('/api/jobs/batch-status', async (c) => {
  const { job_ids, new_status } = await c.req.json();
  if (!Array.isArray(job_ids) || job_ids.length === 0) return c.json({ error: 'Invalid payload' }, 400);
  
  const placeholders = job_ids.map(() => '?').join(',');
  await c.env.DB.prepare(`UPDATE render_jobs SET status = ? WHERE id IN (${placeholders})`).bind(new_status, ...job_ids).run();
  
  return c.json({ success: true });
});

app.post('/api/jobs/batch-delete', async (c) => {
  const { job_ids } = await c.req.json();
  if (!Array.isArray(job_ids) || job_ids.length === 0) return c.json({ error: 'Invalid payload' }, 400);
  
  const placeholders = job_ids.map(() => '?').join(',');
  await c.env.DB.prepare(`DELETE FROM render_jobs WHERE id IN (${placeholders}) AND status IN ('IDLE', 'PENDING', 'FAILED')`).bind(...job_ids).run();
  
  return c.json({ success: true });
});

// Colab Worker Endpoints

app.post('/api/jobs/claim', async (c) => {
  const colabKey = c.req.header('X-Colab-Key');
  if (colabKey !== c.env.COLAB_API_KEY) return c.json({ error: 'Unauthorized' }, 401);
  
  const job = await c.env.DB.prepare(
    `SELECT r.* FROM render_jobs r
     JOIN channels c ON r.channel_id = c.id
     WHERE r.status = 'QUEUED_FOR_RENDER' 
       AND (c.daily_ai_requests < 50 OR c.last_ai_request_date != date('now'))
     ORDER BY LENGTH(r.file_name) ASC, r.file_name ASC
     LIMIT 1`
  ).first();

  if (!job) return c.json({ message: 'No pending jobs' }, 404);
  
  const channel = await c.env.DB.prepare(`SELECT * FROM channels WHERE id = ?`).bind(job.channel_id).first();
  const jobData: Record<string, any> = { 
    ...job, 
    youtube_token_data: null, 
    channel_niche: channel?.niche || 'entertainment', 
    channel_handle: channel?.channel_handle || `@${(channel?.channel_name as string || 'Shorts').replace(/\s+/g, '')}`,
    target_drive_folder_path: `ReelNexus/exported_videos/${(channel?.channel_name as string || 'General').replace(/[^a-zA-Z0-9-_]/g, '_')}`,
    watermark_text: channel?.watermark_text,
    watermark_x: channel?.watermark_x,
    watermark_y: channel?.watermark_y,
    watermark_font_size: channel?.watermark_font_size,
    watermark_font_color: channel?.watermark_font_color,
    watermark_bg_enabled: channel?.watermark_bg_enabled,
    watermark_bg_color: channel?.watermark_bg_color,
    watermark_bg_opacity: channel?.watermark_bg_opacity,
    watermark_opacity: channel?.watermark_opacity,
    watermark_font_family: channel?.watermark_font_family,
    watermark_border_radius: channel?.watermark_border_radius,
    watermark_padding: channel?.watermark_padding
  };
  
  if (channel && channel.youtube_refresh_token) {
    jobData.youtube_token_data = {
       refresh_token: channel.youtube_refresh_token,
       client_id: c.env.GOOGLE_CLIENT_ID,
       client_secret: c.env.GOOGLE_CLIENT_SECRET,
       channel_id: channel.id
    };
  }

  const masterDrive = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (masterDrive && masterDrive.value) {
    jobData.master_drive_token_data = {
       refresh_token: masterDrive.value as string,
       client_id: c.env.GOOGLE_CLIENT_ID,
       client_secret: c.env.GOOGLE_CLIENT_SECRET
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
  const newStatus = body.status || 'READY_FOR_REVIEW';
  const youtubeVideoId = body.youtube_video_id;
  const imageBase64 = body.keyframe_base64;
  
  const job = await c.env.DB.prepare(`SELECT channel_id FROM render_jobs WHERE id = ?`).bind(jobId).first();
  if (!job) return c.json({ error: 'Job not found' }, 404);
  
  const channel = await c.env.DB.prepare(`SELECT * FROM channels WHERE id = ?`).bind(job.channel_id).first();
  const niche = channel?.niche || 'general';

  let aiTitle = "Generated Hook Title 🔥";
  let aiDescription = "Generated engaging SEO description for Shorts.";
  let aiTags = "shorts,viral,trending";

  if (imageBase64) {
    // Update daily AI quota
    const today = new Date().toISOString().split('T')[0];
    await c.env.DB.prepare(
      `UPDATE channels SET 
        daily_ai_requests = CASE WHEN last_ai_request_date = ? THEN daily_ai_requests + 1 ELSE 1 END,
        last_ai_request_date = ?
       WHERE id = ?`
    ).bind(today, today, channel?.id).run();

    const keywords = await getTrendingKeywords(niche as string);
    const meta = await generateVisionMetadata(c.env, imageBase64, niche as string, keywords);
    
    if (meta) {
      aiTitle = meta.title || aiTitle;
      aiDescription = meta.description || aiDescription;
      aiTags = Array.isArray(meta.tags) ? meta.tags.join(',') : (meta.tags || aiTags);
    }
  }
  
  // Append DMCA block
  const emailStr = channel?.contact_email ? channel.contact_email : 'us';
  const dmcaBlock = `\n\n---\n⚠️ Copyright/DMCA Notice: This video is heavily transformative and edited under fair use guidelines. However, if you are the original owner of any clips and wish for them to be removed, please contact ${emailStr} and we will immediately take this down.`;
  aiDescription += dmcaBlock;
  
  await c.env.DB.prepare(
    `UPDATE render_jobs SET 
      status = ?, 
      ai_title = ?, 
      ai_description = ?, 
      ai_tags = ?,
      youtube_video_id = COALESCE(?, youtube_video_id)
    WHERE id = ?`
  ).bind(newStatus, aiTitle, aiDescription, aiTags, youtubeVideoId, jobId).run();

  return c.json({ success: true });
});

function getNextUSPeakSlot(latestScheduled: string | null): Date {
  const peakHoursUTC = [2, 14, 18, 22]; // 10 PM EST, 10 AM EST, 2 PM EST, 6 PM EST
  let baseDate = latestScheduled ? new Date(latestScheduled) : new Date();
  
  // Start searching from 1 hour after the base date to ensure spacing
  baseDate = new Date(baseDate.getTime() + 60 * 60 * 1000);
  
  while (true) {
    if (peakHoursUTC.includes(baseDate.getUTCHours()) && baseDate.getUTCMinutes() === 0) {
      return baseDate;
    }
    // Increment by 1 hour
    baseDate.setUTCHours(baseDate.getUTCHours() + 1, 0, 0, 0);
  }
}

app.post('/api/jobs/:id/approve', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const job = await c.env.DB.prepare(`SELECT channel_id, youtube_video_id FROM render_jobs WHERE id = ?`).bind(id).first();
  if (!job || !job.youtube_video_id) return c.json({ error: 'Job not found or missing youtube_video_id' }, 404);
  
  const channel = await c.env.DB.prepare(`SELECT youtube_access_token FROM channels WHERE id = ?`).bind(job.channel_id).first();
  if (!channel || !channel.youtube_access_token) return c.json({ error: 'Channel YouTube token missing' }, 400);
  const latestJob = await c.env.DB.prepare(
    `SELECT scheduled_slot FROM render_jobs 
     WHERE channel_id = ? AND status = 'SCHEDULED' 
     ORDER BY scheduled_slot DESC LIMIT 1`
  ).bind(job.channel_id).first();

  const futureSlot = getNextUSPeakSlot(latestJob?.scheduled_slot as string | null);
  
  const publishNow = body.publish_now === true;
  const newStatus = publishNow ? 'PUBLISHED' : 'SCHEDULED';
  
  // Call YouTube API to update privacy status and snippet
  const ytBody = {
    id: job.youtube_video_id,
    snippet: {
      title: body.ai_title,
      description: body.ai_description,
      tags: body.ai_tags ? body.ai_tags.split(',') : [],
      categoryId: "22"
    },
    status: {
      privacyStatus: publishNow ? 'public' : 'private',
      selfDeclaredMadeForKids: false
    }
  };
  
  if (!publishNow) {
    (ytBody.status as any).publishAt = futureSlot.toISOString();
  }

  const ytRes = await fetch('https://youtube.googleapis.com/youtube/v3/videos?part=snippet,status', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${channel.youtube_access_token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ytBody)
  });

  if (!ytRes.ok) {
    const err = await ytRes.text();
    console.error("YouTube Update Failed", err);
    return c.json({ error: 'Failed to update YouTube video', details: err }, 500);
  }

  const result = await c.env.DB.prepare(
    `UPDATE render_jobs SET 
      status = ?, 
      is_reviewed = 1, 
      approved_at = CURRENT_TIMESTAMP, 
      scheduled_slot = ?, 
      ai_title = ?, 
      ai_description = ?, 
      ai_tags = ? 
    WHERE id = ? AND status = 'READY_FOR_REVIEW'`
  ).bind(
    newStatus,
    futureSlot.toISOString(), 
    body.ai_title, 
    body.ai_description, 
    body.ai_tags, 
    id
  ).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Job not found or not in READY_FOR_REVIEW state.' }, 400);
  }
  
  return c.json({ success: true, status: newStatus, scheduled_slot: futureSlot.toISOString() });
});

export default {
  fetch: app.fetch
};
