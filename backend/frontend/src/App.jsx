import { useState } from 'react';
import { useAuth } from './hooks/useAuth';
import { GoogleDriveAPI } from './utils/googleDriveAPI';
import { Header } from './components/Header';
import { UploadForm } from './components/UploadForm';
import { ProgressBar } from './components/ProgressBar';
import { StatusMessage } from './components/StatusMessage';

function App() {
  const { accessToken, user, isAuthenticated, login, logout } = useAuth();
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [showProgress, setShowProgress] = useState(false);
  const [status, setStatus] = useState({ message: '', type: '' });

  const validateSession = async (driveAPI, sessionCode) => {
    const rootFolderId = await driveAPI.findMarkAssetFolder();
    const sessionFolderId = await driveAPI.findSessionFolder(sessionCode, rootFolderId);

    if (!sessionFolderId) {
      throw new Error(`Session ${sessionCode} not found or expired`);
    }

    // Check if session.json exists and is valid
    try {
      await driveAPI.initializeGapi();
      
      const sessionFiles = await window.gapi.client.drive.files.list({
        q: `'${sessionFolderId}' in parents and name='session.json' and trashed=false`,
        fields: 'files(id)'
      });

      if (!sessionFiles.result.files || sessionFiles.result.files.length === 0) {
        throw new Error(`Session ${sessionCode} is invalid (missing session data)`);
      }

      // Get session data to check expiry
      const sessionFileId = sessionFiles.result.files[0].id;
      const sessionContent = await driveAPI.getFileContent(sessionFileId);

      const sessionData = JSON.parse(sessionContent);
      const expiresAt = new Date(sessionData.expires_at);
      const now = new Date();

      if (expiresAt < now) {
        throw new Error(`Session ${sessionCode} has expired`);
      }

      return sessionFolderId;
    } catch (error) {
      if (error.message.includes('expired') || error.message.includes('invalid')) {
        throw error;
      }
      throw new Error(`Session ${sessionCode} validation failed: ${error.message}`);
    }
  };

  const uploadFiles = async (sessionCode, files) => {
    if (!accessToken) {
      throw new Error('Not authenticated with Google Drive');
    }

    const driveAPI = new GoogleDriveAPI(accessToken);
    
    setShowProgress(true);
    setStatus({ message: '', type: '' });

    try {
      const sessionFolderId = await validateSession(driveAPI, sessionCode);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const progressPercent = ((i + 1) / files.length) * 100;

        setProgress(progressPercent);
        setProgressMessage(`Uploading ${file.name}...`);

        try {
          await driveAPI.uploadFile(sessionFolderId, file);
        } catch (error) {
          console.error(`Failed to upload ${file.name}:`, error);
          throw new Error(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      setStatus({ 
        message: `Successfully uploaded ${files.length} files!`, 
        type: 'success' 
      });
      
    } catch (error) {
      console.error('Upload failed:', error);
      setStatus({ 
        message: error.message, 
        type: 'error' 
      });
    } finally {
      setShowProgress(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  return (
    <div className="container">
      <Header 
        user={user}
        isAuthenticated={isAuthenticated}
        onLogin={login}
        onLogout={logout}
      />
      {isAuthenticated ? (
        <main>
          <UploadForm 
            isAuthenticated={isAuthenticated}
            onSubmit={uploadFiles}
          />
          <ProgressBar 
            progress={progress}
            message={progressMessage}
            isVisible={showProgress}
          />
          <StatusMessage 
            message={status.message}
            type={status.type}
          />
        </main>
      ) : (
        <main>
          <div className="auth-prompt">
            <p>Please sign in with your Google account to upload images to your Google Drive.</p>
          </div>
        </main>
      )}
    </div>
  );
}

export default App;