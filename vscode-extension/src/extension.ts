import * as vscode from 'vscode';
import { UploadSessionWebview } from './webview';
import { GoogleAuthService } from './auth';

export function activate(context: vscode.ExtensionContext) {
  const startSessionCommand = vscode.commands.registerCommand(
    'markasset.startSession',
    () => {
      const webview = new UploadSessionWebview(context);
      webview.show();
    }
  );
  
  const logoutCommand = vscode.commands.registerCommand(
    'markasset.logout',
    async () => {
      try {
        const authService = new GoogleAuthService(context);
        await authService.signOut();
        vscode.window.showInformationMessage('Successfully logged out from Google Drive');
      } catch (error) {
        vscode.window.showErrorMessage(`Logout failed: ${error}`);
      }
    }
  );
  
  context.subscriptions.push(startSessionCommand, logoutCommand);
  
  // Extension activated silently
}

export function deactivate() {}