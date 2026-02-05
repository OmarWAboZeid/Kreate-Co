import { useState, useEffect, useCallback } from 'react';
import { getJson } from '../api/client.js';

export function useBrands() {
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBrands = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getJson('/api/brands');
      setBrands(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const createBrand = useCallback(async (brandData) => {
    const response = await fetch('/api/brands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(brandData)
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Failed to create brand');
    }
    const newBrand = await response.json();
    setBrands((prev) => [...prev, newBrand]);
    return newBrand;
  }, []);

  const deleteBrand = useCallback(async (id) => {
    const response = await fetch(`/api/brands/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Failed to delete brand');
    }
    setBrands((prev) => prev.filter((b) => b.id !== id));
  }, []);

  return { brands, loading, error, refetch: fetchBrands, createBrand, deleteBrand };
}
