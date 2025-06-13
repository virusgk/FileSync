import type * as React from 'react';
import type { FileNode, FileDifference } from '@/types';
import AiAssistant from './AiAssistant';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, FileText, CheckCircle, Info } from 'lucide-react';
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
        <CardDescription className="font-code text-xs">{file.path}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <DetailItem label="Last Modified" value={new Date(file.lastModified).toLocaleString()} />
        <DetailItem label="Size" value={file.size} />
        {file.content && <DetailItem label="Content Snippet" value={`"${file.content.substring(0, 50)}${file.content.length > 50 ? '...' : ''}"`} isCode />}
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
    if (primaryFile && drFile) {
       onGetAiSuggestion({
        primaryPath: primaryFile.path,
        drPath: drFile.path,
        diffSummary: summary || `File '${name}' content or metadata differs. Primary: ${primaryFile.lastModified}, DR: ${drFile.lastModified}.`
      });
    } else if (primaryFile) {
       onGetAiSuggestion({
        primaryPath: primaryFile.path,
        drPath: `[DR path for ${name}] (file missing on DR)`, // Placeholder
        diffSummary: summary || `File '${name}' exists only on primary server.`
      });
    } else if (drFile) {
       onGetAiSuggestion({
        primaryPath: `[Primary path for ${name}] (file missing on Primary)`, // Placeholder
        drPath: drFile.path,
        diffSummary: summary || `File '${name}' exists only on DR server.`
      });
    }
  };
  
  const getStatusIcon = () => {
    switch (status) {
      case 'different': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'primary_only': return <FileText className="h-5 w-5 text-blue-500" />; // Or a plus icon
      case 'dr_only': return <FileText className="h-5 w-5 text-purple-500" />; // Or a minus icon
      default: return <CheckCircle className="h-5 w-5 text-green-500" />;
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
        
        {status !== 'synced' && (
          <Button 
            onClick={() => onSyncFile(selectedDifference)} 
            disabled={isSyncingFile}
            className="w-full mt-4"
          >
            {isSyncingFile ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            {isSyncingFile ? 'Syncing...' : `Sync ${name}`}
          </Button>
        )}

      </CardContent>
    </Card>
  );
};

export default ComparisonDetails;
