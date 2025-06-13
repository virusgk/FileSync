
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";


import { generateMockFiles, compareFileTrees, addNodeToTree, removeNodeFromTree, updateNodeInTree } from '@/lib/file-system';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Loader2 } from 'lucide-react';

const CONFIG_VERSION = "1.0";

enum ConfigStage {
  SERVER_INPUT = 'serverInput',
  SERVER_ASSIGNMENT = 'serverAssignment',
  APP_CONFIGURATION = 'appConfiguration',
  FILE_SYNC = 'fileSync',
}

export default function FileSyncPage() {
  const [currentStage, setCurrentStage] = useState<ConfigStage>(ConfigStage.SERVER_INPUT);

  // Server and App Configuration State
  const [rawPrimaryServers, setRawPrimaryServers] = useState<RawServer[]>([]);
  const [rawDrServers, setRawDrServers] = useState<RawServer[]>([]);
  const [availableServersForAssignment, setAvailableServersForAssignment] = useState<RawServer[]>([]);
  const [assignedPrimaryServers, setAssignedPrimaryServers] = useState<AssignedServer[]>([]);
  const [assignedDrServers, setAssignedDrServers] = useState<AssignedServer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplicationForSync, setSelectedApplicationForSync] = useState<Application | null>(null);

  // Server-side configuration list
  const [availableServerConfigs, setAvailableServerConfigs] = useState<string[]>([]);
  const [isServerConfigListLoading, setIsServerConfigListLoading] = useState<boolean>(true);
  const [isServerConfigLoading, setIsServerConfigLoading] = useState<boolean>(false);
  const [isSavingConfiguration, setIsSavingConfiguration] = useState<boolean>(false);
  const [isDeletingConfig, setIsDeletingConfig] = useState<boolean>(false);
  const [isRenamingConfig, setIsRenamingConfig] = useState<boolean>(false);


  // File Sync UI State
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

  // State for pre-sync confirmation
  const [syncConfirmationDetails, setSyncConfirmationDetails] = useState<{
    toAdd: number;
    toUpdate: number;
    toRemove: number;
  } | null>(null);
  const [isSyncConfirmDialogOpen, setIsSyncConfirmDialogOpen] = useState(false);


  const { toast } = useToast();

  const addLogEntry = (message: string, status: SyncLogEntry['status']) => {
    setSyncLog(prev => [...prev, { id: Date.now().toString(), timestamp: new Date().toISOString(), message, status }]);
  };

  const fetchAvailableConfigs = useCallback(async () => {
    setIsServerConfigListLoading(true);
    try {
      const response = await fetch('/api/configurations');
      if (!response.ok) throw new Error('Failed to fetch configurations');
      const data = await response.json();
      setAvailableServerConfigs(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Error fetching server configurations:", error);
      toast({ title: "Config List Error", description: (error as Error).message, variant: "destructive" });
      setAvailableServerConfigs([]);
    } finally {
      setIsServerConfigListLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchAvailableConfigs();
  }, [fetchAvailableConfigs]);


  const handleSaveConfigurationToServer = async () => {
    setIsSavingConfiguration(true);
    const configBundle: AppConfigurationBundle = {
      rawPrimaryServers,
      rawDrServers,
      assignedPrimaryServers,
      assignedDrServers,
      applications,
      version: CONFIG_VERSION,
    };
    try {
      const response = await fetch('/api/configurations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(configBundle),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to save configuration to server');
      }
      const result = await response.json();
      toast({ title: "Configuration Saved", description: `Successfully saved as ${result.filename} on the server.` });
      await fetchAvailableConfigs(); 
    } catch (error) {
      console.error("Error saving configuration to server:", error);
      toast({ title: "Save Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSavingConfiguration(false);
    }
  };

  const applyLoadedConfig = (loadedConfig: AppConfigurationBundle) => {
    if (loadedConfig.version !== CONFIG_VERSION) {
        toast({ title: "Import Error", description: `Configuration version mismatch. Expected ${CONFIG_VERSION}, got ${loadedConfig.version || 'unknown'}.`, variant: "destructive"});
        return;
    }

    setRawPrimaryServers(loadedConfig.rawPrimaryServers || []);
    setRawDrServers(loadedConfig.rawDrServers || []);
    setAssignedPrimaryServers(loadedConfig.assignedPrimaryServers || []);
    setAssignedDrServers(loadedConfig.assignedDrServers || []);
    setApplications(loadedConfig.applications || []);
    
    const allRawServersFromConfig = [...(loadedConfig.rawPrimaryServers || []), ...(loadedConfig.rawDrServers || [])];
    setAvailableServersForAssignment(allRawServersFromConfig);

    if (loadedConfig.applications && loadedConfig.applications.length > 0) {
        setCurrentStage(ConfigStage.APP_CONFIGURATION);
    } else if ((loadedConfig.assignedPrimaryServers && loadedConfig.assignedPrimaryServers.length > 0) || (loadedConfig.assignedDrServers && loadedConfig.assignedDrServers.length > 0)) {
        setCurrentStage(ConfigStage.SERVER_ASSIGNMENT);
    } else {
        if (allRawServersFromConfig.length > 0) {
             setCurrentStage(ConfigStage.SERVER_ASSIGNMENT);
        } else {
             setCurrentStage(ConfigStage.SERVER_INPUT);
        }
    }
    toast({ title: "Configuration Loaded", description: "System configuration has been applied." });
  };

  const handleLoadConfigFromServer = async (filename: string) => {
    if (!filename) return;
    setIsServerConfigLoading(true);
    try {
      const response = await fetch(`/api/configurations/${filename}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to load configuration '${filename}'`);
      }
      const loadedConfig = await response.json();
      applyLoadedConfig(loadedConfig);
    } catch (error) {
      console.error(`Error loading configuration ${filename} from server:`, error);
      toast({ title: "Load Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsServerConfigLoading(false);
    }
  };

  const handleFileUploadAndSave = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const loadedConfig: AppConfigurationBundle = JSON.parse(text);
        
        if (loadedConfig.version !== CONFIG_VERSION) {
            toast({ title: "Import Error", description: `Configuration version mismatch. Expected ${CONFIG_VERSION}, got ${loadedConfig.version}. File not saved to server.`, variant: "destructive"});
            return;
        }

        // Use POST to save it to the server
        const saveResponse = await fetch('/api/configurations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loadedConfig), // Send the full bundle
        });

        if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.error || 'Failed to save uploaded configuration to server');
        }
        const saveResult = await saveResponse.json();
        toast({ title: "Upload Successful", description: `Configuration from file '${file.name}' saved as '${saveResult.filename}' on server and applied.` });
        
        applyLoadedConfig(loadedConfig); // Apply the loaded (and now saved) config
        await fetchAvailableConfigs(); // Refresh the list of configs from server

      } catch (error) {
        console.error("Error processing uploaded configuration:", error);
        toast({ title: "Upload & Save Error", description: (error as Error).message, variant: "destructive" });
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteConfigFromServer = async (filename: string) => {
    setIsDeletingConfig(true);
    try {
      const response = await fetch(`/api/configurations/${filename}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete configuration '${filename}'`);
      }
      toast({ title: "Configuration Deleted", description: `Configuration '${filename}' has been deleted from the server.` });
      await fetchAvailableConfigs(); // Refresh the list
    } catch (error) {
      console.error(`Error deleting configuration ${filename} from server:`, error);
      toast({ title: "Delete Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsDeletingConfig(false);
    }
  };

  const handleRenameConfigFromServer = async (oldFilename: string, newFilename: string) => {
    setIsRenamingConfig(true);
    try {
      const response = await fetch(`/api/configurations/${oldFilename}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newFilename }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || `Failed to rename configuration '${oldFilename}'`);
      }
      toast({ title: "Configuration Renamed", description: result.message });
      await fetchAvailableConfigs(); // Refresh the list
    } catch (error) {
      console.error(`Error renaming configuration ${oldFilename} from server:`, error);
      toast({ title: "Rename Error", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsRenamingConfig(false);
    }
  };


  // Stage 1 Handlers
  const handleServerInputSubmit = (primaryNames: string[], drNames: string[]) => {
    const createRawServers = (names: string[], type: 'primary' | 'dr'): RawServer[] =>
      names.filter(name => name.trim() !== '').map((name, index) => ({
        id: `raw_${type}_${index}_${name.trim().replace(/\s+/g, '_')}_${Date.now()}`,
        name: name.trim(),
        type,
      }));
    
    const newRawPrimary = createRawServers(primaryNames, 'primary');
    const newRawDr = createRawServers(drNames, 'dr');
    
    setRawPrimaryServers(newRawPrimary);
    setRawDrServers(newRawDr);
    setAvailableServersForAssignment([...newRawPrimary, ...newRawDr]);
    setAssignedPrimaryServers([]); // Reset assigned servers
    setAssignedDrServers([]);     // Reset assigned servers
    setApplications([]);          // Reset applications
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
  const handleUpdateApplications = (updatedApplications: Application[]) => {
    setApplications(updatedApplications);
  };


  const handleStartFileSync = (app: Application) => {
    setSelectedApplicationForSync(app);
    setPrimaryPath(app.primaryPath);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    
    // Simulate network delay for loading files
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
      // If no direct diff, it might be a synced file or a directory
      const pFile = findNodeByPathRecursive(primaryFiles, node.path);
      const drFilePath = selectedApplicationForSync && pFile ? pFile.path.replace(selectedApplicationForSync.primaryPath, selectedApplicationForSync.drPath) : '';
      const dFile = drFilePath ? findNodeByPathRecursive(drFiles, drFilePath) : undefined;
      
      if ((pFile?.status === 'synced' && dFile?.status === 'synced') || node.type === 'directory') {
         setSelectedDifference({
           path: node.relativePath,
           name: node.name,
           status: 'synced', // Treat as synced if no diff and files exist, or if it's a directory
           primaryFile: pFile,
           drFile: dFile,
           summary: node.type === 'file' ? "Files are in sync." : "Directory view."
         });
      } else {
        // Could be a scenario not covered, or user clicked a file not part of a diff (e.g. parent dir)
        setSelectedDifference(null); // Or a more informative default state
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
    if (!selectedApplicationForSync) return { newPrimaryFiles: primaryFiles, newDrFiles: drFiles };
    addLogEntry(`Syncing ${fileDiff.path} (Primary to DR) for ${selectedApplicationForSync.name}...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    let newPrimaryFiles = JSON.parse(JSON.stringify(primaryFiles)) as FileNode[];
    let newDrFiles = JSON.parse(JSON.stringify(drFiles)) as FileNode[];

    const pFile = fileDiff.primaryFile;
    const dFile = fileDiff.drFile;

    const updateStatusInTreeRecursive = (nodes: FileNode[], relPath: string, newStatus: FileNode['status']): FileNode[] => 
      nodes.map(n => {
        if (n.relativePath === relPath) return {...n, status: newStatus};
        if (n.children) return {...n, children: updateStatusInTreeRecursive(n.children, relPath, newStatus)};
        return n;
      });

    switch (fileDiff.status) {
      case 'primary_only':
        if (pFile) {
          // Add primary file/dir to DR tree
          newDrFiles = addNodeToTree(newDrFiles, selectedApplicationForSync.drPath, pFile);
          // Mark primary file/dir as synced
          newPrimaryFiles = updateStatusInTreeRecursive(newPrimaryFiles, pFile.relativePath, 'synced');
        }
        break;
      case 'dr_only':
        if (dFile) { 
          // Remove dr_only file/dir from DR tree
          newDrFiles = removeNodeFromTree(newDrFiles, dFile.relativePath);
          // No change to primary tree for dr_only
        }
        break;
      case 'different':
        if (pFile) { // Primary is source of truth
          // Update DR file/dir with primary's content/metadata
          newDrFiles = updateNodeInTree(newDrFiles, fileDiff.path, pFile);
          // Mark primary file/dir as synced
          newPrimaryFiles = updateStatusInTreeRecursive(newPrimaryFiles, pFile.relativePath, 'synced');
        }
        break;
      default: 
        addLogEntry(`No sync action needed for ${fileDiff.path} (status: ${fileDiff.status})`, 'info');
        return { newPrimaryFiles, newDrFiles }; // No changes if already synced
    }
    
    // After action, if the primary file was involved, its corresponding DR path should also be marked synced
    if (pFile) {
      newDrFiles = updateStatusInTreeRecursive(newDrFiles, pFile.relativePath, 'synced');
    }
    
    return { newPrimaryFiles, newDrFiles };
  };
  
  const handleSyncFile = useCallback(async (fileDiff: FileDifference) => {
    setIsSyncingFile(true);
    const { newPrimaryFiles, newDrFiles } = await simulateSync(fileDiff);
    
    // Re-compare trees to get updated differences and statuses
    const { updatedPrimaryTree, updatedDrTree, differences: newDifferences } = compareFileTrees(primaryPath, drPath, newPrimaryFiles, newDrFiles);
    setPrimaryFiles(updatedPrimaryTree);
    setDrFiles(updatedDrTree);
    setDifferences(newDifferences);

    // Update selected difference view
    const updatedSelectedDiff = newDifferences.find(d => d.path === fileDiff.path);
    if (updatedSelectedDiff) {
        setSelectedDifference(updatedSelectedDiff);
    } else { // If not found, it means it's synced and no longer a "difference"
        const syncedPFile = findNodeByPathRecursive(updatedPrimaryTree, `${primaryPath}/${fileDiff.path}`.replace(/\/\//g, '/'));
        const syncedDFile = findNodeByPathRecursive(updatedDrTree, `${drPath}/${fileDiff.path}`.replace(/\/\//g, '/'));
        setSelectedDifference({
            path: fileDiff.path,
            name: fileDiff.name,
            status: 'synced',
            primaryFile: syncedPFile,
            drFile: syncedDFile,
            summary: "Successfully synced Primary to DR."
        });
    }
    
    addLogEntry(`Successfully synced ${fileDiff.path} (Primary to DR) for ${selectedApplicationForSync!.name}`, 'success');
    toast({ title: "Sync Complete", description: `${fileDiff.name} processed for sync to DR.` });
    setIsSyncingFile(false);
  }, [primaryFiles, drFiles, primaryPath, drPath, selectedApplicationForSync, toast]);


  const executeConfirmedSyncAll = useCallback(async () => {
    if (!selectedApplicationForSync) return;
    setIsSyncingAll(true);
    addLogEntry(`Starting sync for all differing items (Primary to DR) for ${selectedApplicationForSync.name}...`, 'info');
    
    let currentPrimary = JSON.parse(JSON.stringify(primaryFiles));
    let currentDr = JSON.parse(JSON.stringify(drFiles));
    
    const diffsToProcess = differences.filter(d => d.status === 'different' || d.status === 'primary_only' || d.status === 'dr_only');
    let itemsProcessedCount = 0;

    for (const diff of diffsToProcess) {
      const { newPrimaryFiles, newDrFiles } = await simulateSync(diff); 
      currentPrimary = newPrimaryFiles; 
      currentDr = newDrFiles;     
      itemsProcessedCount++;
      await new Promise(resolve => setTimeout(resolve, 100)); 
    }
    
    const { updatedPrimaryTree, updatedDrTree, differences: finalDifferences } = compareFileTrees(primaryPath, drPath, currentPrimary, currentDr);
    setPrimaryFiles(updatedPrimaryTree);
    setDrFiles(updatedDrTree);
    setDifferences(finalDifferences);

    setSelectedDifference(null); 

    addLogEntry(`Sync all operation completed for ${selectedApplicationForSync.name}. ${itemsProcessedCount} items processed.`, 'success');
    toast({ title: "Sync All Complete", description: `${itemsProcessedCount} items processed for ${selectedApplicationForSync.name}.` });
    setIsSyncingAll(false);
    setIsSyncConfirmDialogOpen(false);
    setSyncConfirmationDetails(null);
  }, [differences, toast, selectedApplicationForSync, primaryFiles, drFiles, primaryPath, drPath]); 


  const handleSyncAllDifferent = useCallback(async () => {
    if (!selectedApplicationForSync || differences.length === 0) return;

    let toAdd = 0;
    let toUpdate = 0;
    let toRemove = 0;

    differences.forEach(diff => {
      if (diff.status === 'primary_only') toAdd++;
      else if (diff.status === 'different') toUpdate++;
      else if (diff.status === 'dr_only') toRemove++;
    });

    if (toAdd === 0 && toUpdate === 0 && toRemove === 0) {
      toast({ title: "No Changes", description: "All files are already in sync or no actionable differences found." });
      return;
    }

    setSyncConfirmationDetails({ toAdd, toUpdate, toRemove });
    setIsSyncConfirmDialogOpen(true);
    // The actual sync is now triggered by `executeConfirmedSyncAll`
  }, [differences, selectedApplicationForSync, toast]);
  
  const selectedFilePathForExplorer = useMemo(() => {
    if (selectedDifference?.primaryFile) return selectedDifference.primaryFile.path;
    if (selectedDifference?.drFile) return selectedDifference.drFile.path;
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
              onFileUpload={handleFileUploadAndSave}
              availableServerConfigs={availableServerConfigs}
              onLoadConfigFromServer={handleLoadConfigFromServer}
              onDeleteConfigFromServer={handleDeleteConfigFromServer}
              onRenameConfigFromServer={handleRenameConfigFromServer}
              isServerConfigListLoading={isServerConfigListLoading}
              isServerConfigLoading={isServerConfigLoading}
              isDeletingConfig={isDeletingConfig}
              isRenamingConfig={isRenamingConfig}
              key={`server-input-${availableServerConfigs.join('-')}`} 
            />
          )}

          {currentStage === ConfigStage.SERVER_ASSIGNMENT && (
            <ServerAssignment
              availableServers={availableServersForAssignment}
              initialPrimaryServers={assignedPrimaryServers} 
              initialDrServers={assignedDrServers}     
              onAssignmentComplete={handleServerAssignmentComplete}
              key={`server-assignment-${availableServersForAssignment.map(s=>s.id).join('-')}-${assignedPrimaryServers.length}-${assignedDrServers.length}`}
            />
          )}

          {currentStage === ConfigStage.APP_CONFIGURATION && (
            <ApplicationSetup
              assignedPrimaryServers={assignedPrimaryServers}
              assignedDrServers={assignedDrServers}
              applications={applications}
              onUpdateApplications={handleUpdateApplications}
              onStartSync={handleStartFileSync}
              onSaveConfiguration={handleSaveConfigurationToServer}
              isSavingConfiguration={isSavingConfiguration}
              key={`app-config-${applications.length}-${assignedPrimaryServers.length}-${assignedDrServers.length}`}
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
                    {isGlobalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
                  canSync={!isGlobalLoading && differences.filter(d => d.status !== 'synced').length > 0}
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
      {isSyncConfirmDialogOpen && syncConfirmationDetails && (
        <AlertDialog open={isSyncConfirmDialogOpen} onOpenChange={setIsSyncConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Synchronization</AlertDialogTitle>
                    <AlertDialogDescription>
                        Please review the changes that will be made:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Items to Add to DR: <strong>{syncConfirmationDetails.toAdd}</strong></li>
                            <li>Items to Update on DR: <strong>{syncConfirmationDetails.toUpdate}</strong></li>
                            <li>Items to Remove from DR: <strong>{syncConfirmationDetails.toRemove}</strong></li>
                        </ul>
                        This action will synchronize files from Primary to DR based on the differences found.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsSyncConfirmDialogOpen(false)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={executeConfirmedSyncAll} disabled={isSyncingAll}>
                        {isSyncingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Confirm & Sync All
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
    
