import express from "express";
import cors from "cors";
import morgan from "morgan";
import Database from "better-sqlite3";
import { nanoid } from "nanoid";

const PORT = process.env.PORT || 5055;
const API_KEY = process.env.API_KEY || "dev-123";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://127.0.0.1:4000";
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || '';
const N8N_SHARED_SECRET = process.env.N8N_SHARED_SECRET || '';

const db = new Database("./data.db");
db.pragma("journal_mode = WAL");
db.exec(`
CREATE TABLE IF NOT EXISTS emails (
  id TEXT PRIMARY KEY,
  subject TEXT,
  recipient TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  email_id TEXT NOT NULL,
  type TEXT NOT NULL,    -- 'open' | 'click'
  timestamp TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  FOREIGN KEY (email_id) REFERENCES emails (id)
);
`);

// Índices para rendimiento de stats/summary
db.exec(`
CREATE INDEX IF NOT EXISTS idx_emails_sent_at ON emails(sent_at);
CREATE INDEX IF NOT EXISTS idx_events_email_type_time ON events(email_id, type, timestamp);
`);

const app = express();
// trust proxy para que req.protocol sea https detrás del proxy
app.set('trust proxy', true);
app.use(morgan("tiny"));
app.use(express.json());
app.use(cors({ origin: FRONTEND_ORIGIN }));

// Devuelve la base pública para construir URLs absolutas
function getPublicBaseUrl(req) {
  const fromEnv = process.env.PUBLIC_BASE_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');
  const proto = (req.headers['x-forwarded-proto'] || req.protocol || 'http').toString().split(',')[0].trim();
  const host  = (req.headers['x-forwarded-host']  || req.headers.host || '').toString().split(',')[0].trim();
  return `${proto}://${host}`;
}

// Ruta raíz opcional para sanity check
app.get("/", (_req, res) => res.type("text/plain").send("Email Tracker Backend OK"));

// HEALTH (primera, sin dependencias)
app.get("/api/health", (_req, res) => {
  res.type("application/json").send({ ok: true, time: new Date().toISOString() });
});

// Helpers
// 1x1 GIF transparente
const ONE_BY_ONE_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64'
);
const nowISO = () => new Date().toISOString();
const clientIP = (req) =>
  req.headers["x-forwarded-for"]?.toString().split(",")[0].trim() ||
  req.socket.remoteAddress || "";

// IP y UA helpers para endurecer /pixel
function getClientIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim();
  return xff || req.ip || (req.socket && req.socket.remoteAddress) || '';
}
function classifyUA(ua) {
  if (!ua) return 'unknown';
  if (/GoogleImageProxy/i.test(ua)) return 'gmail_proxy';
  return 'generic';
}
function getEnvInt(name, def) {
  const n = parseInt(process.env[name] || '', 10);
  return Number.isFinite(n) ? n : def;
}

// Notificador n8n (best-effort, no bloqueante)
async function notifyN8n(payload) {
  try {
    if (!N8N_WEBHOOK_URL) return;
    await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-shared-secret': N8N_SHARED_SECRET || ''
      },
      body: JSON.stringify(payload),
      signal: (globalThis.AbortSignal && typeof AbortSignal.timeout === 'function') ? AbortSignal.timeout(3000) : undefined
    });
  } catch (e) {
    console.warn('[n8n] notify failed:', e?.message || e);
  }
}

// Rango de fechas y formato día UTC
const DAY_MS = 24 * 60 * 60 * 1000;
function clampRange(fromISO, toISO) {
  const now = new Date();
  const to = toISO ? new Date(toISO) : now;
  const from = fromISO ? new Date(fromISO) : new Date(to.getTime() - 30 * DAY_MS);
  const norm = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  return { from: norm(from), to: norm(to) };
}
function fmtDateUTC(d) {
  return d.toISOString().slice(0, 10);
}

