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

export const settingsApi = {
  listBrands: (params = {}) =>
    getJson(withParams('/api/brands', params), 'Failed to fetch brands'),
  createBrand: (payload) => postJson('/api/brands', payload, 'Failed to create brand'),
  updateBrand: ({ brandId, payload }) =>
    putJson(`/api/brands/${brandId}`, payload, 'Failed to update brand'),
  deleteBrand: ({ brandId }) =>
    deleteJson(`/api/brands/${brandId}`, 'Failed to delete brand'),

  listPackages: (params = {}) =>
    getJson(withParams('/api/packages', params), 'Failed to fetch packages'),
  createPackage: (payload) => postJson('/api/packages', payload, 'Failed to create package'),
  updatePackage: ({ packageId, payload }) =>
    putJson(`/api/packages/${packageId}`, payload, 'Failed to update package'),
  deletePackage: ({ packageId }) =>
    deleteJson(`/api/packages/${packageId}`, 'Failed to delete package'),

  listUsers: () => getJson('/api/admin/users', 'Failed to fetch users'),
  createAdminUser: (payload) =>
    postJson('/api/admin/users', payload, 'Failed to create admin user'),
  updateUser: ({ userId, payload }) =>
    putJson(`/api/admin/users/${userId}`, payload, 'Failed to update user'),
  approveUser: ({ userId, organizationId }) =>
    postJson(
      `/api/admin/users/${userId}/approve`,
      organizationId ? { organizationId } : {},
      'Failed to approve user'
    ),
  rejectUser: ({ userId }) =>
    postJson(`/api/admin/users/${userId}/reject`, {}, 'Failed to reject user'),
  resetUserPassword: ({ userId, password }) =>
    postJson(
      `/api/admin/users/${userId}/password`,
      { password },
      'Failed to reset user password'
    ),

  listCreatorStages: (params = {}) =>
    getJson(withParams('/api/creator-stages', params), 'Failed to fetch creator stages'),
  createCreatorStage: (payload) =>
    postJson('/api/creator-stages', payload, 'Failed to create creator stage'),
  deleteCreatorStage: ({ stageId }) =>
    deleteJson(`/api/creator-stages/${stageId}`, 'Failed to delete creator stage'),
};

export const useBrandsQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.settings.brands(params),
    queryFn: () => settingsApi.listBrands(params),
    ...options,
  });

export const usePackagesQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.settings.packages(params),
    queryFn: () => settingsApi.listPackages(params),
    ...options,
  });

export const useAdminUsersQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.settings.users(params),
    queryFn: () => settingsApi.listUsers(),
    ...options,
  });

export const useCreatorStagesQuery = (params = {}, options = {}) =>
  useQuery({
    queryKey: queryKeys.settings.creatorStages(params),
    queryFn: () => settingsApi.listCreatorStages(params),
    ...options,
  });

export const useSettingsMutation = (mutationFn, keysToInvalidate = [], options = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (data, variables) => {
      keysToInvalidate.forEach((key) => {
        queryClient.invalidateQueries({ queryKey: key });
      });
      if (options.onSuccess) {
        options.onSuccess(data, variables);
      }
    },
    ...options,
  });
};

