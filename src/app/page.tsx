'use client';

import { useState, useCallback, useMemo } from 'react';
import type { FileNode, FileDifference, SyncLogEntry } from '@/types';
import { suggestResolution, type SuggestResolutionOutput } from '@/ai/flows/suggest-resolution';
import { useToast } from "@/hooks/use-toast";

import AppHeader from '@/components/AppHeader';
import PathConfiguration from '@/components/PathConfiguration';
import FileExplorer from '@/components/FileExplorer';
import ComparisonDetails from '@/components/ComparisonDetails';
import SyncControls from '@/components/SyncControls';
import SyncLogDialog from '@/components/SyncLogDialog';

import { generateMockFiles, compareFileTrees } from '@/lib/file-system';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function FileSyncPage() {
  const [primaryPath, setPrimaryPath] = useState<string>('/opt/app/live-data');
  const [drPath, setDrPath] = useState<string>('/srv/app/dr-backup');

  const [primaryFiles, setPrimaryFiles] = useState<FileNode[]>([]);
  const [drFiles, setDrFiles] = useState<FileNode[]>([]);
  const [differences, setDifferences] = useState<FileDifference[]>([]);
  
  const [selectedDifference, setSelectedDifference] = useState<FileDifference | null>(null);
  
  const [aiSuggestion, setAiSuggestion] = useState<SuggestResolutionOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [isSyncLogOpen, setIsSyncLogOpen] = useState<boolean>(false);
  
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false);
  const [isSyncingFile, setIsSyncingFile] = useState<boolean>(false); // For individual file sync
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false); // For "Sync All"

  const { toast } = useToast();

  const addLogEntry = (message: string, status: SyncLogEntry['status']) => {
    setSyncLog(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toISOString(), message, status }]);
  };

  const handleLoadFiles = useCallback(async () => {
    setIsGlobalLoading(true);
    setSelectedDifference(null);
    setAiSuggestion(null);
    addLogEntry(`Loading files from Primary: ${primaryPath} and DR: ${drPath}`, 'info');
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockPrimary = generateMockFiles(primaryPath, 'primary');
    const mockDr = generateMockFiles(drPath, 'dr');
    
    const { updatedPrimaryTree, updatedDrTree, differences: comparedDifferences } = compareFileTrees(primaryPath, drPath, mockPrimary, mockDr);
    
    setPrimaryFiles(updatedPrimaryTree);
    setDrFiles(updatedDrTree);
    setDifferences(comparedDifferences);
    
    setIsGlobalLoading(false);
    addLogEntry(`Comparison complete. Found ${comparedDifferences.length} differences.`, 'info');
    toast({ title: "Files Loaded", description: "File comparison complete." });
  }, [primaryPath, drPath, toast]);

  const findNodeByPath = (nodes: FileNode[], path: string): FileNode | undefined => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeByPath(node.children, path);
        if (found) return found;
      }
    }
    return undefined;
  };

  const updateNodeInTree = (nodes: FileNode[], updatedNode: FileNode): FileNode[] => {
    return nodes.map(node => {
      if (node.id === updatedNode.id) return updatedNode;
      if (node.children) {
        return { ...node, children: updateNodeInTree(node.children, updatedNode) };
      }
      return node;
    });
  };

  const handleToggleDirectory = useCallback((nodeToToggle: FileNode) => {
    const treeToUpdate = primaryFiles.some(n => findNodeByPath([n], nodeToToggle.path)) ? primaryFiles : drFiles;
    const setTree = primaryFiles.some(n => findNodeByPath([n], nodeToToggle.path)) ? setPrimaryFiles : setDrFiles;

    const updateOpenState = (nodes: FileNode[]): FileNode[] => {
        return nodes.map(n => {
            if (n.id === nodeToToggle.id) {
                return { ...n, isOpen: !n.isOpen };
            }
            if (n.children) {
                return { ...n, children: updateOpenState(n.children) };
            }
            return n;
        });
    };
    setTree(prevTree => updateOpenState(prevTree));
  }, [primaryFiles, drFiles]);


  const handleSelectFile = useCallback((node: FileNode) => {
    const diff = differences.find(d => d.path === node.relativePath);
    if (diff) {
      setSelectedDifference(diff);
      setAiSuggestion(null); // Clear previous AI suggestion
    } else {
      // Handle selection of synced files or files not in diff list if needed
      // For now, only files with differences are "selectable" for details view
      const pFile = findNodeByPath(primaryFiles, node.path);
      const dFile = findNodeByPath(drFiles, node.path.replace(primaryPath, drPath)); // Adjust for DR path if selecting from primary
      
      if (pFile?.status === 'synced' || dFile?.status === 'synced') {
         setSelectedDifference({
           path: node.relativePath,
           name: node.name,
           status: 'synced', // This might not be in `differences` list
           primaryFile: pFile,
           drFile: dFile,
           summary: "Files are in sync."
         });
      } else {
        setSelectedDifference(null);
      }
    }
  }, [differences, primaryFiles, drFiles, primaryPath, drPath]);


  const handleGetAiSuggestion = useCallback(async (details: {primaryPath: string, drPath: string, diffSummary: string}) => {
    if (!selectedDifference) return;
    setIsAiLoading(true);
    setAiSuggestion(null);
    addLogEntry(`Requesting AI suggestion for: ${selectedDifference.path}`, 'info');
    try {
      const result = await suggestResolution({
        primaryServerFilePath: details.primaryPath,
        drServerFilePath: details.drPath,
        fileDifferenceDetails: details.diffSummary,
      });
      setAiSuggestion(result);
      addLogEntry(`AI suggestion received for: ${selectedDifference.path}`, 'success');
      toast({ title: "AI Suggestion Ready", description: `Suggestion for ${selectedDifference.name} is available.` });
    } catch (error) {
      console.error("AI suggestion error:", error);
      addLogEntry(`Error getting AI suggestion for ${selectedDifference.path}: ${(error as Error).message}`, 'error');
      toast({ title: "AI Error", description: "Could not fetch AI suggestion.", variant: "destructive" });
    } finally {
      setIsAiLoading(false);
    }
  }, [selectedDifference, toast]);

  const simulateSync = async (fileDiff: FileDifference) => {
    addLogEntry(`Syncing ${fileDiff.path}...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

    // Update file status in both trees
    const updateStatusInTree = (tree: FileNode[], relativePath: string): FileNode[] => {
      return tree.map(node => {
        if (node.relativePath === relativePath) {
          return { ...node, status: 'synced' as 'synced', lastModified: new Date().toISOString() };
        }
        if (node.children) {
          return { ...node, children: updateStatusInTree(node.children, relativePath) };
        }
        return node;
      });
    };

    setPrimaryFiles(prev => updateStatusInTree(prev, fileDiff.path));
    setDrFiles(prev => updateStatusInTree(prev, fileDiff.path));
    
    // Remove from differences list and update selectedDifference if it's the one synced
    setDifferences(prev => prev.filter(d => d.path !== fileDiff.path));
    if (selectedDifference?.path === fileDiff.path) {
      setSelectedDifference(prev => prev ? {...prev, status: 'synced', summary: "Successfully synced." } : null);
    }
    
    addLogEntry(`Successfully synced ${fileDiff.path}`, 'success');
    toast({ title: "Sync Complete", description: `${fileDiff.name} has been synced.` });
  };
  
  const handleSyncFile = useCallback(async (fileDiff: FileDifference) => {
    setIsSyncingFile(true);
    await simulateSync(fileDiff);
    setIsSyncingFile(false);
  }, [selectedDifference, toast]);

  const handleSyncAllDifferent = useCallback(async () => {
    setIsSyncingAll(true);
    addLogEntry('Starting sync for all different files...', 'info');
    const diffToSync = differences.filter(d => d.status === 'different' || d.status === 'primary_only' || d.status === 'dr_only');
    
    for (const diff of diffToSync) {
      await simulateSync(diff); // simulateSync updates states internally
      await new Promise(resolve => setTimeout(resolve, 200)); // Small delay between syncs
    }
    
    addLogEntry(`Sync all operation completed. ${diffToSync.length} items processed.`, 'success');
    toast({ title: "Sync All Complete", description: `${diffToSync.length} items processed.` });
    setIsSyncingAll(false);
  }, [differences, toast]);
  
  const selectedFilePathForExplorer = useMemo(() => {
    if (selectedDifference?.primaryFile) return selectedDifference.primaryFile.path;
    if (selectedDifference?.drFile) return selectedDifference.drFile.path;
    return null;
  }, [selectedDifference]);

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <ScrollArea className="flex-grow">
        <main className="container mx-auto p-4 md:p-6 space-y-6 ">
          <PathConfiguration
            primaryPath={primaryPath}
            onPrimaryPathChange={setPrimaryPath}
            drPath={drPath}
            onDrPathChange={setDrPath}
            onLoadFiles={handleLoadFiles}
            isLoading={isGlobalLoading}
          />

          { (primaryFiles.length > 0 || drFiles.length > 0 || isGlobalLoading) && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <FileExplorer
                title="Primary Server"
                nodes={primaryFiles}
                onSelectFile={handleSelectFile}
                onToggleDirectory={handleToggleDirectory}
                selectedFilePath={selectedFilePathForExplorer}
                isLoading={isGlobalLoading}
              />
              <FileExplorer
                title="DR Server"
                nodes={drFiles}
                onSelectFile={handleSelectFile}
                onToggleDirectory={handleToggleDirectory}
                selectedFilePath={selectedFilePathForExplorer}
                isLoading={isGlobalLoading}
              />
              <ComparisonDetails
                selectedDifference={selectedDifference}
                onGetAiSuggestion={handleGetAiSuggestion}
                aiSuggestion={aiSuggestion}
                isAiLoading={isAiLoading}
                onSyncFile={handleSyncFile}
                isSyncingFile={isSyncingFile}
              />
            </div>
          )}
          
          {differences.length > 0 && (
            <SyncControls
              onSyncAllDifferent={handleSyncAllDifferent}
              onViewLogs={() => setIsSyncLogOpen(true)}
              isSyncingAll={isSyncingAll}
              canSync={!isGlobalLoading && differences.length > 0}
            />
          )}

        </main>
      </ScrollArea>
      <SyncLogDialog
        isOpen={isSyncLogOpen}
        onOpenChange={setIsSyncLogOpen}
        logs={syncLog}
      />
    </div>
  );
}
