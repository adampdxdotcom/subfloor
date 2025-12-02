// src/hooks/usePhotos.ts

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

export interface ProjectFile { // Renamed from Photo
    id: number;
    url: string;
    thumbnailUrl?: string;
    fileName?: string;
    mimeType?: string;
    category?: 'SITE' | 'DOCUMENT';
    entityType: string;
    entityId: string;
    createdAt: string;
}

const fetchFiles = async (entityType: string, entityId: number) => {
    const { data } = await axios.get(`/api/photos/${entityType}/${entityId}`);
    return data; // Returns mixed list of SITE and DOCUMENT
};

export const useProjectFiles = (entityType: string, entityId: number) => {
    return useQuery({
        queryKey: ['files', entityType, entityId],
        queryFn: () => fetchFiles(entityType, entityId),
        enabled: !!entityId,
    });
};

export const useFileMutations = (entityType: string, entityId: number) => {
    const queryClient = useQueryClient();
    const queryKey = ['files', entityType, entityId];

    return {
        uploadFiles: useMutation({
            mutationFn: async ({ files, category }: { files: FileList, category: 'SITE' | 'DOCUMENT' }) => {
                const formData = new FormData();
                formData.append('entityType', entityType);
                formData.append('entityId', String(entityId));
                formData.append('category', category); // New Field
                Array.from(files).forEach(file => formData.append('photos', file));

                const { data } = await axios.post('/api/photos', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                return data;
            },
            onSuccess: () => queryClient.invalidateQueries({ queryKey }),
        }),
        deleteFile: useMutation({
            mutationFn: async (fileId: number) => {
                await axios.delete(`/api/photos/${fileId}`);
            },
            onSuccess: () => queryClient.invalidateQueries({ queryKey }),
        })
    };
};