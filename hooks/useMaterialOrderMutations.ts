import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as materialOrderService from '../services/materialOrderService';
import { MaterialOrder } from '../types';

export const useMaterialOrderMutations = () => {
  const queryClient = useQueryClient();

  const addMaterialOrderMutation = useMutation({
    mutationFn: (orderData: any) =>
      materialOrderService.addMaterialOrder(orderData),
    onSuccess: (newOrder) => {
      if (newOrder.projectId) {
        queryClient.invalidateQueries({ queryKey: ['material_orders', newOrder.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['material_orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const updateMaterialOrderMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      materialOrderService.updateMaterialOrder(id, data),
    onSuccess: (updatedOrder) => {
      if (updatedOrder.projectId) {
        queryClient.invalidateQueries({ queryKey: ['material_orders', updatedOrder.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['material_orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['material_orders', 'history', updatedOrder.id] });
    },
  });

  const deleteMaterialOrderMutation = useMutation({
    mutationFn: (id: number) => materialOrderService.deleteMaterialOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['material_orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });

  const receiveMaterialOrderMutation = useMutation({
    mutationFn: ({ 
      id, 
      data 
    }: { 
      id: number; 
      data: { dateReceived: string; notes: string; sendEmailNotification: boolean; files?: FileList | null } 
    }) => materialOrderService.receiveMaterialOrder(id, data),
    onSuccess: (updatedOrder) => {
      if (updatedOrder.projectId) {
        queryClient.invalidateQueries({ queryKey: ['material_orders', updatedOrder.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['material_orders', 'history', updatedOrder.id] });
    },
  });

  const reportDamageMutation = useMutation({
    mutationFn: ({ 
      id, 
      data 
    }: { 
      id: number; 
      data: { items: any[]; replacementEta: string; notes: string; sendEmailNotification: boolean; files?: FileList | null } 
    }) => materialOrderService.reportMaterialOrderDamage(id, data),
    onSuccess: (response) => {
      const { originalOrder, replacementOrder } = response;
      if (originalOrder.projectId) {
        queryClient.invalidateQueries({ queryKey: ['material_orders', originalOrder.projectId] });
      }
      queryClient.invalidateQueries({ queryKey: ['material_orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['material_orders', 'history', originalOrder.id] });
      if (replacementOrder) {
          queryClient.invalidateQueries({ queryKey: ['material_orders', 'history', replacementOrder.id] });
      }
    },
  });

  return {
    addMaterialOrder: addMaterialOrderMutation.mutateAsync,
    updateMaterialOrder: updateMaterialOrderMutation.mutateAsync,
    deleteMaterialOrder: deleteMaterialOrderMutation.mutateAsync,
    receiveMaterialOrder: receiveMaterialOrderMutation.mutateAsync,
    reportMaterialOrderDamage: reportDamageMutation.mutateAsync,
  };
};