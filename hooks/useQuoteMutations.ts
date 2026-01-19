import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as quoteService from '../services/quoteService';
import { Quote } from '../types';

export const useQuoteMutations = () => {
  const queryClient = useQueryClient();

  const addQuoteMutation = useMutation({
    mutationFn: (quote: Omit<Quote, 'id' | 'dateSent'>) => 
      quoteService.addQuote(quote),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['quotes', 'history', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
    },
  });

  const updateQuoteMutation = useMutation({
    mutationFn: (quote: Partial<Quote> & { id: number }) =>
      quoteService.updateQuote(quote),
    onSuccess: (updatedQuote) => {
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', updatedQuote.projectId] });
      queryClient.invalidateQueries({ queryKey: ['quotes', 'history', updatedQuote.projectId] });
    },
  });

  const acceptQuoteMutation = useMutation({
    mutationFn: (quote: Partial<Quote> & { id: number }) => quoteService.acceptQuote(quote),
    onSuccess: (data) => {
      const { updatedQuote } = data;
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['quotes', updatedQuote.projectId] });
      queryClient.invalidateQueries({ queryKey: ['quotes', 'history', updatedQuote.projectId] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });

  return {
    addQuote: addQuoteMutation.mutateAsync,
    updateQuote: updateQuoteMutation.mutateAsync,
    acceptQuote: acceptQuoteMutation.mutateAsync,
  };
};