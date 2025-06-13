
'use client';

import type * as React from 'react';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ListPlus } from 'lucide-react';

interface ServerInputFormProps {
  onSubmit: (primaryNames: string[], drNames: string[]) => void;
}

const ServerInputForm: React.FC<ServerInputFormProps> = ({ onSubmit }) => {
  const [primaryServerNames, setPrimaryServerNames] = useState<string>('');
  const [drServerNames, setDrServerNames] = useState<string>('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const primary = primaryServerNames.split(',').map(s => s.trim()).filter(s => s);
    const dr = drServerNames.split(',').map(s => s.trim()).filter(s => s);
    onSubmit(primary, dr);
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
            <ListPlus className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl">Step 1: Enter Server Names</CardTitle>
        </div>
        <CardDescription>
          Provide comma-separated lists of your primary and DR server names. These names will be used in the next step for assignment.
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
    </Card>
  );
};

export default ServerInputForm;
