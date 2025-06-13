
'use client';

import type * as React from 'react';
import { useState, useEffect } from 'react';
import type { AssignedServer, Application } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppWindow, PlusCircle, PlayCircle, Settings2, Save, Edit3, Trash2, AlertTriangle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface ApplicationSetupProps {
  assignedPrimaryServers: AssignedServer[];
  assignedDrServers: AssignedServer[];
  applications: Application[];
  onUpdateApplications: (updatedApplications: Application[]) => void;
  onStartSync: (app: Application) => void;
  onSaveConfiguration: () => void;
  isSavingConfiguration: boolean;
}

const ApplicationSetup: React.FC<ApplicationSetupProps> = ({
  assignedPrimaryServers,
  assignedDrServers,
  applications,
  onUpdateApplications,
  onStartSync,
  onSaveConfiguration,
  isSavingConfiguration,
}) => {
  const [appName, setAppName] = useState<string>('');
  const [appPrimaryPath, setAppPrimaryPath] = useState<string>('/opt/app/data');
  const [appDrPath, setAppDrPath] = useState<string>('/srv/backup/data');
  const [selectedPrimaryIds, setSelectedPrimaryIds] = useState<string[]>([]);
  const [selectedDrIds, setSelectedDrIds] = useState<string[]>([]);
  const { toast } = useToast();

  const [editingApplicationId, setEditingApplicationId] = useState<string | null>(null);
  const [appToDelete, setAppToDelete] = useState<Application | null>(null);

  const clearForm = () => {
    setAppName('');
    setAppPrimaryPath('/opt/app/data');
    setAppDrPath('/srv/backup/data');
    setSelectedPrimaryIds([]);
    setSelectedDrIds([]);
    setEditingApplicationId(null);
  };

  const handleSaveApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || !appPrimaryPath.trim() || !appDrPath.trim() || selectedPrimaryIds.length === 0 || selectedDrIds.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill all application fields and select at least one primary and one DR server.",
        variant: "destructive",
      });
      return;
    }

    let updatedApplications;
    if (editingApplicationId) {
      // Update existing application
      updatedApplications = applications.map(app =>
        app.id === editingApplicationId
          ? {
              ...app,
              name: appName.trim(),
              primaryServerIds: selectedPrimaryIds,
              drServerIds: selectedDrIds,
              primaryPath: appPrimaryPath.trim(),
              drPath: appDrPath.trim(),
            }
          : app
      );
      toast({ title: "Application Updated", description: `${appName.trim()} has been updated.` });
    } else {
      // Add new application
      const newApp: Application = {
        id: `app_${Date.now()}_${appName.trim().replace(/\s+/g, '_')}`,
        name: appName.trim(),
        primaryServerIds: selectedPrimaryIds,
        drServerIds: selectedDrIds,
        primaryPath: appPrimaryPath.trim(),
        drPath: appDrPath.trim(),
      };
      updatedApplications = [...applications, newApp];
      toast({ title: "Application Added", description: `${newApp.name} has been configured.` });
    }
    onUpdateApplications(updatedApplications);
    clearForm();
  };
  
  const handleEditApp = (appToEdit: Application) => {
    setEditingApplicationId(appToEdit.id);
    setAppName(appToEdit.name);
    setAppPrimaryPath(appToEdit.primaryPath);
    setAppDrPath(appToEdit.drPath);
    setSelectedPrimaryIds(appToEdit.primaryServerIds);
    setSelectedDrIds(appToEdit.drServerIds);
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Scroll to top to see the form
  };

  const handleDeleteApp = (appId: string) => {
    const updatedApplications = applications.filter(app => app.id !== appId);
    onUpdateApplications(updatedApplications);
    toast({ title: "Application Deleted", description: `Application has been removed.` });
    setAppToDelete(null);
  };


  const toggleSelection = (id: string, type: 'primary' | 'dr') => {
    if (type === 'primary') {
      setSelectedPrimaryIds(prev =>
        prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
    } else {
      setSelectedDrIds(prev =>
        prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
      );
    }
  };

  const getReachableStatusText = (server: AssignedServer) => {
    if (server.isCheckingReachability) return "(checking...)";
    if (server.isReachable === true) return "(reachable)";
    if (server.isReachable === false) return "(unreachable)";
    return "(status unknown)";
  };

  const getReachabilityClass = (server: AssignedServer) => {
    if (server.isCheckingReachability) return "text-yellow-600";
    if (server.isReachable === true) return "text-green-600";
    if (server.isReachable === false) return "text-red-600";
    return "text-muted-foreground";
  };

  const getServerNameById = (id: string, type: 'primary' | 'dr'): string => {
    const serverList = type === 'primary' ? assignedPrimaryServers : assignedDrServers;
    return serverList.find(s => s.id === id)?.name || id;
  };


  return (
    <div className="space-y-8">
      <Card className="shadow-lg">
        <CardHeader>
            <div className="flex items-center gap-2">
                <Settings2 className="h-8 w-8 text-primary" />
                <CardTitle className="font-headline text-2xl">Step 3: Configure Applications</CardTitle>
            </div>
          <CardDescription>
            {editingApplicationId ? 'Update the application details below.' : 'Define new applications, assign servers, and specify paths.'} Reachability is shown for information. You can also save the current system configuration to the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveApp} className="space-y-6">
            <div>
              <Label htmlFor="appName" className="text-lg font-medium">Application Name</Label>
              <Input id="appName" value={appName} onChange={e => setAppName(e.target.value)} placeholder="e.g., My E-commerce Site" required />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                    <Label htmlFor="appPrimaryPath" className="font-medium">Primary Path for this App</Label>
                    <Input id="appPrimaryPath" value={appPrimaryPath} onChange={e => setAppPrimaryPath(e.target.value)} placeholder="/path/on/primary/servers" required className="font-code"/>
                </div>
                <div>
                    <Label htmlFor="appDrPath" className="font-medium">DR Path for this App</Label>
                    <Input id="appDrPath" value={appDrPath} onChange={e => setAppDrPath(e.target.value)} placeholder="/path/on/dr/servers" required className="font-code"/>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Assign Primary Servers</h4>
                <ScrollArea className="h-48 border rounded-md p-3 bg-muted/20">
                  {assignedPrimaryServers.length === 0 && <p className="text-sm text-muted-foreground">No primary servers assigned in Step 2.</p>}
                  {assignedPrimaryServers.map(server => (
                    <div key={server.id} className="flex items-center space-x-2 mb-2 p-2 rounded hover:bg-accent/10">
                      <Checkbox
                        id={`app-primary-${server.id}`}
                        checked={selectedPrimaryIds.includes(server.id)}
                        onCheckedChange={() => toggleSelection(server.id, 'primary')}
                        disabled={server.isCheckingReachability}
                      />
                      <Label htmlFor={`app-primary-${server.id}`} className={`flex-grow cursor-pointer ${server.isCheckingReachability ? 'text-muted-foreground' : ''}`}>
                        {server.name} <span className={`text-xs ${getReachabilityClass(server)}`}>{getReachableStatusText(server)}</span>
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Assign DR Servers</h4>
                 <ScrollArea className="h-48 border rounded-md p-3 bg-muted/20">
                  {assignedDrServers.length === 0 && <p className="text-sm text-muted-foreground">No DR servers assigned in Step 2.</p>}
                  {assignedDrServers.map(server => (
                    <div key={server.id} className="flex items-center space-x-2 mb-2 p-2 rounded hover:bg-accent/10">
                      <Checkbox
                        id={`app-dr-${server.id}`}
                        checked={selectedDrIds.includes(server.id)}
                        onCheckedChange={() => toggleSelection(server.id, 'dr')}
                        disabled={server.isCheckingReachability}
                      />
                      <Label htmlFor={`app-dr-${server.id}`} className={`flex-grow cursor-pointer ${server.isCheckingReachability ? 'text-muted-foreground' : ''}`}>
                        {server.name} <span className={`text-xs ${getReachabilityClass(server)}`}>{getReachableStatusText(server)}</span>
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="lg" className="w-full md:w-auto">
                {editingApplicationId ? <Edit3 className="mr-2 h-5 w-5" /> : <PlusCircle className="mr-2 h-5 w-5" />}
                {editingApplicationId ? 'Update Application' : 'Add Application'}
              </Button>
              {editingApplicationId && (
                <Button type="button" variant="outline" size="lg" onClick={clearForm}>
                  Cancel Edit
                </Button>
              )}
            </div>
          </form>
        </CardContent>
        <CardFooter className="border-t pt-4">
            <Button onClick={onSaveConfiguration} variant="outline" disabled={isSavingConfiguration}>
                <Save className="mr-2 h-4 w-4" /> {isSavingConfiguration ? 'Saving...' : 'Save System Configuration to Server'}
            </Button>
        </CardFooter>
      </Card>

      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex items-center gap-2">
              <AppWindow className="h-8 w-8 text-primary" />
              <CardTitle className="font-headline text-2xl">Configured Applications</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {applications.length > 0 ? (
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Primary Path</TableHead>
                    <TableHead>DR Path</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {applications.map(app => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">
                        {app.name}
                        <details className="text-xs mt-1 text-muted-foreground">
                          <summary className="cursor-pointer hover:text-foreground">Show Assigned Servers ({app.primaryServerIds.length}P, {app.drServerIds.length}DR)</summary>
                          <div className="pl-2 pt-1">
                              <p><strong>Primary:</strong> {app.primaryServerIds.map(id => getServerNameById(id, 'primary')).join(', ') || 'None'}</p>
                              <p><strong>DR:</strong> {app.drServerIds.map(id => getServerNameById(id, 'dr')).join(', ') || 'None'}</p>
                          </div>
                        </details>
                      </TableCell>
                      <TableCell><code className="font-code text-xs bg-muted p-1 rounded">{app.primaryPath}</code></TableCell>
                      <TableCell><code className="font-code text-xs bg-muted p-1 rounded">{app.drPath}</code></TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button onClick={() => onStartSync(app)} variant="ghost" size="sm" title="Start Sync">
                          <PlayCircle className="h-4 w-4" />
                        </Button>
                        <Button onClick={() => handleEditApp(app)} variant="ghost" size="sm" title="Edit Application">
                          <Edit3 className="h-4 w-4" />
                        </Button>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" title="Delete Application" onClick={() => setAppToDelete(app)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              No applications configured yet. Add an application using the form above.
            </p>
          )}
        </CardContent>
        {applications.length > 0 && (
          <CardFooter>
              <p className="text-sm text-muted-foreground">Select an application to start the file synchronization process, or manage existing applications.</p>
          </CardFooter>
        )}
      </Card>

      {appToDelete && (
        <AlertDialog open={!!appToDelete} onOpenChange={(open) => !open && setAppToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure you want to delete "{appToDelete.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the application configuration.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setAppToDelete(null)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeleteApp(appToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default ApplicationSetup;

    