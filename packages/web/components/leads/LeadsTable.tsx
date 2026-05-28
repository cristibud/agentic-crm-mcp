'use client';

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { LeadStatusBadge, LeadSourceBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Lead } from '@/lib/types';

const col = createColumnHelper<Lead>();

interface LeadsTableProps {
  leads: Lead[];
  onDelete: (id: string) => void;
}

export function LeadsTable({ leads, onDelete }: LeadsTableProps) {
  const router = useRouter();

  const columns = [
    col.accessor('name', {
      header: 'Name',
      cell: (info) => (
        <span className="font-medium text-gray-900">{info.getValue()}</span>
      ),
    }),
    col.accessor('email', {
      header: 'Email',
      cell: (info) => <span className="text-gray-600">{info.getValue()}</span>,
    }),
    col.accessor('company', {
      header: 'Company',
      cell: (info) => <span className="text-gray-600">{info.getValue() || '—'}</span>,
    }),
    col.accessor('source', {
      header: 'Source',
      cell: (info) => <LeadSourceBadge source={info.getValue()} />,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => <LeadStatusBadge status={info.getValue()} />,
    }),
    col.accessor('score', {
      header: 'Score',
      cell: (info) => (
        <div className="flex items-center gap-2">
          <div className="w-16 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-indigo-500 h-1.5 rounded-full"
              style={{ width: `${info.getValue()}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{info.getValue()}</span>
        </div>
      ),
    }),
    col.accessor('createdAt', {
      header: 'Created',
      cell: (info) =>
        new Date(info.getValue()).toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
        }),
    }),
    col.display({
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex items-center gap-2 justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => { e.stopPropagation(); router.push(`/leads/${row.original.id}`); }}
          >
            View
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete lead "${row.original.name}"?`)) {
                onDelete(row.original.id);
              }
            }}
          >
            Delete
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: leads,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          {table.getHeaderGroups().map((hg) => (
            <tr key={hg.id}>
              {hg.headers.map((h) => (
                <th
                  key={h.id}
                  className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody className="divide-y divide-gray-100">
          {table.getRowModel().rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-12 text-center text-sm text-gray-400">
                No leads found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/leads/${row.original.id}`)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
