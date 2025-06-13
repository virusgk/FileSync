
'use client';

import type * as React from 'react';
import { useState, useEffect, useCallback } from 'react';
import type { RawServer, AssignedServer } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent, DragOverlay, DropAnimation, defaultDropAnimationSideEffects } from '@dnd-kit/core';
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, ServerIcon as DefaultServerIcon, Shuffle, CheckCircle, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";


interface DraggableItemProps {
  server: RawServer | AssignedServer;
  isOverlay?: boolean;
}

const checkServerReachabilityAPI = async (serverName: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/check-reachability', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host: serverName, port: 22 }), // Assuming SSH port 22 for general check
      });
      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Reachability API error for ${serverName}:`, errorData.details || response.statusText);
        return false;
      }
      const data = await response.json();
      return data.reachable;
    } catch (error) {
      console.error(`Failed to fetch reachability for ${serverName}:`, error);
      return false;
    }
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
  let originalType: 'primary' | 'dr' | undefined = undefined;
  if (!isAssigned && (server as RawServer).type) {
    originalType = (server as RawServer).type;
  } else if (assignedInfo?.originalRawServerId) {
    if (assignedInfo.originalRawServerId.includes('_primary_')) originalType = 'primary';
    else if (assignedInfo.originalRawServerId.includes('_dr_')) originalType = 'dr';
  }


  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`p-3 mb-2 rounded-md shadow-sm flex items-center justify-between transition-shadow
                  ${isOverlay ? 'bg-primary text-primary-foreground z-50 ring-2 ring-primary' : 'bg-card border'}
                  ${isAssigned && originalType === 'primary' ? 'border-blue-500' : ''}
                  ${isAssigned && originalType === 'dr' ? 'border-purple-500' : ''}
                  ${!isAssigned && originalType === 'primary' ? 'border-blue-300 border-dashed' : ''}
                  ${!isAssigned && originalType === 'dr' ? 'border-purple-300 border-dashed' : ''}
                `}
    >
      <div className="flex items-center gap-2">
        {isAssigned && assignedInfo && (
          <>
            {assignedInfo.isCheckingReachability && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" title="Checking reachability..." />}
            {assignedInfo.isReachable === true && <CheckCircle className="h-4 w-4 text-green-500" title="Server is reachable" />}
            {assignedInfo.isReachable === false && <XCircle className="h-4 w-4 text-red-500" title="Server is unreachable" />}
            {assignedInfo.isReachable === null && !assignedInfo.isCheckingReachability && <AlertCircle className="h-4 w-4 text-yellow-500" title="Reachability status unknown" />}
          </>
        )}
        {!isAssigned && <DefaultServerIcon className="h-4 w-4 text-muted-foreground" />}
        <span className="font-medium">{server.name}</span>
        {!isAssigned && originalType && <span className="text-xs text-muted-foreground">({originalType})</span>}
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
  const { setNodeRef: zoneSetNodeRef, isOver: isZoneOver } = useSortable({ id }); 
  
  return (
    <div
      ref={zoneSetNodeRef} 
      className={`p-4 border rounded-lg min-h-[200px] transition-colors ${isZoneOver ? 'bg-accent/30 border-accent' : 'bg-secondary/50 border-dashed'}`}
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
  const { toast } = useToast();

  useEffect(() => {
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
    
    const isReachable = await checkServerReachabilityAPI(serverName);
    
    setZone(prev => prev.map(s => s.id === serverId ? { ...s, isReachable, isCheckingReachability: false } : s));
    toast({
        title: `Reachability: ${serverName}`,
        description: isReachable ? "Server is reachable." : "Server is unreachable.",
        variant: isReachable ? "default" : "destructive",
    });
  }, [toast]);


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
    const overId = over.id as string; 

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


    const isOverUnassignedZoneItems = unassigned.some(s => s.id === overId);
    const isOverUnassignedZoneContainer = overId === 'unassigned-zone';
    const isOverUnassignedZone = isOverUnassignedZoneContainer || isOverUnassignedZoneItems;

    const isOverPrimaryZoneItems = primaryZone.some(s => s.id === overId);
    const isOverPrimaryZoneContainer = overId === 'primary-zone';
    const isOverPrimaryZone = isOverPrimaryZoneContainer || isOverPrimaryZoneItems;

    const isOverDrZoneItems = drZone.some(s => s.id === overId);
    const isOverDrZoneContainer = overId === 'dr-zone';
    const isOverDrZone = isOverDrZoneContainer || isOverDrZoneItems;
    

    const serverToMove = sourceList.find(s => s.id === activeServerId);
    if (!serverToMove) return;
    
    if (active.id === over.id && !isOverUnassignedZoneContainer && !isOverPrimaryZoneContainer && !isOverDrZoneContainer) return; // Dropped on itself, not a zone container


    // Reordering within the same list
    if ((sourceZoneType === 'unassigned' && isOverUnassignedZone && !isOverUnassignedZoneContainer) ||
        (sourceZoneType === 'primary' && isOverPrimaryZone && !isOverPrimaryZoneContainer) ||
        (sourceZoneType === 'dr' && isOverDrZone && !isOverDrZoneContainer)) {
      
      const oldIndex = sourceList.findIndex(s => s.id === active.id);
      let newIndex = sourceList.findIndex(s => s.id === over.id);
       
      if (oldIndex !== -1 && newIndex !== -1) {
          setSourceListState((prev: any[]) => arrayMove(prev, oldIndex, newIndex));
      }
      return;
    }
    
    // Moving between lists or to an empty zone container
    setSourceListState((prev: any[]) => prev.filter(s => s.id !== activeServerId)); 
    
    if (isOverPrimaryZone) { 
      const assignedInstance: AssignedServer = {
        id: `assigned_p_${Date.now()}_${serverToMove.name.replace(/\s+/g, '_')}`,
        name: serverToMove.name,
        originalRawServerId: (serverToMove as RawServer).type ? (serverToMove as RawServer).id : (serverToMove as AssignedServer).originalRawServerId,
        isReachable: null,
        isCheckingReachability: false,
      };
      const overItemIndex = primaryZone.findIndex(item => item.id === over.id);
      setPrimaryZone(prev => {
        const newItems = [...prev];
        if (over.id && over.id !== 'primary-zone' && overItemIndex !== -1) {
             newItems.splice(overItemIndex, 0, assignedInstance);
        } else {
            newItems.push(assignedInstance);
        }
        return newItems;
      });
      performReachabilityCheck(assignedInstance.id, assignedInstance.name, 'primary');

    } else if (isOverDrZone) { 
       const assignedInstance: AssignedServer = {
        id: `assigned_d_${Date.now()}_${serverToMove.name.replace(/\s+/g, '_')}`,
        name: serverToMove.name,
        originalRawServerId: (serverToMove as RawServer).type ? (serverToMove as RawServer).id : (serverToMove as AssignedServer).originalRawServerId,
        isReachable: null,
        isCheckingReachability: false,
      };
      const overItemIndex = drZone.findIndex(item => item.id === over.id);
      setDrZone(prev => {
        const newItems = [...prev];
        if (over.id && over.id !== 'dr-zone' && overItemIndex !== -1) {
            newItems.splice(overItemIndex, 0, assignedInstance);
        } else {
            newItems.push(assignedInstance);
        }
        return newItems;
      });
      performReachabilityCheck(assignedInstance.id, assignedInstance.name, 'dr');

    } else if (isOverUnassignedZone) { 
      if (sourceZoneType === 'primary' || sourceZoneType === 'dr') {
        const assignedServerBeingMoved = serverToMove as AssignedServer;
        const originalRawServerDetails = availableServers.find(rs => rs.id === assignedServerBeingMoved.originalRawServerId);

        if (originalRawServerDetails) {
          setUnassigned(prevUnassigned => {
            if (prevUnassigned.some(s => s.id === originalRawServerDetails!.id)) {
              // If it already exists (e.g., from a rapid drag back and forth), don't re-add, but ensure order if dropped on specific item
              const currentIdx = prevUnassigned.findIndex(s => s.id === originalRawServerDetails!.id);
              let newItems = [...prevUnassigned];
              if (currentIdx !== -1) newItems.splice(currentIdx,1); // remove current instance

              const overItemIndex = newItems.findIndex(item => item.id === over.id);
              if (over.id && over.id !== 'unassigned-zone' && overItemIndex !== -1) {
                newItems.splice(overItemIndex, 0, originalRawServerDetails!);
              } else {
                newItems.push(originalRawServerDetails!);
              }
              return newItems;
            }

            // Add new item
            let newItems = [...prevUnassigned];
            const overItemIndex = newItems.findIndex(item => item.id === over.id);
            if (over.id && over.id !== 'unassigned-zone' && overItemIndex !== -1) {
              newItems.splice(overItemIndex, 0, originalRawServerDetails!);
            } else {
              newItems.push(originalRawServerDetails!);
            }
            return newItems;
          });
        } else {
          console.error("CRITICAL: Original RawServer not found in availableServers for ID:", assignedServerBeingMoved.originalRawServerId);
          toast({ title: "Error", description: "Could not find original server details. This should not happen.", variant: "destructive"});
          const reconstructedRawServer: RawServer = { 
              id: assignedServerBeingMoved.originalRawServerId,
              name: assignedServerBeingMoved.name,
              type: assignedServerBeingMoved.originalRawServerId.includes('_primary_') ? 'primary' : (assignedServerBeingMoved.originalRawServerId.includes('_dr_') ? 'dr' : 'primary') // Best guess
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
          Drag servers from the "Available Servers" pool to the "Primary Servers" or "DR Servers" zones. Server reachability will be checked via API (port 22 by default). You can drag assigned servers back to make them available again.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
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
          disabled={primaryZone.some(s => s.isCheckingReachability) || drZone.some(s => s.isCheckingReachability) || (primaryZone.length === 0 && drZone.length === 0 && availableServers.length > 0 && unassigned.length === availableServers.length) }
        >
          Next: Configure Applications
        </Button>
         {(primaryZone.length === 0 && drZone.length === 0 && availableServers.length > 0 && unassigned.length === availableServers.length ) && ( 
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
