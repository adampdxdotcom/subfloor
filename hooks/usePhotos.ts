import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface Photo {
    id: number;
    url: string;
    thumbnailUrl?: string;
    entityType: string;
    entityId: string;
    createdAt: string;
}

const fetchPhotos = async (entityType: string, entityId: number) => {
    const { data } = await axios.get(`/api/photos/${entityType}/${entityId}`);
    return data;
};

export const usePhotos = (entityType: string, entityId: number) => {
    return useQuery({
        queryKey: ['photos', entityType, entityId],
        queryFn: () => fetchPhotos(entityType, entityId),
        enabled: !!entityId,
    });
};

export const usePhotoMutations = (entityType: string, entityId: number) => {
    const queryClient = useQueryClient();
    const queryKey = ['photos', entityType, entityId];

    return {
        uploadPhotos: useMutation({
            mutationFn: async (files: FileList) => {
                const formData = new FormData();
                formData.append('entityType', entityType);
                formData.append('entityId', String(entityId));
                Array.from(files).forEach(file => formData.append('photos', file)); // Matches 'upload.array("photos")'

                const { data } = await axios.post('/api/photos', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                return data;
            },
            onSuccess: () => queryClient.invalidateQueries({ queryKey }),
        }),
        deletePhoto: useMutation({
            mutationFn: async (photoId: number) => {
                await axios.delete(`/api/photos/${photoId}`);
            },
            onSuccess: () => queryClient.invalidateQueries({ queryKey }),
        })
    };
};