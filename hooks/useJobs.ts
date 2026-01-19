import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as jobService from '../services/jobService';
import { Job } from '../types';

export const useJobs = () => {
    return useQuery<Job[], Error>({
        queryKey: ['jobs'],
        queryFn: jobService.getJobs,
    });
};

// --- NEW HOOK ---
export const useJobDetail = (projectId: number, enabled: boolean = true) => {
    return useQuery({
        queryKey: ['job', projectId],
        queryFn: () => jobService.getJobForProject(projectId),
        enabled: !!projectId && enabled,
    });
};

export const useJobMutations = () => {
    const queryClient = useQueryClient();

    return {
        saveJobDetails: useMutation({
            mutationFn: jobService.saveJob,
            onSuccess: (data, variables: Partial<Job>) => {
                queryClient.invalidateQueries({ queryKey: ['jobs'] });
                // Also invalidate the specific job detail so the UI updates immediately
                queryClient.invalidateQueries({ queryKey: ['job'] }); 
                // Saving job details often updates Project Status (e.g., to SCHEDULED)
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                
                if (variables.projectId) {
                    queryClient.invalidateQueries({ queryKey: ['project', variables.projectId] });
                    queryClient.invalidateQueries({ queryKey: ['job', variables.projectId] });
                }
                
                // NEW: Update Order Dashboard if PO/Customer info changed
                queryClient.invalidateQueries({ queryKey: ['material_orders'] });
            },
        }),
    };
};