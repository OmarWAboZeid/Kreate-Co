import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import AddContentModal from '../components/AddContentModal.jsx';
import BrandRecommendations from '../components/BrandRecommendations.jsx';
import CreatorFilters from '../components/CreatorFilters.jsx';
import CreatorGrid from '../components/CreatorGrid.jsx';
import CreatorProfileModal from '../components/CreatorProfileModal.jsx';
import EmptyState from '../components/EmptyState.jsx';
import RejectionModal from '../components/RejectionModal.jsx';
import { getJson } from '../api/client.js';
import { NICHES, WORKFLOW_STATUSES } from '../config/options.js';

const ITEMS_PER_PAGE = 12;

export default function CreatorsPage() {
  const { role } = useParams();
  const [activeTab, setActiveTab] = useState('ugc');
  const [ugcCreators, setUgcCreators] = useState([]);
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCreator, setSelectedCreator] = useState(null);
  const [creatorType, setCreatorType] = useState(null);

  const [ugcPage, setUgcPage] = useState(1);
  const [influencerPage, setInfluencerPage] = useState(1);
  const [ugcPagination, setUgcPagination] = useState({ total: 0, totalPages: 1 });
  const [influencerPagination, setInfluencerPagination] = useState({ total: 0, totalPages: 1 });

  const [ugcFilters, setUgcFilters] = useState({
    search: '',
    gender: '',
    age: '',
    niche: '',
    experienceLevel: '',
  });

  const [influencerFilters, setInfluencerFilters] = useState({
    search: '',
    followerCount: '',
    gender: '',
    niche: '',
    platform: '',
    engagementRate: '',
  });

  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUgc = async () => {
      try {
        setLoading(true);
        const data = await getJson(
          `/api/ugc-creators?page=${ugcPage}&limit=${ITEMS_PER_PAGE}`,
          'Failed to fetch UGC creators'
        );
        if (data.ok) {
          setUgcCreators(data.data || []);
          setUgcPagination(data.pagination || { total: 0, totalPages: 1 });
        }
      } catch (err) {
        console.error('Failed to fetch UGC creators:', err);
        setError('Unable to load creators.');
      } finally {
        setLoading(false);
      }
    };
    fetchUgc();
  }, [ugcPage]);

  useEffect(() => {
    const fetchInfluencers = async () => {
      try {
        setLoading(true);
        const data = await getJson(
          `/api/influencers?page=${influencerPage}&limit=${ITEMS_PER_PAGE}`,
          'Failed to fetch influencers'
        );
        if (data.ok) {
          setInfluencers(data.data || []);
          setInfluencerPagination(data.pagination || { total: 0, totalPages: 1 });
        }
      } catch (err) {
        console.error('Failed to fetch influencers:', err);
        setError('Unable to load creators.');
      } finally {
        setLoading(false);
      }
    };
    fetchInfluencers();
  }, [influencerPage]);

  const filteredUgc = useMemo(() => {
    return ugcCreators.filter((creator) => {
      if (
        ugcFilters.search &&
        !creator.name.toLowerCase().includes(ugcFilters.search.toLowerCase())
      ) {
        return false;
      }
      if (ugcFilters.niche && creator.niche !== ugcFilters.niche) return false;
      if (ugcFilters.gender && creator.gender !== ugcFilters.gender) return false;
      if (
        ugcFilters.language &&
        (!creator.languages ||
          !creator.languages.toLowerCase().includes(ugcFilters.language.toLowerCase()))
      ) {
        return false;
      }
      if (ugcFilters.age) {
        const [min, max] = ugcFilters.age.split('-').map(Number);
        const age = parseInt(creator.age);
        if (isNaN(age) || age < min || age > max) return false;
      }
      return true;
    });
  }, [ugcCreators, ugcFilters]);

  const filteredInfluencers = useMemo(() => {
    return influencers.filter((creator) => {
      if (
        influencerFilters.search &&
        !creator.name.toLowerCase().includes(influencerFilters.search.toLowerCase())
      ) {
        return false;
      }
      if (influencerFilters.niche && creator.niche !== influencerFilters.niche) return false;
      if (influencerFilters.category && creator.category !== influencerFilters.category)
        return false;
      return true;
    });
  }, [influencers, influencerFilters]);

  const openProfile = (creator, type) => {
    setSelectedCreator(creator);
    setCreatorType(type);
  };

  const closeProfile = () => {
    setSelectedCreator(null);
    setCreatorType(null);
  };

  const [recommendedCreators, setRecommendedCreators] = useState([]);
  const [rejectionModal, setRejectionModal] = useState({ open: false, creator: null });
  const [rejectionReason, setRejectionReason] = useState('');
  const [creatorStatuses, setCreatorStatuses] = useState({});
  const [expandedCreator, setExpandedCreator] = useState(null);
  const [creatorWorkflowStatus, setCreatorWorkflowStatus] = useState({});
  const [creatorVideoLinks, setCreatorVideoLinks] = useState({});
  const [addContentModal, setAddContentModal] = useState({ open: false, creator: null });

  const updateWorkflowStatus = (creatorId, status) => {
    setCreatorWorkflowStatus((prev) => ({ ...prev, [creatorId]: status }));
  };

  const updateVideoLink = (creatorId, link) => {
    setCreatorVideoLinks((prev) => ({ ...prev, [creatorId]: link }));
  };

  useEffect(() => {
    if (role === 'brand') {
      const mockRecommended = [...ugcCreators.slice(0, 4), ...influencers.slice(0, 4)].map(
        (creator) => ({
          ...creator,
          recommendedFor: 'Spring Social Launch',
          matchScore: Math.floor(Math.random() * 20) + 80,
        })
      );
      setRecommendedCreators(mockRecommended);
    }
  }, [role, ugcCreators, influencers]);

  const handleApprove = (creator) => {
    setCreatorStatuses((prev) => ({ ...prev, [creator.id]: 'approved' }));
  };

  const handleReject = (creator) => {
    setRejectionModal({ open: true, creator });
  };

  const submitRejection = () => {
    if (rejectionModal.creator && rejectionReason.trim()) {
      setCreatorStatuses((prev) => ({
        ...prev,
        [rejectionModal.creator.id]: { status: 'rejected', reason: rejectionReason },
      }));
      setRejectionModal({ open: false, creator: null });
      setRejectionReason('');
    }
  };

  const closeRejectionModal = () => {
    setRejectionModal({ open: false, creator: null });
    setRejectionReason('');
  };

  const toggleExpandedCreator = (creatorId) => {
    setExpandedCreator((prev) => (prev === creatorId ? null : creatorId));
  };

  const openAddContentModal = (creator) => {
    setAddContentModal({ open: true, creator });
  };

  const closeAddContentModal = () => {
    setAddContentModal({ open: false, creator: null });
  };

  if (role === 'creator') {
    return (
      <EmptyState
        title="Creator directory coming soon"
        description="As a creator, you'll be able to connect with other creators and explore collaboration opportunities."
      />
    );
  }

  if (role === 'brand') {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h2>Creator Network</h2>
            <p>Review creators suggested by our team for your campaigns.</p>
          </div>
        </div>

        <BrandRecommendations
          loading={loading}
          recommendedCreators={recommendedCreators}
          creatorStatuses={creatorStatuses}
          expandedCreator={expandedCreator}
          onToggleExpand={toggleExpandedCreator}
          onApprove={handleApprove}
          onReject={handleReject}
          workflowStatuses={WORKFLOW_STATUSES}
          workflowStatusMap={creatorWorkflowStatus}
          onWorkflowStatusChange={updateWorkflowStatus}
          videoLinks={creatorVideoLinks}
          onVideoLinkChange={updateVideoLink}
          onOpenAddContent={openAddContentModal}
        />

        <RejectionModal
          open={rejectionModal.open}
          creator={rejectionModal.creator}
          reason={rejectionReason}
          onChange={setRejectionReason}
          onSubmit={submitRejection}
          onClose={closeRejectionModal}
        />

        <AddContentModal
          open={addContentModal.open}
          creator={addContentModal.creator}
          onClose={closeAddContentModal}
          onSubmit={closeAddContentModal}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-stack">
        <div className="page-header">
          <div>
            <h2>Creator Network</h2>
            <p>Loading creator profiles...</p>
          </div>
        </div>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-stack">
        <EmptyState title="Error loading creators" description={error} />
      </div>
    );
  }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div>
          <h2>Creator Network</h2>
          <p>Review all creator profiles and performance context.</p>
        </div>
      </div>

      <div className="tabs-container">
        <button
          type="button"
          className={`tab-btn ${activeTab === 'ugc' ? 'active' : ''}`}
          onClick={() => setActiveTab('ugc')}
        >
          UGC Creators ({ugcPagination.total || ugcCreators.length})
        </button>
        <button
          type="button"
          className={`tab-btn ${activeTab === 'influencer' ? 'active' : ''}`}
          onClick={() => setActiveTab('influencer')}
        >
          Influencers ({influencerPagination.total || influencers.length})
        </button>
      </div>

      {activeTab === 'ugc' && (
        <>
          <CreatorFilters
            type="ugc"
            filters={ugcFilters}
            onChange={setUgcFilters}
            niches={NICHES}
          />

          <div className="compact-creator-grid">
            <CreatorGrid creators={filteredUgc} type="ugc" onOpenProfile={openProfile} />
          </div>

          {ugcPagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary"
                onClick={() => setUgcPage((prev) => Math.max(1, prev - 1))}
                disabled={ugcPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {ugcPage} of {ugcPagination.totalPages}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => setUgcPage((prev) => Math.min(ugcPagination.totalPages, prev + 1))}
                disabled={ugcPage === ugcPagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      {activeTab === 'influencer' && (
        <>
          <CreatorFilters
            type="influencer"
            filters={influencerFilters}
            onChange={setInfluencerFilters}
            niches={NICHES}
          />

          <div className="compact-creator-grid">
            <CreatorGrid
              creators={filteredInfluencers}
              type="influencer"
              onOpenProfile={openProfile}
            />
          </div>

          {influencerPagination.totalPages > 1 && (
            <div className="pagination-controls">
              <button
                className="btn btn-secondary"
                onClick={() => setInfluencerPage((prev) => Math.max(1, prev - 1))}
                disabled={influencerPage === 1}
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {influencerPage} of {influencerPagination.totalPages}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() =>
                  setInfluencerPage((prev) => Math.min(influencerPagination.totalPages, prev + 1))
                }
                disabled={influencerPage === influencerPagination.totalPages}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}

      <CreatorProfileModal creator={selectedCreator} type={creatorType} onClose={closeProfile} />
    </div>
  );
}
