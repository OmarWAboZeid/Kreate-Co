const crypto = require('node:crypto');
const { promisify } = require('node:util');

const scryptAsync = promisify(crypto.scrypt);

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function comparePasswords(supplied, stored) {
  const [hashed, salt] = stored.split('.');
  if (!salt) return false;
  const hashedBuf = Buffer.from(hashed, 'hex');
  const suppliedBuf = await scryptAsync(supplied, salt, 64);
  return crypto.timingSafeEqual(hashedBuf, suppliedBuf);
}

function generateSessionId() {
  return crypto.randomBytes(32).toString('hex');
}

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(';').forEach((cookie) => {
    const [name, ...rest] = cookie.split('=');
    cookies[name.trim()] = decodeURIComponent(rest.join('='));
  });
  return cookies;
}

function setSessionCookie(res, sessionId, maxAge = 7 * 24 * 60 * 60) {
  const expires = new Date(Date.now() + maxAge * 1000).toUTCString();
  const cookie = `session=${sessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', 'session=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT');
}

async function createSession(pool, userId) {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [sessionId, userId, expiresAt]
  );
  return sessionId;
}

async function getSessionUser(pool, req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.session;
  if (!sessionId) return null;

  const result = await pool.query(
    `SELECT u.id, u.email, u.name, u.role, u.status, u.created_at
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.id = $1 AND s.expires_at > NOW()`,
    [sessionId]
  );

  return result.rows[0] || null;
}

async function deleteSession(pool, req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.session;
  if (sessionId) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);
  }
}

async function cleanExpiredSessions(pool) {
  await pool.query('DELETE FROM sessions WHERE expires_at < NOW()');
}

module.exports = {
  hashPassword,
  comparePasswords,
  generateSessionId,
  parseCookies,
  setSessionCookie,
  clearSessionCookie,
  createSession,
  getSessionUser,
  deleteSession,
  cleanExpiredSessions,
};
