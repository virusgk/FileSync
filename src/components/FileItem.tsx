
import type * as React from 'react';
import { useState } from 'react';
import type { FileNode } from '@/types';
import { Folder, FileText, ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, HelpCircle, ArrowBigRightDash, ArrowBigLeftDash, MinusCircle, PlusCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileItemProps {
  node: FileNode;
  onSelectFile: (node: FileNode) => void;
  onToggleDirectory: (node: FileNode) => void;
  depth: number;
  selectedFilePath?: string | null; // Changed from isSelected to selectedFilePath
}

const FileItem: React.FC<FileItemProps> = ({ node, onSelectFile, onToggleDirectory, depth, selectedFilePath }) => {
  const Icon = node.type === 'directory' ? Folder : FileText;
  
  let StatusIcon;
  let statusColor = 'text-muted-foreground';

  switch (node.status) {
    case 'synced':
      StatusIcon = CheckCircle2;
      statusColor = 'text-green-500';
      break;
    case 'different':
      StatusIcon = AlertTriangle;
      statusColor = 'text-yellow-500';
      break;
    case 'primary_only':
      StatusIcon = PlusCircle; 
      statusColor = 'text-blue-500';
      break;
    case 'dr_only':
      StatusIcon = MinusCircle; 
      statusColor = 'text-purple-500';
      break;
    default:
      StatusIcon = HelpCircle;
      break;
  }

  const isCurrentlySelected = selectedFilePath === node.path;

  const handleItemClick = () => {
    if (node.type === 'file') {
      onSelectFile(node);
    } else { // directory
      onToggleDirectory(node);
    }
  };
  
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          "flex items-center p-1.5 pr-2 rounded-md hover:bg-accent/50 cursor-pointer group",
          isCurrentlySelected && "bg-accent text-accent-foreground shadow-sm"
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.375}rem` }} 
        onClick={handleItemClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleItemClick()}
      >
        {node.type === 'directory' ? (
          node.isOpen ? <ChevronDown className="h-4 w-4 mr-1 shrink-0" /> : <ChevronRight className="h-4 w-4 mr-1 shrink-0" />
        ) : (
          <span className="w-4 mr-1 shrink-0" /> 
        )}
        <Icon className={cn("h-4 w-4 mr-2 shrink-0", isCurrentlySelected ? "text-accent-foreground" : "text-primary")} />
        <span className={cn("truncate text-sm", isCurrentlySelected ? "text-accent-foreground" : "text-foreground")}>{node.name}</span>
        <div className="ml-auto flex items-center gap-2">
            {node.type === 'file' && <span className="text-xs text-muted-foreground font-code">{node.size}</span>}
            <StatusIcon className={cn("h-4 w-4 shrink-0", statusColor, isCurrentlySelected && node.status !== 'synced' ? "text-accent-foreground opacity-80" : "")} />
        </div>
      </div>
      {node.type === 'directory' && node.isOpen && node.children && Array.isArray(node.children) && (
        <div className="mt-0">
          {node.children.map((child) => (
            <FileItem
              key={child.id}
              node={child}
              onSelectFile={onSelectFile}
              onToggleDirectory={onToggleDirectory}
              depth={depth + 1}
              selectedFilePath={selectedFilePath} // Pass selectedFilePath down
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileItem;
