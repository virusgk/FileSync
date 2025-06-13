
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
      id: `${serverType}-root-config-${Date.now()}`,
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
          id: `${serverType}-settings-json-${Date.now()}`,
          name: 'settings.json',
          type: 'file',
          path: `${rootPath}/config/settings.json`,
          relativePath: 'config/settings.json',
          content: serverType === 'primary' ? '{"theme": "dark", "feature": true, "version": "1.1"}' : '{"theme": "light", "feature": false, "version": "1.0"}',
          status: 'unknown',
          lastModified: serverType === 'primary' ? now.toISOString() : new Date(now.getTime() - 3600000).toISOString(), // primary is newer
          size: '1KB',
        },
        {
          id: `${serverType}-users-yaml-${Date.now()}`,
          name: 'users.yaml',
          type: 'file',
          path: `${rootPath}/config/users.yaml`,
          relativePath: 'config/users.yaml',
          content: 'users: [userA, userB]', // Same content for simplicity, difference driven by lastModified if any
          status: 'unknown',
          lastModified: new Date(now.getTime() - 86400000).toISOString(), // 1 day ago
          size: '2KB',
        },
      ],
    },
    {
      id: `${serverType}-logs-${Date.now()}`,
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
          id: `${serverType}-app-log-${Date.now()}`,
          name: 'application.log',
          type: 'file',
          path: `${rootPath}/logs/application.log`,
          relativePath: 'logs/application.log',
          content: `Log entries for ${serverType}...`,
          status: 'unknown',
          lastModified: new Date(now.getTime() - 60000).toISOString(), // 1 min ago
          size: '5MB',
        },
      ],
    },
    serverType === 'primary' ? {
      id: `primary-only-script-sh-${Date.now()}`,
      name: 'deploy.sh',
      type: 'file' as 'file',
      path: `${rootPath}/deploy.sh`,
      relativePath: 'deploy.sh',
      content: '#!/bin/bash echo "deploying primary..."',
      status: 'unknown' as 'unknown',
      lastModified: new Date(now.getTime() - 7200000).toISOString(), // 2 hours ago
      size: '1KB',
    } : null,
    serverType === 'dr' ? {
      id: `dr-only-readme-md-${Date.now()}`,
      name: 'README_DR.md',
      type: 'file' as 'file',
      path: `${rootPath}/README_DR.md`,
      relativePath: 'README_DR.md',
      content: '# DR Server Information - This file should be removed after sync.',
      status: 'unknown' as 'unknown',
      lastModified: new Date(now.getTime() - 86400000 * 5).toISOString(), // 5 days ago
      size: '500B',
    } : null,
     {
      id: `${serverType}-shared-doc-${Date.now()}`,
      name: 'shared_document.txt',
      type: 'file',
      path: `${rootPath}/shared_document.txt`,
      relativePath: 'shared_document.txt',
      content: 'This is a shared document. Initial version.',
      status: 'unknown',
      lastModified: new Date(now.getTime() - 86400000 * 4).toISOString(), // 4 days ago for both initially
      size: '700B',
    },
  ];
  return files.filter(f => f !== null) as FileNode[];
}

