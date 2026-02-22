const normalizeParams = (params = {}) => {
  const entries = Object.entries(params || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ''
  );
  entries.sort(([a], [b]) => a.localeCompare(b));
  return Object.fromEntries(entries);
};

export const queryKeys = {
  me: ['me'],
  creators: {
    all: ['creators'],
    ugc: (params = {}) => ['creators', 'ugc', normalizeParams(params)],
    influencers: (params = {}) => ['creators', 'influencers', normalizeParams(params)],
    details: (creatorId) => ['creators', 'details', creatorId],
  },
  campaigns: {
    all: ['campaigns'],
    list: (params = {}) => ['campaigns', 'list', normalizeParams(params)],
    details: (campaignId) => ['campaigns', 'details', campaignId],
    creators: (campaignId) => ['campaigns', campaignId, 'creators'],
  },
  content: {
    all: ['content'],
    list: (params = {}) => ['content', 'list', normalizeParams(params)],
  },
  settings: {
    all: ['settings'],
    brands: (params = {}) => ['settings', 'brands', normalizeParams(params)],
    packages: (params = {}) => ['settings', 'packages', normalizeParams(params)],
    users: (params = {}) => ['settings', 'users', normalizeParams(params)],
    creatorStages: (params = {}) => ['settings', 'creator-stages', normalizeParams(params)],
  },
  notifications: {
    all: ['notifications'],
    list: (params = {}) => ['notifications', 'list', normalizeParams(params)],
  },
};
