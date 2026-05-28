import type { LeadStatus, LeadSource, ContractStatus, DealStage } from '@/lib/types';

type BadgeVariant = 'gray' | 'blue' | 'green' | 'red' | 'purple' | 'yellow' | 'indigo';

const variantClasses: Record<BadgeVariant, string> = {
  gray: 'bg-gray-100 text-gray-700',
  blue: 'bg-blue-100 text-blue-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
  purple: 'bg-purple-100 text-purple-700',
  yellow: 'bg-yellow-100 text-yellow-700',
  indigo: 'bg-indigo-100 text-indigo-700',
};

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ children, variant = 'gray', className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function LeadStatusBadge({ status }: { status: LeadStatus }) {
  const map: Record<LeadStatus, { label: string; variant: BadgeVariant }> = {
    NEW: { label: 'New', variant: 'gray' },
    CONTACTED: { label: 'Contacted', variant: 'blue' },
    QUALIFIED: { label: 'Qualified', variant: 'green' },
    UNQUALIFIED: { label: 'Unqualified', variant: 'red' },
    CONVERTED: { label: 'Converted', variant: 'purple' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function LeadSourceBadge({ source }: { source: LeadSource }) {
  const map: Record<LeadSource, { label: string; variant: BadgeVariant }> = {
    WEBSITE: { label: 'Website', variant: 'blue' },
    REFERRAL: { label: 'Referral', variant: 'green' },
    LINKEDIN: { label: 'LinkedIn', variant: 'indigo' },
    COLD_CALL: { label: 'Cold Call', variant: 'yellow' },
    OTHER: { label: 'Other', variant: 'gray' },
  };
  const { label, variant } = map[source] ?? { label: source, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const map: Record<ContractStatus, { label: string; variant: BadgeVariant }> = {
    DRAFT: { label: 'Draft', variant: 'gray' },
    SENT: { label: 'Sent', variant: 'blue' },
    SIGNED: { label: 'Signed', variant: 'green' },
    EXPIRED: { label: 'Expired', variant: 'red' },
    CANCELLED: { label: 'Cancelled', variant: 'red' },
  };
  const { label, variant } = map[status] ?? { label: status, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}

export function DealStageBadge({ stage }: { stage: DealStage }) {
  const map: Record<DealStage, { label: string; variant: BadgeVariant }> = {
    PROSPECT: { label: 'Prospect', variant: 'gray' },
    QUALIFIED: { label: 'Qualified', variant: 'blue' },
    PROPOSAL: { label: 'Proposal', variant: 'yellow' },
    NEGOTIATION: { label: 'Negotiation', variant: 'indigo' },
    WON: { label: 'Won', variant: 'green' },
    LOST: { label: 'Lost', variant: 'red' },
  };
  const { label, variant } = map[stage] ?? { label: stage, variant: 'gray' };
  return <Badge variant={variant}>{label}</Badge>;
}
