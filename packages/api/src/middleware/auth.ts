import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    let apiKey: string | undefined;

    const headerKey = req.headers['x-api-key'];
    if (headerKey && typeof headerKey === 'string') {
      apiKey = headerKey;
    } else {
      const authHeader = req.headers['authorization'];
      if (authHeader && authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      }
    }

    if (!apiKey) {
      res.status(401).json({ error: 'Unauthorized: missing API key' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { apiKey } });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized: invalid API key' });
      return;
    }

    (req as Request & { user: typeof user }).user = user;
    next();
  } catch (err) {
    logger.error(err, 'Auth middleware error');
    res.status(500).json({ error: 'Internal server error' });
  }
}
