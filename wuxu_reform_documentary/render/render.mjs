// Chunked, resumable, parallel frame renderer.
// Each worker owns a headless Chromium; frames are rendered deterministically from
// absolute time and streamed as JPEG into an ffmpeg process per chunk (no full-film
// buffering in memory). Finished chunks are skipped on re-run.
//
// usage: node render/render.mjs [--from 0] [--to <sec>] [--workers 3] [--chunk 150] [--out build/chunks]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { startServer, openPage, ROOT } from './common.mjs';

const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const TL = JSON.parse(fs.readFileSync(path.join(ROOT, 'build', 'timeline.json'), 'utf8'));
const FPS = TL.fps;
const from = Math.round(parseFloat(args.from ?? 0) * FPS);
const to = Math.round(parseFloat(args.to ?? TL.total) * FPS);
const workers = parseInt(args.workers ?? 3, 10);
const chunk = parseInt(args.chunk ?? 150, 10);
const outDir = path.resolve(ROOT, args.out ?? 'build/chunks');
const quality = parseFloat(args.q ?? 0.93);
fs.mkdirSync(outDir, { recursive: true });

const chunks = [];
for (let f = from, i = Math.floor(from / chunk); f < to; i++) {
  const a = Math.max(f, i * chunk), b = Math.min(to, (i + 1) * chunk);
  if (b > a) chunks.push({ i, a, b, file: path.join(outDir, `c${String(i).padStart(4, '0')}_${a}_${b}.mp4`) });
  f = b;
}
const todo = chunks.filter((c) => !fs.existsSync(c.file));
console.log(`frames ${from}-${to} (${((to - from) / FPS).toFixed(1)}s), ${chunks.length} chunks, ${todo.length} to render, ${workers} workers`);

function encodeChunk(c, page) {
  return new Promise(async (resolve, reject) => {
    const tmp = c.file.replace('.mp4', '.part.mp4');
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-threads', '2', tmp]);
    let err = '';
    ff.stderr.on('data', (d) => (err += d));
    ff.on('close', (code) => {
      if (code === 0) { fs.renameSync(tmp, c.file); resolve(); } else reject(new Error('ffmpeg failed: ' + err));
    });
    try {
      for (let f = c.a; f < c.b; f++) {
        const url = await page.evaluate(([f, q]) => window.renderFrameJPEG(f, q), [f, quality]);
        const buf = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
        if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
      }
      ff.stdin.end();
    } catch (e) {
      ff.kill();
      reject(e);
    }
  });
}

const { srv, port } = await startServer();
const queue = [...todo];
let done = 0;
const t0 = Date.now();
async function worker(id) {
  let ctx = null;
  while (queue.length) {
    const c = queue.shift();
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        if (!ctx) ctx = await openPage(port);
        const ts = Date.now();
        await encodeChunk(c, ctx.page);
        done++;
        const el = (Date.now() - t0) / 1000;
        console.log(`[w${id}] chunk ${c.i} (${c.a}-${c.b}) ${((Date.now() - ts) / 1000).toFixed(1)}s | ${done}/${todo.length} | elapsed ${el.toFixed(0)}s eta ${((el / done) * (todo.length - done)).toFixed(0)}s`);
        break;
      } catch (e) {
        console.error(`[w${id}] chunk ${c.i} attempt ${attempt} failed: ${e.message}`);
        try { await ctx?.browser.close(); } catch {}
        ctx = null;
        if (attempt === 2) throw e;
      }
    }
  }
  try { await ctx?.browser.close(); } catch {}
}
await Promise.all(Array.from({ length: Math.min(workers, Math.max(1, todo.length)) }, (_, i) => worker(i)));
srv.close();
// concat list in order
const list = chunks.map((c) => `file '${c.file}'`).join('\n');
fs.writeFileSync(path.join(outDir, `list_${from}_${to}.txt`), list + '\n');
console.log('all chunks done ->', path.join(outDir, `list_${from}_${to}.txt`));
