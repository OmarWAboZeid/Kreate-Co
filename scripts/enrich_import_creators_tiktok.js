const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const INPUT_PATH =
  process.argv[2] || '/Users/rebuy/Downloads/Kreate&co Creator Network (1).csv';
const OUTPUT_PATH =
  process.argv[3] || path.resolve(__dirname, '../data/clean_creators_enriched.csv');
const CREATOR_TYPE = 'Influencer';
const SCRIPT_PATH = path.resolve(__dirname, './tiktok_fetch_all.py');

const CLEAN_HEADER = [
  'display_name',
  'primary_niche',
  'country',
  'status',
  'creator_type',
  'phone',
  'handle',
  'tiktok_url',
  'instagram_url',
  'instagram_handle',
  'tiktok_handle',
  'followers',
  'category',
  'portfolio_url',
  'age',
  'gender',
  'languages',
  'accepts_gifted_collab',
  'turnaround_time',
  'has_equipment',
  'has_editing_skills',
  'can_voiceover',
  'skills_rating',
  'base_rate',
  'profile_image',
  'has_mock_video',
  'engagement_rate',
  'avg_views',
  'notes',
];

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

const stringifyCsv = (rows) => `${rows.map((row) => row.map(escapeCsv).join(',')).join('\n')}\n`;

const normalizeTikTokUrl = (value) => {
  if (!value) return '';
  let url = String(value).trim();
  if (!url) return '';
  if (url.startsWith('@')) {
    return `https://www.tiktok.com/${url}`.toLowerCase();
  }
  if (!/^https?:\/\//i.test(url) && url.includes('tiktok.com')) {
    url = `https://${url}`;
  }
  const qIndex = url.indexOf('?');
  if (qIndex >= 0) {
    url = url.slice(0, qIndex);
  }
  return url.replace(/\/+$/, '').toLowerCase();
};

const normalizePhone = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 6 ? digits : '';
};

const extractHandle = (url) => {
  if (!url) return '';
  const match = String(url).match(/tiktok\.com\/@([^/?]+)/i);
  return match ? `@${match[1]}` : '';
};

const parseFollowers = (value) => {
  if (value == null) return null;
  let raw = String(value).trim().toLowerCase();
  if (!raw) return null;
  const tiktokMatch = raw.match(/tiktok[^0-9]*([0-9]*\.?[0-9]+)\s*([km]?)/i);
  if (tiktokMatch) {
    raw = `${tiktokMatch[1]}${tiktokMatch[2] || ''}`;
  }
  raw = raw.replace(/,/g, '');
  const match = raw.match(/^([0-9]*\.?[0-9]+)\s*([km]?)$/i);
  if (!match) return null;
  const num = Number(match[1]);
  if (Number.isNaN(num)) return null;
  const unit = match[2]?.toLowerCase() || '';
  const multiplier = unit === 'm' ? 1000000 : unit === 'k' ? 1000 : 1;
  return Math.round(num * multiplier);
};

const readInput = () => {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }
  return fs.readFileSync(INPUT_PATH, 'utf8');
};

const toStatNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const computeVideoMetrics = (videos) => {
  if (!Array.isArray(videos) || videos.length === 0) {
    return { engagementRate: null, avgViews: null };
  }

  let totalViews = 0;
  let totalInteractions = 0;

  videos.forEach((video) => {
    const stats = video?.stats || video?.statsV2 || {};
    const views = toStatNumber(stats.playCount ?? stats.play_count);
    const likes = toStatNumber(stats.diggCount ?? stats.likeCount ?? stats.like_count);
    const comments = toStatNumber(stats.commentCount ?? stats.comment_count);
    const shares = toStatNumber(stats.shareCount ?? stats.share_count);
    const saves = toStatNumber(stats.collectCount ?? stats.collect_count);

    totalViews += views;
    totalInteractions += likes + comments + shares + saves;
  });

  if (totalViews <= 0) {
    return { engagementRate: null, avgViews: null };
  }

  const avgViews = Math.round(totalViews / videos.length);
  const engagementRate = Number(((totalInteractions / totalViews) * 100).toFixed(2));

  return { engagementRate, avgViews };
};

