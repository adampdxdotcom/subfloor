// src/services/reportService.ts

import axios from 'axios';
import { UserPreferences } from '../types';

type DashboardEmailPrefs = UserPreferences['dashboardEmail'];

export interface ProductReportFilters {
    includeDiscontinued?: boolean;
    manufacturerId?: number | string;
    productType?: string;
}

export interface JobReportFilters {
    startDate?: string;
    endDate?: string;
    status?: string;
}

export interface InstallerReportFilters {
    startDate?: string;
    endDate?: string;
    installerId?: number | string;
}

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

// --- NEW REPORT GENERATOR FUNCTIONS ---

export const getProductReport = async (params: ProductReportFilters = {}): Promise<any[]> => {
    try {
        const response = await axios.get('/api/report-generator/products', { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching product report:", error);
        throw error;
    }
};

export const getJobReport = async (params: JobReportFilters = {}): Promise<any[]> => {
    try {
        const response = await axios.get('/api/report-generator/jobs', { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching job report:", error);
        throw error;
    }
};

export const getInstallerReport = async (params: InstallerReportFilters = {}): Promise<any[]> => {
    try {
        const response = await axios.get('/api/report-generator/installers', { params });
        return response.data;
    } catch (error) {
        console.error("Error fetching installer report:", error);
        throw error;
    }
};