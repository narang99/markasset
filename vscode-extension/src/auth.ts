import * as vscode from 'vscode';
import * as http from 'http';
import * as url from 'url';
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const SECRET_KEY = 'markasset.google.refreshToken';

export function getCredentials(): [string, string] {
  const config = vscode.workspace.getConfiguration('markasset');
  const clientId = config.get<string>('googleClientId', '');
  const clientSecret = config.get<string>('googleClientSecret', '');
  if (!clientId || !clientSecret) {
    throw new Error('Google Client ID and Secret not configured. Set markasset.googleClientId and markasset.googleClientSecret in settings.');
  }

  return [clientId, clientSecret];
}

export function createClient(): OAuth2Client {
  const [clientId, clientSecret] = getCredentials();
  return new OAuth2Client(clientId, clientSecret);
}

export class GoogleAuthService {
  constructor(private context: vscode.ExtensionContext) {}

  async isAuthenticated(): Promise<boolean> {
    const refreshToken = await this.context.secrets.get(SECRET_KEY);
    return !!refreshToken;
  }

  async getRefreshToken(): Promise<string> {
    const refreshToken = await this.context.secrets.get(SECRET_KEY);
    if (!refreshToken) {
      throw new Error('Not authenticated');
    }
    return refreshToken;
  }

  async getAccessToken(): Promise<string> {
    const refreshToken = await this.getRefreshToken();
    const client = createClient();
    client.setCredentials({ refresh_token: refreshToken });
    const { token } = await client.getAccessToken();
    if (!token) {
      await this.context.secrets.delete(SECRET_KEY);
      throw new Error('Session expired, please sign in again');
    }
    return token;
  }

  async authenticate(): Promise<void> {
    // We don't know the port yet, so create client without redirect URI.
    // It gets set once the server starts and the OS assigns a port.
    const client = createClient();
    const codes = await client.generateCodeVerifierAsync();
    const codeVerifier = codes.codeVerifier!;
    const codeChallenge = codes.codeChallenge!;

    const authCode = await this.waitForCallback(client, codeChallenge);

    const { tokens } = await client.getToken({ code: authCode, codeVerifier: codeVerifier! });

    if (tokens.refresh_token) {
      await this.context.secrets.store(SECRET_KEY, tokens.refresh_token);
    }
  }

  async signOut(): Promise<void> {
    await this.context.secrets.delete(SECRET_KEY);
  }

  private waitForCallback(client: OAuth2Client, codeChallenge: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        const parsed = url.parse(req.url || '', true);
        const error = parsed.query.error as string | undefined;
        const code = parsed.query.code as string | undefined;

        res.writeHead(200, { 'Content-Type': 'text/html' });

        if (error) {
          res.end('<h1>Authentication failed</h1><p>You can close this tab.</p>');
          server.close();
          reject(new Error(`OAuth error: ${error}`));
        } else if (code) {
          res.end('<h1>Signed in!</h1><p>You can close this tab and return to VSCode.</p>');
          server.close();
          resolve(code);
        }
      });

      // Port 0 = OS assigns a random available port (standard for Desktop app loopback)
      server.listen(0, '127.0.0.1', () => {
        const port = (server.address() as any).port;
        const redirectUri = `http://127.0.0.1:${port}`;
        (client as any).redirectUri = redirectUri;

        const authUrl = client.generateAuthUrl({
          access_type: 'offline',
          scope: SCOPES,
          code_challenge_method: CodeChallengeMethod.S256,
          code_challenge: codeChallenge,
          prompt: 'consent',
        });

        vscode.env.openExternal(vscode.Uri.parse(authUrl));
      });

      setTimeout(() => {
        server.close();
        reject(new Error('Authentication timed out'));
      }, 120_000);
    });
  }
}
