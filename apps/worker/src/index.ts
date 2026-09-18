import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { File } from 'megajs';

export type RateLimiter = {
  limit: (options: { key: string }) => Promise<{ success: boolean }>;
};

export type Env = {
  DB: D1Database;
  AI: any;
  RATE_LIMITER?: RateLimiter;
  AI_RATE_LIMITER?: RateLimiter;
  DB_RATE_LIMITER?: RateLimiter;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  COLAB_API_KEY: string;
  FRONTEND_URL: string;
};

export type Variables = {
  user?: any;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

const ALLOWED_ORIGINS = [
  'https://reelnexus-dashboard.pages.dev',
  'http://localhost:3000'
];

app.use('*', cors({
  origin: (origin) => {
    if (!origin) return ALLOWED_ORIGINS[0];
    if (ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.reelnexus-dashboard.pages.dev')) {
      return origin;
    }
    return ALLOWED_ORIGINS[0];
  },
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Colab-Key'],
  credentials: true
}));

// --- Rate Limiting & DDoS Protection Middlewares ---

// 1. General API Rate Limiting (Protects Backend from Floods/DDoS)
app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS' || c.req.path === '/') return next();

  // Whitelist authenticated Colab Worker calls
  const colabKey = c.req.header('X-Colab-Key');
  if (colabKey && colabKey === c.env.COLAB_API_KEY) {
    return next();
  }

  const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown';

  if (c.env.RATE_LIMITER) {
    try {
      const { success } = await c.env.RATE_LIMITER.limit({ key: `api_${clientIp}` });
      if (!success) {
        return c.json({
          error: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded for API. Please slow down and try again shortly.'
        }, 429);
      }
    } catch (err) {
      console.warn('API rate limiter error:', err);
    }
  }

  await next();
});

// 2. Heavy Database Write & Ingestion Rate Limiting (Protects D1 from Exhaustion)
const HEAVY_DB_ROUTES = [
  '/api/ingest/scan',
  '/api/ingest/enqueue',
  '/api/jobs/batch-status',
  '/api/jobs/batch-delete',
  '/api/projects/import'
];

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();

  const isHeavyRoute = HEAVY_DB_ROUTES.some(route => c.req.path.startsWith(route));
  if (isHeavyRoute) {
    const colabKey = c.req.header('X-Colab-Key');
    if (colabKey && colabKey === c.env.COLAB_API_KEY) {
      return next();
    }

    const clientIp = c.req.header('cf-connecting-ip') || c.req.header('x-real-ip') || 'unknown';

    if (c.env.DB_RATE_LIMITER) {
      try {
        const { success } = await c.env.DB_RATE_LIMITER.limit({ key: `db_${clientIp}` });
        if (!success) {
          return c.json({
            error: 'DB_RATE_LIMIT_EXCEEDED',
            message: 'Too many database operations requested. Please wait before retrying.'
          }, 429);
        }
      } catch (err) {
        console.warn('DB rate limiter error:', err);
      }
    }
  }

  await next();
});

// 3. Centralized Authentication Guard for Protected Endpoints
const PUBLIC_PREFIXES = [
  '/api/auth/',
  '/api/jobs/claim',
  '/api/jobs/complete',
  '/api/drive/proxy-thumbnail',
  '/api/drive/proxy-video'
];

app.use('/api/*', async (c, next) => {
  if (c.req.method === 'OPTIONS') return next();

  // Allow public endpoints
  if (PUBLIC_PREFIXES.some(prefix => c.req.path.startsWith(prefix))) {
    return next();
  }

  // Allow Colab Worker calls with valid API key
  const colabKey = c.req.header('X-Colab-Key');
  if (colabKey && colabKey === c.env.COLAB_API_KEY) {
    return next();
  }

  // Enforce valid user session for all modifying routes (POST, PUT, DELETE, PATCH)
  const isMutating = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(c.req.method);
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const jwtSecret = c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev';

  if (isMutating) {
    if (!token) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Authentication required for modifying actions.' }, 401);
    }
    const payload = await verifyJwt(token, jwtSecret);
    if (!payload) {
      return c.json({ error: 'INVALID_TOKEN', message: 'Session expired or invalid.' }, 401);
    }
    c.set('user', payload);
  } else if (token) {
    const payload = await verifyJwt(token, jwtSecret);
    if (payload) c.set('user', payload);
  }

  await next();
});

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

