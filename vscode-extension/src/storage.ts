import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import { getFirebaseApp, USER_ID } from './config';

interface FileMetadata {
  session_code: string;
  original_name: string;
  storage_path: string;
  content_type: string;
  size: number;
  uploaded_at: any;
}

export class StorageService {
  private app = getFirebaseApp();
  private db = getFirestore(this.app);
  private storage = getStorage(this.app);

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
    
    await this.ensureDirectoryExists(path.dirname(filePath));
    
    fs.writeFileSync(filePath, buffer);
    
    return filePath;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }
}