# MarkAsset VSCode Extension

✅ **COMPLETE & FUNCTIONAL** - Streamline adding images to markdown documents with upload codes.

## Features

- **Generate Upload Code**: Create a 3-digit code for uploading assets with Firebase session
- **Check Session Status**: Monitor upload sessions, file counts, and download readiness
- **Download Assets**: Download uploaded files directly to your workspace with folder selection
- **Firebase Integration**: Full Firebase SDK integration with automatic fallback
- **Progress Tracking**: Visual progress indicators and error handling

## Commands

- `MarkAsset: Generate Asset Upload Code` - Generate new 3-digit upload code
- `MarkAsset: Check Session Status` - Check session status and file count
- `MarkAsset: Download Assets` - Download files from session to workspace

## Quick Setup

1. **Install dependencies**:
   ```bash
   cd vscode-extension
   npm install && npm run compile
   ```

2. **Launch development**:
   - Press `F5` in VSCode to open Extension Development Host

3. **Configure Firebase** (in VSCode settings):
   - `markasset.firebaseProjectId`: `markasset-project`
   - `markasset.firebaseApiKey`: `AIzaSyAk0nWceP8APJ1O25hG3iEMYnIfH5sFKMI`

## Complete Workflow

1. **Generate Code**: `Cmd+Shift+P` → "MarkAsset: Generate Asset Upload Code"
   - Gets 3-digit code (e.g., "123")
   - Creates Firebase session with 1-hour TTL
   - Option to copy code or open upload URL

2. **Upload Files**: Use web interface at uploaded location
   - Enter the 3-digit code
   - Select multiple image files
   - Files upload to Firebase Storage

3. **Check Status**: `Cmd+Shift+P` → "MarkAsset: Check Session Status"
   - Enter the 3-digit code
   - See file count and session status
   - Option to download if files available

4. **Download Files**: `Cmd+Shift+P` → "MarkAsset: Download Assets"
   - Choose destination folder (assets/, images/, or custom)
   - Files download from Firebase Storage to workspace
   - Progress tracking and success notification

## Technical Details

- **Firebase SDK**: Official Firebase v10 SDK (not custom HTTP)
- **Storage**: `markasset-project.firebasestorage.app`
- **Database**: Firestore with atomic counters and TTL sessions
- **Fallback**: Local code generation if Firebase unavailable
- **File Handling**: Sanitized filenames, directory creation, progress tracking

## Testing

**Development Mode**:
```bash
npm run watch  # Auto-recompile on changes
# Reload Extension Host with Cmd+R after changes
```

**End-to-End Test**:
1. Generate code → 2. Upload via web → 3. Check status → 4. Download files
2. Verify files appear in workspace folder

## Troubleshooting

**Firebase Connection Issues**:
- Check API key in VSCode settings
- Verify internet connection
- Extension falls back to local codes automatically

**Download Issues**:
- Ensure session code exists and has files
- Check workspace folder permissions
- Files are sanitized (special characters become `_`)

**Development Issues**:
- Run `npm run compile` after changes
- Reload Extension Host (`Cmd+R`) to see updates
- Check VSCode Developer Console for errors

## Architecture

- **TypeScript**: Full type safety with Firebase SDK types
- **Firebase**: Firestore for sessions, Storage for files
- **VSCode API**: Native progress notifications and folder selection
- **Error Handling**: Graceful fallbacks and user-friendly messages

## Deployment

Ready for VS Code Marketplace publishing - all functionality tested and working.