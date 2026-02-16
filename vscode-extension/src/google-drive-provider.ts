import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CloudProvider, SessionCheckResult, FileInfo } from './cloud-provider';
import { GoogleAuthService, getCredentials } from './auth';
import { google, drive_v3 } from 'googleapis';
import { Readable } from 'stream';

export class GoogleDriveProvider implements CloudProvider {
  private rootFolderId: string | undefined;

  constructor(private authService: GoogleAuthService) {}

  private async getDrive(): Promise<drive_v3.Drive> {
    const [clientId, clientSecret] = getCredentials();
    const refreshToken = await this.authService.getRefreshToken();
    
    // Use googleapis' own OAuth2Client to avoid version conflicts
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    
    return google.drive({ version: 'v3', auth });
  }

  private async ensureRootFolder(): Promise<string> {
    if (this.rootFolderId) {
      return this.rootFolderId;
    }

    const drive = await this.getDrive();

    // Search for existing MarkAsset folder
    const searchResponse = await drive.files.list({
      q: "name='MarkAsset' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id)',
      pageSize: 1
    });

    if (searchResponse.data.files && searchResponse.data.files.length > 0) {
      this.rootFolderId = searchResponse.data.files[0].id!;
      return this.rootFolderId;
    }

    // Create MarkAsset root folder
    const createResponse = await drive.files.create({
      requestBody: {
        name: 'MarkAsset',
        mimeType: 'application/vnd.google-apps.folder'
      },
      fields: 'id'
    });

    this.rootFolderId = createResponse.data.id!;
    return this.rootFolderId;
  }

  private generateRandomCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  }

  private async findSessionFolder(code: string): Promise<string | null> {
    const rootId = await this.ensureRootFolder();
    const drive = await this.getDrive();

    const response = await drive.files.list({
      q: `name='${code}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
      fields: 'files(id)',
      pageSize: 1
    });

    return response.data.files && response.data.files.length > 0
      ? response.data.files[0].id!
      : null;
  }

  private sanitizeFileName(fileName: string): string {
    return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
  }

  private ensureDirectoryExists(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  async generateCode(): Promise<string> {
    const code = this.generateRandomCode();
    const rootId = await this.ensureRootFolder();
    const drive = await this.getDrive();

    // Check for collision (session folder with same code exists and isn't expired)
    const existingFolderId = await this.findSessionFolder(code);
    if (existingFolderId) {
      // Check if session is expired by looking for session.json
      try {
        const sessionFiles = await drive.files.list({
          q: `'${existingFolderId}' in parents and name='session.json' and trashed=false`,
          fields: 'files(id)'
        });

        if (sessionFiles.data.files && sessionFiles.data.files.length > 0) {
          // Session exists, check if expired
          const sessionFileId = sessionFiles.data.files[0].id!;
          const sessionContent = await drive.files.get({
            fileId: sessionFileId,
            alt: 'media'
          });

          const sessionData = JSON.parse(sessionContent.data as string);
          const expiresAt = new Date(sessionData.expires_at);
          const now = new Date();

          if (expiresAt > now) {
            // Session is still active, collision detected
            throw new Error(`Session code collision detected. Please try generating a new session code.`);
          }
          
          // Session is expired, we can reuse the code by deleting the old folder
          await drive.files.delete({ fileId: existingFolderId });
        } else {
          // delete if the folder does not contain session.json
          await drive.files.delete({ fileId: existingFolderId });
        }
      } catch (error) {
        // If we can't read the session file, assume collision and error out
        if (error instanceof Error && error.message.includes('collision')) {
          throw error;
        }
        // Other errors (like missing file) can be ignored - proceed with creation
      }
    }

    // Create session folder
    const folderResponse = await drive.files.create({
      requestBody: {
        name: code,
        mimeType: 'application/vnd.google-apps.folder',
        parents: [rootId]
      },
      fields: 'id'
    });

    const folderId = folderResponse.data.id!;

    // Create session.json inside the folder
    const sessionData = {
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
      status: 'active'
    };

    await drive.files.create({
      requestBody: {
        name: 'session.json',
        mimeType: 'application/json',
        parents: [folderId]
      },
      media: {
        mimeType: 'application/json',
        body: JSON.stringify(sessionData, null, 2)
      }
    });

    return code;
  }

  async checkSession(code: string): Promise<SessionCheckResult> {
    try {
      const folderId = await this.findSessionFolder(code);

      if (!folderId) {
        return { exists: false };
      }

      const drive = await this.getDrive();

      // List files in folder (exclude session.json)
      const filesResponse = await drive.files.list({
        q: `'${folderId}' in parents and name!='session.json' and trashed=false`,
        fields: 'files(id,name,size,mimeType)'
      });

      const files: FileInfo[] = (filesResponse.data.files || []).map(file => ({
        original_name: file.name || 'Unknown',
        size: parseInt(file.size || '0'),
        content_type: file.mimeType || 'application/octet-stream'
      }));

      return {
        exists: true,
        status: 'active',
        files: files
      };
    } catch (error: any) {
      console.error('Session check failed:', error);
      throw new Error(`Failed to check session status: ${error.message}`);
    }
  }

  async deleteSession(code: string): Promise<void> {
    try {
      const folderId = await this.findSessionFolder(code);

      if (folderId) {
        const drive = await this.getDrive();
        await drive.files.delete({ fileId: folderId });
        console.log(`Deleted session folder ${code} (${folderId})`);
      }
    } catch (error: any) {
      console.error('Session cleanup failed:', error);
      // Don't throw - cleanup failures shouldn't block the user
    }
  }

  async downloadSessionFiles(sessionCode: string, targetDir: string): Promise<string[]> {
    try {
      const folderId = await this.findSessionFolder(sessionCode);

      if (!folderId) {
        throw new Error(`Session ${sessionCode} not found`);
      }

      const drive = await this.getDrive();

      // List files (exclude session.json)
      const filesResponse = await drive.files.list({
        q: `'${folderId}' in parents and name!='session.json' and trashed=false`,
        fields: 'files(id,name)'
      });

      const files = filesResponse.data.files || [];
      const downloadedFiles: string[] = [];

      for (const file of files) {
        try {
          // Get file content as stream
          const response = await drive.files.get(
            { fileId: file.id!, alt: 'media' },
            { responseType: 'stream' }
          );

          const fileName = this.sanitizeFileName(file.name || 'unknown');
          const filePath = path.join(targetDir, fileName);

          this.ensureDirectoryExists(path.dirname(filePath));

          // Write stream to file
          const writeStream = fs.createWriteStream(filePath);
          const readableStream = response.data as Readable;

          await new Promise<void>((resolve, reject) => {
            readableStream.pipe(writeStream);
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            readableStream.on('error', reject);
          });

          downloadedFiles.push(filePath);
        } catch (error) {
          console.error(`Failed to download file ${file.name}:`, error);
          vscode.window.showErrorMessage(`Failed to download file ${file.name}: ${error}`);
        }
      }

      return downloadedFiles;
    } catch (error) {
      console.error('Failed to download session files:', error);
      throw error;
    }
  }
}