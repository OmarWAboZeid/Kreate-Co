const http = require('node:http');
const net = require('node:net');
const path = require('node:path');

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.API_PORT || 4000);
const DATABASE_URL = process.env.DATABASE_URL;
const TIGERBEETLE_ADDRESS = process.env.TIGERBEETLE_ADDRESS || 'localhost:3000';

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

const json = (res, statusCode, payload) => {
  const body = JSON.stringify(payload, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
};

const notFound = (res) => {
  json(res, 404, { ok: false, error: 'Not found' });
};

const checkDatabase = async () => {
  if (!pool) {
    return { ok: false, error: 'DATABASE_URL is not set' };
  }

  try {
    await pool.query('select 1 as ok');
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
};

const checkTigerbeetle = () => {
  const [hostRaw, portRaw] = TIGERBEETLE_ADDRESS.split(':');
  let host = hostRaw || 'localhost';
  if (host === 'localhost') {
    host = '127.0.0.1';
  }
  const port = Number(portRaw || 3000);

  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ ok: false, error: 'Connection timed out', host, port });
    }, 1000);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.end();
      resolve({ ok: true, host, port });
    });

    socket.on('error', (error) => {
      clearTimeout(timeout);
      resolve({ ok: false, error: error.message, host, port });
    });
  });
};

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  if (method !== 'GET') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
  }

  if (url === '/api/health') {
    return json(res, 200, {
      ok: true,
      timestamp: new Date().toISOString(),
      services: {
        api: { ok: true, port: PORT },
      },
    });
  }

  if (url === '/api/health/db') {
    const db = await checkDatabase();
    return json(res, db.ok ? 200 : 503, {
      ok: db.ok,
      timestamp: new Date().toISOString(),
      services: { db },
    });
  }

  if (url === '/api/health/tigerbeetle') {
    const tigerbeetle = await checkTigerbeetle();
    return json(res, tigerbeetle.ok ? 200 : 503, {
      ok: tigerbeetle.ok,
      timestamp: new Date().toISOString(),
      services: { tigerbeetle },
    });
  }

  if (url === '/api/health/all') {
    const [db, tigerbeetle] = await Promise.all([
      checkDatabase(),
      checkTigerbeetle(),
    ]);
    const api = { ok: true, port: PORT };
    const ok = api.ok && db.ok && tigerbeetle.ok;

    return json(res, 200, {
      ok,
      timestamp: new Date().toISOString(),
      services: { api, db, tigerbeetle },
    });
  }

  if (url === '/api/influencers' || url.startsWith('/api/influencers?')) {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const result = await pool.query(`
        SELECT id, name, tiktok_url, instagram_url, followers, niche, phone, region, notes, category, created_at
        FROM influencers 
        ORDER BY name ASC
      `);
      return json(res, 200, { ok: true, data: result.rows });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/ugc-creators' || url.startsWith('/api/ugc-creators?')) {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const result = await pool.query(`
        SELECT id, name, phone, handle, niche, has_mock_video, portfolio_url, age, gender, 
               languages, accepts_gifted_collab, turnaround_time, has_equipment, 
               has_editing_skills, can_voiceover, skills_rating, base_rate, region, notes, created_at
        FROM ugc_creators 
        ORDER BY name ASC
      `);
      return json(res, 200, { ok: true, data: result.rows });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  return notFound(res);
});

server.listen(PORT, () => {
  console.log(`[dummy-api] listening on http://localhost:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    if (!pool) {
      process.exit(0);
      return;
    }
    pool.end().finally(() => process.exit(0));
  });
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
