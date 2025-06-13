
'use client';

import type * as React from 'react';
import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ListPlus, Upload, DatabaseZap, Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface ServerInputFormProps {
  onSubmit: (primaryNames: string[], drNames: string[]) => void;
  onFileUpload: (file: File) => void;
  availableServerConfigs: string[]; // filenames without .json
  onLoadConfigFromServer: (filename: string) => void;
  isServerConfigListLoading: boolean;
  isServerConfigLoading: boolean;
}

const ServerInputForm: React.FC<ServerInputFormProps> = ({
  onSubmit,
  onFileUpload,
  availableServerConfigs,
  onLoadConfigFromServer,
  isServerConfigListLoading,
  isServerConfigLoading,
}) => {
  const [primaryServerNames, setPrimaryServerNames] = useState<string>('');
  const [drServerNames, setDrServerNames] = useState<string>('');
  const [selectedServerConfig, setSelectedServerConfig] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primary = primaryServerNames.split(',').map(s => s.trim()).filter(s => s);
    const dr = drServerNames.split(',').map(s => s.trim()).filter(s => s);
    if (primary.length === 0 && dr.length === 0) {
        alert("Please enter at least one server name for Primary or DR, or load a configuration.");
        return;
    }
    onSubmit(primary, dr);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file); // This will now also save to server
    }
     // Reset file input to allow uploading the same file again if needed
    if (event.target) {
        event.target.value = '';
    }
  };

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  const handleLoadSelectedConfig = () => {
    if (selectedServerConfig) {
      onLoadConfigFromServer(selectedServerConfig);
    } else {
      alert("Please select a configuration to load.");
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
            <ListPlus className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl">Step 1: Define Servers or Load Configuration</CardTitle>
        </div>
        <CardDescription>
          Enter comma-separated server names, upload a local configuration file (which will be saved to the server), or load an existing configuration from the server.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Load from Server Section */}
        <div>
            <Label className="block text-lg font-medium text-foreground mb-2">Load Configuration from Server</Label>
            <div className="flex items-center gap-2">
                <Select value={selectedServerConfig} onValueChange={setSelectedServerConfig} disabled={isServerConfigListLoading || availableServerConfigs.length === 0}>
                    <SelectTrigger className="flex-grow">
                        <SelectValue placeholder={isServerConfigListLoading ? "Loading configs..." : "Select a saved configuration"} />
                    </SelectTrigger>
                    <SelectContent>
                        {availableServerConfigs.length === 0 && !isServerConfigListLoading && <SelectItem value="no-configs" disabled>No configurations found on server</SelectItem>}
                        {availableServerConfigs.map(configName => (
                            <SelectItem key={configName} value={configName}>{configName}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={handleLoadSelectedConfig} variant="outline" disabled={!selectedServerConfig || isServerConfigLoading || isServerConfigListLoading}>
                    {isServerConfigLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <DatabaseZap className="mr-2 h-4 w-4" />}
                    Load Selected
                </Button>
            </div>
            {isServerConfigListLoading && <p className="text-sm text-muted-foreground mt-1">Fetching list of saved configurations...</p>}
        </div>

        <div className="relative">
            <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or Manually Enter / Upload</span>
            </div>
        </div>

        {/* Manual Entry Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="primaryServerNames" className="block text-md font-medium text-foreground mb-2">
              Primary Server Names (Manual Entry)
            </Label>
            <Textarea
              id="primaryServerNames"
              value={primaryServerNames}
              onChange={(e) => setPrimaryServerNames(e.target.value)}
              placeholder="e.g., primary-web-01, primary-db-01, app-server-east"
              rows={3}
              className="font-code"
            />
            <p className="text-sm text-muted-foreground mt-1">Enter names separated by commas. This will start a new configuration.</p>
          </div>
          <div>
            <Label htmlFor="drServerNames" className="block text-md font-medium text-foreground mb-2">
              DR Server Names (Manual Entry)
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
          If you have a saved configuration JSON file, upload it here. It will be saved to the server and loaded.
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
    </Card>
  );
};

export default ServerInputForm;