function getAllFilesRecursive(nodes: FileNode[]): Map<string, FileNode> {
  const map = new Map<string, FileNode>();
  for (const node of nodes) {
    map.set(node.relativePath, node);
    if (node.type === 'directory' && node.children) {
      const childrenMap = getAllFilesRecursive(node.children);
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

  // Deep clone to avoid mutating original state directly during comparison
  const processedPrimaryFiles = JSON.parse(JSON.stringify(currentPrimaryFiles)) as FileNode[];
  const processedDrFiles = JSON.parse(JSON.stringify(currentDrFiles)) as FileNode[];

  const allRelativePaths = new Set([...primaryMap.keys(), ...drMap.keys()]);

  function updateNodeStatusInTree(tree: FileNode[], relativePath: string, status: FileNode['status']) {
    function findAndUpdate(nodes: FileNode[]): boolean {
      for (let node of nodes) {
        if (node.relativePath === relativePath) {
          node.status = status;
          return true;
        }
        if (node.children && findAndUpdate(node.children)) {
           // If a child's status changes, the parent directory might implicitly be 'different' or require re-evaluation
           // For simplicity, we're not cascading status up to parent directories in this basic comparison.
           // A more advanced system might mark parent dirs if their children differ.
          return true;
        }
      }
      return false;
    }
    findAndUpdate(tree);
  }
  
  allRelativePaths.forEach(relativePath => {
    const pFile = primaryMap.get(relativePath);
    const dFile = drMap.get(relativePath);

    if (pFile && dFile) {
      if (pFile.type !== dFile.type) {
        updateNodeStatusInTree(processedPrimaryFiles, relativePath, 'different');
        updateNodeStatusInTree(processedDrFiles, relativePath, 'different');
        differences.push({ path: relativePath, name: pFile.name, status: 'different', primaryFile: pFile, drFile: dFile, summary: `Type mismatch: Primary is ${pFile.type}, DR is ${dFile.type}` });
      } else if (pFile.type === 'file') {
        const isDifferent = pFile.content !== dFile.content || pFile.lastModified > dFile.lastModified; // Primary is source of truth
        const status: FileNode['status'] = isDifferent ? 'different' : 'synced';
        updateNodeStatusInTree(processedPrimaryFiles, relativePath, status);
        updateNodeStatusInTree(processedDrFiles, relativePath, status);
        if (isDifferent) {
          differences.push({ path: relativePath, name: pFile.name, status: 'different', primaryFile: pFile, drFile: dFile, summary: 'Content or metadata mismatch (Primary is newer or different)' });
        }
      } else { // Both are directories
        updateNodeStatusInTree(processedPrimaryFiles, relativePath, 'synced'); // Assume synced, children will determine real status
        updateNodeStatusInTree(processedDrFiles, relativePath, 'synced');
      }
    } else if (pFile) {
      updateNodeStatusInTree(processedPrimaryFiles, relativePath, 'primary_only');
      differences.push({ path: relativePath, name: pFile.name, status: 'primary_only', primaryFile: pFile, summary: 'File exists only on Primary' });
    } else if (dFile) {
      // This file existing only on DR means DR is "different" from primary's state for this path
      updateNodeStatusInTree(processedDrFiles, relativePath, 'dr_only'); 
      differences.push({ path: relativePath, name: dFile.name, status: 'dr_only', drFile: dFile, summary: 'File exists only on DR' });
    }
  });
  
  return { updatedPrimaryTree: processedPrimaryFiles, updatedDrTree: processedDrFiles, differences };
}


// Helper to add a file/directory to a tree (for sync primary_only to DR)
export function addNodeToTree(tree: FileNode[], basePath: string, nodeToAdd: FileNode): FileNode[] {
  const newTree = JSON.parse(JSON.stringify(tree)) as FileNode[];
  const pathParts = nodeToAdd.relativePath.split('/');
  let currentLevel = newTree;
  let currentPath = basePath;

  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    currentPath = `${currentPath}/${part}`;
    let dirNode = currentLevel.find(n => n.name === part && n.type === 'directory');
    if (!dirNode) {
      dirNode = {
        id: `dr-created-${part}-${Date.now()}`,
        name: part,
        type: 'directory',
        path: currentPath,
        relativePath: generateRelativePath(basePath, currentPath),
        status: 'synced', // Assuming it's created as synced
        lastModified: new Date().toISOString(),
        size: '0KB',
        children: [],
        isOpen: true,
      };
      currentLevel.push(dirNode);
    }
    currentLevel = dirNode.children!;
  }

  const finalNode = {
    ...nodeToAdd,
    id: `dr-copied-${nodeToAdd.name}-${Date.now()}`,
    path: `${basePath}/${nodeToAdd.relativePath}`.replace(/\/\//g, '/'),
    status: 'synced' as 'synced',
    // Ensure children are also new instances if it's a directory
    children: nodeToAdd.children ? JSON.parse(JSON.stringify(nodeToAdd.children)) : undefined,
  };
  currentLevel.push(finalNode);
  return newTree;
}

// Helper to remove a file/directory from a tree (for sync dr_only from DR)
export function removeNodeFromTree(tree: FileNode[], relativePathToRemove: string): FileNode[] {
  function filterRecursive(nodes: FileNode[]): FileNode[] {
    return nodes.filter(node => {
      if (node.relativePath === relativePathToRemove) {
        return false; // Remove this node
      }
      if (node.children) {
        node.children = filterRecursive(node.children);
      }
      return true;
    });
  }
  return filterRecursive(JSON.parse(JSON.stringify(tree)));
}

// Helper to update a node in a tree (for sync different to DR)
export function updateNodeInTree(tree: FileNode[], relativePathToUpdate: string, sourceNode: FileNode): FileNode[] {
  function findAndUpdateRecursive(nodes: FileNode[]): FileNode[] {
    return nodes.map(node => {
      if (node.relativePath === relativePathToUpdate) {
        return {
          ...node, // Keep DR id and path structure
          content: sourceNode.content,
          lastModified: sourceNode.lastModified,
          size: sourceNode.size,
          status: 'synced' as 'synced',
          // If it's a directory, its children would be handled by individual file diffs
          // For this mock, we assume file properties are what's updated.
        };
      }
      if (node.children) {
        return { ...node, children: findAndUpdateRecursive(node.children) };
      }
      return node;
    });
  }
  return findAndUpdateRecursive(JSON.parse(JSON.stringify(tree)));
}
