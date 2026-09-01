import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, normalize, resolve } from 'node:path';
import { defineConfig, type Connect } from 'vite';

const MATERIALS_DIR = resolve(process.env.URBE_MATERIALS_DIR ?? new URL('../materials/', import.meta.url).pathname);
const MIME: Record<string, string> = { '.json': 'application/json', '.png': 'image/png' };

/** The preview shows a finished textured building, so it serves the materials box read-only. */
function serveMaterials() {
  const handler: Connect.NextHandleFunction = (req, res, next) => {
    const path = normalize(decodeURIComponent((req.url ?? '/').split('?')[0] as string));
    const file = join(MATERIALS_DIR, path);
    const ext = path.slice(path.lastIndexOf('.'));
    if (!file.startsWith(MATERIALS_DIR) || !MIME[ext] || !existsSync(file) || !statSync(file).isFile()) {
      next();
      return;
    }
    res.setHeader('content-type', MIME[ext] as string);
    res.end(readFileSync(file));
  };
  return {
    name: 'urbe-materials',
    configureServer(server: { middlewares: Connect.Server }) {
      server.middlewares.use('/materials', handler);
    },
  };
}

export default defineConfig({
  server: { port: 5174 },
  plugins: [serveMaterials()],
});
