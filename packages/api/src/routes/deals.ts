import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { DealStage, ActivityType } from '@prisma/client';
import { isValidTransition } from '../lib/dealStateMachine.js';

const router: import("express").Router = Router();

const createDealSchema = z.object({
  title: z.string().min(1),
  leadId: z.string().min(1),
  value: z.number().min(0),
  probability: z.number().int().min(0).max(100).optional(),
});

const moveStageSchema = z.object({
  newStage: z.nativeEnum(DealStage),
});

// GET /api/deals
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { stage, ownerId, leadId } = req.query;
    const where: Record<string, unknown> = {};
    if (stage) where.stage = stage as DealStage;
    if (ownerId) where.ownerId = ownerId as string;
    if (leadId) where.leadId = leadId as string;

    const deals = await prisma.deal.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, email: true, company: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(deals);
  } catch (err) {
    next(err);
  }
});

// POST /api/deals
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createDealSchema.parse(req.body);
    const user = (req as Request & { user: { id: string } }).user;

    const deal = await prisma.deal.create({
      data: { ...data, ownerId: user.id },
      include: { lead: true },
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.DEAL_CREATED,
        description: `Deal created: ${deal.title}`,
        userId: user.id,
        dealId: deal.id,
        leadId: data.leadId,
      },
    });

    res.status(201).json(deal);
  } catch (err) {
    next(err);
  }
});

// GET /api/deals/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deal = await prisma.deal.findUnique({
      where: { id: req.params.id },
      include: {
        lead: true,
        owner: { select: { id: true, name: true } },
        contracts: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }
    res.json(deal);
  } catch (err) {
    next(err);
  }
});

// PUT /api/deals/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updateData = createDealSchema.partial().parse(req.body);
    
    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        lead: { select: { id: true, name: true, email: true, company: true } },
        owner: { select: { id: true, name: true } },
      },
    });

    res.json(deal);
  } catch (err) {
    next(err);
  }
});

// PUT /api/deals/:id/stage
router.put('/:id/stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newStage } = moveStageSchema.parse(req.body);
    const user = (req as Request & { user: { id: string } }).user;

    const existing = await prisma.deal.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    if (!isValidTransition(existing.stage, newStage)) {
      res.status(400).json({
        error: `Invalid stage transition from ${existing.stage} to ${newStage}`,
      });
      return;
    }

    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        stage: newStage,
        closedAt: newStage === DealStage.WON || newStage === DealStage.LOST ? new Date() : null,
      },
      include: { lead: true },
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.DEAL_STAGE_CHANGED,
        description: `Deal stage changed from ${existing.stage} to ${newStage}`,
        userId: user.id,
        dealId: deal.id,
        metadata: { from: existing.stage, to: newStage } as object,
      },
    });

    res.json(deal);
  } catch (err) {
    next(err);
  }
});

// GET /api/pipeline/summary
router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stages = Object.values(DealStage);
    const summary = await Promise.all(
      stages.map(async (stage) => {
        const deals = await prisma.deal.findMany({ where: { stage } });
        return {
          stage,
          count: deals.length,
          totalValue: deals.reduce((sum, d) => sum + d.value, 0),
        };
      }),
    );
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
