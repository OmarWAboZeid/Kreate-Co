const icon = (path) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ICONS = {
  campaigns: icon('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>'),
  creators: icon('<circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/><path d="M21 21v-2a4 4 0 0 0-3-3.87"/>'),
  analytics: icon('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  settings: icon('<circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>'),
  profile: icon('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
};

export const roleConfig = {
  admin: {
    label: 'Admin',
    nav: [
      { to: 'campaigns', label: 'Campaigns', icon: ICONS.campaigns },
      { to: 'creators', label: 'Creators', icon: ICONS.creators },
      { to: 'analytics', label: 'Analytics', icon: ICONS.analytics },
      { to: 'settings', label: 'Settings', icon: ICONS.settings },
    ],
  },
  brand: {
    label: 'Brand',
    nav: [
      { to: 'campaigns', label: 'Campaigns', icon: ICONS.campaigns },
      { to: 'analytics', label: 'Analytics', icon: ICONS.analytics },
      { to: 'settings', label: 'Profile', icon: ICONS.profile },
    ],
  },
};
