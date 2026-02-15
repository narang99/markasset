import * as vscode from 'vscode';
import { initializeApp, FirebaseApp } from 'firebase/app';

export interface Config {
  firebaseProjectId: string;
  firebaseApiKey: string;
}

export function getConfig(): Config {
  const config = vscode.workspace.getConfiguration('markasset');
  
  return {
    firebaseProjectId: config.get<string>('firebaseProjectId') || 'markasset-project',
    firebaseApiKey: config.get<string>('firebaseApiKey') || ''
  };
}

export function getFirebaseApp(): FirebaseApp {
  const config = getConfig();
  
  const firebaseConfig = {
    projectId: config.firebaseProjectId,
    apiKey: config.firebaseApiKey,
    storageBucket: `${config.firebaseProjectId}.firebasestorage.app`
  };
  
  return initializeApp(firebaseConfig);
}

export const USER_ID = 'anonymous';
export const SESSION_TTL_HOURS = 1;