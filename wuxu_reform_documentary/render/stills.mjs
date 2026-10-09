// Render individual frames to JPEG for visual checks.
// usage: node render/stills.mjs <outDir> <t1> [t2 ...]   (times in seconds, or SceneId@localTime)
import fs from 'node:fs';
import path from 'node:path';
import { startServer, openPage, ROOT } from './common.mjs';

const [outDir, ...times] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });
const { srv, port } = await startServer();
const { browser, page } = await openPage(port);
const TL = await page.evaluate(() => window.TL);
for (const spec of times) {
  let t = parseFloat(spec);
  if (spec.includes('@')) {
    const [id, lt] = spec.split('@');
    const sc = TL.scenes.find((s) => s.id.startsWith(id));
    t = sc.start + (lt.endsWith('%') ? (parseFloat(lt) / 100) * sc.dur : parseFloat(lt));
  }
  const f = Math.round(t * 30);
  const t0 = Date.now();
  const url = await page.evaluate((f) => window.renderFrameJPEG(f, 0.9), f);
  const ms = Date.now() - t0;
  const name = `${spec.replace(/[@%]/g, '_')}.jpg`;
  fs.writeFileSync(path.join(outDir, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log(`${name}  t=${t.toFixed(2)}  ${ms}ms`);
}
await browser.close();
srv.close();
