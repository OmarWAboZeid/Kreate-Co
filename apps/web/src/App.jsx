import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './hooks/useAuth.jsx';
import AuthPage from './pages/AuthPage.jsx';
import PendingReviewPage from './pages/PendingReviewPage.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AppShell from './app/pages/AppShell.jsx';
import CampaignsPage from './app/pages/CampaignsPage.jsx';
import CampaignDetailPage from './app/pages/CampaignDetailPage.jsx';
import CreatorAssignmentsPage from './app/pages/CreatorAssignmentsPage.jsx';
import CreatorsPage from './app/pages/CreatorsPage.jsx';
import AnalyticsPage from './app/pages/AnalyticsPage.jsx';
import SettingsPage from './app/pages/SettingsPage.jsx';
import BrandsPage from './app/pages/BrandsPage.jsx';
import UsersPage from './app/pages/UsersPage.jsx';

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
      <AuthProvider>
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/signup" element={<AuthPage initialMode="signup" />} />
          <Route path="/pending-review" element={<PendingReviewPage />} />
          <Route path="/app" element={<Navigate to="/app/admin/campaigns" replace />} />
          <Route
            path="/app/:role"
            element={
              <ProtectedRoute>
                <AppShell />
              </ProtectedRoute>
            }
          >
            <Route path="assignments" element={<CreatorAssignmentsPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="campaigns/:campaignId" element={<CampaignDetailPage />} />
            <Route path="creators" element={<CreatorsPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
