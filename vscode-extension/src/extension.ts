import * as vscode from 'vscode';
import { UploadSessionWebview } from './webview';

export function activate(context: vscode.ExtensionContext) {
  const startSessionCommand = vscode.commands.registerCommand(
    'markasset.startSession',
    () => {
      const webview = new UploadSessionWebview(context);
      webview.show();
    }
  );
  
  context.subscriptions.push(startSessionCommand);
  
  // Extension activated silently
}

export function deactivate() {}