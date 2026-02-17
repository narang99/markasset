import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

const firebaseConfig = {
  apiKey: "AIzaSyAk0nWceP8APJ1O25hG3iEMYnIfH5sFKMI",
  authDomain: "markasset-project.firebaseapp.com",
  projectId: "markasset-project",
  storageBucket: "markasset-project.firebasestorage.app",
  messagingSenderId: "442356955922",
  appId: "1:442356955922:web:276ea9b96d36862f2e11cb"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

const USER_ID = 'anonymous';

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

    this.initializeEventListeners();
    this.checkForCodeInURL();
  }

  initializeEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.fileInput.addEventListener('change', () => this.handleFileChange());
    this.sessionCodeInput.addEventListener('input', () => this.validateForm());
  }

  checkForCodeInURL() {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && /^\d{3}$/.test(code)) {
      this.sessionCodeInput.value = code;
      this.validateForm();
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
    const hasCode = /^\d{3}$/.test(this.sessionCodeInput.value);
    const hasFiles = this.fileInput.files.length > 0;
    this.uploadBtn.disabled = !hasCode || !hasFiles;
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
    const sessionRef = doc(db, 'users', USER_ID, 'sessions', sessionCode);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error(`Session ${sessionCode} not found or expired`);
    }

    const sessionData = sessionSnap.data();
    if (sessionData.status !== 'active') {
      throw new Error(`Session ${sessionCode} is no longer active`);
    }
  }

  async uploadFiles(sessionCode, files) {
    this.showProgress();

    const uploadedFileIds = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const progress = ((i + 1) / files.length) * 100;

      this.updateProgress(progress, `Uploading ${file.name}...`);

      try {
        const fileId = await this.uploadFile(sessionCode, file);
        uploadedFileIds.push(fileId);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
        throw new Error(`Failed to upload ${file.name}: ${error.message}`);
      }
    }

    await this.updateSessionFiles(sessionCode, uploadedFileIds);
    this.hideProgress();
  }

  async uploadFile(sessionCode, file) {
    const fileId = this.generateFileId();
    const storagePath = `users/${USER_ID}/sessions/${sessionCode}/${fileId}`;

    const storageRef = ref(storage, storagePath);
    await uploadBytes(storageRef, file);

    const fileMetadata = {
      session_code: sessionCode,
      original_name: file.name,
      storage_path: storagePath,
      content_type: file.type,
      size: file.size,
      uploaded_at: new Date()
    };

    const fileRef = doc(db, 'users', USER_ID, 'files', fileId);
    await setDoc(fileRef, fileMetadata);

    return fileId;
  }

  async updateSessionFiles(sessionCode, fileIds) {
    const sessionRef = doc(db, 'users', USER_ID, 'sessions', sessionCode);
    await updateDoc(sessionRef, {
      files: arrayUnion(...fileIds)
    });
  }

  generateFileId() {
    return Date.now().toString() + Math.random().toString(36).substr(2, 9);
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
