import * as vscode from 'vscode';
import { FirebaseService } from './firebase';
import { StorageService } from './storage';
import * as path from 'path';

export class UploadSessionWebview {
  private panel: vscode.WebviewPanel | undefined;
  private firebaseService: FirebaseService;
  private storageService: StorageService;
  private pollingInterval: NodeJS.Timeout | undefined;
  private currentSessionCode: string | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.firebaseService = new FirebaseService();
    this.storageService = new StorageService();
  }

  public async show() {
    // Create or show the webview panel
    if (this.panel) {
      this.panel.reveal();
      return;
    }

    this.panel = vscode.window.createWebviewPanel(
      'markassetSession',
      'MarkAsset Upload Session',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: []
      }
    );

    // Handle panel disposal
    this.panel.onDidDispose(() => {
      this.dispose();
    }, null, this.disposables);

    // Handle messages from webview
    this.panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case 'downloadFiles':
            await this.downloadFiles();
            break;
          case 'cancel':
            this.dispose();
            break;
        }
      },
      undefined,
      this.disposables
    );

    // Generate session code and start workflow
    await this.startSession();
  }

  private async startSession() {
    try {
      // Show loading state
      this.updateWebview('loading', 'Generating session code...');

      // Generate session code
      this.currentSessionCode = await this.firebaseService.generateCode();

      // Show session code and start polling
      this.updateWebview('waiting', `Session code: ${this.currentSessionCode}`);
      this.startPolling();

    } catch (error) {
      this.updateWebview('error', `Failed to generate session: ${error}`);
    }
  }

  private startPolling() {
    const pollInterval = vscode.workspace.getConfiguration('markasset').get<number>('pollInterval', 2000);
    
    this.pollingInterval = setInterval(async () => {
      await this.checkForFiles();
    }, pollInterval);
  }

  private async checkForFiles() {
    if (!this.currentSessionCode) return;

    try {
      const result = await this.firebaseService.checkSession(this.currentSessionCode);
      
      if (result.exists && result.files && result.files.length > 0) {
        // Stop polling and show files
        this.stopPolling();
        this.updateWebview('files-ready', `${result.files.length} files ready`, result.files);
      }
    } catch (error) {
      // Continue polling on error, but could log if needed
    }
  }

  private async downloadFiles() {
    if (!this.currentSessionCode) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    try {
      this.updateWebview('downloading', 'Selecting download location...');

      const assetsDir = await this.selectAssetsDirectory(workspaceFolder);
      if (!assetsDir) {
        this.updateWebview('files-ready', `Files ready for download`, undefined);
        return;
      }

      this.updateWebview('downloading', 'Downloading files...');

      const downloadedFiles = await this.storageService.downloadSessionFiles(this.currentSessionCode, assetsDir);
      
      if (downloadedFiles.length > 0) {
        const relativePath = path.relative(workspaceFolder.uri.fsPath, assetsDir);
        vscode.window.showInformationMessage(
          `Downloaded ${downloadedFiles.length} files to ${relativePath}`
        );
        this.updateWebview('completed', `Downloaded ${downloadedFiles.length} files successfully`);
        
        // Auto-close after success
        setTimeout(() => this.dispose(), 2000);
      } else {
        this.updateWebview('error', 'No files found to download');
      }

    } catch (error) {
      this.updateWebview('error', `Download failed: ${error}`);
    }
  }

  private async selectAssetsDirectory(workspaceFolder: vscode.WorkspaceFolder): Promise<string | undefined> {
    const options: vscode.QuickPickItem[] = [
      { label: 'assets/', description: 'Create/use assets folder in workspace root' },
      { label: 'images/', description: 'Create/use images folder in workspace root' },
      { label: 'Choose custom folder...', description: 'Select a different folder' }
    ];

    const selection = await vscode.window.showQuickPick(options, {
      placeHolder: 'Where should assets be downloaded?'
    });

    if (!selection) {
      return undefined;
    }

    if (selection.label === 'Choose custom folder...') {
      const customFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        defaultUri: workspaceFolder.uri,
        openLabel: 'Select Assets Folder'
      });

      return customFolder?.[0].fsPath;
    }

    return path.join(workspaceFolder.uri.fsPath, selection.label);
  }

  private stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = undefined;
    }
  }

  private updateWebview(state: string, message: string, files?: any[]) {
    if (!this.panel) return;

    this.panel.webview.html = this.getWebviewContent(state, message, files);
  }

  private getWebviewContent(state: string, message: string, files?: any[]): string {
    const filesList = files ? files.map(file => `<div class="file-item">${file.original_name || 'Unknown file'}</div>`).join('') : '';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>MarkAsset Upload Session</title>
        <style>
          body {
            font-family: var(--vscode-font-family);
            background: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            padding: 20px;
            margin: 0;
          }
          .container {
            max-width: 400px;
            margin: 0 auto;
            text-align: center;
          }
          .session-code {
            font-size: 48px;
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            margin: 20px 0;
            font-family: var(--vscode-editor-font-family);
            user-select: all;
            cursor: text;
            padding: 10px;
            border: 2px dashed var(--vscode-textLink-foreground);
            border-radius: 8px;
          }
          .status {
            font-size: 16px;
            margin: 15px 0;
          }
          .polling-indicator {
            display: inline-block;
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: var(--vscode-textLink-foreground);
            animation: pulse 1.5s infinite;
            margin-left: 5px;
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 1; }
          }
          .files-section {
            margin: 20px 0;
            text-align: left;
          }
          .file-item {
            padding: 8px 12px;
            margin: 5px 0;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            font-family: var(--vscode-editor-font-family);
          }
          .button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin: 5px;
          }
          .button:hover {
            background: var(--vscode-button-hoverBackground);
          }
          .button.secondary {
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
          }
          .button.secondary:hover {
            background: var(--vscode-button-secondaryHoverBackground);
          }
          .error {
            color: var(--vscode-errorForeground);
          }
          .success {
            color: var(--vscode-terminal-ansiGreen);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>MarkAsset Upload Session</h2>
          
          ${state === 'loading' ? `
            <div class="status">${message}</div>
          ` : ''}
          
          ${state === 'waiting' && this.currentSessionCode ? `
            <div class="session-code">${this.currentSessionCode}</div>
            <div class="status">
              Waiting for uploads...
              <span class="polling-indicator"></span>
            </div>
            <p>Use this code on the upload page</p>
          ` : ''}
          
          ${state === 'files-ready' ? `
            <div class="session-code">${this.currentSessionCode}</div>
            <div class="status success">${message}</div>
            ${files ? `
              <div class="files-section">
                <h3>Ready to download:</h3>
                ${filesList}
              </div>
            ` : ''}
            <button class="button" onclick="downloadFiles()">Download All</button>
          ` : ''}
          
          ${state === 'downloading' ? `
            <div class="status">${message}</div>
          ` : ''}
          
          ${state === 'completed' ? `
            <div class="status success">${message}</div>
            <p>Session completed successfully!</p>
          ` : ''}
          
          ${state === 'error' ? `
            <div class="status error">${message}</div>
          ` : ''}
          
          <div style="margin-top: 30px;">
            <button class="button secondary" onclick="cancel()">Cancel</button>
          </div>
        </div>

        <script>
          const vscode = acquireVsCodeApi();
          
          function downloadFiles() {
            vscode.postMessage({ command: 'downloadFiles' });
          }
          
          function cancel() {
            vscode.postMessage({ command: 'cancel' });
          }
        </script>
      </body>
      </html>
    `;
  }

  public dispose() {
    this.stopPolling();
    
    if (this.panel) {
      this.panel.dispose();
      this.panel = undefined;
    }

    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.currentSessionCode = undefined;
  }
}