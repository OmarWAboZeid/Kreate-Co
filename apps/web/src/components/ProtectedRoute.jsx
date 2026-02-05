import { Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="loading-page">
        <div className="loading-spinner" />
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (user.status === 'pending') {
    return <Navigate to="/pending-review" replace />;
  }

  if (user.status === 'rejected') {
    return <Navigate to="/" replace />;
  }

  return children;
}
