import { useQuery } from '@tanstack/react-query';
import * as sampleCheckoutService from '../services/sampleCheckoutService';

export const useSampleCheckouts = (projectId?: number) => {
    return useQuery({
        // Includes projectId in key because the service actually filters on the server
        queryKey: projectId ? ['sample_checkouts', 'project', projectId] : ['sample_checkouts'],
        queryFn: () => sampleCheckoutService.getSampleCheckouts(projectId),
    });
};