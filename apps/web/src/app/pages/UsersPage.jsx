import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleApprove = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to approve user');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReject = async (userId) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/reject`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        throw new Error('Failed to reject user');
      }
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (filter === 'all') return true;
    return u.status === filter;
  });

  const pendingCount = users.filter((u) => u.status === 'pending').length;

  if (loading) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h2>User Management</h2>
        </div>
        <div className="loading-state">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <h2>User Management</h2>
        </div>
        <EmptyState title="Error" description={error} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>User Management</h2>
          <p className="page-subtitle">Review and manage user access</p>
        </div>
        {pendingCount > 0 && (
          <div className="pending-badge">
            {pendingCount} pending review
          </div>
        )}
      </div>

      <div className="filter-bar">
        <select className="input" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">All Users ({users.length})</option>
          <option value="pending">Pending ({users.filter((u) => u.status === 'pending').length})</option>
          <option value="approved">Approved ({users.filter((u) => u.status === 'approved').length})</option>
          <option value="rejected">Rejected ({users.filter((u) => u.status === 'rejected').length})</option>
        </select>
      </div>

      {filteredUsers.length === 0 ? (
        <EmptyState
          title="No users found"
          description={filter === 'pending' ? 'No users pending review' : 'No users match the filter'}
        />
      ) : (
        <div className="users-table">
          <div className="table-header">
            <span>Name</span>
            <span>Email</span>
            <span>Role</span>
            <span>Status</span>
            <span>Joined</span>
            <span>Actions</span>
          </div>
          {filteredUsers.map((u) => (
            <div key={u.id} className="table-row">
              <span className="user-name">{u.name}</span>
              <span className="user-email">{u.email}</span>
              <span className="user-role">
                <span className="chip">{u.role}</span>
              </span>
              <span>
                <StatusPill status={u.status} />
              </span>
              <span className="user-date">
                {new Date(u.created_at).toLocaleDateString()}
              </span>
              <span className="user-actions">
                {u.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="btn btn-success btn-small"
                      onClick={() => handleApprove(u.id)}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={() => handleReject(u.id)}
                    >
                      Reject
                    </button>
                  </>
                )}
                {u.status === 'rejected' && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => handleApprove(u.id)}
                  >
                    Approve
                  </button>
                )}
                {u.status === 'approved' && u.id !== currentUser?.id && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-small"
                    onClick={() => handleReject(u.id)}
                  >
                    Revoke
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
