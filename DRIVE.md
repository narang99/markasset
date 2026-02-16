# Google Drive Provider — Implementation Plan

### Progress
**Status: ✅ COMPLETE - GoogleDriveProvider implemented and integrated**

**Completed Tasks:**
- [x] ✅ Examined existing CloudProvider interface and FirebaseProvider implementation
- [x] ✅ Created GoogleDriveProvider class implementing all CloudProvider interface methods
- [x] ✅ Implemented ensureRootFolder() method to find/create MarkAsset root folder
- [x] ✅ Implemented generateCode() method with 4-char alphanumeric codes and collision checking
- [x] ✅ Implemented checkSession() method to list files in session folders
- [x] ✅ Implemented deleteSession() method to remove session folders
- [x] ✅ Implemented downloadSessionFiles() method with stream-based file downloads
- [x] ✅ Updated webview.ts to use GoogleDriveProvider instead of FirebaseProvider
- [x] ✅ Updated commands.ts with authentication checks and Google Drive integration
- [x] ✅ Fixed TypeScript compilation issues and verified successful build
- [x] ✅ All authentication flows integrated with existing GoogleAuthService

**Implementation Details:**
- **File Created**: `vscode-extension/src/google-drive-provider.ts` (fully implemented)
- **Files Modified**: 
  - `webview.ts` - Updated constructor to use GoogleDriveProvider
  - `commands.ts` - Added authentication checks and updated to use GoogleDriveProvider
- **Code Generation**: Changed from 3-digit numeric to 4-character alphanumeric (a-z, 0-9)
- **Authentication**: Uses existing GoogleAuthService with access token refresh
- **Compilation**: ✅ TypeScript compiles without errors

**Ready for Testing:**
The implementation is complete and ready for end-to-end testing with:
1. OAuth authentication flow
2. Session code generation 
3. File upload via web interface
4. File download to VSCode workspace

## Overview

Create `GoogleDriveProvider` implementing the `CloudProvider` interface. Google Drive replaces both Firestore (session management) and Firebase Storage (file storage). Sessions are Drive folders. Files are uploaded directly into session folders.

## What Already Exists

- **`cloud-provider.ts`** — Interface to implement:
  ```typescript
  interface CloudProvider {
    generateCode(): Promise<string>;
    checkSession(code: string): Promise<SessionCheckResult>;
    deleteSession(code: string): Promise<void>;
    downloadSessionFiles(sessionCode: string, targetDir: string): Promise<string[]>;
  }
  ```
- **`auth.ts`** — Google OAuth is working. Provides:
  - `GoogleAuthService.getAccessToken()` — returns a valid access token (auto-refreshes)
  - `createClient()` — creates an `OAuth2Client` from `google-auth-library`
  - `getCredentials()` — returns `[clientId, clientSecret]` from settings
- **`googleapis`** — already installed as a dependency
- **`webview.ts`** — already wired to check auth before calling provider methods

## Drive Folder Structure

```
Google Drive (user's own)
└── MarkAsset/                     ← Root folder (created once, ID cached)
    ├── a3k9/                      ← Session folder (4-char alphanumeric code)
    │   ├── session.json           ← Session metadata
    │   ├── photo1.jpg             ← Uploaded file
    │   └── photo2.png             ← Uploaded file
    ├── b7x2/
    │   ├── session.json
    │   └── screenshot.png
    └── ...
```

## Session Metadata (`session.json`)

```json
{
  "created_at": "2026-02-16T12:00:00.000Z",
  "expires_at": "2026-02-16T13:00:00.000Z",
  "status": "active"
}
```

Files are NOT tracked in `session.json`. Instead, list the folder contents via Drive API and exclude `session.json`. This avoids the need to update `session.json` on every upload (which would cause race conditions from the web app side).

## File to Create

### `vscode-extension/src/google-drive-provider.ts`

```typescript
import { CloudProvider, SessionCheckResult, FileInfo } from './cloud-provider';
import { GoogleAuthService } from './auth';
import { google, drive_v3 } from 'googleapis';
```

### Constructor

Takes `GoogleAuthService` to get access tokens. Creates a `drive_v3.Drive` client.

```typescript
class GoogleDriveProvider implements CloudProvider {
  private drive: drive_v3.Drive;
  private rootFolderId: string | undefined;  // cached

  constructor(private authService: GoogleAuthService) {
    // Create drive client. Auth is handled per-request via authService.getAccessToken()
  }
}
```

### Authentication Per Request

Before each Drive API call, get a fresh access token from `authService.getAccessToken()` and set it on the OAuth2Client. The `google-auth-library` OAuth2Client handles this — set credentials with the refresh token, and the `googleapis` library auto-refreshes.

Alternatively, create an authenticated drive client using the refresh token:

```typescript
private async getDrive(): Promise<drive_v3.Drive> {
  const client = createClient();
  const refreshToken = await this.authService.getRefreshToken();
  client.setCredentials({ refresh_token: refreshToken });
  return google.drive({ version: 'v3', auth: client });
}
```

### Method: `ensureRootFolder()`

Private helper. Finds or creates the `MarkAsset` root folder. Caches the folder ID.

```
1. If this.rootFolderId is set, return it
2. Search: drive.files.list({
     q: "name='MarkAsset' and mimeType='application/vnd.google-apps.folder' and trashed=false",
     fields: 'files(id)'
   })
3. If found, cache and return the ID
4. If not found, create it:
   drive.files.create({
     requestBody: { name: 'MarkAsset', mimeType: 'application/vnd.google-apps.folder' },
     fields: 'id'
   })
5. Cache and return the new ID
```

