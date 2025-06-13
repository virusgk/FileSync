import type * as React from 'react';
import type { FileNode } from '@/types';
import FileItem from './FileItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FileExplorerProps {
  title: string;
  nodes: FileNode[];
  onSelectFile: (node: FileNode) => void;
  onToggleDirectory: (node: FileNode) => void;
  selectedFilePath?: string | null; // Full path of the selected file
  isLoading: boolean;
}

const FileExplorer: React.FC<FileExplorerProps> = ({ title, nodes, onSelectFile, onToggleDirectory, selectedFilePath, isLoading }) => {
  if (isLoading) {
    return (
      <Card className="flex-1 shadow-md h-[600px]">
        <CardHeader>
          <CardTitle className="font-headline text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="animate-pulse">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-8 bg-muted rounded-md my-2" style={{width: `${Math.random()*30 + 60}%`}}></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!nodes || nodes.length === 0) {
     return (
      <Card className="flex-1 shadow-md h-[600px]">
        <CardHeader>
          <CardTitle className="font-headline text-xl">{title}</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-muted-foreground">No files loaded or directory is empty.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex-1 shadow-md h-[600px] flex flex-col">
      <CardHeader>
        <CardTitle className="font-headline text-xl">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 flex-grow overflow-hidden">
        <ScrollArea className="h-full pr-3">
          {nodes.map((node) => (
            <FileItem
              key={node.id}
              node={node}
              onSelectFile={onSelectFile}
              onToggleDirectory={onToggleDirectory}
              depth={0}
              isSelected={selectedFilePath === node.path}
            />
          ))}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default FileExplorer;
