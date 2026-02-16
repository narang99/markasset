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
  private lastActiveFileDirname: string | undefined;
  private disposables: vscode.Disposable[] = [];

  constructor() {
    this.firebaseService = new FirebaseService();
    this.storageService = new StorageService();
  }

  public async show() {
    // Capture active file's directory before opening webview (which clears activeTextEditor)
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor) {
      this.lastActiveFileDirname = path.dirname(activeEditor.document.uri.fsPath);
    }

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
            await this.downloadFiles(message.folder);
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

  private async downloadFiles(folder: string) {
    if (!this.currentSessionCode) return;

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder open');
      return;
    }

    try {
      let assetsDir: string | undefined;

      if (folder === '__custom__') {
        const selected = await vscode.window.showOpenDialog({
          canSelectFiles: false,
          canSelectFolders: true,
          canSelectMany: false,
          defaultUri: workspaceFolder.uri,
          openLabel: 'Download Assets Here'
        });
        assetsDir = selected?.[0].fsPath;
        if (!assetsDir) {
          this.updateWebview('files-ready', `Files ready for download`, undefined);
          return;
        }
      } else {
        assetsDir = folder;
      }

      this.updateWebview('downloading', 'Downloading files...');

      const downloadedFiles = await this.storageService.downloadSessionFiles(this.currentSessionCode, assetsDir);
      
      if (downloadedFiles.length > 0) {
        const relativePath = path.relative(workspaceFolder.uri.fsPath, assetsDir);
        vscode.window.showInformationMessage(
          `Downloaded ${downloadedFiles.length} files to ${relativePath}`
        );
        this.updateWebview('completed', `Downloaded ${downloadedFiles.length} files successfully`);
        
        // Cleanup session after successful download
        await this.firebaseService.deleteSession(this.currentSessionCode);
        
        // Auto-close after success
        setTimeout(() => this.dispose(), 2000);
      } else {
        this.updateWebview('error', 'No files found to download');
      }

    } catch (error) {
      this.updateWebview('error', `Download failed: ${error}`);
    }
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

    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    const workspaceOption = path.join(workspaceRoot, 'images');
    const fileDirOption = this.lastActiveFileDirname ? path.join(this.lastActiveFileDirname, 'images') : undefined;
    const fileDirIsSameAsWorkspace = fileDirOption === workspaceOption;
    
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
          .folder-options {
            margin: 15px 0;
            text-align: left;
          }
          .folder-options label.section-label {
            display: block;
            margin-bottom: 8px;
          }
          .folder-option {
            display: flex;
            align-items: flex-start;
            gap: 8px;
            padding: 10px 12px;
            margin: 6px 0;
            background: var(--vscode-input-background);
            border: 1px solid var(--vscode-input-border);
            border-radius: 4px;
            cursor: pointer;
          }
          .folder-option:hover:not(.disabled) {
            border-color: var(--vscode-focusBorder);
          }
          .folder-option.selected {
            border-color: var(--vscode-focusBorder);
            background: var(--vscode-list-activeSelectionBackground);
          }
          .folder-option.disabled {
            opacity: 0.5;
            cursor: not-allowed;
          }
          .folder-option input[type="radio"] {
            margin-top: 2px;
            accent-color: var(--vscode-focusBorder);
          }
          .folder-option .option-text {
            flex: 1;
            min-width: 0;
          }
          .folder-option .option-alias {
            font-size: 13px;
            font-family: var(--vscode-editor-font-family);
            color: var(--vscode-textPreformat-foreground);
            background: var(--vscode-textCodeBlock-background);
            padding: 2px 6px;
            border-radius: 3px;
            display: inline-block;
          }
          .folder-option .option-path {
            font-size: 11px;
            opacity: 0.7;
            font-family: var(--vscode-editor-font-family);
            word-break: break-all;
            margin-top: 2px;
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
            <div class="folder-options">
              <label class="section-label">Download to:</label>
              <label class="folder-option selected" onclick="selectOption(this)">
                <input type="radio" name="folder" value="${workspaceOption}" checked>
                <div class="option-text">
                  <div class="option-alias">\${workspaceFolder}/images</div>
                  <div class="option-path">${workspaceOption}</div>
                </div>
              </label>
              <label class="folder-option ${fileDirOption && !fileDirIsSameAsWorkspace ? '' : 'disabled'}" ${fileDirOption && !fileDirIsSameAsWorkspace ? 'onclick="selectOption(this)"' : ''}>
                <input type="radio" name="folder" value="${fileDirOption || ''}" ${!fileDirOption || fileDirIsSameAsWorkspace ? 'disabled' : ''}>
                <div class="option-text">
                  <div class="option-alias">\${fileDirname}/images</div>
                  <div class="option-path">${!fileDirOption ? 'No active file detected' : fileDirIsSameAsWorkspace ? 'Same as workspace root' : fileDirOption}</div>
                </div>
              </label>
              <label class="folder-option" onclick="selectOption(this)">
                <input type="radio" name="folder" value="__custom__">
                <div class="option-text">
                  <div class="option-alias">Choose custom folder...</div>
                  <div class="option-path">Browse for a folder</div>
                </div>
              </label>
            </div>
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
          
          function selectOption(label) {
            if (label.classList.contains('disabled')) return;
            document.querySelectorAll('.folder-option').forEach(el => el.classList.remove('selected'));
            label.classList.add('selected');
            label.querySelector('input[type="radio"]').checked = true;
          }

          function downloadFiles() {
            const checked = document.querySelector('input[name="folder"]:checked');
            const folder = checked ? checked.value : '${workspaceOption}';
            vscode.postMessage({ command: 'downloadFiles', folder });
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