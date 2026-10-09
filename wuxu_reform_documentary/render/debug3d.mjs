// usage: node render/debug3d.mjs outDir Name@t [Name@t ...]
import fs from 'node:fs';
import path from 'node:path';
import { startServer, openPage } from './common.mjs';
const [outDir, ...specs] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const { srv, port } = await startServer();
const { browser, page } = await openPage(port);
for (const sp of specs) {
  const [name, t] = sp.split('@');
  const t0 = Date.now();
  const url = await page.evaluate(([n, t]) => window.debug3d(n, t), [name, parseFloat(t)]);
  fs.writeFileSync(path.join(outDir, `${name}_${t}.jpg`), Buffer.from(url.split(',')[1], 'base64'));
  console.log(sp, Date.now() - t0, 'ms');
}
await browser.close();
srv.close();
