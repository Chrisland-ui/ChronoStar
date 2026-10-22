import { describe, it } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import os from 'node:os';
import { createDocsRouter, DEFAULT_OPENAPI_PATH } from './docs.js';

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

  it('resolves the default spec path from the module, not the working directory', async () => {
    const originalCwd = process.cwd();
    process.chdir(os.tmpdir());
    try {
      assert.ok(path.isAbsolute(DEFAULT_OPENAPI_PATH));
      const app = express();
      app.use('/api', createDocsRouter());

      const res = await request(app).get('/api/openapi.json');
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.body.openapi, '3.0.3');
    } finally {
      process.chdir(originalCwd);
    }
  });

  it('lets an explicit openapiPath override the default', async () => {
    const app = express();
    app.use('/api', createDocsRouter(path.join(os.tmpdir(), 'does-not-exist.yaml')));

    const res = await request(app).get('/api/openapi.json');
    assert.strictEqual(res.status, 500);
  });
});
