import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as vendorService from '../services/vendorService';
import { toast } from 'react-hot-toast';

export const useVendorMutations = (onSuccessCallback?: () => void) => {
    const queryClient = useQueryClient();

    const createVendor = useMutation({
        mutationFn: vendorService.addVendor, // Correct function name
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast.success("Vendor created.");
            onSuccessCallback?.();
        },
        onError: (err: Error) => toast.error(`Creation failed: ${err.message}`),
    });

    const updateVendor = useMutation({
        mutationFn: vendorService.updateVendor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast.success("Vendor updated.");
            onSuccessCallback?.();
        },
        onError: (err: Error) => toast.error(`Update failed: ${err.message}`),
    });

    const deleteVendor = useMutation({
        mutationFn: vendorService.deleteVendor,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['vendors'] });
            toast.success('Vendor deleted successfully.');
            onSuccessCallback?.();
        },
        onError: (err: Error) => toast.error(`Deletion failed: ${err.message}`),
    });

    return {
        createVendor,
        updateVendor,
        deleteVendor,
    };
};