import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
import { AppData, Customer, DataContextType, Installer, Job, Project, ProjectStatus, Quote, Product, ProductVariant, SampleCheckout, ChangeOrder, MaterialOrder, Vendor, CurrentUser, ActivityLogEntry, UserPreferences, User, SystemBranding } from '../types';
import { toast } from 'react-hot-toast';

import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { useQueryClient } from '@tanstack/react-query';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { useProducts } from '../hooks/useProducts';
import { useCustomers } from '../hooks/useCustomers';
import { useProjects } from '../hooks/useProjects';
import { useInstallers } from '../hooks/useInstallers';
import { useVendors } from '../hooks/useVendors';
import { useQuotes } from '../hooks/useQuotes';
import { useQuoteMutations } from '../hooks/useQuoteMutations';
import { useJobs, useJobMutations } from '../hooks/useJobs';
import { useChangeOrders } from '../hooks/useChangeOrders';
import { useChangeOrderMutations } from '../hooks/useChangeOrderMutations';
import { useMaterialOrders } from '../hooks/useMaterialOrders';
import { useMaterialOrderMutations } from '../hooks/useMaterialOrderMutations';
import { useSampleCheckouts } from '../hooks/useSampleCheckouts';
import { useSampleCheckoutMutations } from '../hooks/useSampleCheckoutMutations';
import { useHistory } from '../hooks/useHistory'; 

import * as userService from '../services/userService';
import * as preferenceService from '../services/preferenceService';
import { debounce } from 'lodash';

const DataContext = createContext<DataContextType | undefined>(undefined);

