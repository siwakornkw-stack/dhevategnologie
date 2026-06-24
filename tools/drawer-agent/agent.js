'use strict';

// DhevaSuite cash-drawer agent.
// Runs on the cashier PC. The POS browser POSTs /kick after a cash sale;
// this writes the ESC/POS drawer-kick pulse straight to the Windows printer,
// which fires the drawer wired into its RJ11 port.

const http = require('http');
const { execFile } = require('child_process');
const path = require('path');

const PORT = Number(process.env.DRAWER_PORT || 7654);
const PRINTER = process.env.DRAWER_PRINTER || 'XP-Q80I';
const ALLOWED_ORIGIN = process.env.DRAWER_ORIGIN || '*';
const DRAWER_PIN = process.env.DRAWER_PIN === '1' ? 1 : 0; // 0 = connector pin 2, 1 = pin 5
const PS1 = path.join(__dirname, 'raw-print.ps1');

// ESC p m t1 t2 — generate drawer-kick pulse. t1/t2 = on/off time x2ms.
const KICK = Buffer.from([0x1b, 0x70, DRAWER_PIN, 0x19, 0xfa]).toString('base64');

function setCors(req, res) {
  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN === '*') res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin === ALLOWED_ORIGIN) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function kick() {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', PS1, '-Printer', PRINTER, '-Base64', KICK],
      { timeout: 8000, windowsHide: true },
      (err, stdout, stderr) => {
        if (err) return reject(new Error((stderr || '').trim() || err.message));
        resolve((stdout || '').trim());
      },
    );
  });
}

const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, printer: PRINTER, pin: DRAWER_PIN }));
  }

  if (req.method === 'POST' && req.url === '/kick') {
    try {
      await kick();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      console.error('[drawer-agent] kick failed:', e.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: String(e.message || e) }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[drawer-agent] listening on http://127.0.0.1:${PORT}  printer="${PRINTER}"  pin=${DRAWER_PIN}`);
});
