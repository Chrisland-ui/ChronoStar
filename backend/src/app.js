import express from 'express';
import cors from 'cors';
import pinoHttp from 'pino-http';
import { logger } from './logger.js';
import { genReqId, globalLimiter } from './middleware.js';
import { ErrorCode, createErrorHandler, notFoundHandler } from './errors.js';
import { createSchedulesRouter } from './routes/schedules.js';
import { createStreamsRouter, createDCARouter } from './routes/streams.js';
import { createEventsRouter } from './routes/events.js';
import { createStatsRouter } from './routes/stats.js';
import { createDocsRouter } from './routes/docs.js';
import { createLiveStreamRouter } from './routes/live-stream.js';
import { EventStore } from './store.js';
import { createEventStore } from './store.js';

/**
 * @param {object} [options]
 * @param {string[]} [options.configProblems] Configuration problems found at startup; when
 *   non-empty, `/healthz` reports 503 instead of a healthy status.
 */
export function createApp(clients, log = logger, store = createEventStore(), options = {}) {
  const configProblems = options.configProblems ?? [];
  const app = express();

  app.use(cors());
  app.use(pinoHttp({
    logger: log,
    genReqId,
  }));
  app.use(express.json());
  app.use(globalLimiter);

  app.use('/api', createDocsRouter());
  app.use('/api/stream', createLiveStreamRouter(clients, log));
  app.use('/api/schedules', createSchedulesRouter(clients.vault.client, clients.vault.contractId));
  app.use('/api/streams', createStreamsRouter(clients.stream.client, clients.stream.contractId));
  app.use('/api/dca', createDCARouter(clients.dca.client, clients.dca.contractId));
  app.use('/api/events', createEventsRouter(clients, log, store));
  app.use('/api/stats', createStatsRouter(clients));

  app.get('/healthz', (_req, res) => {
    if (configProblems.length > 0) {
      return res.status(503).json({
        status: 'error',
        code: ErrorCode.INVALID_CONFIG,
        problems: configProblems,
      });
    }
    return res.json({ status: 'ok' });
  });

  app.use(notFoundHandler);

  app.use(createErrorHandler(log));

  return app;
}