async function generateVideoMetadata(env: Env, fileName: string, niche: string, trendingKeywords: string[], imageBase64?: string) {
  // 1. Try Vision model if keyframe is provided
  if (imageBase64 && imageBase64.length > 50) {
    try {
      const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
      const binaryString = atob(cleanBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const imageArray = Array.from(bytes);

      const prompt = `Analyze this video keyframe. Trending keywords: ${JSON.stringify(trendingKeywords)}.
Generate YouTube Shorts metadata formatted strictly as JSON with keys:
"title": Curiosity-driven title under 55 characters ending with #Shorts.
"description": 2-3 engaging SEO sentences.
"tags": Array of 5-8 hashtags.`;

      const aiRes: any = await env.AI.run("@cf/meta/llama-3.2-11b-vision-instruct", {
        prompt,
        image: imageArray,
        max_tokens: 512
      });

      const content = aiRes?.response || '';
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.title) return parsed;
      }
    } catch (e) {
      console.warn('Vision metadata generation failed, attempting text LLM:', e);
    }
  }

  // 2. High-reliability Text LLM (Llama 3.2 3B Instruct)
  try {
    const cleanFileName = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
    const systemPrompt = `You are an elite YouTube Shorts strategist crafting viral content specifically targeted at US audiences.
Your goal is maximizing initial-velocity retention, viewed vs. swiped ratio, and completion rate.
Write in natural, conversational American English. Avoid filler, buzzword clichés, or regional Indian phrasing.
State the hook or high-stakes premise immediately in the first few words of the title.
Respond strictly in valid JSON format with no additional text or Markdown wrapping.`;

    const userPrompt = `Create US-targeted YouTube Shorts metadata for:
- Video file: "${cleanFileName}"
- Channel niche: "${niche}"
- Trending terms: ${JSON.stringify(trendingKeywords)}

Formatting requirements:
1. "title": Punchy, curiosity-driven title under 55 characters ending with #Shorts. Put the main promise or question first.
2. "description": 2-3 clean, engaging sentences with natural SEO terms. No excessive hashtag walls.
3. "tags": 5-8 relevant topic keywords and genuine spelling variations (e.g. ["shorts", "${niche.toLowerCase().replace(/[^a-z0-9]/g, '')}", "wealth", "mindset", "success"]).

Return pure JSON:
{
  "title": "Title here #Shorts",
  "description": "Description here",
  "tags": ["tag1", "tag2"]
}`;

    const aiRes: any = await env.AI.run("@cf/meta/llama-3.2-3b-instruct", {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      max_tokens: 512,
      temperature: 0.75
    });

    const content = aiRes?.response || '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return JSON.parse(content);
  } catch (e: any) {
    console.error('Text metadata generation failed:', e);
    // 3. Dynamic procedural fallback with unique viral hooks
    const hooks = [
      "Rule #1 Most People Ignore",
      "The Reality of True Wealth",
      "Would You Make This Choice?",
      "The Mindset That Changes Everything",
      "Is This The Ultimate Flex?",
      "The Cost of Ambition",
      "Secret That Changed My Life",
      "Why 99% Fail at This",
      "Watch Until The Very End",
      "Never Make This Mistake",
      "The Secret Nobody Tells You",
      "Proof Anything Is Possible",
      "Level Up Your Lifestyle Today"
    ];
    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];
    return {
      title: `${randomHook} | ${niche} #Shorts`,
      description: `Watch this unforgettable clip! Subscribe for more daily ${niche} Shorts, insights, and inspiration.\n\n#shorts #${niche.toLowerCase().replace(/[^a-z0-9]/g, '')} #viral #trending`,
      tags: ["shorts", "viral", niche.toLowerCase().replace(/[^a-z0-9]/g, ''), "trending", "explore", "reels"]
    };
  }
}

// --- JWT & Auth Helpers (Web Crypto) ---