const readFromPath = (obj, paths) => {
  for (const keys of paths) {
    let current = obj;
    let missing = false;
    for (const key of keys) {
      if (current == null || typeof current !== 'object' || !(key in current)) {
        missing = true;
        break;
      }
      current = current[key];
    }
    if (!missing) {
      return current;
    }
  }
  return null;
};

const extractVideoAuthorStats = (videos) => {
  if (!Array.isArray(videos) || videos.length === 0) return {};
  const sample = videos.find((item) => item && typeof item === 'object') || {};
  return sample.authorStats || sample.authorStatsV2 || sample.stats || {};
};

const extractVideoAuthor = (videos) => {
  if (!Array.isArray(videos) || videos.length === 0) return {};
  const sample = videos.find((item) => item && typeof item === 'object') || {};
  return sample.author || sample.user || {};
};

const fetchTikTokProfile = (profileUrl) =>
  new Promise((resolve, reject) => {
    const msToken = process.env.MS_TOKEN || process.env.ms_token || '';
    if (!msToken) {
      reject(
        new Error('Missing MS_TOKEN/ms_token in environment. Set it in .env before running.')
      );
      return;
    }

    const args = [
      SCRIPT_PATH,
      '--profile-url',
      profileUrl,
      '--trending',
      '0',
      '--search-count',
      '0',
      '--user-videos',
      '12',
      '--user-likes',
      '0',
      '--user-playlists',
      '0',
    ];

    execFile(
      'python3',
      args,
      {
        env: { ...process.env, MS_TOKEN: msToken, ms_token: msToken },
        timeout: 120000,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          const message = stderr?.trim() || stdout?.trim() || error.message;
          reject(new Error(message));
          return;
        }
        try {
          const payload = JSON.parse(stdout);
          const videos = payload?.data?.user?.videos || [];
          const infoObject = readFromPath(payload, [
            ['data', 'user', 'info', 'userInfo'],
            ['data', 'user', 'info'],
            ['data', 'userInfo'],
          ]);
          const user = (infoObject && (infoObject.user || infoObject.author)) || {};
          const stats =
            (infoObject && (infoObject.stats || infoObject.statsV2 || infoObject.authorStats)) ||
            extractVideoAuthorStats(videos);
          const videoAuthor = extractVideoAuthor(videos);

          const followerCountRaw = stats.followerCount ?? stats.follower_count ?? null;
          const followerCount = followerCountRaw == null ? null : Number(followerCountRaw);
          const { engagementRate, avgViews } = computeVideoMetrics(videos);
          const uniqueId =
            user.uniqueId ||
            user.unique_id ||
            videoAuthor.uniqueId ||
            videoAuthor.unique_id ||
            '';
          const avatar =
            user.avatarMedium ||
            user.avatarLarger ||
            user.avatarThumb ||
            videoAuthor.avatarMedium ||
            videoAuthor.avatarLarger ||
            videoAuthor.avatarThumb ||
            '';

          if (!uniqueId && !Number.isFinite(followerCount) && !videos.length) {
            reject(new Error('Missing creator identity and metrics in TikTok response.'));
            return;
          }

          resolve({
            nickname: user.nickname ? String(user.nickname).trim() : '',
            uniqueId: uniqueId ? String(uniqueId).trim() : '',
            followers: Number.isFinite(followerCount) ? Math.round(followerCount) : null,
            avatar,
            category: user.commerceUserInfo?.category
              ? String(user.commerceUserInfo.category).trim()
              : '',
            signature: user.signature ? String(user.signature).trim() : '',
            engagementRate,
            avgViews,
          });
        } catch (parseError) {
          reject(new Error(`Failed to parse TikTok script output: ${parseError.message}`));
        }
      }
    );
  });

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const buildRowsFromInput = (rows) => {
  const header = rows[0].map((value) => String(value || '').trim());
  const indexes = Object.fromEntries(header.map((key, idx) => [key, idx]));

  return rows.slice(1).map((row, idx) => {
    const get = (key) => {
      const i = indexes[key];
      return i == null ? '' : String(row[i] || '').trim();
    };
    return {
      rowIndex: idx + 2,
      name: get('Column 1'),
      tiktokRaw: get('Username on Tiktok'),
      followersRaw: get('No. of followers'),
      industry: get('Industry'),
      contact: get('Contact'),
      comments: get('Comments'),
      phase: get('Phase'),
    };
  });
};

