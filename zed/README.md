# MarkAsset Zed Extension

This extension allows you to upload assets from your phone and download them directly into your markdown workspace in Zed.

## Features

- Generate 3-digit session codes
- Upload files from mobile app using session codes
- Automatic polling and downloading of uploaded files
- Configurable Firestore integration

## Setup

1. **Configure Firebase Project**:
   Edit `src/config.rs` and update:
   ```rust
   pub const PROJECT_ID: &'static str = "your-firebase-project-id";
   pub const API_KEY: &'static str = "your-firebase-api-key";
   ```

2. **Build the extension**:
   ```bash
   cargo build --release --target wasm32-wasi
   ```

3. **Install in Zed**:
   Copy the built extension to your Zed extensions directory.

## Usage

The extension provides these main functions:

- `start_asset_session(workspace_dir)` - Generate code and start polling
- `check_session(code)` - Check status of a session  
- `download_session_files(code, workspace_dir)` - Manually download files

## Configuration

All configuration is centralized in `src/config.rs`:

- `PROJECT_ID` - Your Firebase project ID
- `API_KEY` - Firebase API key  
- `USER_ID` - Set to "anonymous" for no-auth mode
- `SESSION_EXPIRY_HOURS` - How long sessions last (default: 1 hour)
- `CODE_LENGTH` - Length of session codes (default: 3 digits)

## Architecture

The extension uses:
- Firestore for session and file metadata
- Firebase Storage for file uploads
- Atomic counters to prevent code collisions
- TTL for automatic session cleanup
- Async polling for real-time file detection

## Testing

**Current Status**: Extension builds but needs command registration for user testing.

**Manual Install**:
1. `cargo build --target wasm32-wasip1 --release`  
2. Copy `zed/` folder to `~/.config/zed/extensions/`
3. Restart Zed

**Next Steps**: Wire up Zed command palette integration

## Resources

- [Zed Extension Documentation](https://zed.dev/docs/extensions/developing-extensions)
- [Zed Extension API (Rust docs)](https://docs.rs/zed_extension_api)  
- [Zed Extensions GitHub](https://github.com/zed-industries/extensions)
- [Firebase Console](https://console.firebase.google.com/)