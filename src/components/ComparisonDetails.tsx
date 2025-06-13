
import type * as React from 'react';
import type { FileNode, FileDifference } from '@/types';
import AiAssistant from './AiAssistant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, FileText, CheckCircle, Info, Loader2 } from 'lucide-react'; // Added Loader2
import { Button } from './ui/button';
import { RefreshCw } from 'lucide-react';
import type { SuggestResolutionOutput } from '@/ai/flows/suggest-resolution';

interface ComparisonDetailsProps {
  selectedDifference: FileDifference | null;
  onGetAiSuggestion: (details: {primaryPath: string, drPath: string, diffSummary: string}) => void;
  aiSuggestion: SuggestResolutionOutput | null;
  isAiLoading: boolean;
  onSyncFile: (fileDiff: FileDifference) => void;
  isSyncingFile: boolean;
}

const DetailItem: React.FC<{label: string, value?: string | null, isCode?: boolean}> = ({ label, value, isCode }) => {
  if (value === undefined || value === null) return null;
  return (
    <div>
      <span className="font-semibold text-sm">{label}: </span>
      {isCode ? <code className="font-code text-xs bg-muted p-0.5 rounded">{value}</code> : <span className="text-sm">{value}</span>}
    </div>
  );
};

const formatSize = (sizeString?: string): string => {
    if (!sizeString) return 'N/A';
    const sizeBytes = parseInt(sizeString);
    if (isNaN(sizeBytes)) return sizeString; // Return original if not just bytes (e.g. "4KB")

    if (sizeBytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(sizeBytes) / Math.log(k));
    return parseFloat((sizeBytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

const FileInfoCard: React.FC<{title: string, file?: FileNode | null}> = ({ title, file }) => {
  if (!file) return (
    <Card className="flex-1 bg-muted/30">
      <CardHeader>
        <CardTitle className="text-base font-headline">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">Not present</p>
      </CardContent>
    </Card>
  );
  
  return (
    <Card className="flex-1 bg-muted/30">
      <CardHeader>
        <CardTitle className="text-base font-headline">{title}</CardTitle>
        <CardDescription className="font-code text-xs truncate" title={file.path}>{file.path}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <DetailItem label="Last Modified" value={new Date(file.lastModified).toLocaleString()} />
        <DetailItem label="Size" value={formatSize(file.size)} />
        {/* Content snippet is removed as content is not fetched from PS by default */}
      </CardContent>
    </Card>
  );
}


const ComparisonDetails: React.FC<ComparisonDetailsProps> = ({
  selectedDifference,
  onGetAiSuggestion,
  aiSuggestion,
  isAiLoading,
  onSyncFile,
  isSyncingFile,
}) => {
  if (!selectedDifference) {
    return (
      <Card className="shadow-md h-full">
        <CardHeader>
          <CardTitle className="font-headline text-xl">File Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground py-10">
            <Info className="h-12 w-12 mb-4" />
            <p>Select a file from the explorers to see details and AI suggestions.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { primaryFile, drFile, status, path, name, summary } = selectedDifference;

  const handleAiSuggestion = () => {
    // Construct AI suggestion details even if one file is missing
    const pPath = primaryFile?.path || `[Primary path for ${name}] (missing)`;
    const dPath = drFile?.path || `[DR path for ${name}] (missing)`;
    const diffSummary = summary || `Status: ${status}. Primary: ${primaryFile ? 'exists' : 'missing'}, DR: ${drFile ? 'exists' : 'missing'}.`;

    onGetAiSuggestion({
      primaryPath: pPath,
      drPath: dPath,
      diffSummary: diffSummary,
    });
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'different': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'primary_only': return <FileText className="h-5 w-5 text-blue-500" />;
      case 'dr_only': return <FileText className="h-5 w-5 text-purple-500" />;
      case 'synced': return <CheckCircle className="h-5 w-5 text-green-500" />;
      default: return <Info className="h-5 w-5 text-gray-500" />; // For 'unknown' or other
    }
  };

  return (
    <Card className="shadow-md h-full flex flex-col">
      <CardHeader>
        <div className="flex items-center gap-2 mb-1">
          {getStatusIcon()}
          <CardTitle className="font-headline text-xl truncate" title={name}>{name}</CardTitle>
        </div>
        <CardDescription className="font-code text-sm" title={path}>{path}</CardDescription>
        {summary && <p className="text-sm text-muted-foreground italic mt-1">{summary}</p>}
      </CardHeader>
      <CardContent className="space-y-4 flex-grow overflow-auto">
        <div className="flex flex-col md:flex-row gap-4">
          <FileInfoCard title="Primary Server" file={primaryFile} />
          <FileInfoCard title="DR Server" file={drFile} />
        </div>
        
        <AiAssistant
          onGetSuggestion={handleAiSuggestion}
          suggestion={aiSuggestion}
          isLoading={isAiLoading}
          selectedFileRelativePath={path}
        />
        
        {status !== 'synced' && status !== 'unknown' && ( // Allow sync unless synced or unknown
          <Button 
            onClick={() => onSyncFile(selectedDifference)} 
            disabled={isSyncingFile || !selectedDifference}
            className="w-full mt-4"
          >
            {isSyncingFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isSyncingFile ? 'Syncing...' : `Sync ${name} (Primary to DR)`}
          </Button>
        )}

      </CardContent>
    </Card>
  );
};

export default ComparisonDetails;
