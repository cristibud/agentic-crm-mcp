'use client';

import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
} from '@tanstack/react-table';
import { useRouter } from 'next/navigation';
import { ContractStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import type { Contract } from '@/lib/types';

const col = createColumnHelper<Contract>();

interface ContractsTableProps {
  contracts: Contract[];
}

export function ContractsTable({ contracts }: ContractsTableProps) {
  const router = useRouter();

  const columns = [
    col.accessor('number', {
      header: 'Number',
      cell: (info) => (
        <span className="font-mono font-medium text-gray-900">{info.getValue()}</span>
      ),
    }),
    col.accessor((row) => row.deal?.lead?.name, {
      id: 'client',
      header: 'Client',
      cell: (info) => <span className="text-gray-700">{info.getValue() || '—'}</span>,
    }),
    col.accessor((row) => row.deal?.title, {
      id: 'deal',
      header: 'Deal',
      cell: (info) => <span className="text-gray-600 truncate max-w-xs block">{info.getValue() || '—'}</span>,
    }),
    col.accessor('status', {
      header: 'Status',
      cell: (info) => <ContractStatusBadge status={info.getValue()} />,
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
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/contracts/${row.original.id}`);
            }}
          >
            View
          </Button>
        </div>
      ),
    }),
  ];

  const table = useReactTable({
    data: contracts,
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
                No contracts found
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => router.push(`/contracts/${row.original.id}`)}
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
