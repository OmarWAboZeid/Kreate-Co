import { createContext, useContext, useMemo, useReducer } from 'react';
import initialState from './data/initialState.js';
import {
  addActivityForCampaign,
  addActivityForContent,
  addNotification,
  createActivity,
  makeId,
  nowStamp,
} from './utils/stateUtils.js';

const AppStateContext = createContext(null);
const AppDispatchContext = createContext(null);

function appReducer(state, action) {
  switch (action.type) {
    case 'SET_BRANDS': {
      return {
        ...state,
        brands: action.payload,
      };
    }
    case 'ADD_BRAND': {
      return {
        ...state,
        brands: [...state.brands, action.payload],
      };
    }
    case 'SET_CAMPAIGNS': {
      return {
        ...state,
        campaigns: action.payload || [],
      };
    }
    case 'SET_CAMPAIGN_CREATORS': {
      const { campaignId, data } = action.payload;
      if (!campaignId) return state;
      return {
        ...state,
        campaignCreators: {
          ...state.campaignCreators,
          [campaignId]: data,
        },
      };
    }
    case 'DELETE_BRAND': {
      return {
        ...state,
        brands: state.brands.filter((b) => b.id !== action.payload),
      };
    }
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
          createActivity({
            action: 'Campaign created',
            actor: action.actor || 'Admin',
            note: campaign.status,
          })
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
      const existing = state.campaignCreators[campaignId] || {
        shortlist: [],
        approvals: {},
        outreach: {},
      };
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
          createActivity({
            action: 'Shortlist sent to brand',
            actor: 'Admin',
            note: 'Awaiting approvals.',
          })
        ),
      };
    }
    case 'SET_CREATOR_DECISION': {
      const { campaignId, creatorId, decision, actor, note, rejectionReason } = action.payload;
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
            rejectionReasons: {
              ...existing.rejectionReasons,
              ...(decision === 'Brand Rejected' && rejectionReason
                ? { [creatorId]: rejectionReason }
                : {}),
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
    case 'SUGGEST_CREATOR': {
      const { campaignId, creatorId } = action.payload;
      const existing = state.campaignCreators[campaignId] || {
        shortlist: [],
        approvals: {},
        outreach: {},
        rejectionReasons: {},
      };
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
              [creatorId]: 'Suggested',
            },
          },
        },
      };
    }
    case 'SET_CREATOR_WORKFLOW_STATUS': {
      const { campaignId, creatorId, status, finalVideoLink } = action.payload;
      const existing = state.campaignCreators[campaignId];
      if (!existing) return state;
      const existingOutreach = existing.outreach[creatorId] || {};
      return {
        ...state,
        campaignCreators: {
          ...state.campaignCreators,
          [campaignId]: {
            ...existing,
            outreach: {
              ...existing.outreach,
              [creatorId]: {
                ...existingOutreach,
                workflowStatus: status || existingOutreach.workflowStatus,
                finalVideoLink:
                  finalVideoLink !== undefined ? finalVideoLink : existingOutreach.finalVideoLink,
              },
            },
          },
        },
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
      const revisionCount =
        status === 'Revision Requested' ? item.revisionCount + 1 : item.revisionCount;
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
          content.id === contentId
            ? { ...content, status: 'Published', publishedUrl: url }
            : content
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
