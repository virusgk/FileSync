
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

// Counter to make log content slightly different on each call for the same app
let logSuffixCounter = 0;

export function generateMockFiles(rootPath: string, serverType: 'primary' | 'dr'): FileNode[] {
  const now = new Date();
  logSuffixCounter++;

  // Randomly decide if settings.json on DR should be "older" or "newer" for variety
  const drSettingsModifier = Math.random() < 0.5 ? -3600000 : 3600000; // +/- 1 hour

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
          content: serverType === 'primary'
            ? `{"theme": "dark", "feature": true, "version": "1.${Math.floor(Math.random()*5) + 1}", "ts": ${now.getTime()}}`
            : `{"theme": "light", "feature": false, "version": "1.0", "ts": ${now.getTime() + drSettingsModifier}}`,
          status: 'unknown',
          lastModified: serverType === 'primary'
            ? new Date(now.getTime() - Math.random() * 100000).toISOString() // Primary slightly varied
            : new Date(now.getTime() + drSettingsModifier).toISOString(),
          size: '1KB',
        },
        {
          id: `${serverType}-users-yaml-${Date.now()}`,
          name: 'users.yaml',
          type: 'file',
          path: `${rootPath}/config/users.yaml`,
          relativePath: 'config/users.yaml',
          content: serverType === 'primary' ? 'users: [userA, userB, userC]' : 'users: [userA, userB]', // Content difference
          status: 'unknown',
          lastModified: new Date(now.getTime() - 86400000 + (Math.random() * 1000000)).toISOString(), // 1 day ago, with slight variation
          size: serverType === 'primary' ? '2.1KB' : '2KB',
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
          content: `Log entries for ${serverType} (run ${logSuffixCounter})... Entry: ${Math.random().toString(36).substring(7)}`,
          status: 'unknown',
          lastModified: new Date(now.getTime() - 60000 + (Math.random() * 30000)).toISOString(), // 1 min ago, varied
          size: `${(Math.random() * 2 + 4).toFixed(1)}MB`, // Size variation
        },
      ],
    },
    // Primary-only file might sometimes not exist for variety
    (serverType === 'primary' && Math.random() > 0.1) ? {
      id: `primary-only-script-sh-${Date.now()}`,
      name: 'deploy.sh',
      type: 'file' as 'file',
      path: `${rootPath}/deploy.sh`,
      relativePath: 'deploy.sh',
      content: '#!/bin/bash echo "deploying primary..." # version ' + Math.random(),
      status: 'unknown' as 'unknown',
      lastModified: new Date(now.getTime() - 7200000).toISOString(), // 2 hours ago
      size: '1KB',
    } : null,
    // DR-only file might sometimes not exist
    (serverType === 'dr' && Math.random() > 0.2) ? {
      id: `dr-only-readme-md-${Date.now()}`,
      name: 'README_DR.md',
      type: 'file' as 'file',
      path: `${rootPath}/README_DR.md`,
      relativePath: 'README_DR.md',
      content: '# DR Server Information - This file should be removed after sync. Random: ' + Math.random(),
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
      content: serverType === 'primary' ? 'This is a shared document. Primary version - ' + Date.now() : 'This is a shared document. DR version - ' + (Date.now() - 10000),
      status: 'unknown',
      // Randomly make one newer than the other
      lastModified: serverType === 'primary' ? new Date(now.getTime() - 86400000 * (Math.random() > 0.5 ? 3.9 : 4.1)).toISOString() : new Date(now.getTime() - 86400000 * 4).toISOString(),
      size: serverType === 'primary' ? '705B' : '700B',
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
        // Primary is source of truth. Difference if content or primary's lastModified is newer.
        const primaryTimestamp = new Date(pFile.lastModified).getTime();
        const drTimestamp = new Date(dFile.lastModified).getTime();
        const isDifferent = pFile.content !== dFile.content || primaryTimestamp > drTimestamp;
        const status: FileNode['status'] = isDifferent ? 'different' : 'synced';

        updateNodeStatusInTree(processedPrimaryFiles, relativePath, status);
        updateNodeStatusInTree(processedDrFiles, relativePath, status);
        if (isDifferent) {
          let summary = 'Content or metadata mismatch.';
          if (primaryTimestamp > drTimestamp && pFile.content === dFile.content) summary = 'Primary is newer.';
          else if (pFile.content !== dFile.content) summary = 'Content differs.';
          differences.push({ path: relativePath, name: pFile.name, status: 'different', primaryFile: pFile, drFile: dFile, summary });
        }
      } else { // Both are directories
        // Status of directories is implicitly determined by their children.
        // For this function, mark as 'synced' and let parent logic handle it if needed.
        // However, explicit diffs are for files/folders that are missing or different.
        // If a directory structure itself is the "difference" (e.g. one exists, other doesn't), that's handled by primary_only/dr_only.
        // If both exist, their 'status' is an aggregation of children, or 'synced' if all children sync.
        // Here we optimistically set to 'synced'; the UI usually cares about actionable diffs.
         updateNodeStatusInTree(processedPrimaryFiles, relativePath, 'synced');
         updateNodeStatusInTree(processedDrFiles, relativePath, 'synced');
      }
    } else if (pFile) {
      updateNodeStatusInTree(processedPrimaryFiles, relativePath, 'primary_only');
      differences.push({ path: relativePath, name: pFile.name, status: 'primary_only', primaryFile: pFile, summary: 'File exists only on Primary' });
    } else if (dFile) {
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
  let currentPath = basePath; // This should be the root path of the DR tree, e.g., "/srv/backup/data"

  for (let i = 0; i < pathParts.length - 1; i++) {
    const part = pathParts[i];
    // Construct the full path for the current directory part relative to the DR server's root
    currentPath = `${currentPath}/${part}`.replace(/\/\//g, '/');
    let dirNode = currentLevel.find(n => n.name === part && n.type === 'directory');
    if (!dirNode) {
      dirNode = {
        id: `dr-created-dir-${part}-${Date.now()}`,
        name: part,
        type: 'directory',
        path: currentPath, // Full path on DR
        relativePath: generateRelativePath(basePath, currentPath), // Path relative to DR's rootPath
        status: 'synced',
        lastModified: nodeToAdd.lastModified, // Use source node's timestamp if creating parent
        size: '0KB',
        children: [],
        isOpen: true,
      };
      currentLevel.push(dirNode);
    }
    currentLevel = dirNode.children!;
  }

  // The node to be added (file or directory)
  const finalNode = JSON.parse(JSON.stringify(nodeToAdd)); // Deep clone source node
  finalNode.id = `dr-copied-node-${nodeToAdd.name}-${Date.now()}`;
  finalNode.path = `${basePath}/${nodeToAdd.relativePath}`.replace(/\/\//g, '/'); // Correct full path on DR
  finalNode.relativePath = nodeToAdd.relativePath; // Relative path remains same as source
  finalNode.status = 'synced';
  // If it's a directory, ensure its children also have updated paths and new IDs
  if (finalNode.type === 'directory' && finalNode.children) {
    finalNode.children = finalNode.children.map((child: FileNode) => {
        const newChild = JSON.parse(JSON.stringify(child));
        newChild.id = `dr-copied-child-${child.name}-${Date.now()}`;
        newChild.path = `${finalNode.path}/${child.name}`.replace(/\/\//g, '/');
        newChild.relativePath = `${finalNode.relativePath}/${child.name}`.replace(/\/\//g, '/');
        newChild.status = 'synced';
        // Recursively update grand-children if any (though mock data is not that deep)
        if (newChild.children) {
            // This part would need a recursive function if directory structures are very deep.
            // For simplicity, assuming only one level of children for now in this specific copy.
        }
        return newChild;
    });
  }


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
        // Create a new object for the updated node
        const updatedNode = {
          ...node, // Keep DR id and path structure
          content: sourceNode.content, // Update content from source
          lastModified: sourceNode.lastModified, // Update lastModified from source
          size: sourceNode.size, // Update size from source
          status: 'synced' as 'synced', // Mark as synced
        };
        // If the source node is a directory and has children, we should ensure the DR node also reflects this structure.
        // This mock sync is primarily file-content focused for 'different'.
        // A full directory content sync would be more complex.
        if (sourceNode.type === 'directory') {
            // For a 'different' directory, the sync action would typically involve syncing its children.
            // Here, we are just updating metadata and content for a 'file'.
            // If it's a directory, and its 'different' status is due to metadata or children not covered by other diffs,
            // this simple update might not be enough. True directory sync is more involved.
            // For now, if it's a directory, its children are handled by their own diffs (primary_only, dr_only, different).
            // So, we primarily update metadata if sourceNode itself is a directory.
        }
        return updatedNode;
      }
      if (node.children) {
        return { ...node, children: findAndUpdateRecursive(node.children) };
      }
      return node;
    });
  }
  return findAndUpdateRecursive(JSON.parse(JSON.stringify(tree)));
}

