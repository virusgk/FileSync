
export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'directory';
  path: string; // Full path from the conceptual root of the server
  relativePath: string; // Path relative to the user-provided root path for that server
  content?: string; // Mock content for comparison
  children?: FileNode[];
  status: 'synced' | 'different' | 'primary_only' | 'dr_only' | 'unknown';
  lastModified: string; // ISO string
  size: string; // e.g., "1KB", "2MB"
  
  // Specific details if exists only on one side or different
  primaryDetails?: { lastModified: string; size: string; contentSnippet?: string };
  drDetails?: { lastModified: string; size: string; contentSnippet?: string };

  // For UI state
  isOpen?: boolean; 
}

export interface FileDifference {
  path: string; // relative path of the file
  name: string;
  status: 'different' | 'primary_only' | 'dr_only';
  primaryFile?: FileNode;
  drFile?: FileNode;
  summary?: string; // Text summary of difference
}

export interface SyncLogEntry {
  id: string;
  timestamp: string; // ISO string
  message: string;
  status: 'success' | 'error' | 'info';
}
