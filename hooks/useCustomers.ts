import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as customerService from '../services/customerService';
import { Customer } from '../types';

export const useCustomers = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['customers'],
        queryFn: customerService.getCustomers,
        enabled,
    });
};

export const useCustomerMutations = () => {
    const queryClient = useQueryClient();

    return {
        addCustomer: useMutation({
            mutationFn: customerService.addCustomer,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
        }),
        updateCustomer: useMutation({
            mutationFn: customerService.updateCustomer,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
        }),
        deleteCustomer: useMutation({
            mutationFn: customerService.deleteCustomer,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['customers'] }),
        }),
    };
};