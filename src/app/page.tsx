
'use client';

import { useState, useCallback, useMemo, useEffect } from 'react';
import type { FileNode, FileDifference, SyncLogEntry, RawServer, AssignedServer, Application, AppConfigurationBundle, SyncOperationError } from '@/types';
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

// import { generateMockFiles, compareFileTrees, addNodeToTree, removeNodeFromTree, updateNodeInTree } from '@/lib/file-system'; // Old mock system
import { compareFileTrees } from '@/lib/file-system';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Loader2, AlertTriangleIcon } from 'lucide-react';

const CONFIG_VERSION = "1.0";

enum ConfigStage {
  SERVER_INPUT = 'serverInput',
  SERVER_ASSIGNMENT = 'serverAssignment',
  APP_CONFIGURATION = 'appConfiguration',
  FILE_SYNC = 'fileSync',
}

// Basic path risk check for UI warning
const isPotentiallyRiskyPath = (filePath: string): boolean => {
    const p = filePath.toLowerCase().trim();
    // Very basic check for root paths on Windows/Unix or common sensitive dirs
    // THIS IS NOT A SECURITY MECHANISM, just a UI hint.
    return p === "c:\\" || p === "c:/" || p === "/" ||
           p.startsWith("c:\\windows") || p.startsWith("/etc") || p.startsWith("/bin") ||
           p.startsWith("/usr/bin") || p.startsWith("/usr/sbin") || p.startsWith("/sbin") ||
           p.startsWith("c:/windows");
};


