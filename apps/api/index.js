const http = require('node:http');
const path = require('node:path');

const { Pool } = require('pg');
const dotenv = require('dotenv');
const { json, notFound } = require('./lib/http');
const { checkDatabase, checkTigerbeetle } = require('./lib/health');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.API_PORT || 4000);
const DATABASE_URL = process.env.DATABASE_URL;
const TIGERBEETLE_ADDRESS = process.env.TIGERBEETLE_ADDRESS || 'localhost:3000';

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

const checkDatabaseStatus = () => checkDatabase(pool);
const checkTigerbeetleStatus = () => checkTigerbeetle(TIGERBEETLE_ADDRESS);

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
    const db = await checkDatabaseStatus();
    return json(res, db.ok ? 200 : 503, {
      ok: db.ok,
      timestamp: new Date().toISOString(),
      services: { db },
    });
  }

  if (url === '/api/health/tigerbeetle') {
    const tigerbeetle = await checkTigerbeetleStatus();
    return json(res, tigerbeetle.ok ? 200 : 503, {
      ok: tigerbeetle.ok,
      timestamp: new Date().toISOString(),
      services: { tigerbeetle },
    });
  }

  if (url === '/api/health/all') {
    const [db, tigerbeetle] = await Promise.all([checkDatabaseStatus(), checkTigerbeetleStatus()]);
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
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const page = parseInt(urlObj.searchParams.get('page')) || 1;
      const limit = parseInt(urlObj.searchParams.get('limit')) || 20;
      const offset = (page - 1) * limit;

      const countResult = await pool.query('SELECT COUNT(*) FROM influencers');
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `
        SELECT id, name, tiktok_url, instagram_url, followers, niche, phone, region, notes, category, created_at
        FROM influencers 
        ORDER BY name ASC
        LIMIT $1 OFFSET $2
      `,
        [limit, offset]
      );

      return json(res, 200, {
        ok: true,
        data: result.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/ugc-creators' || url.startsWith('/api/ugc-creators?')) {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const page = parseInt(urlObj.searchParams.get('page')) || 1;
      const limit = parseInt(urlObj.searchParams.get('limit')) || 20;
      const offset = (page - 1) * limit;

      const countResult = await pool.query('SELECT COUNT(*) FROM ugc_creators');
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `
        SELECT id, name, phone, handle, niche, has_mock_video, portfolio_url, age, gender, 
               languages, accepts_gifted_collab, turnaround_time, has_equipment, 
               has_editing_skills, can_voiceover, skills_rating, base_rate, region, notes, created_at
        FROM ugc_creators 
        ORDER BY name ASC
        LIMIT $1 OFFSET $2
      `,
        [limit, offset]
      );

      return json(res, 200, {
        ok: true,
        data: result.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
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
