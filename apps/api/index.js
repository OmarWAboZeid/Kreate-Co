const http = require('node:http');
const path = require('node:path');

const { Pool } = require('pg');
const dotenv = require('dotenv');
const { json, notFound, parseBody, cors } = require('./lib/http');
const { checkDatabase, checkTigerbeetle } = require('./lib/health');
const { getUploadURL, normalizeObjectPath, getObjectFile, streamObject } = require('./lib/upload');
const {
  hashPassword,
  comparePasswords,
  setSessionCookie,
  clearSessionCookie,
  createSession,
  getSessionUser,
  deleteSession,
} = require('./lib/auth');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const PORT = Number(process.env.API_PORT || 4000);
const DATABASE_URL = process.env.DATABASE_URL;
const TIGERBEETLE_ADDRESS = process.env.TIGERBEETLE_ADDRESS || 'localhost:3000';

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

const checkDatabaseStatus = () => checkDatabase(pool);
const checkTigerbeetleStatus = () => checkTigerbeetle(TIGERBEETLE_ADDRESS);

const server = http.createServer(async (req, res) => {
  const { method, url } = req;

  if (method === 'OPTIONS') {
    return cors(res);
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

  if (method === 'POST' && url === '/api/uploads/request-url') {
    try {
      const body = await parseBody(req);
      const { name, size, contentType } = body;
      if (!name) {
        return json(res, 400, { ok: false, error: 'Missing required field: name' });
      }
      const uploadURL = await getUploadURL();
      const objectPath = normalizeObjectPath(uploadURL);
      return json(res, 200, {
        ok: true,
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      });
    } catch (error) {
      console.error('Error generating upload URL:', error);
      return json(res, 500, { ok: false, error: 'Failed to generate upload URL' });
    }
  }

  if (method === 'GET' && url.startsWith('/objects/')) {
    try {
      const file = await getObjectFile(url);
      if (!file) {
        return json(res, 404, { ok: false, error: 'Object not found' });
      }
      return streamObject(file, res);
    } catch (error) {
      console.error('Error serving object:', error);
      return json(res, 500, { ok: false, error: 'Failed to serve object' });
    }
  }

  if (url === '/api/brands' || url.startsWith('/api/brands?')) {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    if (method === 'GET') {
      try {
        const result = await pool.query('SELECT id, name, logo_url, created_at FROM brands ORDER BY name ASC');
        return json(res, 200, { ok: true, data: result.rows });
      } catch (error) {
        return json(res, 500, { ok: false, error: error.message });
      }
    }
    if (method === 'POST') {
      try {
        const body = await parseBody(req);
        const { name, logo_url } = body;
        if (!name) {
          return json(res, 400, { ok: false, error: 'Brand name is required' });
        }
        const result = await pool.query(
          'INSERT INTO brands (name, logo_url) VALUES ($1, $2) RETURNING id, name, logo_url, created_at',
          [name.trim(), logo_url || null]
        );
        return json(res, 201, { ok: true, data: result.rows[0] });
      } catch (error) {
        if (error.code === '23505') {
          return json(res, 409, { ok: false, error: 'A brand with this name already exists' });
        }
        return json(res, 500, { ok: false, error: error.message });
      }
    }
  }

  const brandDeleteMatch = url.match(/^\/api\/brands\/(\d+)$/);
  if (method === 'DELETE' && brandDeleteMatch) {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const brandId = brandDeleteMatch[1];
      const result = await pool.query('DELETE FROM brands WHERE id = $1 RETURNING id', [brandId]);
      if (result.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Brand not found' });
      }
      return json(res, 200, { ok: true, message: 'Brand deleted' });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (method === 'POST' && url === '/api/auth/register') {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const body = await parseBody(req);
      const { email, password, name, role } = body;
      
      if (!email || !password || !name) {
        return json(res, 400, { ok: false, error: 'Email, password, and name are required' });
      }
      
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existingUser.rows.length > 0) {
        return json(res, 409, { ok: false, error: 'Email already registered' });
      }
      
      const passwordHash = await hashPassword(password);
      const userRole = role === 'creator' ? 'creator' : 'brand';
      
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, status) 
         VALUES ($1, $2, $3, $4, 'pending') 
         RETURNING id, email, name, role, status, created_at`,
        [email.toLowerCase(), passwordHash, name, userRole]
      );
      
      const user = result.rows[0];
      const sessionId = await createSession(pool, user.id);
      setSessionCookie(res, sessionId);
      
      return json(res, 201, { ok: true, user });
    } catch (error) {
      console.error('Register error:', error);
      return json(res, 500, { ok: false, error: 'Registration failed' });
    }
  }

  if (method === 'POST' && url === '/api/auth/login') {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const body = await parseBody(req);
      const { email, password } = body;
      
      if (!email || !password) {
        return json(res, 400, { ok: false, error: 'Email and password are required' });
      }
      
      const result = await pool.query(
        'SELECT id, email, password_hash, name, role, status, created_at FROM users WHERE email = $1',
        [email.toLowerCase()]
      );
      
      if (result.rows.length === 0) {
        return json(res, 401, { ok: false, error: 'Invalid email or password' });
      }
      
      const user = result.rows[0];
      const validPassword = await comparePasswords(password, user.password_hash);
      
      if (!validPassword) {
        return json(res, 401, { ok: false, error: 'Invalid email or password' });
      }
      
      const sessionId = await createSession(pool, user.id);
      setSessionCookie(res, sessionId);
      
      const { password_hash, ...safeUser } = user;
      return json(res, 200, { ok: true, user: safeUser });
    } catch (error) {
      console.error('Login error:', error);
      return json(res, 500, { ok: false, error: 'Login failed' });
    }
  }

  if (method === 'POST' && url === '/api/auth/logout') {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      await deleteSession(pool, req);
      clearSessionCookie(res);
      return json(res, 200, { ok: true });
    } catch (error) {
      console.error('Logout error:', error);
      return json(res, 500, { ok: false, error: 'Logout failed' });
    }
  }

  if (method === 'GET' && url === '/api/auth/user') {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const user = await getSessionUser(pool, req);
      if (!user) {
        return json(res, 401, { ok: false, error: 'Not authenticated' });
      }
      return json(res, 200, { ok: true, user });
    } catch (error) {
      console.error('Get user error:', error);
      return json(res, 500, { ok: false, error: 'Failed to get user' });
    }
  }

  if (method === 'GET' && url === '/api/admin/users') {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const currentUser = await getSessionUser(pool, req);
      if (!currentUser || currentUser.role !== 'admin') {
        return json(res, 403, { ok: false, error: 'Admin access required' });
      }
      
      const result = await pool.query(
        'SELECT id, email, name, role, status, created_at FROM users ORDER BY created_at DESC'
      );
      return json(res, 200, { ok: true, data: result.rows });
    } catch (error) {
      console.error('Get users error:', error);
      return json(res, 500, { ok: false, error: 'Failed to get users' });
    }
  }

  const userApproveMatch = url.match(/^\/api\/admin\/users\/(\d+)\/approve$/);
  if (method === 'POST' && userApproveMatch) {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const currentUser = await getSessionUser(pool, req);
      if (!currentUser || currentUser.role !== 'admin') {
        return json(res, 403, { ok: false, error: 'Admin access required' });
      }
      
      const userId = userApproveMatch[1];
      const result = await pool.query(
        `UPDATE users SET status = 'approved', updated_at = NOW() 
         WHERE id = $1 
         RETURNING id, email, name, role, status`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'User not found' });
      }
      
      return json(res, 200, { ok: true, user: result.rows[0] });
    } catch (error) {
      console.error('Approve user error:', error);
      return json(res, 500, { ok: false, error: 'Failed to approve user' });
    }
  }

  const userRejectMatch = url.match(/^\/api\/admin\/users\/(\d+)\/reject$/);
  if (method === 'POST' && userRejectMatch) {
    if (!pool) {
      return json(res, 503, { ok: false, error: 'Database not configured' });
    }
    try {
      const currentUser = await getSessionUser(pool, req);
      if (!currentUser || currentUser.role !== 'admin') {
        return json(res, 403, { ok: false, error: 'Admin access required' });
      }
      
      const userId = userRejectMatch[1];
      const result = await pool.query(
        `UPDATE users SET status = 'rejected', updated_at = NOW() 
         WHERE id = $1 
         RETURNING id, email, name, role, status`,
        [userId]
      );
      
      if (result.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'User not found' });
      }
      
      return json(res, 200, { ok: true, user: result.rows[0] });
    } catch (error) {
      console.error('Reject user error:', error);
      return json(res, 500, { ok: false, error: 'Failed to reject user' });
    }
  }

  if (method !== 'GET') {
    return json(res, 405, { ok: false, error: 'Method not allowed' });
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
