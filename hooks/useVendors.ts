import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as vendorService from '../services/vendorService';
import { Vendor } from '../types';

export const useVendors = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['vendors'],
        queryFn: vendorService.getVendors,
        enabled,
    });
};

export const useVendorMutations = () => {
    const queryClient = useQueryClient();

    return {
        addVendor: useMutation({
            mutationFn: vendorService.addVendor,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
        }),
        updateVendor: useMutation({
            mutationFn: ({ id, data }: { id: number; data: Partial<Omit<Vendor, 'id'>> }) => 
                vendorService.updateVendor(id, data),
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
        }),
        deleteVendor: useMutation({
            mutationFn: vendorService.deleteVendor,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendors'] }),
        }),
    };
};