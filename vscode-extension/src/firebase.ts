import * as vscode from 'vscode';
import { getFirestore, doc, getDoc, setDoc, updateDoc, increment, Timestamp } from 'firebase/firestore';
import { getFirebaseApp, USER_ID, SESSION_TTL_HOURS } from './config';

interface SessionData {
  created_at: Timestamp;
  expires_at: Timestamp;
  files: string[];
  status: 'active' | 'completed';
}

interface CounterData {
  value: number;
}

export class FirebaseService {
  private app = getFirebaseApp();
  private db = getFirestore(this.app);

  async generateCode(): Promise<string> {
    try {
      const counter = await this.getAndIncrementCounter();
      const code = counter.toString().padStart(3, '0');
      
      await this.createSession(code);
      
      return code;
    } catch (error) {
      console.error('Firebase code generation failed:', error);
      vscode.window.showWarningMessage('Firebase connection failed, using local code generation');
      return this.generateLocalCode();
    }
  }

  async checkSession(code: string): Promise<{ exists: boolean; status?: string; files?: string[] }> {
    try {
      const sessionRef = doc(this.db, 'users', USER_ID, 'sessions', code);
      const sessionSnap = await getDoc(sessionRef);
      
      if (!sessionSnap.exists()) {
        return { exists: false };
      }
      
      const sessionData = sessionSnap.data() as SessionData;
      
      return {
        exists: true,
        status: sessionData.status,
        files: sessionData.files
      };
    } catch (error: any) {
      console.error('Session check failed:', error);
      throw new Error(`Failed to check session status: ${error.message}`);
    }
  }

  private async getAndIncrementCounter(): Promise<number> {
    const counterRef = doc(this.db, 'users', USER_ID, 'meta', 'session_counter');
    
    try {
      const counterSnap = await getDoc(counterRef);
      
      if (!counterSnap.exists()) {
        await setDoc(counterRef, { value: 1 });
        return 1;
      }
      
      const currentValue = (counterSnap.data() as CounterData).value;
      const newValue = (currentValue + 1) % 1000;
      const finalValue = newValue === 0 ? 1000 : newValue;
      
      await updateDoc(counterRef, {
        value: increment(1)
      });
      
      return finalValue;
    } catch (error) {
      console.error('Counter increment failed:', error);
      throw error;
    }
  }

  private async createSession(code: string): Promise<void> {
    const now = Timestamp.now();
    const expiresAt = Timestamp.fromMillis(now.toMillis() + SESSION_TTL_HOURS * 60 * 60 * 1000);
    
    const sessionRef = doc(this.db, 'users', USER_ID, 'sessions', code);
    
    const sessionData: SessionData = {
      created_at: now,
      expires_at: expiresAt,
      files: [],
      status: 'active'
    };
    
    await setDoc(sessionRef, sessionData);
  }

  private generateLocalCode(): string {
    return Math.floor(Math.random() * 900 + 100).toString();
  }
}