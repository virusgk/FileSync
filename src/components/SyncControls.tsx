import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { History, RefreshCw, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface SyncControlsProps {
  onSyncAllDifferent: () => void;
  onViewLogs: () => void;
  isSyncingAll: boolean;
  canSync: boolean;
}

const SyncControls: React.FC<SyncControlsProps> = ({ onSyncAllDifferent, onViewLogs, isSyncingAll, canSync }) => {
  return (
    <Card className="shadow-md">
        <CardContent className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
            <p className="text-sm text-muted-foreground flex-1">
                Synchronize differing files or view historical sync logs.
            </p>
            <div className="flex gap-2">
                <Button onClick={onSyncAllDifferent} disabled={isSyncingAll || !canSync} variant="default">
                {isSyncingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                {isSyncingAll ? 'Syncing All...' : 'Sync All Different'}
                </Button>
                <Button onClick={onViewLogs} variant="outline">
                <History className="mr-2 h-4 w-4" />
                View Logs
                </Button>
            </div>
      </CardContent>
    </Card>
  );
};

export default SyncControls;
