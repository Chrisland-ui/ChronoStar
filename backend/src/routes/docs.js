import { Router } from 'express';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

/** The spec lives next to `src/`; resolve it from this module, not the working directory. */
export const DEFAULT_OPENAPI_PATH = fileURLToPath(new URL('../../openapi.yaml', import.meta.url));

export function createDocsRouter(openapiPath = DEFAULT_OPENAPI_PATH) {
  const router = Router();

  router.get('/openapi.json', (req, res, next) => {
    try {
      const fileContent = fs.readFileSync(openapiPath, 'utf8');
      const doc = yaml.load(fileContent);

      const protocol = req.protocol || 'http';
      const host = req.get('host') || 'localhost:3001';
      doc.servers = [
        { url: `${protocol}://${host}`, description: 'Current environment' },
        ...(doc.servers || []),
      ];

      res.setHeader('Content-Type', 'application/json');
      res.json(doc);
    } catch (err) {
      next(err);
    }
  });

  router.get('/docs', (req, res) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>ChronoStar API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    window.onload = () => {
      SwaggerUIBundle({
        url: '/api/openapi.json',
        dom_id: '#swagger-ui',
      });
    };
  </script>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  });

  return router;
}
