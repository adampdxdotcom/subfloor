import { useState, useCallback } from 'react';
import { ActivityLogEntry } from '../types';
import { toast } from 'react-hot-toast';
import * as customerService from '../services/customerService';
import * as projectService from '../services/projectService';
import * as quoteService from '../services/quoteService';
import * as installerService from '../services/installerService';
import * as vendorService from '../services/vendorService';
import * as productService from '../services/productService';
import * as materialOrderService from '../services/materialOrderService';

export const useHistory = () => {
    const [customerHistory, setCustomerHistory] = useState<ActivityLogEntry[]>([]);
    const [projectHistory, setProjectHistory] = useState<ActivityLogEntry[]>([]);
    const [quotesHistory, setQuotesHistory] = useState<ActivityLogEntry[]>([]);
    const [installerHistory, setInstallerHistory] = useState<ActivityLogEntry[]>([]);
    const [vendorHistory, setVendorHistory] = useState<ActivityLogEntry[]>([]);
    const [sampleHistory, setSampleHistory] = useState<ActivityLogEntry[]>([]); // "Sample" maps to Product
    const [materialOrderHistory, setMaterialOrderHistory] = useState<ActivityLogEntry[]>([]);

    // Generic fetcher to reduce code duplication
    const fetchGeneric = useCallback(async (
        label: string,
        serviceFn: (id: any) => Promise<ActivityLogEntry[]>,
        setState: React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>,
        id: number | string
    ) => {
        try {
            const data = await serviceFn(id);
            setState(data);
        } catch (error) {
            console.error(`Error fetching ${label} history:`, error);
            toast.error(`Could not load ${label} history.`);
            setState([]);
        }
    }, []);

    // Exposed functions
    const fetchCustomerHistory = useCallback((id: number) => 
        fetchGeneric('customer', customerService.getCustomerHistory, setCustomerHistory, id), [fetchGeneric]);

    const fetchProjectHistory = useCallback((id: number) => 
        fetchGeneric('project', projectService.getProjectHistory, setProjectHistory, id), [fetchGeneric]);

    const fetchQuotesHistory = useCallback((id: number) => 
        fetchGeneric('quote', quoteService.getQuotesHistory, setQuotesHistory, id), [fetchGeneric]);

    const fetchInstallerHistory = useCallback((id: number) => 
        fetchGeneric('installer', installerService.getInstallerHistory, setInstallerHistory, id), [fetchGeneric]);

    const fetchVendorHistory = useCallback((id: number) => 
        fetchGeneric('vendor', vendorService.getVendorHistory, setVendorHistory, id), [fetchGeneric]);

    const fetchSampleHistory = useCallback((id: number | string) => 
        // Note: 'sample' history actually uses the Product service now
        fetchGeneric('product', (pid) => productService.getProductHistory(String(pid)), setSampleHistory, id), [fetchGeneric]);

    const fetchMaterialOrderHistory = useCallback((id: number) => 
        fetchGeneric('order', materialOrderService.getMaterialOrderHistory, setMaterialOrderHistory, id), [fetchGeneric]);

    return {
        customerHistory, fetchCustomerHistory,
        projectHistory, fetchProjectHistory,
        quotesHistory, fetchQuotesHistory,
        installerHistory, fetchInstallerHistory,
        vendorHistory, fetchVendorHistory,
        sampleHistory, fetchSampleHistory,
        materialOrderHistory, fetchMaterialOrderHistory
    };
};