async function signJwt(payload: any, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const data = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const signatureArray = Array.from(new Uint8Array(signature));
  const signatureString = String.fromCharCode.apply(null, signatureArray);
  const encodedSignature = btoa(signatureString).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${data}.${encodedSignature}`;
}

async function verifyJwt(token: string, secret: string): Promise<any | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const data = `${encodedHeader}.${encodedPayload}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigBase64 = encodedSignature.replace(/-/g, '+').replace(/_/g, '/');
    const sigBinary = atob(sigBase64);
    const sigBytes = new Uint8Array(sigBinary.length);
    for (let i = 0; i < sigBinary.length; i++) {
      sigBytes[i] = sigBinary.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(data));
    if (!isValid) return null;

    const payloadJson = atob(encodedPayload.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson);
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// --- Token Encryption at Rest (AES-256-GCM) ---

async function getEncryptionKey(secretKey: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest('SHA-256', enc.encode(secretKey));
  return crypto.subtle.importKey('raw', keyMaterial, { name: 'AES-256-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptSecret(plainText: string, secretKey: string): Promise<string> {
  if (!plainText) return '';
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getEncryptionKey(secretKey);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-256-GCM', iv }, key, enc.encode(plainText));
  
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

async function decryptSecret(cipherTextB64: string, secretKey: string): Promise<string> {
  if (!cipherTextB64) return '';
  // Graceful fallback for legacy plaintext Google tokens (starting with '1//')
  if (cipherTextB64.startsWith('1//')) {
    return cipherTextB64;
  }
  try {
    const raw = Uint8Array.from(atob(cipherTextB64), c => c.charCodeAt(0));
    if (raw.length <= 12) return cipherTextB64;
    const iv = raw.slice(0, 12);
    const data = raw.slice(12);
    const key = await getEncryptionKey(secretKey);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-256-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch (err) {
    return cipherTextB64;
  }
}

// --- Signed OAuth State Helpers (HMAC-SHA256) ---

async function generateSecureState(payload: object, secret: string): Promise<string> {
  const stateObj = { ...payload, nonce: crypto.randomUUID(), iat: Date.now() };
  const jsonStr = JSON.stringify(stateObj);
  const b64Data = btoa(jsonStr).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(b64Data));
  const b64Sig = btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return `${b64Data}.${b64Sig}`;
}

async function verifySecureState(stateToken: string, secret: string): Promise<any | null> {
  try {
    const parts = stateToken.split('.');
    if (parts.length !== 2) return null;
    const [b64Data, b64Sig] = parts;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
    const sigBytes = Uint8Array.from(atob(b64Sig.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
    
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(b64Data));
    if (!valid) return null;

    const jsonStr = atob(b64Data.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed = JSON.parse(jsonStr);
    
    // Check 10-minute expiration
    if (!parsed.iat || Date.now() - parsed.iat > 10 * 60 * 1000) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

// --- Google OAuth Access Token Helper ---

async function getGoogleAccessToken(env: Env, encryptedRefreshToken: string): Promise<string | null> {
  if (!encryptedRefreshToken) return null;
  const secretKey = env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev';
  const refreshToken = await decryptSecret(encryptedRefreshToken, secretKey);

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID || '',
        client_secret: env.GOOGLE_CLIENT_SECRET || '',
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      }).toString()
    });

    if (!tokenRes.ok) {
      console.error('Google token refresh failed:', await tokenRes.text());
      return null;
    }

    const tokenData: any = await tokenRes.json();
    return tokenData.access_token || null;
  } catch (e) {
    console.error('Google token refresh network exception:', e);
    return null;
  }
}

// --- Google Passwordless Auth Endpoints ---

app.get('/api/auth/google/login', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "GCP_NOT_CONFIGURED", message: "Google Client ID/Secret missing." }, 400);
  }

  const redirectUri = new URL('/api/auth/google/callback', c.req.url).toString();
  const returnTo = c.req.query('return_to') || '/';
  
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'openid email profile');
  authUrl.searchParams.set('prompt', 'select_account');
  
  const stateToken = await generateSecureState({ returnTo }, c.env.GOOGLE_CLIENT_SECRET);
  authUrl.searchParams.set('state', stateToken);

  return c.redirect(authUrl.toString());
});

