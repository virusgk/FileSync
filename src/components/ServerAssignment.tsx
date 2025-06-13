
'use client';

import type * as React from 'react';
import { useState, useEffect } from 'react';
import type { RawServer, AssignedServer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Server, Shuffle } from 'lucide-react';

interface DraggableItemProps {
  server: RawServer | AssignedServer;
  isOverlay?: boolean;
}

const DraggableServerItem: React.FC<DraggableItemProps & ReturnType<typeof useSortable> & {isAssigned?: boolean}> = ({
  server,
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isOverlay,
  isAssigned,
}) => {
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isOverlay ? 0.8 : 1,
    cursor: isOverlay ? 'grabbing' : 'grab',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-3 mb-2 rounded-md shadow-sm flex items-center justify-between transition-shadow
                  ${isOverlay ? 'bg-primary text-primary-foreground z-50 ring-2 ring-primary' : 'bg-card border'}
                  ${isAssigned && (server as AssignedServer).originalRawServerId.includes('_primary_') ? 'border-blue-500' : ''}
                  ${isAssigned && (server as AssignedServer).originalRawServerId.includes('_dr_') ? 'border-purple-500' : ''}
                `}
    >
      <span className="font-medium">{server.name}</span>
      <button {...listeners} className="p-1 text-muted-foreground hover:text-foreground">
        <GripVertical className="h-5 w-5" />
      </button>
    </div>
  );
};

const SortableServerItem: React.FC<{server: RawServer | AssignedServer, isAssigned?: boolean}> = ({ server, isAssigned }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: server.id });
    return <DraggableServerItem server={server} attributes={attributes} listeners={listeners} setNodeRef={setNodeRef} transform={transform} transition={transition} isOverlay={isDragging} isAssigned={isAssigned} />;
};


interface DroppableZoneProps {
  id: string;
  title: string;
  servers: AssignedServer[];
  children?: React.ReactNode;
}

const DroppableZone: React.FC<DroppableZoneProps> = ({ id, title, servers, children }) => {
  const { setNodeRef, isOver } = useSortable({ id }); // Making the zone sortable itself to catch drops
  
  return (
    <div
      ref={setNodeRef}
      className={`p-4 border rounded-lg min-h-[200px] transition-colors ${isOver ? 'bg-accent/30 border-accent' : 'bg-secondary/50 border-dashed'}`}
    >
      <h3 className="text-lg font-semibold mb-3 text-center text-foreground">{title}</h3>
      <SortableContext items={servers.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {servers.map(server => <SortableServerItem key={server.id} server={server} isAssigned />)}
          {children}
          {servers.length === 0 && !children && <p className="text-sm text-muted-foreground text-center py-4">Drag servers here</p>}
        </div>
      </SortableContext>
    </div>
  );
};

interface ServerAssignmentProps {
  availableServers: RawServer[];
  onAssignmentComplete: (primary: AssignedServer[], dr: AssignedServer[]) => void;
}

const ServerAssignment: React.FC<ServerAssignmentProps> = ({ availableServers, onAssignmentComplete }) => {
  const [unassigned, setUnassigned] = useState<RawServer[]>([]);
  const [primaryZone, setPrimaryZone] = useState<AssignedServer[]>([]);
  const [drZone, setDrZone] = useState<AssignedServer[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setUnassigned([...availableServers]);
    setPrimaryZone([]);
    setDrZone([]);
  }, [availableServers]);

  const sensors = useSensors(useSensor(PointerSensor));

  const findServerById = (id: string): RawServer | AssignedServer | undefined => {
    return unassigned.find(s => s.id === id) || primaryZone.find(s => s.id === id) || drZone.find(s => s.id === id);
  };
  
  const activeServer = activeId ? findServerById(activeId) : null;

  const handleDragStart = (event: DragEndEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;

    if (!over) return;

    const activeServerId = active.id as string;
    const overContainerId = over.id as string; // This might be a server ID or a zone ID

    // Determine the target list and source list
    let sourceList: (RawServer[] | AssignedServer[]) = unassigned;
    let setSourceList: React.Dispatch<React.SetStateAction<any>> = setUnassigned;
    if (primaryZone.find(s => s.id === activeServerId)) {
      sourceList = primaryZone;
      setSourceList = setPrimaryZone as any;
    } else if (drZone.find(s => s.id === activeServerId)) {
      sourceList = drZone;
      setSourceList = setDrZone as any;
    }

    const isOverUnassigned = overContainerId === 'unassigned-zone' || unassigned.find(s => s.id === overContainerId);
    const isOverPrimary = overContainerId === 'primary-zone' || primaryZone.find(s => s.id === overContainerId);
    const isOverDr = overContainerId === 'dr-zone' || drZone.find(s => s.id === overContainerId);

    const serverToMove = sourceList.find(s => s.id === activeServerId) as RawServer | AssignedServer;
    if (!serverToMove) return;

    // Moving within the same list (sorting)
    if ((isOverUnassigned && sourceList === unassigned) ||
        (isOverPrimary && sourceList === primaryZone) ||
        (isOverDr && sourceList === drZone)) {
        
      const oldIndex = sourceList.findIndex(s => s.id === active.id);
      // If over.id is a zone ID, we drop at the end. If it's an item ID, we find its index.
      let newIndex: number;
      if (over.id === 'unassigned-zone' || over.id === 'primary-zone' || over.id === 'dr-zone') {
          newIndex = sourceList.length -1; // Drop at the end
      } else {
          newIndex = sourceList.findIndex(s => s.id === over.id);
      }

      if (oldIndex !== newIndex && newIndex !== -1) {
        setSourceList(prev => arrayMove(prev, oldIndex, newIndex));
      }
      return;
    }
    
    // Moving between lists
    setSourceList(prev => prev.filter(s => s.id !== activeServerId));

    const newAssignedServer: AssignedServer = {
        id: `assigned_${Date.now()}_${serverToMove.name}`, // New unique ID for assigned instance
        name: serverToMove.name,
        originalRawServerId: (serverToMove as RawServer).type ? (serverToMove as RawServer).id : (serverToMove as AssignedServer).originalRawServerId,
    };


    if (isOverPrimary) {
      setPrimaryZone(prev => [...prev, newAssignedServer]);
    } else if (isOverDr) {
      setDrZone(prev => [...prev, newAssignedServer]);
    } else if (isOverUnassigned) {
      // Convert back to RawServer if moving back to unassigned.
      // This requires finding the original RawServer details.
      const originalRaw = availableServers.find(rs => rs.id === newAssignedServer.originalRawServerId);
      if(originalRaw) {
        setUnassigned(prev => [...prev, originalRaw]);
      }
    }
  };
  
  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: '0.5' } },
    }),
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <div className="flex items-center gap-2">
            <Shuffle className="h-8 w-8 text-primary" />
            <CardTitle className="font-headline text-2xl">Step 2: Assign Servers</CardTitle>
        </div>
        <CardDescription>
          Drag servers from the "Available Servers" pool to the "Primary Servers" or "DR Servers" zones.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Unassigned Servers Zone */}
            <div className="border p-4 rounded-lg bg-background min-h-[200px]">
              <h3 className="text-lg font-semibold mb-3 text-center text-foreground">Available Servers</h3>
              <SortableContext items={unassigned.map(s => s.id)} strategy={verticalListSortingStrategy} id="unassigned-zone">
                <div className="space-y-2">
                    {unassigned.map(server => <SortableServerItem key={server.id} server={server} />)}
                    {unassigned.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All servers assigned.</p>}
                </div>
              </SortableContext>
            </div>

            {/* Primary Servers Zone */}
            <DroppableZone id="primary-zone" title="Primary Servers" servers={primaryZone} />

            {/* DR Servers Zone */}
            <DroppableZone id="dr-zone" title="DR Servers" servers={drZone} />
          </div>
          
          <DragOverlay dropAnimation={dropAnimation}>
            {activeServer ? <DraggableServerItem server={activeServer} isOverlay /> : null}
          </DragOverlay>

        </DndContext>
        <Button 
          onClick={() => onAssignmentComplete(primaryZone, drZone)} 
          size="lg" 
          className="w-full md:w-auto mt-8"
          disabled={unassigned.length > 0 && (primaryZone.length === 0 || drZone.length === 0 )}
        >
          Next: Configure Applications
        </Button>
         {unassigned.length > 0 && (primaryZone.length === 0 || drZone.length === 0) && (
            <p className="text-sm text-destructive mt-2">Assign all available servers to proceed, or ensure both Primary and DR zones have at least one server if some remain unassigned intentionally.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default ServerAssignment;
