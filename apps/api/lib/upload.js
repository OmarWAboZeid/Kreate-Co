const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';
const LOCAL_OBJECT_DIR = process.env.LOCAL_OBJECT_DIR
  ? path.resolve(process.env.LOCAL_OBJECT_DIR)
  : path.resolve(process.cwd(), 'data', 'objects');

const storage = new Storage({
  credentials: {
    audience: 'replit',
    subject_token_type: 'access_token',
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: 'external_account',
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: 'json',
        subject_token_field_name: 'access_token',
      },
    },
    universe_domain: 'googleapis.com',
  },
  projectId: '',
});

function getPrivateObjectDir() {
  const dir = process.env.PRIVATE_OBJECT_DIR || '';
  if (!dir) {
    throw new Error('PRIVATE_OBJECT_DIR not set');
  }
  return dir;
}

function hasConfiguredObjectStorage() {
  return Boolean(String(process.env.PRIVATE_OBJECT_DIR || '').trim());
}

function getLocalObjectPath(name = '') {
  const extension = path.extname(String(name || '').trim()).toLowerCase();
  const safeExtension = /^[.a-z0-9_-]{0,16}$/.test(extension) ? extension : '';
  return `/objects/uploads/${crypto.randomUUID()}${safeExtension}`;
}

function getLocalUploadURL(objectPath) {
  if (!objectPath.startsWith('/objects/')) {
    throw new Error('Invalid object path');
  }
  return `/api/uploads/local/${objectPath.slice('/objects/'.length)}`;
}

function resolveLocalObjectFilePath(objectPath) {
  if (!objectPath.startsWith('/objects/')) {
    throw new Error('Invalid object path');
  }

  const relativeObjectPath = objectPath.slice('/objects/'.length);
  const normalizedRelativePath = path.posix.normalize(relativeObjectPath).replace(/^\/+/, '');
  if (!normalizedRelativePath || normalizedRelativePath.startsWith('..')) {
    throw new Error('Invalid object path');
  }

  const filePath = path.resolve(LOCAL_OBJECT_DIR, ...normalizedRelativePath.split('/'));
  const rootPath = path.resolve(LOCAL_OBJECT_DIR);
  const rootPrefix = rootPath.endsWith(path.sep) ? rootPath : `${rootPath}${path.sep}`;
  if (filePath !== rootPath && !filePath.startsWith(rootPrefix)) {
    throw new Error('Invalid object path');
  }
  return filePath;
}

