import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';
import { LeadSource, LeadStatus, ActivityType, DealStage } from '@prisma/client';

const router: import("express").Router = Router();

const createLeadSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.nativeEnum(LeadSource),
  notes: z.string().optional(),
});

const updateLeadSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  source: z.nativeEnum(LeadSource).optional(),
  notes: z.string().optional(),
  score: z.number().int().min(0).max(100).optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus),
});

// GET /api/leads
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, source, search, cursor, limit } = req.query;
    const take = Math.min(Number(limit) || 20, 100);

    const where: Record<string, unknown> = {};
    if (status) where.status = status as LeadStatus;
    if (source) where.source = source as LeadSource;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { company: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const leads = await prisma.lead.findMany({
      where,
      take,
      skip: cursor ? 1 : 0,
      cursor: cursor ? { id: cursor as string } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    const nextCursor = leads.length === take ? leads[leads.length - 1].id : null;
    res.json({ data: leads, nextCursor });
  } catch (err) {
    next(err);
  }
});

// POST /api/leads
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createLeadSchema.parse(req.body);
    const user = (req as Request & { user: { id: string } }).user;

    const lead = await prisma.lead.create({
      data: { ...data, ownerId: user.id },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.LEAD_CREATED,
        description: `Lead created: ${lead.name}`,
        userId: user.id,
        leadId: lead.id,
      },
    });

    res.status(201).json(lead);
  } catch (err) {
    next(err);
  }
});

// GET /api/leads/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: req.params.id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        deals: true,
        activities: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }
    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// PUT /api/leads/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateLeadSchema.parse(req.body);
    const user = (req as Request & { user: { id: string } }).user;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data,
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.LEAD_UPDATED,
        description: `Lead updated: ${lead.name}`,
        userId: user.id,
        leadId: lead.id,
        metadata: data as object,
      },
    });

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/leads/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.lead.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// PUT /api/leads/:id/status
router.put('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const user = (req as Request & { user: { id: string } }).user;

    const lead = await prisma.lead.update({
      where: { id: req.params.id },
      data: { status },
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.LEAD_UPDATED,
        description: `Lead status changed to ${status}`,
        userId: user.id,
        leadId: lead.id,
        metadata: { status } as object,
      },
    });

    res.json(lead);
  } catch (err) {
    next(err);
  }
});

// POST /api/leads/:id/convert
router.post('/:id/convert', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as Request & { user: { id: string } }).user;

    const lead = await prisma.lead.findUnique({ where: { id: req.params.id } });
    if (!lead) {
      res.status(404).json({ error: 'Lead not found' });
      return;
    }

    const deal = await prisma.deal.create({
      data: {
        title: `Deal - ${lead.name}`,
        value: 0,
        leadId: lead.id,
        ownerId: user.id,
        stage: DealStage.PROSPECT,
      },
      include: { lead: true },
    });

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: LeadStatus.CONVERTED },
    });

    await prisma.activity.create({
      data: {
        type: ActivityType.DEAL_CREATED,
        description: `Deal created from lead: ${lead.name}`,
        userId: user.id,
        leadId: lead.id,
        dealId: deal.id,
      },
    });

    res.status(201).json(deal);
  } catch (err) {
    next(err);
  }
});

export default router;