app.get('/api/auth/google/callback', async (c) => {
  const code = c.req.query('code');
  const stateRaw = c.req.query('state') || '';
  const error = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL || 'https://reelnexus-dashboard.pages.dev';

  if (error || !code) {
    return c.redirect(`${frontendUrl}/?error=google_login_cancelled`);
  }

  // Verify HMAC state
  const stateData = await verifySecureState(stateRaw, c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev');
  if (!stateData) {
    return c.redirect(`${frontendUrl}/?error=invalid_csrf_state`);
  }

  // Strictly sanitize returnTo to prevent open redirects
  let safeReturnTo = '/';
  if (stateData.returnTo && typeof stateData.returnTo === 'string' && stateData.returnTo.startsWith('/') && !stateData.returnTo.startsWith('//')) {
    safeReturnTo = stateData.returnTo;
  }

  const redirectUri = new URL('/api/auth/google/callback', c.req.url).toString();

  try {
    // 1. Exchange code for Google tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
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

    if (!tokenRes.ok) {
      throw new Error(await tokenRes.text());
    }

    const tokenData: any = await tokenRes.json();

    // 2. Fetch user profile from Google
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      throw new Error('Failed to fetch user profile');
    }

    const profile: any = await userRes.json();

    // 3. Upsert into D1 users table
    const existingUser = await c.env.DB.prepare(
      `SELECT * FROM users WHERE email = ?`
    ).bind(profile.email).first();

    let userId = existingUser?.id as string || crypto.randomUUID();

    if (existingUser) {
      await c.env.DB.prepare(
        `UPDATE users SET name = ?, avatar_url = ?, google_id = ? WHERE id = ?`
      ).bind(profile.name, profile.picture, profile.id, userId).run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO users (id, email, password_hash, name, avatar_url, google_id) 
         VALUES (?, ?, 'GOOGLE_AUTH', ?, ?, ?)`
      ).bind(userId, profile.email, profile.name, profile.picture, profile.id).run();
    }

    // 4. Sign JWT (30 days validity)
    const jwtSecret = c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev';
    const token = await signJwt({
      sub: userId,
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60)
    }, jwtSecret);

    const glue = safeReturnTo.includes('?') ? '&' : '?';
    return c.redirect(`${frontendUrl}${safeReturnTo}${glue}auth_token=${token}`);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    return c.redirect(`${frontendUrl}/?error=google_login_failed`);
  }
});

app.get('/api/auth/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const token = authHeader.substring(7).trim();
  const jwtSecret = c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev';
  const payload = await verifyJwt(token, jwtSecret);

  if (!payload) {
    return c.json({ error: 'Invalid or expired session' }, 401);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?`
  ).bind(payload.sub).first();

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

app.get('/api/auth/youtube/connect', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({
      error: "GCP_NOT_CONFIGURED",
      message: "YouTube OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your worker secrets."
    }, 400);
  }

  const channelId = c.req.query('channel_id');
  const returnTo = c.req.query('return_to') || '';
  if (!channelId) return c.json({ error: 'Missing channel_id' }, 400);

  const redirectUri = new URL('/api/auth/youtube/callback', c.req.url).toString();
  // Principle of Least Privilege: upload Shorts and edit snippets/privacy only
  const scopes = [
    'https://www.googleapis.com/auth/youtube.upload',
    'https://www.googleapis.com/auth/youtube.force-ssl',
    'https://www.googleapis.com/auth/youtube.readonly'
  ].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  
  const stateToken = await generateSecureState({ channelId, returnTo }, c.env.GOOGLE_CLIENT_SECRET);
  authUrl.searchParams.set('state', stateToken);

  return c.redirect(authUrl.toString());
});

app.get('/api/auth/youtube/callback', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({
      error: "GCP_NOT_CONFIGURED",
      message: "YouTube OAuth is not configured yet."
    }, 400);
  }

  const code = c.req.query('code');
  const stateRaw = c.req.query('state') || '';
  const error = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL || 'https://reelnexus-dashboard.pages.dev';

  if (error || !code) {
    return c.redirect(`${frontendUrl}/?error=oauth_failed`);
  }

  // Verify HMAC state
  const stateData = await verifySecureState(stateRaw, c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev');
  if (!stateData) {
    return c.redirect(`${frontendUrl}/?error=invalid_csrf_state`);
  }

  const channelId = stateData.channelId || '';
  let returnTo = '';
  if (stateData.returnTo && typeof stateData.returnTo === 'string' && stateData.returnTo.startsWith('/') && !stateData.returnTo.startsWith('//')) {
    returnTo = stateData.returnTo;
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
    
    // Encrypt and store channel's refresh token in D1
    if (data.refresh_token) {
      const encToken = await encryptSecret(data.refresh_token, c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev');
      if (channelId) {
        await c.env.DB.prepare(
          `UPDATE channels SET youtube_refresh_token = ? WHERE id = ?`
        ).bind(encToken, channelId).run();
      }

      // Also match by real YouTube API channel ID
      try {
        const chRes = await fetch('https://www.googleapis.com/youtube/v3/channels?part=id&mine=true', {
          headers: { 'Authorization': `Bearer ${data.access_token}` }
        });
        if (chRes.ok) {
          const chData: any = await chRes.json();
          const realYtId = chData.items?.[0]?.id;
          if (realYtId) {
            await c.env.DB.prepare(
              `UPDATE channels SET youtube_refresh_token = ? WHERE id = ?`
            ).bind(encToken, realYtId).run();
          }
        }
      } catch (e) {
        console.error('Failed auto channel match:', e);
      }
    }

    if (returnTo) {
      const glue = returnTo.includes('?') ? '&' : '?';
      return c.redirect(`${frontendUrl}${returnTo}${glue}youtube_reconnected=true`);
    }

    return c.redirect(`${frontendUrl}/settings?youtube_connected=true`);
  } catch (e) {
    console.error('OAuth token exchange failed:', e);
    const dest = returnTo ? `${frontendUrl}${returnTo}?error=token_exchange_failed` : `${frontendUrl}/?error=token_exchange_failed`;
    return c.redirect(dest);
  }
});

app.get('/api/auth/drive/connect', async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json({ error: "GCP_NOT_CONFIGURED" }, 400);
  }

  const redirectUri = new URL('/api/auth/drive/callback', c.req.url).toString();
  const scopes = ['https://www.googleapis.com/auth/drive.readonly'].join(' ');

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', c.env.GOOGLE_CLIENT_ID);
  authUrl.searchParams.set('redirect_uri', redirectUri);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', scopes);
  authUrl.searchParams.set('access_type', 'offline');
  authUrl.searchParams.set('prompt', 'consent');
  
  const stateToken = await generateSecureState({ returnTo: '/ingest' }, c.env.GOOGLE_CLIENT_SECRET);
  authUrl.searchParams.set('state', stateToken);

  return c.redirect(authUrl.toString());
});

