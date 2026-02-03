import { createContext, useContext, useMemo, useReducer } from 'react';

const AppStateContext = createContext(null);
const AppDispatchContext = createContext(null);

const makeId = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

const nowStamp = () => new Date().toISOString();

const createActivity = ({ action, actor = 'System', note = '', channel = 'In-App' }) => ({
  id: makeId('act'),
  timestamp: nowStamp(),
  action,
  actor,
  note,
  channel,
});

const addActivityForCampaign = (activity, campaignId, entry) => {
  const existing = activity.campaigns[campaignId] || [];
  return {
    ...activity,
    campaigns: {
      ...activity.campaigns,
      [campaignId]: [entry, ...existing],
    },
  };
};

const addActivityForContent = (activity, contentId, entry) => {
  const existing = activity.content[contentId] || [];
  return {
    ...activity,
    content: {
      ...activity.content,
      [contentId]: [entry, ...existing],
    },
  };
};

const addNotification = (notifications, notification) => [notification, ...notifications];

const initialState = {
  brands: ['Rabbit', 'Hankology', 'Chez Koukou', 'Minilet'],
  campaigns: [
    {
      id: 'camp-001',
      name: 'Spring Social Launch',
      brand: 'Rabbit',
      platforms: ['Instagram', 'TikTok'],
      status: 'In Review',
      objectives: 'Drive awareness for new colorways and collect paid usage rights.',
      budgetRange: '$15k-$25k',
      timeline: { start: '2026-02-10', end: '2026-03-05' },
      notes: 'Prioritize lifestyle + beauty crossover creators with strong retention.',
      criteria: {
        followersMin: 15000,
        followersMax: 250000,
        niche: 'Beauty, Lifestyle',
        region: 'US + GCC',
        language: 'EN/AR',
        engagement: '4%+',
        other: 'UGC style, short-form first',
      },
      criteriaVersion: 1,
      createdAt: '2026-01-28',
    },
    {
      id: 'camp-002',
      name: 'Boutique Pop-Up',
      brand: 'Chez Koukou',
      platforms: ['Instagram'],
      status: 'Draft',
      objectives: 'Drive RSVPs and foot traffic for the Cairo event.',
      budgetRange: '$6k-$10k',
      timeline: { start: '2026-02-20', end: '2026-02-27' },
      notes: 'Local fashion + lifestyle creators preferred.',
      criteria: {
        followersMin: 8000,
        followersMax: 60000,
        niche: 'Fashion, Lifestyle',
        region: 'Egypt',
        language: 'AR',
        engagement: '3.5%+',
        other: 'Event attendance required',
      },
      criteriaVersion: 0,
      createdAt: '2026-02-01',
    },
  ],
  creators: [],
  campaignCreators: {
    'camp-001': {
      shortlist: ['cr-001', 'cr-002', 'cr-003'],
      approvals: {
        'cr-001': 'Brand Approved',
        'cr-002': 'Brand Rejected',
        'cr-003': 'Suggested',
      },
      outreach: {
        'cr-001': {
          status: 'Awaiting Creator Confirmation',
          method: 'WhatsApp',
          note: 'Brief sent 01/30 with campaign overview.',
        },
      },
    },
    'camp-002': {
      shortlist: [],
      approvals: {},
      outreach: {},
    },
  },
  contentItems: [
    {
      id: 'cnt-001',
      campaignId: 'camp-001',
      creatorId: 'cr-001',
      platform: 'Instagram',
      type: 'Reel',
      status: 'Pending Review',
      revisionCount: 1,
      caption: 'Easy morning glow routine featuring the new tint shades.',
      hashtags: '#kreate #rabbitbeauty #ugc',
      assets: [{ type: 'link', label: 'Drive link', url: 'https://drive.google.com/' }],
      submittedAt: '2026-02-01',
      notes: 'Captured in natural light, requested hook change.',
      feedback: [],
    },
    {
      id: 'cnt-002',
      campaignId: 'camp-001',
      creatorId: 'cr-003',
      platform: 'TikTok',
      type: 'Video',
      status: 'Published',
      revisionCount: 0,
      caption: 'POV: your tint matches your morning matcha.',
      hashtags: '#kreate #rabbitbeauty #glow',
      assets: [{ type: 'link', label: 'Asset folder', url: 'https://drive.google.com/' }],
      submittedAt: '2026-01-30',
      publishedUrl: 'https://tiktok.com/',
      metrics: {
        views: 82000,
        likes: 7400,
        comments: 312,
        shares: 210,
        saves: 980,
        engagementRate: 10.5,
        reach: 65000,
      },
      feedback: [],
    },
  ],
  notifications: [
    {
      id: 'note-001',
      role: 'brand',
      message: 'Creators ready to review for Spring Social Launch.',
      channel: 'Email',
      createdAt: '2026-01-30T09:12:00.000Z',
      read: false,
    },
    {
      id: 'note-002',
      role: 'admin',
      message: 'New content pending review for Spring Social Launch.',
      channel: 'WhatsApp',
      createdAt: '2026-02-01T10:05:00.000Z',
      read: false,
    },
  ],
  activity: {
    campaigns: {
      'camp-001': [
        createActivity({ action: 'Campaign brief logged', actor: 'Admin', note: 'Brief received via email.' }),
        createActivity({ action: 'Shortlist sent to brand', actor: 'System', note: 'Awaiting approvals.' }),
      ],
      'camp-002': [createActivity({ action: 'Draft created', actor: 'Admin' })],
    },
    content: {
      'cnt-001': [createActivity({ action: 'Content delivered off-platform', actor: 'Admin', note: 'WhatsApp link.' })],
      'cnt-002': [
        createActivity({ action: 'Content approved', actor: 'Brand' }),
        createActivity({ action: 'Published link captured', actor: 'Admin' }),
      ],
    },
  },
};

