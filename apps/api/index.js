const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const { execFile } = require('node:child_process');
const fsp = require('node:fs/promises');

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

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PORT = IS_PRODUCTION ? 5000 : Number(process.env.API_PORT || 4000);
const STATIC_DIR = path.resolve(__dirname, '../web/dist');
const DATABASE_URL = process.env.DATABASE_URL;
const TIGERBEETLE_ADDRESS = process.env.TIGERBEETLE_ADDRESS || 'localhost:3000';

const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL }) : null;

const CREATOR_CSV_PATH = path.resolve(__dirname, '../../data/egypt_creators.csv');
const CREATOR_CSV_HEADER = ['name', 'username', 'profile_url', 'followers_count'];

const parseCsv = (text) => {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field);
      field = '';
      continue;
    }
    if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      continue;
    }
    if (ch === '\r') {
      continue;
    }
    field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((item) => item.some((cell) => cell !== ''));
};

const escapeCsv = (value) => {
  const str = value == null ? '' : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const stringifyCsv = (rows) =>
  `${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}\n`;

const normalizeProfileUrl = (value) => {
  if (!value) return '';
  const trimmed = String(value).trim().replace(/\/+$/, '');
  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/, '');
    return `${url.protocol}//${url.host}${pathname}`.toLowerCase();
  } catch (error) {
    return trimmed.toLowerCase();
  }
};

const ensureProfileUrl = (creator) => {
  if (creator.profile_url) return creator.profile_url;
  if (!creator.username) return '';
  return `https://www.tiktok.com/@${creator.username}`;
};

const loadCreatorsCsv = async () => {
  try {
    const text = await fsp.readFile(CREATOR_CSV_PATH, 'utf8');
    const rows = parseCsv(text);
    if (!rows.length) return [];
    const header = rows[0].map((value) => value.trim());
    const indexes = CREATOR_CSV_HEADER.reduce((acc, key) => {
      acc[key] = header.indexOf(key);
      return acc;
    }, {});
    return rows.slice(1).map((row) => {
      const entry = {};
      CREATOR_CSV_HEADER.forEach((key) => {
        const idx = indexes[key];
        entry[key] = idx >= 0 ? row[idx] || '' : '';
      });
      return entry;
    });
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const writeCreatorsCsv = async (creators) => {
  const rows = [
    CREATOR_CSV_HEADER,
    ...creators.map((creator) =>
      CREATOR_CSV_HEADER.map((key) => (creator[key] == null ? '' : creator[key]))
    ),
  ];
  await fsp.mkdir(path.dirname(CREATOR_CSV_PATH), { recursive: true });
  await fsp.writeFile(CREATOR_CSV_PATH, stringifyCsv(rows), 'utf8');
};

const normalizeList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeTextArray = (value) => normalizeList(value);

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });

const checkDatabaseStatus = () => checkDatabase(pool);
const checkTigerbeetleStatus = () => checkTigerbeetle(TIGERBEETLE_ADDRESS);

const mapCampaignRow = (row) => ({
  id: row.id,
  name: row.name,
  brand: row.organization_name,
  brandId: row.organization_id,
  status: row.status,
  campaignType: row.campaign_type,
  dealType: row.deal_type,
  platforms: row.platforms || [],
  objectives: row.objectives || [],
  contentFormat: row.content_formats || [],
  creatorTiers: row.creator_tiers || [],
  targetAudience: row.target_audience,
  deliverables: row.deliverables,
  notes: row.notes,
  customPackageLabel: row.custom_package_label,
  ugcVideoCount: row.ugc_video_count,
  influencerVideoCount: row.influencer_video_count,
  ugcCount: row.ugc_video_count,
  influencerCount: row.influencer_video_count,
  timeline: {
    start: row.start_date ? row.start_date.toISOString().slice(0, 10) : '',
    end: row.end_date ? row.end_date.toISOString().slice(0, 10) : '',
  },
  package: row.package_id
    ? {
        id: row.package_id,
        name: row.package_name,
        price: row.package_price_snapshot != null ? Number(row.package_price_snapshot) : null,
        customLabel: row.custom_package_label,
        ugcVideoCount: row.package_ugc_count,
        influencerVideoCount: row.package_influencer_count,
      }
    : null,
  createdAt: row.created_at ? row.created_at.toISOString().slice(0, 10) : null,
});

