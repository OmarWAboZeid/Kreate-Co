export const DEFAULT_AVATAR_SRC = '/assets/default-avatar.png';

export const resolveAvatarSrc = (rawValue) => {
  if (!rawValue) return DEFAULT_AVATAR_SRC;
  const value = String(rawValue).trim();
  if (!value) return DEFAULT_AVATAR_SRC;

  try {
    const parsed = new URL(value);
    const expRaw = parsed.searchParams.get('x-expires');
    const exp = Number(expRaw);
    if (Number.isFinite(exp) && Date.now() >= exp * 1000) {
      return DEFAULT_AVATAR_SRC;
    }
  } catch (error) {
    return value;
  }

  return value;
};

export const handleAvatarError = (event) => {
  const image = event.currentTarget;
  if (!image || image.dataset.avatarFallbackApplied === '1') return;
  image.dataset.avatarFallbackApplied = '1';
  image.src = DEFAULT_AVATAR_SRC;
};
