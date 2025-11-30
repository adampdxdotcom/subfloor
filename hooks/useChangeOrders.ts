import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as changeOrderService from '../services/changeOrderService';
import { ChangeOrder } from '../types';

export const useChangeOrders = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['changeOrders'],
        queryFn: changeOrderService.getChangeOrders,
        enabled,
    });
};

export const useChangeOrderMutations = () => {
    const queryClient = useQueryClient();

    return {
        addChangeOrder: useMutation({
            mutationFn: changeOrderService.addChangeOrder,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changeOrders'] }),
        }),
        updateChangeOrder: useMutation({
            mutationFn: ({ id, data }: { id: number; data: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt'>> }) => 
                changeOrderService.updateChangeOrder(id, data),
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changeOrders'] }),
        }),
        deleteChangeOrder: useMutation({
            mutationFn: changeOrderService.deleteChangeOrder,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['changeOrders'] }),
        }),
    };
};