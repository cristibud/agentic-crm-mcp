import 'dotenv/config';
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { authMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { prisma } from './lib/prisma.js';
import leadsRouter from './routes/leads.js';
import dealsRouter from './routes/deals.js';
import contractsRouter from './routes/contracts.js';
import activitiesRouter from './routes/activities.js';
import settingsRouter from './routes/settings.js';
import { logger } from './lib/logger.js';

const app: Express = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());

// Initialize default settings on startup
async function initializeSettings() {
  try {
    const existingSettings = await prisma.settings.findUnique({
      where: { id: 'config' },
    });

    if (!existingSettings) {
      await prisma.settings.create({
        data: {
          id: 'config',
          llmModel: process.env.LLM_MODEL || 'gpt-4-turbo',
          llmBaseUrl: process.env.LLM_BASE_URL || 'https://api.openai.com/v1',
          llmApiKey: process.env.OPENAI_API_KEY || '',
        },
      });
      logger.info('Default settings initialized');
    }
  } catch (error) {
    logger.error({ error }, 'Failed to initialize settings');
  }
}

// Health check (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Auth protected routes
app.use('/api', authMiddleware);
app.use('/api/leads', leadsRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/pipeline', dealsRouter);
app.use('/api/contracts', contractsRouter);
app.use('/api/activities', activitiesRouter);
app.use('/api/settings', settingsRouter);

app.use(errorHandler);

const server = app.listen(PORT, async () => {
  await initializeSettings();
  logger.info(`API server running on port ${PORT}`);
});

export default app;
