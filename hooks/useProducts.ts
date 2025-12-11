import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as productService from '../services/productService';

export const useProducts = (enabled: boolean = true) => {
    return useQuery({
        queryKey: ['products'],
        queryFn: productService.getProducts,
        enabled,
    });
};

export const useProductMutations = () => {
    const queryClient = useQueryClient();

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['products'] });

    return {
        addProduct: useMutation({
            mutationFn: productService.createProduct,
            onSuccess: invalidate,
        }),
        updateProduct: useMutation({
            mutationFn: ({ id, formData }: { id: string; formData: FormData }) => 
                productService.updateProduct(id, formData),
            onSuccess: invalidate,
        }),
        duplicateProduct: useMutation({
            mutationFn: productService.duplicateProduct,
            onSuccess: invalidate,
        }),
        deleteProduct: useMutation({
            mutationFn: productService.deleteProduct,
            onSuccess: invalidate,
        }),
        addVariant: useMutation({
            mutationFn: ({ productId, formData }: { productId: string; formData: FormData }) => 
                productService.addVariant(productId, formData),
            onSuccess: invalidate,
        }),
        addVariantsBatch: useMutation({
            mutationFn: ({ productId, variants }: { productId: string; variants: any[] }) => 
                productService.createVariantsBatch(productId, variants),
            onSuccess: invalidate,
        }),
        updateVariant: useMutation({
            mutationFn: ({ variantId, formData }: { variantId: string; formData: FormData }) => 
                productService.updateVariant(variantId, formData),
            onSuccess: invalidate,
        }),
        batchUpdateVariants: useMutation({
            mutationFn: ({ ids, updates }: { ids: string[], updates: any }) => 
                productService.batchUpdateVariants(ids, updates),
            onSuccess: invalidate,
        }),
        deleteVariant: useMutation({
            mutationFn: productService.deleteVariant,
            onSuccess: invalidate,
        }),
    };
};