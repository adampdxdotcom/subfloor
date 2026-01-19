import { useQuery } from '@tanstack/react-query';
import * as quoteService from '../services/quoteService';

export const useQuotes = (projectId?: number) => {
    return useQuery({
        queryKey: ['quotes'], // Keep generic key so we cache the full list
        queryFn: () => quoteService.getQuotes(),
        // If projectId is provided, filter the results. Otherwise return all.
        select: (data) => projectId 
            ? data.filter(q => q.projectId === projectId) 
            : data,
    });
};