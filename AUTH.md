# MarkAsset Authentication Workflow

## Overview
MarkAsset uses Google OAuth 2.0 for authentication via a slim Cloudflare Workers backend. This replaces the previous Firebase anonymous authentication approach.

## Architecture

```
[Web Client] → [Cloudflare Workers] → [Google OAuth] → [JWT Token] → [Future Google Drive Integration]
```

## Authentication Flow

### 1. Initial State
- User visits web-upload interface
- No authentication required initially
- "Sign in with Google" button available

### 2. OAuth Initiation
```
User clicks "Sign in with Google"
  ↓
Web client redirects to: https://auth.markasset.workers.dev/auth/google
  ↓
Cloudflare Workers initiates Google OAuth flow
  ↓
User redirected to Google's authorization server
```

### 3. User Consent
- Google presents consent screen
- Requested scopes:
  - `openid` - Basic OpenID Connect
  - `email` - User's email address  
  - `profile` - Basic profile info (name, picture)
  - `https://www.googleapis.com/auth/drive.file` - Google Drive file access (for future use)

### 4. OAuth Callback
```
Google redirects back to: https://auth.markasset.workers.dev/auth/google/callback
  ↓
Cloudflare Workers exchanges authorization code for tokens
  ↓
Workers generates signed JWT containing user info
  ↓
Redirect back to web client with JWT in URL fragment
```

### 5. Token Storage
```
Web client extracts JWT from URL
  ↓
Store JWT in localStorage (or sessionStorage for session-only)
  ↓
Parse JWT to extract user profile (name, email, picture)
  ↓
Update UI to show authenticated state
```

## JWT Token Structure

```json
{
  "sub": "google_user_id",
  "email": "user@example.com", 
  "name": "User Name",
  "picture": "https://...",
  "iat": 1640995200,
  "exp": 1640998800,
  "google_access_token": "encrypted_token_for_drive_api"
}
```

## API Endpoints

### Authentication Endpoints (Cloudflare Workers)
- `GET /auth/google` - Initiate OAuth flow
- `GET /auth/google/callback` - Handle OAuth callback
- `POST /auth/verify` - Verify JWT token validity
- `POST /auth/refresh` - Refresh expired tokens

### CORS Configuration
- Allow origins: `http://localhost:3000`, `https://markasset.app` (production domain)
- Allow methods: `GET`, `POST`, `OPTIONS`
- Allow headers: `Authorization`, `Content-Type`

## Security Considerations

### OAuth Security
- **State Parameter**: CSRF protection via cryptographically secure random state
- **PKCE**: Code challenge/verifier for additional security
- **Redirect URI Validation**: Strict whitelist of allowed callback URLs
- **Scope Limitation**: Request minimal necessary permissions

### JWT Security
- **Signing**: JWT signed with strong secret (256-bit minimum)
- **Expiration**: Short-lived tokens (1 hour) with refresh mechanism
- **Storage**: Secure storage considerations:
  - localStorage: Persistent but vulnerable to XSS
  - sessionStorage: Session-only, better security
  - httpOnly cookies: Most secure but requires backend session management

### Transport Security
- **HTTPS Only**: All authentication flows must use HTTPS
- **Secure Cookies**: If using cookies, mark as Secure + SameSite
- **Content Security Policy**: Restrict inline scripts and external resources

### Token Management
- **Rotation**: Implement token refresh before expiration
- **Revocation**: Handle token revocation and cleanup
- **Encryption**: Google Drive tokens encrypted in JWT payload

## Error Handling

### OAuth Errors
- `access_denied` - User denied permission
- `invalid_request` - Malformed OAuth request
- `server_error` - Google OAuth server error

### Authentication States
- `unauthenticated` - No valid token
- `authenticated` - Valid JWT token present
- `expired` - Token expired, needs refresh
- `error` - Authentication error occurred

## Privacy Considerations

### Data Collection
- **Minimal Data**: Only collect necessary profile information
- **No Tracking**: No analytics or tracking beyond essential functionality
- **User Control**: Clear sign-out mechanism

### Data Storage
- **Client-side Only**: User data stored only in browser localStorage
- **No Backend Storage**: Workers backend is stateless
- **Google Drive**: Future file storage in user's own Google Drive

## Future Enhancements

### Phase 1 (Current)
- ✅ Google OAuth integration
- ✅ JWT token management
- ✅ User profile display

### Phase 2 (Planned)
- Google Drive API integration
- File upload to user's Drive
- Drive file organization and management

### Phase 3 (Future)
- Offline token refresh
- Advanced Drive permissions
- Sharing and collaboration features

## Implementation Notes

### Development Setup
- Use localhost callback URLs for development
- Test with multiple Google accounts
- Verify CORS headers work across origins

### Production Deployment  
- Configure production callback URLs
- Set up proper environment variables
- Monitor authentication success/failure rates
- Implement proper logging (without sensitive data)

---

**Last Updated**: 2026-02-17
**Status**: Implementation Phase