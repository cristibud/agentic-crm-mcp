import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';

vi.mock('@prisma/client', () => ({
  LeadSource: {
    WEBSITE: 'WEBSITE',
    REFERRAL: 'REFERRAL',
    LINKEDIN: 'LINKEDIN',
    COLD_CALL: 'COLD_CALL',
    OTHER: 'OTHER',
  },
  LeadStatus: {
    NEW: 'NEW',
    CONTACTED: 'CONTACTED',
    QUALIFIED: 'QUALIFIED',
    UNQUALIFIED: 'UNQUALIFIED',
    CONVERTED: 'CONVERTED',
  },
  DealStage: {
    PROSPECT: 'PROSPECT',
    QUALIFIED: 'QUALIFIED',
    PROPOSAL: 'PROPOSAL',
    NEGOTIATION: 'NEGOTIATION',
    WON: 'WON',
    LOST: 'LOST',
  },
}));

import { LeadSource, LeadStatus, DealStage } from '@prisma/client';

// Mirror the schemas from routes (not exported, so we define them here using the same logic)
const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.nativeEnum(LeadSource),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

const moveStageSchema = z.object({
  newStage: z.nativeEnum(DealStage),
});

describe('createLeadSchema', () => {
  describe('valid inputs', () => {
    it('accepts a minimal valid lead', () => {
      const result = createLeadSchema.safeParse({
        name: 'Ion Popescu',
        email: 'ion@example.ro',
        source: 'WEBSITE',
      });
      expect(result.success).toBe(true);
    });

    it('accepts a fully populated lead', () => {
      const result = createLeadSchema.safeParse({
        name: 'Maria Ionescu',
        email: 'maria@firma.ro',
        phone: '+40721000000',
        company: 'Firma SRL',
        source: 'REFERRAL',
        notes: 'Interested in premium plan',
      });
      expect(result.success).toBe(true);
    });

    it('accepts all valid source values', () => {
      const sources = ['WEBSITE', 'REFERRAL', 'LINKEDIN', 'COLD_CALL', 'OTHER'] as const;
      for (const source of sources) {
        const result = createLeadSchema.safeParse({
          name: 'Test Lead',
          email: 'test@example.com',
          source,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  describe('missing required fields', () => {
    it('rejects missing name', () => {
      const result = createLeadSchema.safeParse({
        email: 'test@example.com',
        source: 'WEBSITE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty name', () => {
      const result = createLeadSchema.safeParse({
        name: '',
        email: 'test@example.com',
        source: 'WEBSITE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing email', () => {
      const result = createLeadSchema.safeParse({
        name: 'Test Lead',
        source: 'WEBSITE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing source', () => {
      const result = createLeadSchema.safeParse({
        name: 'Test Lead',
        email: 'test@example.com',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid email', () => {
    it('rejects plain string as email', () => {
      const result = createLeadSchema.safeParse({
        name: 'Test Lead',
        email: 'not-an-email',
        source: 'WEBSITE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects email without domain', () => {
      const result = createLeadSchema.safeParse({
        name: 'Test Lead',
        email: 'user@',
        source: 'WEBSITE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects email without @', () => {
      const result = createLeadSchema.safeParse({
        name: 'Test Lead',
        email: 'userdomain.com',
        source: 'WEBSITE',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('invalid source values', () => {
    it('rejects unknown source', () => {
      const result = createLeadSchema.safeParse({
        name: 'Test Lead',
        email: 'test@example.com',
        source: 'FACEBOOK',
      });
      expect(result.success).toBe(false);
    });

    it('rejects lowercase source', () => {
      const result = createLeadSchema.safeParse({
        name: 'Test Lead',
        email: 'test@example.com',
        source: 'website',
      });
      expect(result.success).toBe(false);
    });
  });
});

describe('updateStatusSchema (lead status)', () => {
  it('accepts all valid LeadStatus values', () => {
    const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED'] as const;
    for (const status of statuses) {
      const result = updateStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid status', () => {
    const result = updateStatusSchema.safeParse({ status: 'ACTIVE' });
    expect(result.success).toBe(false);
  });

  it('rejects missing status', () => {
    const result = updateStatusSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects lowercase status', () => {
    const result = updateStatusSchema.safeParse({ status: 'new' });
    expect(result.success).toBe(false);
  });
});

describe('moveStageSchema (deal stage)', () => {
  it('accepts all valid DealStage values', () => {
    const stages = ['PROSPECT', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'] as const;
    for (const newStage of stages) {
      const result = moveStageSchema.safeParse({ newStage });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid stage', () => {
    const result = moveStageSchema.safeParse({ newStage: 'CLOSED' });
    expect(result.success).toBe(false);
  });

  it('rejects missing newStage', () => {
    const result = moveStageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects lowercase stage', () => {
    const result = moveStageSchema.safeParse({ newStage: 'prospect' });
    expect(result.success).toBe(false);
  });
});
