import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const router: Router = Router();

const updateSettingsSchema = z.object({
  llmModel: z.string().min(1).optional(),
  llmBaseUrl: z.string().url().optional(),
  llmApiKey: z.string().min(1).optional(),
});

// GET /api/settings
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    let settings = await prisma.settings.findUnique({
      where: { id: 'config' },
    });

    // If settings don't exist, create default ones
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'config',
          llmModel: 'gpt-4-turbo',
          llmBaseUrl: 'https://api.openai.com/v1',
          llmApiKey: process.env.OPENAI_API_KEY || '',
        },
      });
    }

    // For backend services (check X-API-Key header), return full API key
    // For other clients, mask the API key
    const isBackendService = req.get('X-API-Key') === process.env.API_KEY;
    const apiKeyValue = isBackendService ? settings.llmApiKey : (settings.llmApiKey ? '***' : undefined);

    res.json({
      llmModel: settings.llmModel,
      llmBaseUrl: settings.llmBaseUrl,
      llmApiKey: apiKeyValue,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    logger.error({ error }, 'Failed to fetch settings');
    next(error);
  }
});

// PUT /api/settings
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = updateSettingsSchema.parse(req.body);

    let settings = await prisma.settings.findUnique({
      where: { id: 'config' },
    });

    // If settings don't exist, create them
    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'config',
          llmModel: data.llmModel || 'gpt-4-turbo',
          llmBaseUrl: data.llmBaseUrl || 'https://api.openai.com/v1',
          llmApiKey: data.llmApiKey || process.env.OPENAI_API_KEY || '',
        },
      });
    } else {
      // Update existing settings
      settings = await prisma.settings.update({
        where: { id: 'config' },
        data: {
          ...(data.llmModel && { llmModel: data.llmModel }),
          ...(data.llmBaseUrl && { llmBaseUrl: data.llmBaseUrl }),
          ...(data.llmApiKey && { llmApiKey: data.llmApiKey }),
        },
      });
    }

    logger.info('Settings updated successfully');

    // Signal MCP server to reload settings
    try {
      const mcpServerUrl = process.env.MCP_SERVER_URL || 'http://localhost:3002';
      await fetch(`${mcpServerUrl}/restart`, { method: 'POST' });
      logger.info('MCP server restart signal sent');
    } catch (error) {
      logger.warn({ error }, 'Failed to signal MCP server restart');
      // Don't fail the request if MCP restart fails
    }

    // Don't expose the full API key in the response
    res.json({
      llmModel: settings.llmModel,
      llmBaseUrl: settings.llmBaseUrl,
      llmApiKey: settings.llmApiKey ? '***' : undefined,
      updatedAt: settings.updatedAt,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid settings data', details: error.errors });
    }
    logger.error({ error }, 'Failed to update settings');
    next(error);
  }
});

export default router;
