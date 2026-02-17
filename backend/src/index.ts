import { Hono } from 'hono';
import { googleAuth, revokeToken } from '@hono/oauth-providers/google';
import { getCookie, setCookie } from 'hono/cookie';

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ENVIRONMENT: string;
  MARKASSET_REFRESH_TOKEN_KV: KVNamespace;
  FRONTEND_URL: string;
  ASSETS: Fetcher;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use('/auth/google/callback', async (c, next) => {
  const auth = googleAuth({
    client_id: c.env.GOOGLE_CLIENT_ID,
    client_secret: c.env.GOOGLE_CLIENT_SECRET,
    scope: [
      'https://www.googleapis.com/auth/drive.file', 
      'https://www.googleapis.com/auth/userinfo.profile'
    ],
    access_type: 'offline',
    prompt: 'consent',
  });
  return auth(c, next);
});

app.post('/auth/google/signout', async (c) => {
  const sessionId = getCookie(c, "session_id");
  const val = await c.env.MARKASSET_REFRESH_TOKEN_KV.get(`session:${sessionId}`);
  if (val === null) {
    return c.text("already signed out");
  } else {
    const data = JSON.parse(val);
    await revokeToken(data.token);
      setCookie(c, "session_id", "", {
        httpOnly: true,
        secure: true,
        sameSite: "Lax",
        maxAge: 0,
      });
  }
  return c.text("done");
})

app.get('/auth/google/callback', async (c) => {
  const token = c.get('token')
  const refreshToken = c.get('refresh-token');
  const grantedScopes = c.get('granted-scopes');
  const user = c.get('user-google');

  const sessionId = crypto.randomUUID();

  const sessionKey = `session:${sessionId}`;
  const sessionData = JSON.stringify({ token, refreshToken, user });

  console.log("persisting session data at", sessionKey, "value", sessionData);
  await c.env.MARKASSET_REFRESH_TOKEN_KV.put(sessionKey, sessionData);
  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
  });

  // Redirect back to frontend (same origin)
  return new Response(null, {
    status: 302,
    headers: {
      Location: '/',
      // This is the key here, place the cookie in the browser
      'Set-Cookie': `session_id=${sessionId}; Path=/; HttpOnly`,
    },
  })
})

app.get('/auth/token', async (c) => {
  const sessionId = getCookie(c, "session_id");
  if (!sessionId) {
    return c.json({ error: "No session found" }, 401);
  }

  const sessionKey = `session:${sessionId}`;
  console.log("getting data for session using", sessionKey);
  const val = await c.env.MARKASSET_REFRESH_TOKEN_KV.get(sessionKey);
  console.log("got data", val);
  if (val === null) {
    return c.json({ error: "Session not found or expired" }, 401);
  }

  const data = JSON.parse(val);
  return c.json({
    token: data.token,
    user: data.user,
  });
})

// Serve static assets - this will be handled efficiently by Cloudflare Workers
app.get('*', async (c) => {
  // Let Cloudflare Workers Assets handle static files automatically
  // For paths that don't match static files, serve index.html (SPA routing)
  const url = new URL(c.req.url);
  
  // If path doesn't have extension and isn't an API route, serve index.html
  if (!url.pathname.includes('.') && !url.pathname.startsWith('/auth')) {
    const response = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url));
    return new Response(response.body, {
      ...response,
      headers: {
        ...Object.fromEntries(response.headers),
        'Content-Type': 'text/html'
      }
    });
  }
  
  // Otherwise, try to serve the static asset
  return c.env.ASSETS.fetch(c.req.raw);
})

export default app;
