
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
  status: 'different' | 'primary_only' | 'dr_only' | 'synced'; // Added 'synced' for detail view consistency
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

// New types for server and application configuration
export interface RawServer {
  id: string; // Unique ID for the raw server input, e.g., "raw_primary_0_serverA"
  name: string;
  type: 'primary' | 'dr'; // Indicates if it was entered in primary or DR list
}

export interface AssignedServer {
  id: string; // Unique ID for the assigned server instance, e.g., "assigned_guid"
  name: string;
  originalRawServerId: string; // ID of the RawServer it came from
}

export interface Application {
  id: string; // Unique ID for the application, e.g., "app_guid"
  name: string;
  primaryServerIds: string[]; // List of AssignedServer IDs
  drServerIds: string[];     // List of AssignedServer IDs
  primaryPath: string;       // Path for primary servers for this application
  drPath: string;            // Path for DR servers for this application
}