function inferContentType(objectPath) {
  const extension = path.extname(String(objectPath || '').toLowerCase());
  switch (extension) {
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    case '.m4v':
      return 'video/x-m4v';
    case '.webm':
      return 'video/webm';
    case '.ogg':
    case '.ogv':
      return 'video/ogg';
    case '.png':
      return 'image/png';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

function parseObjectPath(path) {
  if (!path.startsWith('/')) {
    path = `/${path}`;
  }
  const pathParts = path.split('/');
  if (pathParts.length < 3) {
    throw new Error('Invalid path: must contain at least a bucket name');
  }
  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join('/');
  return { bucketName, objectName };
}

async function signObjectURL({ bucketName, objectName, method, ttlSec }) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(`${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`Failed to sign object URL, errorcode: ${response.status}`);
  }
  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

async function getUploadURL() {
  const privateObjectDir = getPrivateObjectDir();
  const objectId = crypto.randomUUID();
  const fullPath = `${privateObjectDir}/uploads/${objectId}`;
  const { bucketName, objectName } = parseObjectPath(fullPath);
  return signObjectURL({
    bucketName,
    objectName,
    method: 'PUT',
    ttlSec: 900,
  });
}

async function requestUploadTarget(options = {}) {
  const { name = '' } = options;

  if (hasConfiguredObjectStorage()) {
    try {
      const uploadURL = await getUploadURL();
      return {
        uploadURL,
        objectPath: normalizeObjectPath(uploadURL),
        storage: 'object-storage',
      };
    } catch (error) {
      if (process.env.NODE_ENV === 'production') {
        throw error;
      }
      console.warn('Object storage signing unavailable, falling back to local uploads:', error);
    }
  }

  const objectPath = getLocalObjectPath(name);
  return {
    uploadURL: getLocalUploadURL(objectPath),
    objectPath,
    storage: 'local',
  };
}

function normalizeObjectPath(rawPath) {
  if (!rawPath.startsWith('https://storage.googleapis.com/')) {
    return rawPath;
  }
  const url = new URL(rawPath);
  const rawObjectPath = url.pathname;
  let objectEntityDir = getPrivateObjectDir();
  if (!objectEntityDir.endsWith('/')) {
    objectEntityDir = `${objectEntityDir}/`;
  }
  if (!rawObjectPath.startsWith(objectEntityDir)) {
    return rawObjectPath;
  }
  const entityId = rawObjectPath.slice(objectEntityDir.length);
  return `/objects/${entityId}`;
}

function getObjectPathFromUploadPath(uploadPath) {
  const prefix = '/api/uploads/local/';
  if (!uploadPath.startsWith(prefix)) {
    throw new Error('Invalid local upload path');
  }
  const relativePath = uploadPath.slice(prefix.length).replace(/^\/+/, '');
  if (!relativePath) {
    throw new Error('Invalid local upload path');
  }
  return `/objects/${relativePath}`;
}

async function writeObjectUpload(objectPath, req, metadata = {}) {
  const filePath = resolveLocalObjectFilePath(objectPath);
  await fsp.mkdir(path.dirname(filePath), { recursive: true });

  await new Promise((resolve, reject) => {
    const writeStream = fs.createWriteStream(filePath);
    let settled = false;
    const finish = (handler) => (value) => {
      if (settled) return;
      settled = true;
      handler(value);
    };

    req.on('aborted', finish(() => reject(new Error('Upload aborted'))));
    req.on('error', finish(reject));
    writeStream.on('error', finish(reject));
    writeStream.on('finish', finish(resolve));
    req.pipe(writeStream);
  }).catch(async (error) => {
    await fsp.unlink(filePath).catch(() => {});
    throw error;
  });

  const metaPath = `${filePath}.meta.json`;
  const persistedMetadata = {
    contentType: metadata.contentType || inferContentType(objectPath),
    size:
      metadata.size == null || metadata.size === ''
        ? null
        : Number.isFinite(Number(metadata.size))
          ? Number(metadata.size)
          : null,
    originalName: metadata.name || null,
    uploadedAt: new Date().toISOString(),
  };
  await fsp.writeFile(metaPath, JSON.stringify(persistedMetadata), 'utf8');
  return { filePath, metadata: persistedMetadata };
}

async function getObjectFile(objectPath) {
  if (!objectPath.startsWith('/objects/')) {
    return null;
  }

  if (!hasConfiguredObjectStorage()) {
    const filePath = resolveLocalObjectFilePath(objectPath);
    try {
      await fsp.access(filePath);
    } catch (error) {
      return null;
    }

    let metadata = {};
    try {
      const metaContents = await fsp.readFile(`${filePath}.meta.json`, 'utf8');
      metadata = JSON.parse(metaContents);
    } catch (error) {
      metadata = {};
    }

    return {
      kind: 'local',
      filePath,
      metadata,
      objectPath,
    };
  }

  const parts = objectPath.slice(1).split('/');
  if (parts.length < 2) {
    return null;
  }
  const entityId = parts.slice(1).join('/');
  let entityDir = getPrivateObjectDir();
  if (!entityDir.endsWith('/')) {
    entityDir = `${entityDir}/`;
  }
  const objectEntityPath = `${entityDir}${entityId}`;
  const { bucketName, objectName } = parseObjectPath(objectEntityPath);
  const bucket = storage.bucket(bucketName);
  const file = bucket.file(objectName);
  const [exists] = await file.exists();
  if (!exists) {
    return null;
  }
  return {
    kind: 'gcs',
    file,
  };
}

async function streamObject(file, res) {
  if (file?.kind === 'local') {
    const stats = await fsp.stat(file.filePath);
    const contentType = file.metadata?.contentType || inferContentType(file.objectPath);
    const isVideo = String(contentType).toLowerCase().startsWith('video/');

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', isVideo ? 'private, no-store, max-age=0' : 'public, max-age=31536000');
    if (isVideo) {
      res.setHeader('Accept-Ranges', 'none');
    }

    const stream = fs.createReadStream(file.filePath);
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: 'Error streaming file' }));
      }
    });
    stream.pipe(res);
    return;
  }

  const sourceFile = file?.kind === 'gcs' ? file.file : file;
  const [metadata] = await sourceFile.getMetadata();
  const contentType = metadata.contentType || 'application/octet-stream';
  const isVideo = String(contentType).toLowerCase().startsWith('video/');

  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Length', metadata.size);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('Cache-Control', isVideo ? 'private, no-store, max-age=0' : 'public, max-age=31536000');
  if (isVideo) {
    res.setHeader('Accept-Ranges', 'none');
  }
  const stream = sourceFile.createReadStream();
  stream.on('error', (err) => {
    console.error('Stream error:', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Error streaming file' }));
    }
  });
  stream.pipe(res);
}

module.exports = {
  getUploadURL,
  requestUploadTarget,
  normalizeObjectPath,
  getObjectPathFromUploadPath,
  writeObjectUpload,
  getObjectFile,
  streamObject,
};