const enrichRows = async (sourceRows) => {
  const cleaned = [];
  const skipped = [];
  const seenUrls = new Set();

  for (let i = 0; i < sourceRows.length; i += 1) {
    const row = sourceRows[i];
    const tiktokUrl = normalizeTikTokUrl(row.tiktokRaw);
    const fallbackHandle = extractHandle(tiktokUrl);
    if (!tiktokUrl) {
      skipped.push({
        rowIndex: row.rowIndex,
        name: row.name,
        tiktokRaw: row.tiktokRaw,
        reason: 'missing tiktok url',
      });
      continue;
    }
    if (seenUrls.has(tiktokUrl)) {
      skipped.push({
        rowIndex: row.rowIndex,
        name: row.name,
        tiktokRaw: row.tiktokRaw,
        reason: 'duplicate tiktok url in input',
      });
      continue;
    }
    seenUrls.add(tiktokUrl);

    process.stdout.write(
      `[${i + 1}/${sourceRows.length}] Enriching ${row.name || tiktokUrl}...\n`
    );

    let tiktok = null;
    let fetchError = null;
    try {
      tiktok = await fetchTikTokProfile(tiktokUrl);
    } catch (error) {
      fetchError = error;
    }

    const tiktokHandle = tiktok?.uniqueId ? `@${tiktok.uniqueId}` : fallbackHandle;
    const followers = tiktok?.followers ?? parseFollowers(row.followersRaw);

    if (!tiktokHandle) {
      skipped.push({
        rowIndex: row.rowIndex,
        name: row.name,
        tiktokRaw: row.tiktokRaw,
        reason: fetchError?.message || 'missing tiktok handle after enrichment',
      });
      continue;
    }
    if (followers == null) {
      skipped.push({
        rowIndex: row.rowIndex,
        name: row.name,
        tiktokRaw: row.tiktokRaw,
        reason: fetchError?.message || 'missing followers after enrichment',
      });
      continue;
    }

    const notesParts = [];
    if (row.comments) notesParts.push(row.comments);
    if (row.phase) notesParts.push(`Phase: ${row.phase}`);
    if (tiktok?.signature) notesParts.push(`TikTok bio: ${tiktok.signature}`);
    if (fetchError) notesParts.push(`TikTok enrich warning: ${fetchError.message}`);

    cleaned.push({
      display_name: tiktok?.nickname || row.name || tiktokHandle.replace(/^@/, ''),
      primary_niche: row.industry || tiktok?.category || '',
      country: '',
      status: 'active',
      creator_type: CREATOR_TYPE,
      phone: normalizePhone(row.contact) || '',
      handle: tiktokHandle,
      tiktok_url: tiktokUrl,
      instagram_url: '',
      instagram_handle: '',
      tiktok_handle: tiktokHandle,
      followers,
      category: tiktok?.category || '',
      portfolio_url: '',
      age: '',
      gender: '',
      languages: '',
      accepts_gifted_collab:
        row.phase && /collab|gift|barter/i.test(row.phase) ? 'true' : '',
      turnaround_time: '',
      has_equipment: '',
      has_editing_skills: '',
      can_voiceover: '',
      skills_rating: '',
      base_rate: '',
      profile_image: tiktok?.avatar || '',
      has_mock_video: '',
      engagement_rate: tiktok?.engagementRate ?? '',
      avg_views: tiktok?.avgViews ?? '',
      notes: notesParts.join(' | '),
    });

    await wait(800);
  }

  return { cleaned, skipped };
};

const writeCleanCsv = (rows) => {
  const csvRows = [CLEAN_HEADER, ...rows.map((row) => CLEAN_HEADER.map((key) => row[key] ?? ''))];
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, stringifyCsv(csvRows), 'utf8');
};

