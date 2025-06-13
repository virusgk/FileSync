
'use client';

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import type { FileNode, FileDifference, SyncLogEntry, RawServer, AssignedServer, Application, AppConfigurationBundle } from '@/types';
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

import { generateMockFiles, compareFileTrees, addNodeToTree, removeNodeFromTree, updateNodeInTree } from '@/lib/file-system';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, Download } from 'lucide-react';

const CONFIG_VERSION = "1.0";

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

  // Stage 4: File Sync
  const [primaryPath, setPrimaryPath] = useState<string>('');
  const [drPath, setDrPath] = useState<string>('');
  
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addLogEntry = (message: string, status: SyncLogEntry['status']) => {
    setSyncLog(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toISOString(), message, status }]);
  };

  // Configuration Management
  const handleDownloadConfiguration = () => {
    const configBundle: AppConfigurationBundle = {
      rawPrimaryServers,
      rawDrServers,
      assignedPrimaryServers,
      assignedDrServers,
      applications,
      version: CONFIG_VERSION,
    };
    const jsonString = JSON.stringify(configBundle, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `filesync_config_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: "Configuration Downloaded", description: "Your current setup has been saved." });
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const loadedConfig: AppConfigurationBundle = JSON.parse(text);
        
        if (loadedConfig.version !== CONFIG_VERSION) {
            toast({ title: "Import Error", description: `Configuration version mismatch. Expected ${CONFIG_VERSION}, got ${loadedConfig.version}.`, variant: "destructive"});
            return;
        }

        setRawPrimaryServers(loadedConfig.rawPrimaryServers || []);
        setRawDrServers(loadedConfig.rawDrServers || []);
        setAssignedPrimaryServers(loadedConfig.assignedPrimaryServers || []);
        setAssignedDrServers(loadedConfig.assignedDrServers || []);
        setApplications(loadedConfig.applications || []);
        
        const allRawServers = [...(loadedConfig.rawPrimaryServers || []), ...(loadedConfig.rawDrServers || [])];
        setAvailableServersForAssignment(allRawServers); // Pass ALL raw servers to ServerAssignment

        setCurrentStage(ConfigStage.SERVER_ASSIGNMENT); 
        toast({ title: "Configuration Loaded", description: "System configuration has been imported successfully." });
      } catch (error) {
        console.error("Error loading configuration:", error);
        toast({ title: "Import Error", description: "Failed to parse or apply the configuration file.", variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };


  // Stage 1 Handlers
  const handleServerInputSubmit = (primaryNames: string[], drNames: string[]) => {
    const createRawServers = (names: string[], type: 'primary' | 'dr'): RawServer[] =>
      names.filter(name => name.trim() !== '').map((name, index) => ({
        id: `raw_${type}_${index}_${name.trim().replace(/\s+/g, '_')}_${Date.now()}`, // Ensure unique IDs
        name: name.trim(),
        type,
      }));
    
    const newRawPrimary = createRawServers(primaryNames, 'primary');
    const newRawDr = createRawServers(drNames, 'dr');
    
    setRawPrimaryServers(newRawPrimary);
    setRawDrServers(newRawDr);
    setAvailableServersForAssignment([...newRawPrimary, ...newRawDr]);
    // Reset further stages if new input is submitted
    setAssignedPrimaryServers([]);
    setAssignedDrServers([]);
    setApplications([]);
    setSelectedApplicationForSync(null);
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
    setPrimaryPath(app.primaryPath);
    setDrPath(app.drPath);
    setCurrentStage(ConfigStage.FILE_SYNC);
    setPrimaryFiles([]);
    setDrFiles([]);
    setDifferences([]);
    setSelectedDifference(null);
    setAiSuggestion(null);
    toast({ title: `Starting Sync for ${app.name}`, description: `Loading files for application ${app.name}.`});
  };
  
  const handleGoBack = () => {
    if (currentStage === ConfigStage.FILE_SYNC) {
      setCurrentStage(ConfigStage.APP_CONFIGURATION);
      setSelectedApplicationForSync(null);
      setPrimaryPath('');
      setDrPath('');
      setPrimaryFiles([]);
      setDrFiles([]);
      setDifferences([]);
      setSelectedDifference(null);
    } else if (currentStage === ConfigStage.APP_CONFIGURATION) {
      setCurrentStage(ConfigStage.SERVER_ASSIGNMENT);
    } else if (currentStage === ConfigStage.SERVER_ASSIGNMENT) {
      setCurrentStage(ConfigStage.SERVER_INPUT);
    }
  };

  useEffect(() => {
    if (currentStage === ConfigStage.FILE_SYNC && selectedApplicationForSync && primaryPath && drPath) {
      handleLoadFiles();
    }
  }, [selectedApplicationForSync, primaryPath, drPath, currentStage]);


  const handleLoadFiles = useCallback(async () => {
    if (!primaryPath || !drPath || !selectedApplicationForSync) {
      toast({ title: "Path Error", description: "Application paths must be set.", variant: "destructive" });
      return;
    }
    setIsGlobalLoading(true);
    setSelectedDifference(null);
    setAiSuggestion(null);
    addLogEntry(`Loading files from Primary: ${primaryPath} and DR: ${drPath} for app: ${selectedApplicationForSync.name}`, 'info');
    
    await new Promise(resolve => setTimeout(resolve, 1000)); 

    const mockPrimary = generateMockFiles(primaryPath, 'primary');
    const mockDr = generateMockFiles(drPath, 'dr');
    
    const { updatedPrimaryTree, updatedDrTree, differences: comparedDifferences } = compareFileTrees(primaryPath, drPath, mockPrimary, mockDr);
    
    setPrimaryFiles(updatedPrimaryTree);
    setDrFiles(updatedDrTree);
    setDifferences(comparedDifferences);
    
    setIsGlobalLoading(false);
    addLogEntry(`Comparison complete for ${selectedApplicationForSync.name}. Found ${comparedDifferences.length} differences.`, 'info');
    toast({ title: "Files Loaded", description: `File comparison complete for ${selectedApplicationForSync.name}.` });
  }, [primaryPath, drPath, toast, selectedApplicationForSync]);


  const findNodeByPathRecursive = (nodes: FileNode[], path: string): FileNode | undefined => {
    for (const node of nodes) {
      if (node.path === path) return node;
      if (node.children) {
        const found = findNodeByPathRecursive(node.children, path);
        if (found) return found;
      }
    }
    return undefined;
  };

  const handleToggleDirectory = useCallback((nodeToToggle: FileNode) => {
    const isPrimary = primaryFiles.some(n => findNodeByPathRecursive([n], nodeToToggle.path));
    const treeToUpdate = isPrimary ? primaryFiles : drFiles;
    const setTree = isPrimary ? setPrimaryFiles : setDrFiles;

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
      const pFile = findNodeByPathRecursive(primaryFiles, node.path);
      const drFilePath = selectedApplicationForSync && pFile ? pFile.path.replace(selectedApplicationForSync.primaryPath, selectedApplicationForSync.drPath) : '';
      const dFile = drFilePath ? findNodeByPathRecursive(drFiles, drFilePath) : undefined;
      
      if ((pFile?.status === 'synced' && dFile?.status === 'synced') || node.type === 'directory') {
         setSelectedDifference({
           path: node.relativePath,
           name: node.name,
           status: 'synced', 
           primaryFile: pFile,
           drFile: dFile,
           summary: node.type === 'file' ? "Files are in sync." : "Directory view."
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
    if (!selectedApplicationForSync) return;
    addLogEntry(`Syncing ${fileDiff.path} (Primary to DR) for ${selectedApplicationForSync.name}...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));

    let newPrimaryFiles = [...primaryFiles];
    let newDrFiles = [...drFiles];

    const pFile = fileDiff.primaryFile;
    const dFile = fileDiff.drFile;

    const updateStatusInPrimaryTree = (tree: FileNode[], relPath: string, newStatus: FileNode['status']): FileNode[] => 
      tree.map(n => {
        if (n.relativePath === relPath) return {...n, status: newStatus};
        if (n.children) return {...n, children: updateStatusInPrimaryTree(n.children, relPath, newStatus)};
        return n;
      });

    switch (fileDiff.status) {
      case 'primary_only':
        if (pFile) {
          newDrFiles = addNodeToTree(drFiles, selectedApplicationForSync.drPath, pFile);
          newPrimaryFiles = updateStatusInPrimaryTree(primaryFiles, pFile.relativePath, 'synced');
        }
        break;
      case 'dr_only':
        if (dFile) {
          newDrFiles = removeNodeFromTree(drFiles, dFile.relativePath);
          // No change to primary tree as the file wasn't there.
        }
        break;
      case 'different':
        if (pFile) {
          newDrFiles = updateNodeInTree(drFiles, fileDiff.path, pFile);
          newPrimaryFiles = updateStatusInPrimaryTree(primaryFiles, pFile.relativePath, 'synced');
        }
        break;
      default: 
        addLogEntry(`No sync action needed for ${fileDiff.path} (status: ${fileDiff.status})`, 'info');
        return; 
    }
    
    setPrimaryFiles(newPrimaryFiles);
    setDrFiles(newDrFiles);
    
    const { differences: newDifferences } = compareFileTrees(primaryPath, drPath, newPrimaryFiles, newDrFiles);
    setDifferences(newDifferences);

    if (selectedDifference?.path === fileDiff.path) {
      const updatedDiff = newDifferences.find(d => d.path === fileDiff.path);
      if (updatedDiff) {
          setSelectedDifference(updatedDiff);
      } else { 
          setSelectedDifference(prev => prev ? {...prev, status: 'synced', summary: "Successfully synced Primary to DR." } : null);
      }
    }
    
    addLogEntry(`Successfully synced ${fileDiff.path} (Primary to DR) for ${selectedApplicationForSync.name}`, 'success');
    toast({ title: "Sync Complete", description: `${fileDiff.name} synced to DR.` });
  };
  
  const handleSyncFile = useCallback(async (fileDiff: FileDifference) => {
    setIsSyncingFile(true);
    await simulateSync(fileDiff);
    setIsSyncingFile(false);
  }, [selectedDifference, toast, primaryFiles, drFiles, primaryPath, drPath, selectedApplicationForSync, simulateSync]);

  const handleSyncAllDifferent = useCallback(async () => {
    if (!selectedApplicationForSync) return;
    setIsSyncingAll(true);
    addLogEntry(`Starting sync for all differing items (Primary to DR) for ${selectedApplicationForSync.name}...`, 'info');
    
    const diffsToProcess = differences.filter(d => d.status === 'different' || d.status === 'primary_only' || d.status === 'dr_only');

    for (const diff of diffsToProcess) {
      await simulateSync(diff); 
      await new Promise(resolve => setTimeout(resolve, 200)); 
    }
    
    const { updatedPrimaryTree, updatedDrTree, differences: finalDifferences } = compareFileTrees(primaryPath, drPath, primaryFiles, drFiles); // Use latest state from primaryFiles, drFiles
    setPrimaryFiles(updatedPrimaryTree);
    setDrFiles(updatedDrTree);
    setDifferences(finalDifferences);

    addLogEntry(`Sync all operation completed for ${selectedApplicationForSync.name}. ${diffsToProcess.length} items processed.`, 'success');
    toast({ title: "Sync All Complete", description: `${diffsToProcess.length} items processed for ${selectedApplicationForSync.name}.` });
    setIsSyncingAll(false);
  }, [differences, toast, selectedApplicationForSync, primaryFiles, drFiles, primaryPath, drPath, simulateSync]); 
  
  const selectedFilePathForExplorer = useMemo(() => {
    if (selectedDifference?.primaryFile) return selectedDifference.primaryFile.path;
    if (selectedDifference?.drFile) return selectedDifference.drFile.path;
    // If only relative path is available (e.g. for a synced directory not in diffs)
    if (selectedDifference?.path && selectedApplicationForSync) {
        const pNode = findNodeByPathRecursive(primaryFiles, `${selectedApplicationForSync.primaryPath}/${selectedDifference.path}`.replace(/\/\//g, '/'));
        if (pNode) return pNode.path;
        const dNode = findNodeByPathRecursive(drFiles, `${selectedApplicationForSync.drPath}/${selectedDifference.path}`.replace(/\/\//g, '/'));
        if (dNode) return dNode.path;
    }
    return null;
  }, [selectedDifference, primaryFiles, drFiles, selectedApplicationForSync]);

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
            <ServerInputForm 
              onSubmit={handleServerInputSubmit} 
              onFileUpload={handleFileUpload} 
              key="server-input-form" // Add key to force re-mount if needed
            />
          )}

          {currentStage === ConfigStage.SERVER_ASSIGNMENT && (
            <ServerAssignment
              availableServers={availableServersForAssignment}
              initialPrimaryServers={assignedPrimaryServers} 
              initialDrServers={assignedDrServers}     
              onAssignmentComplete={handleServerAssignmentComplete}
              key={`server-assignment-${availableServersForAssignment.length}-${assignedPrimaryServers.length}-${assignedDrServers.length}`} // More specific key
            />
          )}

          {currentStage === ConfigStage.APP_CONFIGURATION && (
            <ApplicationSetup
              assignedPrimaryServers={assignedPrimaryServers}
              assignedDrServers={assignedDrServers}
              existingApplications={applications}
              onAddApplication={handleAddApplication}
              onStartSync={handleStartFileSync}
              onDownloadConfiguration={handleDownloadConfiguration}
              key={`app-config-${applications.length}`} // Key based on application count
            />
          )}
          
          {currentStage === ConfigStage.FILE_SYNC && selectedApplicationForSync && (
            <>
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Now Syncing: {selectedApplicationForSync.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p>Primary Server Path: <code className="font-code bg-muted p-1 rounded">{selectedApplicationForSync.primaryPath}</code> (Source)</p>
                  <p>DR Server Path: <code className="font-code bg-muted p-1 rounded">{selectedApplicationForSync.drPath}</code> (Target)</p>
                   <Button onClick={handleLoadFiles} disabled={isGlobalLoading} variant="default" size="sm" className="mt-2">
                    {isGlobalLoading ? 'Loading Files...' : 'Reload Files for This App'}
                  </Button>
                </CardContent>
              </Card>

              { (primaryFiles.length > 0 || drFiles.length > 0 || isGlobalLoading) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
                  <FileExplorer
                    title="Primary Server (Source)"
                    nodes={primaryFiles}
                    onSelectFile={handleSelectFile}
                    onToggleDirectory={handleToggleDirectory}
                    selectedFilePath={selectedFilePathForExplorer}
                    isLoading={isGlobalLoading}
                  />
                  <FileExplorer
                    title="DR Server (Target)"
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
              
              {differences.length > 0 && !isGlobalLoading && (
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

    