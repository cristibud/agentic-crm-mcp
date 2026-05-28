import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';

const router: import("express").Router = Router();

// GET /api/activities
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, dealId, limit } = req.query;
    const take = Math.min(Number(limit) || 50, 200);

    const where: Record<string, unknown> = {};
    if (leadId) where.leadId = leadId as string;
    if (dealId) where.dealId = dealId as string;

    const activities = await prisma.activity.findMany({
      where,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true } },
        lead: { select: { id: true, name: true } },
        deal: { select: { id: true, title: true } },
      },
    });

    res.json(activities);
  } catch (err) {
    next(err);
  }
});

export default router;
