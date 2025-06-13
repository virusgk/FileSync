
import type { FileNode, FileDifference } from '@/types';

// This function is now OBSOLETE as file listing comes from PowerShell.
// Keeping it for reference or if a fallback is ever needed.
// export function generateMockFiles(rootPath: string, serverType: 'primary' | 'dr'): FileNode[] { ... }


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
  primaryRootPath: string, // still used for context if needed
  drRootPath: string,     // still used for context if needed
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

  // Deep clone to avoid mutating original state directly during status updates
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
          // If a child's status changes, the parent directory might implicitly be 'different'
          // but we mark the specific file/dir that's different.
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
        differences.push({ path: relativePath, name: pFile.name, type: pFile.type, status: 'different', primaryFile: pFile, drFile: dFile, summary: `Type mismatch: Primary is ${pFile.type}, DR is ${dFile.type}` });
      } else if (pFile.type === 'file') {
        // Compare based on lastModified timestamp and size as content is not available.
        // Primary is source of truth. Difference if primary's lastModified is newer or sizes differ.
        const primaryTimestamp = new Date(pFile.lastModified).getTime();
        const drTimestamp = new Date(dFile.lastModified).getTime();
        // Convert size from string "1234B" or "N/A" to number for comparison
        const pSize = parseInt(pFile.size || "0");
        const dSize = parseInt(dFile.size || "0");

        const isDifferent = primaryTimestamp > drTimestamp || pSize !== dSize;
        
        const status: FileNode['status'] = isDifferent ? 'different' : 'synced';

        updateNodeStatusInTree(processedPrimaryFiles, relativePath, status);
        updateNodeStatusInTree(processedDrFiles, relativePath, status);

        if (isDifferent) {
          let summary = 'Metadata mismatch.';
          if (primaryTimestamp > drTimestamp && pSize === dSize) summary = 'Primary is newer.';
          else if (pSize !== dSize) summary = `Size differs: P=${pFile.size}, DR=${dFile.size}.`;
          else if (primaryTimestamp > drTimestamp) summary = 'Primary is newer.';
          else if (primaryTimestamp < drTimestamp && pSize === dSize) summary = 'DR is newer (but Primary is source of truth). Sync will overwrite.';
          else summary = `Metadata differs. P: ${pFile.lastModified}, ${pFile.size}. DR: ${dFile.lastModified}, ${dFile.size}`;

          differences.push({ path: relativePath, name: pFile.name, type: 'file', status: 'different', primaryFile: pFile, drFile: dFile, summary });
        }
      } else { // Both are directories
         // For directories, if both exist, they are "synced" at this level.
         // Differences within them will be listed as individual file/subdir differences.
         updateNodeStatusInTree(processedPrimaryFiles, relativePath, 'synced');
         updateNodeStatusInTree(processedDrFiles, relativePath, 'synced');
      }
    } else if (pFile) {
      updateNodeStatusInTree(processedPrimaryFiles, relativePath, 'primary_only');
      differences.push({ path: relativePath, name: pFile.name, type: pFile.type, status: 'primary_only', primaryFile: pFile, summary: 'File/directory exists only on Primary' });
    } else if (dFile) {
      updateNodeStatusInTree(processedDrFiles, relativePath, 'dr_only');
      differences.push({ path: relativePath, name: dFile.name, type: dFile.type, status: 'dr_only', drFile: dFile, summary: 'File/directory exists only on DR' });
    }
  });

  return { updatedPrimaryTree: processedPrimaryFiles, updatedDrTree: processedDrFiles, differences };
}

// These functions are no longer used as sync is handled by PowerShell via API
// export function addNodeToTree(...) { ... }
// export function removeNodeFromTree(...) { ... }
// export function updateNodeInTree(...) { ... }
