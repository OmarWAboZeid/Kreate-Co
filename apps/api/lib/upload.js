const { Storage } = require('@google-cloud/storage');
const crypto = require('crypto');

const REPLIT_SIDECAR_ENDPOINT = 'http://127.0.0.1:1106';

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

async function getObjectFile(objectPath) {
  if (!objectPath.startsWith('/objects/')) {
    return null;
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
  return file;
}

async function streamObject(file, res) {
  const [metadata] = await file.getMetadata();
  res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
  res.setHeader('Content-Length', metadata.size);
  res.setHeader('Cache-Control', 'public, max-age=31536000');
  const stream = file.createReadStream();
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
  normalizeObjectPath,
  getObjectFile,
  streamObject,
};
