import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as notificationService from '../services/notificationService';

// Hook to poll unread count
export const useUnreadNotificationCount = (isAuthenticated: boolean) => {
    return useQuery({
        queryKey: ['notifications', 'unreadCount'],
        queryFn: notificationService.getUnreadCount,
        // Poll every 10 seconds, matching previous behavior
        refetchInterval: 10000, 
        // Only run if user is logged in
        enabled: isAuthenticated, 
        // Default to 0 if data is missing
        initialData: 0, 
    });
};

// Hook to mark a single notification as read
export const useMarkNotificationRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: notificationService.markAsRead,
        onSuccess: () => {
            // Refresh the count immediately after marking as read
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};

// Hook to mark all as read
export const useMarkAllNotificationsRead = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: notificationService.markAllAsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['notifications'] });
        },
    });
};