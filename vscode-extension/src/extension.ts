import * as vscode from 'vscode';
import { generateAssetCode, checkSessionStatus, downloadAssets } from './commands';

export function activate(context: vscode.ExtensionContext) {
  const generateCodeCommand = vscode.commands.registerCommand(
    'markasset.generateCode',
    generateAssetCode
  );
  
  const checkSessionCommand = vscode.commands.registerCommand(
    'markasset.checkSession', 
    checkSessionStatus
  );
  
  const downloadAssetsCommand = vscode.commands.registerCommand(
    'markasset.downloadAssets',
    downloadAssets
  );
  
  context.subscriptions.push(
    generateCodeCommand,
    checkSessionCommand, 
    downloadAssetsCommand
  );
  
  vscode.window.showInformationMessage('MarkAsset extension activated!');
}

export function deactivate() {}