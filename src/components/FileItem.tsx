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
  isSelected: boolean;
}

const FileItem: React.FC<FileItemProps> = ({ node, onSelectFile, onToggleDirectory, depth, isSelected }) => {
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
      StatusIcon = PlusCircle; // Or ArrowBigRightDash if you prefer side-specific
      statusColor = 'text-blue-500';
      break;
    case 'dr_only':
      StatusIcon = MinusCircle; // Or ArrowBigLeftDash
      statusColor = 'text-purple-500';
      break;
    default:
      StatusIcon = HelpCircle;
      break;
  }

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
          isSelected && "bg-accent text-accent-foreground shadow-sm"
        )}
        style={{ paddingLeft: `${depth * 1.25 + 0.375}rem` }} // 0.375rem is base padding (p-1.5)
        onClick={handleItemClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && handleItemClick()}
      >
        {node.type === 'directory' ? (
          node.isOpen ? <ChevronDown className="h-4 w-4 mr-1 shrink-0" /> : <ChevronRight className="h-4 w-4 mr-1 shrink-0" />
        ) : (
          <span className="w-4 mr-1 shrink-0" /> // Placeholder for alignment
        )}
        <Icon className={cn("h-4 w-4 mr-2 shrink-0", isSelected ? "text-accent-foreground" : "text-primary")} />
        <span className={cn("truncate text-sm", isSelected ? "text-accent-foreground" : "text-foreground")}>{node.name}</span>
        <div className="ml-auto flex items-center gap-2">
            {node.type === 'file' && <span className="text-xs text-muted-foreground font-code">{node.size}</span>}
            <StatusIcon className={cn("h-4 w-4 shrink-0", statusColor, isSelected && node.status !== 'synced' ? "text-accent-foreground opacity-80" : "")} />
        </div>
      </div>
      {node.type === 'directory' && node.isOpen && node.children && (
        <div className="mt-0">
          {node.children.map((child) => (
            <FileItem
              key={child.id}
              node={child}
              onSelectFile={onSelectFile}
              onToggleDirectory={onToggleDirectory}
              depth={depth + 1}
              isSelected={isSelected && child.path === node.path} // This is tricky for children, might need dedicated selectedNodePath
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default FileItem;
