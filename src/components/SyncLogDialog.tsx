import type * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { SyncLogEntry } from '@/types';
import { CheckCircle, XCircle, Info } from 'lucide-react';

interface SyncLogDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  logs: SyncLogEntry[];
}

const LogStatusIcon: React.FC<{status: SyncLogEntry['status']}> = ({ status }) => {
  switch(status) {
    case 'success': return <CheckCircle className="h-4 w-4 text-green-500 mr-2 shrink-0" />;
    case 'error': return <XCircle className="h-4 w-4 text-red-500 mr-2 shrink-0" />;
    case 'info':
    default: return <Info className="h-4 w-4 text-blue-500 mr-2 shrink-0" />;
  }
}

const SyncLogDialog: React.FC<SyncLogDialogProps> = ({ isOpen, onOpenChange, logs }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-headline text-2xl">Synchronization Logs</DialogTitle>
          <DialogDescription>
            Review the history of synchronization operations.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[400px] w-full rounded-md border p-4 my-4">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">No logs available yet.</p>
          ) : (
            <ul className="space-y-3">
              {logs.slice().reverse().map((log) => ( // Display newest first
                <li key={log.id} className="p-3 bg-muted/50 rounded-md text-sm">
                  <div className="flex items-start">
                    <LogStatusIcon status={log.status} />
                    <div className="flex-grow">
                      <p className="font-semibold text-foreground">{log.message}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)} variant="outline">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SyncLogDialog;
