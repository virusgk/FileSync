
'use client';

import type * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { RawServer, AssignedServer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ServerIcon, Shuffle, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';

interface DraggableItemProps {
  server: RawServer | AssignedServer;
  isOverlay?: boolean;
}

const mockCheckServerReachability = (serverName: string): Promise<boolean> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(Math.random() < 0.8);
    }, 1000 + Math.random() * 1000);
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
  const baseType = (server as RawServer).type || ((assignedInfo?.originalRawServerId || '').includes('_primary_') ? 'primary' : 'dr');


  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-3 mb-2 rounded-md shadow-sm flex items-center justify-between transition-shadow
                  ${isOverlay ? 'bg-primary text-primary-foreground z-50 ring-2 ring-primary' : 'bg-card border'}
                  ${isAssigned && baseType === 'primary' ? 'border-blue-500' : ''}
                  ${isAssigned && baseType === 'dr' ? 'border-purple-500' : ''}
                  ${!isAssigned && (server as RawServer).type === 'primary' ? 'border-blue-300 border-dashed' : ''}
                  ${!isAssigned && (server as RawServer).type === 'dr' ? 'border-purple-300 border-dashed' : ''}
                `}
    >
      <div className="flex items-center gap-2">
        {isAssigned && assignedInfo && (
          <>
            {assignedInfo.isCheckingReachability && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
            {assignedInfo.isReachable === true && <CheckCircle className="h-4 w-4 text-green-500" />}
            {assignedInfo.isReachable === false && <XCircle className="h-4 w-4 text-red-500" />}
            {assignedInfo.isReachable === null && !assignedInfo.isCheckingReachability && <AlertCircle className="h-4 w-4 text-yellow-500" />}
          </>
        )}
        {!isAssigned && <ServerIcon className="h-4 w-4 text-muted-foreground" />}
        <span className="font-medium">{server.name}</span>
        {!isAssigned && <span className="text-xs text-muted-foreground">({(server as RawServer).type})</span>}
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
  id: string; // e.g., "primary-zone", "dr-zone"
  title: string;
  servers: AssignedServer[]; // Servers currently in this zone
  children?: React.ReactNode; // For placeholder text
}

// This component defines a droppable area that also lists its current items.
const DroppableZone: React.FC<DroppableZoneProps> = ({ id, title, servers, children }) => {
  // useSortable makes the zone itself a potential drop target if needed for reordering zones (not used here)
  // but more importantly, SortableContext inside makes items within it sortable and part of the DND system.
  const { setNodeRef: zoneSetNodeRef, isOver: isZoneOver } = useSortable({ id }); 
  
  return (
    <div
      ref={zoneSetNodeRef} // This ref is for the zone itself if it were sortable among other zones.
      className={`p-4 border rounded-lg min-h-[200px] transition-colors ${isZoneOver ? 'bg-accent/30 border-accent' : 'bg-secondary/50 border-dashed'}`}
    >
      <h3 className="text-lg font-semibold mb-3 text-center text-foreground">{title}</h3>
      {/* SortableContext manages the items *within* this zone */}
      <SortableContext items={servers.map(s => s.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {servers.map(server => <SortableServerItem key={server.id} server={server} isAssigned assignedServerDetails={server} />)}
          {children} {/* Typically not used if servers are present */}
          {servers.length === 0 && !children && <p className="text-sm text-muted-foreground text-center py-4">Drag servers here</p>}
        </div>
      </SortableContext>
    </div>
  );
};

interface ServerAssignmentProps {
  availableServers: RawServer[]; // This should be ALL raw servers defined by user
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
    const assignedOriginalIds = new Set([
      ...initialPrimaryServers.map(s => s.originalRawServerId),
      ...initialDrServers.map(s => s.originalRawServerId)
    ]);
    // `availableServers` (prop) is the complete list. Filter it to find unassigned ones.
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


  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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

    if (!over || !active) return;

    const activeServerId = active.id as string;
    const overId = over.id as string; // This can be a zone ID or an item ID

    let sourceList: (RawServer[] | AssignedServer[]) = unassigned;
    let setSourceListState: React.Dispatch<React.SetStateAction<any>> = setUnassigned;
    let sourceZoneType: 'unassigned' | 'primary' | 'dr' = 'unassigned';

    if (primaryZone.find(s => s.id === activeServerId)) {
      sourceList = primaryZone;
      setSourceListState = setPrimaryZone as any;
      sourceZoneType = 'primary';
    } else if (drZone.find(s => s.id === activeServerId)) {
      sourceList = drZone;
      setSourceListState = setDrZone as any;
      sourceZoneType = 'dr';
    } else if (unassigned.find(s => s.id === activeServerId)) {
      sourceList = unassigned;
      setSourceListState = setUnassigned as any;
      sourceZoneType = 'unassigned';
    }


    const isOverUnassignedZone = overId === 'unassigned-zone' || unassigned.some(s => s.id === overId);
    const isOverPrimaryZone = overId === 'primary-zone' || primaryZone.some(s => s.id === overId);
    const isOverDrZone = overId === 'dr-zone' || drZone.some(s => s.id === overId);

    const serverToMove = sourceList.find(s => s.id === activeServerId);
    if (!serverToMove) return;
    
    // Reordering within the same list
    if ((isOverUnassignedZone && sourceZoneType === 'unassigned') ||
        (isOverPrimaryZone && sourceZoneType === 'primary') ||
        (isOverDrZone && sourceZoneType === 'dr')) {
      if (active.id !== over.id) { // Check if it's not dropped on itself
        const oldIndex = sourceList.findIndex(s => s.id === active.id);
        // If over.id is a zone ID, append. Otherwise, find index of item dropped over.
        const newIndex = (over.id === 'unassigned-zone' || over.id === 'primary-zone' || over.id === 'dr-zone') 
                         ? sourceList.length -1 // effectively append if not dropping on specific item
                         : sourceList.findIndex(s => s.id === over.id);
        
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            setSourceListState((prev: any[]) => arrayMove(prev, oldIndex, newIndex));
        } else if (oldIndex !== -1 && (over.id === 'unassigned-zone' || over.id === 'primary-zone' || over.id === 'dr-zone')) {
            // Dragged to the zone itself, not a specific item (e.g. empty list)
            // arrayMove can handle this if newIndex is appropriately set (e.g. list.length -1 or 0 for beginning)
            // For now, we assume if not on specific item, it's like appending. Dnd-kit usually handles this.
        }
      }
      return;
    }
    
    // Moving between lists
    setSourceListState((prev: any[]) => prev.filter(s => s.id !== activeServerId)); // Remove from source
    
    if (isOverPrimaryZone) { // Moving TO Primary
      const assignedInstance: AssignedServer = {
        id: `assigned_p_${Date.now()}_${serverToMove.name.replace(/\s+/g, '_')}`,
        name: serverToMove.name,
        originalRawServerId: (serverToMove as RawServer).type ? (serverToMove as RawServer).id : (serverToMove as AssignedServer).originalRawServerId,
        isReachable: null,
        isCheckingReachability: false,
      };
      setPrimaryZone(prev => [...prev, assignedInstance]);
      performReachabilityCheck(assignedInstance.id, assignedInstance.name, 'primary');

    } else if (isOverDrZone) { // Moving TO DR
       const assignedInstance: AssignedServer = {
        id: `assigned_d_${Date.now()}_${serverToMove.name.replace(/\s+/g, '_')}`,
        name: serverToMove.name,
        originalRawServerId: (serverToMove as RawServer).type ? (serverToMove as RawServer).id : (serverToMove as AssignedServer).originalRawServerId,
        isReachable: null,
        isCheckingReachability: false,
      };
      setDrZone(prev => [...prev, assignedInstance]);
      performReachabilityCheck(assignedInstance.id, assignedInstance.name, 'dr');

    } else if (isOverUnassignedZone) { // Moving TO Unassigned (from Primary or DR)
      if (sourceZoneType === 'primary' || sourceZoneType === 'dr') {
        const assignedServerBeingMoved = serverToMove as AssignedServer;
        const originalRawServerDetails = availableServers.find(rs => rs.id === assignedServerBeingMoved.originalRawServerId);

        if (originalRawServerDetails) {
          setUnassigned(prevUnassigned => {
            if (prevUnassigned.some(s => s.id === originalRawServerDetails.id)) {
              return prevUnassigned; // Should not happen if removed from source correctly
            }
            return [...prevUnassigned, originalRawServerDetails];
          });
        } else {
          console.error("CRITICAL: Original RawServer not found in availableServers for ID:", assignedServerBeingMoved.originalRawServerId);
          const reconstructedRawServer: RawServer = { // Fallback
              id: assignedServerBeingMoved.originalRawServerId,
              name: assignedServerBeingMoved.name,
              type: assignedServerBeingMoved.originalRawServerId.includes('_primary_') ? 'primary' : (assignedServerBeingMoved.originalRawServerId.includes('_dr_') ? 'dr' : 'primary')
          };
          setUnassigned(prevUnassigned => [...prevUnassigned, reconstructedRawServer]);
        }
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
          Drag servers from the "Available Servers" pool to the "Primary Servers" or "DR Servers" zones. Server reachability will be checked upon assignment. You can drag assigned servers back to make them available again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Available Servers Zone */}
            <div className="border p-4 rounded-lg bg-background min-h-[200px]">
              <h3 className="text-lg font-semibold mb-3 text-center text-foreground">Available Servers</h3>
              <SortableContext items={unassigned.map(s => s.id)} strategy={verticalListSortingStrategy} id="unassigned-zone">
                <div className="space-y-2">
                    {unassigned.map(server => <SortableServerItem key={server.id} server={server} isAssigned={false} />)}
                    {unassigned.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">All servers assigned or none entered.</p>}
                </div>
              </SortableContext>
            </div>

            <DroppableZone id="primary-zone" title="Primary Servers" servers={primaryZone} />
            <DroppableZone id="dr-zone" title="DR Servers" servers={drZone} />
          </div>
          
          <DragOverlay dropAnimation={dropAnimation}>
            {activeServer ? <DraggableServerItem server={activeServer} isOverlay isAssigned={primaryZone.some(s => s.id === activeId) || drZone.some(s => s.id === activeId)} assignedServerDetails={activeServer as AssignedServer} /> : null}
          </DragOverlay>

        </DndContext>
        <Button 
          onClick={() => onAssignmentComplete(primaryZone, drZone)} 
          size="lg" 
          className="w-full md:w-auto mt-8"
          disabled={primaryZone.some(s => s.isCheckingReachability) || drZone.some(s => s.isCheckingReachability) || (primaryZone.length === 0 && drZone.length === 0 && availableServers.length > 0) } // Allow proceeding if all servers are assigned or no servers to assign
        >
          Next: Configure Applications
        </Button>
         {(primaryZone.length === 0 && drZone.length === 0 && availableServers.length > 0 && !unassigned.some(s=> s !== undefined)) && ( // Check if unassigned has actual items, not just an empty array
            <p className="text-sm text-destructive mt-2">Please assign at least one server to either Primary or DR zone if servers are available.</p>
        )}
         {(primaryZone.some(s => s.isCheckingReachability) || drZone.some(s => s.isCheckingReachability)) && (
            <p className="text-sm text-amber-600 mt-2">Waiting for server reachability checks to complete...</p>
         )}
      </CardContent>
    </Card>
  );
};

export default ServerAssignment;


    