import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function cashfreeLocalDevPlugin() {
  return {
    name: 'gayatri-cashfree-local-dev',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const reqUrl = String(req.url || '').split('?')[0];
        const isCashfreeRoute =
          reqUrl.startsWith('/api/payments/cashfree/') ||
          reqUrl.startsWith('/api/admin/cashfree/') ||
          reqUrl.startsWith('/.netlify/functions/cashfree');

        if (!isCashfreeRoute) {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.end();
          return;
        }

        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', async () => {
          try {
            const rawBody = Buffer.concat(chunks).toString('utf8');
            // @ts-ignore - dynamically load ESM serverless function in Vite dev Node runtime
            const fnMod: any = await import('./netlify/functions/cashfree.mjs');
            const result = await fnMod.handler({
              httpMethod: req.method || 'POST',
              path: reqUrl,
              body: rawBody,
            });
            res.statusCode = result.statusCode || 200;
            Object.entries(result.headers || {}).forEach(([k, v]) => {
              res.setHeader(k, String(v));
            });
            res.setHeader('Content-Type', 'application/json');
            res.end(result.body || '{}');
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(
              JSON.stringify({
                error: err?.message || 'Failed to invoke local Cashfree payment handler.',
              })
            );
          }
        });
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), cashfreeLocalDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