app.get('/api/auth/drive/callback', async (c) => {
  const code = c.req.query('code');
  const stateRaw = c.req.query('state') || '';
  const error = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL || 'https://reelnexus-dashboard.pages.dev';

  if (error || !code) {
    return c.redirect(`${frontendUrl}/ingest?error=drive_oauth_failed`);
  }

  const stateData = await verifySecureState(stateRaw, c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev');
  if (!stateData) {
    return c.redirect(`${frontendUrl}/ingest?error=invalid_csrf_state`);
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
      const encToken = await encryptSecret(data.refresh_token, c.env.GOOGLE_CLIENT_SECRET || 'reelnexus_jwt_secret_dev');
      await c.env.DB.prepare(
        `INSERT INTO global_settings (key, value) VALUES ('master_drive_refresh_token', ?) 
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      ).bind(encToken).run();
    }
    
    return c.redirect(`${frontendUrl}/ingest?success=drive_connected`);
  } catch (e) {
    console.error('Drive OAuth failed:', e);
    return c.redirect(`${frontendUrl}/ingest?error=drive_token_exchange_failed`);
  }
});

// --- Settings & Master Drive Endpoints ---

app.get('/api/drive/proxy-thumbnail', async (c) => {
  const fileId = c.req.query('fileId');
  if (!fileId || !/^[a-zA-Z0-9_-]{10,100}$/.test(fileId)) {
    return c.json({ error: 'INVALID_FILE_ID' }, 400);
  }
  
  const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (!setting || !setting.value) return c.body(null, 401);

  const accessToken = await getGoogleAccessToken(c.env, setting.value as string);
  if (!accessToken) return c.body(null, 401);

  // Strict domain enforcement: query Google Drive API directly
  const imgRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  return new Response(imgRes.body, {
    headers: {
      'Content-Type': imgRes.headers.get('Content-Type') || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600'
    }
  });
});

app.get('/api/drive/proxy-video', async (c) => {
  const fileId = c.req.query('fileId');
  if (!fileId || !/^[a-zA-Z0-9_-]{10,100}$/.test(fileId)) {
    return c.body(null, 400);
  }
  
  const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (!setting || !setting.value) return c.body(null, 401);

  const accessToken = await getGoogleAccessToken(c.env, setting.value as string);
  if (!accessToken) return c.body(null, 401);

  // Pass through Range headers for video seeking and playback
  const headers: Record<string, string> = { Authorization: `Bearer ${accessToken}` };
  const range = c.req.header('Range');
  if (range) headers['Range'] = range;

  const videoRes = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { headers });
  
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
  if (parentId !== 'root' && !/^[a-zA-Z0-9_-]{10,100}$/.test(parentId)) {
    return c.json({ error: 'INVALID_PARENT_ID' }, 400);
  }
  
  const setting = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (!setting || !setting.value) return c.json({ error: 'Master Drive not connected' }, 401);

  const accessToken = await getGoogleAccessToken(c.env, setting.value as string);
  if (!accessToken) return c.json({ error: 'Failed to refresh Master Drive token' }, 401);

  const cleanParentId = parentId.replace(/['\\]/g, '');
  const q = `'${cleanParentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;
  const driveRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)&orderBy=name`, {
    headers: { Authorization: `Bearer ${accessToken}` }
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
  const page = Math.max(parseInt(c.req.query('page') || '1', 10), 1);
  const limit = Math.min(Math.max(parseInt(c.req.query('limit') || '10', 10), 1), 100);
  const search = c.req.query('search') || '';
  const sortBy = c.req.query('sort_by') || 'name_asc';

  if (!channelId) return c.json({ error: 'Missing channel_id' }, 400);

  let query = 'SELECT * FROM render_jobs WHERE channel_id = ?';
  let countQuery = 'SELECT COUNT(*) as total FROM render_jobs WHERE channel_id = ?';
  const params: any[] = [channelId];

  if (status === 'ALL') {
    query += " AND status != 'PUBLISHED'";
    countQuery += " AND status != 'PUBLISHED'";
  } else if (status !== 'EVERYTHING') {
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
  
  const channel = await c.env.DB.prepare(`SELECT youtube_refresh_token FROM channels WHERE id = ?`).bind(job.channel_id).first();
  if (!channel || !channel.youtube_refresh_token) return c.json({ error: 'Channel YouTube token missing' }, 400);

  const accessToken = await getGoogleAccessToken(c.env, channel.youtube_refresh_token as string);
  if (!accessToken) return c.json({ error: 'Failed to refresh YouTube token' }, 401);

  // Call YouTube API to update privacy status to public
  const rawTags = job.ai_tags ? (typeof job.ai_tags === 'string' ? job.ai_tags.split(',') : (Array.isArray(job.ai_tags) ? job.ai_tags : [])) : [];
  const cleanTags = rawTags.map((t: any) => String(t).trim()).filter(Boolean);

  const ytBody = {
    id: job.youtube_video_id,
    snippet: {
      title: String(job.ai_title || "Untitled Shorts").slice(0, 100),
      description: String(job.ai_description || ""),
      tags: cleanTags,
      categoryId: "22",
      defaultLanguage: "en",
      defaultAudioLanguage: "en"
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false
    }
  };

  const ytRes = await fetch('https://youtube.googleapis.com/youtube/v3/videos?part=snippet,status', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ytBody)
  });

  if (!ytRes.ok) {
    const err = await ytRes.text();
    console.error("YouTube Publish Now Failed", err);

    const isScopeError = err.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || 
                         err.includes('insufficientPermissions') || 
                         err.includes('PERMISSION_DENIED');

    if (isScopeError) {
      return c.json({
        error: 'YOUTUBE_REAUTH_REQUIRED',
        message: 'YouTube account requires updated permissions to edit/publish videos. Please reconnect your YouTube channel.',
        channel_id: job.channel_id,
        details: err
      }, 403);
    }

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
    master_drive_token_data: null,
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
  
  // Mint short-lived access tokens; NEVER expose client_secret or refresh_token to Colab
  if (channel && channel.youtube_refresh_token) {
    const ytAccessToken = await getGoogleAccessToken(c.env, channel.youtube_refresh_token as string);
    if (ytAccessToken) {
      jobData.youtube_token_data = {
         access_token: ytAccessToken,
         channel_id: channel.id
      };
    }
  }

  const masterDrive = await c.env.DB.prepare(`SELECT value FROM global_settings WHERE key = 'master_drive_refresh_token'`).first();
  if (masterDrive && masterDrive.value) {
    const driveAccessToken = await getGoogleAccessToken(c.env, masterDrive.value as string);
    if (driveAccessToken) {
      jobData.master_drive_token_data = {
         access_token: driveAccessToken
      };
    }
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
    let allowAi = true;
    if (c.env.AI_RATE_LIMITER) {
      try {
        const { success } = await c.env.AI_RATE_LIMITER.limit({ key: `ai_${channel?.id || 'global'}` });
        if (!success) {
          console.warn(`[RateLimit] AI rate limit reached for channel ${channel?.id}. Using baseline metadata.`);
          allowAi = false;
        }
      } catch (err) {
        console.warn('AI rate limiter error:', err);
      }
    }

    if (allowAi) {
      // Update daily AI quota
      const today = new Date().toISOString().split('T')[0];
      await c.env.DB.prepare(
        `UPDATE channels SET 
          daily_ai_requests = CASE WHEN last_ai_request_date = ? THEN daily_ai_requests + 1 ELSE 1 END,
          last_ai_request_date = ?
         WHERE id = ?`
      ).bind(today, today, channel?.id).run();

      const keywords = await getTrendingKeywords(niche as string);
      const meta = await generateVideoMetadata(c.env, (job as any)?.file_name || 'Shorts Video', niche as string, keywords, imageBase64);
      
      if (meta) {
        aiTitle = meta.title || aiTitle;
        aiDescription = meta.description || aiDescription;
        aiTags = Array.isArray(meta.tags) ? meta.tags.join(',') : (meta.tags || aiTags);
      }
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

// Endpoint for UI to trigger AI generation on demand with skeleton loading
app.post('/api/jobs/:id/generate-metadata', async (c) => {
  const id = c.req.param('id');
  const job = await c.env.DB.prepare(`SELECT * FROM render_jobs WHERE id = ?`).bind(id).first();
  if (!job) return c.json({ error: 'Job not found' }, 404);

  const channel = await c.env.DB.prepare(`SELECT * FROM channels WHERE id = ?`).bind(job.channel_id).first();
  const niche = (channel?.niche as string) || 'general';
  const keywords = await getTrendingKeywords(niche);

  const meta = await generateVideoMetadata(c.env, (job.file_name as string) || 'Shorts Video', niche, keywords);

  const title = meta.title || `${job.file_name} #Shorts`;
  let description = meta.description || `Enjoy this video!`;
  const tags = Array.isArray(meta.tags) ? meta.tags.join(',') : (meta.tags || 'shorts,viral,trending');

  const emailStr = channel?.contact_email ? channel.contact_email : 'us';
  const dmcaBlock = `\n\n---\n⚠️ Copyright/DMCA Notice: This video is heavily transformative and edited under fair use guidelines. However, if you are the original owner of any clips and wish for them to be removed, please contact ${emailStr} and we will immediately take this down.`;
  if (!description.includes('Copyright/DMCA Notice')) {
    description += dmcaBlock;
  }

  await c.env.DB.prepare(
    `UPDATE render_jobs SET ai_title = ?, ai_description = ?, ai_tags = ? WHERE id = ?`
  ).bind(title, description, tags, id).run();

  return c.json({
    success: true,
    ai_title: title,
    ai_description: description,
    ai_tags: tags,
    error_debug: (meta as any).error_debug
  });
});

function isUSDaylightSaving(d: Date): boolean {
  const month = d.getUTCMonth(); // 0-indexed: 2=March, 10=Nov
  if (month > 2 && month < 10) return true;
  if (month < 2 || month > 10) return false;
  const day = d.getUTCDate();
  if (month === 2) return day >= 8;
  if (month === 10) return day < 7;
  return true;
}

function getNextUSPeakSlot(latestScheduled: string | null): Date {
  const now = new Date();
  let minStart = latestScheduled ? new Date(latestScheduled) : now;
  // Space out each Short by at least 3 hours, and at least 30 minutes from now
  minStart = new Date(Math.max(now.getTime() + 30 * 60 * 1000, minStart.getTime() + 3 * 60 * 60 * 1000));

  for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
    const candidateDay = new Date(minStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const isDst = isUSDaylightSaving(candidateDay);

    // Tested IST slots targeting high-viewership US timezones:
    // 1. 10:30 PM IST (1:00 PM EDT / 10:00 AM PDT) -> 17:00 UTC
    // 2. 12:30 AM IST (3:00 PM EDT / 12:00 PM PDT cross-coast peak) -> 19:00 UTC
    // 3. 2:00 AM IST (4:30 PM EDT / 1:30 PM PDT) -> 20:30 UTC
    // 4. 8:00 AM IST (10:30 PM EDT / 7:30 PM PDT West Coast evening) -> 02:30 UTC
    const baseHourOffset = isDst ? 0 : 1;
    const targetSlotsUTC = [
      { h: (2 + baseHourOffset) % 24, m: 30 },
      { h: (17 + baseHourOffset) % 24, m: 0 },
      { h: (19 + baseHourOffset) % 24, m: 0 },
      { h: (20 + baseHourOffset) % 24, m: 30 }
    ].sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));

    for (const slot of targetSlotsUTC) {
      const slotDate = new Date(Date.UTC(
        candidateDay.getUTCFullYear(),
        candidateDay.getUTCMonth(),
        candidateDay.getUTCDate(),
        slot.h,
        slot.m,
        0,
        0
      ));

      if (slotDate.getTime() >= minStart.getTime()) {
        return slotDate;
      }
    }
  }

  return new Date(minStart.getTime() + 24 * 60 * 60 * 1000);
}

