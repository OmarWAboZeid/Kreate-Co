export const roleConfig = {
  admin: {
    label: 'Admin',
    nav: [
      { to: 'campaigns', label: 'Campaigns' },
      { to: 'creators', label: 'Creator Network' },
      { to: 'brands', label: 'Brands' },
      { to: 'users', label: 'Users' },
      { to: 'analytics', label: 'Analytics' },
      { to: 'settings', label: 'Settings' },
    ],
  },
  brand: {
    label: 'Brand',
    nav: [
      { to: 'campaigns', label: 'Campaigns' },
      { to: 'creators', label: 'Creator Network' },
      { to: 'analytics', label: 'Analytics' },
      { to: 'settings', label: 'Profile' },
    ],
  },
};
