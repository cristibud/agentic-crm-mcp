import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV !== 'production'
        ? [{ emit: 'stdout', level: 'error' }]
        : [],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