app.post('/api/jobs/:id/approve', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const job = await c.env.DB.prepare(`SELECT channel_id, youtube_video_id FROM render_jobs WHERE id = ?`).bind(id).first();
  if (!job || !job.youtube_video_id) return c.json({ error: 'Job not found or missing youtube_video_id' }, 404);
  
  const channel = await c.env.DB.prepare(`SELECT youtube_refresh_token FROM channels WHERE id = ?`).bind(job.channel_id).first();
  if (!channel || !channel.youtube_refresh_token) return c.json({ error: 'Channel YouTube token missing' }, 400);

  const accessToken = await getGoogleAccessToken(c.env, channel.youtube_refresh_token as string);
  if (!accessToken) return c.json({ error: 'Failed to refresh YouTube token' }, 401);

  const latestJob = await c.env.DB.prepare(
    `SELECT scheduled_slot FROM render_jobs 
     WHERE channel_id = ? AND status = 'SCHEDULED' 
     ORDER BY scheduled_slot DESC LIMIT 1`
  ).bind(job.channel_id).first();

  const futureSlot = getNextUSPeakSlot(latestJob?.scheduled_slot as string | null);
  
  const publishNow = body.publish_now === true;
  const newStatus = publishNow ? 'PUBLISHED' : 'SCHEDULED';
  
  const rawTags = body.ai_tags ? (typeof body.ai_tags === 'string' ? body.ai_tags.split(',') : (Array.isArray(body.ai_tags) ? body.ai_tags : [])) : [];
  const cleanTags = rawTags.map((t: any) => String(t).trim()).filter(Boolean);

  // Call YouTube API to update privacy status, English language signals, and snippet
  const ytBody = {
    id: job.youtube_video_id,
    snippet: {
      title: String(body.ai_title || "Shorts Video").slice(0, 100),
      description: body.ai_description ? String(body.ai_description) : "",
      tags: cleanTags,
      categoryId: "22",
      defaultLanguage: "en",
      defaultAudioLanguage: "en"
    },
    status: {
      privacyStatus: publishNow ? 'public' : 'private',
      selfDeclaredMadeForKids: false
    }
  };

  const ytRes = await fetch('https://youtube.googleapis.com/youtube/v3/videos?part=snippet,status', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(ytBody)
  });

  if (!ytRes.ok) {
    const err = await ytRes.text();
    console.error("YouTube Update Failed", err);

    const isScopeError = err.includes('ACCESS_TOKEN_SCOPE_INSUFFICIENT') || 
                         err.includes('insufficientPermissions') || 
                         err.includes('PERMISSION_DENIED');

    if (isScopeError) {
      return c.json({
        error: 'YOUTUBE_REAUTH_REQUIRED',
        message: 'YouTube account requires updated permissions to edit/publish videos. Please reconnect your YouTube channel.',
        channel_id: job.channel_id,
        details: err
      }, 403);
    }

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
    WHERE id = ? AND status IN ('READY_FOR_REVIEW', 'SCHEDULED', 'IDLE', 'PENDING')`
  ).bind(
    newStatus,
    futureSlot.toISOString(), 
    body.ai_title, 
    body.ai_description, 
    cleanTags.join(', '), 
    id
  ).run();

  if (result.meta.changes === 0) {
    return c.json({ error: 'Job not found or invalid state.' }, 400);
  }
  
  return c.json({ success: true, status: newStatus, scheduled_slot: futureSlot.toISOString() });
});

export default {
  fetch: app.fetch,
  async scheduled(event: any, env: any, ctx: any) {
    console.log("Running scheduled publishing cron...");
    try {
      // Find jobs whose scheduled_slot has passed and are still SCHEDULED
      const dueJobs = await env.DB.prepare(
        `SELECT r.*, c.youtube_refresh_token 
         FROM render_jobs r
         JOIN channels c ON r.channel_id = c.id
         WHERE r.status = 'SCHEDULED' 
           AND r.is_reviewed = 1
           AND r.scheduled_slot IS NOT NULL
           AND r.scheduled_slot <= datetime('now')
           AND r.youtube_video_id IS NOT NULL`
      ).all();

      for (const job of (dueJobs.results || [])) {
        if (!job.youtube_video_id || !job.youtube_refresh_token) continue;
        try {
          const accessToken = await getGoogleAccessToken(env, job.youtube_refresh_token);
          if (!accessToken) continue;

          const rawTags = job.ai_tags ? (typeof job.ai_tags === 'string' ? job.ai_tags.split(',') : (Array.isArray(job.ai_tags) ? job.ai_tags : [])) : [];
          const cleanTags = rawTags.map((t: any) => String(t).trim()).filter(Boolean);

          const ytRes = await fetch('https://youtube.googleapis.com/youtube/v3/videos?part=snippet,status', {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              id: job.youtube_video_id,
              snippet: {
                title: String(job.ai_title || "Shorts Video").slice(0, 100),
                description: job.ai_description || "",
                tags: cleanTags,
                categoryId: "22",
                defaultLanguage: "en",
                defaultAudioLanguage: "en"
              },
              status: {
                privacyStatus: 'public',
                selfDeclaredMadeForKids: false
              }
            })
          });

          if (ytRes.ok) {
            await env.DB.prepare(
              `UPDATE render_jobs SET status = 'PUBLISHED', published_at = CURRENT_TIMESTAMP WHERE id = ?`
            ).bind(job.id).run();
            console.log(`Cron successfully published scheduled job ${job.id}`);
          }
        } catch (jobErr) {
          console.error(`Error publishing scheduled job ${job.id}:`, jobErr);
        }
      }
    } catch (e) {
      console.error("Scheduled cron failed:", e);
    }
  }
};
