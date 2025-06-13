import type { FileNode, FileDifference } from '@/types';

function generateRelativePath(basePath: string, fullPath: string): string {
  if (fullPath.startsWith(basePath)) {
    let relative = fullPath.substring(basePath.length);
    if (relative.startsWith('/')) {
      relative = relative.substring(1);
    }
    return relative;
  }
  return fullPath; // Fallback if basePath is not a prefix
}

export function generateMockFiles(rootPath: string, serverType: 'primary' | 'dr'): FileNode[] {
  const now = new Date();
  const files: FileNode[] = [
    {
      id: `${serverType}-root-config`,
      name: 'config',
      type: 'directory',
      path: `${rootPath}/config`,
      relativePath: 'config',
      status: 'unknown',
      lastModified: new Date(now.getTime() - 86400000 * 2).toISOString(), // 2 days ago
      size: '4KB',
      isOpen: true,
      children: [
        {
          id: `${serverType}-settings-json`,
          name: 'settings.json',
          type: 'file',
          path: `${rootPath}/config/settings.json`,
          relativePath: 'config/settings.json',
          content: serverType === 'primary' ? '{"theme": "dark", "feature": true}' : '{"theme": "light", "feature": false}',
          status: 'unknown',
          lastModified: serverType === 'primary' ? now.toISOString() : new Date(now.getTime() - 3600000).toISOString(), // primary is newer
          size: '1KB',
        },
        {
          id: `${serverType}-users-yaml`,
          name: 'users.yaml',
          type: 'file',
          path: `${rootPath}/config/users.yaml`,
          relativePath: 'config/users.yaml',
          content: 'users: [...]',
          status: 'unknown',
          lastModified: new Date(now.getTime() - 86400000).toISOString(), // 1 day ago
          size: '2KB',
        },
      ],
    },
    {
      id: `${serverType}-logs`,
      name: 'logs',
      type: 'directory',
      path: `${rootPath}/logs`,
      relativePath: 'logs',
      status: 'unknown',
      lastModified: new Date(now.getTime() - 86400000 * 3).toISOString(),
      size: '10MB',
      isOpen: false,
      children: [
        {
          id: `${serverType}-app-log`,
          name: 'application.log',
          type: 'file',
          path: `${rootPath}/logs/application.log`,
          relativePath: 'logs/application.log',
          content: 'Log entries...',
          status: 'unknown',
          lastModified: new Date(now.getTime() - 60000).toISOString(), // 1 min ago
          size: '5MB',
        },
      ],
    },
    serverType === 'primary' ? {
      id: 'primary-only-script-sh',
      name: 'deploy.sh',
      type: 'file' as 'file',
      path: `${rootPath}/deploy.sh`,
      relativePath: 'deploy.sh',
      content: '#!/bin/bash echo "deploying..."',
      status: 'unknown' as 'unknown',
      lastModified: new Date(now.getTime() - 7200000).toISOString(), // 2 hours ago
      size: '1KB',
    } : null,
    serverType === 'dr' ? {
      id: 'dr-only-readme-md',
      name: 'README_DR.md',
      type: 'file' as 'file',
      path: `${rootPath}/README_DR.md`,
      relativePath: 'README_DR.md',
      content: '# DR Server Information',
      status: 'unknown' as 'unknown',
      lastModified: new Date(now.getTime() - 86400000 * 5).toISOString(), // 5 days ago
      size: '500B',
    } : null,
  ];
  return files.filter(f => f !== null) as FileNode[];
}

function getAllFilesRecursive(nodes: FileNode[], parentPath: string = ''): Map<string, FileNode> {
  const map = new Map<string, FileNode>();
  for (const node of nodes) {
    const currentRelativePath = node.relativePath;
    map.set(currentRelativePath, node);
    if (node.type === 'directory' && node.children) {
      const childrenMap = getAllFilesRecursive(node.children, currentRelativePath);
      childrenMap.forEach((value, key) => map.set(key, value));
    }
  }
  return map;
}


