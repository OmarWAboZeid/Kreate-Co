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

const CREATOR_STAGE_SEED = {
  UGC: ['Sourced', 'Brief Sent', 'Filming', 'Submitted', 'Approved', 'Published'],
  Influencer: ['Sourced', 'Outreach', 'Contracted', 'Posted', 'Reporting'],
  Hybrid: ['Sourced', 'In Progress', 'Submitted', 'Approved', 'Published'],
};

const normalizeCampaignType = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'ugc') return 'UGC';
  if (normalized === 'influencer') return 'Influencer';
  if (normalized === 'hybrid') return 'Hybrid';
  return null;
};

const ensureRuntimeSchema = async () => {
  if (!pool) return;
  await pool.query(
    `
    ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS campaign_type_detail text
    `
  );
  await pool.query(
    `
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS logo_url text
    `
  );
  await pool.query(
    `
    ALTER TABLE creators
      ADD COLUMN IF NOT EXISTS ugc_video_urls text[] NOT NULL DEFAULT '{}'::text[]
    `
  );
  await pool.query(
    `
    CREATE TABLE IF NOT EXISTS creator_stage_definitions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_type text NOT NULL CHECK (campaign_type IN ('UGC', 'Influencer', 'Hybrid')),
      label text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT NOW(),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      UNIQUE (campaign_type, label)
    )
    `
  );

  for (const [campaignType, labels] of Object.entries(CREATOR_STAGE_SEED)) {
    for (let index = 0; index < labels.length; index += 1) {
      const label = labels[index];
      await pool.query(
        `
        INSERT INTO creator_stage_definitions
          (campaign_type, label, sort_order, active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (campaign_type, label) DO NOTHING
        `,
        [campaignType, label, index + 1]
      );
    }
  }
};

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
const MIN_PASSWORD_LENGTH = 8;
const validatePasswordStrength = (password) => {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  return '';
};
const hasCampaignPackageDealTypeColumn = async () => {
  if (!pool) return false;
  try {
    const result = await pool.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'campaign_packages'
          AND column_name = 'deal_type'
      ) AS exists
      `
    );
    return Boolean(result.rows[0]?.exists);
  } catch (error) {
    return true;
  }
};

const CAMPAIGN_STATUS_MAP = Object.freeze({
  planning: 'Planning',
  draft: 'Planning',
  'in progress': 'In Progress',
  'in review': 'In Progress',
  submitted: 'In Progress',
  active: 'In Progress',
  published: 'Published',
  'published campaign': 'Published',
});

const normalizeCampaignStatus = (value, options = {}) => {
  const { fallback = 'Planning' } = options;
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const normalizedKey = String(value)
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return CAMPAIGN_STATUS_MAP[normalizedKey] || fallback;
};

const CAMPAIGN_EVENT_TYPE_MAP = Object.freeze({
  milestone: 'milestone',
  task: 'task',
  deadline: 'deadline',
  meeting: 'meeting',
  submission: 'submission',
  published: 'published',
});

const normalizeCampaignEventType = (value, options = {}) => {
  const { fallback = 'milestone' } = options;
  if (value === undefined || value === null || value === '') return fallback;
  const normalizedKey = String(value)
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  if (normalizedKey in CAMPAIGN_EVENT_TYPE_MAP) {
    return CAMPAIGN_EVENT_TYPE_MAP[normalizedKey];
  }
  return null;
};

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

const normalizeTikTokProfileUrl = (value) => {
  if (!value) return '';
  let raw = String(value).trim();
  if (!raw) return '';
  if (raw.startsWith('@')) {
    raw = `https://www.tiktok.com/${raw}`;
  } else if (!/^https?:\/\//i.test(raw) && raw.includes('tiktok.com')) {
    raw = `https://${raw}`;
  }
  try {
    const parsed = new URL(raw);
    const pathWithoutTrailingSlash = parsed.pathname.replace(/\/+$/, '');
    return `${parsed.protocol}//${parsed.host}${pathWithoutTrailingSlash}`.toLowerCase();
  } catch (error) {
    return raw.toLowerCase().replace(/\/+$/, '');
  }
};

