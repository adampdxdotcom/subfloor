import { useQuery } from '@tanstack/react-query';
import * as materialOrderService from '../services/materialOrderService';

export const useMaterialOrders = (projectId?: number) => {
    return useQuery({
        // We use a different key structure here because in the future we might 
        // want to paginate or filter on the server.
        // For now, consistent with other hooks, we fetch all and select.
        queryKey: ['material_orders'], 
        queryFn: () => materialOrderService.getMaterialOrders(),
        select: (data) => projectId 
            ? data.filter(o => o.projectId === projectId) 
            : data,
    });
};