export function compareFileTrees(
  primaryRootPath: string,
  drRootPath: string,
  currentPrimaryFiles: FileNode[], 
  currentDrFiles: FileNode[]
): {
  updatedPrimaryTree: FileNode[];
  updatedDrTree: FileNode[];
  differences: FileDifference[];
} {
  const primaryMap = getAllFilesRecursive(currentPrimaryFiles);
  const drMap = getAllFilesRecursive(currentDrFiles);
  const differences: FileDifference[] = [];

  const processedPrimaryFiles = JSON.parse(JSON.stringify(currentPrimaryFiles)) as FileNode[];
  const processedDrFiles = JSON.parse(JSON.stringify(currentDrFiles)) as FileNode[];

  const allRelativePaths = new Set([...primaryMap.keys(), ...drMap.keys()]);

  function updateNodeStatus(nodes: FileNode[], relativePath: string, status: FileNode['status'], primaryDetails?: any, drDetails?: any) {
    function findAndUpdate(nodeList: FileNode[]): boolean {
      for (let node of nodeList) {
        if (node.relativePath === relativePath) {
          node.status = status;
          if (primaryDetails) node.primaryDetails = primaryDetails;
          if (drDetails) node.drDetails = drDetails;
          return true;
        }
        if (node.children && findAndUpdate(node.children)) return true;
      }
      return false;
    }
    findAndUpdate(nodes);
  }
  
  allRelativePaths.forEach(relativePath => {
    const pFile = primaryMap.get(relativePath);
    const dFile = drMap.get(relativePath);

    const pDetails = pFile ? { lastModified: pFile.lastModified, size: pFile.size, contentSnippet: pFile.content?.substring(0,30) } : undefined;
    const dDetails = dFile ? { lastModified: dFile.lastModified, size: dFile.size, contentSnippet: dFile.content?.substring(0,30) } : undefined;

    if (pFile && dFile) {
      if (pFile.type !== dFile.type) {
        updateNodeStatus(processedPrimaryFiles, relativePath, 'different', pDetails, dDetails);
        updateNodeStatus(processedDrFiles, relativePath, 'different', pDetails, dDetails);
        differences.push({ path: relativePath, name: pFile.name, status: 'different', primaryFile: pFile, drFile: dFile, summary: `Type mismatch: Primary is ${pFile.type}, DR is ${dFile.type}` });
      } else if (pFile.type === 'file') {
        // Simple content and metadata comparison for mock
        const isDifferent = pFile.content !== dFile.content || pFile.lastModified !== dFile.lastModified || pFile.size !== dFile.size;
        const status: FileNode['status'] = isDifferent ? 'different' : 'synced';
        updateNodeStatus(processedPrimaryFiles, relativePath, status, pDetails, dDetails);
        updateNodeStatus(processedDrFiles, relativePath, status, pDetails, dDetails);
        if (isDifferent) {
          differences.push({ path: relativePath, name: pFile.name, status: 'different', primaryFile: pFile, drFile: dFile, summary: 'Content or metadata mismatch' });
        }
      } else { // Both are directories
         // Directories are 'synced' if they exist on both, content diff handled by files within
        updateNodeStatus(processedPrimaryFiles, relativePath, 'synced', pDetails, dDetails);
        updateNodeStatus(processedDrFiles, relativePath, 'synced', pDetails, dDetails);
      }
    } else if (pFile) {
      updateNodeStatus(processedPrimaryFiles, relativePath, 'primary_only', pDetails, dDetails);
      differences.push({ path: relativePath, name: pFile.name, status: 'primary_only', primaryFile: pFile, summary: 'File exists only on Primary' });
    } else if (dFile) {
      updateNodeStatus(processedDrFiles, relativePath, 'dr_only', pDetails, dDetails);
      differences.push({ path: relativePath, name: dFile.name, status: 'dr_only', drFile: dFile, summary: 'File exists only on DR' });
    }
  });
  
  return { updatedPrimaryTree: processedPrimaryFiles, updatedDrTree: processedDrFiles, differences };
}
