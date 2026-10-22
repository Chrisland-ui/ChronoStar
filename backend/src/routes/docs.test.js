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

  it('documents the rate limits and the headers they emit', async () => {
    const app = express();
    app.use('/api', createDocsRouter(openapiPath));

    const res = await request(app).get('/api/openapi.json');
    assert.match(res.body.info.description, /Rate limits/);
    for (const header of ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After']) {
      assert.ok(res.body.info.description.includes(header), header);
    }
    for (const response of ['RateLimited', 'RateLimitedAddress']) {
      const headers = Object.keys(res.body.components.responses[response].headers);
      assert.deepStrictEqual(headers.sort(), ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After']);
    }
  });
});