const emptyInitialData: AppData = {
  customers: [], projects: [], samples: [], sampleCheckouts: [], installers: [], quotes: [], jobs: [], changeOrders: [], materialOrders: [], vendors: [], users: []
};

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const sessionContext = useSessionContext();
  const queryClient = useQueryClient();
  const [data, setData] = useState<AppData>(emptyInitialData);
  const [systemBranding, setSystemBranding] = useState<SystemBranding | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [isLayoutEditMode, setIsLayoutEditMode] = useState(false);

  // --- REACT QUERY: Notification Polling ---
  const { data: unreadCount = 0 } = useUnreadNotificationCount(!!currentUser);

  // --- REACT QUERY: Products (Inventory) ---
  const { data: products = [], isLoading: productsLoading } = useProducts(!!currentUser);
  
  // --- REACT QUERY: Customers ---
  const { data: customers = [], isLoading: customersLoading } = useCustomers(!!currentUser);

  // --- REACT QUERY: Projects ---
  const { data: projects = [], isLoading: projectsLoading } = useProjects(!!currentUser);
  
  // --- REACT QUERY: Installers ---
  const { data: installers = [], isLoading: installersLoading } = useInstallers(!!currentUser);

  // --- REACT QUERY: Vendors ---
  const { data: vendors = [], isLoading: vendorsLoading } = useVendors(!!currentUser);

  // --- REACT QUERY: Quotes ---
  const { data: quotes = [], isLoading: quotesLoading } = useQuotes();
  const quoteMutations = useQuoteMutations();

  // --- REACT QUERY: Jobs ---
  const { data: jobs = [], isLoading: jobsLoading } = useJobs();
  const jobMutations = useJobMutations();

  // --- REACT QUERY: Change Orders ---
  const { data: changeOrders = [], isLoading: changeOrdersLoading } = useChangeOrders();
  const changeOrderMutations = useChangeOrderMutations();

  // --- REACT QUERY: Material Orders ---
  const { data: materialOrders = [], isLoading: materialOrdersLoading } = useMaterialOrders();
  const materialOrderMutations = useMaterialOrderMutations();

  // --- REACT QUERY: Sample Checkouts ---
  const { data: sampleCheckouts = [], isLoading: sampleCheckoutsLoading } = useSampleCheckouts();
  const sampleCheckoutMutations = useSampleCheckoutMutations();
  
  // --- HISTORY ---
  const {
    customerHistory, fetchCustomerHistory,
    projectHistory, fetchProjectHistory,
    quotesHistory, fetchQuotesHistory,
    installerHistory, fetchInstallerHistory,
    vendorHistory, fetchVendorHistory,
    sampleHistory, fetchSampleHistory,
    materialOrderHistory, fetchMaterialOrderHistory
  } = useHistory();


  const toggleLayoutEditMode = () => {
    setIsLayoutEditMode(prevMode => !prevMode);
  };

  const saveCurrentUserPreferences = useCallback(
    debounce((newPreferences: Partial<UserPreferences>) => {
      setCurrentUser(prevUser => {
        if (!prevUser) return null;

        const mergedPreferences = {
          ...prevUser.preferences,
          ...newPreferences,
          calendarColor: newPreferences.calendarColor || prevUser.preferences?.calendarColor,
          dashboardEmail: {
            ...(prevUser.preferences?.dashboardEmail || {}),
            ...(newPreferences.dashboardEmail || {}),
          },
          calendar_user_colors: {
            ...(prevUser.preferences?.calendar_user_colors || {}),
            ...(newPreferences.calendar_user_colors || {}),
          },
          projectLayouts: newPreferences.projectLayouts || prevUser.preferences?.projectLayouts,
        };

        preferenceService.savePreferences(mergedPreferences)
          .then(() => toast.success("Preferences saved!"))
          .catch(error => {
            console.error("Failed to save preferences:", error);
            toast.error("Could not save your preferences.");
          });
        
        return { ...prevUser, preferences: mergedPreferences as UserPreferences };
      });
    }, 1000), 
    []
  );


  const fetchCurrentUser = useCallback(async () => {
    try {
      const user = await userService.getCurrentUser();
      const prefs = await preferenceService.getPreferences();
      setCurrentUser({ ...user, preferences: prefs });
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      setCurrentUser(null);
    }
  }, []);
  
  const refreshBranding = useCallback(async () => {
    try {
      const branding = await preferenceService.getSystemPreference('branding');
      setSystemBranding(branding);
    } catch (error) {
      console.error("Failed to fetch branding:", error);
    }
  }, []);

  useEffect(() => {
      if (systemBranding) {
          const root = document.documentElement;
          if (systemBranding.primaryColor) root.style.setProperty('--color-primary', systemBranding.primaryColor);
          
          if (systemBranding.secondaryColor) {
              root.style.setProperty('--color-secondary', systemBranding.secondaryColor);
              root.style.setProperty('--color-border', systemBranding.secondaryColor);
          }
          
          if (systemBranding.accentColor) root.style.setProperty('--color-accent', systemBranding.accentColor);
          
          if (systemBranding.backgroundColor) root.style.setProperty('--color-background', systemBranding.backgroundColor);
          if (systemBranding.surfaceColor) root.style.setProperty('--color-surface', systemBranding.surfaceColor);
          if (systemBranding.textPrimaryColor) root.style.setProperty('--color-text-primary', systemBranding.textPrimaryColor);
          if (systemBranding.textSecondaryColor) root.style.setProperty('--color-text-secondary', systemBranding.textSecondaryColor);
      }
  }, [systemBranding]);

  const fetchAllUsers = useCallback(async () => {
    try {
      const allUsers = await userService.getUsers();
      setUsers(allUsers);
    } catch (error) {
      console.error("Failed to fetch all users:", error);
      setUsers([]);
    }
  }, []);

  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
        await Promise.all([
            refreshBranding()
        ]);
        setData({
            customers: [],
            projects: [],
            samples: [],
            products: [],
            sampleCheckouts: [],
            installers: [],
            quotes: [],
            jobs: [],
            changeOrders: [],
            materialOrders: [],
            vendors: [],
            users: [],
        });
        
    } catch (error) {
        console.error("Initial data fetch failed (likely no session):", error);
        setData(emptyInitialData);
    } finally {
        setIsLoading(false);
    }
  }, [refreshBranding]); 
  
  useEffect(() => {
    if (sessionContext.loading) {
        setIsLoading(true);
        return;
    }

    if (sessionContext.doesSessionExist) {
        fetchCurrentUser().then(() => {
            fetchInitialData();
            fetchAllUsers();
        });
    } else {
        setData(emptyInitialData);
        setCurrentUser(null);
        setIsLoading(false);
    }
  }, [sessionContext.doesSessionExist, sessionContext.loading, fetchInitialData, fetchCurrentUser, fetchAllUsers]);
  
  
    const fetchProducts = async () => {
        await queryClient.invalidateQueries({ queryKey: ['products'] });
    };

    const fetchSamples = fetchProducts; // Alias
    
    const addSample = useCallback(async (sample: any): Promise<any> => {
        toast.error("Deprecated function called: Use addProduct.");
        throw new Error("Deprecated function called.");
    }, []);

    const updateSample = useCallback(async (sampleId: number, sampleData: any): Promise<void> => {
        toast.error("Deprecated function called: Use updateProduct.");
    }, []);
    
    const toggleSampleDiscontinued = useCallback(async (sampleId: number, isDiscontinued: boolean): Promise<void> => {
        toast.error("Deprecated function called: Use updateProduct/ProductService.");
    }, []);

    const deleteSample = useCallback(async (sampleId: number): Promise<void> => {
        toast.error("Deprecated function called: Use deleteProduct.");
    }, []);

  const addSampleCheckout = useCallback(async (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>): Promise<void> => {
    try {
      await sampleCheckoutMutations.addSampleCheckout(checkout);
      toast.success('Sample checked out!');
    } catch (error) { 
      console.error("Error adding sample checkout:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [sampleCheckoutMutations.addSampleCheckout]);

  const updateSampleCheckout = useCallback(async (checkout: SampleCheckout): Promise<void> => {
    try {
      await sampleCheckoutMutations.returnSampleCheckout(checkout);
      toast.success('Sample returned!');
    } catch (error) 
      { 
      console.error("Error updating sample checkout:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [sampleCheckoutMutations.returnSampleCheckout]);

  const extendSampleCheckout = useCallback(async (checkout: SampleCheckout): Promise<void> => {
    try {
        await sampleCheckoutMutations.extendSampleCheckout(checkout.id);
        toast.success('Checkout extended by 2 days!');
    } catch (error) {
        console.error("Error extending sample checkout:", error);
        toast.error((error as Error).message);
        throw error;
    }
  }, [sampleCheckoutMutations.extendSampleCheckout]);

  const toggleSampleSelection = useCallback(async (checkout: SampleCheckout): Promise<void> => {
      try {
          await sampleCheckoutMutations.patchSampleCheckout({
              id: checkout.id,
              data: { isSelected: !checkout.isSelected }
          });
          toast.success(!checkout.isSelected ? "Sample selected!" : "Sample deselected.");
      } catch (error) {
          console.error("Error toggling selection:", error);
          toast.error("Failed to update selection.");
      }
  }, [sampleCheckoutMutations.patchSampleCheckout]);

  const addQuote = useCallback(async (quote: Omit<Quote, 'id'|'dateSent'>): Promise<void> => {
    try {
      await quoteMutations.addQuote(quote);
      toast.success('Quote added successfully!');
    } catch (error) { 
      console.error("Error adding quote:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, [quoteMutations.addQuote]);

  const updateQuote = useCallback(async (quote: Partial<Quote> & { id: number }): Promise<void> => {
    try {
      await quoteMutations.updateQuote(quote);
      toast.success('Quote updated!');
    } catch (error) 
      { console.error("Error updating quote:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, [quoteMutations.updateQuote]);
  
  const acceptQuote = useCallback(async (quote: Partial<Quote> & { id: number }): Promise<void> => {
    try {
      await quoteMutations.acceptQuote(quote);
      toast.success('Quote accepted and project status updated!');
    } catch (error) {
      console.error("Error accepting quote:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [quoteMutations.acceptQuote]);
  
  const saveJobDetails = useCallback(async (jobDetails: Partial<Job>): Promise<void> => {
    try {
      await jobMutations.saveJobDetails.mutateAsync(jobDetails);
      toast.success('Job details saved!');
    } catch (error) {
      console.error("Error saving job details:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [jobMutations.saveJobDetails]);

  const addChangeOrder = useCallback(async (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'>): Promise<void> => {
    try {
      await changeOrderMutations.addChangeOrder(changeOrder);
      toast.success('Change order added!');
    } catch (error) {
      console.error("Error adding change order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [changeOrderMutations.addChangeOrder]);
  
  const updateChangeOrder = useCallback(async (changeOrderId: number, changeOrderData: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt' | 'quoteId'>>): Promise<void> => {
    try {
      await changeOrderMutations.updateChangeOrder({ id: changeOrderId, data: changeOrderData });
      toast.success('Change order updated!');
    } catch (error) {
      console.error("Error updating change order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [changeOrderMutations.updateChangeOrder]);

  const deleteChangeOrder = useCallback(async (changeOrderId: number): Promise<void> => {
    try {
        await changeOrderMutations.deleteChangeOrder(changeOrderId);
    } catch (error) {
        console.error("Error deleting change order:", error);
        throw error;
    }
  }, [changeOrderMutations.deleteChangeOrder]);

  const addMaterialOrder = useCallback(async (orderData: any): Promise<void> => {
    try {
        await materialOrderMutations.addMaterialOrder(orderData);
        toast.success('Material order created!');
    } catch (error) {
        console.error("Error adding material order:", error);
        toast.error((error as Error).message);
        throw error;
    }
  }, [materialOrderMutations.addMaterialOrder]);
  
  const updateMaterialOrder = useCallback(async (orderId: number, orderData: any): Promise<void> => {
    try {
      await materialOrderMutations.updateMaterialOrder({ id: orderId, data: orderData });
      toast.success('Material order updated!');
    } catch (error) {
      console.error("Error updating material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.updateMaterialOrder]);

  const deleteMaterialOrder = useCallback(async (orderId: number): Promise<void> => {
    try {
      await materialOrderMutations.deleteMaterialOrder(orderId);
      toast.success('Material order deleted!');
    } catch (error) {
      console.error("Error deleting material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.deleteMaterialOrder]);

  const receiveMaterialOrder = useCallback(async (orderId: number, data: { dateReceived: string; notes: string; sendEmailNotification: boolean }): Promise<void> => {
    try {
      await materialOrderMutations.receiveMaterialOrder({ id: orderId, data });
      toast.success('Order received!');
    } catch (error) {
      console.error("Error receiving material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.receiveMaterialOrder]);

  const reportMaterialOrderDamage = useCallback(async (orderId: number, data: { items: any[]; replacementEta: string; notes: string; sendEmailNotification: boolean }): Promise<void> => {
    try {
      await materialOrderMutations.reportMaterialOrderDamage({ id: orderId, data });
      toast.success('Damage reported & replacement ordered!');
    } catch (error) {
      console.error("Error reporting damage:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.reportMaterialOrderDamage]);

  const updateJob = useCallback((updatedJob: Job) => { 
      queryClient.setQueryData(['jobs'], (oldJobs: Job[] | undefined) => {
          if (!oldJobs) return [updatedJob];
          return oldJobs.map(j => j.id === updatedJob.id ? updatedJob : j);
      });
  }, [queryClient]);

  const updateCurrentUserProfile = useCallback(async (firstName: string, lastName: string) => {
    try {
      const updatedProfile = await userService.updateUserProfile(firstName, lastName);
      setCurrentUser(prev => prev ? { ...prev, ...updatedProfile } : null);
      toast.success("Profile updated successfully!");
    } catch (error) {
      console.error("Error updating profile:", error);
      toast.error("Failed to update profile.");
      throw error;
    }
  }, []);

  const uploadCurrentUserAvatar = useCallback(async (file: File) => {
    try {
      const { avatarUrl } = await userService.uploadUserAvatar(file);
      setCurrentUser(prev => prev ? { ...prev, avatarUrl } : null);
      toast.success("Avatar uploaded successfully!");
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast.error("Failed to upload avatar.");
      throw error;
    }
  }, []);

  const deleteCurrentUserAvatar = useCallback(async () => {
    try {
      await userService.deleteUserAvatar();
      setCurrentUser(prev => prev ? { ...prev, avatarUrl: null } : null);
      toast.success("Avatar removed.");
    } catch (error) {
      console.error("Error removing avatar:", error);
      toast.error("Failed to remove avatar.");
    }
  }, []);


  const providerValue: DataContextType = {
    customers,
    projects,
    samples: [], 
    sampleCheckouts,
    installers,
    quotes,
    jobs,
    changeOrders,
    materialOrders,
    vendors,
    users,
    
    products, 

    isLoading: isLoading || productsLoading || customersLoading || projectsLoading || installersLoading || vendorsLoading || quotesLoading || jobsLoading || changeOrdersLoading || materialOrdersLoading || sampleCheckoutsLoading, 
    currentUser,
    systemBranding,
    refreshBranding,

    isLayoutEditMode,
    toggleLayoutEditMode,
    updateCurrentUserProfile,
    uploadCurrentUserAvatar,
    deleteCurrentUserAvatar,

    saveCurrentUserPreferences: saveCurrentUserPreferences,

    customerHistory,
    fetchCustomerHistory,
    projectHistory,
    fetchProjectHistory,
    quotesHistory,
    fetchQuotesHistory,
    installerHistory,
    fetchInstallerHistory,
    vendorHistory,            
    fetchVendorHistory,       
    sampleHistory,            
    fetchSampleHistory,
    materialOrderHistory,
    fetchMaterialOrderHistory,

    fetchSamples,
    addSample,
    updateSample,
    deleteSample,
    toggleSampleDiscontinued,
    
    fetchProducts,

    // REMOVED MUTATIONS: addInstaller, updateInstaller, deleteInstaller
    // REMOVED MUTATIONS: addCustomer, updateCustomer, deleteCustomer
    // REMOVED MUTATIONS: addProject, updateProject, deleteProject
    addSampleCheckout, 
    updateSampleCheckout,
    extendSampleCheckout,
    toggleSampleSelection,
    addQuote, 
    updateQuote,
    acceptQuote,
    saveJobDetails,
    addChangeOrder,
    updateChangeOrder,
    deleteChangeOrder,
    addMaterialOrder,
    updateMaterialOrder,
    deleteMaterialOrder,
    receiveMaterialOrder,
    reportMaterialOrderDamage,
    // REMOVED MUTATIONS: addVendor, updateVendor, deleteVendor
    updateJob,
    unreadCount,
    refreshNotifications: async () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] })
  };

  return (
    <DataContext.Provider value={providerValue}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (context === undefined) { throw new Error('useData must be used within a DataProvider'); }
  return context;
};