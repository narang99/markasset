import * as vscode from 'vscode';
import { FirebaseService } from './firebase';
import { StorageService } from './storage';
import * as path from 'path';
import { FolderOption, renderFolderPicker, renderFilesList, renderStateContent, renderStyles, renderScript, renderPage } from './webview-renderers';

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

  // --- Data ---

  private resolvePathVariables(rawPath: string): { resolved: string | undefined; disabled: boolean; disabledReason: string } {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

    // Check for relative paths (doesn't start with a variable or /)
    const startsWithVariable = rawPath.includes('${workspaceFolder}') || rawPath.includes('${fileDirname}');
    if (!startsWithVariable && !path.isAbsolute(rawPath)) {
      return { resolved: undefined, disabled: true, disabledReason: 'Relative paths are not allowed — use ${workspaceFolder} or ${fileDirname}' };
    }

    let resolved = rawPath;
    resolved = resolved.replace(/\$\{workspaceFolder\}/g, workspaceRoot);

    if (resolved.includes('${fileDirname}')) {
      if (!this.lastActiveFileDirname) {
        return { resolved: undefined, disabled: true, disabledReason: 'No active file detected' };
      }
      resolved = resolved.replace(/\$\{fileDirname\}/g, this.lastActiveFileDirname);
    }

    return { resolved, disabled: false, disabledReason: '' };
  }

  private buildOption(rawPath: string, isSelected: boolean): FolderOption {
    const { resolved, disabled, disabledReason } = this.resolvePathVariables(rawPath);
    return {
      alias: rawPath,
      message: disabled ? disabledReason : resolved!,
      value: resolved || '',
      disabled,
      selected: isSelected,
    };
  }

  private getDefaultPaths(): string[] {
    return ['${workspaceFolder}/images', '${fileDirname}/images'];
  }

  private getFolderOptions(): FolderOption[] {
    const customPaths = vscode.workspace.getConfiguration('markasset').get<string[]>('downloadPaths', []);
    const useCustom = customPaths.length > 0;
    const rawPaths = useCustom ? customPaths : this.getDefaultPaths();

    // Validate: reject reserved __custom__ value
    const options: FolderOption[] = rawPaths.map((rawPath, i) => {
      if (rawPath === '__custom__') {
        return {
          alias: rawPath,
          message: 'Reserved value — you should remove this from your settings',
          value: '',
          disabled: true,
          selected: false,
        };
      }
      return this.buildOption(rawPath, i === 0);
    });

    // Deduplicate by resolved value (keep first)
    const seen = new Set<string>();
    const deduped = options.filter(opt => {
      if (opt.disabled || !opt.value) return true;
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    });

    // Sort: enabled first, disabled last
    const enabled = deduped.filter(o => !o.disabled);
    const disabled = deduped.filter(o => o.disabled);

    // Ensure first enabled option is selected
    const hasSelection = enabled.some(o => o.selected);
    if (!hasSelection && enabled.length > 0) {
      enabled[0].selected = true;
    }

    // Custom folder browser is always last enabled, before disabled
    enabled.push({ alias: 'Choose custom folder...', message: 'Browse for a folder', value: '__custom__', disabled: false, selected: false });

    return [...enabled, ...disabled];
  }

  // --- Orchestrator ---

  private getWebviewContent(state: string, message: string, files?: any[]): string {
    const folderOptions = this.getFolderOptions();
    const defaultFolderValue = folderOptions.find(o => o.selected)?.value || '';
    const sessionCode = this.currentSessionCode || '';

    const stateHtml = renderStateContent(state, message, sessionCode);
    const filesListHtml = files ? renderFilesList(files) : '';
    const folderPickerHtml = renderFolderPicker(folderOptions);

    const isFilesReady = state === 'files-ready';
    const bodyHtml = isFilesReady
      ? `${stateHtml}
         ${filesListHtml ? `<div class="files-section"><h3>Ready to download:</h3>${filesListHtml}</div>` : ''}
         ${folderPickerHtml}
         <button class="button" onclick="downloadFiles()">Download All</button>`
      : stateHtml;

    return renderPage(bodyHtml, renderStyles(), renderScript(defaultFolderValue));
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
