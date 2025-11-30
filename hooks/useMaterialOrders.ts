import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as materialOrderService from '../services/materialOrderService';

export const useMaterialOrders = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['materialOrders'],
        queryFn: materialOrderService.getMaterialOrders,
        enabled,
    });
};

export const useMaterialOrderMutations = () => {
    const queryClient = useQueryClient();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['materialOrders'] });

    return {
        addMaterialOrder: useMutation({
            mutationFn: materialOrderService.addMaterialOrder,
            onSuccess: invalidate,
        }),
        updateMaterialOrder: useMutation({
            mutationFn: ({ id, data }: { id: number; data: any }) => 
                materialOrderService.updateMaterialOrder(id, data),
            onSuccess: invalidate,
        }),
        deleteMaterialOrder: useMutation({
            mutationFn: materialOrderService.deleteMaterialOrder,
            onSuccess: invalidate,
        }),
        receiveMaterialOrder: useMutation({
            mutationFn: ({ id, data }: { id: number; data: any }) => 
                materialOrderService.receiveMaterialOrder(id, data),
            onSuccess: invalidate,
        }),
        reportMaterialOrderDamage: useMutation({
            mutationFn: ({ id, data }: { id: number; data: any }) => 
                materialOrderService.reportMaterialOrderDamage(id, data),
            onSuccess: invalidate,
        }),
    };
};