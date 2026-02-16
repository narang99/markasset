# Google OAuth 2.0 — Approaches Used in MarkAsset

This document explains the two OAuth flows used in MarkAsset, their official names, security properties, and production considerations.

---

## 1. VSCode Extension: Authorization Code Flow with PKCE

**Official name**: OAuth 2.0 Authorization Code Grant with Proof Key for Code Exchange (PKCE)

**Specification**: [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636)

**How it works**:
1. Extension generates a random `code_verifier` and its SHA-256 hash (`code_challenge`)
2. Opens browser to Google's authorization endpoint with the `code_challenge`
3. User consents → Google redirects to `http://localhost:{port}/callback?code=AUTH_CODE`
4. Extension exchanges `AUTH_CODE` + original `code_verifier` for tokens
5. Google verifies the verifier matches the challenge before issuing tokens

**Why PKCE**: The extension is a "public client" — it runs on the user's machine and cannot securely store a client secret. PKCE replaces the client secret with a per-request cryptographic proof, preventing authorization code interception attacks.

**Client type in GCP**: "Web application" (with `http://localhost:52849/callback` as an authorized redirect URI)

**Alternative client type**: "Desktop app" — supports loopback redirect on any port without pre-registering the URI. Trade-off: cannot share the same client ID with the web app.

**Tokens received**:
- `access_token` (short-lived, ~1 hour)
- `refresh_token` (long-lived, used to get new access tokens without re-consent)

**Storage**: Refresh token stored in VSCode's `SecretStorage` API (encrypted, OS keychain-backed on macOS/Windows/Linux).

### Loopback Redirect

**Official name**: Loopback IP Address Redirect (or "localhost redirect")