// Tracking público
app.get("/pixel", async (req, res) => {
  const id = req.query.id?.toString();
  if (!id) return res.status(400).send("missing id");

  // Config (solo debounce por creación)
  const debounceSec = getEnvInt('OPEN_DEBOUNCE_SECONDS', 5);

  // Cliente (solo para logging y notificación)
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';

  // Debounce basado en sent_at del email
  let emailRow = null;
  let created = new Date(Date.now() - (debounceSec + 1) * 1000);
  try {
    emailRow = db.prepare('SELECT subject, recipient, sent_at FROM emails WHERE id = ?').get(id);
    if (emailRow && emailRow.sent_at) {
      const c = new Date(emailRow.sent_at);
      if (!isNaN(c.getTime())) created = c;
    }
  } catch (_) {}

  const deltaMs = Date.now() - created.getTime();
  if (deltaMs < debounceSec * 1000) {
    console.log(`[pixel] debounce skip id=${id} since=${Math.round(deltaMs / 1000)}`);
    return res.status(204).end();
  }

  // Registrar apertura
  try {
    const ts = nowISO();
    db.prepare(
      `INSERT INTO events (id, email_id, type, timestamp, ip, user_agent)
       VALUES (?, ?, 'open', ?, ?, ?)`
    ).run(nanoid(), id, ts, ip, ua || "");
    // Notificar n8n (best-effort)
    await notifyN8n({
      event_type: 'open',
      email_id: id,
      timestamp: ts,
      ip,
      user_agent: ua || '',
      subject: emailRow?.subject ?? null,
      recipient: emailRow?.recipient ?? null
    });
  } catch (_) {}

  // Entregar pixel no-cache (GIF 1x1)
  res.set({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  res.status(200).end(ONE_BY_ONE_GIF);
});

app.get("/click", async (req, res) => {
  const email_id = req.query.id?.toString();
  const rawUrl = req.query.url?.toString() || '';
  if (!email_id) return res.status(400).send("missing id or url");
  let target = '';
  try { target = decodeURIComponent(rawUrl); } catch { target = rawUrl; }
  try {
    const ts = nowISO();
    db.prepare(
      `INSERT INTO events (id, email_id, type, timestamp, ip, user_agent)
       VALUES (?, ?, 'click', ?, ?, ?)`
    ).run(nanoid(), email_id, ts, clientIP(req), req.headers["user-agent"] || "");
    // Notificar n8n (best-effort)
    const emailRow = db.prepare('SELECT subject, recipient, sent_at FROM emails WHERE id = ?').get(email_id);
    await notifyN8n({
      event_type: 'click',
      email_id: email_id,
      timestamp: ts,
      ip: clientIP(req),
      user_agent: req.headers['user-agent'] || '',
      click_url: target,
      subject: emailRow?.subject ?? null,
      recipient: emailRow?.recipient ?? null
    });
  } catch (_) {}
  if (!target || !/^https?:\/\//i.test(target)) {
    return res.status(400).send("invalid url");
  }
  return res.redirect(302, target);
});

// API privada con API Key
const requireKey = (req, res, next) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) return res.status(401).json({ error: "invalid_api_key" });
  return next();
};
app.use("/api", requireKey);

app.post("/api/emails", (req, res) => {
  const { id, subject, recipient } = req.body || {};
  if (!id || !recipient) return res.status(400).json({ error: "missing id or recipient" });
  const sentAt = nowISO();
  db.prepare(`INSERT INTO emails (id, subject, recipient, sent_at) VALUES (?, ?, ?, ?)`) 
    .run(id, subject || "", recipient, sentAt);
  const base = getPublicBaseUrl(req);
  const pixel = `${base}/pixel?id=${encodeURIComponent(id)}`;
  const click_template = `${base}/click?id=${encodeURIComponent(id)}&url=`;
  const click_example = `${click_template}${encodeURIComponent('https://timeback.es')}`;
  res.status(201).json({ ok: true, id, pixel, click_template, click_example });
});

app.get("/api/emails", (req, res) => {
  const rows = db.prepare(`
    SELECT e.id, e.subject, e.recipient, e.sent_at,
      SUM(CASE WHEN ev.type='open'  THEN 1 ELSE 0 END) as opens,
      SUM(CASE WHEN ev.type='click' THEN 1 ELSE 0 END) as clicks
    FROM emails e
    LEFT JOIN events ev ON ev.email_id = e.id
    GROUP BY e.id
    ORDER BY datetime(e.sent_at) DESC
  `).all();
  const base = getPublicBaseUrl(req);
  const enriched = rows.map((e) => ({
    ...e,
    pixel: `${base}/pixel?id=${encodeURIComponent(e.id)}`,
  }));
  res.json(enriched);
});

app.get("/api/emails/:id", (req, res) => {
  const { id } = req.params;
  const email = db.prepare(`SELECT * FROM emails WHERE id=?`).get(id);
  if (!email) return res.status(404).json({ error: "not_found" });
  const events = db.prepare(`
    SELECT type, timestamp, ip, user_agent
    FROM events
    WHERE email_id=?
    ORDER BY datetime(timestamp) ASC
  `).all(id);
  const base = getPublicBaseUrl(req);
  const pixel = `${base}/pixel?id=${encodeURIComponent(id)}`;
  const click_template = `${base}/click?id=${encodeURIComponent(id)}&url=`;
  const click_example = `${click_template}${encodeURIComponent('https://timeback.es')}`;
  res.json({ email, events, pixel, click_template, click_example });
});

