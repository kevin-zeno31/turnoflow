import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { openStore, QueueError } from './store.js';

const root = path.dirname(fileURLToPath(import.meta.url));
const assets = { '/': ['index.html','text/html; charset=utf-8'], '/app.js': ['app.js','text/javascript; charset=utf-8'], '/style.css': ['style.css','text/css; charset=utf-8'], '/favicon.svg': ['favicon.svg','image/svg+xml'] };

export function createApp(store) {
  return http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(value));
    };
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const host = req.headers.host;
    const validHosts = [`127.0.0.1:${req.socket.localPort}`, `localhost:${req.socket.localPort}`];
    if (!validHosts.includes(host)) return send(403, { error: 'Acceso local únicamente.' });
    try {
      const url = new URL(req.url, `http://${host}`);
      if (req.method === 'GET' && url.pathname === '/api/queue') return send(200, store.snapshot());
      if (req.method === 'POST' && url.pathname.startsWith('/api/')) {
        if ((req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') return send(403, { error: 'Origen no permitido.' });
        if (req.headers['content-type']?.split(';')[0] !== 'application/json') return send(415, { error: 'Se requiere JSON.' });
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 4096) return send(413, { error: 'Solicitud demasiado grande.' });
        }
        let body;
        try { body = JSON.parse(raw); } catch { return send(400, { error: 'JSON inválido.' }); }
        if (!body || typeof body !== 'object' || Array.isArray(body)) return send(400, { error: 'Solicitud inválida.' });
        if (url.pathname === '/api/tickets') {
          if (typeof body.requestKey !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(body.requestKey)) return send(400, { error: 'Identificador de solicitud inválido.' });
          return send(201, store.create(body.requestKey));
        }
        if (url.pathname === '/api/call') return send(200, store.callNext());
        if (url.pathname === '/api/finish') {
          if (!Number.isSafeInteger(body.id) || body.id < 1) return send(400, { error: 'Turno inválido.' });
          return send(200, store.finish(body.id));
        }
      }
      if (req.method === 'GET' && assets[url.pathname]) {
        const [filename, type] = assets[url.pathname];
        const content = await readFile(path.join(root, 'public', filename));
        res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
        return res.end(content);
      }
      send(404, { error: 'Ruta no encontrada.' });
    } catch (error) {
      if (!(error instanceof QueueError)) console.error(error);
      send(error instanceof QueueError ? error.status : 500, { error: error instanceof QueueError ? error.message : 'No se pudo procesar la solicitud.' });
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  mkdirSync(path.join(root, 'data'), { recursive: true });
  const store = openStore(path.join(root, 'data', 'turnoflow.sqlite'));
  const server = createApp(store);
  const port = Number(process.env.PORT || 3000);
  server.listen(port, '127.0.0.1', () => console.log(`TurnoFlow listo: http://localhost:${port}\nDetener: Ctrl+C. Los turnos se conservan en data/turnoflow.sqlite.`));
  server.on('error', error => { console.error(error.code === 'EADDRINUSE' ? 'El puerto está ocupado. Cierra la otra instancia o configura PORT.' : error.message); store.close(); process.exitCode = 1; });
  const stop = () => server.close(() => { store.close(); process.exit(0); });
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
}
