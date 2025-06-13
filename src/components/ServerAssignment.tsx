
'use client';

import type * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { RawServer, AssignedServer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ServerIcon, Shuffle, CheckCircle, XCircle, RefreshCw } from 'lucide-react'; // Changed Server to ServerIcon to avoid conflict

interface DraggableItemProps {
  server: RawServer | AssignedServer;
  isOverlay?: boolean;
}

// Simulated server reachability check
const mockCheckServerReachability = (serverName: string): Promise<boolean> => {
  return new Promise(resolve => {
    setTimeout(() => {
      // Simulate ~80% success rate
      resolve(Math.random() < 0.8);
    }, 1000 + Math.random() * 1000); // 1-2 second delay
  });
};


const DraggableServerItem: React.FC<DraggableItemProps & ReturnType<typeof useSortable> & {isAssigned?: boolean, assignedServerDetails?: AssignedServer}> = ({
  server,
  attributes,
  listeners,
  setNodeRef,
  transform,
  transition,
  isOverlay,
  isAssigned,
  assignedServerDetails,
}) => {
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isOverlay ? 0.8 : 1,
    cursor: isOverlay ? 'grabbing' : 'grab',
  };

  const assignedInfo = isAssigned ? assignedServerDetails : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-3 mb-2 rounded-md shadow-sm flex items-center justify-between transition-shadow
                  ${isOverlay ? 'bg-primary text-primary-foreground z-50 ring-2 ring-primary' : 'bg-card border'}
                  ${isAssigned && assignedInfo?.originalRawServerId.includes('_primary_') ? 'border-blue-500' : ''}
                  ${isAssigned && assignedInfo?.originalRawServerId.includes('_dr_') ? 'border-purple-500' : ''}
                `}
    >
      <div className="flex items-center gap-2">
        {isAssigned && (
          <>
            {assignedInfo?.isCheckingReachability && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            {assignedInfo?.isReachable === true && <CheckCircle className="h-4 w-4 text-green-500" />}
            {assignedInfo?.isReachable === false && <XCircle className="h-4 w-4 text-red-500" />}
            {assignedInfo?.isReachable === null && !assignedInfo?.isCheckingReachability && <ServerIcon className="h-4 w-4 text-muted-foreground" />}
          </>
        )}
        <span className="font-medium">{server.name}</span>
      </div>
      <button {...listeners} className="p-1 text-muted-foreground hover:text-foreground">
        <GripVertical className="h-5 w-5" />
      </button>
    </div>
  );
};

const SortableServerItem: React.FC<{server: RawServer | AssignedServer, isAssigned?: boolean, assignedServerDetails?: AssignedServer}> = ({ server, isAssigned, assignedServerDetails }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: server.id });
    return <DraggableServerItem server={server} attributes={attributes} listeners={listeners} setNodeRef={setNodeRef} transform={transform} transition={transition} isOverlay={isDragging} isAssigned={isAssigned} assignedServerDetails={assignedServerDetails} />;
};


interface DroppableZoneProps {
  id: string;
  title: string;
  servers: AssignedServer[];
  children?: React.ReactNode;
}

const DroppableZone: React.FC<DroppableZoneProps> = ({ id, title, servers, children }) => {
  const { setNodeRef, isOver } = useSortable({ id }); 
  
  return (
    <div
      ref={setNodeRef}
      className={`p-4 border rounded-lg min-h-[200px] transition-colors ${isOver ? 'bg-accent/30 border-accent' : 'bg-secondary/50 border-dashed'}`}
    >
      <h3 className="text-lg font-semibold mb-3 text-center text-foreground">{title}</h3>
      <SortableContext items={servers.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {servers.map(server => <SortableServerItem key={server.id} server={server} isAssigned assignedServerDetails={server} />)}
          {children}
          {servers.length === 0 && !children && <p className="text-sm text-muted-foreground text-center py-4">Drag servers here</p>}
        </div>
      </SortableContext>
    </div>
  );
};

interface ServerAssignmentProps {
  availableServers: RawServer[];
  initialPrimaryServers?: AssignedServer[];
  initialDrServers?: AssignedServer[];
  onAssignmentComplete: (primary: AssignedServer[], dr: AssignedServer[]) => void;
}

const ServerAssignment: React.FC<ServerAssignmentProps> = ({ 
  availableServers, 
  initialPrimaryServers = [],
  initialDrServers = [],
  onAssignmentComplete 
}) => {
  const [unassigned, setUnassigned] = useState<RawServer[]>([]);
  const [primaryZone, setPrimaryZone] = useState<AssignedServer[]>(initialPrimaryServers);
  const [drZone, setDrZone] = useState<AssignedServer[]>(initialDrServers);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Filter out servers already in primaryZone or drZone from availableServers
    const assignedOriginalIds = new Set([
      ...initialPrimaryServers.map(s => s.originalRawServerId),
      ...initialDrServers.map(s => s.originalRawServerId)
    ]);
    setUnassigned(availableServers.filter(s => !assignedOriginalIds.has(s.id)));
    setPrimaryZone(initialPrimaryServers);
    setDrZone(initialDrServers);
  }, [availableServers, initialPrimaryServers, initialDrServers]);
  

  const performReachabilityCheck = useCallback(async (serverId: string, serverName: string, zone: 'primary' | 'dr') => {
    const setZone = zone === 'primary' ? setPrimaryZone : setDrZone;
    setZone(prev => prev.map(s => s.id === serverId ? { ...s, isCheckingReachability: true, isReachable: null } : s));
    
    const isReachable = await mockCheckServerReachability(serverName);
    
    setZone(prev => prev.map(s => s.id === serverId ? { ...s, isReachable, isCheckingReachability: false } : s));
  }, []);


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
    const overContainerId = over.id as string;

    let sourceList: (RawServer[] | AssignedServer[]) = unassigned;
    let setSourceList: React.Dispatch<React.SetStateAction<any>> = setUnassigned;
    let sourceZoneType: 'unassigned' | 'primary' | 'dr' = 'unassigned';

    if (primaryZone.find(s => s.id === activeServerId)) {
      sourceList = primaryZone;
      setSourceList = setPrimaryZone as any;
      sourceZoneType = 'primary';
    } else if (drZone.find(s => s.id === activeServerId)) {
      sourceList = drZone;
      setSourceList = setDrZone as any;
      sourceZoneType = 'dr';
    }

    const isOverUnassigned = overContainerId === 'unassigned-zone' || unassigned.find(s => s.id === overContainerId);
    const isOverPrimary = overContainerId === 'primary-zone' || primaryZone.find(s => s.id === overContainerId);
    const isOverDr = overContainerId === 'dr-zone' || drZone.find(s => s.id === overContainerId);

    const serverToMove = sourceList.find(s => s.id === activeServerId) as RawServer | AssignedServer;
    if (!serverToMove) return;

    if ((isOverUnassigned && sourceZoneType === 'unassigned') ||
        (isOverPrimary && sourceZoneType === 'primary') ||
        (isOverDr && sourceZoneType === 'dr')) {
        
      const oldIndex = sourceList.findIndex(s => s.id === active.id);
      let newIndex: number;
      if (over.id === 'unassigned-zone' || over.id === 'primary-zone' || over.id === 'dr-zone') {
          newIndex = sourceList.length; 
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
    
    const assignedServerInstance: AssignedServer = {
        id: (serverToMove as AssignedServer).id || `assigned_${Date.now()}_${serverToMove.name.replace(/\s+/g, '_')}`,
        name: serverToMove.name,
        originalRawServerId: (serverToMove as RawServer).type ? (serverToMove as RawServer).id : (serverToMove as AssignedServer).originalRawServerId,
        isReachable: (serverToMove as AssignedServer).isReachable !== undefined ? (serverToMove as AssignedServer).isReachable : null,
        isCheckingReachability: false,
    };


    if (isOverPrimary) {
      setPrimaryZone(prev => [...prev, assignedServerInstance]);
      if (assignedServerInstance.isReachable === null) { // Only check if not already checked
         performReachabilityCheck(assignedServerInstance.id, assignedServerInstance.name, 'primary');
      }
    } else if (isOverDr) {
      setDrZone(prev => [...prev, assignedServerInstance]);
       if (assignedServerInstance.isReachable === null) {
         performReachabilityCheck(assignedServerInstance.id, assignedServerInstance.name, 'dr');
      }
    } else if (isOverUnassigned) {
      const originalRaw = availableServers.find(rs => rs.id === assignedServerInstance.originalRawServerId);
      if(originalRaw) {
        // When moving back to unassigned, we use the original RawServer object
        setUnassigned(prev => [...prev, originalRaw]);
      } else {
        // Fallback if originalRawServer isn't found (should not happen with correct originalRawServerId)
        const rawVersion: RawServer = {
            id: assignedServerInstance.originalRawServerId, // Use original ID
            name: assignedServerInstance.name,
            type: assignedServerInstance.originalRawServerId.includes('_primary_') ? 'primary' : 'dr' // Infer type
        };
        setUnassigned(prev => [...prev, rawVersion]);
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
          Drag servers from the "Available Servers" pool to the "Primary Servers" or "DR Servers" zones. Server reachability will be checked upon assignment.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border p-4 rounded-lg bg-background min-h-[200px]">
              <h3 className="text-lg font-semibold mb-3 text-center text-foreground">Available Servers</h3>
              <SortableContext items={unassigned.map(s => s.id)} strategy={verticalListSortingStrategy} id="unassigned-zone">
                <div className="space-y-2">
                    {unassigned.map(server => <SortableServerItem key={server.id} server={server} />)}
                    {unassigned.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All servers assigned.</p>}
                </div>
              </SortableContext>
            </div>

            <DroppableZone id="primary-zone" title="Primary Servers" servers={primaryZone} />
            <DroppableZone id="dr-zone" title="DR Servers" servers={drZone} />
          </div>
          
          <DragOverlay dropAnimation={dropAnimation}>
            {activeServer ? <DraggableServerItem server={activeServer} isOverlay assignedServerDetails={activeServer as AssignedServer} /> : null}
          </DragOverlay>

        </DndContext>
        <Button 
          onClick={() => onAssignmentComplete(primaryZone, drZone)} 
          size="lg" 
          className="w-full md:w-auto mt-8"
          // Disabled if any server is still being checked for reachability
          disabled={primaryZone.some(s => s.isCheckingReachability) || drZone.some(s => s.isCheckingReachability) || (unassigned.length > 0 && (primaryZone.length === 0 || drZone.length === 0))}
        >
          Next: Configure Applications
        </Button>
         {(unassigned.length > 0 && (primaryZone.length === 0 || drZone.length === 0)) && (
            <p className="text-sm text-destructive mt-2">Assign all available servers to proceed, or ensure both Primary and DR zones have at least one server if some remain unassigned intentionally.</p>
        )}
         {(primaryZone.some(s => s.isCheckingReachability) || drZone.some(s => s.isCheckingReachability)) && (
            <p className="text-sm text-amber-600 mt-2">Waiting for server reachability checks to complete...</p>
         )}
      </CardContent>
    </Card>
  );
};

export default ServerAssignment;
