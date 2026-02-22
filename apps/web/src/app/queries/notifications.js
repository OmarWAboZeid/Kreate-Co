import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson } from '../api/client.js';
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

export const notificationsApi = {
  list: (params = {}) =>
    getJson(withParams('/api/notifications', params), 'Failed to fetch notifications'),
  clear: (params = {}) =>
    postJson(
      withParams('/api/notifications/clear', params),
      {},
      'Failed to clear notifications'
    ),
};

export const useNotificationsQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.notifications.list(params),
    queryFn: () => notificationsApi.list(params),
    ...options,
  });

export const useClearNotificationsMutation = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: notificationsApi.clear,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};

