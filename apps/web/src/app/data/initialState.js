import { createActivity } from '../utils/stateUtils.js';

const initialState = {
  brands: [],
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
      status: 'Approved',
      revisionCount: 1,
      caption: 'Easy morning glow routine featuring the new tint shades.',
      hashtags: '#kreate #rabbitbeauty #ugc',
      assets: [{ type: 'link', label: 'Drive link', url: 'https://drive.google.com/' }],
      submittedAt: '2026-02-01',
      notes: 'Captured in natural light, requested hook change.',
      feedback: [],
      metrics: {
        views: 45000,
        likes: 3200,
        comments: 156,
        shares: 89,
        saves: 420,
      },
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
        createActivity({
          action: 'Campaign brief logged',
          actor: 'Admin',
          note: 'Brief received via email.',
        }),
        createActivity({
          action: 'Shortlist sent to brand',
          actor: 'System',
          note: 'Awaiting approvals.',
        }),
      ],
      'camp-002': [createActivity({ action: 'Draft created', actor: 'Admin' })],
    },
    content: {
      'cnt-001': [
        createActivity({
          action: 'Content delivered off-platform',
          actor: 'Admin',
          note: 'WhatsApp link.',
        }),
      ],
      'cnt-002': [
        createActivity({ action: 'Content approved', actor: 'Brand' }),
        createActivity({ action: 'Published link captured', actor: 'Admin' }),
      ],
    },
  },
};

export default initialState;