const getBrandMembership = async (userId) => {
  const result = await pool.query(
    `
    SELECT o.id, o.name
    FROM org_memberships m
    JOIN organizations o ON m.organization_id = o.id
    WHERE m.identity_id = $1 AND o.org_type = 'BRAND'
    ORDER BY m.created_at ASC
    LIMIT 1
    `,
    [userId]
  );
  return result.rows[0] || null;
};

const getCampaignOrganizationId = async (campaignId) => {
  const result = await pool.query('SELECT organization_id FROM campaigns WHERE id = $1', [
    campaignId,
  ]);
  return result.rows[0]?.organization_id || null;
};

const ensureOrgAccess = async (user, organizationId) => {
  if (user.role !== 'brand') return true;
  const result = await pool.query(
    'SELECT 1 FROM org_memberships WHERE identity_id = $1 AND organization_id = $2',
    [user.id, organizationId]
  );
  return result.rowCount > 0;
};

async function requireApprovedUser(req, res) {
  if (!pool) {
    json(res, 503, { ok: false, error: 'Database not configured' });
    return null;
  }
  const user = await getSessionUser(pool, req);
  if (!user) {
    json(res, 401, { ok: false, error: 'Authentication required' });
    return null;
  }
  if (user.status !== 'approved') {
    json(res, 403, { ok: false, error: 'Account not approved' });
    return null;
  }
  return user;
}

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  if (method === 'OPTIONS') {
    return cors(res);
  }

  if (url === '/api/tiktok/analyze' && method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch (error) {
        return json(res, 400, { ok: false, error: 'Invalid JSON body' });
      }

      const profileUrl = payload.url || '';
      if (!profileUrl) {
        return json(res, 400, { ok: false, error: 'Missing url' });
      }

      const msToken = process.env.MS_TOKEN || process.env.ms_token || 'kPnvn2AsOob08XX5ZyqZKM62iCrboQdfl44n2NpE5hbA3blfnebUIQ3BaE0IYO405Gz7uYqH-7hxrtmpAUWAJ7UDRIyT9LT6oXsuTIOFwAnZUgXYze8Ljg8FZ8bspi74LsPXMLJzmyasoNHFfMzcQHa_';
      if (!msToken) {
        return json(res, 500, { ok: false, error: 'MS_TOKEN is not set on the server' });
      }

      console.log(`[tiktok] analyze requested: ${profileUrl}`);
      console.log(
        `[tiktok] ms_token source: ${process.env.MS_TOKEN ? 'MS_TOKEN' : 'ms_token'}`
      );
      console.log(`[tiktok] ms_token: ${msToken}`);
      console.log(`[tiktok] ms_token length: ${msToken.length}`);
      const scriptPath = path.resolve(__dirname, '../../scripts/tiktok_fetch_all.py');
      const args = [scriptPath, '--profile-url', profileUrl, '--trending', '0'];

      execFile(
        'python3',
        args,
        {
          env: { ...process.env, MS_TOKEN: msToken, ms_token: msToken },
          maxBuffer: 10 * 1024 * 1024,
          timeout: 120000,
        },
        (error, stdout, stderr) => {
          if (error) {
            console.error('[tiktok] analyze failed:', error.message);
            if (stderr) {
              console.log('[tiktok] script stderr length:', stderr.length);
              console.log('[tiktok] script stderr preview:', stderr.slice(0, 1000));
            }
            if (stdout) {
              console.log('[tiktok] script stdout length:', stdout.length);
              console.log('[tiktok] script stdout preview:', stdout.slice(0, 1000));
            }
            return json(res, 500, { ok: false, error: error.message, stderr });
          }
          if (stderr) {
            console.log('[tiktok] script output:', stderr.trim());
          }
          console.log('[tiktok] script stdout length:', stdout.length);
          console.log('[tiktok] script stdout preview:', stdout.slice(0, 1000));
          try {
            const data = JSON.parse(stdout);
            console.log('[tiktok] analyze success');
            console.log('[tiktok] response json:', JSON.stringify({ ok: true, data }, null, 2));
            return json(res, 200, { ok: true, data, debug: { stderr } });
          } catch (parseError) {
            console.error('[tiktok] parse failed:', parseError.message);
            return json(res, 500, {
              ok: false,
              error: 'Failed to parse script output',
              raw: stdout,
            });
          }
        }
      );
    });
    return;
  }

  if (url === '/api/tiktok/creators/search' && method === 'POST') {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return json(res, 400, { ok: false, error: 'Invalid JSON body' });
    }

    const queries = normalizeList(payload.queries || payload.query);
    const hashtags = normalizeList(payload.hashtags || payload.hashtag).map((tag) =>
      tag.replace(/^#/, '')
    );
    console.log('[tiktok][creators] search request', {
      queries,
      hashtags,
    });
    if (!queries.length && !hashtags.length) {
      return json(res, 400, {
        ok: false,
        error: 'Provide at least one search term or hashtag.',
      });
    }

    const msToken =
      process.env.MS_TOKEN ||
      process.env.ms_token ||
      'kPnvn2AsOob08XX5ZyqZKM62iCrboQdfl44n2NpE5hbA3blfnebUIQ3BaE0IYO405Gz7uYqH-7hxrtmpAUWAJ7UDRIyT9LT6oXsuTIOFwAnZUgXYze8Ljg8FZ8bspi74LsPXMLJzmyasoNHFfMzcQHa_';
    if (!msToken) {
      return json(res, 500, { ok: false, error: 'MS_TOKEN is not set on the server' });
    }
    const msTokenSource = process.env.MS_TOKEN
      ? 'MS_TOKEN'
      : process.env.ms_token
        ? 'ms_token'
        : 'fallback';
    console.log('[tiktok][creators] ms_token source:', msTokenSource);
    console.log('[tiktok][creators] ms_token length:', msToken.length);

    const scriptPath = path.resolve(__dirname, '../../scripts/tiktok_fetch_creators_eg.py');
    const searchCount =
      payload.searchCount === undefined || payload.searchCount === null
        ? 0
        : Number(payload.searchCount);
    const hashtagVideos =
      payload.hashtagVideos === undefined || payload.hashtagVideos === null
        ? 0
        : Number(payload.hashtagVideos);
    const maxCreators =
      payload.maxCreators === undefined || payload.maxCreators === null
        ? 0
        : Number(payload.maxCreators);

    const args = [
      scriptPath,
      '--no-csv',
      '--json-output',
      '-',
      '--no-defaults',
      '--search-count',
      String(Number.isNaN(searchCount) ? 0 : searchCount),
      '--hashtag-videos',
      String(Number.isNaN(hashtagVideos) ? 0 : hashtagVideos),
      '--max-creators',
      String(Number.isNaN(maxCreators) ? 0 : maxCreators),
    ];
    if (queries.length) {
      args.push('--queries', queries.join(','));
    }
    if (hashtags.length) {
      args.push('--hashtags', hashtags.join(','));
    }
    if (payload.fetchInfo === false) {
      args.push('--no-fetch-info');
    }
    const browser = payload.browser ? String(payload.browser) : 'webkit';
    args.push('--browser', browser);

    if (payload.headless === false) {
      args.push('--no-headless');
    } else if (payload.headless === true) {
      args.push('--headless');
    } else {
      args.push('--no-headless');
    }
    const defaultProxy =
      process.env.TIKTOK_PROXY || process.env.HTTPS_PROXY || process.env.HTTP_PROXY || '';
    const proxyValue = payload.proxy ? String(payload.proxy) : defaultProxy;
    if (proxyValue) {
      console.log('[tiktok][creators] using proxy');
      args.push('--proxy', proxyValue);
    }
    if (payload.sessions) {
      args.push('--sessions', String(payload.sessions));
    }
    if (payload.sleepAfter) {
      args.push('--sleep-after', String(payload.sleepAfter));
    } else {
      args.push('--sleep-after', '5');
    }
    if (payload.timeout) {
      args.push('--timeout', String(payload.timeout));
    } else {
      args.push('--timeout', '60000');
    }

    console.log('[tiktok][creators] script args', args.slice(1));
    execFile(
      'python3',
      args,
      {
        env: { ...process.env, MS_TOKEN: msToken, ms_token: msToken },
        maxBuffer: 20 * 1024 * 1024,
        timeout: 180000,
      },
      async (error, stdout, stderr) => {
        if (error) {
          console.error('[tiktok] creator search failed:', error.message);
          if (stderr) {
            console.log('[tiktok] script stderr length:', stderr.length);
            console.log('[tiktok] script stderr preview:', stderr.slice(0, 1000));
          }
          return json(res, 500, { ok: false, error: error.message, stderr });
        }

        if (stderr) {
          console.log('[tiktok][creators] script stderr length:', stderr.length);
          console.log('[tiktok][creators] script stderr preview:', stderr.slice(0, 1500));
        }
        console.log('[tiktok][creators] script stdout length:', stdout.length);

        let data;
        try {
          data = JSON.parse(stdout);
        } catch (parseError) {
          console.error('[tiktok] creator search parse failed:', parseError.message);
          return json(res, 500, {
            ok: false,
            error: 'Failed to parse script output',
            raw: stdout,
            stderr,
          });
        }

        try {
          const existing = await loadCreatorsCsv();
          const existingUrls = new Set(
            existing.map((creator) => normalizeProfileUrl(ensureProfileUrl(creator)))
          );
          const seen = new Set();
          let existingSkipped = 0;
          let duplicateSkipped = 0;

          const results = (Array.isArray(data) ? data : []).reduce((acc, raw) => {
            const username = raw?.username ? String(raw.username) : '';
            const profileUrl = ensureProfileUrl({
              profile_url: raw?.profile_url ? String(raw.profile_url) : '',
              username,
            });
            if (!profileUrl) {
              return acc;
            }
            const normalized = normalizeProfileUrl(profileUrl);
            if (existingUrls.has(normalized)) {
              existingSkipped += 1;
              return acc;
            }
            if (seen.has(normalized)) {
              duplicateSkipped += 1;
              return acc;
            }
            seen.add(normalized);
            acc.push({
              name: raw?.name ? String(raw.name) : '',
              username,
              profile_url: profileUrl,
              followers_count:
                raw?.followers_count != null
                  ? String(raw.followers_count)
                  : raw?.followers != null
                    ? String(raw.followers)
                    : '',
            });
            return acc;
          }, []);

          const responseMeta = {
            total: Array.isArray(data) ? data.length : 0,
            returned: results.length,
            existingSkipped,
            duplicateSkipped,
          };
          if (stderr) {
            responseMeta.stderrPreview = stderr.slice(0, 1500);
          }

          return json(res, 200, {
            ok: true,
            data: results,
            meta: responseMeta,
          });
        } catch (filterError) {
          return json(res, 500, { ok: false, error: filterError.message });
        }
      }
    );
    return;
  }

  if (url === '/api/tiktok/creators/admit' && method === 'POST') {
    let payload;
    try {
      payload = await readJsonBody(req);
    } catch (error) {
      return json(res, 400, { ok: false, error: 'Invalid JSON body' });
    }

    const incoming = Array.isArray(payload.creators)
      ? payload.creators
      : payload.creator
        ? [payload.creator]
        : [];
    if (!incoming.length) {
      return json(res, 400, { ok: false, error: 'No creators provided.' });
    }

    try {
      const existing = await loadCreatorsCsv();
      const existingUrls = new Set(
        existing.map((creator) => normalizeProfileUrl(ensureProfileUrl(creator)))
      );
      const added = [];
      let skipped = 0;

      incoming.forEach((raw) => {
        const username = raw?.username ? String(raw.username) : '';
        const profileUrl = ensureProfileUrl({
          profile_url: raw?.profile_url ? String(raw.profile_url) : '',
          username,
        });
        if (!profileUrl) {
          skipped += 1;
          return;
        }
        const normalized = normalizeProfileUrl(profileUrl);
        if (existingUrls.has(normalized)) {
          skipped += 1;
          return;
        }
        existingUrls.add(normalized);
        added.push({
          name: raw?.name ? String(raw.name) : '',
          username,
          profile_url: profileUrl,
          followers_count:
            raw?.followers_count != null
              ? String(raw.followers_count)
              : raw?.followers != null
                ? String(raw.followers)
                : '',
        });
      });

      const combined = existing.concat(added);
      await writeCreatorsCsv(combined);

      return json(res, 200, {
        ok: true,
        added: added.length,
        skipped,
        total: combined.length,
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
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

  if (url.startsWith('/api/packages') && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const dealType = urlObj.searchParams.get('dealType');
      const packageType = urlObj.searchParams.get('packageType');
      const includeInactive = urlObj.searchParams.get('includeInactive') === 'true';

      const conditions = [];
      const values = [];
      if (dealType) {
        values.push(dealType);
        conditions.push(`deal_type = $${values.length}`);
      }
      if (packageType) {
        values.push(packageType);
        conditions.push(`package_type = $${values.length}`);
      }
      if (!includeInactive) {
        conditions.push('active = true');
      }

      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await pool.query(
        `
        SELECT id, name, package_type, deal_type, influencer_video_count, ugc_video_count,
               description, price_amount, currency, customizable, active, created_at
        FROM campaign_packages
        ${whereClause}
        ORDER BY package_type ASC, ugc_video_count ASC NULLS LAST, influencer_video_count ASC NULLS LAST, name ASC
        `,
        values
      );

      const packages = result.rows.map((row) => ({
        ...row,
        price_amount: row.price_amount != null ? Number(row.price_amount) : null,
      }));

      return json(res, 200, { ok: true, data: packages });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/packages' && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const body = await parseBody(req);
      const {
        name,
        package_type,
        deal_type,
        influencer_video_count,
        ugc_video_count,
        description,
        price_amount,
        currency,
        customizable,
        active,
      } = body;

      if (!name || !package_type || !deal_type || price_amount === undefined) {
        return json(res, 400, { ok: false, error: 'Missing required package fields' });
      }

      const result = await pool.query(
        `
        INSERT INTO campaign_packages
          (name, package_type, deal_type, influencer_video_count, ugc_video_count, description,
           price_amount, currency, customizable, active, created_by_user_id)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id, name, package_type, deal_type, influencer_video_count, ugc_video_count,
                  description, price_amount, currency, customizable, active, created_at
        `,
        [
          name,
          package_type,
          deal_type,
          influencer_video_count || null,
          ugc_video_count || null,
          description || null,
          Number(price_amount),
          currency || 'USD',
          customizable === true,
          active !== false,
          user.id,
        ]
      );

      const row = result.rows[0];
      return json(res, 201, {
        ok: true,
        data: { ...row, price_amount: row.price_amount != null ? Number(row.price_amount) : null },
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/campaigns' && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const organizationId = urlObj.searchParams.get('organizationId');
      const brandMembership =
        user.role === 'brand' ? await getBrandMembership(user.id) : null;

      const values = [];
      let whereClause = '';
      const scopedOrgId = brandMembership?.id || organizationId;
      if (scopedOrgId) {
        values.push(scopedOrgId);
        whereClause = `WHERE c.organization_id = $1`;
      }

      const result = await pool.query(
        `
        SELECT
          c.*,
          o.name as organization_name,
          p.name as package_name,
          p.influencer_video_count as package_influencer_count,
          p.ugc_video_count as package_ugc_count
        FROM campaigns c
        JOIN organizations o ON c.organization_id = o.id
        LEFT JOIN campaign_packages p ON c.package_id = p.id
        ${whereClause}
        ORDER BY c.created_at DESC
        `,
        values
      );

      const data = result.rows.map(mapCampaignRow);
      return json(res, 200, { ok: true, data });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/campaigns' && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const body = await parseBody(req);

      const {
        name,
        status,
        organizationId,
        brand,
        platforms,
        objectives,
        contentFormat,
        creatorTiers,
        campaignType,
        dealType,
        targetAudience,
        deliverables,
        notes,
        startDate,
        endDate,
        packageId,
        customPackageLabel,
        ugcVideoCount,
        influencerVideoCount,
      } = body;

      if (!name) {
        return json(res, 400, { ok: false, error: 'Campaign name is required' });
      }

      const brandMembership =
        user.role === 'brand' ? await getBrandMembership(user.id) : null;
      let resolvedOrgId = brandMembership?.id || organizationId;
      if (!resolvedOrgId && brand) {
        const orgResult = await pool.query(
          `SELECT id FROM organizations WHERE org_type = 'BRAND' AND name = $1`,
          [brand]
        );
        if (orgResult.rows.length === 0) {
          return json(res, 400, { ok: false, error: 'Brand not found' });
        }
        resolvedOrgId = orgResult.rows[0].id;
      }

      if (!resolvedOrgId) {
        return json(res, 400, { ok: false, error: 'Organization is required' });
      }

      let packagePriceSnapshot = null;
      let packageInfluencerCount = null;
      let packageUgcCount = null;

      if (packageId) {
        const packageResult = await pool.query(
          `SELECT price_amount, influencer_video_count, ugc_video_count FROM campaign_packages WHERE id = $1`,
          [packageId]
        );
        if (packageResult.rows.length === 0) {
          return json(res, 400, { ok: false, error: 'Invalid package selected' });
        }
        packagePriceSnapshot = packageResult.rows[0].price_amount;
        packageInfluencerCount = packageResult.rows[0].influencer_video_count;
        packageUgcCount = packageResult.rows[0].ugc_video_count;
      }

      const objectivesArray = normalizeTextArray(objectives);
      const platformsArray = normalizeTextArray(platforms);
      const contentFormatsArray = normalizeTextArray(contentFormat);
      const creatorTiersArray = normalizeTextArray(creatorTiers);

      const insertResult = await pool.query(
        `
        INSERT INTO campaigns (
          organization_id,
          name,
          objective,
          status,
          start_date,
          end_date,
          campaign_type,
          deal_type,
          target_audience,
          deliverables,
          notes,
          platforms,
          objectives,
          content_formats,
          creator_tiers,
          package_id,
          package_price_snapshot,
          custom_package_label,
          ugc_video_count,
          influencer_video_count
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20
        )
        RETURNING *
        `,
        [
          resolvedOrgId,
          name,
          objectivesArray.length ? objectivesArray.join(', ') : null,
          status || 'Draft',
          startDate || null,
          endDate || null,
          campaignType || null,
          dealType || null,
          targetAudience || null,
          deliverables || null,
          notes || null,
          platformsArray,
          objectivesArray,
          contentFormatsArray,
          creatorTiersArray,
          packageId || null,
          packagePriceSnapshot != null ? Number(packagePriceSnapshot) : null,
          customPackageLabel || null,
          ugcVideoCount || packageUgcCount || null,
          influencerVideoCount || packageInfluencerCount || null,
        ]
      );

      const row = insertResult.rows[0];
      const orgResult = await pool.query(
        `SELECT name FROM organizations WHERE id = $1`,
        [row.organization_id]
      );
      const orgName = orgResult.rows[0]?.name || null;

      const responseRow = {
        ...row,
        organization_name: orgName,
        package_name: null,
        package_influencer_count: packageInfluencerCount,
        package_ugc_count: packageUgcCount,
      };

      return json(res, 201, { ok: true, data: mapCampaignRow(responseRow) });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignCreatorsMatch = url.match(/^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators$/);
  if (campaignCreatorsMatch && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const campaignId = campaignCreatorsMatch[1];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const invitesResult = await pool.query(
        `
        SELECT creator_id, brand_decision, brand_decision_note, shortlist_rank, created_at
        FROM campaign_invitations
        WHERE campaign_id = $1
        ORDER BY shortlist_rank NULLS LAST, created_at ASC
        `,
        [campaignId]
      );

      const participantsResult = await pool.query(
        `
        SELECT creator_id, workflow_status, final_video_link
        FROM campaign_participants
        WHERE campaign_id = $1
        `,
        [campaignId]
      );

      const shortlist = invitesResult.rows.map((row) => row.creator_id);
      const approvals = {};
      const rejectionReasons = {};

      invitesResult.rows.forEach((row) => {
        const decision = row.brand_decision || 'pending';
        const label =
          decision === 'approved'
            ? 'Brand Approved'
            : decision === 'rejected'
              ? 'Brand Rejected'
              : 'Suggested';
        approvals[row.creator_id] = label;
        if (decision === 'rejected' && row.brand_decision_note) {
          rejectionReasons[row.creator_id] = row.brand_decision_note;
        }
      });

      const outreach = participantsResult.rows.reduce((acc, row) => {
        acc[row.creator_id] = {
          workflowStatus: row.workflow_status || 'Filming',
          finalVideoLink: row.final_video_link || '',
        };
        return acc;
      }, {});

      return json(res, 200, {
        ok: true,
        data: { shortlist, approvals, outreach, rejectionReasons },
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignSuggestMatch = url.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/suggest$/
  );
  if (campaignSuggestMatch && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const campaignId = campaignSuggestMatch[1];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const body = await parseBody(req);
      const creatorId = body.creatorId;
      if (!creatorId) {
        return json(res, 400, { ok: false, error: 'creatorId is required' });
      }

      const maxRankResult = await pool.query(
        `SELECT COALESCE(MAX(shortlist_rank), 0) AS max_rank
         FROM campaign_invitations
         WHERE campaign_id = $1`,
        [campaignId]
      );
      const nextRank = Number(maxRankResult.rows[0]?.max_rank || 0) + 1;

      await pool.query(
        `
        INSERT INTO campaign_invitations
          (campaign_id, creator_id, status, created_by_user_id, brand_decision, shortlist_rank)
        VALUES ($1, $2, 'shortlisted', $3, 'pending', $4)
        ON CONFLICT (campaign_id, creator_id) DO NOTHING
        `,
        [campaignId, creatorId, user.id, nextRank]
      );

      return json(res, 201, { ok: true });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignDecisionMatch = url.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/([0-9a-fA-F-]+)\/decision$/
  );
  if (campaignDecisionMatch && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const campaignId = campaignDecisionMatch[1];
      const creatorId = campaignDecisionMatch[2];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const body = await parseBody(req);
      const decision = body.decision;
      const note = body.note || null;
      if (!['approved', 'rejected', 'pending'].includes(decision)) {
        return json(res, 400, { ok: false, error: 'Invalid decision' });
      }

      const updateResult = await pool.query(
        `
        UPDATE campaign_invitations
        SET brand_decision = $1,
            brand_decision_note = $2,
            brand_decided_at = NOW(),
            brand_decided_by_user_id = $3
        WHERE campaign_id = $4 AND creator_id = $5
        RETURNING id
        `,
        [decision, note, user.id, campaignId, creatorId]
      );

      if (updateResult.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'Invitation not found' });
      }

      if (decision === 'approved') {
        await pool.query(
          `
          INSERT INTO campaign_participants
            (campaign_id, creator_id, state, created_at, accepted_at, workflow_status, created_by_user_id)
          SELECT $1, $2, 'active', NOW(), NOW(), 'Filming', $3
          WHERE NOT EXISTS (
            SELECT 1 FROM campaign_participants WHERE campaign_id = $1 AND creator_id = $2
          )
          `,
          [campaignId, creatorId, user.id]
        );
      } else if (decision === 'rejected') {
        await pool.query(
          `DELETE FROM campaign_participants WHERE campaign_id = $1 AND creator_id = $2`,
          [campaignId, creatorId]
        );
      }

      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignWorkflowMatch = url.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/([0-9a-fA-F-]+)\/workflow$/
  );
  if (campaignWorkflowMatch && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const campaignId = campaignWorkflowMatch[1];
      const creatorId = campaignWorkflowMatch[2];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const body = await parseBody(req);
      const workflowStatus = body.workflowStatus;
      const finalVideoLink = body.finalVideoLink;
      if (workflowStatus === undefined && finalVideoLink === undefined) {
        return json(res, 400, { ok: false, error: 'Nothing to update' });
      }

      const updateResult = await pool.query(
        `
        UPDATE campaign_participants
        SET workflow_status = COALESCE($1, workflow_status),
            final_video_link = COALESCE($2, final_video_link)
        WHERE campaign_id = $3 AND creator_id = $4
        RETURNING id
        `,
        [workflowStatus || null, finalVideoLink || null, campaignId, creatorId]
      );

      if (updateResult.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'Participant not found' });
      }

      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/influencers' || url.startsWith('/api/influencers?')) {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const page = parseInt(urlObj.searchParams.get('page')) || 1;
      const limit = parseInt(urlObj.searchParams.get('limit')) || 20;
      const offset = (page - 1) * limit;

      const countResult = await pool.query('SELECT COUNT(*) FROM influencers');
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `
        SELECT id, name, tiktok_url, instagram_url, instagram_handle, tiktok_handle,
               followers, niche, phone, region, notes, category, profile_image, created_at
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
    const user = await requireApprovedUser(req, res);
    if (!user) return;
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
               has_editing_skills, can_voiceover, skills_rating, base_rate, region, notes,
               profile_image, created_at
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
    const user = await requireApprovedUser(req, res);
    if (!user) return;
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
    const user = await requireApprovedUser(req, res);
    if (!user) return;
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
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (method === 'GET') {
      try {
        const brandMembership =
          user.role === 'brand' ? await getBrandMembership(user.id) : null;
        const result = await pool.query(
          `SELECT id, name, logo_url, created_at
           FROM organizations
           WHERE org_type = 'BRAND'
           ORDER BY CASE WHEN id = $1 THEN 0 ELSE 1 END, name ASC`,
          [brandMembership?.id || null]
        );
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
        const existing = await pool.query(
          `SELECT id FROM organizations WHERE org_type = 'BRAND' AND LOWER(name) = LOWER($1)`,
          [name.trim()]
        );
        if (existing.rows.length > 0) {
          return json(res, 409, { ok: false, error: 'A brand with this name already exists' });
        }
        const result = await pool.query(
          `INSERT INTO organizations (name, org_type, logo_url)
           VALUES ($1, 'BRAND', $2)
           RETURNING id, name, logo_url, created_at`,
          [name.trim(), logo_url || null]
        );
        return json(res, 201, { ok: true, data: result.rows[0] });
      } catch (error) {
        return json(res, 500, { ok: false, error: error.message });
      }
    }
  }

  const brandDeleteMatch = url.match(/^\/api\/brands\/([0-9a-fA-F-]+)$/);
  if (method === 'DELETE' && brandDeleteMatch) {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const brandId = brandDeleteMatch[1];
      const result = await pool.query(
        `DELETE FROM organizations WHERE id = $1 AND org_type = 'BRAND' RETURNING id`,
        [brandId]
      );
      if (result.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Brand not found' });
      }
      return json(res, 200, { ok: true, message: 'Brand deleted' });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const orgNotificationsMatch = url.match(
    /^\/api\/organizations\/([0-9a-fA-F-]+)\/notifications$/
  );
  if (orgNotificationsMatch && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const organizationId = orgNotificationsMatch[1];
      if (user.role === 'brand') {
        const brandMembership = await getBrandMembership(user.id);
        if (!brandMembership || brandMembership.id !== organizationId) {
          return json(res, 403, { ok: false, error: 'Forbidden' });
        }
      }
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const limit = parseInt(urlObj.searchParams.get('limit')) || 50;
      const result = await pool.query(
        `
        SELECT id, message, channel, read, created_at
        FROM organization_notifications
        WHERE organization_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        `,
        [organizationId, limit]
      );
      return json(res, 200, { ok: true, data: result.rows });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (orgNotificationsMatch && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const organizationId = orgNotificationsMatch[1];
      if (user.role === 'brand') {
        const brandMembership = await getBrandMembership(user.id);
        if (!brandMembership || brandMembership.id !== organizationId) {
          return json(res, 403, { ok: false, error: 'Forbidden' });
        }
      }
      const body = await parseBody(req);
      const { message, channel } = body;
      if (!message || !channel) {
        return json(res, 400, { ok: false, error: 'Message and channel are required' });
      }
      const result = await pool.query(
        `
        INSERT INTO organization_notifications
          (organization_id, message, channel, created_by_user_id)
        VALUES ($1, $2, $3, $4)
        RETURNING id, message, channel, read, created_at
        `,
        [organizationId, message, channel, user.id]
      );
      return json(res, 201, { ok: true, data: result.rows[0] });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const orgNotificationReadMatch = url.match(
    /^\/api\/organizations\/([0-9a-fA-F-]+)\/notifications\/([0-9a-fA-F-]+)\/read$/
  );
  if (orgNotificationReadMatch && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const organizationId = orgNotificationReadMatch[1];
      const notificationId = orgNotificationReadMatch[2];
      if (user.role === 'brand') {
        const brandMembership = await getBrandMembership(user.id);
        if (!brandMembership || brandMembership.id !== organizationId) {
          return json(res, 403, { ok: false, error: 'Forbidden' });
        }
      }
      const result = await pool.query(
        `
        UPDATE organization_notifications
        SET read = true
        WHERE id = $1 AND organization_id = $2
        RETURNING id, message, channel, read, created_at
        `,
        [notificationId, organizationId]
      );
      if (result.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'Notification not found' });
      }
      return json(res, 200, { ok: true, data: result.rows[0] });
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
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      
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
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      
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
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      
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

  if (IS_PRODUCTION) {
    return serveStatic(req, res, url);
  }
  return notFound(res);
});

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
};

function serveStatic(req, res, urlPath) {
  let filePath = path.join(STATIC_DIR, urlPath === '/' ? 'index.html' : urlPath);
  
  if (!fs.existsSync(filePath)) {
    filePath = path.join(STATIC_DIR, 'index.html');
  }
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(content);
  } catch (err) {
    console.error('Static file error:', err);
    return notFound(res);
  }
}

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
