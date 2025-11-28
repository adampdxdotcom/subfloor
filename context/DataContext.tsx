import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
// --- CORRECTED: Import UserPreferences and remove UiPreferences ---
import { AppData, Customer, DataContextType, Installer, Job, Project, ProjectStatus, Quote, Product, ProductVariant, SampleCheckout, ChangeOrder, MaterialOrder, Vendor, CurrentUser, ActivityLogEntry, UserPreferences, User, SystemBranding } from '../types';
import { toast } from 'react-hot-toast';

import { useSessionContext } from 'supertokens-auth-react/recipe/session';

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
  
  // State for main entities (Product replaces Sample)
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [products, setProducts] = useState<Product[]>([]); // Replaces samples
  const [sampleCheckouts, setSampleCheckouts] = useState<SampleCheckout[]>([]);
  const [installers, setInstallers] = useState<Installer[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [changeOrders, setChangeOrders] = useState<ChangeOrder[]>([]);
  const [materialOrders, setMaterialOrders] = useState<MaterialOrder[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // --- NEW: Notification State ---
  const [unreadCount, setUnreadCount] = useState(0);


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
        const [customersData, projectsData, fetchedProducts, sampleCheckoutsData, installersData, quotesData, jobsData, changeOrdersData, materialOrdersData, vendorsData] = await Promise.all([
            customerService.getCustomers(),
            projectService.getProjects(),
            productService.getProducts(), // New Fetch Call
            sampleCheckoutService.getSampleCheckouts(),
            installerService.getInstallers(),
            quoteService.getQuotes(),
            jobService.getJobs(),
            changeOrderService.getChangeOrders(),
            materialOrderService.getMaterialOrders(),
            vendorService.getVendors(),
            refreshBranding()
        ]);
        setData({
            customers: Array.isArray(customersData) ? customersData : [],
            projects: Array.isArray(projectsData) ? projectsData : [],
            samples: [], // Deprecated, kept for AppData consistency until full migration
            products: Array.isArray(fetchedProducts) ? fetchedProducts : [], // NEW
            sampleCheckouts: Array.isArray(sampleCheckoutsData) ? sampleCheckoutsData : [],
            installers: Array.isArray(installersData) ? installersData : [],
            quotes: Array.isArray(quotesData) ? quotesData : [],
            jobs: Array.isArray(jobsData) ? jobsData : [],
            changeOrders: Array.isArray(changeOrdersData) ? changeOrdersData : [],
            materialOrders: Array.isArray(materialOrdersData) ? materialOrdersData : [],
            vendors: Array.isArray(vendorsData) ? vendorsData : [],
            users: [], // users are fetched separately
        });
        setCustomers(customersData);
        setProjects(projectsData);
        setProducts(fetchedProducts); // NEW
        setSampleCheckouts(sampleCheckoutsData);
        setInstallers(installersData);
        setQuotes(quotesData);
        setJobs(jobsData);
        setChangeOrders(changeOrdersData);
        setMaterialOrders(materialOrdersData);
        setVendors(vendorsData);
        
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
  
  
  // --- NEW: Notification Poller (Run every 10s) ---
  useEffect(() => {
      if (!currentUser) return;
      
      const checkNotifications = async () => {
          try {
              const count = await notificationService.getUnreadCount();
              setUnreadCount(count);
          } catch (e) { console.error("Notification poll failed", e); }
      };

      checkNotifications(); // Initial check
      const interval = setInterval(checkNotifications, 10000); // 10s loop (Snappier)
      return () => clearInterval(interval);
  }, [currentUser]);

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
      const newVendor = await vendorService.addVendor(vendor);
      setVendors(prevData => ([...prevData, newVendor]));
  }, []);
  
  const updateVendor = useCallback(async (vendor: Vendor): Promise<void> => {
      const updatedVendor = await vendorService.updateVendor(vendor.id, vendor);
      setVendors(prevData => (
          prevData.map(v => v.id === updatedVendor.id ? updatedVendor : v)
      ));
  }, []);

  const deleteVendor = useCallback(async (vendorId: number): Promise<void> => {
      await vendorService.deleteVendor(vendorId);
      setVendors(prevData => (
          prevData.filter(v => v.id !== vendorId)
      ));
  }, []);

  // ------------------------------------
  // --- PRODUCT / INVENTORY V2 CRUD ---
  // ------------------------------------
  
    const fetchProducts = async () => {
        try {
            const fetched = await productService.getProducts();
            setProducts(fetched);
        } catch (error) {
            console.error("Failed to refresh products", error);
        }
    };

    const addProduct = async (formData: FormData) => {
        try {
            const newProduct = await productService.createProduct(formData);
            setProducts(prev => [...prev, newProduct]);
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
            await productService.updateProduct(id, formData);
            
            // REFRESH: We must fetch from server to get any side-effects 
            // (like auto-created Master Board variants)
            await fetchProducts();
            toast.success('Product updated successfully');
        } catch (error: any) {
            console.error("Failed to update product", error);
            toast.error(error.message);
            throw error;
        }
    };

    const deleteProduct = async (id: string) => {
        try {
            await productService.deleteProduct(id);
            setProducts(prev => prev.filter(p => p.id !== id));
            toast.success('Product deleted successfully');
        } catch (error: any) {
            console.error("Failed to delete product", error);
            toast.error(error.message);
            throw error;
        }
    };

    const addVariant = async (productId: string, formData: FormData) => {
        try {
            const newVariant = await productService.addVariant(productId, formData);
            // Update local state: Find product and append variant
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, variants: [...p.variants, newVariant] };
                }
                return p;
            }));
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
            // We assume the Service handles the array loop or bulk insert
            const newVariants = await productService.createVariantsBatch(productId, variantsData);
            
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    // Append all new variants
                    return { ...p, variants: [...p.variants, ...newVariants] };
                }
                return p;
            }));
            
            toast.success(`Generated ${newVariants.length} variants successfully`);
        } catch (error: any) {
            console.error("Failed to batch add variants", error);
            toast.error(error.message || 'Failed to add variants batch');
            throw error;
        }
    }, []);

    const updateVariant = async (variantId: string, formData: FormData) => {
        try {
            const updatedVariant = await productService.updateVariant(variantId, formData);
            setProducts(prev => prev.map(p => {
                // Optimistically check if this product owns the variant to update it
                if (p.variants.some(v => String(v.id) === String(variantId))) {
                    return {
                        ...p,
                        variants: p.variants.map(v => String(v.id) === String(variantId) ? updatedVariant : v)
                    };
                }
                return p;
            }));
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
            await productService.deleteVariant(variantId);
            setProducts(prev => prev.map(p => {
                if (p.id === productId) {
                    return { ...p, variants: p.variants.filter(v => String(v.id) !== String(variantId)) };
                }
                return p;
            }));
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
      const newDbInstaller = await installerService.addInstaller(installer);
      setInstallers(prevData => ([...prevData, newDbInstaller]));
      toast.success('Installer created successfully!');
      return newDbInstaller;
    } catch (error) { 
      console.error("Error adding installer:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, []);

  const updateInstaller = useCallback(async (installer: Installer): Promise<void> => {
    try {
      const updatedDbInstaller = await installerService.updateInstaller(installer);
      setInstallers(prevData => (prevData.map(i => i.id === updatedDbInstaller.id ? updatedDbInstaller : i)));
      toast.success('Installer updated successfully!');
    } catch (error) { 
      console.error("Error updating installer:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, []);

  const deleteInstaller = useCallback(async (installerId: number): Promise<void> => {
    try {
      await installerService.deleteInstaller(installerId);
      setInstallers(prevData => (
        prevData.filter(installer => installer.id !== installerId)
      ));
    } catch (error) {
      console.error("Error deleting installer:", error);
      throw error;
    }
  }, []);


  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'createdAt' | 'jobs'>): Promise<Customer> => {
    try {
      const newDbCustomer = await customerService.addCustomer(customer);
      setCustomers(prevData => ([...prevData, newDbCustomer]));
      toast.success('Customer created successfully!');
      return newDbCustomer;
    } catch (error) {
      console.error("Error adding customer:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const updateCustomer = useCallback(async (customer: Customer): Promise<void> => {
    try {
      const updatedDbCustomer = await customerService.updateCustomer(customer);
      setCustomers(prevData => (
        prevData.map(c => 
          c.id === updatedDbCustomer.id ? updatedDbCustomer : c
        )
      ));
      toast.success('Customer updated successfully!');
    } catch (error) {
      console.error("Error updating customer:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);
  
  const deleteCustomer = useCallback(async (customerId: number): Promise<void> => {
    try {
      await customerService.deleteCustomer(customerId);
      setCustomers(prevData => (
        prevData.filter(customer => customer.id !== customerId)
      ));
    } catch (error) {
      console.error("Error deleting customer:", error);
      throw error;
    }
  }, []);
  
  const addProject = useCallback(async (projectData: Omit<Project, 'id' | 'createdAt'> & { installerId?: number }): Promise<Project> => {
    try {
      const newDbProject = await projectService.addProject(projectData);
      await fetchInitialData(); 
      toast.success('Project created successfully!');
      return newDbProject;
    } catch (error) { 
      console.error("Error adding project:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [fetchInitialData]);

  const updateProject = useCallback(async (projectToUpdate: Partial<Project> & { id: number }) => {
    try {
      const updatedDbProject = await projectService.updateProject(projectToUpdate);
      setProjects(prevData => (
        prevData.map(p => p.id === updatedDbProject.id ? { ...p, ...updatedDbProject } : p)
      ));
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
  }, []);

  const deleteProject = useCallback(async (projectId: number): Promise<void> => {
    try {
      await projectService.deleteProject(projectId);
      setProjects(prevData => (
        prevData.filter(p => p.id !== projectId)
      ));
      setQuotes(prevData => (prevData.filter(q => q.projectId !== projectId)));
      setJobs(prevData => (prevData.filter(j => j.projectId !== projectId)));
      setChangeOrders(prevData => (prevData.filter(co => co.projectId !== projectId)));
      setMaterialOrders(prevData => (prevData.filter(mo => mo.projectId !== projectId)));
      setSampleCheckouts(prevData => (prevData.filter(sc => sc.projectId !== projectId)));
    } catch (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      throw error;
    }
  }, []);

  const addSampleCheckout = useCallback(async (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>): Promise<void> => {
    try {
      const newDbCheckout = await sampleCheckoutService.addSampleCheckout(checkout);
      setSampleCheckouts(prevData => ([...prevData, newDbCheckout]));
      // Note: We no longer update the `isAvailable` flag on the Sample entity itself, 
      // as Inventory 2.0 uses dedicated checkout logic or inventory counts.
      
      toast.success('Sample checked out!');
      await updateProject({ id: checkout.projectId, status: ProjectStatus.SAMPLE_CHECKOUT });

      // --- FIX: Optimistically update the "Active Checkouts" count on the variant ---
      if (checkout.variantId) {
          setProducts(prev => prev.map(p => {
              // Find if this product contains the variant
              if (p.variants.some(v => String(v.id) === String(checkout.variantId))) {
                  return { ...p, variants: p.variants.map(v => String(v.id) === String(checkout.variantId) 
                      ? { ...v, activeCheckouts: (v.activeCheckouts || 0) + 1 } : v) };
              }
              return p;
          }));
      }

    } catch (error) { 
      console.error("Error adding sample checkout:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [updateProject]);

  const updateSampleCheckout = useCallback(async (checkout: SampleCheckout): Promise<void> => {
    try {
      const updatedDbCheckout = await sampleCheckoutService.returnSampleCheckout(checkout);
      const project = projects.find(p => p.id === updatedDbCheckout.projectId);
      setSampleCheckouts(prevData => (
        prevData.map(sc => sc.id === updatedDbCheckout.id ? updatedDbCheckout : sc)
      ));
      // No longer updating isAvailable on Sample entity.
      
      toast.success('Sample returned!');
      if (project && project.status === ProjectStatus.SAMPLE_CHECKOUT) {
        await updateProject({ id: project.id, status: ProjectStatus.AWAITING_DECISION });
      }

      // --- FIX: Optimistically decrement the "Active Checkouts" count ---
      if (updatedDbCheckout.variantId) {
          setProducts(prev => prev.map(p => {
              if (p.variants.some(v => String(v.id) === String(updatedDbCheckout.variantId))) {
                  return { ...p, variants: p.variants.map(v => String(v.id) === String(updatedDbCheckout.variantId) 
                      ? { ...v, activeCheckouts: Math.max(0, (v.activeCheckouts || 0) - 1) } : v) };
              }
              return p;
          }));
      }

    } catch (error) 
      { 
      console.error("Error updating sample checkout:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [projects, updateProject]);

  const extendSampleCheckout = useCallback(async (checkout: SampleCheckout): Promise<void> => {
    try {
        const currentDueDate = new Date(checkout.expectedReturnDate);
        currentDueDate.setDate(currentDueDate.getDate() + 2);
        const newReturnDate = currentDueDate.toISOString();

        const updatedCheckout = await sampleCheckoutService.patchSampleCheckout(checkout.id, {
            expectedReturnDate: newReturnDate
        });

        setSampleCheckouts(prevData => (
            prevData.map(sc =>
                sc.id === updatedCheckout.id ? updatedCheckout : sc
            )
        ));
        toast.success('Checkout extended by 2 days!');
    } catch (error) {
        console.error("Error extending sample checkout:", error);
        toast.error((error as Error).message);
        throw error;
    }
  }, []);

  // --- NEW: Toggle "Selected" status for Design Board ---
  const toggleSampleSelection = useCallback(async (checkout: SampleCheckout): Promise<void> => {
      try {
          const updated = await sampleCheckoutService.patchSampleCheckout(checkout.id, {
              isSelected: !checkout.isSelected
          });
          setSampleCheckouts(prev => prev.map(sc => 
              sc.id === updated.id ? updated : sc
          ));
          toast.success(updated.isSelected ? "Sample selected!" : "Sample deselected.");
      } catch (error) {
          console.error("Error toggling selection:", error);
          toast.error("Failed to update selection.");
      }
  }, []);

  const addQuote = useCallback(async (quote: Omit<Quote, 'id'|'dateSent'>): Promise<void> => {
    try {
      const newDbQuote = await quoteService.addQuote(quote);
      setQuotes(prevData => ([...prevData, newDbQuote]));
      toast.success('Quote added successfully!');
      if (quote.projectId) {
        await updateProject({ id: quote.projectId, status: ProjectStatus.QUOTING });
      }
    } catch (error) { 
      console.error("Error adding quote:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, [updateProject]);

  const updateQuote = useCallback(async (quote: Partial<Quote> & { id: number }): Promise<void> => {
    try {
      const updatedDbQuote = await quoteService.updateQuote(quote);
      setQuotes(prevData => (prevData.map(q => q.id === updatedDbQuote.id ? { ...q, ...updatedDbQuote } : q)));
      toast.success('Quote updated!');
    } catch (error) 
      { console.error("Error updating quote:", error); 
      toast.error((error as Error).message);
      throw error; 
    }
  }, []);
  
  const acceptQuote = useCallback(async (quote: Partial<Quote> & { id: number }): Promise<void> => {
    try {
      const { updatedQuote, updatedProject } = await quoteService.acceptQuote(quote);

      setQuotes(prevData => (
        prevData.map(q => q.id === updatedQuote.id ? { ...q, ...updatedQuote } : q)
      ));
      setProjects(prevData => (
        prevData.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p)
      ));
      
      toast.success('Quote accepted and project status updated!');

    } catch (error) {
      console.error("Error accepting quote:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);
  
  const saveJobDetails = useCallback(async (jobDetails: Partial<Job>): Promise<void> => {
    try {
      const savedDbJob = await jobService.saveJobDetails(jobDetails);
      let updatedProject = null;
      
      // Update local state
      setJobs(prevData => {
        const project = projects.find(p => p.id === savedDbJob.projectId);
        if (project && project.status !== ProjectStatus.SCHEDULED) {
            updatedProject = { ...project, status: ProjectStatus.SCHEDULED };
        }
        const jobExists = prevData.some(j => j.id === savedDbJob.id);
        const newJobs = jobExists
          ? prevData.map(j => (j.id === savedDbJob.id ? savedDbJob : j))
          : [...prevData, savedDbJob];
        
        // Update projects state locally
        setProjects(p => updatedProject ? p.map(pr => pr.id === updatedProject!.id ? updatedProject! : pr) : p);
        
        return newJobs;
      });

      // Update project status on server if needed
      if (updatedProject) {
          await projectService.updateProject({ id: updatedProject.id, status: updatedProject.status });
      }
      toast.success('Job details saved!');
    } catch (error) {
      console.error("Error saving job details:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, [projects]);

  const addChangeOrder = useCallback(async (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'>): Promise<void> => {
    try {
      const newChangeOrder = await changeOrderService.addChangeOrder(changeOrder);
      setChangeOrders(prevData => ([...prevData, newChangeOrder]));
      toast.success('Change order added!');
    } catch (error) {
      console.error("Error adding change order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);
  
  const updateChangeOrder = useCallback(async (changeOrderId: number, changeOrderData: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt' | 'quoteId'>>): Promise<void> => {
    try {
      const updatedChangeOrder = await changeOrderService.updateChangeOrder(changeOrderId, changeOrderData);
      setChangeOrders(prevData => (
        prevData.map(co =>
          co.id === updatedChangeOrder.id ? updatedChangeOrder : co
        )
      ));
      toast.success('Change order updated!');
    } catch (error) {
      console.error("Error updating change order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const deleteChangeOrder = useCallback(async (changeOrderId: number): Promise<void> => {
    try {
        await changeOrderService.deleteChangeOrder(changeOrderId);
        setChangeOrders(prevData => (
            prevData.filter(co => co.id !== changeOrderId)
        ));
    } catch (error) {
        console.error("Error deleting change order:", error);
        throw error;
    }
  }, []);

  const addMaterialOrder = useCallback(async (orderData: any): Promise<void> => {
    try {
        const newOrder = await materialOrderService.addMaterialOrder(orderData);
        setMaterialOrders(prevData => ([...prevData, newOrder]));
        toast.success('Material order created!');
    } catch (error) {
        console.error("Error adding material order:", error);
        toast.error((error as Error).message);
        throw error;
    }
  }, []);
  
  const updateMaterialOrder = useCallback(async (orderId: number, orderData: any): Promise<void> => {
    try {
      const updatedOrder = await materialOrderService.updateMaterialOrder(orderId, orderData);
      setMaterialOrders(prevData => (
        prevData.map(order => order.id === updatedOrder.id ? updatedOrder : order)
      ));
      toast.success('Material order updated!');
    } catch (error) {
      console.error("Error updating material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const deleteMaterialOrder = useCallback(async (orderId: number): Promise<void> => {
    try {
      await materialOrderService.deleteMaterialOrder(orderId);
      setMaterialOrders(prevData => (
        prevData.filter(order => order.id !== orderId)
      ));
      toast.success('Material order deleted!');
    } catch (error) {
      console.error("Error deleting material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const receiveMaterialOrder = useCallback(async (orderId: number, data: { dateReceived: string; notes: string; sendEmailNotification: boolean }): Promise<void> => {
    try {
      const updatedOrder = await materialOrderService.receiveMaterialOrder(orderId, data);
      setMaterialOrders(prevData => (
        prevData.map(order => order.id === updatedOrder.id ? updatedOrder : order)
      ));
      toast.success('Order received!');
    } catch (error) {
      console.error("Error receiving material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const reportMaterialOrderDamage = useCallback(async (orderId: number, data: { items: any[]; replacementEta: string; notes: string; sendEmailNotification: boolean }): Promise<void> => {
    try {
      const { originalOrder, replacementOrder } = await materialOrderService.reportMaterialOrderDamage(orderId, data);
      setMaterialOrders(prevData => ([
          ...prevData.map(order => order.id === originalOrder.id ? originalOrder : order),
          replacementOrder
      ]));
      toast.success('Damage reported & replacement ordered!');
    } catch (error) {
      console.error("Error reporting damage:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const updateJob = useCallback((updatedJob: Job) => { setJobs(prevData => (prevData.map(j => j.id === updatedJob.id ? updatedJob : j))); }, []);

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

    isLoading,
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
    refreshNotifications: async () => setUnreadCount(await notificationService.getUnreadCount()) // Helper
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