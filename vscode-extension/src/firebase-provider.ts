import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, Timestamp, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp, USER_ID, SESSION_TTL_HOURS } from './config';
import { CloudProvider, SessionCheckResult, FileInfo } from './cloud-provider';

interface SessionData {
  created_at: Timestamp;
  expires_at: Timestamp;
  files: string[];
  status: 'active' | 'completed';
}

interface CounterData {
  value: number;
}

interface FileMetadata {
  session_code: string;
  original_name: string;
  storage_path: string;
  content_type: string;
  size: number;
  uploaded_at: any;
}

export class FirebaseProvider implements CloudProvider {
  private app = getFirebaseApp();
  private db = getFirestore(this.app);
  private storage = getStorage(this.app);

  async generateCode(): Promise<string> {
    try {
      const counter = await this.getAndIncrementCounter();
      const code = counter.toString().padStart(3, '0');

      await this.createSession(code);

      return code;
    } catch (error) {
      console.error('Firebase code generation failed:', error);
      vscode.window.showWarningMessage('Firebase connection failed, using local code generation');
      return this.generateLocalCode();
    }
  }

  async checkSession(code: string): Promise<SessionCheckResult> {
    try {
      const sessionRef = doc(this.db, 'users', USER_ID, 'sessions', code);
      const sessionSnap = await getDoc(sessionRef);

      if (!sessionSnap.exists()) {
        return { exists: false };
      }

      const sessionData = sessionSnap.data() as SessionData;

      console.log("session data", sessionData);
      const fileIds = sessionData.files || [];

      const files: FileInfo[] = [];
      for (const fileId of fileIds) {
        try {
          const fileRef = doc(this.db, 'users', USER_ID, 'files', fileId);
          const fileSnap = await getDoc(fileRef);
          if (fileSnap.exists()) {
            const data = fileSnap.data() as FileMetadata;
            files.push({
              original_name: data.original_name,
              size: data.size,
              content_type: data.content_type,
            });
          }
        } catch (error) {
          console.error(`Failed to get file metadata for ${fileId}:`, error);
        }
      }

      return {
        exists: true,
        status: sessionData.status,
        files: files
      };
    } catch (error: any) {
      console.error('Session check failed:', error);
      throw new Error(`Failed to check session status: ${error.message}`);
    }
  }

  async deleteSession(code: string): Promise<void> {
    try {
      const sessionRef = doc(this.db, 'users', USER_ID, 'sessions', code);
      await deleteDoc(sessionRef);

      const filesQuery = query(
        collection(this.db, 'users', USER_ID, 'files'),
        where('session_code', '==', code)
      );
      const filesSnap = await getDocs(filesQuery);

      const deletePromises = filesSnap.docs.map(doc => deleteDoc(doc.ref));
      await Promise.all(deletePromises);

      console.log(`Cleaned up session ${code} and ${filesSnap.docs.length} associated files`);
    } catch (error: any) {
      console.error('Session cleanup failed:', error);
    }
  }

  async downloadSessionFiles(sessionCode: string, targetDir: string): Promise<string[]> {
    try {
      const fileIds = await this.getSessionFiles(sessionCode);
      const downloadedFiles: string[] = [];

      for (const fileId of fileIds) {
        try {
          const filePath = await this.downloadFile(fileId, targetDir);
          downloadedFiles.push(filePath);
        } catch (error) {
          console.error(`Failed to download file ${fileId}:`, error);
          vscode.window.showErrorMessage(`Failed to download file ${fileId}: ${error}`);
        }
      }

      return downloadedFiles;
    } catch (error) {
      console.error('Failed to download session files:', error);
      throw error;
    }
  }

  // --- Private helpers ---

  private async getAndIncrementCounter(): Promise<number> {
    const counterRef = doc(this.db, 'users', USER_ID, 'meta', 'session_counter');

    try {
      const counterSnap = await getDoc(counterRef);

      if (!counterSnap.exists()) {
        await setDoc(counterRef, { value: 1 });
        return 1;
      }

      const currentValue = (counterSnap.data() as CounterData).value;
      const newValue = (currentValue + 1) % 1000;
      const finalValue = newValue === 0 ? 1000 : newValue;

      await updateDoc(counterRef, {
        value: increment(1)
      });

      return finalValue;
    } catch (error) {
      console.error('Counter increment failed:', error);
      throw error;
    }
  }

  private async createSession(code: string): Promise<void> {
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + SESSION_TTL_HOURS * 60 * 60 * 1000);

    const sessionRef = doc(this.db, 'users', USER_ID, 'sessions', code);

    const sessionData: SessionData = {
      created_at: now,
      expires_at: expiresAt,
      files: [],
      status: 'active'
    };

    await setDoc(sessionRef, sessionData);
  }

  private async getSessionFiles(sessionCode: string): Promise<string[]> {
    const sessionRef = doc(this.db, 'users', USER_ID, 'sessions', sessionCode);
    const sessionSnap = await getDoc(sessionRef);

    if (!sessionSnap.exists()) {
      throw new Error(`Session ${sessionCode} not found`);
    }

    const sessionData = sessionSnap.data();
    return sessionData.files || [];
  }

  private async downloadFile(fileId: string, targetDir: string): Promise<string> {
    const fileMetadataRef = doc(this.db, 'users', USER_ID, 'files', fileId);
    const fileSnap = await getDoc(fileMetadataRef);

    if (!fileSnap.exists()) {
      throw new Error(`File metadata ${fileId} not found`);
    }

    const metadata = fileSnap.data() as FileMetadata;

    const storageRef = ref(this.storage, metadata.storage_path);
    const downloadUrl = await getDownloadURL(storageRef);

    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to download file: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const fileName = this.sanitizeFileName(metadata.original_name);
    const filePath = path.join(targetDir, fileName);

    this.ensureDirectoryExists(path.dirname(filePath));

    fs.writeFileSync(filePath, buffer);

    return filePath;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private generateLocalCode(): string {
    return Math.floor(Math.random() * 900 + 100).toString();
  }
}