const extractTikTokHandle = (value) => {
  if (!value) return '';
  const text = String(value).trim();
  const fromUrl = text.match(/tiktok\.com\/@([^/?#]+)/i);
  if (fromUrl) return `@${fromUrl[1]}`;
  if (/^@[^/\s]+$/.test(text)) return text;
  return '';
};

const toFiniteNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const computeTikTokVideoMetrics = (videos) => {
  if (!Array.isArray(videos) || videos.length === 0) {
    return { engagementRate: null, avgViews: null };
  }

  let totalViews = 0;
  let totalInteractions = 0;
  videos.forEach((video) => {
    const stats = video?.stats || video?.statsV2 || {};
    const views = toFiniteNumber(stats.playCount ?? stats.play_count) || 0;
    const likes =
      toFiniteNumber(stats.diggCount ?? stats.likeCount ?? stats.like_count) || 0;
    const comments = toFiniteNumber(stats.commentCount ?? stats.comment_count) || 0;
    const shares = toFiniteNumber(stats.shareCount ?? stats.share_count) || 0;
    const saves = toFiniteNumber(stats.collectCount ?? stats.collect_count) || 0;
    totalViews += views;
    totalInteractions += likes + comments + shares + saves;
  });

  if (totalViews <= 0) {
    return { engagementRate: null, avgViews: null };
  }

  return {
    engagementRate: Number(((totalInteractions / totalViews) * 100).toFixed(2)),
    avgViews: Math.round(totalViews / videos.length),
  };
};

const extractTikTokAnalyzeSummary = (analyzeData, sourceProfileUrl) => {
  const infoContainer =
    analyzeData?.data?.user?.info?.userInfo || analyzeData?.data?.user?.info || {};
  const user = infoContainer?.user || infoContainer?.author || {};
  const stats =
    infoContainer?.stats || infoContainer?.statsV2 || infoContainer?.authorStats || {};
  const videos = analyzeData?.data?.user?.videos || [];
  const sampleVideo = videos.find((video) => video && typeof video === 'object') || {};
  const sampleAuthor = sampleVideo.author || sampleVideo.user || {};
  const sampleAuthorStats =
    sampleVideo.authorStats || sampleVideo.authorStatsV2 || sampleVideo.stats || {};

  const uniqueIdRaw =
    user.uniqueId ||
    user.unique_id ||
    sampleAuthor.uniqueId ||
    sampleAuthor.unique_id ||
    extractTikTokHandle(sourceProfileUrl).replace(/^@/, '');
  const tiktokHandle = uniqueIdRaw
    ? `@${String(uniqueIdRaw).trim().replace(/^@/, '')}`
    : extractTikTokHandle(sourceProfileUrl);
  const handleNoAt = tiktokHandle ? tiktokHandle.replace(/^@/, '').toLowerCase() : '';

  const followersRaw =
    stats.followerCount ??
    stats.followers ??
    stats.follower_count ??
    sampleAuthorStats.followerCount ??
    sampleAuthorStats.followers ??
    sampleAuthorStats.follower_count;
  const followersNum = toFiniteNumber(followersRaw);
  const followers = followersNum == null ? null : Math.round(followersNum);

  const profileImage =
    user.avatarMedium ||
    user.avatarLarger ||
    user.avatarThumb ||
    sampleAuthor.avatarMedium ||
    sampleAuthor.avatarLarger ||
    sampleAuthor.avatarThumb ||
    '';

  const displayName =
    (user.nickname && String(user.nickname).trim()) ||
    (sampleAuthor.nickname && String(sampleAuthor.nickname).trim()) ||
    '';
  const normalizedUrl =
    normalizeTikTokProfileUrl(sourceProfileUrl) ||
    (handleNoAt ? `https://www.tiktok.com/@${handleNoAt}` : '');
  const { engagementRate, avgViews } = computeTikTokVideoMetrics(videos);

  return {
    normalizedUrl,
    tiktokHandle,
    handleNoAt,
    followers,
    engagementRate,
    avgViews,
    profileImage,
    displayName,
  };
};

const normalizeGenderValue = (value) => {
  if (value == null || value === '') return null;
  if (typeof value === 'number') {
    if (value === 1) return 'Male';
    if (value === 2) return 'Female';
    return null;
  }
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (['1', 'm', 'male', 'man'].includes(normalized)) return 'Male';
  if (['2', 'f', 'female', 'woman'].includes(normalized)) return 'Female';
  return null;
};

const extractAgeFromText = (text) => {
  if (!text) return null;
  const direct = String(text).match(/\b([1-9][0-9])\s*(?:yo|y\/o|yrs?|years?\s*old)\b/i);
  if (direct) return Number(direct[1]);
  return null;
};

const inferNicheFromBio = (bio) => {
  const value = String(bio || '').toLowerCase();
  if (!value) return null;
  const matches = [];
  const rules = [
    { key: 'Beauty', pattern: /(beauty|makeup|skincare|cosmetic)/ },
    { key: 'Fashion', pattern: /(fashion|style|outfit|ootd)/ },
    { key: 'Fitness', pattern: /(fitness|gym|workout|wellness|health)/ },
    { key: 'Food', pattern: /(food|recipe|cooking|chef|restaurant)/ },
    { key: 'Tech', pattern: /(tech|gadget|ai|software)/ },
    { key: 'Travel', pattern: /(travel|tour|trip|wander)/ },
    { key: 'Lifestyle', pattern: /(lifestyle|daily|vlog|life)/ },
    { key: 'Parenting', pattern: /(mom|dad|parent|family)/ },
  ];
  rules.forEach((rule) => {
    if (rule.pattern.test(value)) {
      matches.push(rule.key);
    }
  });
  return matches.length > 0 ? matches.join(', ') : null;
};

const extractTikTokAnalyzeProfile = (analyzeData) => {
  const infoContainer =
    analyzeData?.data?.user?.info?.userInfo || analyzeData?.data?.user?.info || {};
  const user = infoContainer?.user || infoContainer?.author || {};
  const bio =
    user.signature ||
    user.desc ||
    user.bioDescription ||
    '';
  const rawGender =
    user.gender ??
    user.sex ??
    user.secret ??
    infoContainer.gender ??
    infoContainer.sex;
  const gender = normalizeGenderValue(rawGender);
  const rawAge =
    user.age ??
    user.userAge ??
    infoContainer.age ??
    infoContainer.userAge;
  let age = toFiniteNumber(rawAge);
  if (age != null) {
    age = Math.round(age);
    if (age < 13 || age > 99) {
      age = null;
    }
  }
  if (age == null) {
    age = extractAgeFromText(bio);
  }
  const country =
    user.region ||
    user.country ||
    infoContainer.region ||
    infoContainer.country ||
    null;
  return {
    gender,
    age,
    country: country ? String(country).trim() : null,
    bio: bio ? String(bio).trim() : '',
    primaryNiche: inferNicheFromBio(bio),
  };
};

const getCreatorCardById = async (creatorId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      display_name AS name,
      tiktok_url,
      instagram_url,
      instagram_handle,
      tiktok_handle,
      followers,
      primary_niche AS niche,
      phone,
      COALESCE(country, '') AS region,
      notes,
      category,
      profile_image,
      engagement_rate,
      avg_views,
      gender,
      created_at
    FROM creators
    WHERE id = $1
    `,
    [creatorId]
  );
  return sanitizeCreatorProfileImage(result.rows[0] || null);
};

const runTikTokAnalyzeScript = (profileUrl) =>
  new Promise((resolve, reject) => {
    const msToken =
      process.env.MS_TOKEN ||
      process.env.ms_token ||
      'kPnvn2AsOob08XX5ZyqZKM62iCrboQdfl44n2NpE5hbA3blfnebUIQ3BaE0IYO405Gz7uYqH-7hxrtmpAUWAJ7UDRIyT9LT6oXsuTIOFwAnZUgXYze8Ljg8FZ8bspi74LsPXMLJzmyasoNHFfMzcQHa_';
    if (!msToken) {
      reject(new Error('MS_TOKEN is not set on the server'));
      return;
    }
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
          const err = new Error(error.message || 'TikTok analyze script failed');
          err.stderr = stderr;
          err.stdout = stdout;
          reject(err);
          return;
        }
        try {
          const data = JSON.parse(stdout);
          resolve({ data, stderr });
        } catch (parseError) {
          const err = new Error('Failed to parse script output');
          err.stderr = stderr;
          err.stdout = stdout;
          reject(err);
        }
      }
    );
  });

const persistTikTokAnalyzeMetrics = async (profileUrl, analyzeData, options = {}) => {
  const allowCreate = Boolean(options.allowCreate);
  if (!pool) {
    return { attempted: false, updated: 0, reason: 'database_not_configured' };
  }

  const snapshot = extractTikTokAnalyzeSummary(analyzeData, profileUrl);
  const profile = extractTikTokAnalyzeProfile(analyzeData);
  if (!snapshot.normalizedUrl && !snapshot.tiktokHandle) {
    return { attempted: false, updated: 0, reason: 'no_creator_identity' };
  }
  const hasPersistableData =
    snapshot.followers != null ||
    snapshot.engagementRate != null ||
    snapshot.avgViews != null ||
    Boolean(snapshot.profileImage) ||
    Boolean(snapshot.displayName);
  if (!hasPersistableData) {
    return { attempted: false, updated: 0, reason: 'no_metrics_available' };
  }

  const result = await pool.query(
    `
    UPDATE creators
    SET
      followers = COALESCE($1, followers),
      engagement_rate = COALESCE($2, engagement_rate),
      avg_views = COALESCE($3, avg_views),
      profile_image = COALESCE(NULLIF($4, ''), profile_image),
      tiktok_handle = COALESCE(NULLIF(tiktok_handle, ''), NULLIF($5, '')),
      display_name = COALESCE(NULLIF(display_name, ''), NULLIF($6, '')),
      tiktok_url = COALESCE(NULLIF(tiktok_url, ''), NULLIF($7, '')),
      gender = COALESCE(NULLIF(gender, ''), NULLIF($10, '')),
      age = COALESCE(age, $11),
      country = COALESCE(NULLIF(country, ''), NULLIF($12, '')),
      primary_niche = COALESCE(NULLIF(primary_niche, ''), NULLIF($13, '')),
      notes = COALESCE(NULLIF(notes, ''), NULLIF($14, '')),
      updated_at = NOW()
    WHERE creator_type = 'Influencer'
      AND (
        LOWER(REGEXP_REPLACE(SPLIT_PART(COALESCE(tiktok_url, ''), '?', 1), '/+$', '')) = $8
        OR LOWER(COALESCE(tiktok_handle, '')) = $9
        OR LOWER(REGEXP_REPLACE(COALESCE(tiktok_handle, ''), '^@', '')) = $15
      )
    RETURNING id
    `,
    [
      snapshot.followers,
      snapshot.engagementRate,
      snapshot.avgViews,
      snapshot.profileImage,
      snapshot.tiktokHandle,
      snapshot.displayName,
      snapshot.normalizedUrl || null,
      snapshot.normalizedUrl || '__no_tiktok_url__',
      (snapshot.tiktokHandle || '').toLowerCase(),
      profile.gender,
      profile.age,
      profile.country,
      profile.primaryNiche,
      profile.bio ? `Imported from TikTok: ${profile.bio.slice(0, 360)}` : null,
      snapshot.handleNoAt || '__no_tiktok_handle__',
    ]
  );

  const updatedCreatorId = result.rows[0]?.id || null;
  if (updatedCreatorId) {
    const creator = await getCreatorCardById(updatedCreatorId);
    return {
      attempted: true,
      updated: result.rowCount,
      created: false,
      creatorId: updatedCreatorId,
      creator,
      metrics: {
        followers: snapshot.followers,
        engagementRate: snapshot.engagementRate,
        avgViews: snapshot.avgViews,
      },
    };
  }

  if (!allowCreate) {
    return {
      attempted: true,
      updated: result.rowCount,
      created: false,
      creatorId: null,
      creator: null,
      metrics: {
        followers: snapshot.followers,
        engagementRate: snapshot.engagementRate,
        avgViews: snapshot.avgViews,
      },
    };
  }

  const displayName =
    snapshot.displayName ||
    (snapshot.tiktokHandle ? snapshot.tiktokHandle.replace(/^@/, '') : '') ||
    'TikTok Creator';
  const notes = profile.bio
    ? `Imported from TikTok: ${profile.bio.slice(0, 360)}`
    : 'Imported from TikTok profile link.';
  const insertResult = await pool.query(
    `
    INSERT INTO creators (
      display_name,
      primary_niche,
      country,
      status,
      creator_type,
      handle,
      tiktok_url,
      tiktok_handle,
      followers,
      age,
      gender,
      profile_image,
      notes,
      engagement_rate,
      avg_views
    )
    VALUES (
      $1, $2, $3, 'active', 'Influencer', $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    )
    RETURNING id
    `,
    [
      displayName,
      profile.primaryNiche,
      profile.country,
      snapshot.tiktokHandle,
      snapshot.normalizedUrl || null,
      snapshot.tiktokHandle || null,
      snapshot.followers,
      profile.age,
      profile.gender,
      snapshot.profileImage || null,
      notes,
      snapshot.engagementRate,
      snapshot.avgViews,
    ]
  );
  const createdCreatorId = insertResult.rows[0]?.id || null;
  const creator = createdCreatorId ? await getCreatorCardById(createdCreatorId) : null;
  return {
    attempted: true,
    updated: result.rowCount,
    created: Boolean(createdCreatorId),
    creatorId: createdCreatorId,
    creator,
    metrics: {
      followers: snapshot.followers,
      engagementRate: snapshot.engagementRate,
      avgViews: snapshot.avgViews,
    },
  };
};

const checkDatabaseStatus = () => checkDatabase(pool);
const checkTigerbeetleStatus = () => checkTigerbeetle(TIGERBEETLE_ADDRESS);

const mapCampaignRow = (row) => ({
  id: row.id,
  name: row.name,
  brand: row.organization_name,
  brandId: row.organization_id,
  status: normalizeCampaignStatus(row.status, { fallback: 'Planning' }),
  campaignType: row.campaign_type,
  campaignTypeDetail: row.campaign_type_detail,
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

const mapCampaignEventRow = (row) => {
  const eventDate =
    typeof row.event_date === 'string'
      ? row.event_date
      : row.event_date
        ? row.event_date.toISOString().slice(0, 10)
        : null;
  return {
    id: row.id,
    campaignId: row.campaign_id,
    organizationId: row.organization_id,
    title: row.title || '',
    description: row.description || '',
    type: normalizeCampaignEventType(row.event_type, { fallback: 'milestone' }),
    eventDate,
    createdByUserId: row.created_by_user_id || null,
    updatedByUserId: row.updated_by_user_id || null,
    createdAt: row.created_at ? row.created_at.toISOString() : null,
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
};

const CONTENT_STATUS_MAP = Object.freeze({
  pending: 'Pending Review',
  pending_review: 'Pending Review',
  'pending review': 'Pending Review',
  draft: 'Pending Review',
  approved: 'Approved',
  published: 'Published',
  'revision requested': 'Revision Requested',
  revision_requested: 'Revision Requested',
  rejected: 'Rejected',
});

const normalizeContentStatus = (value) => {
  if (value == null || value === '') return 'Pending Review';
  const key = String(value)
    .trim()
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ');
  return CONTENT_STATUS_MAP[key] || 'Pending Review';
};

const inferContentPlatform = (assetUrl, contentType) => {
  const source = `${assetUrl || ''} ${contentType || ''}`.toLowerCase();
  if (source.includes('tiktok')) return 'TikTok';
  if (source.includes('instagram')) return 'Instagram';
  if (source.includes('facebook')) return 'Facebook';
  if (source.includes('youtube')) return 'YouTube';
  return 'TikTok';
};

const mapContentRow = (row) => {
  const assetUrl = row.asset_url || '';
  const metrics = {
    views: toFiniteNumber(row.views) || 0,
    likes: toFiniteNumber(row.likes) || 0,
    comments: toFiniteNumber(row.comments) || 0,
    shares: toFiniteNumber(row.shares) || 0,
    saves: toFiniteNumber(row.saves) || 0,
    reach: toFiniteNumber(row.reach) || 0,
  };
  return {
    id: row.asset_id || row.submission_id,
    submissionId: row.submission_id,
    campaignId: row.campaign_id,
    creatorId: row.creator_id,
    platform: inferContentPlatform(assetUrl, row.asset_content_type),
    type: row.asset_content_type || 'Video',
    caption: row.asset_caption || '',
    hashtags: '',
    assets: assetUrl ? [{ type: 'link', label: 'Submitted content', url: assetUrl }] : [],
    status: normalizeContentStatus(row.submission_status),
    revisionCount: Number(row.version_count || 0),
    feedback: [],
    notes: row.submission_notes || '',
    createdAt: row.submitted_at ? new Date(row.submitted_at).toISOString() : null,
    submittedAt: row.submitted_at ? new Date(row.submitted_at).toISOString().slice(0, 10) : '',
    metrics,
  };
};

const sanitizeProfileImageUrl = (value) => {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const expRaw = parsed.searchParams.get('x-expires');
    const exp = Number(expRaw);
    if (Number.isFinite(exp) && Date.now() >= exp * 1000) {
      return null;
    }
    return raw;
  } catch (error) {
    return raw;
  }
};

const sanitizeCreatorProfileImage = (row) => {
  if (!row || typeof row !== 'object' || !Object.prototype.hasOwnProperty.call(row, 'profile_image')) {
    return row;
  }
  return { ...row, profile_image: sanitizeProfileImageUrl(row.profile_image) };
};

const sanitizeCreatorProfileImageList = (rows) => {
  if (!Array.isArray(rows)) return rows;
  return rows.map(sanitizeCreatorProfileImage);
};

const getBrandMembership = async (userId) => {
  const result = await pool.query(
    `
    SELECT o.id, o.name
    FROM org_memberships m
    JOIN organizations o ON m.organization_id = o.id
    WHERE m.identity_id = $1 AND UPPER(COALESCE(o.org_type, '')) = 'BRAND'
    ORDER BY m.created_at DESC
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

const createOrgNotification = async (organizationId, message, channel, createdByUserId) => {
  if (!organizationId || !message) return null;
  const result = await pool.query(
    `
    INSERT INTO organization_notifications
      (organization_id, message, channel, created_by_user_id)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [organizationId, message, channel || 'In-app', createdByUserId || null]
  );
  return result.rows[0] || null;
};

const getCampaignContext = async (campaignId) => {
  const result = await pool.query(
    `
    SELECT c.id, c.name, c.organization_id, o.name as organization_name
    FROM campaigns c
    JOIN organizations o ON c.organization_id = o.id
    WHERE c.id = $1
    `,
    [campaignId]
  );
  return result.rows[0] || null;
};

const getCreatorDisplayName = async (creatorId) => {
  const result = await pool.query(
    'SELECT display_name FROM creators WHERE id = $1',
    [creatorId]
  );
  return result.rows[0]?.display_name || 'Creator';
};

const getCreatorStagesByType = async (campaignType) => {
  const normalizedType = normalizeCampaignType(campaignType);
  if (!normalizedType) return [];

  const result = await pool.query(
    `
    SELECT label
    FROM creator_stage_definitions
    WHERE campaign_type = $1 AND active = true
    ORDER BY sort_order ASC, label ASC
    `,
    [normalizedType]
  );

  if (result.rows.length > 0) {
    return result.rows.map((row) => row.label).filter(Boolean);
  }

  return CREATOR_STAGE_SEED[normalizedType] || [];
};

const getDefaultCreatorStageForCampaign = async (campaignId) => {
  const campaignTypeResult = await pool.query(
    `
    SELECT campaign_type
    FROM campaigns
    WHERE id = $1
    `,
    [campaignId]
  );
  const campaignType = normalizeCampaignType(campaignTypeResult.rows[0]?.campaign_type) || 'Hybrid';
  const stageOptions = await getCreatorStagesByType(campaignType);
  return stageOptions[0] || 'Sourced';
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
  const pathname = url.split('?')[0];
  if (method === 'OPTIONS') {
    return cors(res);
  }

  if (url === '/api/tiktok/analyze' && method === 'POST') {
    try {
      const payload = await parseBody(req);
      const profileUrl = payload.url || '';
      if (!profileUrl) {
        return json(res, 400, { ok: false, error: 'Missing url' });
      }
      const { data, stderr } = await runTikTokAnalyzeScript(profileUrl);
      let persistence;
      try {
        persistence = await persistTikTokAnalyzeMetrics(profileUrl, data);
      } catch (persistError) {
        persistence = {
          attempted: true,
          updated: 0,
          error: persistError.message,
        };
      }
      return json(res, 200, { ok: true, data, debug: { stderr }, persistence });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return json(res, 400, { ok: false, error: 'Invalid JSON body' });
      }
      return json(res, 500, {
        ok: false,
        error: error?.message || 'Failed to analyze TikTok profile',
        stderr: error?.stderr || '',
      });
    }
  }

  if (url === '/api/creators/import-link' && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const body = await parseBody(req);
      const profileUrl = String(body?.url || '').trim();
      if (!profileUrl) {
        return json(res, 400, { ok: false, error: 'Creator profile link is required' });
      }
      if (!/tiktok\.com\/@/i.test(profileUrl)) {
        return json(res, 400, {
          ok: false,
          error: 'Please provide a valid TikTok profile link',
        });
      }

      const { data, stderr } = await runTikTokAnalyzeScript(profileUrl);
      const persistence = await persistTikTokAnalyzeMetrics(profileUrl, data, { allowCreate: true });
      if (!persistence.attempted) {
        return json(res, 422, {
          ok: false,
          error: `Unable to import creator (${persistence.reason || 'unknown_reason'})`,
        });
      }
      if (!persistence.creatorId) {
        return json(res, 422, {
          ok: false,
          error: 'Creator could not be imported from this link',
        });
      }

      return json(res, 200, {
        ok: true,
        data: persistence.creator,
        meta: {
          action: persistence.created ? 'created' : 'updated',
          creatorId: persistence.creatorId,
          metrics: persistence.metrics,
          stderrPreview: stderr ? String(stderr).slice(0, 500) : '',
        },
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        return json(res, 400, { ok: false, error: 'Invalid JSON body' });
      }
      return json(res, 500, {
        ok: false,
        error: error?.message || 'Failed to import creator from link',
        stderr: error?.stderr || '',
      });
    }
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
      const packageType = urlObj.searchParams.get('packageType');
      const includeInactive = urlObj.searchParams.get('includeInactive') === 'true';

      const conditions = [];
      const values = [];
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
        WITH ranked_packages AS (
          SELECT
            id,
            name,
            package_type,
            influencer_video_count,
            ugc_video_count,
            description,
            price_amount,
            currency,
            customizable,
            active,
            created_at,
            ROW_NUMBER() OVER (
              PARTITION BY
                LOWER(COALESCE(name, '')),
                package_type,
                COALESCE(influencer_video_count, -1),
                COALESCE(ugc_video_count, -1),
                COALESCE(description, ''),
                COALESCE(price_amount, 0),
                COALESCE(currency, 'USD'),
                COALESCE(customizable, false),
                COALESCE(active, true)
              ORDER BY updated_at DESC NULLS LAST, created_at DESC, id DESC
            ) AS dedupe_rank
          FROM campaign_packages
          ${whereClause}
        )
        SELECT
          id,
          name,
          package_type,
          influencer_video_count,
          ugc_video_count,
          description,
          price_amount,
          currency,
          customizable,
          active,
          created_at
        FROM ranked_packages
        WHERE dedupe_rank = 1
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
        influencer_video_count,
        ugc_video_count,
        description,
        price_amount,
        currency,
        customizable,
        active,
      } = body;

      if (!name || !package_type || price_amount === undefined) {
        return json(res, 400, { ok: false, error: 'Missing required package fields' });
      }

      const parsedInfluencerCount =
        influencer_video_count === '' || influencer_video_count == null
          ? null
          : Number(influencer_video_count);
      const parsedUgcCount =
        ugc_video_count === '' || ugc_video_count == null ? null : Number(ugc_video_count);
      const parsedPrice =
        price_amount === '' || price_amount == null ? null : Number(price_amount);

      if (parsedPrice == null || Number.isNaN(parsedPrice)) {
        return json(res, 400, { ok: false, error: 'Invalid price value' });
      }
      if (parsedInfluencerCount != null && Number.isNaN(parsedInfluencerCount)) {
        return json(res, 400, { ok: false, error: 'Invalid influencer video count' });
      }
      if (parsedUgcCount != null && Number.isNaN(parsedUgcCount)) {
        return json(res, 400, { ok: false, error: 'Invalid UGC video count' });
      }

      const hasDealTypeColumn = await hasCampaignPackageDealTypeColumn();
      const returningFields = `
        id,
        name,
        package_type,
        influencer_video_count,
        ugc_video_count,
        description,
        price_amount,
        currency,
        customizable,
        active,
        created_at
      `;

      const result = hasDealTypeColumn
        ? await pool.query(
            `
            INSERT INTO campaign_packages
              (name, package_type, deal_type, influencer_video_count, ugc_video_count, description,
               price_amount, currency, customizable, active, created_by_user_id)
            VALUES
              ($1, $2, 'paid', $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING ${returningFields}
            `,
            [
              name,
              package_type,
              parsedInfluencerCount,
              parsedUgcCount,
              description || null,
              parsedPrice,
              currency || 'USD',
              customizable === true,
              active !== false,
              user.id,
            ]
          )
        : await pool.query(
            `
            INSERT INTO campaign_packages
              (name, package_type, influencer_video_count, ugc_video_count, description,
               price_amount, currency, customizable, active, created_by_user_id)
            VALUES
              ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING ${returningFields}
            `,
            [
              name,
              package_type,
              parsedInfluencerCount,
              parsedUgcCount,
              description || null,
              parsedPrice,
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

  const packageUpdateMatch = pathname.match(/^\/api\/packages\/([0-9a-fA-F-]+)\/?$/);
  if (packageUpdateMatch && method === 'PUT') {
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
        influencer_video_count,
        ugc_video_count,
        description,
        price_amount,
        currency,
        customizable,
        active,
      } = body;

      if (!name || !package_type || price_amount === undefined) {
        return json(res, 400, { ok: false, error: 'Missing required package fields' });
      }

      const parsedInfluencerCount =
        influencer_video_count === '' || influencer_video_count == null
          ? null
          : Number(influencer_video_count);
      const parsedUgcCount =
        ugc_video_count === '' || ugc_video_count == null ? null : Number(ugc_video_count);
      const parsedPrice =
        price_amount === '' || price_amount == null ? null : Number(price_amount);

      if (parsedPrice == null || Number.isNaN(parsedPrice)) {
        return json(res, 400, { ok: false, error: 'Invalid price value' });
      }
      if (parsedInfluencerCount != null && Number.isNaN(parsedInfluencerCount)) {
        return json(res, 400, { ok: false, error: 'Invalid influencer video count' });
      }
      if (parsedUgcCount != null && Number.isNaN(parsedUgcCount)) {
        return json(res, 400, { ok: false, error: 'Invalid UGC video count' });
      }

      const packageId = packageUpdateMatch[1];
      const result = await pool.query(
        `
        UPDATE campaign_packages
        SET name = $1,
            package_type = $2,
            influencer_video_count = $3,
            ugc_video_count = $4,
            description = $5,
            price_amount = $6,
            currency = $7,
            customizable = $8,
            active = $9,
            updated_at = NOW()
        WHERE id = $10
        RETURNING id, name, package_type, influencer_video_count, ugc_video_count,
                  description, price_amount, currency, customizable, active, created_at
        `,
        [
          name,
          package_type,
          parsedInfluencerCount,
          parsedUgcCount,
          description || null,
          parsedPrice,
          currency || 'USD',
          customizable === true,
          active !== false,
          packageId,
        ]
      );

      if (result.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'Package not found' });
      }

      const row = result.rows[0];
      return json(res, 200, {
        ok: true,
        data: { ...row, price_amount: row.price_amount != null ? Number(row.price_amount) : null },
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const packageDeleteMatch = pathname.match(/^\/api\/packages\/([0-9a-fA-F-]+)\/?$/);
  if (packageDeleteMatch && method === 'DELETE') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const packageId = packageDeleteMatch[1];
      const result = await pool.query(
        `DELETE FROM campaign_packages WHERE id = $1 RETURNING id`,
        [packageId]
      );
      if (result.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Package not found' });
      }
      return json(res, 200, { ok: true, id: result.rows[0].id });
    } catch (error) {
      if (error.code === '23503') {
        return json(res, 409, { ok: false, error: 'Package is in use by a campaign.' });
      }
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if ((url === '/api/creator-stages' || url.startsWith('/api/creator-stages?')) && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const campaignTypeFilter = normalizeCampaignType(urlObj.searchParams.get('campaignType'));
      const includeInactive = urlObj.searchParams.get('includeInactive') === 'true';

      const conditions = [];
      const values = [];
      if (campaignTypeFilter) {
        values.push(campaignTypeFilter);
        conditions.push(`campaign_type = $${values.length}`);
      }
      if (!includeInactive) {
        conditions.push('active = true');
      }
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

      const result = await pool.query(
        `
        SELECT id, campaign_type, label, sort_order, active, created_at, updated_at
        FROM creator_stage_definitions
        ${whereClause}
        ORDER BY campaign_type ASC, sort_order ASC, label ASC
        `,
        values
      );

      return json(res, 200, { ok: true, data: result.rows });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/creator-stages' && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const body = await parseBody(req);
      const campaignType = normalizeCampaignType(body.campaignType || body.campaign_type);
      const label = String(body.label || '').trim();
      if (!campaignType) {
        return json(res, 400, { ok: false, error: 'campaignType is required' });
      }
      if (!label) {
        return json(res, 400, { ok: false, error: 'label is required' });
      }

      const nextOrderResult = await pool.query(
        `
        SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_sort_order
        FROM creator_stage_definitions
        WHERE campaign_type = $1
        `,
        [campaignType]
      );
      const nextSortOrder = Number(nextOrderResult.rows[0]?.next_sort_order || 1);

      const result = await pool.query(
        `
        INSERT INTO creator_stage_definitions
          (campaign_type, label, sort_order, active)
        VALUES
          ($1, $2, $3, true)
        RETURNING id, campaign_type, label, sort_order, active, created_at, updated_at
        `,
        [campaignType, label, nextSortOrder]
      );

      return json(res, 201, { ok: true, data: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') {
        return json(res, 409, { ok: false, error: 'Status already exists for this campaign type.' });
      }
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const creatorStageDeleteMatch = pathname.match(/^\/api\/creator-stages\/([0-9a-fA-F-]+)\/?$/);
  if (creatorStageDeleteMatch && method === 'DELETE') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const stageId = creatorStageDeleteMatch[1];
      const result = await pool.query(
        `
        DELETE FROM creator_stage_definitions
        WHERE id = $1
        RETURNING id
        `,
        [stageId]
      );
      if (result.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Status not found' });
      }
      return json(res, 200, { ok: true, id: result.rows[0].id });
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

      if (user.role === 'brand' && !brandMembership?.id) {
        return json(res, 200, { ok: true, data: [] });
      }

      const values = [];
      let whereClause = '';
      const scopedOrgId = user.role === 'brand' ? brandMembership.id : organizationId;
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
        campaignTypeDetail,
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

      const normalizedStatus = normalizeCampaignStatus(status, { fallback: null });
      if (
        status !== undefined &&
        status !== null &&
        status !== '' &&
        normalizedStatus == null
      ) {
        return json(res, 400, { ok: false, error: 'Invalid campaign status' });
      }
      if (user.role !== 'admin' && normalizedStatus && normalizedStatus !== 'Planning') {
        return json(res, 403, { ok: false, error: 'Only admin can set campaign status' });
      }
      const resolvedStatus = user.role === 'admin' ? normalizedStatus || 'Planning' : 'Planning';

      if (!name) {
        return json(res, 400, { ok: false, error: 'Campaign name is required' });
      }

      const brandMembership =
        user.role === 'brand' ? await getBrandMembership(user.id) : null;
      if (user.role === 'brand' && !brandMembership?.id) {
        return json(res, 403, { ok: false, error: 'Brand organization is not assigned' });
      }

      let resolvedOrgId = user.role === 'brand' ? brandMembership.id : organizationId;
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
          campaign_type_detail,
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
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21
        )
        RETURNING *
        `,
        [
          resolvedOrgId,
          name,
          objectivesArray.length ? objectivesArray.join(', ') : null,
          resolvedStatus,
          startDate || null,
          endDate || null,
          campaignType || null,
          campaignTypeDetail || null,
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

      await createOrgNotification(
        row.organization_id,
        `Campaign created: ${row.name}`,
        'In-app',
        user.id
      );

      return json(res, 201, { ok: true, data: mapCampaignRow(responseRow) });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignUpdateMatch = pathname.match(/^\/api\/campaigns\/([0-9a-fA-F-]+)\/?$/);
  if (campaignUpdateMatch && method === 'PUT') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'employee') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const campaignId = campaignUpdateMatch[1];
      const existingResult = await pool.query('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
      if (existingResult.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const existing = existingResult.rows[0];

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
        campaignTypeDetail,
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
      const hasStatusUpdate = Object.prototype.hasOwnProperty.call(body, 'status');
      let resolvedStatus = existing.status;
      if (hasStatusUpdate) {
        const normalizedStatus = normalizeCampaignStatus(status, { fallback: null });
        if (normalizedStatus == null) {
          return json(res, 400, { ok: false, error: 'Invalid campaign status' });
        }
        if (user.role !== 'admin') {
          return json(res, 403, { ok: false, error: 'Only admin can update campaign status' });
        }
        resolvedStatus = normalizedStatus;
      }

      let resolvedOrgId = organizationId || existing.organization_id;
      if (!organizationId && brand) {
        const orgResult = await pool.query(
          `SELECT id FROM organizations WHERE org_type = 'BRAND' AND name = $1`,
          [brand]
        );
        if (orgResult.rows.length === 0) {
          return json(res, 400, { ok: false, error: 'Brand not found' });
        }
        resolvedOrgId = orgResult.rows[0].id;
      }

      const objectivesArray = normalizeTextArray(
        objectives !== undefined ? objectives : existing.objectives
      );
      const platformsArray = normalizeTextArray(
        platforms !== undefined ? platforms : existing.platforms
      );
      const contentFormatsArray = normalizeTextArray(
        contentFormat !== undefined ? contentFormat : existing.content_formats
      );
      const creatorTiersArray = normalizeTextArray(
        creatorTiers !== undefined ? creatorTiers : existing.creator_tiers
      );

      const hasPackageId = Object.prototype.hasOwnProperty.call(body, 'packageId');
      const resolvedPackageId = hasPackageId
        ? packageId === '' ? null : packageId
        : existing.package_id;
      let packagePriceSnapshot = existing.package_price_snapshot;
      let packageInfluencerCount = existing.influencer_video_count;
      let packageUgcCount = existing.ugc_video_count;

      if (hasPackageId && resolvedPackageId) {
        const packageResult = await pool.query(
          `SELECT price_amount, influencer_video_count, ugc_video_count FROM campaign_packages WHERE id = $1`,
          [resolvedPackageId]
        );
        if (packageResult.rows.length === 0) {
          return json(res, 400, { ok: false, error: 'Invalid package selected' });
        }
        packagePriceSnapshot = packageResult.rows[0].price_amount;
        packageInfluencerCount = packageResult.rows[0].influencer_video_count;
        packageUgcCount = packageResult.rows[0].ugc_video_count;
      }

      const updateResult = await pool.query(
        `
        UPDATE campaigns
        SET organization_id = $1,
            name = $2,
            objective = $3,
            status = $4,
            start_date = $5,
            end_date = $6,
            campaign_type = $7,
            campaign_type_detail = $8,
            deal_type = $9,
            target_audience = $10,
            deliverables = $11,
            notes = $12,
            platforms = $13,
            objectives = $14,
            content_formats = $15,
            creator_tiers = $16,
            package_id = $17,
            package_price_snapshot = $18,
            custom_package_label = $19,
            ugc_video_count = $20,
            influencer_video_count = $21,
            updated_at = NOW()
        WHERE id = $22
        RETURNING *
        `,
        [
          resolvedOrgId,
          name ?? existing.name,
          objectivesArray.length ? objectivesArray.join(', ') : existing.objective,
          resolvedStatus,
          startDate ?? existing.start_date,
          endDate ?? existing.end_date,
          campaignType ?? existing.campaign_type,
          campaignTypeDetail ?? existing.campaign_type_detail,
          dealType ?? existing.deal_type,
          targetAudience ?? existing.target_audience,
          deliverables ?? existing.deliverables,
          notes ?? existing.notes,
          platformsArray,
          objectivesArray,
          contentFormatsArray,
          creatorTiersArray,
          resolvedPackageId ?? null,
          packagePriceSnapshot != null ? Number(packagePriceSnapshot) : null,
          customPackageLabel ?? existing.custom_package_label,
          ugcVideoCount ?? packageUgcCount ?? existing.ugc_video_count,
          influencerVideoCount ?? packageInfluencerCount ?? existing.influencer_video_count,
          campaignId,
        ]
      );

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
        WHERE c.id = $1
        `,
        [updateResult.rows[0].id]
      );

      const responseRow = result.rows[0];
      return json(res, 200, { ok: true, data: mapCampaignRow(responseRow) });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignEventsMatch = pathname.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/events\/?$/
  );
  if (campaignEventsMatch && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const campaignId = campaignEventsMatch[1];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const result = await pool.query(
        `
        SELECT
          id,
          campaign_id,
          organization_id,
          title,
          description,
          event_type,
          event_date,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        FROM campaign_events
        WHERE campaign_id = $1
        ORDER BY event_date ASC, created_at ASC
        `,
        [campaignId]
      );

      return json(res, 200, {
        ok: true,
        data: result.rows.map(mapCampaignEventRow),
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (campaignEventsMatch && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'employee' && user.role !== 'brand') {
      return json(res, 403, { ok: false, error: 'Forbidden' });
    }
    try {
      const campaignId = campaignEventsMatch[1];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const body = await parseBody(req);
      const title = String(body.title || '').trim();
      const description = String(body.description || '').trim();
      const type = normalizeCampaignEventType(body.type, { fallback: null });
      const eventDate = String(body.eventDate || body.date || '').trim();

      if (!title) {
        return json(res, 400, { ok: false, error: 'title is required' });
      }
      if (!type) {
        return json(res, 400, { ok: false, error: 'Invalid event type' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
        return json(res, 400, { ok: false, error: 'eventDate must be YYYY-MM-DD' });
      }

      const result = await pool.query(
        `
        INSERT INTO campaign_events
          (campaign_id, organization_id, title, description, event_type, event_date, created_by_user_id, updated_by_user_id)
        VALUES
          ($1, $2, $3, $4, $5, $6::date, $7, $7)
        RETURNING
          id,
          campaign_id,
          organization_id,
          title,
          description,
          event_type,
          event_date,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        `,
        [campaignId, organizationId, title, description || null, type, eventDate, user.id]
      );

      return json(res, 201, {
        ok: true,
        data: mapCampaignEventRow(result.rows[0]),
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignEventByIdMatch = pathname.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/events\/([0-9a-fA-F-]+)\/?$/
  );
  if (campaignEventByIdMatch && method === 'PUT') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'employee' && user.role !== 'brand') {
      return json(res, 403, { ok: false, error: 'Forbidden' });
    }
    try {
      const campaignId = campaignEventByIdMatch[1];
      const eventId = campaignEventByIdMatch[2];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const existingResult = await pool.query(
        `
        SELECT id, title, description, event_type, event_date
        FROM campaign_events
        WHERE id = $1 AND campaign_id = $2
        `,
        [eventId, campaignId]
      );
      if (existingResult.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Event not found' });
      }
      const existing = existingResult.rows[0];

      const body = await parseBody(req);
      const title = Object.prototype.hasOwnProperty.call(body, 'title')
        ? String(body.title || '').trim()
        : existing.title;
      const description = Object.prototype.hasOwnProperty.call(body, 'description')
        ? String(body.description || '').trim()
        : existing.description;
      const type = Object.prototype.hasOwnProperty.call(body, 'type')
        ? normalizeCampaignEventType(body.type, { fallback: null })
        : normalizeCampaignEventType(existing.event_type, { fallback: 'milestone' });
      const eventDate = Object.prototype.hasOwnProperty.call(body, 'eventDate')
        ? String(body.eventDate || '').trim()
        : typeof existing.event_date === 'string'
          ? existing.event_date
          : existing.event_date
            ? existing.event_date.toISOString().slice(0, 10)
            : '';

      if (!title) {
        return json(res, 400, { ok: false, error: 'title is required' });
      }
      if (!type) {
        return json(res, 400, { ok: false, error: 'Invalid event type' });
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
        return json(res, 400, { ok: false, error: 'eventDate must be YYYY-MM-DD' });
      }

      const updateResult = await pool.query(
        `
        UPDATE campaign_events
        SET
          title = $1,
          description = $2,
          event_type = $3,
          event_date = $4::date,
          updated_by_user_id = $5,
          updated_at = NOW()
        WHERE id = $6
          AND campaign_id = $7
        RETURNING
          id,
          campaign_id,
          organization_id,
          title,
          description,
          event_type,
          event_date,
          created_by_user_id,
          updated_by_user_id,
          created_at,
          updated_at
        `,
        [title, description || null, type, eventDate, user.id, eventId, campaignId]
      );

      return json(res, 200, {
        ok: true,
        data: mapCampaignEventRow(updateResult.rows[0]),
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (campaignEventByIdMatch && method === 'DELETE') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'employee' && user.role !== 'brand') {
      return json(res, 403, { ok: false, error: 'Forbidden' });
    }
    try {
      const campaignId = campaignEventByIdMatch[1];
      const eventId = campaignEventByIdMatch[2];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const deleteResult = await pool.query(
        `
        DELETE FROM campaign_events
        WHERE id = $1 AND campaign_id = $2
        RETURNING id
        `,
        [eventId, campaignId]
      );
      if (deleteResult.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Event not found' });
      }
      return json(res, 200, { ok: true, id: deleteResult.rows[0].id });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignCreatorsMatch = pathname.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/?$/
  );
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
          workflowStatus: row.workflow_status || '',
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

  const campaignSuggestMatch = pathname.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/suggest\/?$/
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

      const insertResult = await pool.query(
        `
        INSERT INTO campaign_invitations
          (campaign_id, creator_id, status, created_by_user_id, brand_decision, shortlist_rank)
        VALUES ($1, $2, 'shortlisted', $3, 'pending', $4)
        ON CONFLICT (campaign_id, creator_id) DO NOTHING
        RETURNING id
        `,
        [campaignId, creatorId, user.id, nextRank]
      );

      if (insertResult.rowCount > 0) {
        const campaignContext = await getCampaignContext(campaignId);
        const creatorName = await getCreatorDisplayName(creatorId);
        await createOrgNotification(
          campaignContext?.organization_id,
          `Creator suggested for ${campaignContext?.name || 'campaign'}: ${creatorName}`,
          'In-app',
          user.id
        );
      }

      return json(res, 201, { ok: true });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignUnsuggestMatch = pathname.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/([0-9a-fA-F-]+)\/suggest\/?$/
  );
  if (campaignUnsuggestMatch && method === 'DELETE') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'employee') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const campaignId = campaignUnsuggestMatch[1];
      const creatorId = campaignUnsuggestMatch[2];
      const organizationId = await getCampaignOrganizationId(campaignId);
      if (!organizationId) {
        return json(res, 404, { ok: false, error: 'Campaign not found' });
      }
      const hasAccess = await ensureOrgAccess(user, organizationId);
      if (!hasAccess) {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }

      const inviteResult = await pool.query(
        `
        SELECT brand_decision
        FROM campaign_invitations
        WHERE campaign_id = $1 AND creator_id = $2
        `,
        [campaignId, creatorId]
      );
      if (inviteResult.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Creator is not suggested for this campaign' });
      }
      const decision = String(inviteResult.rows[0]?.brand_decision || 'pending').toLowerCase();
      if (decision !== 'pending') {
        return json(res, 409, {
          ok: false,
          error: 'Cannot undo suggestion after brand decision. Ask brand to reset decision first.',
        });
      }

      await pool.query(
        `
        DELETE FROM campaign_participants
        WHERE campaign_id = $1 AND creator_id = $2
        `,
        [campaignId, creatorId]
      );
      await pool.query(
        `
        DELETE FROM campaign_invitations
        WHERE campaign_id = $1 AND creator_id = $2
        `,
        [campaignId, creatorId]
      );

      const campaignContext = await getCampaignContext(campaignId);
      const creatorName = await getCreatorDisplayName(creatorId);
      await createOrgNotification(
        campaignContext?.organization_id,
        `Creator removed from ${campaignContext?.name || 'campaign'}: ${creatorName}`,
        'In-app',
        user.id
      );

      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const campaignDecisionMatch = pathname.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/([0-9a-fA-F-]+)\/decision\/?$/
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
      const resolvedNote = decision === 'rejected' ? note : null;

      const updateResult = await pool.query(
        `
        UPDATE campaign_invitations
        SET brand_decision = $1,
            brand_decision_note = $2,
            brand_decided_at = CASE WHEN $1 = 'pending' THEN NULL ELSE NOW() END,
            brand_decided_by_user_id = CASE
              WHEN $1 = 'pending' THEN NULL::uuid
              ELSE $3::uuid
            END
        WHERE campaign_id = $4 AND creator_id = $5
        RETURNING id
        `,
        [decision, resolvedNote, user.id, campaignId, creatorId]
      );

      if (updateResult.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'Invitation not found' });
      }

      const campaignContext = await getCampaignContext(campaignId);
      const creatorName = await getCreatorDisplayName(creatorId);
      const decisionLabel =
        decision === 'approved' ? 'approved' : decision === 'rejected' ? 'rejected' : 'reset';
      await createOrgNotification(
        campaignContext?.organization_id,
        `Creator ${decisionLabel} for ${campaignContext?.name || 'campaign'}: ${creatorName}`,
        'In-app',
        user.id
      );

      if (decision === 'approved') {
        const defaultCreatorStage = await getDefaultCreatorStageForCampaign(campaignId);
        await pool.query(
          `
          INSERT INTO campaign_participants
            (campaign_id, creator_id, state, created_at, accepted_at, workflow_status, created_by_user_id)
          SELECT $1, $2, 'active', NOW(), NOW(), $3, $4
          WHERE NOT EXISTS (
            SELECT 1 FROM campaign_participants WHERE campaign_id = $1 AND creator_id = $2
          )
          `,
          [campaignId, creatorId, defaultCreatorStage, user.id]
        );
      } else if (decision === 'rejected' || decision === 'pending') {
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

  const campaignWorkflowMatch = pathname.match(
    /^\/api\/campaigns\/([0-9a-fA-F-]+)\/creators\/([0-9a-fA-F-]+)\/workflow\/?$/
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
      const normalizedWorkflowStatus =
        workflowStatus === undefined ? undefined : String(workflowStatus || '').trim();
      if (workflowStatus === undefined && finalVideoLink === undefined) {
        return json(res, 400, { ok: false, error: 'Nothing to update' });
      }

      if (workflowStatus !== undefined) {
        if (!normalizedWorkflowStatus) {
          return json(res, 400, { ok: false, error: 'workflowStatus cannot be empty' });
        }
        const campaignTypeResult = await pool.query(
          `SELECT campaign_type FROM campaigns WHERE id = $1`,
          [campaignId]
        );
        const campaignType = normalizeCampaignType(campaignTypeResult.rows[0]?.campaign_type) || 'Hybrid';
        const allowedStatuses = await getCreatorStagesByType(campaignType);
        if (allowedStatuses.length > 0 && !allowedStatuses.includes(normalizedWorkflowStatus)) {
          return json(res, 400, {
            ok: false,
            error: `Invalid workflowStatus for ${campaignType} campaign`,
          });
        }
      }

      const existingResult = await pool.query(
        `
        SELECT final_video_link
        FROM campaign_participants
        WHERE campaign_id = $1 AND creator_id = $2
        `,
        [campaignId, creatorId]
      );

      const previousFinalLink = existingResult.rows[0]?.final_video_link || null;

      const updateResult = await pool.query(
        `
        UPDATE campaign_participants
        SET workflow_status = COALESCE($1, workflow_status),
            final_video_link = COALESCE($2, final_video_link)
        WHERE campaign_id = $3 AND creator_id = $4
        RETURNING id
        `,
        [normalizedWorkflowStatus || null, finalVideoLink || null, campaignId, creatorId]
      );

      if (updateResult.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'Participant not found' });
      }

      if (finalVideoLink && finalVideoLink !== previousFinalLink) {
        const existingAsset = await pool.query(
          `
          SELECT a.id
          FROM content_assets a
          JOIN content_submissions s ON s.id = a.content_submission_id
          WHERE s.campaign_id = $1
            AND s.creator_id = $2
            AND a.published_url = $3
          LIMIT 1
          `,
          [campaignId, creatorId, finalVideoLink]
        );

        if (existingAsset.rowCount === 0) {
          const submissionResult = await pool.query(
            `
            INSERT INTO content_submissions
              (campaign_id, creator_id, status, version_count, notes, created_at, updated_at)
            VALUES ($1, $2, 'Pending Review', 1, $3, NOW(), NOW())
            RETURNING id
            `,
            [campaignId, creatorId, body.notes || 'Submitted from creator workflow']
          );
          const submissionId = submissionResult.rows[0]?.id;
          if (submissionId) {
            await pool.query(
              `
              INSERT INTO content_assets
                (content_submission_id, content_type, caption, published_url, published_at, created_at)
              VALUES ($1, $2, $3, $4, NOW(), NOW())
              `,
              [
                submissionId,
                body.submissionType || body.type || 'Video',
                body.notes || null,
                finalVideoLink,
              ]
            );
          }
        }

        const campaignContext = await getCampaignContext(campaignId);
        const creatorName = await getCreatorDisplayName(creatorId);
        await createOrgNotification(
          campaignContext?.organization_id,
          `Final video submitted for ${campaignContext?.name || 'campaign'}: ${creatorName}`,
          'In-app',
          user.id
        );
      }

      return json(res, 200, { ok: true });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (url === '/api/content' || url.startsWith('/api/content?')) {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (method !== 'GET') {
      return json(res, 405, { ok: false, error: 'Method not allowed' });
    }
    if (!['admin', 'employee', 'brand'].includes(user.role)) {
      return json(res, 403, { ok: false, error: 'Forbidden' });
    }
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const campaignId = urlObj.searchParams.get('campaignId');
      const parsedLimit = parseInt(urlObj.searchParams.get('limit') || '250', 10);
      const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 1000) : 250;
      const values = [];
      const conditions = [];

      if (campaignId) {
        values.push(campaignId);
        conditions.push(`s.campaign_id = $${values.length}`);
      }

      if (user.role === 'brand') {
        const membership = await getBrandMembership(user.id);
        if (!membership?.id) {
          return json(res, 200, { ok: true, data: [] });
        }
        values.push(membership.id);
        conditions.push(`c.organization_id = $${values.length}`);
      }

      values.push(limit);
      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limitIdx = values.length;

      const result = await pool.query(
        `
        SELECT
          s.id AS submission_id,
          s.campaign_id,
          s.creator_id,
          s.status AS submission_status,
          s.version_count,
          s.notes AS submission_notes,
          s.created_at AS submitted_at,
          a.id AS asset_id,
          a.content_type AS asset_content_type,
          a.caption AS asset_caption,
          a.published_url AS asset_url,
          latest.views,
          latest.likes,
          latest.comments,
          latest.shares,
          latest.saves,
          latest.reach
        FROM content_submissions s
        JOIN campaigns c ON c.id = s.campaign_id
        LEFT JOIN content_assets a ON a.content_submission_id = s.id
        LEFT JOIN LATERAL (
          SELECT
            cas.views,
            cas.likes,
            cas.comments,
            cas.shares,
            cas.saves,
            cas.reach
          FROM content_analytics_snapshots cas
          WHERE cas.content_asset_id = a.id
          ORDER BY cas.captured_at DESC NULLS LAST, cas.created_at DESC
          LIMIT 1
        ) latest ON true
        ${whereClause}
        ORDER BY s.created_at DESC
        LIMIT $${limitIdx}
        `,
        values
      );

      return json(res, 200, { ok: true, data: result.rows.map(mapContentRow) });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const creatorByIdMatch = pathname.match(/^\/api\/creators\/([^/]+)\/?$/);
  if (creatorByIdMatch && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const creatorId = decodeURIComponent(creatorByIdMatch[1]);
      const result = await pool.query(
        `
        SELECT
          id,
          display_name,
          primary_niche,
          country,
          status,
          creator_type,
          phone,
          handle,
          tiktok_url,
          instagram_url,
          instagram_handle,
          tiktok_handle,
          followers,
          category,
          portfolio_url,
          age,
          gender,
          languages,
          accepts_gifted_collab,
          turnaround_time,
          has_equipment,
          can_voiceover,
          base_rate,
          profile_image,
          has_mock_video,
          notes,
          ugc_video_urls,
          engagement_rate,
          avg_views,
          created_at,
          updated_at
        FROM creators
        WHERE id = $1
        `,
        [creatorId]
      );
      if (result.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Creator not found' });
      }
      return json(res, 200, { ok: true, data: sanitizeCreatorProfileImage(result.rows[0]) });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (creatorByIdMatch && method === 'PUT') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const creatorId = decodeURIComponent(creatorByIdMatch[1]);
      const body = await parseBody(req);

      const toNullableText = (value) => {
        if (value === undefined || value === null) return null;
        const text = String(value).trim();
        return text.length ? text : null;
      };

      const toNullableInteger = (value, fieldName) => {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
          throw new Error(`Invalid ${fieldName}`);
        }
        return num;
      };

      const toNullableNumber = (value, fieldName) => {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
          throw new Error(`Invalid ${fieldName}`);
        }
        return num;
      };

      const toNullableBoolean = (value, fieldName) => {
        if (value === undefined || value === null || value === '') return null;
        if (typeof value === 'boolean') return value;
        const normalized = String(value).trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n'].includes(normalized)) return false;
        throw new Error(`Invalid ${fieldName}`);
      };

      const toTextArray = (value) => {
        if (value === undefined || value === null || value === '') return [];
        const items = Array.isArray(value) ? value : String(value).split(',');
        return items
          .map((item) => String(item == null ? '' : item).trim())
          .filter(Boolean);
      };

      const creatorType = toNullableText(body.creator_type);
      if (creatorType && !['UGC', 'Influencer'].includes(creatorType)) {
        return json(res, 400, { ok: false, error: 'Invalid creator_type' });
      }

      const values = [
        toNullableText(body.display_name),
        toNullableText(body.primary_niche),
        toNullableText(body.country),
        toNullableText(body.status),
        creatorType,
        toNullableText(body.phone),
        toNullableText(body.handle),
        toNullableText(body.tiktok_url),
        toNullableText(body.instagram_url),
        toNullableText(body.instagram_handle),
        toNullableText(body.tiktok_handle),
        toNullableInteger(body.followers, 'followers'),
        toNullableText(body.category),
        toNullableText(body.portfolio_url),
        toNullableInteger(body.age, 'age'),
        toNullableText(body.gender),
        toNullableText(body.languages),
        toNullableBoolean(body.accepts_gifted_collab, 'accepts_gifted_collab'),
        toNullableText(body.turnaround_time),
        toNullableBoolean(body.has_equipment, 'has_equipment'),
        toNullableBoolean(body.can_voiceover, 'can_voiceover'),
        toNullableNumber(body.base_rate, 'base_rate'),
        toNullableText(body.profile_image),
        toNullableBoolean(body.has_mock_video, 'has_mock_video'),
        toNullableText(body.notes),
        toTextArray(body.ugc_video_urls),
        toNullableNumber(body.engagement_rate, 'engagement_rate'),
        toNullableInteger(body.avg_views, 'avg_views'),
        creatorId,
      ];

      const result = await pool.query(
        `
        UPDATE creators
        SET
          display_name = $1,
          primary_niche = $2,
          country = $3,
          status = $4,
          creator_type = $5,
          phone = $6,
          handle = $7,
          tiktok_url = $8,
          instagram_url = $9,
          instagram_handle = $10,
          tiktok_handle = $11,
          followers = $12,
          category = $13,
          portfolio_url = $14,
          age = $15,
          gender = $16,
          languages = $17,
          accepts_gifted_collab = $18,
          turnaround_time = $19,
          has_equipment = $20,
          can_voiceover = $21,
          base_rate = $22,
          profile_image = $23,
          has_mock_video = $24,
          notes = $25,
          ugc_video_urls = $26,
          engagement_rate = $27,
          avg_views = $28,
          updated_at = NOW()
        WHERE id = $29
        RETURNING
          id,
          display_name,
          primary_niche,
          country,
          status,
          creator_type,
          phone,
          handle,
          tiktok_url,
          instagram_url,
          instagram_handle,
          tiktok_handle,
          followers,
          category,
          portfolio_url,
          age,
          gender,
          languages,
          accepts_gifted_collab,
          turnaround_time,
          has_equipment,
          can_voiceover,
          base_rate,
          profile_image,
          has_mock_video,
          notes,
          ugc_video_urls,
          engagement_rate,
          avg_views,
          created_at,
          updated_at
        `,
        values
      );

      if (result.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Creator not found' });
      }

      return json(res, 200, { ok: true, data: sanitizeCreatorProfileImage(result.rows[0]) });
    } catch (error) {
      return json(res, 400, { ok: false, error: error.message });
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

      const countResult = await pool.query(
        `SELECT COUNT(*) FROM creators WHERE creator_type = 'Influencer'`
      );
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `
        SELECT
          id,
          display_name AS name,
          handle,
          tiktok_url,
          instagram_url,
          instagram_handle,
          tiktok_handle,
          followers,
          primary_niche AS niche,
          phone,
          COALESCE(country, '') AS region,
          notes,
          category,
          profile_image,
          engagement_rate,
          avg_views,
          age,
          gender,
          base_rate,
          portfolio_url,
          creator_type,
          status,
          created_at
        FROM creators
        WHERE creator_type = 'Influencer'
        ORDER BY name ASC
        LIMIT $1 OFFSET $2
      `,
        [limit, offset]
      );

      return json(res, 200, {
        ok: true,
        data: sanitizeCreatorProfileImageList(result.rows),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (method === 'POST' && url === '/api/ugc-creators') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const body = await parseBody(req);

      const toNullableText = (value) => {
        if (value === undefined || value === null) return null;
        const text = String(value).trim();
        return text.length ? text : null;
      };

      const toNullableInteger = (value, fieldName) => {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0) {
          throw new Error(`Invalid ${fieldName}`);
        }
        return num;
      };

      const toNullableNumber = (value, fieldName) => {
        if (value === undefined || value === null || value === '') return null;
        const num = Number(value);
        if (!Number.isFinite(num) || num < 0) {
          throw new Error(`Invalid ${fieldName}`);
        }
        return num;
      };

      const toBoolean = (value) => {
        if (value === undefined || value === null || value === '') return false;
        if (typeof value === 'boolean') return value;
        const normalized = String(value).trim().toLowerCase();
        if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
        if (['false', '0', 'no', 'n'].includes(normalized)) return false;
        return false;
      };

      const payload = {
        name: toNullableText(body.name),
        phone: toNullableText(body.phone),
        handle: toNullableText(body.handle),
        niche: toNullableText(body.niche),
        has_mock_video: toBoolean(body.has_mock_video),
        portfolio_url: toNullableText(body.portfolio_url),
        ugc_video_urls: normalizeTextArray(body.ugc_video_urls),
        age: toNullableInteger(body.age, 'age'),
        gender: toNullableText(body.gender),
        languages: toNullableText(body.languages),
        accepts_gifted_collab: toBoolean(body.accepts_gifted_collab),
        turnaround_time: toNullableText(body.turnaround_time),
        has_equipment: toBoolean(body.has_equipment),
        can_voiceover: toBoolean(body.can_voiceover),
        base_rate: toNullableNumber(body.base_rate, 'base_rate'),
        region: toNullableText(body.region),
        notes: toNullableText(body.notes),
        profile_image: toNullableText(body.profile_image),
      };

      if (!payload.name) return json(res, 400, { ok: false, error: 'name is required' });
      if (!payload.handle) return json(res, 400, { ok: false, error: 'handle is required' });
      if (!payload.niche) return json(res, 400, { ok: false, error: 'niche is required' });
      if (payload.age == null) return json(res, 400, { ok: false, error: 'age is required' });
      if (!payload.gender) return json(res, 400, { ok: false, error: 'gender is required' });
      if (!payload.turnaround_time) {
        return json(res, 400, { ok: false, error: 'turnaround_time is required' });
      }
      if (payload.base_rate == null) {
        return json(res, 400, { ok: false, error: 'base_rate is required' });
      }

      const result = await pool.query(
        `
        INSERT INTO creators (
          display_name,
          phone,
          handle,
          primary_niche,
          has_mock_video,
          portfolio_url,
          ugc_video_urls,
          age,
          gender,
          languages,
          accepts_gifted_collab,
          turnaround_time,
          has_equipment,
          can_voiceover,
          base_rate,
          country,
          notes,
          profile_image,
          status,
          creator_type,
          created_at,
          updated_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,'active','UGC',NOW(),NOW()
        )
        RETURNING
          id,
          display_name AS name,
          phone,
          handle,
          primary_niche AS niche,
          has_mock_video,
          portfolio_url,
          ugc_video_urls,
          age,
          gender,
          languages,
          accepts_gifted_collab,
          turnaround_time,
          has_equipment,
          can_voiceover,
          base_rate,
          COALESCE(country, '') AS region,
          notes,
          profile_image,
          created_at
        `,
        [
          payload.name,
          payload.phone,
          payload.handle,
          payload.niche,
          payload.has_mock_video,
          payload.portfolio_url,
          payload.ugc_video_urls,
          payload.age,
          payload.gender,
          payload.languages,
          payload.accepts_gifted_collab,
          payload.turnaround_time,
          payload.has_equipment,
          payload.can_voiceover,
          payload.base_rate,
          payload.region,
          payload.notes,
          payload.profile_image,
        ]
      );

      return json(res, 201, {
        ok: true,
        data: sanitizeCreatorProfileImage(result.rows[0]),
      });
    } catch (error) {
      return json(res, 400, { ok: false, error: error.message });
    }
  }

  if (method === 'GET' && (url === '/api/ugc-creators' || url.startsWith('/api/ugc-creators?'))) {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const page = parseInt(urlObj.searchParams.get('page')) || 1;
      const limit = parseInt(urlObj.searchParams.get('limit')) || 20;
      const offset = (page - 1) * limit;

      const countResult = await pool.query(`SELECT COUNT(*) FROM creators WHERE creator_type = 'UGC'`);
      const total = parseInt(countResult.rows[0].count);

      const result = await pool.query(
        `
        SELECT
          id,
          display_name AS name,
          phone,
          handle,
          primary_niche AS niche,
          has_mock_video,
          portfolio_url,
          ugc_video_urls,
          age,
          gender,
          languages,
          accepts_gifted_collab,
          turnaround_time,
          has_equipment,
          can_voiceover,
          base_rate,
          COALESCE(country, '') AS region,
          notes,
          profile_image,
          created_at
        FROM creators
        WHERE creator_type = 'UGC'
        ORDER BY name ASC
        LIMIT $1 OFFSET $2
      `,
        [limit, offset]
      );

      return json(res, 200, {
        ok: true,
        data: sanitizeCreatorProfileImageList(result.rows),
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
        let result;
        if (user.role === 'brand') {
          const brandMembership = await getBrandMembership(user.id);
          if (!brandMembership?.id) {
            return json(res, 200, { ok: true, data: [] });
          }
          result = await pool.query(
            `SELECT id, name, logo_url, created_at
             FROM organizations
             WHERE org_type = 'BRAND' AND id = $1
             ORDER BY name ASC`,
            [brandMembership.id]
          );
        } else {
          result = await pool.query(
            `SELECT id, name, logo_url, created_at
             FROM organizations
             WHERE org_type = 'BRAND'
             ORDER BY name ASC`
          );
        }
        return json(res, 200, { ok: true, data: result.rows });
      } catch (error) {
        return json(res, 500, { ok: false, error: error.message });
      }
    }
    if (method === 'POST') {
      if (user.role !== 'admin') {
        return json(res, 403, { ok: false, error: 'Admin access required' });
      }
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

  const brandByIdMatch = pathname.match(/^\/api\/brands\/([0-9a-fA-F-]+)\/?$/);
  if (method === 'PUT' && brandByIdMatch) {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const brandId = brandByIdMatch[1];
      const body = await parseBody(req);
      const { name, logo_url } = body;
      if (!name || !String(name).trim()) {
        return json(res, 400, { ok: false, error: 'Brand name is required' });
      }

      const existing = await pool.query(
        `
        SELECT id
        FROM organizations
        WHERE org_type = 'BRAND' AND LOWER(name) = LOWER($1) AND id <> $2
        `,
        [String(name).trim(), brandId]
      );
      if (existing.rows.length > 0) {
        return json(res, 409, { ok: false, error: 'A brand with this name already exists' });
      }

      const result = await pool.query(
        `
        UPDATE organizations
        SET name = $1, logo_url = $2
        WHERE id = $3 AND org_type = 'BRAND'
        RETURNING id, name, logo_url, created_at
        `,
        [String(name).trim(), logo_url || null, brandId]
      );
      if (result.rowCount === 0) {
        return json(res, 404, { ok: false, error: 'Brand not found' });
      }

      return json(res, 200, { ok: true, data: result.rows[0] });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if (method === 'DELETE' && brandByIdMatch) {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const brandId = brandByIdMatch[1];
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

  if (url.startsWith('/api/notifications') && method === 'GET') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'employee') {
      return json(res, 403, { ok: false, error: 'Forbidden' });
    }
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const limit = parseInt(urlObj.searchParams.get('limit')) || 50;
      const organizationId = urlObj.searchParams.get('organizationId');
      const values = [];
      let whereClause = '';
      if (organizationId) {
        values.push(organizationId);
        whereClause = `WHERE n.organization_id = $1`;
      }
      values.push(limit);
      const limitIdx = values.length;
      const result = await pool.query(
        `
        SELECT n.id, n.organization_id, o.name as organization_name, n.message, n.channel, n.read, n.created_at
        FROM organization_notifications n
        JOIN organizations o ON n.organization_id = o.id
        ${whereClause}
        ORDER BY n.created_at DESC
        LIMIT $${limitIdx}
        `,
        values
      );
      return json(res, 200, { ok: true, data: result.rows });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  if ((url === '/api/notifications/clear' || url.startsWith('/api/notifications/clear?')) && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    if (user.role !== 'admin' && user.role !== 'employee') {
      return json(res, 403, { ok: false, error: 'Forbidden' });
    }
    try {
      const urlObj = new URL(url, `http://localhost:${PORT}`);
      const organizationId = urlObj.searchParams.get('organizationId');
      let result;
      if (organizationId) {
        result = await pool.query(
          `DELETE FROM organization_notifications WHERE organization_id = $1`,
          [organizationId]
        );
      } else {
        result = await pool.query(`DELETE FROM organization_notifications`);
      }
      return json(res, 200, { ok: true, deleted: result.rowCount || 0 });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const orgNotificationsClearMatch = pathname.match(
    /^\/api\/organizations\/([0-9a-fA-F-]+)\/notifications\/clear\/?$/
  );
  if (orgNotificationsClearMatch && method === 'POST') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    try {
      const organizationId = orgNotificationsClearMatch[1];
      if (user.role === 'brand') {
        const brandMembership = await getBrandMembership(user.id);
        if (!brandMembership || brandMembership.id !== organizationId) {
          return json(res, 403, { ok: false, error: 'Forbidden' });
        }
      } else if (user.role !== 'admin' && user.role !== 'employee') {
        return json(res, 403, { ok: false, error: 'Forbidden' });
      }
      const result = await pool.query(
        `DELETE FROM organization_notifications WHERE organization_id = $1`,
        [organizationId]
      );
      return json(res, 200, { ok: true, deleted: result.rowCount || 0 });
    } catch (error) {
      return json(res, 500, { ok: false, error: error.message });
    }
  }

  const orgNotificationsMatch = pathname.match(
    /^\/api\/organizations\/([0-9a-fA-F-]+)\/notifications\/?$/
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
        SELECT id, organization_id, message, channel, read, created_at
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

  const orgNotificationReadMatch = pathname.match(
    /^\/api\/organizations\/([0-9a-fA-F-]+)\/notifications\/([0-9a-fA-F-]+)\/read\/?$/
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
      const { email, password, name } = body;
      
      if (!email || !password || !name) {
        return json(res, 400, { ok: false, error: 'Email, password, and name are required' });
      }
      
      const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existingUser.rows.length > 0) {
        return json(res, 409, { ok: false, error: 'Email already registered' });
      }
      
      const passwordHash = await hashPassword(password);
      const userRole = 'brand';
      
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, name, role, status) 
         VALUES ($1, $2, $3, $4, 'pending') 
         RETURNING id, email, name, role, status, logo_url, created_at`,
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

  if (method === 'GET' && url === '/api/me') {
    const user = await requireApprovedUser(req, res);
    if (!user) return;
    return json(res, 200, { ok: true, data: user });
  }

  if (method === 'PUT' && url === '/api/me') {
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    try {
      const body = await parseBody(req);
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const hasLogoUrl = Object.prototype.hasOwnProperty.call(body || {}, 'logo_url');
      const logoUrl = hasLogoUrl
        ? body.logo_url != null && String(body.logo_url).trim() !== ''
          ? String(body.logo_url).trim()
          : null
        : currentUser.logo_url || null;

      if (!name) {
        return json(res, 400, { ok: false, error: 'Name is required' });
      }
      if (!email) {
        return json(res, 400, { ok: false, error: 'Email is required' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { ok: false, error: 'Email format is invalid' });
      }

      const conflictCheck = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1',
        [email, currentUser.id]
      );
      if (conflictCheck.rows.length > 0) {
        return json(res, 409, { ok: false, error: 'Email is already in use' });
      }

      await pool.query(
        `
        UPDATE users
        SET name = $2,
            email = $3,
            logo_url = $4,
            updated_at = NOW()
        WHERE id = $1
        `,
        [currentUser.id, name, email, logoUrl]
      );

      const refreshedUser = await getSessionUser(pool, req);
      return json(res, 200, { ok: true, data: refreshedUser });
    } catch (error) {
      console.error('Update current user error:', error);
      return json(res, 500, { ok: false, error: 'Failed to update profile' });
    }
  }

  if (method === 'POST' && url === '/api/me/password') {
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    try {
      const body = await parseBody(req);
      const currentPassword =
        typeof body?.currentPassword === 'string' ? body.currentPassword : '';
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword : '';

      if (!currentPassword || !newPassword) {
        return json(res, 400, {
          ok: false,
          error: 'Current password and new password are required',
        });
      }

      const strengthError = validatePasswordStrength(newPassword);
      if (strengthError) {
        return json(res, 400, { ok: false, error: strengthError });
      }
      if (currentPassword === newPassword) {
        return json(res, 400, {
          ok: false,
          error: 'New password must be different from current password',
        });
      }

      const userResult = await pool.query(
        'SELECT id, password_hash FROM users WHERE id = $1 LIMIT 1',
        [currentUser.id]
      );
      if (userResult.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'User not found' });
      }

      const validCurrentPassword = await comparePasswords(
        currentPassword,
        userResult.rows[0].password_hash || ''
      );
      if (!validCurrentPassword) {
        return json(res, 400, { ok: false, error: 'Current password is incorrect' });
      }

      const passwordHash = await hashPassword(newPassword);
      await pool.query(
        `
        UPDATE users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE id = $1
        `,
        [currentUser.id, passwordHash]
      );

      return json(res, 200, { ok: true });
    } catch (error) {
      console.error('Update password error:', error);
      return json(res, 500, { ok: false, error: 'Failed to update password' });
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
        'SELECT id, email, password_hash, name, role, status, logo_url, created_at FROM users WHERE email = $1',
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
      
      const safeUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        logo_url: user.logo_url,
        created_at: user.created_at,
      };
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

  if (method === 'POST' && url === '/api/admin/users') {
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const body = await parseBody(req);
      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const password = typeof body?.password === 'string' ? body.password : '';

      if (!name) {
        return json(res, 400, { ok: false, error: 'Name is required' });
      }
      if (!email) {
        return json(res, 400, { ok: false, error: 'Email is required' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { ok: false, error: 'Email format is invalid' });
      }

      const strengthError = validatePasswordStrength(password);
      if (strengthError) {
        return json(res, 400, { ok: false, error: strengthError });
      }

      const conflictCheck = await pool.query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
      if (conflictCheck.rows.length > 0) {
        return json(res, 409, { ok: false, error: 'Email already registered' });
      }

      const passwordHash = await hashPassword(password);
      const result = await pool.query(
        `
        INSERT INTO users (email, password_hash, name, role, status)
        VALUES ($1, $2, $3, 'admin', 'approved')
        RETURNING id, email, name, role, status, logo_url, created_at
        `,
        [email, passwordHash, name]
      );

      return json(res, 201, { ok: true, user: result.rows[0] });
    } catch (error) {
      console.error('Create admin user error:', error);
      return json(res, 500, { ok: false, error: 'Failed to create admin user' });
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
        `
        SELECT
          u.id,
          u.email,
          u.name,
          u.role,
          u.status,
          u.created_at,
          brand_membership.organization_id AS brand_id,
          brand_membership.organization_name AS brand_name
        FROM users u
        LEFT JOIN LATERAL (
          SELECT
            m.organization_id,
            o.name AS organization_name
          FROM org_memberships m
          JOIN organizations o ON o.id = m.organization_id
          WHERE m.identity_id = u.id
            AND UPPER(COALESCE(o.org_type, '')) = 'BRAND'
          ORDER BY m.created_at DESC
          LIMIT 1
        ) brand_membership ON TRUE
        ORDER BY u.created_at DESC
        `
      );
      return json(res, 200, { ok: true, data: result.rows });
    } catch (error) {
      console.error('Get users error:', error);
      return json(res, 500, { ok: false, error: 'Failed to get users' });
    }
  }

  const userApproveMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/approve\/?$/);
  if (method === 'POST' && userApproveMatch) {
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const userId = decodeURIComponent(userApproveMatch[1]);
      const body = await parseBody(req);
      const organizationId = body?.organizationId ? String(body.organizationId).trim() : '';

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const userResult = await client.query(
          'SELECT id, role FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );
        if (userResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return json(res, 404, { ok: false, error: 'User not found' });
        }

        const currentRole = userResult.rows[0].role || 'brand';
        const requiresBrandAssignment = currentRole !== 'admin';

        if (requiresBrandAssignment) {
          if (!organizationId) {
            await client.query('ROLLBACK');
            return json(res, 400, {
              ok: false,
              error: 'Brand assignment is required before approval',
            });
          }

          const orgResult = await client.query(
            `SELECT id, name FROM organizations WHERE id = $1 AND UPPER(COALESCE(org_type, '')) = 'BRAND'`,
            [organizationId]
          );
          if (orgResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return json(res, 400, { ok: false, error: 'Selected brand organization was not found' });
          }

          await client.query(
            `
            DELETE FROM org_memberships m
            USING organizations o
            WHERE m.identity_id = $1
              AND m.organization_id = o.id
              AND UPPER(COALESCE(o.org_type, '')) = 'BRAND'
            `,
            [userId]
          );

          await client.query(
            `
            INSERT INTO org_memberships (identity_id, organization_id, role)
            VALUES ($1, $2, $3)
            `,
            [userId, organizationId, 'brand_member']
          );
        }

        const result = await client.query(
          `
          UPDATE users
          SET status = 'approved',
              role = CASE WHEN $2 THEN 'brand' ELSE role END,
              updated_at = NOW()
          WHERE id = $1
          RETURNING id, email, name, role, status
          `,
          [userId, requiresBrandAssignment]
        );

        await client.query('COMMIT');
        return json(res, 200, { ok: true, user: result.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Approve user error:', error);
      return json(res, 500, { ok: false, error: 'Failed to approve user' });
    }
  }

  const userRejectMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/reject\/?$/);
  if (method === 'POST' && userRejectMatch) {
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      
      const userId = decodeURIComponent(userRejectMatch[1]);
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

  const userUpdateMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/?$/);
  const userPasswordResetMatch = pathname.match(/^\/api\/admin\/users\/([^/]+)\/password\/?$/);
  if (method === 'POST' && userPasswordResetMatch) {
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const userId = decodeURIComponent(userPasswordResetMatch[1]);
      const body = await parseBody(req);
      const password = typeof body?.password === 'string' ? body.password : '';

      const strengthError = validatePasswordStrength(password);
      if (strengthError) {
        return json(res, 400, { ok: false, error: strengthError });
      }

      const passwordHash = await hashPassword(password);
      const result = await pool.query(
        `
        UPDATE users
        SET password_hash = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING id, email, name
        `,
        [userId, passwordHash]
      );
      if (result.rows.length === 0) {
        return json(res, 404, { ok: false, error: 'User not found' });
      }

      return json(res, 200, { ok: true, user: result.rows[0] });
    } catch (error) {
      console.error('Reset user password error:', error);
      return json(res, 500, { ok: false, error: 'Failed to reset user password' });
    }
  }

  if (method === 'PUT' && userUpdateMatch) {
    const currentUser = await requireApprovedUser(req, res);
    if (!currentUser) return;
    if (currentUser.role !== 'admin') {
      return json(res, 403, { ok: false, error: 'Admin access required' });
    }
    try {
      const userId = decodeURIComponent(userUpdateMatch[1]);
      const body = await parseBody(req);

      const name = typeof body?.name === 'string' ? body.name.trim() : '';
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      const role = typeof body?.role === 'string' ? body.role.trim().toLowerCase() : '';
      const status = typeof body?.status === 'string' ? body.status.trim().toLowerCase() : '';
      const hasPasswordField = Object.prototype.hasOwnProperty.call(body || {}, 'password');
      const password = hasPasswordField && typeof body?.password === 'string' ? body.password : '';
      const hasOrganizationId = Object.prototype.hasOwnProperty.call(body || {}, 'organizationId');
      const organizationId =
        hasOrganizationId && body.organizationId != null
          ? String(body.organizationId).trim()
          : '';

      if (!name) {
        return json(res, 400, { ok: false, error: 'Name is required' });
      }
      if (!email) {
        return json(res, 400, { ok: false, error: 'Email is required' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return json(res, 400, { ok: false, error: 'Email format is invalid' });
      }

      const allowedRoles = new Set(['admin', 'brand']);
      if (!allowedRoles.has(role)) {
        return json(res, 400, { ok: false, error: 'Invalid role' });
      }

      const allowedStatuses = new Set(['pending', 'approved', 'rejected']);
      if (!allowedStatuses.has(status)) {
        return json(res, 400, { ok: false, error: 'Invalid status' });
      }
      if (hasPasswordField && typeof body?.password !== 'string') {
        return json(res, 400, { ok: false, error: 'Password is invalid' });
      }

      let passwordHash = '';
      if (hasPasswordField && password) {
        const strengthError = validatePasswordStrength(password);
        if (strengthError) {
          return json(res, 400, { ok: false, error: strengthError });
        }
        passwordHash = await hashPassword(password);
      }

      const client = await pool.connect();
      try {
        await client.query('BEGIN');

        const userResult = await client.query(
          'SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE',
          [userId]
        );
        if (userResult.rows.length === 0) {
          await client.query('ROLLBACK');
          return json(res, 404, { ok: false, error: 'User not found' });
        }

        if (currentUser.id === userId) {
          if (role !== 'admin') {
            await client.query('ROLLBACK');
            return json(res, 400, { ok: false, error: 'You cannot change your own role' });
          }
          if (status !== 'approved') {
            await client.query('ROLLBACK');
            return json(res, 400, { ok: false, error: 'You cannot change your own status' });
          }
        }

        const normalizedRole = role;
        const normalizedStatus = status;

        let finalBrandId = null;

        if (normalizedRole === 'admin') {
          await client.query(
            `
            DELETE FROM org_memberships m
            USING organizations o
            WHERE m.identity_id = $1
              AND m.organization_id = o.id
              AND UPPER(COALESCE(o.org_type, '')) = 'BRAND'
            `,
            [userId]
          );
        } else if (hasOrganizationId) {
          if (organizationId) {
            const orgResult = await client.query(
              `SELECT id FROM organizations WHERE id = $1 AND UPPER(COALESCE(org_type, '')) = 'BRAND'`,
              [organizationId]
            );
            if (orgResult.rows.length === 0) {
              await client.query('ROLLBACK');
              return json(res, 400, { ok: false, error: 'Selected brand organization was not found' });
            }
          }

          await client.query(
            `
            DELETE FROM org_memberships m
            USING organizations o
            WHERE m.identity_id = $1
              AND m.organization_id = o.id
              AND UPPER(COALESCE(o.org_type, '')) = 'BRAND'
            `,
            [userId]
          );

          if (organizationId) {
            await client.query(
              `
              INSERT INTO org_memberships (identity_id, organization_id, role)
              VALUES ($1, $2, $3)
              `,
              [userId, organizationId, 'brand_member']
            );
          }
          finalBrandId = organizationId || null;
        } else {
          const existingBrandResult = await client.query(
            `
            SELECT m.organization_id
            FROM org_memberships m
            JOIN organizations o ON o.id = m.organization_id
            WHERE m.identity_id = $1
              AND UPPER(COALESCE(o.org_type, '')) = 'BRAND'
            ORDER BY m.created_at DESC
            LIMIT 1
            `,
            [userId]
          );
          finalBrandId = existingBrandResult.rows[0]?.organization_id || null;
        }

        if (normalizedRole !== 'admin' && normalizedStatus === 'approved' && !finalBrandId) {
          await client.query('ROLLBACK');
          return json(res, 400, {
            ok: false,
            error: 'Brand assignment is required for approved brand users',
          });
        }

        if (passwordHash) {
          await client.query(
            `
            UPDATE users
            SET name = $2,
                email = $3,
                role = $4,
                status = $5,
                password_hash = $6,
                updated_at = NOW()
            WHERE id = $1
            `,
            [userId, name, email, normalizedRole, normalizedStatus, passwordHash]
          );
        } else {
          await client.query(
            `
            UPDATE users
            SET name = $2,
                email = $3,
                role = $4,
                status = $5,
                updated_at = NOW()
            WHERE id = $1
            `,
            [userId, name, email, normalizedRole, normalizedStatus]
          );
        }

        const result = await client.query(
          `
          SELECT
            u.id,
            u.email,
            u.name,
            u.role,
            u.status,
            u.created_at,
            brand_membership.organization_id AS brand_id,
            brand_membership.organization_name AS brand_name
          FROM users u
          LEFT JOIN LATERAL (
            SELECT
              m.organization_id,
              o.name AS organization_name
            FROM org_memberships m
            JOIN organizations o ON o.id = m.organization_id
            WHERE m.identity_id = u.id
              AND UPPER(COALESCE(o.org_type, '')) = 'BRAND'
            ORDER BY m.created_at DESC
            LIMIT 1
          ) brand_membership ON TRUE
          WHERE u.id = $1
          `,
          [userId]
        );

        await client.query('COMMIT');
        return json(res, 200, { ok: true, user: result.rows[0] });
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      if (error?.code === '23505') {
        return json(res, 409, { ok: false, error: 'Email is already in use' });
      }
      console.error('Update user error:', error);
      return json(res, 500, { ok: false, error: 'Failed to update user' });
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

const startServer = async () => {
  try {
    await ensureRuntimeSchema();
  } catch (error) {
    console.error('[schema] failed to ensure runtime schema:', error.message);
  }

  server.listen(PORT, () => {
    console.log(`[dummy-api] listening on http://localhost:${PORT}`);
  });
};

startServer();

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
