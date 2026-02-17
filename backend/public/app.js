const BACKEND_URL = ''; // Same origin, no need for full URL

// Google Drive API helper class using gapi
class GoogleDriveAPI {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.gapiInitialized = false;
  }

  async initializeGapi() {
    if (this.gapiInitialized) return;

    return new Promise((resolve, reject) => {
      if (typeof gapi === 'undefined') {
        reject(new Error('Google API client not loaded'));
        return;
      }

      gapi.load('client', async () => {
        try {
          await gapi.client.init({
            discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
          });
          
          // Set the access token
          gapi.client.setToken({ access_token: this.accessToken });
          this.gapiInitialized = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  async findMarkAssetFolder() {
    await this.initializeGapi();
    
    const response = await gapi.client.drive.files.list({
      q: "name='MarkAsset' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)'
    });
    
    if (response.result.files && response.result.files.length > 0) {
      return response.result.files[0].id;
    }

    // Create MarkAsset folder if it doesn't exist
    const createResponse = await gapi.client.drive.files.create({
      resource: {
        name: 'MarkAsset',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    return createResponse.result.id;
  }

  async findSessionFolder(code, rootFolderId) {
    await this.initializeGapi();
    
    const response = await gapi.client.drive.files.list({
      q: `name='${code}' and '${rootFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)'
    });
    
    return response.result.files && response.result.files.length > 0 ? response.result.files[0].id : null;
  }

  async uploadFile(sessionFolderId, file) {
    await this.initializeGapi();

    const boundary = '-------314159265358979323846';
    const delimiter = "\r\n--" + boundary + "\r\n";
    const close_delim = "\r\n--" + boundary + "--";

    const metadata = {
      'name': file.name,
      'parents': [sessionFolderId]
    };

    // Convert file to array buffer
    const fileData = await file.arrayBuffer();
    const uint8Array = new Uint8Array(fileData);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + file.type + '\r\n\r\n' +
      binaryString +
      close_delim;

    const request = await gapi.client.request({
      'path': '/upload/drive/v3/files',
      'method': 'POST',
      'params': { 'uploadType': 'multipart' },
      'headers': {
        'Content-Type': 'multipart/related; boundary="' + boundary + '"'
      },
      'body': multipartRequestBody
    });

    return request.result;
  }

  async getSessionFiles(sessionFolderId) {
    await this.initializeGapi();
    
    const response = await gapi.client.drive.files.list({
      q: `'${sessionFolderId}' in parents and name!='session.json' and trashed=false`,
      fields: 'files(id,name,size,mimeType)'
    });
    
    return response.result.files || [];
  }

  async getFileContent(fileId) {
    await this.initializeGapi();
    
    const response = await gapi.client.drive.files.get({
      fileId: fileId,
      alt: 'media'
    });
    
    return response.body;
  }
}

class UploadManager {
  constructor() {
    this.form = document.getElementById('uploadForm');
    this.sessionCodeInput = document.getElementById('sessionCode');
    this.fileInput = document.getElementById('fileInput');
    this.fileInfo = document.getElementById('fileInfo');
    this.uploadBtn = document.getElementById('uploadBtn');
    this.progressSection = document.getElementById('progressSection');
    this.progressFill = document.getElementById('progressFill');
    this.progressText = document.getElementById('progressText');
    this.statusSection = document.getElementById('statusSection');
    this.loginBtn = document.getElementById('loginBtn');
    this.logoutBtn = document.getElementById('logoutBtn');
    this.authStatus = document.getElementById('authStatus');

    this.accessToken = null;
    this.driveAPI = null;

    this.initializeEventListeners();
    this.checkForCodeInURL();
    this.checkAuthStatus();
  }

  initializeEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.fileInput.addEventListener('change', () => this.handleFileChange());
    this.sessionCodeInput.addEventListener('input', () => this.validateForm());
    this.loginBtn.addEventListener('click', () => this.handleGoogleLogin());
    this.logoutBtn.addEventListener('click', () => this.handleGoogleLogout());
  }

  checkForCodeInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && /^[a-z0-9]{4}$/.test(code)) {
      this.sessionCodeInput.value = code;
      this.validateForm();
    }
  }

  async checkAuthStatus() {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/token`, {
        credentials: 'include' // Include cookies for session
      });
      
      if (response.ok) {
        const data = await response.json();
        this.accessToken = data.token.token;
        this.driveAPI = new GoogleDriveAPI(this.accessToken);
        this.updateAuthUI(true, data.user);
        
        console.log('🎉 Google OAuth Success!');
        console.log('Access Token:', this.accessToken);
        console.log('User Data:', data.user);
      } else {
        // Not logged in, show login button
        this.updateAuthUI(false);
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.updateAuthUI(false);
    }
  }

  handleFileChange() {
    const files = this.fileInput.files;
    if (files.length > 0) {
      const fileList = Array.from(files).map(file => file.name).join(', ');
      this.fileInfo.textContent = `Selected: ${fileList}`;
      this.fileInfo.style.display = 'block';
    } else {
      this.fileInfo.style.display = 'none';
    }
    this.validateForm();
  }

  validateForm() {
    const hasCode = /^[a-z0-9]{4}$/.test(this.sessionCodeInput.value);
    const hasFiles = this.fileInput.files.length > 0;
    const isAuthenticated = this.accessToken !== null;
    this.uploadBtn.disabled = !hasCode || !hasFiles || !isAuthenticated;
  }

  async handleSubmit(e) {
    e.preventDefault();

    const sessionCode = this.sessionCodeInput.value;
    const files = Array.from(this.fileInput.files);

    try {
      await this.validateSession(sessionCode);
      await this.uploadFiles(sessionCode, files);
      this.showSuccess(`Successfully uploaded ${files.length} files!`);
    } catch (error) {
      console.error('Upload failed:', error);
      this.showError(error.message);
    }
  }

  async validateSession(sessionCode) {
    if (!this.driveAPI) {
      throw new Error('Not authenticated with Google Drive');
    }

    const rootFolderId = await this.driveAPI.findMarkAssetFolder();
    const sessionFolderId = await this.driveAPI.findSessionFolder(sessionCode, rootFolderId);

    if (!sessionFolderId) {
      throw new Error(`Session ${sessionCode} not found or expired`);
    }

    // Check if session.json exists and is valid
    try {
      await this.driveAPI.initializeGapi();
      
      const sessionFiles = await gapi.client.drive.files.list({
        q: `'${sessionFolderId}' in parents and name='session.json' and trashed=false`,
        fields: 'files(id)'
      });

      if (!sessionFiles.result.files || sessionFiles.result.files.length === 0) {
        throw new Error(`Session ${sessionCode} is invalid (missing session data)`);
      }

      // Get session data to check expiry
      const sessionFileId = sessionFiles.result.files[0].id;
      const sessionContent = await this.driveAPI.getFileContent(sessionFileId);

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
  }

  async uploadFiles(sessionCode, files) {
    this.showProgress();

    const sessionFolderId = await this.validateSession(sessionCode);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = ((i + 1) / files.length) * 100;

      this.updateProgress(progress, `Uploading ${file.name}...`);

      try {
        await this.driveAPI.uploadFile(sessionFolderId, file);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    this.hideProgress();
  }


  showProgress() {
    this.uploadBtn.querySelector('.btn-text').style.display = 'none';
    this.uploadBtn.querySelector('.btn-loading').style.display = 'inline';
    this.uploadBtn.disabled = true;
    this.progressSection.style.display = 'block';
  }

  updateProgress(percent, message) {
    this.progressFill.style.width = `${percent}%`;
    this.progressText.textContent = `${Math.round(percent)}% - ${message}`;
  }

  hideProgress() {
    this.progressSection.style.display = 'none';
    this.uploadBtn.querySelector('.btn-text').style.display = 'inline';
    this.uploadBtn.querySelector('.btn-loading').style.display = 'none';
    this.uploadBtn.disabled = false;
  }

  showSuccess(message) {
    this.statusSection.innerHTML = `<div class="status-success">${message}</div>`;
    this.form.reset();
    this.fileInfo.style.display = 'none';
    this.validateForm();
  }

  handleGoogleLogin() {
    // Redirect to your backend's Google OAuth endpoint
    window.location.href = `${BACKEND_URL}/auth/google/callback`;
  }

  async handleGoogleLogout() {
    try {
      const response = await fetch(`${BACKEND_URL}/auth/google/signout`, {
        method: 'POST',
        credentials: 'include' // Include cookies for session
      });
      
      if (response.ok) {
        this.accessToken = null;
        this.driveAPI = null;
        this.updateAuthUI(false);
        console.log('Successfully signed out');
      } else {
        console.error('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  updateAuthUI(isLoggedIn, userData = null) {
    if (isLoggedIn) {
      this.loginBtn.style.display = 'none';
      this.logoutBtn.style.display = 'inline-block';
      this.authStatus.style.display = 'block';
      this.authStatus.textContent = userData ? `Logged in as ${userData.name || userData.email}` : 'Logged in';
    } else {
      this.loginBtn.style.display = 'inline-block';
      this.logoutBtn.style.display = 'none';
      this.authStatus.style.display = 'none';
    }
  }

  showError(message) {
    this.statusSection.innerHTML = `<div class="status-error">Error: ${message}</div>`;
    this.hideProgress();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new UploadManager();
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js');
  });
}
