
'use client';

import type * as React from 'react';
import { useState } from 'react';
import type { AssignedServer, Application } from '@/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AppWindow, PlusCircle, PlayCircle, Settings2, Save } from 'lucide-react'; // Changed Download to Save

interface ApplicationSetupProps {
  assignedPrimaryServers: AssignedServer[];
  assignedDrServers: AssignedServer[];
  existingApplications: Application[];
  onAddApplication: (app: Application) => void;
  onStartSync: (app: Application) => void;
  onSaveConfiguration: () => void; // Changed from onDownloadConfiguration
  isSavingConfiguration: boolean;
}

const ApplicationSetup: React.FC<ApplicationSetupProps> = ({
  assignedPrimaryServers,
  assignedDrServers,
  existingApplications,
  onAddApplication,
  onStartSync,
  onSaveConfiguration,
  isSavingConfiguration,
}) => {
  const [appName, setAppName] = useState<string>('');
  const [appPrimaryPath, setAppPrimaryPath] = useState<string>('/opt/app/data');
  const [appDrPath, setAppDrPath] = useState<string>('/srv/backup/data');
  const [selectedPrimaryIds, setSelectedPrimaryIds] = useState<string[]>([]);
  const [selectedDrIds, setSelectedDrIds] = useState<string[]>([]);

  const handleAddApp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || !appPrimaryPath.trim() || !appDrPath.trim() || selectedPrimaryIds.length === 0 || selectedDrIds.length === 0) {
      alert('Please fill all fields and select at least one primary and one DR server that is reachable.');
      return;
    }
    // Filter out any selected servers that are not reachable
    const reachableSelectedPrimaryIds = selectedPrimaryIds.filter(id => {
        const server = assignedPrimaryServers.find(s => s.id === id);
        return server && server.isReachable;
    });
    const reachableSelectedDrIds = selectedDrIds.filter(id => {
        const server = assignedDrServers.find(s => s.id === id);
        return server && server.isReachable;
    });

    if (reachableSelectedPrimaryIds.length === 0 || reachableSelectedDrIds.length === 0) {
        alert('Selected servers must be reachable to be assigned to an application.');
        return;
    }

    const newApp: Application = {
      id: `app_${Date.now()}_${appName.trim().replace(/\s+/g, '_')}`,
      name: appName.trim(),
      primaryServerIds: reachableSelectedPrimaryIds,
      drServerIds: reachableSelectedDrIds,
      primaryPath: appPrimaryPath.trim(),
      drPath: appDrPath.trim(),
    };
    onAddApplication(newApp);
    setAppName('');
    setSelectedPrimaryIds([]);
    setSelectedDrIds([]);
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

  const getReachableStatus = (server: AssignedServer) => {
    if (server.isCheckingReachability) return "(checking...)";
    if (server.isReachable === true) return "(reachable)";
    if (server.isReachable === false) return "(unreachable)";
    return "(status unknown)";
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
            Define your applications, assign servers, and specify paths. You can also save the current system configuration to the server.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddApp} className="space-y-6">
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
                <h4 className="font-semibold mb-2 text-foreground">Assign Primary Servers (Reachable Only)</h4>
                <ScrollArea className="h-48 border rounded-md p-3 bg-muted/20">
                  {assignedPrimaryServers.filter(s => s.isReachable).length === 0 && <p className="text-sm text-muted-foreground">No reachable primary servers available.</p>}
                  {assignedPrimaryServers.map(server => (
                    <div key={server.id} className="flex items-center space-x-2 mb-2 p-2 rounded hover:bg-accent/10">
                      <Checkbox
                        id={`app-primary-${server.id}`}
                        checked={selectedPrimaryIds.includes(server.id)}
                        onCheckedChange={() => toggleSelection(server.id, 'primary')}
                        disabled={!server.isReachable || server.isCheckingReachability}
                      />
                      <Label htmlFor={`app-primary-${server.id}`} className={`flex-grow cursor-pointer ${!server.isReachable || server.isCheckingReachability ? 'text-muted-foreground line-through' : ''}`}>
                        {server.name} <span className="text-xs">{getReachableStatus(server)}</span>
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
              <div>
                <h4 className="font-semibold mb-2 text-foreground">Assign DR Servers (Reachable Only)</h4>
                 <ScrollArea className="h-48 border rounded-md p-3 bg-muted/20">
                  {assignedDrServers.filter(s => s.isReachable).length === 0 && <p className="text-sm text-muted-foreground">No reachable DR servers available.</p>}
                  {assignedDrServers.map(server => (
                    <div key={server.id} className="flex items-center space-x-2 mb-2 p-2 rounded hover:bg-accent/10">
                      <Checkbox
                        id={`app-dr-${server.id}`}
                        checked={selectedDrIds.includes(server.id)}
                        onCheckedChange={() => toggleSelection(server.id, 'dr')}
                        disabled={!server.isReachable || server.isCheckingReachability}
                      />
                      <Label htmlFor={`app-dr-${server.id}`} className={`flex-grow cursor-pointer ${!server.isReachable || server.isCheckingReachability ? 'text-muted-foreground line-through' : ''}`}>
                        {server.name} <span className="text-xs">{getReachableStatus(server)}</span>
                      </Label>
                    </div>
                  ))}
                </ScrollArea>
              </div>
            </div>
            <Button type="submit" size="lg" className="w-full md:w-auto">
              <PlusCircle className="mr-2 h-5 w-5" /> Add Application
            </Button>
          </form>
        </CardContent>
        <CardFooter className="border-t pt-4">
            <Button onClick={onSaveConfiguration} variant="outline" disabled={isSavingConfiguration}>
                <Save className="mr-2 h-4 w-4" /> {isSavingConfiguration ? 'Saving...' : 'Save Configuration to Server'}
            </Button>
        </CardFooter>
      </Card>

      {existingApplications.length > 0 && (
        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center gap-2">
                <AppWindow className="h-8 w-8 text-primary" />
                <CardTitle className="font-headline text-2xl">Configured Applications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-64">
              <ul className="space-y-3">
                {existingApplications.map(app => (
                  <li key={app.id} className="p-4 border rounded-md bg-card shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                    <div>
                      <h5 className="font-semibold text-lg text-primary">{app.name}</h5>
                      <p className="text-xs text-muted-foreground">Primary Path: <code className="font-code">{app.primaryPath}</code></p>
                      <p className="text-xs text-muted-foreground">DR Path: <code className="font-code">{app.drPath}</code></p>
                      <details className="text-xs mt-1">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Show Assigned Servers ({app.primaryServerIds.length} Primary, {app.drServerIds.length} DR)</summary>
                        <div className="pl-4 pt-1">
                            <p><strong>Primary:</strong> {app.primaryServerIds.map(id => {
                                const server = assignedPrimaryServers.find(s=>s.id===id) || assignedDrServers.find(s=>s.id===id); // Check both lists just in case
                                return `${server?.name || 'Unknown'} ${server ? getReachableStatus(server) : ''}`;
                            }).join(', ')}</p>
                            <p><strong>DR:</strong> {app.drServerIds.map(id => {
                                const server = assignedDrServers.find(s=>s.id===id) || assignedPrimaryServers.find(s=>s.id===id);
                                return `${server?.name || 'Unknown'} ${server ? getReachableStatus(server) : ''}`;
                            }).join(', ')}</p>
                        </div>
                      </details>
                    </div>
                    <Button onClick={() => onStartSync(app)} variant="default" size="sm" className="mt-2 md:mt-0 self-start md:self-center whitespace-nowrap">
                      <PlayCircle className="mr-2 h-4 w-4" /> Sync This App
                    </Button>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          </CardContent>
           {existingApplications.length > 0 && (
                <CardFooter>
                    <p className="text-sm text-muted-foreground">Select an application to start the file synchronization process for it.</p>
                </CardFooter>
            )}
        </Card>
      )}
    </div>
  );
};

export default ApplicationSetup;
