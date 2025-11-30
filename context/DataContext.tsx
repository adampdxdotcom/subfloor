import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
// --- CORRECTED: Import UserPreferences and remove UiPreferences ---
import { AppData, Customer, DataContextType, Installer, Job, Project, ProjectStatus, Quote, Product, ProductVariant, SampleCheckout, ChangeOrder, MaterialOrder, Vendor, CurrentUser, ActivityLogEntry, UserPreferences, User, SystemBranding } from '../types';
import { toast } from 'react-hot-toast';

import { useSessionContext } from 'supertokens-auth-react/recipe/session';
import { useQueryClient } from '@tanstack/react-query';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { useProducts, useProductMutations } from '../hooks/useProducts';
import { useCustomers, useCustomerMutations } from '../hooks/useCustomers';
import { useProjects, useProjectMutations } from '../hooks/useProjects';
import { useInstallers, useInstallerMutations } from '../hooks/useInstallers';
import { useVendors, useVendorMutations } from '../hooks/useVendors';
import { useQuotes, useQuoteMutations } from '../hooks/useQuotes';
import { useJobs, useJobMutations } from '../hooks/useJobs';
import { useChangeOrders, useChangeOrderMutations } from '../hooks/useChangeOrders';
import { useMaterialOrders, useMaterialOrderMutations } from '../hooks/useMaterialOrders';
import { useSampleCheckouts, useSampleCheckoutMutations } from '../hooks/useSampleCheckouts';

