# MarkAsset - Claude Development Notes

**IMPORTANT**: Always update this file when working on the project. Add new sections, update progress, and note any changes made.

## Project Overview
MarkAsset is an app that streamlines the workflow of adding images to markdown documents. Instead of manually uploading photos from phone to laptop, users can:

1. Generate a 4-character code in VSCode/Zed editor 
2. Upload photos via web interface using the generated code
3. Download assets directly into markdown folder from editor

**Status**: ✅ **COMPLETE AND FUNCTIONAL** - VSCode extension + web upload interface working end-to-end with Google Drive

## Architecture
- **Authentication**: Google OAuth 2.0 for both web and VSCode
- **Storage**: Google Drive (user's personal drive in MarkAsset folder)
- **Session Management**: Google Drive folders and JSON files
- **Frontend**: PWA web interface (`backend/public/`) with offline capability
- **Backend**: Express.js server for Google OAuth handling
- **VSCode**: TypeScript extension with Google Drive API integration
- **Zed**: Native extension (paused due to documentation issues)

## Google Drive Structure
```
/MarkAsset/                           // Root folder in user's Google Drive
  ├── {session_code}/                 // 4-character session folder (e.g., 'a1b2')
  │   ├── session.json                // Session metadata
  │   ├── image1.jpg                  // Uploaded files
  │   └── image2.png
  └── {another_session}/
      ├── session.json
      └── files...

session.json format:
{
  "created_at": "2024-01-01T12:00:00.000Z",
  "expires_at": "2024-01-01T13:00:00.000Z",
  "status": "active"
}
```

## Code Generation Strategy
- 4-character alphanumeric codes (a-z, 0-9): e.g., 'a1b2', 'x9y3'
- Random generation with collision detection
- Session expiry: 1 hour from creation
- Cleanup: Expired sessions are automatically cleaned up during collision checks

## Editor Extensions

### Zed Extension Details
**Location**: `./zed/`
**Status**: ⚠️ Paused due to documentation issues

**Slash Commands**:
- `/asset-code` - Generate 3-digit upload code with Firebase session
- `/asset-check 123` - Check status of session code 123

**Current Implementation**:
- ✅ Extension builds successfully with `cargo build --target wasm32-wasip1`
- ✅ Slash commands registered and working in Zed UI
- ✅ Firebase integration implemented (atomic counters + sessions)
- ✅ Local fallback if Firebase fails
- ⚠️ Firebase HTTP client needs debugging (Zed API compatibility issues)

**Configuration**: 
- Firebase Project ID: `markasset-project` 
- Firebase API Key: Set in `zed/src/config.rs`
- All settings centralized in config file

### VSCode Extension Details
**Location**: `./vscode-extension/`
**Status**: ✅ **COMPLETE AND FULLY FUNCTIONAL**

**Commands**:
- `MarkAsset: Start Upload Session` - Generate 4-character code with Google Drive session
- `MarkAsset: Logout from Google Drive` - Sign out from Google Drive

**Implementation**:
- ✅ TypeScript extension with proper VSCode API integration
- ✅ Google Drive API integration with googleapis SDK
- ✅ Google OAuth 2.0 authentication flow with refresh token storage
- ✅ Random 4-character code generation with collision detection
- ✅ Session creation, validation, and status checking in Google Drive
- ✅ File download from Google Drive with directory selection
- ✅ Progress notifications and error handling
- ✅ Configuration through VSCode settings

**Setup**:
1. `cd vscode-extension && npm install && npm run compile`
2. Press F5 in VSCode to launch Extension Development Host
3. Configure Google OAuth settings in VSCode preferences:
   - `markasset.googleClientId`: Your Google OAuth 2.0 Client ID
   - `markasset.googleClientSecret`: Your Google OAuth 2.0 Client Secret

### Web Upload Interface Details  
**Location**: `./backend/public/`
**Status**: ✅ **COMPLETE PWA WITH GOOGLE DRIVE INTEGRATION**

**Features**:
- ✅ Responsive mobile-first design
- ✅ 4-character code input with validation
- ✅ Multi-file image upload with progress tracking
- ✅ Google OAuth 2.0 authentication
- ✅ Session validation against Google Drive
- ✅ Google Drive API integration for file uploads
- ✅ PWA capabilities (manifest + service worker)
- ✅ Offline caching for app shell
- ✅ URL parameter support (`?code=a1b2`)

**Setup**:
1. `cd backend && npm install && npm start`
2. Access at `http://localhost:3000`
3. Google OAuth credentials configured in backend

**Deployment**: Ready for any hosting platform supporting Node.js

## Google Drive Integration
**Authentication**: OAuth 2.0 with drive.file scope
**Storage**: User's personal Google Drive in MarkAsset folder
**API Version**: Drive v3

**Setup Steps**:
1. ✅ Google Cloud Console project created
2. ✅ Google Drive API enabled
3. ✅ OAuth 2.0 credentials configured (Desktop app type for VSCode, Web app type for backend)
4. ✅ OAuth consent screen configured
5. ✅ Scopes: `https://www.googleapis.com/auth/drive.file`

## End-to-End Testing
**Complete Workflow Test**:
1. **Generate Code**: Run `MarkAsset: Start Upload Session` in VSCode (authenticate with Google if needed)
2. **Upload Files**: Open web interface, sign in with Google, enter 4-character code, select images, upload
3. **Download Files**: In VSCode webview, select target folder and click "Download All"
4. **Verify**: Check that files appear in selected workspace folder

**Test Results**: ✅ All steps working correctly with Google Drive

## Components Status - FINAL
- [x] ✅ **VSCode Extension** - Complete with Google Drive API, OAuth authentication functional
- [x] ✅ **Web Upload Interface** - PWA with offline support, Google Drive integration
- [x] ✅ **Google Drive Integration** - OAuth + Drive API working across all components
- [x] ✅ **End-to-End Flow** - Generate → Upload → Download workflow tested
- [x] ⚠️ **Zed Extension** - Paused due to documentation/API issues
- [x] ✅ **Authentication** - Google OAuth 2.0 for multi-user support

## Quick Start Guide
**For VSCode Extension**:
```bash
cd vscode-extension
npm install && npm run compile
# Press F5 in VSCode, configure Google OAuth settings
```

**For Web Interface**:
```bash  
cd backend
npm install && npm start
# Access at http://localhost:3000
```

**Test Workflow**:
1. Generate code in VSCode → 2. Upload files on web → 3. Download in VSCode

## Deployment Notes
- **Cost**: Free using user's personal Google Drive storage
- **VSCode Extension**: Ready for VS Code Marketplace publishing
- **Web App**: Ready for Heroku, Railway, Vercel, or any Node.js hosting
- **Google OAuth**: User-based authentication, each user has isolated storage
- **Storage**: Files stored in user's personal Google Drive, automatic session cleanup

## Development Architecture
- **VSCode**: TypeScript + Google Drive API (googleapis SDK)
- **Web**: Vanilla JS + Google Drive API (no frameworks, fast loading)
- **Backend**: Node.js/Express + Google OAuth 2.0
- **Zed**: Rust WASM + HTTP API (paused due to API docs)
- **Google Drive**: Drive v3 API (user storage, scalable)

## Webview Code Style (VSCode Extension)
The webview rendering follows a strict separation between data, rendering, and orchestration:

- **Pure renderers** live in `webview-renderers.ts` as exported standalone functions. They take data in, return HTML strings out. No `this`, no `vscode` imports, no side effects. Think of them like stateless React components.
- **Data computation** (e.g. `getFolderOptions()`) lives in the class (`webview.ts`) since it needs access to instance state like `lastActiveFileDirname`.
- **One orchestrator** (`getWebviewContent`) is the single place that wires everything together: computes data, calls renderers with that data, and assembles the final page. Renderers never call other renderers — the orchestrator composes their outputs.
- **Renderers are dumb**: they don't decide what to show or when. They receive pre-computed HTML strings and data as parameters. Conditional logic about what sections to include belongs in the orchestrator, not in the renderers.
- **Never hide errors silently**: When user-provided options or settings are invalid (e.g. relative paths, reserved values), show the option as disabled with a visible error message explaining why. Never silently skip or filter out invalid entries — the user must see what went wrong.

---
**Last Updated**: 2026-02-17 - ✅ **MIGRATED TO GOOGLE DRIVE** - VSCode extension + PWA web interface fully migrated from Firebase to Google Drive with end-to-end testing verified