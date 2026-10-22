import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { createDocsRouter } from './docs.js';

describe('Docs Router', () => {
  const openapiPath = path.join(process.cwd(), 'openapi.yaml');

  it('GET /api/openapi.json returns valid openapi spec with server host', async () => {
    const app = express();
    app.use('/api', createDocsRouter(openapiPath));

    const res = await request(app).get('/api/openapi.json').set('Host', 'test.example.com');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'].includes('application/json'), true);
    assert.strictEqual(res.body.openapi, '3.0.3');
    assert.strictEqual(res.body.servers[0].url, 'http://test.example.com');
  });

  it('GET /api/docs returns Swagger UI html page', async () => {
    const app = express();
    app.use('/api', createDocsRouter(openapiPath));

    const res = await request(app).get('/api/docs');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.headers['content-type'].includes('text/html'), true);
    assert.strictEqual(res.text.includes('SwaggerUIBundle'), true);
  });

  it('uses the trusted forwarded HTTPS origin', async () => {
    const app = express();
    app.set('trust proxy', 1);
    app.use('/api', createDocsRouter(openapiPath));

    const res = await request(app)
      .get('/api/openapi.json')
      .set('Host', 'internal:3001')
      .set('X-Forwarded-Proto', 'https')
      .set('X-Forwarded-Host', 'api.chronostar.example');

    assert.strictEqual(res.body.servers[0].url, 'https://api.chronostar.example');
  });

  it('prefers an explicitly configured public URL', async () => {
    const app = express();
    app.use('/api', createDocsRouter(openapiPath, 'https://public.example'));

    const res = await request(app).get('/api/openapi.json');
    assert.strictEqual(res.body.servers[0].url, 'https://public.example');
  });
});