import * as customerService from '../services/customerService';
import * as productService from '../services/productService'; // New Service
import * as projectService from '../services/projectService';
import * as installerService from '../services/installerService';
import * as quoteService from '../services/quoteService';
import * as jobService from '../services/jobService';
import * as sampleCheckoutService from '../services/sampleCheckoutService';
import * as changeOrderService from '../services/changeOrderService';
import * as materialOrderService from '../services/materialOrderService';
import * as vendorService from '../services/vendorService';
import * as userService from '../services/userService';
import * as preferenceService from '../services/preferenceService';
import * as notificationService from '../services/notificationService'; // NEW
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

  // --- REMOVED: The standalone uiPreferences state is no longer needed ---
  // const [uiPreferences, setUiPreferences] = useState<UiPreferences | null>(null);

  const [customerHistory, setCustomerHistory] = useState<ActivityLogEntry[]>([]);
  const [projectHistory, setProjectHistory] = useState<ActivityLogEntry[]>([]);
  const [quotesHistory, setQuotesHistory] = useState<ActivityLogEntry[]>([]);
  const [installerHistory, setInstallerHistory] = useState<ActivityLogEntry[]>([]);
  const [vendorHistory, setVendorHistory] = useState<ActivityLogEntry[]>([]);
  const [sampleHistory, setSampleHistory] = useState<ActivityLogEntry[]>([]);
  const [materialOrderHistory, setMaterialOrderHistory] = useState<ActivityLogEntry[]>([]);
  
  // --- REACT QUERY: Notification Polling ---
  // Replaces the manual useEffect/setInterval loop below
  const { data: unreadCount = 0 } = useUnreadNotificationCount(!!currentUser);

  // --- REACT QUERY: Products (Inventory) ---
  const { data: products = [], isLoading: productsLoading } = useProducts(!!currentUser);
  const productMutations = useProductMutations();
  
  // --- REACT QUERY: Customers ---
  const { data: customers = [], isLoading: customersLoading } = useCustomers(!!currentUser);
  const customerMutations = useCustomerMutations();

  // --- REACT QUERY: Projects ---
  const { data: projects = [], isLoading: projectsLoading } = useProjects(!!currentUser);
  const projectMutations = useProjectMutations();
  
  // --- REACT QUERY: Installers ---
  const { data: installers = [], isLoading: installersLoading } = useInstallers(!!currentUser);
  const installerMutations = useInstallerMutations();

  // --- REACT QUERY: Vendors ---
  const { data: vendors = [], isLoading: vendorsLoading } = useVendors(!!currentUser);
  const vendorMutations = useVendorMutations();

  // --- REACT QUERY: Quotes ---
  const { data: quotes = [], isLoading: quotesLoading } = useQuotes(!!currentUser);
  const quoteMutations = useQuoteMutations();

  // --- REACT QUERY: Jobs ---
  const { data: jobs = [], isLoading: jobsLoading } = useJobs(!!currentUser);
  const jobMutations = useJobMutations();

  // --- REACT QUERY: Change Orders ---
  const { data: changeOrders = [], isLoading: changeOrdersLoading } = useChangeOrders(!!currentUser);
  const changeOrderMutations = useChangeOrderMutations();

  // --- REACT QUERY: Material Orders ---
  const { data: materialOrders = [], isLoading: materialOrdersLoading } = useMaterialOrders(!!currentUser);
  const materialOrderMutations = useMaterialOrderMutations();

  // --- REACT QUERY: Sample Checkouts ---
  const { data: sampleCheckouts = [], isLoading: sampleCheckoutsLoading } = useSampleCheckouts(!!currentUser);
  const sampleCheckoutMutations = useSampleCheckoutMutations();
  

  const toggleLayoutEditMode = () => {
    setIsLayoutEditMode(prevMode => !prevMode);
  };

  // --- THIS IS THE FIX (RENAMED & IMPLEMENTED DEEP MERGE/FUNCTIONAL UPDATE) ---
  const saveCurrentUserPreferences = useCallback(
    debounce((newPreferences: Partial<UserPreferences>) => {
      // Use a functional update with setCurrentUser to get the most recent state
      setCurrentUser(prevUser => {
        if (!prevUser) return null;

        // Perform a deep merge to handle nested objects
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

        // Fire off the save request
        preferenceService.savePreferences(mergedPreferences)
          .then(() => toast.success("Preferences saved!"))
          .catch(error => {
            console.error("Failed to save preferences:", error);
            toast.error("Could not save your preferences.");
          });
        
        // Return the new state for optimistic update
        return { ...prevUser, preferences: mergedPreferences as UserPreferences };
      });
    }, 1000), 
    [] // No dependencies, ensures function uses latest state via functional update
  );


  const fetchCurrentUser = useCallback(async () => {
    try {
      const user = await userService.getCurrentUser();
      const prefs = await preferenceService.getPreferences();
      // Attach preferences directly to the user object upon fetching
      setCurrentUser({ ...user, preferences: prefs });
    } catch (error) {
      console.error("Failed to fetch current user:", error);
      setCurrentUser(null);
    }
  }, []);
  
  const refreshBranding = useCallback(async () => {
    try {
      // We assume this method exists or will be added to preferenceService
      const branding = await preferenceService.getSystemPreference('branding');
      setSystemBranding(branding);
    } catch (error) {
      console.error("Failed to fetch branding:", error);
    }
  }, []);

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
        const [] = await Promise.all([
            refreshBranding()
        ]);
        setData({
            customers: [], // Handled by React Query
            projects: [], // Handled by React Query
            samples: [], // Deprecated, kept for AppData consistency until full migration
            products: [], // Data now handled by React Query, kept here for type safety if needed initially
            sampleCheckouts: [], // Handled by React Query
            installers: [], // Handled by React Query
            quotes: [], // Handled by React Query
            jobs: [], // Handled by React Query
            changeOrders: [], // Handled by React Query
            materialOrders: [], // Handled by React Query
            vendors: [], // Handled by React Query
            users: [], // users are fetched separately
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
  
  
  // Generic helper for history fetch (re-defined here to access pool/service context if needed)
  const fetchActivityHistory = (entityType: string, setHistory: React.Dispatch<React.SetStateAction<ActivityLogEntry[]>>) => 
    useCallback(async (id: number | string) => {
        const serviceMap = {
            'CUSTOMER': customerService.getCustomerHistory,
            'PROJECT': projectService.getProjectHistory,
            'QUOTE': quoteService.getQuotesHistory,
            'INSTALLER': installerService.getInstallerHistory,
            'VENDOR': vendorService.getVendorHistory,
            'PRODUCT': (id: number | string) => productService.getProductHistory(String(id)), // Assume Product/Variant IDs are strings/UUIDs
            'ORDER': materialOrderService.getMaterialOrderHistory,
        };
        
        const service = serviceMap[entityType as keyof typeof serviceMap];
        if (!service) {
            console.error(`No history service found for entity type: ${entityType}`);
            return;
        }

        try {
            const historyData = await service(id);
            setHistory(historyData);
        } catch (error) {
            console.error(`Error fetching ${entityType} history:`, error);
            toast.error(`Could not load ${entityType} history.`);
            setHistory([]);
        }
    }, []);

  const fetchCustomerHistory = fetchActivityHistory('CUSTOMER', setCustomerHistory);
  const fetchProjectHistory = fetchActivityHistory('PROJECT', setProjectHistory);
  const fetchQuotesHistory = fetchActivityHistory('QUOTE', setQuotesHistory);
  const fetchInstallerHistory = fetchActivityHistory('INSTALLER', setInstallerHistory);
  const fetchVendorHistory = fetchActivityHistory('VENDOR', setVendorHistory);
  const fetchSampleHistory = fetchActivityHistory('PRODUCT', setSampleHistory); // Updated Entity Name
  const fetchMaterialOrderHistory = fetchActivityHistory('ORDER', setMaterialOrderHistory);


  const addVendor = useCallback(async (vendor: Omit<Vendor, 'id'>): Promise<void> => {
      await vendorMutations.addVendor.mutateAsync(vendor);
  }, [vendorMutations.addVendor]);
  
  const updateVendor = useCallback(async (vendor: Vendor): Promise<void> => {
      // Use object destructuring to separate id from the rest
      const { id, ...data } = vendor;
      await vendorMutations.updateVendor.mutateAsync({ id, data });
  }, [vendorMutations.updateVendor]);

  const deleteVendor = useCallback(async (vendorId: number): Promise<void> => {
      await vendorMutations.deleteVendor.mutateAsync(vendorId);
  }, [vendorMutations.deleteVendor]);

  // ------------------------------------
  // --- PRODUCT / INVENTORY V2 CRUD ---
  // ------------------------------------
  
    const fetchProducts = async () => {
        await queryClient.invalidateQueries({ queryKey: ['products'] });
    };

    const addProduct = async (formData: FormData) => {
        try {
            const newProduct = await productMutations.addProduct.mutateAsync(formData);
            toast.success('Product created successfully');
            return newProduct;
        } catch (error: any) {
            console.error("Failed to add product", error);
            toast.error(error.message || 'Failed to add product');
            throw error;
        }
    };

    const updateProduct = async (id: string, formData: FormData) => {
        try {
            await productMutations.updateProduct.mutateAsync({ id, formData });
            toast.success('Product updated successfully');
        } catch (error: any) {
            console.error("Failed to update product", error);
            toast.error(error.message);
            throw error;
        }
    };

    const deleteProduct = async (id: string) => {
        try {
            await productMutations.deleteProduct.mutateAsync(id);
            toast.success('Product deleted successfully');
        } catch (error: any) {
            console.error("Failed to delete product", error);
            toast.error(error.message);
            throw error;
        }
    };

    const addVariant = async (productId: string, formData: FormData) => {
        try {
            const newVariant = await productMutations.addVariant.mutateAsync({ productId, formData });
            toast.success('Variant added successfully');
            return newVariant;
        } catch (error: any) {
            console.error("Failed to add variant", error);
            toast.error(error.message);
            throw error;
        }
    };
    
    // --- NEW: Batch Add Variants (Fixes "Live Update" for Generator) ---
    const addVariantsBatch = useCallback(async (productId: string, variantsData: any[]) => {
        try {
            const newVariants = await productMutations.addVariantsBatch.mutateAsync({ productId, variants: variantsData });
            
            toast.success(`Generated ${newVariants.length} variants successfully`);
        } catch (error: any) {
            console.error("Failed to batch add variants", error);
            toast.error(error.message || 'Failed to add variants batch');
            throw error;
        }
    }, [productMutations.addVariantsBatch]);

    const updateVariant = async (variantId: string, formData: FormData) => {
        try {
            const updatedVariant = await productMutations.updateVariant.mutateAsync({ variantId, formData });
            toast.success('Variant updated successfully');
            return updatedVariant;
        } catch (error: any) {
            console.error("Failed to update variant", error);
            toast.error(error.message);
            throw error;
        }
    };

    const deleteVariant = async (variantId: string, productId: string) => {
        try {
            await productMutations.deleteVariant.mutateAsync({ variantId, productId });
            toast.success('Variant deleted successfully');
        } catch (error: any) {
            console.error("Failed to delete variant", error);
            toast.error(error.message);
            throw error;
        }
    };
    
    // --- TEMPORARY DEPRECATED SAMPLE API FUNCTIONS (for old UI compatibility) ---
    // These functions now operate on the `products` state in a backwards-compatible manner.
    
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
    // ------------------------------------

  const addInstaller = useCallback(async (installer: Omit<Installer, 'id' | 'jobs'>): Promise<Installer> => {
    try {
      const newDbInstaller = await installerMutations.addInstaller.mutateAsync(installer);
      toast.success('Installer created successfully!');
      return newDbInstaller;
    } catch (error) { 
      console.error("Error adding installer:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, [installerMutations.addInstaller]);

  const updateInstaller = useCallback(async (installer: Installer): Promise<void> => {
    try {
      await installerMutations.updateInstaller.mutateAsync(installer);
      toast.success('Installer updated successfully!');
    } catch (error) { 
      console.error("Error updating installer:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [installerMutations.updateInstaller]);

  const deleteInstaller = useCallback(async (installerId: number): Promise<void> => {
    try {
      await installerMutations.deleteInstaller.mutateAsync(installerId);
    } catch (error) {
      console.error("Error deleting installer:", error);
      throw error;
    }
  }, [installerMutations.deleteInstaller]);


  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'createdAt' | 'jobs'>): Promise<Customer> => {
    try {
      const newDbCustomer = await customerMutations.addCustomer.mutateAsync(customer);
      toast.success('Customer created successfully!');
      return newDbCustomer;
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [customerMutations.addCustomer]);

  const updateCustomer = useCallback(async (customer: Customer): Promise<void> => {
    try {
      await customerMutations.updateCustomer.mutateAsync(customer);
      toast.success('Customer updated successfully!');
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [customerMutations.updateCustomer]);
  
  const deleteCustomer = useCallback(async (customerId: number): Promise<void> => {
    try {
      await customerMutations.deleteCustomer.mutateAsync(customerId);
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
  }, [customerMutations.deleteCustomer]);
  
  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'createdAt'> & { installerId?: number }): Promise<Project> => {
    try {
      const newDbProject = await projectMutations.addProject.mutateAsync(projectData);
      toast.success('Project created successfully!');
      return newDbProject;
    } catch (error) { 
      console.error("Error adding project:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [projectMutations.addProject]);

  const updateProject = useCallback(async (projectToUpdate: Partial<Project> & { id: number }) => {
    try {
      await projectMutations.updateProject.mutateAsync(projectToUpdate);
      if (projectToUpdate.status) {
        toast.success(`Project status updated to: ${projectToUpdate.status.replace(/_/g, ' ')}`);
      } else {
        toast.success('Project updated!');
      }
    } catch (error) { 
      console.error("Error updating project:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [projectMutations.updateProject]);

  const deleteProject = useCallback(async (projectId: number): Promise<void> => {
    try {
      await projectMutations.deleteProject.mutateAsync(projectId);
      // Update legacy state stores until they are migrated
      setChangeOrders(prevData => (prevData.filter(co => co.projectId !== projectId)));
      setMaterialOrders(prevData => (prevData.filter(mo => mo.projectId !== projectId)));
    } catch (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      throw error;
    }
  }, [projectMutations.deleteProject, queryClient]); // Removed unused quote/job mutations from dependency array

  const addSampleCheckout = useCallback(async (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>): Promise<void> => {
    try {
      await sampleCheckoutMutations.addSampleCheckout.mutateAsync(checkout);
      toast.success('Sample checked out!');
    } catch (error) { 
      console.error("Error adding sample checkout:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [sampleCheckoutMutations.addSampleCheckout]);

  const updateSampleCheckout = useCallback(async (checkout: SampleCheckout): Promise<void> => {
    try {
      await sampleCheckoutMutations.returnSampleCheckout.mutateAsync(checkout);
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
        const currentDueDate = new Date(checkout.expectedReturnDate);
        currentDueDate.setDate(currentDueDate.getDate() + 2);
        const newReturnDate = currentDueDate.toISOString();

        await sampleCheckoutMutations.patchSampleCheckout.mutateAsync({
            id: checkout.id,
            data: { expectedReturnDate: newReturnDate }
        });
        toast.success('Checkout extended by 2 days!');
    } catch (error) {
        console.error("Error extending sample checkout:", error);
        toast.error((error as Error).message);
        throw error;
    }
  }, [sampleCheckoutMutations.patchSampleCheckout]);

  // --- NEW: Toggle "Selected" status for Design Board ---
  const toggleSampleSelection = useCallback(async (checkout: SampleCheckout): Promise<void> => {
      try {
          await sampleCheckoutMutations.patchSampleCheckout.mutateAsync({
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
      await quoteMutations.addQuote.mutateAsync(quote);
      toast.success('Quote added successfully!');
      // Project status update is handled by invalidation in the hook
    } catch (error) { 
      console.error("Error adding quote:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, [quoteMutations.addQuote]);

  const updateQuote = useCallback(async (quote: Partial<Quote> & { id: number }): Promise<void> => {
    try {
      await quoteMutations.updateQuote.mutateAsync(quote);
      toast.success('Quote updated!');
    } catch (error) 
      { console.error("Error updating quote:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, [quoteMutations.updateQuote]);
  
  const acceptQuote = useCallback(async (quote: Partial<Quote> & { id: number }): Promise<void> => {
    try {
      await quoteMutations.acceptQuote.mutateAsync(quote);
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
      await changeOrderMutations.addChangeOrder.mutateAsync(changeOrder);
      toast.success('Change order added!');
    } catch (error) {
      console.error("Error adding change order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [changeOrderMutations.addChangeOrder]);
  
  const updateChangeOrder = useCallback(async (changeOrderId: number, changeOrderData: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt' | 'quoteId'>>): Promise<void> => {
    try {
      await changeOrderMutations.updateChangeOrder.mutateAsync({ id: changeOrderId, data: changeOrderData });
      toast.success('Change order updated!');
    } catch (error) {
      console.error("Error updating change order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [changeOrderMutations.updateChangeOrder]);

  const deleteChangeOrder = useCallback(async (changeOrderId: number): Promise<void> => {
    try {
        await changeOrderMutations.deleteChangeOrder.mutateAsync(changeOrderId);
    } catch (error) {
        console.error("Error deleting change order:", error);
        throw error;
    }
  }, [changeOrderMutations.deleteChangeOrder]);

  const addMaterialOrder = useCallback(async (orderData: any): Promise<void> => {
    try {
        await materialOrderMutations.addMaterialOrder.mutateAsync(orderData);
        toast.success('Material order created!');
    } catch (error) {
        console.error("Error adding material order:", error);
        toast.error((error as Error).message);
        throw error;
    }
  }, [materialOrderMutations.addMaterialOrder]);
  
  const updateMaterialOrder = useCallback(async (orderId: number, orderData: any): Promise<void> => {
    try {
      await materialOrderMutations.updateMaterialOrder.mutateAsync({ id: orderId, data: orderData });
      toast.success('Material order updated!');
    } catch (error) {
      console.error("Error updating material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.updateMaterialOrder]);

  const deleteMaterialOrder = useCallback(async (orderId: number): Promise<void> => {
    try {
      await materialOrderMutations.deleteMaterialOrder.mutateAsync(orderId);
      toast.success('Material order deleted!');
    } catch (error) {
      console.error("Error deleting material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.deleteMaterialOrder]);

  const receiveMaterialOrder = useCallback(async (orderId: number, data: { dateReceived: string; notes: string; sendEmailNotification: boolean }): Promise<void> => {
    try {
      await materialOrderMutations.receiveMaterialOrder.mutateAsync({ id: orderId, data });
      toast.success('Order received!');
    } catch (error) {
      console.error("Error receiving material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.receiveMaterialOrder]);

  const reportMaterialOrderDamage = useCallback(async (orderId: number, data: { items: any[]; replacementEta: string; notes: string; sendEmailNotification: boolean }): Promise<void> => {
    try {
      await materialOrderMutations.reportMaterialOrderDamage.mutateAsync({ id: orderId, data });
      toast.success('Damage reported & replacement ordered!');
    } catch (error) {
      console.error("Error reporting damage:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [materialOrderMutations.reportMaterialOrderDamage]);

  // Compatibility: Manually update React Query cache for local updates
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
    samples: [], // Deprecated, replaced by products
    sampleCheckouts,
    installers,
    quotes,
    jobs,
    changeOrders,
    materialOrders,
    vendors,
    users,
    
    // NEW INVENTORY V2
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

    // --- CORRECTED: Expose the correctly named function ---
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
    fetchSampleHistory: (id) => fetchActivityHistory('PRODUCT', setSampleHistory)(id),
    materialOrderHistory,
    fetchMaterialOrderHistory,

    fetchSamples, // Alias to fetchProducts
    addSample, // Deprecated stub
    updateSample, // Deprecated stub
    deleteSample, // Deprecated stub
    toggleSampleDiscontinued, // Deprecated stub
    
    // NEW PRODUCT CRUD
    fetchProducts,
    addProduct,
    updateProduct,
    deleteProduct,
    addVariant,
    addVariantsBatch, // Expose it
    updateVariant,
    deleteVariant,

    addInstaller, 
    updateInstaller,
    deleteInstaller,
    addCustomer, 
    updateCustomer,
    deleteCustomer,
    addProject, 
    updateProject,
    deleteProject,
    addSampleCheckout, 
    updateSampleCheckout,
    extendSampleCheckout,
    toggleSampleSelection, // Expose new function
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
    addVendor,
    updateVendor,
    deleteVendor,
    updateJob,
    unreadCount, // Expose count
    refreshNotifications: async () => queryClient.invalidateQueries({ queryKey: ['notifications', 'unreadCount'] }) // Helper
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