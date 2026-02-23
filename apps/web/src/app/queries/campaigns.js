import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { deleteJson, getJson, postJson, putJson } from '../api/client.js';
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

export const campaignsApi = {
  list: (params = {}) =>
    getJson(withParams('/api/campaigns', params), 'Failed to fetch campaigns'),
  create: (payload) => postJson('/api/campaigns', payload, 'Failed to create campaign'),
  update: ({ campaignId, payload }) =>
    putJson(`/api/campaigns/${campaignId}`, payload, 'Failed to update campaign'),
  listEvents: (campaignId) =>
    getJson(`/api/campaigns/${campaignId}/events`, 'Failed to fetch campaign events'),
  createEvent: ({ campaignId, payload }) =>
    postJson(`/api/campaigns/${campaignId}/events`, payload, 'Failed to create event'),
  updateEvent: ({ campaignId, eventId, payload }) =>
    putJson(`/api/campaigns/${campaignId}/events/${eventId}`, payload, 'Failed to update event'),
  deleteEvent: ({ campaignId, eventId }) =>
    deleteJson(`/api/campaigns/${campaignId}/events/${eventId}`, 'Failed to delete event'),
  creators: (campaignId) =>
    getJson(`/api/campaigns/${campaignId}/creators`, 'Failed to fetch campaign creators'),
  suggestCreator: ({ campaignId, creatorId }) =>
    postJson(
      `/api/campaigns/${campaignId}/creators/suggest`,
      { creatorId },
      'Failed to suggest creator'
    ),
  unsuggestCreator: ({ campaignId, creatorId }) =>
    deleteJson(
      `/api/campaigns/${campaignId}/creators/${creatorId}/suggest`,
      'Failed to undo suggestion'
    ),
  updateCreatorDecision: ({ campaignId, creatorId, payload }) =>
    postJson(
      `/api/campaigns/${campaignId}/creators/${creatorId}/decision`,
      payload,
      'Failed to update creator decision'
    ),
  updateCreatorWorkflow: ({ campaignId, creatorId, payload }) =>
    postJson(
      `/api/campaigns/${campaignId}/creators/${creatorId}/workflow`,
      payload,
      'Failed to update creator workflow'
    ),
};

export const useCampaignsQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.campaigns.list(params),
    queryFn: () => campaignsApi.list(params),
    ...options,
  });

export const useCampaignCreatorsQuery = (campaignId, options = {}) =>
  useQuery({
    queryKey: queryKeys.campaigns.creators(campaignId),
    queryFn: () => campaignsApi.creators(campaignId),
    enabled: Boolean(campaignId),
    ...options,
  });

export const useCreateCampaignMutation = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: campaignsApi.create,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};

export const useUpdateCampaignMutation = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: campaignsApi.update,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      if (variables?.campaignId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.campaigns.creators(variables.campaignId),
        });
      }
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};
