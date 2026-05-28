import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { ContractStatus, ActivityType } from '@prisma/client';
import PDFDocument from 'pdfkit';

const router: import("express").Router = Router();

const createContractSchema = z.object({
  dealId: z.string().min(1),
  content: z.string().optional(),
  template: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(ContractStatus),
});

// GET /api/contracts
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, dealId } = req.query;
    const where: Record<string, unknown> = {};
    if (status) where.status = status as ContractStatus;
    if (dealId) where.dealId = dealId as string;

    const contracts = await prisma.contract.findMany({
      where,
      include: { deal: { include: { lead: { select: { id: true, name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json(contracts);
  } catch (err) {
    next(err);
  }
});

// POST /api/contracts
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = createContractSchema.parse(req.body);
    const user = (req as Request & { user: { id: string } }).user;

    const deal = await prisma.deal.findUnique({
      where: { id: data.dealId },
      include: { lead: true },
    });
    if (!deal) {
      res.status(404).json({ error: 'Deal not found' });
      return;
    }

    const defaultContent = data.content ?? data.template ??
      `Contract de prestari servicii\n\nDeal: ${deal.title}\nClient: ${deal.lead.name}\nValoare: ${deal.value} RON\n\nTermeni si conditii standard.`;

    // Retry loop handles the unlikely race on the unique contract number
    let contract: Awaited<ReturnType<typeof prisma.contract.create>> | null = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const count = await prisma.contract.count();
        const number = `CNT-${String(count + 1).padStart(3, '0')}`;
        contract = await prisma.contract.create({
          data: { number, dealId: data.dealId, content: defaultContent },
          include: { deal: { include: { lead: true } } },
        });
        break;
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          continue;
        }
        throw e;
      }
    }
    if (!contract) throw new Error('Failed to generate unique contract number');

    await prisma.activity.create({
      data: {
        type: ActivityType.CONTRACT_CREATED,
        description: `Contract ${contract.number} created`,
        userId: user.id,
        dealId: data.dealId,
        contractId: contract.id,
      },
    });

    res.status(201).json(contract);
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: { deal: { include: { lead: true } } },
    });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }
    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// PUT /api/contracts/:id/status
router.put('/:id/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status } = updateStatusSchema.parse(req.body);
    const user = (req as Request & { user: { id: string } }).user;

    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        status,
        signedAt: status === ContractStatus.SIGNED ? new Date() : undefined,
      },
      include: { deal: true },
    });

    await prisma.activity.create({
      data: {
        type: status === ContractStatus.SIGNED ? ActivityType.CONTRACT_SIGNED : ActivityType.CONTRACT_CREATED,
        description: `Contract ${contract.number} status changed to ${status}`,
        userId: user.id,
        dealId: contract.dealId,
        contractId: contract.id,
      },
    });

    res.json(contract);
  } catch (err) {
    next(err);
  }
});

// GET /api/contracts/:id/pdf
router.get('/:id/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: { deal: { include: { lead: true } } },
    });
    if (!contract) {
      res.status(404).json({ error: 'Contract not found' });
      return;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="contract-${contract.number}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).text('CONTRACT', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Numar: ${contract.number}`);
    doc.text(`Status: ${contract.status}`);
    doc.text(`Data: ${contract.createdAt.toLocaleDateString('ro-RO')}`);
    doc.moveDown();
    doc.text(`Deal: ${contract.deal.title}`);
    doc.text(`Client: ${contract.deal.lead.name}`);
    doc.text(`Email: ${contract.deal.lead.email}`);
    if (contract.deal.lead.company) {
      doc.text(`Companie: ${contract.deal.lead.company}`);
    }
    doc.moveDown();
    doc.fontSize(14).text('Continut Contract', { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(contract.content, { lineGap: 4 });

    if (contract.signedAt) {
      doc.moveDown(2);
      doc.fontSize(12).text(`Semnat la: ${contract.signedAt.toLocaleDateString('ro-RO')}`);
    }

    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
