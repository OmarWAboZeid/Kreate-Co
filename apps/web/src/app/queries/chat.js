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

export const chatApi = {
  getThread: (params = {}) => getJson(withParams('/api/chat/thread', params), 'Failed to load chat'),
  sendMessage: ({ campaignId, organizationId, payload }) =>
    postJson(
      '/api/chat/thread',
      {
        ...(campaignId ? { campaignId } : {}),
        ...(organizationId ? { organizationId } : {}),
        ...payload,
      },
      'Failed to send message'
    ),
};

export const useChatThreadQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.chat.thread(params),
    queryFn: () => chatApi.getThread(params),
    enabled: Boolean(params?.campaignId || params?.organizationId || params?.scope === 'workspace'),
    ...options,
  });

export const useSendChatMessageMutation = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: chatApi.sendMessage,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.chat.all });
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};
