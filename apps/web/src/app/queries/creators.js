import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getJson, postJson, putJson } from '../api/client.js';
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

export const creatorsApi = {
  listUgc: (params = {}) =>
    getJson(
      withParams('/api/ugc-creators', params),
      'Failed to fetch UGC creators'
    ),
  listInfluencers: (params = {}) =>
    getJson(
      withParams('/api/influencers', params),
      'Failed to fetch influencers'
    ),
  getById: (creatorId) =>
    getJson(`/api/creators/${creatorId}`, 'Failed to fetch creator details'),
  update: ({ creatorId, payload }) =>
    putJson(`/api/creators/${creatorId}`, payload, 'Failed to update creator.'),
  createUgc: (payload) =>
    postJson('/api/ugc-creators', payload, 'Failed to add UGC creator.'),
  importFromLink: ({ url }) =>
    postJson('/api/creators/import-link', { url }, 'Failed to import creator.'),
};

export const useUgcCreatorsQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.creators.ugc(params),
    queryFn: () => creatorsApi.listUgc(params),
    ...options,
  });

export const useInfluencersQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.creators.influencers(params),
    queryFn: () => creatorsApi.listInfluencers(params),
    ...options,
  });

export const useCreatorQuery = (creatorId, options = {}) =>
  useQuery({
    queryKey: queryKeys.creators.details(creatorId),
    queryFn: () => creatorsApi.getById(creatorId),
    enabled: Boolean(creatorId),
    ...options,
  });

export const useUpdateCreatorMutation = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: creatorsApi.update,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creators.all });
      if (variables?.creatorId) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.creators.details(variables.creatorId),
        });
      }
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};

export const useCreateUgcCreatorMutation = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: creatorsApi.createUgc,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creators.all });
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};

export const useImportCreatorFromLinkMutation = (options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: creatorsApi.importFromLink,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.creators.all });
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};

