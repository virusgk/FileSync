
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { FileNode, FileDifference, SyncLogEntry, RawServer, AssignedServer, Application } from '@/types';
import { suggestResolution, type SuggestResolutionOutput } from '@/ai/flows/suggest-resolution';
import { useToast } from "@/hooks/use-toast";

import AppHeader from '@/components/AppHeader';
import FileExplorer from '@/components/FileExplorer';
import ComparisonDetails from '@/components/ComparisonDetails';
import SyncControls from '@/components/SyncControls';
import SyncLogDialog from '@/components/SyncLogDialog';
import ServerInputForm from '@/components/ServerInputForm';
import ServerAssignment from '@/components/ServerAssignment';
import ApplicationSetup from '@/components/ApplicationSetup';

import { generateMockFiles, compareFileTrees } from '@/lib/file-system';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft } from 'lucide-react';

enum ConfigStage {
  SERVER_INPUT = 'serverInput',
  SERVER_ASSIGNMENT = 'serverAssignment',
  APP_CONFIGURATION = 'appConfiguration',
  FILE_SYNC = 'fileSync',
}

export default function FileSyncPage() {
  const [currentStage, setCurrentStage] = useState<ConfigStage>(ConfigStage.SERVER_INPUT);

  // Stage 1: Server Input
  const [rawPrimaryServers, setRawPrimaryServers] = useState<RawServer[]>([]);
  const [rawDrServers, setRawDrServers] = useState<RawServer[]>([]);

  // Stage 2: Server Assignment
  const [availableServersForAssignment, setAvailableServersForAssignment] = useState<RawServer[]>([]);
  const [assignedPrimaryServers, setAssignedPrimaryServers] = useState<AssignedServer[]>([]);
  const [assignedDrServers, setAssignedDrServers] = useState<AssignedServer[]>([]);

  // Stage 3: Application Configuration
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplicationForSync, setSelectedApplicationForSync] = useState<Application | null>(null);

  // Stage 4: File Sync (existing state, now driven by selectedApplicationForSync)
  const [primaryPath, setPrimaryPath] = useState<string>(''); // Was: '/opt/app/live-data'
  const [drPath, setDrPath] = useState<string>(''); // Was: '/srv/app/dr-backup'
  
  const [primaryFiles, setPrimaryFiles] = useState<FileNode[]>([]);
  const [drFiles, setDrFiles] = useState<FileNode[]>([]);
  const [differences, setDifferences] = useState<FileDifference[]>([]);
  const [selectedDifference, setSelectedDifference] = useState<FileDifference | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<SuggestResolutionOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [isSyncLogOpen, setIsSyncLogOpen] = useState<boolean>(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false);
  const [isSyncingFile, setIsSyncingFile] = useState<boolean>(false);
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false);

  const { toast } = useToast();

  const addLogEntry = (message: string, status: SyncLogEntry['status']) => {
    setSyncLog(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toISOString(), message, status }]);
  };

  // Stage 1 Handlers
  const handleServerInputSubmit = (primaryNames: string[], drNames: string[]) => {
    const createRawServers = (names: string[], type: 'primary' | 'dr'): RawServer[] =>
      names.filter(name => name.trim() !== '').map((name, index) => ({
        id: `raw_${type}_${index}_${name.trim()}`,
        name: name.trim(),
        type,
      }));
    
    const newRawPrimary = createRawServers(primaryNames, 'primary');
    const newRawDr = createRawServers(drNames, 'dr');
    
    setRawPrimaryServers(newRawPrimary);
    setRawDrServers(newRawDr);
    setAvailableServersForAssignment([...newRawPrimary, ...newRawDr]);
    setCurrentStage(ConfigStage.SERVER_ASSIGNMENT);
    toast({ title: "Servers Entered", description: "Proceed to assign servers." });
  };

  // Stage 2 Handlers
  const handleServerAssignmentComplete = (primary: AssignedServer[], dr: AssignedServer[]) => {
    setAssignedPrimaryServers(primary);
    setAssignedDrServers(dr);
    setCurrentStage(ConfigStage.APP_CONFIGURATION);
    toast({ title: "Servers Assigned", description: "Proceed to configure applications." });
  };
  
  // Stage 3 Handlers
  const handleAddApplication = (app: Application) => {
    setApplications(prev => [...prev, app]);
    toast({ title: "Application Added", description: `${app.name} has been configured.` });
  };

  const handleStartFileSync = (app: Application) => {
    setSelectedApplicationForSync(app);
    setPrimaryPath(app.primaryPath); // Set paths from the selected application
    setDrPath(app.drPath);
    setCurrentStage(ConfigStage.FILE_SYNC);
    // Reset file sync specific states
    setPrimaryFiles([]);
    setDrFiles([]);
    setDifferences([]);
    setSelectedDifference(null);
    setAiSuggestion(null);
    toast({ title: `Starting Sync for ${app.name}`, description: `Loading files for application ${app.name}.`});
  };
  
  // Reset to a previous stage
  const handleGoBack = () => {
    if (currentStage === ConfigStage.FILE_SYNC) {
      setCurrentStage(ConfigStage.APP_CONFIGURATION);
      setSelectedApplicationForSync(null); // Clear selected app
      setPrimaryPath('');
      setDrPath('');
    } else if (currentStage === ConfigStage.APP_CONFIGURATION) {
      setCurrentStage(ConfigStage.SERVER_ASSIGNMENT);
    } else if (currentStage === ConfigStage.SERVER_ASSIGNMENT) {
      setCurrentStage(ConfigStage.SERVER_INPUT);
      // Optionally clear assigned servers if going back from assignment
      // setAssignedPrimaryServers([]);
      // setAssignedDrServers([]);
      // setAvailableServersForAssignment([]);
    }
  };


  // --- Existing File Sync Logic (adapted) ---
  useEffect(() => {
    // Auto-load files if paths are set (e.g., after selecting an app for sync)
    // and we are in FILE_SYNC stage.
    if (currentStage === ConfigStage.FILE_SYNC && selectedApplicationForSync && primaryPath && drPath) {
      handleLoadFiles();
    }
  }, [selectedApplicationForSync, primaryPath, drPath, currentStage]);


  const handleLoadFiles = useCallback(async () => {
    if (!primaryPath || !drPath) {
      toast({ title: "Path Error", description: "Primary and DR paths must be set for the application.", variant: "destructive" });
      return;
    }
    setIsGlobalLoading(true);
    setSelectedDifference(null);
    setAiSuggestion(null);
    addLogEntry(`Loading files from Primary: ${primaryPath} and DR: ${drPath} for app: ${selectedApplicationForSync?.name}`, 'info');
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockPrimary = generateMockFiles(primaryPath, 'primary');
    const mockDr = generateMockFiles(drPath, 'dr');
    
    const { updatedPrimaryTree, updatedDrTree, differences: comparedDifferences } = compareFileTrees(primaryPath, drPath, mockPrimary, mockDr);
    
    setPrimaryFiles(updatedPrimaryTree);
    setDrFiles(updatedDrTree);
    setDifferences(comparedDifferences);
    
    setIsGlobalLoading(false);
    addLogEntry(`Comparison complete for ${selectedApplicationForSync?.name}. Found ${comparedDifferences.length} differences.`, 'info');
    toast({ title: "Files Loaded", description: `File comparison complete for ${selectedApplicationForSync?.name}.` });
  }, [primaryPath, drPath, toast, selectedApplicationForSync]);


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
      setAiSuggestion(null);
    } else {
      const pFile = findNodeByPath(primaryFiles, node.path);
      const dFileNodePath = selectedApplicationForSync ? node.path.replace(selectedApplicationForSync.primaryPath, selectedApplicationForSync.drPath) : node.path;
      const dFile = findNodeByPath(drFiles, dFileNodePath);
      
      if (pFile?.status === 'synced' || dFile?.status === 'synced') {
         setSelectedDifference({
           path: node.relativePath,
           name: node.name,
           status: 'synced',
           primaryFile: pFile,
           drFile: dFile,
           summary: "Files are in sync."
         });
      } else {
        setSelectedDifference(null);
      }
    }
  }, [differences, primaryFiles, drFiles, selectedApplicationForSync]);

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
    await new Promise(resolve => setTimeout(resolve, 1500));

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
      await simulateSync(diff);
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    addLogEntry(`Sync all operation completed for ${selectedApplicationForSync?.name}. ${diffToSync.length} items processed.`, 'success');
    toast({ title: "Sync All Complete", description: `${diffToSync.length} items processed for ${selectedApplicationForSync?.name}.` });
    setIsSyncingAll(false);
  }, [differences, toast, selectedApplicationForSync]);
  
  const selectedFilePathForExplorer = useMemo(() => {
    if (selectedDifference?.primaryFile) return selectedDifference.primaryFile.path;
    if (selectedDifference?.drFile) return selectedDifference.drFile.path;
    return null;
  }, [selectedDifference]);

  const renderBackButton = () => {
    if (currentStage !== ConfigStage.SERVER_INPUT) {
      return (
        <Button variant="outline" onClick={handleGoBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back
        </Button>
      );
    }
    return null;
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <AppHeader />
      <ScrollArea className="flex-grow">
        <main className="container mx-auto p-4 md:p-6 space-y-6 ">
          {renderBackButton()}

          {currentStage === ConfigStage.SERVER_INPUT && (
            <ServerInputForm onSubmit={handleServerInputSubmit} />
          )}

          {currentStage === ConfigStage.SERVER_ASSIGNMENT && (
            <ServerAssignment
              availableServers={availableServersForAssignment}
              onAssignmentComplete={handleServerAssignmentComplete}
            />
          )}

          {currentStage === ConfigStage.APP_CONFIGURATION && (
            <ApplicationSetup
              assignedPrimaryServers={assignedPrimaryServers}
              assignedDrServers={assignedDrServers}
              existingApplications={applications}
              onAddApplication={handleAddApplication}
              onStartSync={handleStartFileSync}
            />
          )}
          
          {currentStage === ConfigStage.FILE_SYNC && selectedApplicationForSync && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Now Syncing: {selectedApplicationForSync.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Primary Path: <code className="font-code">{selectedApplicationForSync.primaryPath}</code></p>
                  <p>DR Path: <code className="font-code">{selectedApplicationForSync.drPath}</code></p>
                   <Button onClick={handleLoadFiles} disabled={isGlobalLoading} variant="default" size="sm" className="mt-2">
                    {isGlobalLoading ? 'Loading Files...' : 'Reload Files for This App'}
                  </Button>
                </CardContent>
              </Card>

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
            </>
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
