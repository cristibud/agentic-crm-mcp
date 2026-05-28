'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { ContractStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { updateContractStatus, downloadContractPdf } from '@/lib/api';
import type { Contract, ContractStatus } from '@/lib/types';

interface ContractDetailProps {
  contract: Contract;
  onUpdate: (c: Contract) => void;
}

export function ContractDetail({ contract, onUpdate }: ContractDetailProps) {
  const [loading, setLoading] = useState<ContractStatus | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const handleStatus = async (status: ContractStatus) => {
    setLoading(status);
    try {
      const updated = await updateContractStatus(contract.id, status);
      onUpdate(updated);
      toast.success(`Contract marked as ${status.toLowerCase()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update status');
    } finally {
      setLoading(null);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const blob = await downloadContractPdf(contract.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contract-${contract.number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('PDF downloaded');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to download PDF');
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900 font-mono">{contract.number}</h2>
              <ContractStatusBadge status={contract.status} />
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Created {new Date(contract.createdAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {contract.status === 'DRAFT' && (
              <Button
                variant="secondary"
                size="sm"
                loading={loading === 'SENT'}
                onClick={() => handleStatus('SENT')}
              >
                Mark as Sent
              </Button>
            )}
            {contract.status === 'SENT' && (
              <Button
                variant="primary"
                size="sm"
                loading={loading === 'SIGNED'}
                onClick={() => handleStatus('SIGNED')}
              >
                Mark as Signed
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={handleDownloadPdf} loading={downloadingPdf}>
              <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </Button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 border-t pt-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Client</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{contract.deal?.lead?.name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Deal</p>
            <p className="text-sm font-medium text-gray-900 mt-1">{contract.deal?.title || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide">Deal Value</p>
            <p className="text-sm font-medium text-gray-900 mt-1">
              €{(contract.deal?.value ?? 0).toLocaleString()}
            </p>
          </div>
          {contract.signedAt && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide">Signed At</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {new Date(contract.signedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* Content */}
      <Card>
        <h3 className="text-base font-semibold text-gray-900 mb-4">Contract Content</h3>
        <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed bg-gray-50 rounded-lg p-4 border">
          {contract.content}
        </pre>
      </Card>
    </div>
  );
}
