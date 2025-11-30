import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as sampleCheckoutService from '../services/sampleCheckoutService';
import { SampleCheckout } from '../types';

export const useSampleCheckouts = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['sampleCheckouts'],
        queryFn: () => sampleCheckoutService.getSampleCheckouts(),
        enabled,
    });
};

export const useSampleCheckoutMutations = () => {
    const queryClient = useQueryClient();

    return {
        addSampleCheckout: useMutation({
            mutationFn: sampleCheckoutService.addSampleCheckout,
            onSuccess: (newCheckout) => {
                queryClient.invalidateQueries({ queryKey: ['sampleCheckouts'] });
                // Checkouts often update Project Status (e.g. to SAMPLE_CHECKOUT)
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                // Checkouts affect Product/Variant inventory
                queryClient.invalidateQueries({ queryKey: ['products'] });
            },
        }),
        returnSampleCheckout: useMutation({
            mutationFn: sampleCheckoutService.returnSampleCheckout,
            onSuccess: (returnedCheckout) => {
                queryClient.invalidateQueries({ queryKey: ['sampleCheckouts'] });
                queryClient.invalidateQueries({ queryKey: ['projects'] });
                queryClient.invalidateQueries({ queryKey: ['products'] });
            },
        }),
        patchSampleCheckout: useMutation({
            mutationFn: ({ id, data }: { id: number; data: { expectedReturnDate?: string; isSelected?: boolean } }) => 
                sampleCheckoutService.patchSampleCheckout(id, data),
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['sampleCheckouts'] });
            },
        }),
    };
};