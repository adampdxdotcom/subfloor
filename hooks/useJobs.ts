import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as jobService from '../services/jobService';
import { Job } from '../types';

export const useJobs = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['jobs'],
        queryFn: jobService.getJobs,
        enabled,
    });
};

export const useJobMutations = () => {
    const queryClient = useQueryClient();

    return {
        saveJobDetails: useMutation({
            mutationFn: jobService.saveJobDetails,
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['jobs'] });
                // Saving job details often updates Project Status (e.g., to SCHEDULED)
                queryClient.invalidateQueries({ queryKey: ['projects'] });
            },
        }),
    };
};