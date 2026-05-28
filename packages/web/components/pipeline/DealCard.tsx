'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Deal } from '@/lib/types';

interface DealCardProps {
  deal: Deal;
  onEdit?: (deal: Deal) => void;
}

export function DealCard({ deal, onEdit }: DealCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: deal.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{deal.title}</p>
          {deal.lead?.company && (
            <p className="text-xs text-gray-500 mt-0.5 truncate">{deal.lead.company}</p>
          )}
          <div className="flex items-center justify-between mt-2">
            <span className="text-sm font-medium text-indigo-600">
              €{deal.value.toLocaleString()}
            </span>
            <span className="text-xs text-gray-400">{deal.probability}%</span>
          </div>
          {deal.lead?.name && (
            <p className="text-xs text-gray-400 mt-1 truncate">{deal.lead.name}</p>
          )}
        </div>
        {onEdit && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onEdit(deal);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded"
            title="Edit deal"
          >
            <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
