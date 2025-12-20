import axios from 'axios';
import { getEndpoint } from "../utils/apiConfig";

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
    const response = await axios.get(getEndpoint('/api/notifications'));
    return response.data;
};

export const getUnreadCount = async (): Promise<number> => {
    const response = await axios.get(getEndpoint('/api/notifications/unread-count'));
    return response.data.count;
};

export const markAsRead = async (id: number): Promise<void> => {
    await axios.patch(getEndpoint(`/api/notifications/${id}/read`));
};

export const markAllAsRead = async (): Promise<void> => {
    await axios.patch(getEndpoint('/api/notifications/read-all'));
};

export const markReferenceAsRead = async (referenceId: string | number): Promise<void> => {
    await axios.patch(getEndpoint(`/api/notifications/mark-reference/${referenceId}`));
};