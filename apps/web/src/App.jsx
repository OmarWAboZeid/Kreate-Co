import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import AppShell from './app/pages/AppShell.jsx';
import CampaignsPage from './app/pages/CampaignsPage.jsx';
import CampaignDetailPage from './app/pages/CampaignDetailPage.jsx';
import CreatorAssignmentsPage from './app/pages/CreatorAssignmentsPage.jsx';
import CreatorsPage from './app/pages/CreatorsPage.jsx';
import ContentPage from './app/pages/ContentPage.jsx';
import AnalyticsPage from './app/pages/AnalyticsPage.jsx';
import SettingsPage from './app/pages/SettingsPage.jsx';

function NotFound() {
  return (
    <div className="app-shell">
      <div className="app-main not-found-main">
        <h1>Page not found</h1>
        <p>We couldn't find that page.</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AuthPage />} />
        <Route path="/signup" element={<AuthPage initialMode="signup" />} />
        <Route path="/app" element={<Navigate to="/app/admin/campaigns" replace />} />
        <Route path="/app/:role" element={<AppShell />}>
          <Route path="assignments" element={<CreatorAssignmentsPage />} />
          <Route path="campaigns" element={<CampaignsPage />} />
          <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
          <Route path="creators" element={<CreatorsPage />} />
          <Route path="content" element={<ContentPage />} />
          <Route path="analytics" element={<AnalyticsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
