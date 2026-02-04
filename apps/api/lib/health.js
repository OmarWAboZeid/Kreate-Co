const net = require('node:net');

const checkDatabase = async (pool) => {
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

const checkTigerbeetle = (address) => {
  const [hostRaw, portRaw] = address.split(':');
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

module.exports = { checkDatabase, checkTigerbeetle };