function appReducer(state, action) {
  switch (action.type) {
    case 'CREATE_CAMPAIGN': {
      const campaign = action.payload;
      return {
        ...state,
        campaigns: [campaign, ...state.campaigns],
        campaignCreators: {
          ...state.campaignCreators,
          [campaign.id]: {
            shortlist: [],
            approvals: {},
            outreach: {},
          },
        },
        activity: addActivityForCampaign(
          state.activity,
          campaign.id,
          createActivity({ action: 'Campaign created', actor: action.actor || 'Admin', note: campaign.status })
        ),
      };
    }
    case 'UPDATE_CAMPAIGN_STATUS': {
      const { campaignId, status, actor } = action.payload;
      return {
        ...state,
        campaigns: state.campaigns.map((campaign) =>
          campaign.id === campaignId ? { ...campaign, status } : campaign
        ),
        activity: addActivityForCampaign(
          state.activity,
          campaignId,
          createActivity({ action: `Status updated to ${status}`, actor })
        ),
      };
    }
    case 'UPDATE_CAMPAIGN_CRITERIA': {
      const { campaignId, criteria } = action.payload;
      return {
        ...state,
        campaigns: state.campaigns.map((campaign) =>
          campaign.id === campaignId
            ? { ...campaign, criteria: { ...campaign.criteria, ...criteria } }
            : campaign
        ),
        activity: addActivityForCampaign(
          state.activity,
          campaignId,
          createActivity({ action: 'Criteria updated', actor: 'Admin' })
        ),
      };
    }
    case 'SHORTLIST_CREATOR': {
      const { campaignId, creatorId } = action.payload;
      const existing = state.campaignCreators[campaignId] || { shortlist: [], approvals: {}, outreach: {} };
      if (existing.shortlist.includes(creatorId)) return state;
      return {
        ...state,
        campaignCreators: {
          ...state.campaignCreators,
          [campaignId]: {
            ...existing,
            shortlist: [...existing.shortlist, creatorId],
            approvals: {
              ...existing.approvals,
              [creatorId]: existing.approvals[creatorId] || 'Suggested',
            },
          },
        },
        activity: addActivityForCampaign(
          state.activity,
          campaignId,
          createActivity({ action: 'Creator shortlisted', actor: 'Admin', note: creatorId })
        ),
      };
    }
    case 'REMOVE_SHORTLIST': {
      const { campaignId, creatorId } = action.payload;
      const existing = state.campaignCreators[campaignId];
      if (!existing) return state;
      const { [creatorId]: _removed, ...remainingApprovals } = existing.approvals;
      const { [creatorId]: _removedOutreach, ...remainingOutreach } = existing.outreach;
      return {
        ...state,
        campaignCreators: {
          ...state.campaignCreators,
          [campaignId]: {
            ...existing,
            shortlist: existing.shortlist.filter((id) => id !== creatorId),
            approvals: remainingApprovals,
            outreach: remainingOutreach,
          },
        },
      };
    }
    case 'MOVE_SHORTLIST': {
      const { campaignId, from, to } = action.payload;
      const existing = state.campaignCreators[campaignId];
      if (!existing) return state;
      const updated = [...existing.shortlist];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return {
        ...state,
        campaignCreators: {
          ...state.campaignCreators,
          [campaignId]: {
            ...existing,
            shortlist: updated,
          },
        },
      };
    }
    case 'SEND_SHORTLIST': {
      const { campaignId } = action.payload;
      return {
        ...state,
        campaigns: state.campaigns.map((campaign) =>
          campaign.id === campaignId ? { ...campaign, status: 'In Review' } : campaign
        ),
        notifications: addNotification(state.notifications, {
          id: makeId('note'),
          role: 'brand',
          message: 'Creators ready to review for campaign.',
          channel: 'Email',
          createdAt: nowStamp(),
          read: false,
        }),
        activity: addActivityForCampaign(
          state.activity,
          campaignId,
          createActivity({ action: 'Shortlist sent to brand', actor: 'Admin', note: 'Awaiting approvals.' })
        ),
      };
    }
    case 'SET_CREATOR_DECISION': {
      const { campaignId, creatorId, decision, actor, note } = action.payload;
      const existing = state.campaignCreators[campaignId];
      if (!existing) return state;
      return {
        ...state,
        campaignCreators: {
          ...state.campaignCreators,
          [campaignId]: {
            ...existing,
            approvals: {
              ...existing.approvals,
              [creatorId]: decision,
            },
          },
        },
        notifications: addNotification(state.notifications, {
          id: makeId('note'),
          role: 'admin',
          message: `Brand ${decision.toLowerCase()} a creator.`,
          channel: 'Email',
          createdAt: nowStamp(),
          read: false,
        }),
        activity: addActivityForCampaign(
          state.activity,
          campaignId,
          createActivity({ action: `Creator ${decision}`, actor, note })
        ),
      };
    }
    case 'LOG_OUTREACH': {
      const { campaignId, creatorId, method, status, note } = action.payload;
      const existing = state.campaignCreators[campaignId];
      if (!existing) return state;
      return {
        ...state,
        campaignCreators: {
          ...state.campaignCreators,
          [campaignId]: {
            ...existing,
            outreach: {
              ...existing.outreach,
              [creatorId]: { method, status, note },
            },
          },
        },
        activity: addActivityForCampaign(
          state.activity,
          campaignId,
          createActivity({ action: 'Outreach logged', actor: 'Admin', note })
        ),
      };
    }
    case 'ACTIVATE_CAMPAIGN': {
      const { campaignId } = action.payload;
      return {
        ...state,
        campaigns: state.campaigns.map((campaign) =>
          campaign.id === campaignId ? { ...campaign, status: 'Active' } : campaign
        ),
        notifications: addNotification(state.notifications, {
          id: makeId('note'),
          role: 'brand',
          message: 'Campaign is now active.',
          channel: 'Email',
          createdAt: nowStamp(),
          read: false,
        }),
        activity: addActivityForCampaign(
          state.activity,
          campaignId,
          createActivity({ action: 'Campaign activated', actor: 'System' })
        ),
      };
    }
    case 'LOG_CONTENT_DELIVERY': {
      const { content } = action.payload;
      const activityAfterCampaign = addActivityForCampaign(
        state.activity,
        content.campaignId,
        createActivity({ action: 'Content logged', actor: 'Admin', note: content.creatorId })
      );
      const activityAfterContent = addActivityForContent(
        activityAfterCampaign,
        content.id,
        createActivity({ action: 'Content delivered off-platform', actor: 'Admin' })
      );
      return {
        ...state,
        contentItems: [content, ...state.contentItems],
        notifications: addNotification(state.notifications, {
          id: makeId('note'),
          role: 'brand',
          message: 'New content ready for review.',
          channel: 'WhatsApp',
          createdAt: nowStamp(),
          read: false,
        }),
        activity: activityAfterContent,
      };
    }
    case 'REVIEW_CONTENT': {
      const { contentId, status, actor, feedback } = action.payload;
      const item = state.contentItems.find((content) => content.id === contentId);
      if (!item) return state;
      const revisionCount = status === 'Revision Requested' ? item.revisionCount + 1 : item.revisionCount;
      return {
        ...state,
        contentItems: state.contentItems.map((content) =>
          content.id === contentId
            ? {
                ...content,
                status,
                revisionCount,
                feedback: feedback ? [...content.feedback, feedback] : content.feedback,
              }
            : content
        ),
        notifications: addNotification(state.notifications, {
          id: makeId('note'),
          role: 'admin',
          message: `Brand marked content as ${status}.`,
          channel: 'Email',
          createdAt: nowStamp(),
          read: false,
        }),
        activity: addActivityForContent(
          state.activity,
          contentId,
          createActivity({ action: `Content ${status}`, actor, note: feedback?.note || '' })
        ),
      };
    }
    case 'MARK_PUBLISHED': {
      const { contentId, url } = action.payload;
      return {
        ...state,
        contentItems: state.contentItems.map((content) =>
          content.id === contentId ? { ...content, status: 'Published', publishedUrl: url } : content
        ),
        activity: addActivityForContent(
          state.activity,
          contentId,
          createActivity({ action: 'Published link captured', actor: 'Admin', note: url })
        ),
      };
    }
    case 'MARK_NOTIFICATION_READ': {
      const { notificationId } = action.payload;
      return {
        ...state,
        notifications: state.notifications.map((note) =>
          note.id === notificationId ? { ...note, read: true } : note
        ),
      };
    }
    default:
      return state;
  }
}

export function AppStateProvider({ children }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const memoState = useMemo(() => state, [state]);

  return (
    <AppStateContext.Provider value={memoState}>
      <AppDispatchContext.Provider value={dispatch}>{children}</AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}

export function useAppDispatch() {
  const context = useContext(AppDispatchContext);
  if (!context) {
    throw new Error('useAppDispatch must be used within AppStateProvider');
  }
  return context;
}

const safeGet = (key) => {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(key);
};

export const storage = {
  getBrand: () => safeGet('kreate_brand'),
  getCreator: () => safeGet('kreate_creator'),
};

export const utils = { makeId, nowStamp };
