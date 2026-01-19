import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as vendorService from '../services/vendorService';
import { Vendor } from '../types';

export const useVendors = (enabled: boolean = true) => {
    return useQuery<Vendor[], Error>({
        queryKey: ['vendors'],
        queryFn: vendorService.getVendors,
        enabled,
    });
};

export const useVendorMutations = (onSuccessCallback?: () => void) => {
    const queryClient = useQueryClient();

    const createVendorMutation = useMutation({
        mutationFn: vendorService.addVendor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            onSuccessCallback?.();
        },
    });

    const updateVendorMutation = useMutation({
        mutationFn: vendorService.updateVendor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            onSuccessCallback?.();
        },
    });

    const deleteVendorMutation = useMutation({
        mutationFn: vendorService.deleteVendor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            onSuccessCallback?.();
        },
    });

    return {
        createVendor: createVendorMutation,
        updateVendor: updateVendorMutation,
        deleteVendor: deleteVendorMutation,
    };
};