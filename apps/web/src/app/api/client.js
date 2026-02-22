const withJsonHeaders = (headers = {}) => ({
  'Content-Type': 'application/json',
  ...headers,
});

export async function requestJson(path, options = {}, errorMessage) {
  const response = await fetch(path, options);
  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || errorMessage || `Request failed: ${response.status}`);
  }

  return payload;
}

export async function getJson(path, errorMessage, options = {}) {
  return requestJson(path, { method: 'GET', ...options }, errorMessage);
}

export async function postJson(path, body, errorMessage, options = {}) {
  return requestJson(
    path,
    {
      method: 'POST',
      ...options,
      headers: withJsonHeaders(options.headers),
      body: JSON.stringify(body ?? {}),
    },
    errorMessage
  );
}

export async function putJson(path, body, errorMessage, options = {}) {
  return requestJson(
    path,
    {
      method: 'PUT',
      ...options,
      headers: withJsonHeaders(options.headers),
      body: JSON.stringify(body ?? {}),
    },
    errorMessage
  );
}

export async function deleteJson(path, errorMessage, options = {}) {
  return requestJson(path, { method: 'DELETE', ...options }, errorMessage);
}
