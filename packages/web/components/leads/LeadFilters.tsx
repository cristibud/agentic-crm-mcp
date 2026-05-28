'use client';

import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';

const statusOptions = [
  { value: '', label: 'All Statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'CONTACTED', label: 'Contacted' },
  { value: 'QUALIFIED', label: 'Qualified' },
  { value: 'UNQUALIFIED', label: 'Unqualified' },
  { value: 'CONVERTED', label: 'Converted' },
];

const sourceOptions = [
  { value: '', label: 'All Sources' },
  { value: 'WEBSITE', label: 'Website' },
  { value: 'REFERRAL', label: 'Referral' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'COLD_CALL', label: 'Cold Call' },
  { value: 'OTHER', label: 'Other' },
];

interface LeadFiltersProps {
  status: string;
  source: string;
  search: string;
  onStatusChange: (v: string) => void;
  onSourceChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onClear: () => void;
}

export function LeadFilters({
  status, source, search,
  onStatusChange, onSourceChange, onSearchChange, onClear,
}: LeadFiltersProps) {
  const hasFilters = status || source || search;
  return (
    <div className="flex flex-wrap gap-3 items-end">
      <div className="w-56">
        <Input
          placeholder="Search name, email, company..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
      <div className="w-44">
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        />
      </div>
      <div className="w-44">
        <Select
          options={sourceOptions}
          value={source}
          onChange={(e) => onSourceChange(e.target.value)}
        />
      </div>
      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onClear}>Clear</Button>
      )}
    </div>
  );
}
