import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as customerService from '../services/customerService';
import { Customer } from '../types';

export const useCustomers = () => {
    return useQuery<Customer[], Error>({
        queryKey: ['customers'],
        queryFn: customerService.getCustomers,
    });
};

export const useCustomerMutations = () => {
    const queryClient = useQueryClient();

    const createCustomerMutation = useMutation({
        mutationFn: customerService.addCustomer, // Corrected from createCustomer
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });
    
    const updateCustomerMutation = useMutation({
        mutationFn: customerService.updateCustomer,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
            queryClient.invalidateQueries({ queryKey: ['customer', data.id] });
        },
    });

    const deleteCustomerMutation = useMutation({
        mutationFn: customerService.deleteCustomer,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['customers'] });
        },
    });

    return {
        createCustomer: createCustomerMutation,
        updateCustomer: updateCustomerMutation,
        deleteCustomer: deleteCustomerMutation,
    };
};