// Stats agregadas
app.get('/api/stats', (req, res) => {
  try {
    const { from: qFrom, to: qTo } = req.query;
    const { from, to } = clampRange(qFrom, qTo);
    const fromStr = fmtDateUTC(from);
    const toStr = fmtDateUTC(to);

    const emailsTotal = db.prepare(`
      SELECT COUNT(*) AS c
      FROM emails
      WHERE substr(sent_at,1,10) BETWEEN ? AND ?
    `).get(fromStr, toStr).c;

    const opensTotal = db.prepare(`
      SELECT COUNT(*) AS c FROM events
      WHERE type='open' AND substr(timestamp,1,10) BETWEEN ? AND ?
    `).get(fromStr, toStr).c;

    const clicksTotal = db.prepare(`
      SELECT COUNT(*) AS c FROM events
      WHERE type='click' AND substr(timestamp,1,10) BETWEEN ? AND ?
    `).get(fromStr, toStr).c;

    const opensUnique = db.prepare(`
      SELECT COUNT(DISTINCT email_id) AS c FROM events
      WHERE type='open' AND substr(timestamp,1,10) BETWEEN ? AND ?
    `).get(fromStr, toStr).c;

    const clicksUnique = db.prepare(`
      SELECT COUNT(DISTINCT email_id) AS c FROM events
      WHERE type='click' AND substr(timestamp,1,10) BETWEEN ? AND ?
    `).get(fromStr, toStr).c;

    const days = [];
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY_MS)) {
      days.push(fmtDateUTC(d));
    }

    const perDayEmails = db.prepare(`
      SELECT substr(sent_at,1,10) AS day, COUNT(*) AS c
      FROM emails
      WHERE substr(sent_at,1,10) BETWEEN ? AND ?
      GROUP BY day
    `).all(fromStr, toStr);

    const perDayOpens = db.prepare(`
      SELECT day, COUNT(DISTINCT email_id) AS unique_c, COUNT(*) AS total_c FROM (
        SELECT substr(timestamp,1,10) AS day, email_id
        FROM events
        WHERE type='open' AND substr(timestamp,1,10) BETWEEN ? AND ?
      )
      GROUP BY day
    `).all(fromStr, toStr);

    const perDayClicks = db.prepare(`
      SELECT day, COUNT(DISTINCT email_id) AS unique_c, COUNT(*) AS total_c FROM (
        SELECT substr(timestamp,1,10) AS day, email_id
        FROM events
        WHERE type='click' AND substr(timestamp,1,10) BETWEEN ? AND ?
      )
      GROUP BY day
    `).all(fromStr, toStr);

    const map = (rows) => Object.fromEntries(rows.map(r => [r.day, r]));
    const mEmails = map(perDayEmails);
    const mOpens = map(perDayOpens);
    const mClicks = map(perDayClicks);

    const timeline = days.map(day => ({
      date: day,
      emails: (mEmails[day]?.c) || 0,
      opens_unique: (mOpens[day]?.unique_c) || 0,
      clicks_unique: (mClicks[day]?.unique_c) || 0,
    }));

    const openRate = emailsTotal > 0 ? opensUnique / emailsTotal : 0;
    const ctr = emailsTotal > 0 ? clicksUnique / emailsTotal : 0;

    res.json({
      ok: true,
      range: { from: fromStr, to: toStr },
      totals: {
        emails: emailsTotal,
        opens_unique: opensUnique,
        opens_total: opensTotal,
        clicks_unique: clicksUnique,
        clicks_total: clicksTotal,
        open_rate: openRate,
        ctr
      },
      timeline
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'stats_failed' });
  }
});

// Resumen por email en rango
// GET /api/emails/summary → siempre 200 con { ok:true, rows: [] }
app.get('/api/emails/summary', (req, res) => {
  try {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    const qFrom = typeof req.query.from === 'string' ? req.query.from : '';
    const qTo   = typeof req.query.to   === 'string' ? req.query.to   : '';

    let where = '';
    const params = [];
    const hasFrom = re.test(qFrom);
    const hasTo = re.test(qTo);
    if (hasFrom && hasTo) {
      where = 'WHERE substr(e.sent_at,1,10) BETWEEN ? AND ?';
      params.push(qFrom, qTo);
    } else if (hasFrom) {
      where = 'WHERE substr(e.sent_at,1,10) >= ?';
      params.push(qFrom);
    } else if (hasTo) {
      where = 'WHERE substr(e.sent_at,1,10) <= ?';
      params.push(qTo);
    }

    const sql = `
      SELECT e.id, e.subject, e.recipient, e.sent_at,
             COALESCE(SUM(CASE WHEN ev.type='open'  THEN 1 ELSE 0 END), 0) AS opens,
             COALESCE(SUM(CASE WHEN ev.type='click' THEN 1 ELSE 0 END), 0) AS clicks
      FROM emails e
      LEFT JOIN events ev ON ev.email_id = e.id
      ${where}
      GROUP BY e.id
      ORDER BY e.sent_at DESC
      LIMIT 1000
    `;
    const rows = db.prepare(sql).all(...params);
    console.log(`[summary] from=${hasFrom ? qFrom : '-'} to=${hasTo ? qTo : '-'} rows=${rows.length}`);
    return res.json({ ok: true, rows });
  } catch (e) {
    console.error('GET /api/emails/summary error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
});

// Error handler
app.use((err, _req, res, next) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: "internal_error" });
});

// Start (IPv4)
const server = app.listen(PORT, "127.0.0.1", () => {
  console.log(`🚀 Backend on http://127.0.0.1:${PORT}`);
  console.log(`📧 API_KEY: ${API_KEY}`);
  console.log(`🌐 CORS origin: ${FRONTEND_ORIGIN}`);
});
server.setTimeout(10000);
