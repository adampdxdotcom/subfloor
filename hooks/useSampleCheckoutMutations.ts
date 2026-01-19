import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as sampleCheckoutService from '../services/sampleCheckoutService';
import { SampleCheckout } from '../types';

export const useSampleCheckoutMutations = () => {
  const queryClient = useQueryClient();

  const invalidateContexts = (checkout?: SampleCheckout | any) => {
    queryClient.invalidateQueries({ queryKey: ['sample_checkouts'] });
    if (checkout?.projectId) {
      queryClient.invalidateQueries({ queryKey: ['sample_checkouts', 'project', checkout.projectId] });
    }
    if (checkout?.customerId) {
      queryClient.invalidateQueries({ queryKey: ['sample_checkouts', 'customer', checkout.customerId] });
    }
    if (checkout?.installerId) {
      queryClient.invalidateQueries({ queryKey: ['sample_checkouts', 'installer', checkout.installerId] });
    }
    queryClient.invalidateQueries({ queryKey: ['samples'] });
    queryClient.invalidateQueries({ queryKey: ['products'] });
  };

  const addSampleCheckoutMutation = useMutation({
    mutationFn: (checkoutData: any) => 
      sampleCheckoutService.addSampleCheckout(checkoutData),
    onSuccess: (newCheckout) => {
      invalidateContexts(newCheckout);
    },
  });

  const returnSampleCheckoutMutation = useMutation({
    mutationFn: (checkout: SampleCheckout) => 
      sampleCheckoutService.returnSampleCheckout(checkout),
    onSuccess: (returnedCheckout) => {
      invalidateContexts(returnedCheckout);
    },
  });

  const updateSampleCheckoutMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { expectedReturnDate?: string; isSelected?: boolean } }) =>
      sampleCheckoutService.patchSampleCheckout(id, data),
    onSuccess: (updatedCheckout) => {
      invalidateContexts(updatedCheckout);
    },
  });

  const extendSampleCheckoutMutation = useMutation({
    mutationFn: (id: number) => sampleCheckoutService.extendSampleCheckout(id),
    onSuccess: (updatedCheckout) => {
      invalidateContexts(updatedCheckout);
    },
  });

  const transferCheckoutsMutation = useMutation({
    mutationFn: ({ checkoutIds, projectId }: { checkoutIds: number[]; projectId: number }) =>
      sampleCheckoutService.transferCheckoutsToProject(checkoutIds, projectId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['sample_checkouts'] });
      queryClient.invalidateQueries({ queryKey: ['sample_checkouts', 'project', variables.projectId] });
    },
  });

  return {
    addSampleCheckout: addSampleCheckoutMutation.mutateAsync,
    returnSampleCheckout: returnSampleCheckoutMutation.mutateAsync,
    updateSampleCheckout: updateSampleCheckoutMutation.mutateAsync, // Mapped to patch logic
    patchSampleCheckout: updateSampleCheckoutMutation.mutateAsync, // Exported directly for clarity
    extendSampleCheckout: extendSampleCheckoutMutation.mutateAsync,
    transferCheckouts: transferCheckoutsMutation.mutateAsync,
  };
};