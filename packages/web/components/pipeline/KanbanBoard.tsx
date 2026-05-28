'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { KanbanColumn } from './KanbanColumn';
import { DealCard } from './DealCard';
import { moveDealStage } from '@/lib/api';
import { toast } from 'sonner';
import type { Deal, DealStage } from '@/lib/types';

const STAGES: DealStage[] = ['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

interface KanbanBoardProps {
  deals: Deal[];
  onUpdate: () => void;
  onEdit?: (deal: Deal) => void;
}

export function KanbanBoard({ deals, onUpdate, onEdit }: KanbanBoardProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals);

  // Sync when prop changes using useEffect
  useEffect(() => {
    setLocalDeals(deals);
  }, [deals]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const getDealsByStage = useCallback(
    (stage: DealStage) => localDeals.filter((d) => d.stage === stage),
    [localDeals],
  );

  const activeDeal = activeId ? localDeals.find((d) => d.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over) return;

    const dealId = active.id as string;
    const targetStage = over.id as DealStage;

    if (!STAGES.includes(targetStage)) return;

    const deal = localDeals.find((d) => d.id === dealId);
    if (!deal || deal.stage === targetStage) return;

    // Optimistic update
    setLocalDeals((prev) =>
      prev.map((d) => (d.id === dealId ? { ...d, stage: targetStage } : d)),
    );

    try {
      await moveDealStage(dealId, targetStage);
      onUpdate();
      toast.success(`Deal moved to ${targetStage}`);
    } catch (err) {
      // Rollback
      setLocalDeals(deals);
      toast.error(err instanceof Error ? err.message : 'Failed to move deal');
    }
  };

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn key={stage} stage={stage} deals={getDealsByStage(stage)} onEdit={onEdit} />
        ))}
      </div>
      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
