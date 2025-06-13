import type * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BrainCircuit, Loader2 } from 'lucide-react';
import type { SuggestResolutionOutput } from '@/ai/flows/suggest-resolution';

interface AiAssistantProps {
  onGetSuggestion: () => void;
  suggestion: SuggestResolutionOutput | null;
  isLoading: boolean;
  selectedFileRelativePath?: string | null;
}

const AiAssistant: React.FC<AiAssistantProps> = ({ onGetSuggestion, suggestion, isLoading, selectedFileRelativePath }) => {
  return (
    <Card className="shadow-sm">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BrainCircuit className="h-6 w-6 text-primary" />
          <CardTitle className="font-headline text-lg">AI Conflict Resolution</CardTitle>
        </div>
        <CardDescription>
          {selectedFileRelativePath 
            ? `Get suggestions for resolving differences in: ${selectedFileRelativePath}`
            : "Select a file with differences to get AI suggestions."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button onClick={onGetSuggestion} disabled={isLoading || !selectedFileRelativePath} className="w-full mb-4" variant="outline">
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <BrainCircuit className="mr-2 h-4 w-4" />
          )}
          {isLoading ? 'Analyzing...' : 'Suggest Resolution'}
        </Button>
        {suggestion && !isLoading && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-md border">
            <div>
              <h4 className="font-semibold text-sm">Suggestion:</h4>
              <p className="text-sm whitespace-pre-wrap">{suggestion.resolutionSuggestion}</p>
            </div>
            <div>
              <h4 className="font-semibold text-sm">Confidence:</h4>
              <p className="text-sm">{suggestion.confidenceLevel}</p>
            </div>
          </div>
        )}
        {isLoading && (
            <div className="space-y-2 p-3 bg-muted/50 rounded-md border animate-pulse">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-8 bg-muted rounded w-full"></div>
                <div className="h-4 bg-muted rounded w-1/3 mt-2"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
            </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AiAssistant;
