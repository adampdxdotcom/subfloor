import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as quoteService from '../services/quoteService';

export const useQuotes = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['quotes'],
        queryFn: quoteService.getQuotes,
        enabled,
    });
};

export const useQuoteMutations = () => {
    const queryClient = useQueryClient();

    return {
        addQuote: useMutation({
            mutationFn: quoteService.addQuote,
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['quotes'] });
                // Adding a quote usually updates Project Status to QUOTING
                queryClient.invalidateQueries({ queryKey: ['projects'] });
            },
        }),
        updateQuote: useMutation({
            mutationFn: quoteService.updateQuote,
            onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quotes'] }),
        }),
        acceptQuote: useMutation({
            mutationFn: quoteService.acceptQuote,
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ['quotes'] });
                // Accepting a quote updates Project Status to SCHEDULED/AWAITING
                queryClient.invalidateQueries({ queryKey: ['projects'] });
            },
        }),
    };
};