### Method: `generateCode()`

Generates a random 4-character alphanumeric code and creates the session folder.

```
1. Generate random code: 4 chars from [a-z0-9] (1.7M combinations)
2. rootId = await ensureRootFolder()
3. Create session folder:
   drive.files.create({
     requestBody: {
       name: code,
       mimeType: 'application/vnd.google-apps.folder',
       parents: [rootId]
     },
     fields: 'id'
   })
4. Create session.json inside the folder:
   drive.files.create({
     requestBody: {
       name: 'session.json',
       mimeType: 'application/json',
       parents: [folderId]
     },
     media: {
       mimeType: 'application/json',
       body: JSON.stringify({
         created_at: new Date().toISOString(),
         expires_at: new Date(Date.now() + 3600000).toISOString(),
         status: 'active'
       })
     }
   })
5. Return code
```

No collision check needed — 1.7M possible codes vs a handful of active sessions.  
Although, to be sure, please add a simple collision check:
- If the folder exists and is expired, then its fine
- If it is not expired, and we find an existing folder, throw exception, notify user that there was an issue due to collision, and they should recreate the session.

### Method: `checkSession(code: string)`

Finds the session folder and lists its files.

```
1. rootId = await ensureRootFolder()
2. Search for session folder:
   drive.files.list({
     q: "name='{code}' and '{rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
     fields: 'files(id)'
   })
3. If not found, return { exists: false }
4. List files in folder (exclude session.json):
   drive.files.list({
     q: "'{folderId}' in parents and name!='session.json' and trashed=false",
     fields: 'files(id,name,size,mimeType)'
   })
5. Map to FileInfo[]:
   files.map(f => ({
     original_name: f.name,
     size: parseInt(f.size),
     content_type: f.mimeType
   }))
6. Return { exists: true, status: 'active', files }
```

### Method: `deleteSession(code: string)`

Deletes the session folder (Drive cascades to children).

```
1. rootId = await ensureRootFolder()
2. Find session folder (same query as checkSession)
3. If found:
   drive.files.delete({ fileId: folderId })
   // This deletes the folder and all files inside it
```

### Method: `downloadSessionFiles(sessionCode, targetDir)`

Downloads all files from the session folder to a local directory.

```
1. rootId = await ensureRootFolder()
2. Find session folder by code
3. List files (exclude session.json):
   drive.files.list({
     q: "'{folderId}' in parents and name!='session.json' and trashed=false",
     fields: 'files(id,name)'
   })
4. For each file:
   a. Get file content as stream:
      drive.files.get(
        { fileId: file.id, alt: 'media' },
        { responseType: 'stream' }
      )
   b. Pipe stream to fs.createWriteStream(path.join(targetDir, sanitize(file.name)))
   c. Wait for stream to finish
5. Return array of downloaded file paths
```

### Helper: `findSessionFolder(code: string)`

Private helper used by checkSession, deleteSession, and downloadSessionFiles.

```
1. rootId = await ensureRootFolder()
2. drive.files.list({
     q: "name='{code}' and '{rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false",
     fields: 'files(id)',
     pageSize: 1
   })
3. Return files[0]?.id or null
```

### Helper: `sanitizeFileName(name: string)`

Same logic as current `firebase-provider.ts`:
```
return name.replace(/[^a-zA-Z0-9.-]/g, '_');
```

## Wiring into `webview.ts`

Change the constructor to use `GoogleDriveProvider` instead of `FirebaseProvider`:

```typescript
constructor(private context: vscode.ExtensionContext) {
  this.authService = new GoogleAuthService(context);
  this.provider = new GoogleDriveProvider(this.authService);
}
```

Remove the `FirebaseProvider` import.

## Drive API Operations Summary

| Method | Drive API Call | Purpose |
|--------|--------------|---------|
| `ensureRootFolder` | `files.list` + `files.create` | Find/create MarkAsset folder |
| `generateCode` | `files.create` (x2) | Create session folder + session.json |
| `checkSession` | `files.list` (x2) | Find folder + list files |
| `deleteSession` | `files.list` + `files.delete` | Find + delete folder |
| `downloadSessionFiles` | `files.list` + `files.get` (per file) | List + download each file |

## Drive API Query Syntax

All queries use Google Drive's [search query syntax](https://developers.google.com/drive/api/guides/search-files):

- `name='X'` — exact name match
- `'parentId' in parents` — file is inside folder
- `mimeType='application/vnd.google-apps.folder'` — is a folder
- `trashed=false` — not in trash
- Combine with `and`

## Field Masks

Always use `fields` parameter to fetch only needed data:
- Folder search: `files(id)`
- File listing: `files(id,name,size,mimeType)`
- File creation: `id`

This reduces response size and API quota usage.

## Error Handling

| Error | Cause | Action |
|-------|-------|--------|
| 401 | Token expired | `google-auth-library` auto-refreshes. If refresh fails, `authService` clears stored token and throws. |
| 404 | Folder/file deleted externally | Return `{ exists: false }` for checkSession, throw for download |
| 403 | Insufficient permissions | Show error — user may have revoked access |
| 429 | Rate limit | Retry with exponential backoff (googleapis library handles this) |

## Code Generation

```typescript
private generateRandomCode(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
```

4 characters, lowercase alphanumeric. 36^4 = 1,679,616 combinations. No collision check needed.

## Cleanup Strategy

Auto-delete session folder after successful download only. No background cleanup. Manual cleanup via Drive UI or future web app feature.

## Dependencies

Already installed:
- `googleapis` — Google Drive API client
- `google-auth-library` — OAuth2Client (used by auth.ts and googleapis)
