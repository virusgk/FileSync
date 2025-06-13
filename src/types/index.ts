
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
  
  primaryDetails?: { lastModified: string; size: string; contentSnippet?: string };
  drDetails?: { lastModified: string; size: string; contentSnippet?: string };

  isOpen?: boolean; 
}

export interface FileDifference {
  path: string; // relative path of the file
  name: string;
  status: 'different' | 'primary_only' | 'dr_only' | 'synced';
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

export interface RawServer {
  id: string;
  name: string;
  type: 'primary' | 'dr';
}

export interface AssignedServer {
  id: string; 
  name: string;
  originalRawServerId: string;
  isReachable: boolean | null; // null for unchecked, true for reachable, false for not
  isCheckingReachability: boolean;
}

export interface Application {
  id: string;
  name: string;
  primaryServerIds: string[]; 
  drServerIds: string[];     
  primaryPath: string;       
  drPath: string;            
}

export interface AppConfigurationBundle {
  rawPrimaryServers: RawServer[];
  rawDrServers: RawServer[];
  assignedPrimaryServers: AssignedServer[];
  assignedDrServers: AssignedServer[];
  applications: Application[];
  version: string; 
}