**Specification**: [RFC 8252 Section 7.3](https://datatracker.ietf.org/doc/html/rfc8252#section-7.3) (OAuth 2.0 for Native Apps)

The extension starts a temporary HTTP server on `localhost` to receive the OAuth callback. This is the standard pattern for desktop/CLI applications that cannot register a public redirect URL. Google, Microsoft, GitHub, and others all support this.

**Security note**: RFC 8252 recommends using `127.0.0.1` (IPv4 loopback) over `localhost` to prevent DNS rebinding attacks. Google's implementation accepts both.

---

## 2. Web App (Phone): Authorization Code Flow with PKCE (Browser)

**Official name**: OAuth 2.0 Authorization Code Grant with PKCE (for Single-Page Applications)

**Specification**: Same as VSCode — [RFC 7636](https://datatracker.ietf.org/doc/html/rfc7636), applied in a browser context per [OAuth 2.0 for Browser-Based Apps (RFC draft)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-browser-based-apps)

**How it works**:
1. User taps "Sign in with Google" on the web app
2. Web app generates `code_verifier` + `code_challenge` (same PKCE as VSCode)
3. Redirects to Google's authorization endpoint
4. User consents → Google redirects back to the web app with `?code=AUTH_CODE`
5. Web app exchanges `AUTH_CODE` + `code_verifier` for `access_token` + `refresh_token`
6. Stores `refresh_token` in `localStorage`
7. On subsequent visits: reads refresh token → silently gets a new access token → user is already signed in

**Tokens received**:
- `access_token` (short-lived, ~1 hour)
- `refresh_token` (long-lived, stored in `localStorage`)

**Why Authorization Code + PKCE instead of Implicit**:
- Refresh tokens enable persistent auth (user signs in once, stays signed in across page reloads and browser restarts)
- The implicit flow does NOT issue refresh tokens — the user would need to sign in every time
- PKCE is now the recommended flow for all OAuth clients, including SPAs (the implicit grant is considered legacy)

**Client type in GCP**: Same "Web application" client as VSCode. Needs both:
- **Authorized JavaScript origins**: the hosted domain (e.g., `https://your-domain.com`)
- **Authorized redirect URIs**: the web app's callback URL (e.g., `https://your-domain.com/callback` or just `https://your-domain.com` if handling the redirect in the same page)

**Storage**: Refresh token stored in `localStorage`. This is the standard pattern for SPAs without a backend. See security considerations below.

---

## GCP Setup Instructions

Both the VSCode extension and the web app share a single OAuth client. Follow these steps once.

### Step 1: Create a GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown (top bar) → **New Project**
3. Name: `markasset` (or anything you like) → **Create**
4. Make sure the new project is selected in the dropdown

### Step 2: Enable the Google Drive API

1. Go to **APIs & Services → Library** ([direct link](https://console.cloud.google.com/apis/library))
2. Search for **"Google Drive API"**
3. Click it → **Enable**

### Step 3: Configure the OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen** ([direct link](https://console.cloud.google.com/apis/credentials/consent))
2. Select **External** → **Create**
3. Fill in the required fields:
   - **App name**: `MarkAsset`
   - **User support email**: your email
   - **Developer contact email**: your email
4. Click **Save and Continue**
5. On the **Scopes** page:
   - Click **Add or Remove Scopes**
   - Search for `drive.file` or paste `https://www.googleapis.com/auth/drive.file`
   - Check it → **Update** → **Save and Continue**
6. On the **Test users** page:
   - Click **Add Users** → enter your Google email address → **Add**
   - (You can add up to 100 test users while the app is in Testing mode)
   - **Save and Continue**
7. Click **Back to Dashboard**

> **Note**: The app starts in "Testing" mode. Only the test users you add can sign in. To open it to everyone, you'd submit for Google verification later (see Production Considerations below).

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services → Credentials** ([direct link](https://console.cloud.google.com/apis/credentials))
2. Click **+ Create Credentials → OAuth client ID**
3. **Application type**: `Web application`
4. **Name**: `MarkAsset`
5. **Authorized JavaScript origins** — add all of these:
   - `http://localhost:3000` (web app local dev)
   - `http://localhost:52849` (VSCode extension OAuth callback)
   - `https://your-production-domain.com` (web app production — add when you have one)
6. **Authorized redirect URIs** — add all of these:
   - `http://localhost:52849/callback` (VSCode extension)
   - `http://localhost:3000` (web app local dev — redirect back to same page)
   - `https://your-production-domain.com` (web app production — add when you have one)
7. Click **Create**
8. Copy the **Client ID** — it looks like `123456789-abcdef.apps.googleusercontent.com`

> You do NOT need the Client Secret. Both the VSCode extension and web app use PKCE (public client flow), which does not require a secret.

### Step 5: Configure MarkAsset

**VSCode extension**: Open Settings → search `markasset` → paste the Client ID into `markasset.googleClientId`

**Web app**: The Client ID will be set in `web-upload/app.js` (hardcoded, same as the current Firebase config pattern — client IDs are public and safe to embed)

### Summary of what you registered

| Field | Value | Used by |
|-------|-------|---------|
| Authorized JavaScript origin | `http://localhost:52849` | VSCode OAuth callback server |
| Authorized JavaScript origin | `http://localhost:3000` | Web app (dev) |
| Authorized JavaScript origin | `https://your-domain.com` | Web app (production) |
| Authorized redirect URI | `http://localhost:52849/callback` | VSCode extension |
| Authorized redirect URI | `http://localhost:3000` | Web app (dev) |
| Authorized redirect URI | `https://your-domain.com` | Web app (production) |
| Scope | `drive.file` | Both |

---

## Security Considerations

### PKCE (VSCode)
- Prevents authorization code interception (the main attack vector for public clients)
- Refresh tokens should be stored securely (we use VSCode's encrypted SecretStorage)
- Google automatically limits refresh token lifetime and can revoke them
- `access_type=offline` + `prompt=consent` ensures a refresh token is always issued

### PKCE + localStorage (Web App)
- Same PKCE protection as VSCode — prevents authorization code interception
- Refresh token stored in `localStorage` — accessible to any JS on the same origin
- **XSS is the main threat**: if an attacker injects script into the page, they can read the refresh token. Mitigations:
  - Host on a dedicated domain (no other apps sharing the origin)
  - Use Content Security Policy (CSP) headers to block inline scripts and third-party code
  - Sanitize all user inputs — the web app is simple (code input + file upload), so the attack surface is small
- **Alternative: `httpOnly` cookies** — requires a backend to set the cookie and proxy token refresh. Eliminates client-side token exposure but adds server complexity. Not applicable for a static site.
- **Alternative: IndexedDB** — same origin-scoped access as localStorage, no meaningful security difference, but slightly harder to accidentally leak in debugging
- In practice, `localStorage` is the industry standard for SPA refresh tokens when there's no backend. Auth0, Firebase Auth, Supabase, and most SPA auth libraries use this pattern.

### Scope: `drive.file`
- The most restrictive Drive scope available
- App can ONLY access files it created or that were explicitly opened with it
- Cannot see, list, or modify the user's other Drive files
- Google's consent screen clearly shows this limited scope to users

### Client ID Exposure
- The OAuth client ID is a public identifier, not a secret
- It's safe to embed in web apps and extensions
- Google uses the authorized origins/redirect URIs (registered in GCP) to prevent misuse
- Without PKCE or the correct origin, the client ID alone is useless

---

## Production Considerations

### OAuth Consent Screen Verification
- While in "Testing" mode, only manually added test users (max 100) can sign in
- To let anyone use the extension, you must submit for **Google verification**
- Verification requires: privacy policy URL, app homepage, explanation of scope usage
- Apps requesting only `drive.file` scope typically get approved faster (it's a "non-sensitive" scope in Google's classification... actually `drive.file` is a "restricted" scope as of 2024 — see below)

### Important: `drive.file` Scope Classification
- As of 2024, Google classifies `drive.file` as a **"restricted"** scope
- Restricted scopes require a more thorough security assessment (CASA Tier 2 or equivalent)
- Alternative: If you only need to store app data invisibly, `drive.appdata` is a **"non-sensitive"** scope (stores files in a hidden app folder the user never sees)
- Trade-off: `drive.appdata` files are not visible in Drive UI, which may or may not be desirable

### Token Refresh Failures
- Google can revoke refresh tokens at any time (user revoked access, token unused for 6 months, etc.)
- The app must handle refresh failure gracefully → prompt re-authentication
- Google limits each user to 100 outstanding refresh tokens per client ID

### Rate Limits
- Google Drive API: 20,000 queries per 100 seconds (project-wide)
- Per-user: 2,500 queries per 100 seconds
- Our usage pattern (create folder, upload few files, list, download) is well within limits

---

## Resources

### Specifications
- [RFC 6749 — OAuth 2.0 Framework](https://datatracker.ietf.org/doc/html/rfc6749)
- [RFC 7636 — PKCE](https://datatracker.ietf.org/doc/html/rfc7636)
- [RFC 8252 — OAuth 2.0 for Native Apps](https://datatracker.ietf.org/doc/html/rfc8252)

### Google Documentation
- [Google Identity Services — Code Model (PKCE for web)](https://developers.google.com/identity/oauth2/web/guides/use-code-model)
- [Google OAuth 2.0 for Desktop Apps](https://developers.google.com/identity/protocols/oauth2/native-app)
- [Google OAuth 2.0 for Web Server Apps](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Google Drive API Scopes](https://developers.google.com/drive/api/guides/api-specific-auth)
- [OAuth API Verification FAQ](https://support.google.com/cloud/answer/9110914)
- [Google's OAuth 2.0 Policies](https://developers.google.com/identity/protocols/oauth2/policies)

### Security
- [OAuth 2.0 Security Best Current Practice (RFC draft)](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)
- [OWASP OAuth Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/OAuth_Cheat_Sheet.html)
- [Google CASA (Cloud Application Security Assessment)](https://appdefensealliance.dev/casa)

### VSCode-Specific
- [VSCode SecretStorage API](https://code.visualstudio.com/api/references/vscode-api#SecretStorage)
- [VSCode Authentication API](https://code.visualstudio.com/api/references/vscode-api#authentication)
