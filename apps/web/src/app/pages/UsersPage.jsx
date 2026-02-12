import { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';
import StatusPill from '../components/StatusPill.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Modal from '../components/Modal.jsx';

export default function UsersPage({ embedded = false }) {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [brands, setBrands] = useState([]);
  const [brandAssignments, setBrandAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');
  const [editModal, setEditModal] = useState({
    open: false,
    saving: false,
    error: '',
    form: null,
  });

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include', cache: 'no-store' });
      if (!res.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await res.json();
      setUsers(data.data || []);
      setBrandAssignments((prev) => {
        const next = { ...prev };
        (data.data || []).forEach((entry) => {
          if (!next[entry.id] && entry.brand_id) {
            next[entry.id] = entry.brand_id;
          }
        });
        return next;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const res = await fetch('/api/brands', { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setBrands(data.data || []);
    } catch (err) {
      console.error('Failed to load brands:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBrands();
  }, []);

  const handleApprove = async (userId) => {
    try {
      const targetUser = users.find((entry) => entry.id === userId);
      const requiresBrand = targetUser?.role !== 'admin';
      const organizationId = brandAssignments[userId] || targetUser?.brand_id || '';

      if (requiresBrand && !organizationId) {
        alert('Select a brand before approving this user.');
        return;
      }

      const res = await fetch(`/api/admin/users/${userId}/approve`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: requiresBrand ? organizationId : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to approve user');
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
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reject user');
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

  const updateBrandAssignment = (userId, brandId) => {
    setBrandAssignments((prev) => ({ ...prev, [userId]: brandId }));
  };

  const resolveBrandName = (user) => {
    if (user?.brand_name) return user.brand_name;
    const selectedBrandId = brandAssignments[user?.id];
    if (!selectedBrandId) return '';
    const selectedBrand = brands.find((brand) => brand.id === selectedBrandId);
    return selectedBrand?.name || '';
  };

  const openEditModal = (user) => {
    setEditModal({
      open: true,
      saving: false,
      error: '',
      form: {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        role: user.role || 'brand',
        status: user.status || 'pending',
        organizationId: user.role === 'admin' ? '' : brandAssignments[user.id] || user.brand_id || '',
      },
    });
  };

  const closeEditModal = () => {
    setEditModal({
      open: false,
      saving: false,
      error: '',
      form: null,
    });
  };

  const updateEditField = (field, value) => {
    setEditModal((prev) => {
      if (!prev.form) return prev;
      if (field === 'role') {
        return {
          ...prev,
          error: '',
          form: {
            ...prev.form,
            role: value,
            organizationId: value === 'admin' ? '' : prev.form.organizationId,
          },
        };
      }
      return {
        ...prev,
        error: '',
        form: {
          ...prev.form,
          [field]: value,
        },
      };
    });
  };

  const validateEditForm = (form) => {
    if (!form) return 'Missing user form';
    if (!form.name.trim()) return 'Name is required';
    if (!form.email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email format is invalid';
    if (!['admin', 'brand'].includes(form.role)) return 'Role is invalid';
    if (!['pending', 'approved', 'rejected'].includes(form.status)) return 'Status is invalid';
    if (form.role !== 'admin' && form.status === 'approved' && !form.organizationId) {
      return 'Select a brand for approved brand users';
    }
    return '';
  };

  const handleSaveUserEdit = async (event) => {
    event.preventDefault();
    if (!editModal.form) return;
    const validationError = validateEditForm(editModal.form);
    if (validationError) {
      setEditModal((prev) => ({ ...prev, error: validationError }));
      return;
    }

    setEditModal((prev) => ({ ...prev, saving: true, error: '' }));
    try {
      const payload = {
        name: editModal.form.name.trim(),
        email: editModal.form.email.trim(),
        role: editModal.form.role,
        status: editModal.form.status,
        organizationId: editModal.form.role === 'admin' ? null : editModal.form.organizationId || null,
      };
      const res = await fetch(`/api/admin/users/${editModal.form.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user');
      }
      closeEditModal();
      fetchUsers();
    } catch (err) {
      setEditModal((prev) => ({ ...prev, saving: false, error: err.message }));
    }
  };

  if (loading) {
    return (
      <div className={embedded ? '' : 'page-stack'}>
        {!embedded && (
          <div className="page-header">
            <h2>User Management</h2>
          </div>
        )}
        <div className="loading-state">Loading users...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={embedded ? '' : 'page-stack'}>
        {!embedded && (
          <div className="page-header">
            <h2>User Management</h2>
          </div>
        )}
        <EmptyState title="Error" description={error} />
      </div>
    );
  }

  return (
    <div className={embedded ? '' : 'page-stack'}>
      {!embedded && (
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
      )}

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
            <span>Brand</span>
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
                {u.role === 'admin' ? (
                  <span className="user-date">—</span>
                ) : u.status === 'pending' || u.status === 'rejected' || (u.status === 'approved' && !u.brand_id) ? (
                  <select
                    className="input user-brand-select"
                    value={brandAssignments[u.id] || u.brand_id || ''}
                    onChange={(event) => updateBrandAssignment(u.id, event.target.value)}
                  >
                    <option value="">Select brand</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="user-date">{resolveBrandName(u) || '—'}</span>
                )}
              </span>
              <span>
                <StatusPill status={u.status} />
              </span>
              <span className="user-date">
                {new Date(u.created_at).toLocaleDateString()}
              </span>
              <span className="user-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-small"
                  onClick={() => openEditModal(u)}
                >
                  Edit
                </button>
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
                  <>
                    {u.role !== 'admin' && (!u.brand_id || (brandAssignments[u.id] && brandAssignments[u.id] !== u.brand_id)) && (
                      <button
                        type="button"
                        className="btn btn-success btn-small"
                        onClick={() => handleApprove(u.id)}
                      >
                        Save Brand
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-secondary btn-small"
                      onClick={() => handleReject(u.id)}
                    >
                      Revoke
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={editModal.open}
        onClose={editModal.saving ? undefined : closeEditModal}
        title="Edit User"
        description="Update user details, access role, approval status, and assigned brand."
      >
        <form className="modal-form" onSubmit={handleSaveUserEdit}>
          <div className="user-edit-grid">
            <label>
              <span>Name *</span>
              <input
                className="input"
                value={editModal.form?.name || ''}
                onChange={(event) => updateEditField('name', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Email *</span>
              <input
                className="input"
                type="email"
                value={editModal.form?.email || ''}
                onChange={(event) => updateEditField('email', event.target.value)}
                required
              />
            </label>
            <label>
              <span>Role *</span>
              <select
                className="input"
                value={editModal.form?.role || 'brand'}
                onChange={(event) => updateEditField('role', event.target.value)}
              >
                <option value="brand">Brand</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <label>
              <span>Status *</span>
              <select
                className="input"
                value={editModal.form?.status || 'pending'}
                onChange={(event) => updateEditField('status', event.target.value)}
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </label>
            {editModal.form?.role !== 'admin' && (
              <label className="full-width">
                <span>Brand</span>
                <select
                  className="input"
                  value={editModal.form?.organizationId || ''}
                  onChange={(event) => updateEditField('organizationId', event.target.value)}
                >
                  <option value="">Select brand</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {editModal.error && <p className="field-error">{editModal.error}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeEditModal}
              disabled={editModal.saving}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={editModal.saving}>
              {editModal.saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
