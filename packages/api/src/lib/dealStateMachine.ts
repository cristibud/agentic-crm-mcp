import { DealStage } from '@prisma/client';

const transitions: Record<DealStage, DealStage[]> = {
  [DealStage.PROSPECT]: [DealStage.QUALIFIED, DealStage.LOST],
  [DealStage.QUALIFIED]: [DealStage.PROPOSAL, DealStage.LOST],
  [DealStage.PROPOSAL]: [DealStage.NEGOTIATION, DealStage.LOST],
  [DealStage.NEGOTIATION]: [DealStage.WON, DealStage.LOST],
  [DealStage.WON]: [],
  [DealStage.LOST]: [],
};

export function isValidTransition(from: DealStage, to: DealStage): boolean {
  return transitions[from].includes(to);
}

export function getAllowedTransitions(from: DealStage): DealStage[] {
  return transitions[from];
}
