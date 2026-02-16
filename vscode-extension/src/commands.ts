import * as vscode from 'vscode';
import * as path from 'path';
import { FirebaseService } from './firebase';
import { StorageService } from './storage';

const firebaseService = new FirebaseService();
const storageService = new StorageService();

export async function generateAssetCode(): Promise<void> {
  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Generating upload code...",
      cancellable: false
    }, async () => {
      const code = await firebaseService.generateCode();
      
      const message = `Upload code: ${code}`;
      const action = await vscode.window.showInformationMessage(
        message,
        'Copy Code',
        'Show Upload URL'
      );
      
      if (action === 'Copy Code') {
        await vscode.env.clipboard.writeText(code);
        vscode.window.showInformationMessage('Code copied to clipboard!');
      } else if (action === 'Show Upload URL') {
        const uploadUrl = `https://markasset-upload.web.app?code=${code}`;
        vscode.env.openExternal(vscode.Uri.parse(uploadUrl));
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to generate code: ${error}`);
  }
}

export async function checkSessionStatus(): Promise<void> {
  const code = await vscode.window.showInputBox({
    prompt: 'Enter session code to check',
    placeHolder: '123',
    validateInput: (value) => {
      if (!value || !/^\d{3}$/.test(value)) {
        return 'Please enter a 3-digit code';
      }
      return undefined;
    }
  });
  
  if (!code) {
    return;
  }
  
  try {
    vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: "Checking session...",
      cancellable: false
    }, async () => {
      const result = await firebaseService.checkSession(code);
      
      if (!result.exists) {
        vscode.window.showWarningMessage(`Session ${code} not found or expired`);
        return;
      }
      
      const fileCount = result.files?.length || 0;
      const statusEmoji = result.status === 'active' ? '🟢' : '⚪';
      
      const message = `${statusEmoji} Session ${code}: ${result.status} (${fileCount} files)`;
      
      if (fileCount > 0) {
        const action = await vscode.window.showInformationMessage(
          message,
          'Download Files'
        );
        
        if (action === 'Download Files') {
          await downloadAssets(code);
        }
      } else {
        vscode.window.showInformationMessage(message);
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to check session: ${error}`);
  }
}

export async function downloadAssets(code?: string): Promise<void> {
  if (!code) {
    code = await vscode.window.showInputBox({
      prompt: 'Enter session code to download',
      placeHolder: '123',
      validateInput: (value) => {
        if (!value || !/^\d{3}$/.test(value)) {
          return 'Please enter a 3-digit code';
        }
        return undefined;
      }
    });
    
    if (!code) {
      return;
    }
  }
  
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder open');
    return;
  }
  
  try {
    const assetsDir = await selectAssetsDirectory(workspaceFolder);
    if (!assetsDir) {
      return;
    }
    
    await vscode.window.withProgress({
      location: vscode.ProgressLocation.Notification,
      title: `Downloading files from session ${code}...`,
      cancellable: false
    }, async () => {
      const downloadedFiles = await storageService.downloadSessionFiles(code!, assetsDir);
      
      if (downloadedFiles.length > 0) {
        vscode.window.showInformationMessage(
          `Downloaded ${downloadedFiles.length} files to ${path.relative(workspaceFolder.uri.fsPath, assetsDir)}`
        );
      } else {
        vscode.window.showWarningMessage('No files found in session');
      }
    });
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to download files: ${error}`);
  }
}

async function selectAssetsDirectory(workspaceFolder: vscode.WorkspaceFolder): Promise<string | undefined> {
  const defaultDir = vscode.Uri.joinPath(workspaceFolder.uri, 'assets');

  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    defaultUri: defaultDir,
    openLabel: 'Download Assets Here'
  });

  return selected?.[0].fsPath;
}