import axios from 'axios';

export interface Notification {
    id: number;
    type: 'JOB_NOTE' | 'ASSIGNMENT' | 'SYSTEM';
    referenceId: string;
    message: string;
    linkUrl: string;
    isRead: boolean;
    createdAt: string;
    senderInitial?: string;
}

export const getNotifications = async (): Promise<Notification[]> => {
    const response = await axios.get('/api/notifications');
    return response.data;
};

export const getUnreadCount = async (): Promise<number> => {
    const response = await axios.get('/api/notifications/unread-count');
    return response.data.count;
};

export const markAsRead = async (id: number): Promise<void> => {
    await axios.patch(`/api/notifications/${id}/read`);
};

export const markAllAsRead = async (): Promise<void> => {
    await axios.patch('/api/notifications/read-all');
};

export const markReferenceAsRead = async (referenceId: string | number): Promise<void> => {
    await axios.patch(`/api/notifications/mark-reference/${referenceId}`);
};