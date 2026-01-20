import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-hot-toast';
import * as mediaService from '../services/mediaService';
import { MediaAsset } from '../types';

/**
 * Hook to fetch all media assets.
 */
export const useMediaAssets = () => {
  return useQuery<MediaAsset[], Error>({
    queryKey: ['mediaAssets'],
    queryFn: mediaService.getMediaAssets,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
};

/**
 * Hook for uploading a new media asset.
 */
export const useUploadMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => mediaService.uploadMediaAsset(formData),
    onSuccess: () => {
      toast.success('Media asset uploaded successfully!');
      queryClient.invalidateQueries({ queryKey: ['mediaAssets'] });
    },
    onError: (error: Error) => {
      toast.error(`Upload failed: ${error.message}`);
    },
  });
};

/**
 * Hook for deleting a media asset.
 */
export const useDeleteMedia = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => mediaService.deleteMediaAsset(id),
    onSuccess: () => {
      toast.success('Media asset deleted.');
      queryClient.invalidateQueries({ queryKey: ['mediaAssets'] });
    },
    onError: (error: Error) => {
      toast.error(`Delete failed: ${error.message}`);
    },
  });
};