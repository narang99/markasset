# MarkAsset - Claude Development Notes

**IMPORTANT**: Always update this file when working on the project. Add new sections, update progress, and note any changes made.

## Project Overview
MarkAsset is an app that streamlines the workflow of adding images to markdown documents. Instead of manually uploading photos from phone to laptop, users can:

1. Generate a 3-digit code in VSCode/Zed editor 
2. Upload photos via web interface using the generated code
3. Download assets directly into markdown folder from editor

**Status**: ✅ **COMPLETE AND FUNCTIONAL** - VSCode extension + web upload interface working end-to-end

## Architecture
- **Database**: Firestore with user-scoped collections
- **Storage**: Firebase Storage (`markasset-project.firebasestorage.app`)
- **Frontend**: PWA web interface with offline capability
- **Backend**: Serverless (Firestore + security rules only)
- **VSCode**: TypeScript extension with Firebase SDK integration
- **Zed**: Native extension (paused due to documentation issues)

## Database Structure
```
/users/{user_id}/meta/session_counter
  - value: 0  // Atomic counter for code generation

/users/{user_id}/sessions/{code}  
  - created_at: timestamp
  - expires_at: timestamp (TTL - 1 hour)
  - files: array of file_ids
  - status: "active" | "completed"

/users/{user_id}/files/{file_id}
  - session_code: string
  - original_name: string  
  - storage_path: string
  - content_type: string
  - size: number
  - uploaded_at: timestamp
```

## Code Generation Strategy
- Per-user atomic counter with 3-digit codes (001-999, then cycles)
- TTL handles expiry and cleanup automatically
- Collision handling: Error out if session exists (rare after TTL)
- No-auth phase: All users use `user_id = "anonymous"`

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
- `MarkAsset: Generate Asset Upload Code` - Generate 3-digit code with Firebase session
- `MarkAsset: Check Session Status` - Check session status and file count  
- `MarkAsset: Download Assets` - Download files from Firebase Storage to workspace

**Implementation**:
- ✅ TypeScript extension with proper VSCode API integration
- ✅ Firebase SDK integration (replaced Axios with official SDK)
- ✅ Atomic counter management with fallback to local generation
- ✅ Session creation, validation, and status checking
- ✅ File download from Firebase Storage with directory selection
- ✅ Progress notifications and error handling
- ✅ Configuration through VSCode settings

**Setup**:
1. `cd vscode-extension && npm install && npm run compile`
2. Press F5 in VSCode to launch Extension Development Host
3. Configure Firebase settings in VSCode preferences:
   - `markasset.firebaseProjectId`: `markasset-project`
   - `markasset.firebaseApiKey`: `AIzaSyAk0nWceP8APJ1O25hG3iEMYnIfH5sFKMI`

### Web Upload Interface Details  
**Location**: `./web-upload/`
**Status**: ✅ **COMPLETE PWA WITH OFFLINE SUPPORT**

**Features**:
- ✅ Responsive mobile-first design
- ✅ 3-digit code input with validation
- ✅ Multi-file image upload with progress tracking
- ✅ Session validation against Firestore
- ✅ Firebase Storage integration with SDK
- ✅ PWA capabilities (manifest + service worker)
- ✅ Offline caching for app shell
- ✅ URL parameter support (`?code=123`)

**Setup**:
1. `cd web-upload && npx serve .`
2. Access at `http://localhost:3000`
3. Firebase config already set in `app.js`

**Deployment**: Ready for Firebase Hosting, Netlify, or any static host

## Firebase Configuration
**Project**: `markasset-project`
**API Key**: `AIzaSyAk0nWceP8APJ1O25hG3iEMYnIfH5sFKMI`
**Storage Bucket**: `markasset-project.firebasestorage.app`

**Setup Steps**:
1. ✅ Firebase project created: `markasset-project`
2. ✅ Firestore Database enabled (test mode)
3. ✅ Firebase Storage enabled
4. ✅ Security rules configured for anonymous access
5. ✅ Storage bucket paths aligned across all components

## End-to-End Testing
**Complete Workflow Test**:
1. **Generate Code**: Run `MarkAsset: Generate Asset Upload Code` in VSCode
2. **Upload Files**: Open web interface, enter code, select images, upload
3. **Check Status**: Run `MarkAsset: Check Session Status` in VSCode with code
4. **Download Files**: Run `MarkAsset: Download Assets` in VSCode, select folder
5. **Verify**: Check that files appear in selected workspace folder

**Test Results**: ✅ All steps working correctly

## Components Status - FINAL
- [x] ✅ **VSCode Extension** - Complete with Firebase SDK, all commands functional
- [x] ✅ **Web Upload Interface** - PWA with offline support, Firebase integration
- [x] ✅ **Firebase Integration** - Firestore + Storage working across all components
- [x] ✅ **End-to-End Flow** - Generate → Upload → Download workflow tested
- [x] ⚠️ **Zed Extension** - Paused due to documentation/API issues
- [ ] 🔮 **Authentication** - Future enhancement for multi-user support

## Quick Start Guide
**For VSCode Extension**:
```bash
cd vscode-extension
npm install && npm run compile
# Press F5 in VSCode, configure Firebase settings
```

**For Web Interface**:
```bash  
cd web-upload
npx serve .
# Access at http://localhost:3000
```

**Test Workflow**:
1. Generate code in VSCode → 2. Upload files on web → 3. Download in VSCode

## Deployment Notes
- **Cost**: $0/month on Firebase free tier
- **VSCode Extension**: Ready for VS Code Marketplace publishing
- **Web App**: Ready for Firebase Hosting, Netlify, Vercel deployment
- **Firebase**: Anonymous auth, no user management needed
- **Storage**: Automatic cleanup via TTL on Firestore sessions

## Development Architecture
- **VSCode**: TypeScript + Firebase SDK (official, reliable)
- **Web**: Vanilla JS + Firebase SDK (no frameworks, fast loading)
- **Zed**: Rust WASM + HTTP API (paused due to API docs)
- **Firebase**: Firestore + Storage (serverless, scalable)

## Webview Code Style (VSCode Extension)
The webview rendering follows a strict separation between data, rendering, and orchestration:

- **Pure renderers** live in `webview-renderers.ts` as exported standalone functions. They take data in, return HTML strings out. No `this`, no `vscode` imports, no side effects. Think of them like stateless React components.
- **Data computation** (e.g. `getFolderOptions()`) lives in the class (`webview.ts`) since it needs access to instance state like `lastActiveFileDirname`.
- **One orchestrator** (`getWebviewContent`) is the single place that wires everything together: computes data, calls renderers with that data, and assembles the final page. Renderers never call other renderers — the orchestrator composes their outputs.
- **Renderers are dumb**: they don't decide what to show or when. They receive pre-computed HTML strings and data as parameters. Conditional logic about what sections to include belongs in the orchestrator, not in the renderers.
- **Never hide errors silently**: When user-provided options or settings are invalid (e.g. relative paths, reserved values), show the option as disabled with a visible error message explaining why. Never silently skip or filter out invalid entries — the user must see what went wrong.

---
**Last Updated**: 2026-02-15 - ✅ **PROJECT COMPLETE** - VSCode extension + PWA web interface fully functional with end-to-end testing verified