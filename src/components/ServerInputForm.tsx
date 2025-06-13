
'use client';

import type * as React from 'react';
import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ListPlus, Upload, DatabaseZap, Loader2, Trash2, Download, Pencil } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { useToast } from "@/hooks/use-toast";

interface ServerInputFormProps {
  onSubmit: (primaryNames: string[], drNames: string[]) => void;
  onFileUpload: (file: File) => void;
  availableServerConfigs: string[]; // filenames without .json
  onLoadConfigFromServer: (filename: string) => void;
  onDeleteConfigFromServer: (filename: string) => Promise<void>;
  onRenameConfigFromServer: (oldFilename: string, newFilename: string) => Promise<void>;
  isServerConfigListLoading: boolean;
  isServerConfigLoading: boolean;
  isDeletingConfig: boolean;
  isRenamingConfig: boolean;
}

const ServerInputForm: React.FC<ServerInputFormProps> = ({
  onSubmit,
  onFileUpload,
  availableServerConfigs,
  onLoadConfigFromServer,
  onDeleteConfigFromServer,
  onRenameConfigFromServer,
  isServerConfigListLoading,
  isServerConfigLoading,
  isDeletingConfig,
  isRenamingConfig,
}) => {
  const [primaryServerNames, setPrimaryServerNames] = useState<string>('');
  const [drServerNames, setDrServerNames] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [configToDelete, setConfigToDelete] = useState<string | null>(null);
  const [configToRename, setConfigToRename] = useState<{ oldName: string; newName: string } | null>(null);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primary = primaryServerNames.split(',').map(s => s.trim()).filter(s => s);
    const dr = drServerNames.split(',').map(s => s.trim()).filter(s => s);
    if (primary.length === 0 && dr.length === 0) {
        toast({
            title: "Manual Entry Incomplete",
            description: "Please enter server names for manual setup or load an existing configuration.",
            variant: "destructive",
        });
        return;
    }
    onSubmit(primary, dr);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
    if (event.target) {
        event.target.value = '';
    }
  };

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteRequest = (filename: string) => {
    setConfigToDelete(filename);
  };

  const confirmDelete = async () => {
    if (configToDelete) {
      await onDeleteConfigFromServer(configToDelete);
      setConfigToDelete(null);
    }
  };

  const handleRenameRequest = (filename: string) => {
    setConfigToRename({ oldName: filename, newName: filename });
  };

  const confirmRename = async () => {
    if (configToRename && configToRename.newName.trim()) {
      // Basic validation for new name (e.g., no slashes, dots, etc.)
      if (/[^a-zA-Z0-9_.-]/.test(configToRename.newName.trim()) || configToRename.newName.includes('..')) {
        toast({
          title: "Invalid Name",
          description: "New configuration name can only contain alphanumeric characters, underscores, hyphens, or periods and cannot contain '..'.",
          variant: "destructive",
        });
        return;
      }
      await onRenameConfigFromServer(configToRename.oldName, configToRename.newName.trim());
      setConfigToRename(null);
    } else {
      toast({
        title: "Invalid Name",
        description: "New configuration name cannot be empty.",
        variant: "destructive",
      });
    }
  };


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
            <DatabaseZap className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl">Step 1: System Configuration</CardTitle>
        </div>
        <CardDescription>
          Manage saved system configurations, upload a local file, or manually enter server names to start a new setup.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        <div>
            <Label className="block text-lg font-medium text-foreground mb-2">Saved Configurations</Label>
            {isServerConfigListLoading ? (
                <div className="flex items-center space-x-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Loading configurations...</span>
                </div>
            ) : availableServerConfigs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No configurations found on server.</p>
            ) : (
                <Card>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Configuration Name</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {availableServerConfigs.map(configName => (
                            <TableRow key={configName}>
                            <TableCell className="font-medium">{configName}</TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button
                                    onClick={() => onLoadConfigFromServer(configName)}
                                    variant="outline"
                                    size="sm"
                                    disabled={isServerConfigLoading || isDeletingConfig || isRenamingConfig}
                                    title="Load Configuration"
                                >
                                {isServerConfigLoading && configName === (configToRename?.oldName || configToDelete) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                                <span className="ml-2 hidden sm:inline">Load</span>
                                </Button>
                                <Button
                                    onClick={() => handleRenameRequest(configName)}
                                    variant="outline"
                                    size="sm"
                                    disabled={isServerConfigLoading || isDeletingConfig || isRenamingConfig}
                                    title="Rename Configuration"
                                >
                                  <Pencil className="h-4 w-4" />
                                  <span className="ml-2 hidden sm:inline">Rename</span>
                                </Button>
                                <Button
                                    onClick={() => handleDeleteRequest(configName)}
                                    variant="destructive"
                                    size="sm"
                                    disabled={isServerConfigLoading || isDeletingConfig || isRenamingConfig}
                                    title="Delete Configuration"
                                >
                                {(isDeletingConfig && configToDelete === configName) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                <span className="ml-2 hidden sm:inline">Delete</span>
                                </Button>
                            </TableCell>
                            </TableRow>
                        ))}
                        </TableBody>
                    </Table>
                </Card>
            )}
        </div>

        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or Start New / Upload</span>
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="primaryServerNames" className="block text-md font-medium text-foreground mb-2">
              Primary Server Names (Manual Entry for New Config)
            </Label>
            <Textarea
              id="primaryServerNames"
              value={primaryServerNames}
              onChange={(e) => setPrimaryServerNames(e.target.value)}
              placeholder="e.g., primary-web-01, primary-db-01, app-server-east"
              rows={3}
              className="font-code"
            />
            <p className="text-sm text-muted-foreground mt-1">Enter names separated by commas. This will start a new configuration process.</p>
          </div>
          <div>
            <Label htmlFor="drServerNames" className="block text-md font-medium text-foreground mb-2">
              DR Server Names (Manual Entry for New Config)
            </Label>
            <Textarea
              id="drServerNames"
              value={drServerNames}
              onChange={(e) => setDrServerNames(e.target.value)}
              placeholder="e.g., dr-web-01, dr-db-01, app-server-west-dr"
              rows={3}
              className="font-code"
            />
             <p className="text-sm text-muted-foreground mt-1">Enter names separated by commas.</p>
          </div>
          <Button type="submit" size="lg" className="w-full md:w-auto">
            Next: Assign Manually Entered Servers
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col items-start space-y-2 pt-4 border-t">
        <Label className="text-md font-medium">Upload Local Configuration File</Label>
        <p className="text-sm text-muted-foreground">
          Upload a saved JSON configuration file. It will be saved to the server and then loaded into the application.
        </p>
        <Input
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            ref={fileInputRef}
        />
        <Button onClick={triggerFileDialog} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Upload & Save Configuration File
        </Button>
      </CardFooter>

      {configToDelete && (
        <AlertDialog open={!!configToDelete} onOpenChange={(open) => !open && setConfigToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Are you sure you want to delete configuration "{configToDelete}"?</AlertDialogTitle>
                <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the configuration file from the server.
                </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfigToDelete(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={confirmDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeletingConfig}
                >
                    {isDeletingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Delete
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}

      {configToRename && (
        <AlertDialog open={!!configToRename} onOpenChange={(open) => !open && setConfigToRename(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                <AlertDialogTitle>Rename Configuration</AlertDialogTitle>
                <AlertDialogDescription>
                    Current name: <span className="font-semibold">{configToRename.oldName}</span>.
                    Enter the new name for the configuration file (without .json extension).
                </AlertDialogDescription>
                </AlertDialogHeader>
                <Input
                    value={configToRename.newName}
                    onChange={(e) => setConfigToRename({ ...configToRename, newName: e.target.value })}
                    placeholder="New configuration name"
                    className="my-2"
                />
                <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setConfigToRename(null)}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                    onClick={confirmRename}
                    disabled={isRenamingConfig || !configToRename.newName.trim()}
                >
                    {isRenamingConfig ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    Rename
                </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
      )}
    </Card>
  );
};

export default ServerInputForm;
    