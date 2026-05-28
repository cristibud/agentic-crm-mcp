import { describe, it, expect, vi } from 'vitest';

vi.mock('@prisma/client', () => ({
  DealStage: {
    PROSPECT: 'PROSPECT',
    QUALIFIED: 'QUALIFIED',
    PROPOSAL: 'PROPOSAL',
    NEGOTIATION: 'NEGOTIATION',
    WON: 'WON',
    LOST: 'LOST',
  },
}));

import { isValidTransition, getAllowedTransitions } from '../lib/dealStateMachine.js';
import { DealStage } from '@prisma/client';

describe('isValidTransition', () => {
  describe('valid transitions', () => {
    it('allows PROSPECT → QUALIFIED', () => {
      expect(isValidTransition(DealStage.PROSPECT, DealStage.QUALIFIED)).toBe(true);
    });

    it('allows PROSPECT → LOST', () => {
      expect(isValidTransition(DealStage.PROSPECT, DealStage.LOST)).toBe(true);
    });

    it('allows QUALIFIED → PROPOSAL', () => {
      expect(isValidTransition(DealStage.QUALIFIED, DealStage.PROPOSAL)).toBe(true);
    });

    it('allows QUALIFIED → LOST', () => {
      expect(isValidTransition(DealStage.QUALIFIED, DealStage.LOST)).toBe(true);
    });

    it('allows PROPOSAL → NEGOTIATION', () => {
      expect(isValidTransition(DealStage.PROPOSAL, DealStage.NEGOTIATION)).toBe(true);
    });

    it('allows PROPOSAL → LOST', () => {
      expect(isValidTransition(DealStage.PROPOSAL, DealStage.LOST)).toBe(true);
    });

    it('allows NEGOTIATION → WON', () => {
      expect(isValidTransition(DealStage.NEGOTIATION, DealStage.WON)).toBe(true);
    });

    it('allows NEGOTIATION → LOST', () => {
      expect(isValidTransition(DealStage.NEGOTIATION, DealStage.LOST)).toBe(true);
    });
  });

  describe('invalid transitions — terminal states', () => {
    it('rejects WON → PROSPECT', () => {
      expect(isValidTransition(DealStage.WON, DealStage.PROSPECT)).toBe(false);
    });

    it('rejects WON → QUALIFIED', () => {
      expect(isValidTransition(DealStage.WON, DealStage.QUALIFIED)).toBe(false);
    });

    it('rejects WON → PROPOSAL', () => {
      expect(isValidTransition(DealStage.WON, DealStage.PROPOSAL)).toBe(false);
    });

    it('rejects WON → NEGOTIATION', () => {
      expect(isValidTransition(DealStage.WON, DealStage.NEGOTIATION)).toBe(false);
    });

    it('rejects WON → LOST', () => {
      expect(isValidTransition(DealStage.WON, DealStage.LOST)).toBe(false);
    });

    it('rejects LOST → PROSPECT', () => {
      expect(isValidTransition(DealStage.LOST, DealStage.PROSPECT)).toBe(false);
    });

    it('rejects LOST → QUALIFIED', () => {
      expect(isValidTransition(DealStage.LOST, DealStage.QUALIFIED)).toBe(false);
    });

    it('rejects LOST → WON', () => {
      expect(isValidTransition(DealStage.LOST, DealStage.WON)).toBe(false);
    });
  });

  describe('invalid transitions — skipping stages', () => {
    it('rejects PROSPECT → PROPOSAL (skip QUALIFIED)', () => {
      expect(isValidTransition(DealStage.PROSPECT, DealStage.PROPOSAL)).toBe(false);
    });

    it('rejects PROSPECT → NEGOTIATION (skip multiple stages)', () => {
      expect(isValidTransition(DealStage.PROSPECT, DealStage.NEGOTIATION)).toBe(false);
    });

    it('rejects PROSPECT → WON (skip all stages)', () => {
      expect(isValidTransition(DealStage.PROSPECT, DealStage.WON)).toBe(false);
    });

    it('rejects QUALIFIED → NEGOTIATION (skip PROPOSAL)', () => {
      expect(isValidTransition(DealStage.QUALIFIED, DealStage.NEGOTIATION)).toBe(false);
    });

    it('rejects QUALIFIED → WON (skip multiple stages)', () => {
      expect(isValidTransition(DealStage.QUALIFIED, DealStage.WON)).toBe(false);
    });

    it('rejects PROPOSAL → WON (skip NEGOTIATION)', () => {
      expect(isValidTransition(DealStage.PROPOSAL, DealStage.WON)).toBe(false);
    });
  });

  describe('invalid transitions — going backwards', () => {
    it('rejects QUALIFIED → PROSPECT', () => {
      expect(isValidTransition(DealStage.QUALIFIED, DealStage.PROSPECT)).toBe(false);
    });

    it('rejects PROPOSAL → QUALIFIED', () => {
      expect(isValidTransition(DealStage.PROPOSAL, DealStage.QUALIFIED)).toBe(false);
    });

    it('rejects NEGOTIATION → PROPOSAL', () => {
      expect(isValidTransition(DealStage.NEGOTIATION, DealStage.PROPOSAL)).toBe(false);
    });
  });
});

describe('getAllowedTransitions', () => {
  it('returns [QUALIFIED, LOST] for PROSPECT', () => {
    expect(getAllowedTransitions(DealStage.PROSPECT)).toEqual([
      DealStage.QUALIFIED,
      DealStage.LOST,
    ]);
  });

  it('returns [PROPOSAL, LOST] for QUALIFIED', () => {
    expect(getAllowedTransitions(DealStage.QUALIFIED)).toEqual([
      DealStage.PROPOSAL,
      DealStage.LOST,
    ]);
  });

  it('returns [NEGOTIATION, LOST] for PROPOSAL', () => {
    expect(getAllowedTransitions(DealStage.PROPOSAL)).toEqual([
      DealStage.NEGOTIATION,
      DealStage.LOST,
    ]);
  });

  it('returns [WON, LOST] for NEGOTIATION', () => {
    expect(getAllowedTransitions(DealStage.NEGOTIATION)).toEqual([
      DealStage.WON,
      DealStage.LOST,
    ]);
  });

  it('returns [] for WON (terminal)', () => {
    expect(getAllowedTransitions(DealStage.WON)).toEqual([]);
  });

  it('returns [] for LOST (terminal)', () => {
    expect(getAllowedTransitions(DealStage.LOST)).toEqual([]);
  });
});
