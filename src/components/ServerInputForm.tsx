
'use client';

import type * as React from 'react';
import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ListPlus, Upload } from 'lucide-react';

interface ServerInputFormProps {
  onSubmit: (primaryNames: string[], drNames: string[]) => void;
  onFileUpload: (file: File) => void;
}

const ServerInputForm: React.FC<ServerInputFormProps> = ({ onSubmit, onFileUpload }) => {
  const [primaryServerNames, setPrimaryServerNames] = useState<string>('');
  const [drServerNames, setDrServerNames] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primary = primaryServerNames.split(',').map(s => s.trim()).filter(s => s);
    const dr = drServerNames.split(',').map(s => s.trim()).filter(s => s);
    if (primary.length === 0 && dr.length === 0) {
        alert("Please enter at least one server name for Primary or DR, or upload a configuration.");
        return;
    }
    onSubmit(primary, dr);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onFileUpload(file);
    }
  };

  const triggerFileDialog = () => {
    fileInputRef.current?.click();
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
            <ListPlus className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl">Step 1: Enter Server Names or Load Configuration</CardTitle>
        </div>
        <CardDescription>
          Provide comma-separated lists of your primary and DR server names, or upload an existing configuration file.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <Label htmlFor="primaryServerNames" className="block text-lg font-medium text-foreground mb-2">
              Primary Server Names
            </Label>
            <Textarea
              id="primaryServerNames"
              value={primaryServerNames}
              onChange={(e) => setPrimaryServerNames(e.target.value)}
              placeholder="e.g., primary-web-01, primary-db-01, app-server-east"
              rows={3}
              className="font-code"
            />
            <p className="text-sm text-muted-foreground mt-1">Enter names separated by commas.</p>
          </div>
          <div>
            <Label htmlFor="drServerNames" className="block text-lg font-medium text-foreground mb-2">
              DR Server Names
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
            Next: Assign Servers
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex-col items-start space-y-2 pt-4 border-t">
        <Label className="text-md font-medium">Load Configuration</Label>
        <p className="text-sm text-muted-foreground">
          If you have a saved configuration JSON file, you can upload it here.
        </p>
        <Input 
            type="file" 
            accept=".json" 
            onChange={handleFileChange} 
            className="hidden" 
            ref={fileInputRef} 
        />
        <Button onClick={triggerFileDialog} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Upload Configuration File
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ServerInputForm;
