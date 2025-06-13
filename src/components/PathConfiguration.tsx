
import type * as React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronsRightLeft } from 'lucide-react';

interface PathConfigurationProps {
  primaryPath: string;
  onPrimaryPathChange: (value: string) => void; // Kept for compatibility, but might be read-only now
  drPath: string;
  onDrPathChange: (value: string) => void; // Kept for compatibility
  onLoadFiles: () => void;
  isLoading: boolean;
  appName?: string; // Optional application name to display
  isReadOnly?: boolean; // To make inputs read-only if paths are from app config
}

const PathConfiguration: React.FC<PathConfigurationProps> = ({
  primaryPath,
  onPrimaryPathChange,
  drPath,
  onDrPathChange,
  onLoadFiles,
  isLoading,
  appName,
  isReadOnly = false,
}) => {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">
            {appName ? `Paths for: ${appName}` : "Path Configuration"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <Label htmlFor="primaryPath" className="block text-sm font-medium text-foreground mb-1">
              Primary Server Path
            </Label>
            <Input
              id="primaryPath"
              type="text"
              value={primaryPath}
              onChange={(e) => !isReadOnly && onPrimaryPathChange(e.target.value)}
              placeholder="/path/to/primary/files"
              className="font-code"
              disabled={isLoading || isReadOnly}
              readOnly={isReadOnly}
            />
          </div>
          <div>
            <Label htmlFor="drPath" className="block text-sm font-medium text-foreground mb-1">
              DR Server Path
            </Label>
            <Input
              id="drPath"
              type="text"
              value={drPath}
              onChange={(e) => !isReadOnly && onDrPathChange(e.target.value)}
              placeholder="/path/to/dr/files"
              className="font-code"
              disabled={isLoading || isReadOnly}
              readOnly={isReadOnly}
            />
          </div>
        </div>
        <Button onClick={onLoadFiles} disabled={isLoading || !primaryPath || !drPath} variant="default" size="lg">
          <ChevronsRightLeft className="mr-2 h-5 w-5" />
          {isLoading ? 'Loading Files...' : (appName ? `Load Files for ${appName}` : 'Load & Compare Files')}
        </Button>
      </CardContent>
    </Card>
  );
};

export default PathConfiguration;
