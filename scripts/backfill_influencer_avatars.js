const path = require('node:path');
const dotenv = require('dotenv');
const { Pool } = require('pg');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';

const decodeTikTokEscapes = (value) =>
  String(value || '')
    .replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&')
    .replace(/\\\\/g, '\\');

const extractAvatar = (html) => {
  if (!html) return '';
  const candidates = [
    /avatarMedium":"([^"]+)"/,
    /avatarLarger":"([^"]+)"/,
    /avatarThumb":"([^"]+)"/,
  ];
  for (const pattern of candidates) {
    const match = html.match(pattern);
    if (match && match[1]) {
      return decodeTikTokEscapes(match[1]);
    }
  }
  return '';
};

const fetchAvatarFromProfile = async (profileUrl) => {
  const response = await fetch(profileUrl, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      Referer: 'https://www.tiktok.com/',
    },
    redirect: 'follow',
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const html = await response.text();
  const avatar = extractAvatar(html);
  if (!avatar) {
    throw new Error('avatar not found in profile HTML');
  }
  return avatar;
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const main = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    const result = await client.query(
      `
      SELECT id, display_name, tiktok_url
      FROM creators
      WHERE creator_type = 'Influencer'
        AND tiktok_url IS NOT NULL
        AND trim(tiktok_url) <> ''
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      `
    );

    const rows = result.rows;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i];
      const label = row.display_name || row.tiktok_url;
      process.stdout.write(`[${i + 1}/${rows.length}] ${label}\n`);
      try {
        const avatar = await fetchAvatarFromProfile(row.tiktok_url);
        await client.query(
          `
          UPDATE creators
          SET profile_image = $1,
              updated_at = NOW()
          WHERE id = $2
          `,
          [avatar, row.id]
        );
        updated += 1;
      } catch (error) {
        failed += 1;
        process.stdout.write(`  - skip: ${error.message}\n`);
      }
      await wait(600);
    }

    const verify = await client.query(
      `
      SELECT
        COUNT(*)::int AS total,
        SUM(CASE WHEN profile_image IS NOT NULL AND trim(profile_image) <> '' THEN 1 ELSE 0 END)::int AS with_image
      FROM creators
      WHERE creator_type = 'Influencer'
      `
    );

    process.stdout.write(
      `\nDone. Updated: ${updated}, Failed: ${failed}, With image now: ${verify.rows[0].with_image}/${verify.rows[0].total}\n`
    );
  } finally {
    client.release();
    await pool.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

