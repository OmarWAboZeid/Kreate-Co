export const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

export const nowStamp = () => new Date().toISOString();

export const createActivity = ({ action, actor = 'System', note = '', channel = 'In-App' }) => ({
  id: makeId('act'),
  timestamp: nowStamp(),
  action,
  actor,
  note,
  channel,
});

export const addActivityForCampaign = (activity, campaignId, entry) => {
  const existing = activity.campaigns[campaignId] || [];
  return {
    ...activity,
    campaigns: {
      ...activity.campaigns,
      [campaignId]: [entry, ...existing],
    },
  };
};

export const addActivityForContent = (activity, contentId, entry) => {
  const existing = activity.content[contentId] || [];
  return {
    ...activity,
    content: {
      ...activity.content,
      [contentId]: [entry, ...existing],
    },
  };
};

export const addNotification = (notifications, notification) => [notification, ...notifications];