export default function FileSyncPage() {
  const [currentStage, setCurrentStage] = useState<ConfigStage>(ConfigStage.SERVER_INPUT);

  const [rawPrimaryServers, setRawPrimaryServers] = useState<RawServer[]>([]);
  const [rawDrServers, setRawDrServers] = useState<RawServer[]>([]);
  const [availableServersForAssignment, setAvailableServersForAssignment] = useState<RawServer[]>([]);
  const [assignedPrimaryServers, setAssignedPrimaryServers] = useState<AssignedServer[]>([]);
  const [assignedDrServers, setAssignedDrServers] = useState<AssignedServer[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplicationForSync, setSelectedApplicationForSync] = useState<Application | null>(null);

  const [availableServerConfigs, setAvailableServerConfigs] = useState<string[]>([]);
  const [isServerConfigListLoading, setIsServerConfigListLoading] = useState<boolean>(true);
  const [isServerConfigLoading, setIsServerConfigLoading] = useState<boolean>(false);
  const [isSavingConfiguration, setIsSavingConfiguration] = useState<boolean>(false);
  const [isDeletingConfig, setIsDeletingConfig] = useState<boolean>(false);
  const [isRenamingConfig, setIsRenamingConfig] = useState<boolean>(false);

  const [primaryPath, setPrimaryPath] = useState<string>(''); // Will be set by selectedApplicationForSync
  const [drPath, setDrPath] = useState<string>(''); // Will be set by selectedApplicationForSync
  const [primaryFiles, setPrimaryFiles] = useState<FileNode[]>([]);
  const [drFiles, setDrFiles] = useState<FileNode[]>([]);
  const [differences, setDifferences] = useState<FileDifference[]>([]);
  const [selectedDifference, setSelectedDifference] = useState<FileDifference | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<SuggestResolutionOutput | null>(null);
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [isSyncLogOpen, setIsSyncLogOpen] = useState<boolean>(false);
  const [isGlobalLoading, setIsGlobalLoading] = useState<boolean>(false); // For loading file structures
  const [isSyncingFile, setIsSyncingFile] = useState<boolean>(false); // For individual file sync
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false); // For sync all

  const [syncConfirmationDetails, setSyncConfirmationDetails] = useState<{
    toAdd: number;
    toUpdate: number;
    toRemove: number;
  } | null>(null);
  const [isSyncConfirmDialogOpen, setIsSyncConfirmDialogOpen] = useState(false);
  const [pathWarning, setPathWarning] = useState<string | null>(null);


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
      addLogEntry(`Configuration saved as ${result.filename}`, 'success');
      await fetchAvailableConfigs(); 
    } catch (error) {
      console.error("Error saving configuration to server:", error);
      toast({ title: "Save Error", description: (error as Error).message, variant: "destructive" });
      addLogEntry(`Error saving configuration: ${(error as Error).message}`, 'error');
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
    addLogEntry("System configuration loaded and applied.", 'info');
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
      addLogEntry(`Loaded configuration '${filename}' from server.`, 'success');
    } catch (error) {
      console.error(`Error loading configuration ${filename} from server:`, error);
      toast({ title: "Load Error", description: (error as Error).message, variant: "destructive" });
      addLogEntry(`Error loading configuration '${filename}': ${(error as Error).message}`, 'error');
    } finally {
      setIsServerConfigLoading(false);
    }
  };

  const handleFileUploadAndSave = async (file: File) => {
    setIsServerConfigLoading(true); // Reuse loading state
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        const loadedConfig: AppConfigurationBundle = JSON.parse(text);
        
        if (loadedConfig.version !== CONFIG_VERSION) {
            toast({ title: "Import Error", description: `Configuration version mismatch. Expected ${CONFIG_VERSION}, got ${loadedConfig.version}. File not saved to server.`, variant: "destructive"});
            setIsServerConfigLoading(false);
            return;
        }
        const saveResponse = await fetch('/api/configurations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(loadedConfig),
        });
        if (!saveResponse.ok) {
            const errorData = await saveResponse.json();
            throw new Error(errorData.error || 'Failed to save uploaded configuration to server');
        }
        const saveResult = await saveResponse.json();
        toast({ title: "Upload Successful", description: `Configuration from file '${file.name}' saved as '${saveResult.filename}' on server and applied.` });
        addLogEntry(`Uploaded and saved configuration from '${file.name}' as '${saveResult.filename}'.`, 'success');
        applyLoadedConfig(loadedConfig);
        await fetchAvailableConfigs();
      } catch (error) {
        console.error("Error processing uploaded configuration:", error);
        toast({ title: "Upload & Save Error", description: (error as Error).message, variant: "destructive" });
        addLogEntry(`Error processing uploaded config: ${(error as Error).message}`, 'error');
      } finally {
        setIsServerConfigLoading(false);
      }
    };
    reader.readAsText(file);
  };

  const handleDeleteConfigFromServer = async (filename: string) => {
    setIsDeletingConfig(true);
    try {
      const response = await fetch(`/api/configurations/${filename}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete configuration '${filename}'`);
      }
      toast({ title: "Configuration Deleted", description: `Configuration '${filename}' has been deleted from the server.` });
      addLogEntry(`Deleted configuration '${filename}'.`, 'success');
      await fetchAvailableConfigs();
    } catch (error) {
      console.error(`Error deleting configuration ${filename} from server:`, error);
      toast({ title: "Delete Error", description: (error as Error).message, variant: "destructive" });
      addLogEntry(`Error deleting configuration '${filename}': ${(error as Error).message}`, 'error');
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
      addLogEntry(`Renamed configuration '${oldFilename}' to '${newFilename}'.`, 'success');
      await fetchAvailableConfigs();
    } catch (error) {
      console.error(`Error renaming configuration ${oldFilename} from server:`, error);
      toast({ title: "Rename Error", description: (error as Error).message, variant: "destructive" });
      addLogEntry(`Error renaming config: ${(error as Error).message}`, 'error');
    } finally {
      setIsRenamingConfig(false);
    }
  };

  const handleServerInputSubmit = (primaryNames: string[], drNames: string[]) => {
    const createRawServers = (names: string[], type: 'primary' | 'dr'): RawServer[] =>
      names.filter(name => name.trim() !== '').map((name, index) => ({
        id: `raw_${type}_${index}_${name.trim().replace(/\s+/g, '_')}_${Date.now()}`,
        name: name.trim(), type,
      }));
    const newRawPrimary = createRawServers(primaryNames, 'primary');
    const newRawDr = createRawServers(drNames, 'dr');
    setRawPrimaryServers(newRawPrimary);
    setRawDrServers(newRawDr);
    setAvailableServersForAssignment([...newRawPrimary, ...newRawDr]);
    setAssignedPrimaryServers([]); setAssignedDrServers([]); setApplications([]); setSelectedApplicationForSync(null);
    setCurrentStage(ConfigStage.SERVER_ASSIGNMENT);
    toast({ title: "Servers Entered", description: "Proceed to assign servers." });
    addLogEntry("Manually entered servers, proceeding to assignment.", 'info');
  };

  const handleServerAssignmentComplete = (primary: AssignedServer[], dr: AssignedServer[]) => {
    setAssignedPrimaryServers(primary); setAssignedDrServers(dr);
    setCurrentStage(ConfigStage.APP_CONFIGURATION);
    toast({ title: "Servers Assigned", description: "Proceed to configure applications." });
    addLogEntry("Server assignment complete, proceeding to app config.", 'info');
  };
  
  const handleUpdateApplications = (updatedApplications: Application[]) => {
    setApplications(updatedApplications);
  };

  const handleStartFileSync = (app: Application) => {
    setPathWarning(null);
    if (isPotentiallyRiskyPath(app.primaryPath) || isPotentiallyRiskyPath(app.drPath)) {
        setPathWarning(`Warning: The paths for application "${app.name}" (${app.primaryPath}, ${app.drPath}) appear to point to sensitive or root directories. Please ensure these are correct and you understand the risks before proceeding with any synchronization operations.`);
    }
    setSelectedApplicationForSync(app);
    setPrimaryPath(app.primaryPath); // Set from selected app
    setDrPath(app.drPath);           // Set from selected app
    setCurrentStage(ConfigStage.FILE_SYNC);
    setPrimaryFiles([]); setDrFiles([]); setDifferences([]); setSelectedDifference(null); setAiSuggestion(null);
    toast({ title: `Starting Sync for ${app.name}`, description: `Loading files for application ${app.name}.`});
    addLogEntry(`Starting FileSync for app: ${app.name}`, 'info');
  };
  
  const handleGoBack = () => {
    setPathWarning(null);
    if (currentStage === ConfigStage.FILE_SYNC) {
      setCurrentStage(ConfigStage.APP_CONFIGURATION);
      setSelectedApplicationForSync(null);
      setPrimaryPath(''); setDrPath(''); setPrimaryFiles([]); setDrFiles([]); setDifferences([]); setSelectedDifference(null);
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
  }, [selectedApplicationForSync, primaryPath, drPath, currentStage]); // handleLoadFiles is memoized

  const handleLoadFiles = useCallback(async () => {
    if (!primaryPath || !drPath || !selectedApplicationForSync) {
      toast({ title: "Path Error", description: "Application paths must be set.", variant: "destructive" });
      return;
    }
    setIsGlobalLoading(true); setSelectedDifference(null); setAiSuggestion(null);
    addLogEntry(`Loading files from Primary: ${primaryPath} and DR: ${drPath} for app: ${selectedApplicationForSync.name}`, 'info');
    
    console.log(`[DEBUG] Requesting Primary Files from: ${primaryPath}`);
    const primaryResponsePromise = fetch('/api/list-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPath: primaryPath }) });
    
    console.log(`[DEBUG] Requesting DR Files from: ${drPath}`);
    const drResponsePromise = fetch('/api/list-files', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetPath: drPath }) });

    try {
      const [primaryResponse, drResponse] = await Promise.all([primaryResponsePromise, drResponsePromise]);

      let primaryData: FileNode[] = [];
      let drData: FileNode[] = [];
      let pErrorDetails: string | null = null;
      let dErrorDetails: string | null = null;

      if (primaryResponse.ok) {
        primaryData = await primaryResponse.json();
        console.log('[DEBUG] Primary Data Received (first 500 chars):', JSON.stringify(primaryData, null, 2).substring(0,500));
      } else {
        const pError = await primaryResponse.json();
        pErrorDetails = pError?.details || pError?.error || `Status: ${primaryResponse.status} ${primaryResponse.statusText}`;
        console.error("Primary file list error response:", pError);
      }

      if (drResponse.ok) {
        drData = await drResponse.json();
        console.log('[DEBUG] DR Data Received (first 500 chars):', JSON.stringify(drData, null, 2).substring(0,500));
      } else {
        const dError = await drResponse.json();
        dErrorDetails = dError?.details || dError?.error || `Status: ${drResponse.status} ${drResponse.statusText}`;
        console.error("DR file list error response:", dError);
      }
      
      if (!primaryResponse.ok && !drResponse.ok) {
         const errorMsg = `Failed to load file structures. Primary Error: ${pErrorDetails}. DR Error: ${dErrorDetails}`;
         console.error(errorMsg);
         throw new Error(errorMsg);
      } else if (!primaryResponse.ok) {
         const errorMsg = `Failed to load Primary file structure: ${pErrorDetails}. DR loaded successfully.`;
         console.error(errorMsg);
         throw new Error(errorMsg);
      } else if (!drResponse.ok) {
         const errorMsg = `Failed to load DR file structure: ${dErrorDetails}. Primary loaded successfully.`;
         console.error(errorMsg);
         throw new Error(errorMsg);
      }
      
      const { updatedPrimaryTree, updatedDrTree, differences: comparedDifferences } = compareFileTrees(primaryPath, drPath, primaryData, drData);
      
      setPrimaryFiles(updatedPrimaryTree);
      setDrFiles(updatedDrTree);
      setDifferences(comparedDifferences);
      
      addLogEntry(`Comparison complete for ${selectedApplicationForSync.name}. Found ${comparedDifferences.length} differences.`, 'info');
      toast({ title: "Files Loaded & Compared", description: `File comparison complete for ${selectedApplicationForSync.name}.` });

    } catch (error) {
      console.error("Error loading file structures in handleLoadFiles:", error);
      toast({ title: "File Load Error", description: (error as Error).message, variant: "destructive" });
      addLogEntry(`Error loading files: ${(error as Error).message}`, 'error');
      setPrimaryFiles([]); setDrFiles([]); setDifferences([]);
    } finally {
      setIsGlobalLoading(false);
    }
  }, [primaryPath, drPath, toast, selectedApplicationForSync]);

  const findNodeByPathRecursive = (nodes: FileNode[], path: string): FileNode | undefined => {
    if (!Array.isArray(nodes)) return undefined;
    for (const node of nodes) {
      if (!node || typeof node !== 'object') continue;
      if (node.path === path) return node;
      if (node.children && Array.isArray(node.children)) {
        const found = findNodeByPathRecursive(node.children, path);
        if (found) return found;
      }
    }
    return undefined;
  };

  // Helper function to immutably update a node's children in the tree
  const updateNodeChildrenRecursive = (nodes: FileNode[], targetId: string, newChildren: FileNode[]): FileNode[] => {
      if (!Array.isArray(nodes)) return nodes;
      return nodes.map(node => {
          if (node.id === targetId) {
              // Found the target node, update its children
              return { ...node, children: newChildren, isLoading: false };
          }
          if (node.children && Array.isArray(node.children)) {
              // Recursively search in children
              const updatedChildren = updateNodeChildrenRecursive(node.children, targetId, newChildren);
              // Only create a new parent object if children were updated
              if (updatedChildren !== node.children) {
                  return { ...node, children: updatedChildren };
              }
          }
          // No change needed for this node or its children
          return node;
      });
  };

  // State to track which directories are currently loading their children
  const [loadingDirectoryIds, setLoadingDirectoryIds] = useState<Set<string>>(new Set());

  const handleToggleDirectory = useCallback((nodeToToggle: FileNode) => {
    const isPrimary = primaryFiles.some(n => findNodeByPathRecursive([n], nodeToToggle.path));
    const treeToUpdate = isPrimary ? primaryFiles : drFiles;
    const setTree = isPrimary ? setPrimaryFiles : setDrFiles;
    
    const updateOpenState = (nodes: FileNode[]): FileNode[] => {
        if (!Array.isArray(nodes)) {
            console.warn("[DEBUG] updateOpenState received non-array:", nodes);
            return []; 
        }
        return nodes.map(n => {
            if (!n || typeof n !== 'object') {
                console.warn("[DEBUG] updateOpenState skipping non-object node:", n);
                return n;
            }

            // Found the node to toggle
            if (n.id === nodeToToggle.id) {
                const newIsOpen = !n.isOpen;
                let updatedNode = { ...n, isOpen: newIsOpen };

                // If opening and children are not loaded, fetch them
                if (newIsOpen && (!n.children || n.children.length === 0) && !loadingDirectoryIds.has(n.id)) {
                     // Set loading state for this node
                     setLoadingDirectoryIds(prev => new Set(prev).add(n.id));
                     updatedNode = { ...updatedNode, isLoading: true };

                     // Fetch children asynchronously
                     fetch('/api/list-files', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ targetPath: n.path }),
                     })
                     .then(res => {
                         if (!res.ok) throw new Error(`Failed to load children for ${n.path}`);
                         return res.json();
                     })
                     .then(childrenData => {
                         // Update the tree with fetched children
                         setTree(prevTree => updateNodeChildrenRecursive(prevTree, n.id, childrenData));
                         addLogEntry(`Loaded children for directory: ${n.path}`, 'info');
                     })
                     .catch(error => {
                         console.error(`Error fetching children for ${n.path}:`, error);
                         addLogEntry(`Error loading children for ${n.path}: ${(error as Error).message}`, 'error');
                         toast({ title: "Load Children Error", description: `Could not load children for ${n.path}.`, variant: "destructive" });
                         // Clear loading state and potentially mark node with error
                         setTree(prevTree => updateNodeChildrenRecursive(prevTree, n.id, [])); // Keep children empty on error
                     })
                     .finally(() => {
                         setLoadingDirectoryIds(prev => { const newState = new Set(prev); newState.delete(n.id); return newState; });
                     });
                }
                return updatedNode;
            }
            if (n.children && Array.isArray(n.children)) {
                const newChildren = updateOpenState(n.children);
                if (newChildren !== n.children) {
 return { ...n, children: newChildren };
                }
            }
            return n;
        });
    };
    // Perform the initial state update immediately to toggle isOpen
    setTree(prevTree => updateOpenState(prevTree));
  }, [primaryFiles, drFiles, toast, addLogEntry, loadingDirectoryIds]);

  const handleSelectFile = useCallback((node: FileNode) => {
    const diff = differences.find(d => d.path === node.relativePath);
    if (diff) {
      setSelectedDifference(diff); setAiSuggestion(null);
    } else {
      const pFile = findNodeByPathRecursive(primaryFiles, node.path);
      const drFilePath = selectedApplicationForSync && pFile ? pFile.path.replace(selectedApplicationForSync.primaryPath, selectedApplicationForSync.drPath) : '';
      const dFile = drFilePath ? findNodeByPathRecursive(drFiles, drFilePath) : undefined;
      
      const nodeType = node.type || 'file';

      if ((pFile?.status === 'synced' && dFile?.status === 'synced') || nodeType === 'directory') {
         setSelectedDifference({ 
            path: node.relativePath, 
            name: node.name, 
            type: nodeType, 
            status: 'synced', 
            primaryFile: pFile, 
            drFile: dFile, 
            summary: nodeType === 'file' ? "Files are in sync." : "Directory view." 
        });
      } else { setSelectedDifference(null); }
    }
  }, [differences, primaryFiles, drFiles, selectedApplicationForSync]);

  const handleGetAiSuggestion = useCallback(async (details: {primaryPath: string, drPath: string, diffSummary: string}) => {
    if (!selectedDifference) return;
    setIsAiLoading(true); setAiSuggestion(null);
    addLogEntry(`Requesting AI suggestion for: ${selectedDifference.path}`, 'info');
    try {
      const result = await suggestResolution({ primaryServerFilePath: details.primaryPath, drServerFilePath: details.drPath, fileDifferenceDetails: details.diffSummary });
      setAiSuggestion(result);
      addLogEntry(`AI suggestion received for: ${selectedDifference.path}`, 'success');
      toast({ title: "AI Suggestion Ready", description: `Suggestion for ${selectedDifference.name} is available.` });
    } catch (error) {
      console.error("AI suggestion error:", error);
      addLogEntry(`Error getting AI suggestion for ${selectedDifference.path}: ${(error as Error).message}`, 'error');
      toast({ title: "AI Error", description: "Could not fetch AI suggestion.", variant: "destructive" });
    } finally { setIsAiLoading(false); }
  }, [selectedDifference, toast]);

  const performSyncOperations = async (opsToSync: FileDifference[]) => {
    if (!selectedApplicationForSync || opsToSync.length === 0) return false;
    addLogEntry(`Performing sync operations for ${opsToSync.length} items for app: ${selectedApplicationForSync.name}`, 'info');
    
    const operationsPayload = opsToSync.map(diff => ({
        path: diff.path,
        status: diff.status,
        type: diff.type || (diff.primaryFile?.type || diff.drFile?.type || 'file'),
    }));

    try {
      const response = await fetch('/api/sync-files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          primaryRoot: selectedApplicationForSync.primaryPath,
          drRoot: selectedApplicationForSync.drPath,
          operations: operationsPayload,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Sync API request failed');
      }
      
      const opResults = result.results as (SyncOperationError & {status: string, message: string, path: string})[]; 

      opResults.forEach(opResult => {
          if (opResult.status === 'success') { 
              addLogEntry(`Successfully synced ${opResult.path}: ${opResult.message}`, 'success');
          } else {
              addLogEntry(`Failed to sync ${opResult.path}: ${opResult.message}`, 'error');
          }
      });
      toast({ title: "Sync Attempt Complete", description: "Check logs for details. Reloading file lists." });
      return true;
    } catch (error) {
      console.error("Sync operation error:", error);
      addLogEntry(`Sync API Error: ${(error as Error).message}`, 'error');
      toast({ title: "Sync Error", description: (error as Error).message, variant: "destructive" });
      return false;
    }
  };
  
  const handleSyncFile = useCallback(async (fileDiff: FileDifference) => {
    if (!selectedApplicationForSync) return;
    setIsSyncingFile(true);
    const success = await performSyncOperations([fileDiff]);
    if (success) {
      await handleLoadFiles(); 
      
      const reloadedDifference = differences.find(d => d.path === fileDiff.path && d.status !== 'synced');
      if (reloadedDifference) {
          setSelectedDifference(reloadedDifference);
      } else {
          const syncedPFilePath = `${primaryPath}/${fileDiff.path}`.replace(/\/\//g, '/');
          const syncedDFilePath = `${drPath}/${fileDiff.path}`.replace(/\/\//g, '/');
          // Need to use the *newly fetched* primaryFiles and drFiles here
          // This requires handleLoadFiles to complete and update state *before* this logic runs.
          // A better way would be to use a .then() or useEffect based on some loading state after handleLoadFiles.
          // For now, we assume state is updated by the time this runs:
          const newPrimaryFiles = primaryFiles; // This is still the old state if handleLoadFiles is async and not awaited properly
          const newDrFiles = drFiles;     // Same as above
          const syncedPFile = findNodeByPathRecursive(newPrimaryFiles, syncedPFilePath);
          const syncedDFile = findNodeByPathRecursive(newDrFiles, syncedDFilePath);

          setSelectedDifference({
              path: fileDiff.path,
              name: fileDiff.name,
              type: fileDiff.type,
              status: 'synced',
              primaryFile: syncedPFile,
              drFile: syncedDFile,
              summary: "Successfully synced."
          });
      }
    }
    setIsSyncingFile(false);
  }, [selectedApplicationForSync, handleLoadFiles, primaryPath, drPath, primaryFiles, drFiles, differences]);


  const executeConfirmedSyncAll = useCallback(async () => {
    if (!selectedApplicationForSync) return;
    setIsSyncingAll(true);
    const diffsToProcess = differences.filter(d => d.status === 'different' || d.status === 'primary_only' || d.status === 'dr_only');
    const success = await performSyncOperations(diffsToProcess);
    if (success) {
      await handleLoadFiles(); 
      setSelectedDifference(null);
    }
    setIsSyncingAll(false);
    setIsSyncConfirmDialogOpen(false);
    setSyncConfirmationDetails(null);
  }, [differences, selectedApplicationForSync, handleLoadFiles]); 

  const handleSyncAllDifferent = useCallback(async () => {
    if (!selectedApplicationForSync || differences.length === 0) return;
    let toAdd = 0, toUpdate = 0, toRemove = 0;
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
  }, [differences, selectedApplicationForSync, toast]);
  
  const selectedFilePathForExplorer = useMemo(() => {
    if (!selectedDifference) return null;

    // Try to find the node in primary files first, then DR
    const findInPrimary = findNodeByPathRecursive(primaryFiles, `${primaryPath}/${selectedDifference.path}`.replace(/\/\//g, '/'));
    if (findInPrimary) return findInPrimary.path;

    const findInDr = findNodeByPathRecursive(drFiles, `${drPath}/${selectedDifference.path}`.replace(/\/\//g, '/'));
    if (findInDr) return findInDr.path;
    
    // Fallback using primaryFile or drFile paths if available and match
    if (selectedDifference.primaryFile?.path) return selectedDifference.primaryFile.path;
    if (selectedDifference.drFile?.path) return selectedDifference.drFile.path;

    return null; // Explicitly return null if not found
  }, [selectedDifference, primaryFiles, drFiles, primaryPath, drPath]);

  const renderBackButton = () => {
    if (currentStage !== ConfigStage.SERVER_INPUT) {
      return (<Button variant="outline" onClick={handleGoBack} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>);
    } return null;
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
                  {pathWarning && (
                    <div className="mt-2 p-3 bg-yellow-100 border border-yellow-300 text-yellow-700 rounded-md flex items-start">
                        <AlertTriangleIcon className="h-5 w-5 mr-2 shrink-0" />
                        <p className="text-sm">{pathWarning}</p>
                    </div>
                  )}
                   <Button onClick={handleLoadFiles} disabled={isGlobalLoading} variant="default" size="sm" className="mt-4">
                    {isGlobalLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {isGlobalLoading ? 'Loading Files...' : 'Reload File Structures'}
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
                    basePath={primaryPath}
                  />
                  <FileExplorer
                    title="DR Server (Target)"
                    nodes={drFiles}
                    onSelectFile={handleSelectFile}
                    onToggleDirectory={handleToggleDirectory}
                    selectedFilePath={selectedFilePathForExplorer}
                    isLoading={isGlobalLoading}
                    basePath={drPath}
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
               {(primaryFiles.length === 0 && drFiles.length === 0 && !isGlobalLoading) && (
                    <Card>
                        <CardHeader><CardTitle>No Files Found</CardTitle></CardHeader>
                        <CardContent>
                            <p>No files or directories were found at the specified Primary or DR paths, or the paths may be inaccessible.</p>
                            <p className="mt-2">Please ensure the paths are correct and the server has permissions to access them. Check server logs for PowerShell script errors if issues persist.</p>
                        </CardContent>
                    </Card>
                )}
            </>
          )}
        </main>
      </ScrollArea>
      <SyncLogDialog isOpen={isSyncLogOpen} onOpenChange={setIsSyncLogOpen} logs={syncLog} />
      {isSyncConfirmDialogOpen && syncConfirmationDetails && (
        <AlertDialog open={isSyncConfirmDialogOpen} onOpenChange={setIsSyncConfirmDialogOpen}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Confirm Synchronization to DR</AlertDialogTitle>
                    <AlertDialogDescription>
                        This will synchronize files from Primary to DR based on detected differences:
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>Items to Add/Copy to DR: <strong>{syncConfirmationDetails.toAdd}</strong></li>
                            <li>Items to Update/Overwrite on DR: <strong>{syncConfirmationDetails.toUpdate}</strong></li>
                            <li>Items to Remove from DR: <strong>{syncConfirmationDetails.toRemove}</strong></li>
                        </ul>
                        <strong className='mt-2 block'>Important: This will perform REAL file operations on the target paths. Ensure paths are correct and you understand the changes.</strong>
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
