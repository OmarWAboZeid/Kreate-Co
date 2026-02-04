export const roleConfig = {
  admin: {
    label: 'Super Admin',
    nav: [
      { to: 'campaigns', label: 'Campaigns' },
      { to: 'creators', label: 'Creator Network' },
      { to: 'analytics', label: 'Analytics' },
      { to: 'settings', label: 'Settings' },
    ],
  },
  employee: {
    label: 'Employee',
    nav: [
      { to: 'campaigns', label: 'Campaigns' },
      { to: 'creators', label: 'Creator Network' },
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
  creator: {
    label: 'Creator',
    nav: [
      { to: 'assignments', label: 'Assignments' },
      { to: 'content', label: 'Content Delivery' },
      { to: 'settings', label: 'Profile' },
    ],
  },
};
