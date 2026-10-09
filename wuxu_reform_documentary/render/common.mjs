// Shared helpers for the headless render tools: static file server + browser page setup.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.ttf': 'font/ttf', '.otf': 'font/otf', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm',
};

export function startServer() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let p = path.join(ROOT, url.startsWith('/node_modules/') ? '' : 'web', url);
      if (url === '/' || url === '') p = path.join(ROOT, 'web', 'index.html');
      if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

export async function openPage(port) {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-accelerated-2d-canvas',
      '--js-flags=--max-old-space-size=4096'],
  });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[page]', m.text()); });
  page.on('pageerror', (e) => console.error('[pageerror]', e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.__ready || window.__error, null, { timeout: 300000 });
  const err = await page.evaluate(() => window.__error);
  if (err) throw new Error(err);
  return { browser, page };
}
