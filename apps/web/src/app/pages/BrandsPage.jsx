import { useState, useEffect } from 'react';
import Modal from '../components/Modal.jsx';
import { useAppState, useAppDispatch } from '../state.jsx';

const API_BASE = '/api';

export default function BrandsPage({ embedded = false }) {
  const { brands } = useAppState();
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [editBrandName, setEditBrandName] = useState('');
  const [editLogoFile, setEditLogoFile] = useState(null);
  const [editLogoPreview, setEditLogoPreview] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');

  useEffect(() => {
    if (brands.length === 0) {
      fetchBrands();
    }
  }, [brands.length]);

  const fetchBrands = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/brands`);
      const data = await res.json();
      if (data.ok) {
        dispatch({ type: 'SET_BRANDS', payload: data.data });
      }
    } catch (err) {
      console.error('Error fetching brands:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditLogoSelect = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditLogoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditLogoPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const fileToDataUrl = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
          return;
        }
        reject(new Error('Failed to encode image'));
      };
      reader.onerror = () => reject(new Error('Failed to encode image'));
      reader.readAsDataURL(file);
    });

  const uploadLogo = async (file) => {
    try {
      const urlRes = await fetch(`${API_BASE}/uploads/request-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });
      const urlData = await urlRes.json();
      if (!urlData.ok || !urlData.uploadURL || !urlData.objectPath) {
        throw new Error(urlData.error || 'Failed to get upload URL');
      }

      const uploadRes = await fetch(urlData.uploadURL, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });
      if (!uploadRes.ok) {
        throw new Error('Failed to upload logo file');
      }

      return urlData.objectPath;
    } catch (error) {
      console.warn('Signed logo upload failed, using inline fallback.', error);
      return fileToDataUrl(file);
    }
  };

  const handleAddBrand = async (e) => {
    e.preventDefault();
    if (!newBrandName.trim()) {
      setError('Please enter a brand name');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      let logoUrl = null;
      if (logoFile) {
        logoUrl = await uploadLogo(logoFile);
      }

      const res = await fetch(`${API_BASE}/brands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newBrandName.trim(),
          logo_url: logoUrl,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        dispatch({ type: 'ADD_BRAND', payload: data.data });
        closeAddBrandModal();
      } else {
        setError(data.error || 'Failed to add brand');
      }
    } catch (err) {
      setError('Failed to add brand');
    } finally {
      setSubmitting(false);
    }
  };

  const openAddBrandModal = () => {
    setError('');
    setShowAddModal(true);
  };

  const closeAddBrandModal = () => {
    setShowAddModal(false);
    setNewBrandName('');
    setLogoFile(null);
    setLogoPreview(null);
    setSubmitting(false);
    setError('');
  };

  const openEditBrandModal = (brand) => {
    setEditingBrand(brand);
    setEditBrandName(brand.name);
    setEditLogoFile(null);
    setEditLogoPreview(brand.logo_url || null);
    setEditError('');
    setShowEditModal(true);
  };

  const closeEditBrandModal = () => {
    setShowEditModal(false);
    setEditingBrand(null);
    setEditBrandName('');
    setEditLogoFile(null);
    setEditLogoPreview(null);
    setEditSubmitting(false);
    setEditError('');
  };

  const handleUpdateBrand = async (e) => {
    e.preventDefault();
    if (!editingBrand) return;
    if (!editBrandName.trim()) {
      setEditError('Please enter a brand name');
      return;
    }

    setEditSubmitting(true);
    setEditError('');

    try {
      let logoUrl = editingBrand.logo_url || null;
      if (editLogoFile) {
        logoUrl = await uploadLogo(editLogoFile);
      } else if (!editLogoPreview) {
        logoUrl = null;
      }

      const res = await fetch(`${API_BASE}/brands/${editingBrand.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editBrandName.trim(),
          logo_url: logoUrl,
        }),
      });
      const data = await res.json();

      if (data.ok) {
        dispatch({ type: 'UPDATE_BRAND', payload: data.data });
        closeEditBrandModal();
      } else {
        setEditError(data.error || 'Failed to update brand');
      }
    } catch (err) {
      setEditError('Failed to update brand');
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDeleteBrand = async (brandId) => {
    if (!confirm('Are you sure you want to delete this brand?')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/brands/${brandId}`, {
        method: 'DELETE',
      });
      const data = await res.json();

      if (data.ok) {
        dispatch({ type: 'DELETE_BRAND', payload: brandId });
      } else {
        alert(data.error || 'Failed to delete brand');
      }
    } catch (err) {
      alert('Failed to delete brand');
    }
  };

  return (
    <div className={embedded ? '' : 'page-stack'}>
      {!embedded && (
        <div className="page-header">
          <div>
            <h2>Brands</h2>
            <p>Add and manage brands that can be assigned to campaigns.</p>
          </div>
        </div>
      )}

      <div className="card">
        <div className="page-header" style={{ marginBottom: 16 }}>
          <div>
            <h3>All Brands</h3>
            <p>Manage your brand directory from one place.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openAddBrandModal}>
            Add Brand
          </button>
        </div>
        <div className="brands-list">
          <div className="brands-settings-table-wrap">
            <table className="brands-settings-table">
              <thead>
                <tr>
                  <th>Brand</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="brands-table-empty">
                      Loading brands...
                    </td>
                  </tr>
                ) : brands.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="brands-table-empty">
                      No brands added yet.
                    </td>
                  </tr>
                ) : (
                  brands.map((brand) => (
                    <tr key={brand.id}>
                      <td>
                        <div className="brand-table-identity">
                          <div className="brand-table-logo">
                            {brand.logo_url ? (
                              <img src={brand.logo_url} alt={brand.name} />
                            ) : (
                              <div className="brand-table-placeholder">
                                {brand.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="brand-table-name">{brand.name}</span>
                        </div>
                      </td>
                      <td>
                        {brand.created_at ? new Date(brand.created_at).toLocaleDateString() : '-'}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-small"
                            onClick={() => openEditBrandModal(brand)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger btn-small"
                            onClick={() => handleDeleteBrand(brand.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal
        open={showAddModal}
        onClose={submitting ? undefined : closeAddBrandModal}
        title="Add Brand"
        description="Create a new brand profile."
        size="medium"
      >
        <form className="modal-form" onSubmit={handleAddBrand}>
          <label>
            <span>Brand Name</span>
            <input
              type="text"
              className="input"
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="Enter brand name"
              required
            />
          </label>
          <label>
            <span>Logo (optional)</span>
            <div className="logo-upload-container">
              {logoPreview ? (
                <div className="logo-preview">
                  <img src={logoPreview} alt="Logo preview" />
                  <button
                    type="button"
                    className="logo-remove"
                    onClick={() => {
                      setLogoFile(null);
                      setLogoPreview(null);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <label className="logo-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    style={{ display: 'none' }}
                  />
                  <span>Choose File</span>
                </label>
              )}
              {logoPreview && (
                <label className="logo-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoSelect}
                    style={{ display: 'none' }}
                  />
                  <span>Replace</span>
                </label>
              )}
            </div>
          </label>
          {error && <p className="error-text">{error}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeAddBrandModal}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting || !newBrandName.trim()}
            >
              {submitting ? 'Adding...' : 'Add Brand'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={closeEditBrandModal}
        title="Edit Brand"
        description="Update brand information."
        size="medium"
      >
        <form className="modal-form" onSubmit={handleUpdateBrand}>
          <label>
            <span>Brand Name</span>
            <input
              type="text"
              className="input"
              value={editBrandName}
              onChange={(e) => setEditBrandName(e.target.value)}
              placeholder="Enter brand name"
              required
            />
          </label>
          <label>
            <span>Logo</span>
            <div className="logo-upload-container">
              {editLogoPreview ? (
                <div className="logo-preview">
                  <img src={editLogoPreview} alt="Logo preview" />
                  <button
                    type="button"
                    className="logo-remove"
                    onClick={() => {
                      setEditLogoFile(null);
                      setEditLogoPreview(null);
                    }}
                  >
                    &times;
                  </button>
                </div>
              ) : (
                <label className="logo-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditLogoSelect}
                    style={{ display: 'none' }}
                  />
                  <span>Choose File</span>
                </label>
              )}
              {editLogoPreview && (
                <label className="logo-upload-btn">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleEditLogoSelect}
                    style={{ display: 'none' }}
                  />
                  <span>Replace</span>
                </label>
              )}
            </div>
          </label>
          {editError && <p className="error-text">{editError}</p>}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={closeEditBrandModal}
              disabled={editSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={editSubmitting || !editBrandName.trim()}
            >
              {editSubmitting ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
