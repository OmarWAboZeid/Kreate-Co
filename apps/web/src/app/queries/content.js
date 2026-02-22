import { useQuery } from '@tanstack/react-query';
import { getJson } from '../api/client.js';
import { queryKeys } from './keys.js';

const withParams = (path, params = {}) => {
  const searchParams = new URLSearchParams();
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `${path}?${query}` : path;
};

export const contentApi = {
  list: (params = {}) =>
    getJson(withParams('/api/content', params), 'Failed to fetch content items'),
};

export const useContentItemsQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.content.list(params),
    queryFn: () => contentApi.list(params),
    ...options,
  });

