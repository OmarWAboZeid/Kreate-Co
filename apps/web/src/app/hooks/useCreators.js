import { useState, useEffect, useMemo } from 'react';
import { getJson } from '../api/client.js';

export function useUgcCreators(filters = {}) {
  const [ugcCreators, setUgcCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCreators() {
      try {
        setLoading(true);
        const data = await getJson('/api/ugc-creators?limit=100');
        setUgcCreators(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchCreators();
  }, []);

  const filtered = useMemo(() => {
    return ugcCreators.filter((creator) => {
      if (filters.search && !creator.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.niche && creator.niche !== filters.niche) return false;
      if (filters.gender && creator.gender !== filters.gender) return false;
      if (filters.age) {
        const [min, max] = filters.age.split('-').map(Number);
        const age = parseInt(creator.age);
        if (isNaN(age) || age < min || age > max) return false;
      }
      return true;
    });
  }, [ugcCreators, filters]);

  return { ugcCreators: filtered, allUgcCreators: ugcCreators, loading, error };
}

export function useInfluencers(filters = {}) {
  const [influencers, setInfluencers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchInfluencers() {
      try {
        setLoading(true);
        const data = await getJson('/api/influencers?limit=100');
        setInfluencers(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchInfluencers();
  }, []);

  const filtered = useMemo(() => {
    return influencers.filter((creator) => {
      if (filters.search && !creator.name.toLowerCase().includes(filters.search.toLowerCase())) {
        return false;
      }
      if (filters.niche && creator.niche !== filters.niche) return false;
      return true;
    });
  }, [influencers, filters]);

  return { influencers: filtered, allInfluencers: influencers, loading, error };
}

export function useCreators(type, filters = {}) {
  const ugc = useUgcCreators(type === 'ugc' ? filters : {});
  const influencer = useInfluencers(type === 'influencer' ? filters : {});

  if (type === 'ugc') {
    return ugc;
  }
  return {
    creators: influencer.influencers,
    allCreators: influencer.allInfluencers,
    loading: influencer.loading,
    error: influencer.error
  };
}
