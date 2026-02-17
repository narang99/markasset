import { Hono } from 'hono';
import { googleAuth, revokeToken } from '@hono/oauth-providers/google';
import { getCookie, setCookie } from 'hono/cookie';

type Bindings = {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ENVIRONMENT: string;
  MARKASSET_REFRESH_TOKEN_KV: KVNamespace;
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
    console.log("revoking token");
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

app.get('/auth/google/callback', (c) => {
  const token = c.get('token')
  const refreshToken = c.get('refresh-token');
  const grantedScopes = c.get('granted-scopes');
  const user = c.get('user-google');


  const sessionId = crypto.randomUUID();

  c.env.MARKASSET_REFRESH_TOKEN_KV.put(`session:${sessionId}`, JSON.stringify({ token, refreshToken, user }));
  setCookie(c, "session_id", sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: true,
  });

  return c.json({
    token,
    grantedScopes,
    user,
  });
})


export default app;
