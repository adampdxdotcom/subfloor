import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as changeOrderService from '../services/changeOrderService';
import { ChangeOrder } from '../types';

export const useChangeOrderMutations = () => {
  const queryClient = useQueryClient();

  const addChangeOrderMutation = useMutation({
    mutationFn: (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'>) => 
      changeOrderService.addChangeOrder(changeOrder),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['change_orders', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const updateChangeOrderMutation = useMutation({
    mutationFn: ({ 
      id, 
      data 
    }: { 
      id: number; 
      data: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt'>> 
    }) => changeOrderService.updateChangeOrder(id, data),
    onSuccess: (updatedChangeOrder) => {
      queryClient.invalidateQueries({ queryKey: ['change_orders', updatedChangeOrder.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const deleteChangeOrderMutation = useMutation({
    mutationFn: (id: number) => changeOrderService.deleteChangeOrder(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['change_orders'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  return {
    addChangeOrder: addChangeOrderMutation.mutateAsync,
    updateChangeOrder: updateChangeOrderMutation.mutateAsync,
    deleteChangeOrder: deleteChangeOrderMutation.mutateAsync,
  };
};