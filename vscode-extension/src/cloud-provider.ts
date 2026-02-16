export interface SessionCheckResult {
  exists: boolean;
  status?: string;
  files?: FileInfo[];
}

export interface FileInfo {
  original_name: string;
  size: number;
  content_type: string;
}

export interface CloudProvider {
  generateCode(): Promise<string>;
  checkSession(code: string): Promise<SessionCheckResult>;
  deleteSession(code: string): Promise<void>;
  downloadSessionFiles(sessionCode: string, targetDir: string): Promise<string[]>;
}
