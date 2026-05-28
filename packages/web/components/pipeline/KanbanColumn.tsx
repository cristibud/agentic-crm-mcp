'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DealCard } from './DealCard';
import type { Deal, DealStage } from '@/lib/types';

const stageColors: Record<DealStage, string> = {
  PROSPECT: 'bg-gray-500',
  QUALIFIED: 'bg-blue-500',
  PROPOSAL: 'bg-yellow-500',
  NEGOTIATION: 'bg-purple-500',
  WON: 'bg-green-500',
  LOST: 'bg-red-500',
};

const stageLabels: Record<DealStage, string> = {
  PROSPECT: 'Prospect',
  QUALIFIED: 'Qualified',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

interface KanbanColumnProps {
  stage: DealStage;
  deals: Deal[];
  onEdit?: (deal: Deal) => void;
}

export function KanbanColumn({ stage, deals, onEdit }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  const totalValue = deals.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={`flex flex-col bg-gray-50 rounded-xl border ${isOver ? 'border-indigo-400 bg-indigo-50' : 'border-gray-200'} min-w-[240px] w-60 flex-shrink-0 transition-colors`}>
      {/* Column header */}
      <div className="px-3 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${stageColors[stage]}`} />
          <span className="text-sm font-semibold text-gray-800">{stageLabels[stage]}</span>
          <span className="ml-auto bg-gray-200 text-gray-600 text-xs rounded-full px-2 py-0.5 font-medium">
            {deals.length}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          €{totalValue.toLocaleString()}
        </p>
      </div>

      {/* Cards */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 min-h-[200px] overflow-y-auto max-h-[calc(100vh-260px)]"
      >
        <SortableContext items={deals.map((d) => d.id)} strategy={verticalListSortingStrategy}>
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onEdit={onEdit} />
          ))}
        </SortableContext>
        {deals.length === 0 && (
          <p className="text-xs text-gray-400 text-center pt-8">Drop deals here</p>
        )}
      </div>
    </div>
  );
}
