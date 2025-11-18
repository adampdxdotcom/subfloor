// src/services/reportService.ts

import axios from 'axios';
import { UserPreferences } from '../types';

type DashboardEmailPrefs = UserPreferences['dashboardEmail'];

export const sendTestDashboardEmail = async (settings: DashboardEmailPrefs): Promise<any> => {
    try {
        const response = await axios.post('/api/reports/dashboard/send-test', { settings });
        return response.data;
    } catch (error) {
        console.error("Error sending test dashboard email:", error);
        throw error;
    }
};

export const sendAllCustomerReminders = async (): Promise<{ message: string }> => {
    try {
        const response = await axios.post('/api/reminders/customer-samples/send-all-due-tomorrow');
        return response.data;
    } catch (error) {
        console.error("Error sending all customer reminders:", error);
        throw error;
    }
};

// --- NEW FUNCTION for PAST DUE reminders ---
export const sendAllPastDueReminders = async (): Promise<{ message: string }> => {
    try {
        const response = await axios.post('/api/reminders/customer-samples/send-all-past-due');
        return response.data;
    } catch (error) {
        console.error("Error sending all past due reminders:", error);
        throw error;
    }
};