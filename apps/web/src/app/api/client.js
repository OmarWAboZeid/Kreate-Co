export async function getJson(path, errorMessage) {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(errorMessage || `Request failed: ${response.status}`);
  }
  return response.json();
}
