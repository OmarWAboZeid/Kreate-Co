const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const INPUT_PATH =
  process.argv[2] || '/Users/rebuy/Downloads/Kreate&co Creator Network - Collabs.csv';
const OUTPUT_PATH = process.argv[3] || path.resolve(__dirname, '../data/clean_creators_collabs.csv');

const CREATOR_TYPE = 'Influencer';

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

const normalizePhone = (value) => {
  if (!value) return '';
  const digits = String(value).replace(/\D/g, '');
  return digits.length >= 6 ? digits : '';
};

const readInput = () => {
  if (!fs.existsSync(INPUT_PATH)) {
    throw new Error(`Input file not found: ${INPUT_PATH}`);
  }
  return fs.readFileSync(INPUT_PATH, 'utf8');
};

const cleanRows = (rows) => {
  const header = rows[0].map((value) => String(value || '').trim());
  const indexes = Object.fromEntries(header.map((key, idx) => [key, idx]));

  const cleaned = [];
  const skipped = [];
  const seen = new Set();

  for (const row of rows.slice(1)) {
    const get = (key) => {
      const idx = indexes[key];
      return idx == null ? '' : String(row[idx] || '').trim();
    };
    const name = get('Column 1');
    const tiktokRaw = get('Username on Tiktok');
    const followersRaw = get('No. of followers');
    const niche = get('Industry');
    const phone = normalizePhone(get('Contact'));
    const notes = get('Comments');

    const tiktokUrl = normalizeTikTokUrl(tiktokRaw);
    const followers = parseFollowers(followersRaw);
    const handle = extractHandle(tiktokUrl);

    const reasons = [];
    if (!name) reasons.push('missing name');
    if (!tiktokUrl) reasons.push('missing tiktok url');
    if (followers == null) reasons.push('missing followers');
    if (reasons.length > 0) {
      skipped.push({ name, tiktokRaw, followersRaw, reasons: reasons.join(', ') });
      continue;
    }

    if (seen.has(tiktokUrl)) {
      skipped.push({ name, tiktokRaw, followersRaw, reasons: 'duplicate tiktok url' });
      continue;
    }
    seen.add(tiktokUrl);

    cleaned.push({
      display_name: name,
      creator_type: CREATOR_TYPE,
      tiktok_url: tiktokUrl,
      tiktok_handle: handle,
      followers,
      primary_niche: niche || '',
      phone: phone || '',
      notes: notes || '',
    });
  }

  return { cleaned, skipped };
};

const writeCleanCsv = (rows) => {
  const header = [
    'display_name',
    'creator_type',
    'tiktok_url',
    'tiktok_handle',
    'followers',
    'primary_niche',
    'phone',
    'notes',
  ];
  const data = [header, ...rows.map((row) => header.map((key) => row[key] ?? ''))];
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, stringifyCsv(data), 'utf8');
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
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE creators
           SET display_name = $1,
               creator_type = $2,
               tiktok_handle = $3,
               followers = $4,
               primary_niche = $5,
               phone = $6,
               notes = $7,
               updated_at = NOW()
           WHERE id = $8`,
          [
            row.display_name,
            row.creator_type,
            row.tiktok_handle || null,
            row.followers,
            row.primary_niche || null,
            row.phone || null,
            row.notes || null,
            existing.rows[0].id,
          ]
        );
        updated += 1;
      } else {
        await client.query(
          `INSERT INTO creators
            (display_name, creator_type, tiktok_url, tiktok_handle, followers, primary_niche, phone, notes)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            row.display_name,
            row.creator_type,
            row.tiktok_url,
            row.tiktok_handle || null,
            row.followers,
            row.primary_niche || null,
            row.phone || null,
            row.notes || null,
          ]
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
  const text = readInput();
  const rows = parseCsv(text);
  if (!rows.length) {
    throw new Error('CSV appears empty.');
  }
  const { cleaned, skipped } = cleanRows(rows);
  writeCleanCsv(cleaned);

  console.log(`Cleaned rows: ${cleaned.length}`);
  console.log(`Skipped rows: ${skipped.length}`);
  if (skipped.length) {
    console.log('Skipped details:', skipped);
  }

  const result = await importToDb(cleaned);
  console.log(`DB import complete. Inserted: ${result.inserted}, Updated: ${result.updated}`);
  console.log(`Clean CSV written to: ${OUTPUT_PATH}`);
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
