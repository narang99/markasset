# MarkAsset Web Upload PWA

✅ **COMPLETE PWA** - Mobile-first web interface for uploading images with 3-digit codes.

## Features

- 📱 **Mobile-Optimized**: Responsive design, optimized for phone usage
- 📤 **Multi-File Upload**: Select and upload multiple images simultaneously  
- 🔄 **Progress Tracking**: Real-time upload progress with visual feedback
- ✅ **Session Validation**: Validates codes against Firebase before upload
- 🚀 **PWA Capabilities**: Offline app shell, installable on mobile devices
- ☁️ **Firebase Integration**: Direct Firebase Storage upload with SDK
- 🔗 **URL Parameters**: Support for `?code=123` pre-filling

## Quick Setup

**Firebase config is already configured** - no setup needed!

1. **Serve locally**:
   ```bash
   cd web-upload
   npx serve .
   ```

2. **Access**: `http://localhost:3000`

3. **Test**: Use any 3-digit code generated from VSCode extension

## Complete Usage Workflow

1. **Get Code**: Generate 3-digit code from VSCode extension (e.g., "123")

2. **Open Web App**: 
   - Direct: `http://localhost:3000`
   - With code: `http://localhost:3000?code=123` (pre-fills code)

3. **Upload Process**:
   - Enter/verify 3-digit session code
   - Tap "Select Images" to choose multiple files
   - Review selected files in preview
   - Tap "Upload Images" button
   - Watch progress bar and status updates
   - Get success confirmation

4. **Download**: Return to VSCode extension to download uploaded files

## Technical Architecture

- **Frontend**: Vanilla JavaScript (no frameworks - fast loading)
- **Firebase**: Official Firebase v10 SDK via CDN
- **Storage**: Direct uploads to `markasset-project.firebasestorage.app`
- **PWA**: Service worker with app shell caching
- **Mobile**: Touch-friendly UI, viewport optimized

## File Structure

```
web-upload/
├── index.html          # Main app interface
├── app.js             # Upload logic + Firebase integration  
├── styles.css         # Mobile-first responsive styles
├── manifest.json      # PWA manifest
├── sw.js             # Service worker for offline caching
└── README.md         # This file
```

## PWA Installation

**Mobile Browsers**:
- Chrome/Safari: "Add to Home Screen" option appears
- Installs as native-feeling app
- Offline app shell works without internet

**Desktop**:
- Chrome: Install button in address bar
- Works as desktop app window

## Firebase Configuration

**Already configured** in `app.js`:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSyAk0nWceP8APJ1O25hG3iEMYnIfH5sFKMI",
  projectId: "markasset-project", 
  storageBucket: "markasset-project.firebasestorage.app"
};
```

## Deployment Options

**Static Hosting** (recommended):
- **Firebase Hosting**: `firebase deploy`
- **Netlify**: Drag & drop folder or Git deploy
- **Vercel**: Git integration with zero config
- **GitHub Pages**: Push to gh-pages branch

**Custom Domain**: All hosts support custom domains

**HTTPS Required**: PWA features need HTTPS (automatic on all hosts)

## Error Handling

- **Session Not Found**: Clear error if code doesn't exist/expired
- **Upload Failures**: Individual file error reporting
- **Network Issues**: Graceful degradation with retry options
- **File Validation**: Client-side file type checking

## Testing

**Local Testing**:
```bash
npx serve .
# Test with different codes from VSCode extension
```

**Mobile Testing**:
- Use ngrok for HTTPS: `npx ngrok http 3000`
- Test PWA installation and offline features
- Verify touch interactions and responsive design

**End-to-End Test**:
1. Generate code in VSCode → 2. Upload via web → 3. Verify in Firebase Console → 4. Download in VSCode

## Browser Support

- **Modern Browsers**: Chrome, Safari, Firefox, Edge
- **PWA Features**: Chrome/Edge (full), Safari (partial)
- **File Upload**: All modern browsers
- **Offline**: Service Worker supported browsers

## Performance

- **First Load**: ~100KB (including Firebase SDK)
- **Cached Load**: <10KB (app shell cached)
- **Upload**: Direct to Firebase (no server bottleneck)
- **Mobile**: Optimized for 3G+ connections

Ready for production deployment! 🚀