const toDbValue = (value, type) => {
  if (value == null || value === '') return null;
  if (type === 'int') {
    const n = Number(value);
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (type === 'numeric') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'bool') {
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
    return null;
  }
  return String(value).trim();
};

const importToDb = async (rows) => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set. Add it to .env before importing.');
  }

  const pool = new Pool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    let inserted = 0;
    let updated = 0;

    for (const row of rows) {
      const existing = await client.query(
        'SELECT id FROM creators WHERE tiktok_url = $1 LIMIT 1',
        [row.tiktok_url]
      );

      const values = [
        toDbValue(row.display_name, 'text'),
        toDbValue(row.primary_niche, 'text'),
        toDbValue(row.country, 'text'),
        toDbValue(row.status, 'text'),
        toDbValue(row.creator_type, 'text'),
        toDbValue(row.phone, 'text'),
        toDbValue(row.handle, 'text'),
        toDbValue(row.tiktok_url, 'text'),
        toDbValue(row.instagram_url, 'text'),
        toDbValue(row.instagram_handle, 'text'),
        toDbValue(row.tiktok_handle, 'text'),
        toDbValue(row.followers, 'int'),
        toDbValue(row.category, 'text'),
        toDbValue(row.portfolio_url, 'text'),
        toDbValue(row.age, 'int'),
        toDbValue(row.gender, 'text'),
        toDbValue(row.languages, 'text'),
        toDbValue(row.accepts_gifted_collab, 'bool'),
        toDbValue(row.turnaround_time, 'text'),
        toDbValue(row.has_equipment, 'bool'),
        toDbValue(row.has_editing_skills, 'bool'),
        toDbValue(row.can_voiceover, 'bool'),
        toDbValue(row.skills_rating, 'numeric'),
        toDbValue(row.base_rate, 'numeric'),
        toDbValue(row.profile_image, 'text'),
        toDbValue(row.has_mock_video, 'bool'),
        toDbValue(row.engagement_rate, 'numeric'),
        toDbValue(row.avg_views, 'int'),
        toDbValue(row.notes, 'text'),
      ];

      if (existing.rowCount > 0) {
        await client.query(
          `
          UPDATE creators
          SET display_name = $1,
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
              has_editing_skills = $21,
              can_voiceover = $22,
              skills_rating = $23,
              base_rate = $24,
              profile_image = COALESCE($25, profile_image),
              has_mock_video = $26,
              engagement_rate = COALESCE($27, engagement_rate),
              avg_views = COALESCE($28, avg_views),
              notes = $29,
              updated_at = NOW()
          WHERE id = $30
          `,
          [...values, existing.rows[0].id]
        );
        updated += 1;
      } else {
        await client.query(
          `
          INSERT INTO creators
          (
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
            has_editing_skills,
            can_voiceover,
            skills_rating,
            base_rate,
            profile_image,
            has_mock_video,
            engagement_rate,
            avg_views,
            notes
          )
          VALUES
          (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29
          )
          `,
          values
        );
        inserted += 1;
      }
    }

    await client.query('COMMIT');
    return { inserted, updated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
};

const main = async () => {
  const raw = readInput();
  const parsed = parseCsv(raw);
  if (parsed.length < 2) {
    throw new Error(`Input CSV appears empty: ${INPUT_PATH}`);
  }

  const sourceRows = buildRowsFromInput(parsed);
  process.stdout.write(`Input rows: ${sourceRows.length}\n`);
  const { cleaned, skipped } = await enrichRows(sourceRows);
  writeCleanCsv(cleaned);

  process.stdout.write(`\nClean rows: ${cleaned.length}\n`);
  process.stdout.write(`Skipped rows: ${skipped.length}\n`);
  if (skipped.length) {
    process.stdout.write(`${JSON.stringify(skipped, null, 2)}\n`);
  }

  const dbResult = await importToDb(cleaned);
  process.stdout.write(
    `DB import complete. Inserted: ${dbResult.inserted}, Updated: ${dbResult.updated}\n`
  );
  process.stdout.write(`Clean CSV written to: ${OUTPUT_PATH}\n`);
};

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
