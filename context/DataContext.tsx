import React, { createContext, useState, useContext, ReactNode, useEffect, useCallback } from 'react';
// --- CORRECTED: Import UserPreferences and remove UiPreferences ---
import { AppData, Customer, DataContextType, Installer, Job, Project, ProjectStatus, Quote, Sample, SampleCheckout, ChangeOrder, MaterialOrder, Vendor, CurrentUser, ActivityLogEntry, UserPreferences, User, SystemBranding } from '../types';
import { toast } from 'react-hot-toast';

import { useSessionContext } from 'supertokens-auth-react/recipe/session';

import * as customerService from '../services/customerService';
import * as sampleService from '../services/sampleService';
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
        const [customersData, projectsData, samplesData, sampleCheckoutsData, installersData, quotesData, jobsData, changeOrdersData, materialOrdersData, vendorsData] = await Promise.all([
            customerService.getCustomers(),
            projectService.getProjects(),
            sampleService.getSamples(),
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
            samples: Array.isArray(samplesData) ? samplesData : [],
            sampleCheckouts: Array.isArray(sampleCheckoutsData) ? sampleCheckoutsData : [],
            installers: Array.isArray(installersData) ? installersData : [],
            quotes: Array.isArray(quotesData) ? quotesData : [],
            jobs: Array.isArray(jobsData) ? jobsData : [],
            changeOrders: Array.isArray(changeOrdersData) ? changeOrdersData : [],
            materialOrders: Array.isArray(materialOrdersData) ? materialOrdersData : [],
            vendors: Array.isArray(vendorsData) ? vendorsData : [],
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
  
  
  const fetchCustomerHistory = useCallback(async (customerId: number) => {
    try {
      const historyData = await customerService.getCustomerHistory(customerId);
      setCustomerHistory(historyData);
    } catch (error) {
      console.error("Error fetching customer history:", error);
      toast.error("Could not load customer history.");
      setCustomerHistory([]); 
    }
  }, []);

  const fetchProjectHistory = useCallback(async (projectId: number) => {
    try {
      const historyData = await projectService.getProjectHistory(projectId);
      setProjectHistory(historyData);
    } catch (error) {
      console.error("Error fetching project history:", error);
      toast.error("Could not load project history.");
      setProjectHistory([]);
    }
  }, []);
  
  const fetchQuotesHistory = useCallback(async (projectId: number) => {
    try {
      const historyData = await quoteService.getQuotesHistory(projectId);
      setQuotesHistory(historyData);
    } catch (error) {
      console.error("Error fetching quote history:", error);
      toast.error("Could not load quote history.");
      setQuotesHistory([]);
    }
  }, []);
  
  const fetchInstallerHistory = useCallback(async (installerId: number) => {
    try {
      const historyData = await installerService.getInstallerHistory(installerId);
      setInstallerHistory(historyData);
    } catch (error) {
      console.error("Error fetching installer history:", error);
      toast.error("Could not load installer history.");
      setInstallerHistory([]);
    }
  }, []);

  const fetchVendorHistory = useCallback(async (vendorId: number) => {
    try {
      const historyData = await vendorService.getVendorHistory(vendorId);
      setVendorHistory(historyData);
    } catch (error) {
      console.error("Error fetching vendor history:", error);
      toast.error("Could not load vendor history.");
      setVendorHistory([]);
    }
  }, []);

  const fetchSampleHistory = useCallback(async (sampleId: number) => {
    try {
      const historyData = await sampleService.getSampleHistory(sampleId);
      setSampleHistory(historyData);
    } catch (error) {
      console.error("Error fetching sample history:", error);
      toast.error("Could not load sample history.");
      setSampleHistory([]);
    }
  }, []);
  
  const fetchMaterialOrderHistory = useCallback(async (orderId: number) => {
    try {
      const historyData = await materialOrderService.getMaterialOrderHistory(orderId);
      setMaterialOrderHistory(historyData);
    } catch (error) {
      console.error("Error fetching material order history:", error);
      toast.error("Could not load material order history.");
      setMaterialOrderHistory([]);
    }
  }, []);

  const addVendor = useCallback(async (vendor: Omit<Vendor, 'id'>): Promise<void> => {
      const newVendor = await vendorService.addVendor(vendor);
      setData(prevData => ({ ...prevData, vendors: [...prevData.vendors, newVendor] }));
  }, []);
  
  const updateVendor = useCallback(async (vendor: Vendor): Promise<void> => {
      const updatedVendor = await vendorService.updateVendor(vendor.id, vendor);
      setData(prevData => ({
          ...prevData,
          vendors: prevData.vendors.map(v => v.id === updatedVendor.id ? updatedVendor : v),
      }));
  }, []);

  const deleteVendor = useCallback(async (vendorId: number): Promise<void> => {
      await vendorService.deleteVendor(vendorId);
      setData(prevData => ({
          ...prevData,
          vendors: prevData.vendors.filter(v => v.id !== vendorId),
      }));
  }, []);

  const fetchSamples = useCallback(async () => {
    try {
      const samplesData = await sampleService.getSamples();
      setData(prevData => ({ ...prevData, samples: Array.isArray(samplesData) ? samplesData : prevData.samples }));
    } catch (error) {
      console.error("Error fetching samples:", error);
      toast.error('Could not refresh samples.');
    }
  }, []);

  const addInstaller = useCallback(async (installer: Omit<Installer, 'id' | 'jobs'>): Promise<Installer> => {
    try {
      const newDbInstaller = await installerService.addInstaller(installer);
      setData(prevData => ({ ...prevData, installers: [...prevData.installers, newDbInstaller] }));
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
      setData(prevData => ({ ...prevData, installers: prevData.installers.map(i => i.id === updatedDbInstaller.id ? updatedDbInstaller : i) }));
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
      setData(prevData => ({
        ...prevData,
        installers: prevData.installers.filter(installer => installer.id !== installerId),
      }));
    } catch (error) {
      console.error("Error deleting installer:", error);
      throw error;
    }
  }, []);

  const addSample = useCallback(async (sample: any): Promise<Sample> => {
    try {
      const newDbSample = await sampleService.addSample(sample);
      setData(prevData => ({
        ...prevData,
        samples: [...prevData.samples, newDbSample]
      }));
      return newDbSample;
    } catch (error) { 
      console.error("Error adding sample:", error); 
      toast.error((error as Error).message || 'Failed to add sample.'); 
      throw error; 
    }
  }, []);
  
  const updateSample = useCallback(async (sampleId: number, sampleData: any): Promise<void> => {
    try {
      const updatedDbSample = await sampleService.updateSample(sampleId, sampleData);
      setData(prevData => ({
        ...prevData,
        samples: prevData.samples.map(s => 
          s.id === updatedDbSample.id ? updatedDbSample : s
        )
      }));
      toast.success('Sample details updated!');
    } catch (error) { 
      console.error("Error updating sample:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, []);

  const deleteSample = useCallback(async (sampleId: number): Promise<void> => {
    try {
      await sampleService.deleteSample(sampleId);
      setData(prevData => ({
        ...prevData,
        samples: prevData.samples.filter(sample => sample.id !== sampleId),
      }));
    } catch (error) {
      console.error("Error deleting sample:", error);
      throw error;
    }
  }, []);

  const addCustomer = useCallback(async (customer: Omit<Customer, 'id' | 'createdAt' | 'jobs'>): Promise<Customer> => {
    try {
      const newDbCustomer = await customerService.addCustomer(customer);
      setData(prevData => ({ ...prevData, customers: [...prevData.customers, newDbCustomer] }));
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
      setData(prevData => ({
        ...prevData,
        customers: prevData.customers.map(c => 
          c.id === updatedDbCustomer.id ? updatedDbCustomer : c
        )
      }));
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
      setData(prevData => ({
        ...prevData,
        customers: prevData.customers.filter(customer => customer.id !== customerId),
      }));
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
      setData(prevData => ({ 
        ...prevData, 
        projects: prevData.projects.map(p => p.id === updatedDbProject.id ? { ...p, ...updatedDbProject } : p) 
      }));
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
      setData(prevData => ({
        ...prevData,
        projects: prevData.projects.filter(p => p.id !== projectId),
        quotes: prevData.quotes.filter(q => q.projectId !== projectId),
        jobs: prevData.jobs.filter(j => j.projectId !== projectId),
        changeOrders: prevData.changeOrders.filter(co => co.projectId !== projectId),
        materialOrders: prevData.materialOrders.filter(mo => mo.projectId !== projectId),
        sampleCheckouts: prevData.sampleCheckouts.filter(sc => sc.projectId !== projectId),
      }));
    } catch (error) {
      console.error(`Error deleting project ${projectId}:`, error);
      throw error;
    }
  }, []);

  const addSampleCheckout = useCallback(async (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>): Promise<void> => {
    try {
      const newDbCheckout = await sampleCheckoutService.addSampleCheckout(checkout);
      setData(prevData => ({ 
        ...prevData, 
        sampleCheckouts: [...prevData.sampleCheckouts, newDbCheckout], 
        samples: prevData.samples.map(s => s.id === newDbCheckout.sampleId ? { ...s, isAvailable: false } : s) 
      }));
      toast.success('Sample checked out!');
      await updateProject({ id: checkout.projectId, status: ProjectStatus.SAMPLE_CHECKOUT });
    } catch (error) { 
      console.error("Error adding sample checkout:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [updateProject]);

  const updateSampleCheckout = useCallback(async (checkout: SampleCheckout): Promise<void> => {
    try {
      const updatedDbCheckout = await sampleCheckoutService.returnSampleCheckout(checkout);
      const project = data.projects.find(p => p.id === updatedDbCheckout.projectId);
      setData(prevData => ({ 
        ...prevData, 
        sampleCheckouts: prevData.sampleCheckouts.map(sc => sc.id === updatedDbCheckout.id ? updatedDbCheckout : sc), 
        samples: prevData.samples.map(s => s.id === updatedDbCheckout.sampleId ? { ...s, isAvailable: true } : s) 
      }));
      toast.success('Sample returned!');
      if (project && project.status === ProjectStatus.SAMPLE_CHECKOUT) {
        await updateProject({ id: project.id, status: ProjectStatus.AWAITING_DECISION });
      }
    } catch (error) 
      { 
      console.error("Error updating sample checkout:", error); 
      toast.error((error as Error).message); 
      throw error; 
    }
  }, [data.projects, updateProject]);

  const extendSampleCheckout = useCallback(async (checkout: SampleCheckout): Promise<void> => {
    try {
        const currentDueDate = new Date(checkout.expectedReturnDate);
        currentDueDate.setDate(currentDueDate.getDate() + 2);
        const newReturnDate = currentDueDate.toISOString();

        const updatedCheckout = await sampleCheckoutService.patchSampleCheckout(checkout.id, {
            expectedReturnDate: newReturnDate
        });

        setData(prevData => ({
            ...prevData,
            sampleCheckouts: prevData.sampleCheckouts.map(sc =>
                sc.id === updatedCheckout.id ? updatedCheckout : sc
            ),
        }));
        toast.success('Checkout extended by 2 days!');
    } catch (error) {
        console.error("Error extending sample checkout:", error);
        toast.error((error as Error).message);
        throw error;
    }
  }, []);

  const addQuote = useCallback(async (quote: Omit<Quote, 'id'|'dateSent'>): Promise<void> => {
    try {
      const newDbQuote = await quoteService.addQuote(quote);
      setData(prevData => ({ ...prevData, quotes: [...prevData.quotes, newDbQuote] }));
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
      setData(prevData => ({ ...prevData, quotes: prevData.quotes.map(q => q.id === updatedDbQuote.id ? { ...q, ...updatedDbQuote } : q) }));
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

      setData(prevData => ({
        ...prevData,
        quotes: prevData.quotes.map(q => q.id === updatedQuote.id ? { ...q, ...updatedQuote } : q),
        projects: prevData.projects.map(p => p.id === updatedProject.id ? { ...p, ...updatedProject } : p)
      }));
      
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
      setData(prevData => {
        const project = prevData.projects.find(p => p.id === savedDbJob.projectId);
        if (project && project.status !== ProjectStatus.SCHEDULED) {
            updatedProject = { ...project, status: ProjectStatus.SCHEDULED };
        }
        const jobExists = prevData.jobs.some(j => j.id === savedDbJob.id);
        const newJobs = jobExists
          ? prevData.jobs.map(j => (j.id === savedDbJob.id ? savedDbJob : j))
          : [...prevData.jobs, savedDbJob];
        const newProjects = updatedProject
            ? prevData.projects.map(p => p.id === updatedProject!.id ? updatedProject! : p)
            : prevData.projects;
        return { ...prevData, jobs: newJobs, projects: newProjects };
      });
      if (updatedProject) {
          await projectService.updateProject({ id: updatedProject.id, status: updatedProject.status });
      }
      toast.success('Job details saved!');
    } catch (error) {
      console.error("Error saving job details:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const addChangeOrder = useCallback(async (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'>): Promise<void> => {
    try {
      const newChangeOrder = await changeOrderService.addChangeOrder(changeOrder);
      setData(prevData => ({ ...prevData, changeOrders: [...prevData.changeOrders, newChangeOrder] }));
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
      setData(prevData => ({
        ...prevData,
        changeOrders: prevData.changeOrders.map(co =>
          co.id === updatedChangeOrder.id ? updatedChangeOrder : co
        ),
      }));
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
        setData(prevData => ({
            ...prevData,
            changeOrders: prevData.changeOrders.filter(co => co.id !== changeOrderId),
        }));
    } catch (error) {
        console.error("Error deleting change order:", error);
        throw error;
    }
  }, []);

  const addMaterialOrder = useCallback(async (orderData: any): Promise<void> => {
    try {
        const newOrder = await materialOrderService.addMaterialOrder(orderData);
        setData(prevData => ({
            ...prevData,
            materialOrders: [...prevData.materialOrders, newOrder],
        }));
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
      setData(prevData => ({
        ...prevData,
        materialOrders: prevData.materialOrders.map(order => order.id === updatedOrder.id ? updatedOrder : order),
      }));
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
      setData(prevData => ({
        ...prevData,
        materialOrders: prevData.materialOrders.filter(order => order.id !== orderId),
      }));
      toast.success('Material order deleted!');
    } catch (error) {
      console.error("Error deleting material order:", error);
      toast.error((error as Error).message);
      throw error;
    }
  }, []);

  const updateJob = useCallback((updatedJob: Job) => { setData(prevData => ({ ...prevData, jobs: prevData.jobs.map(j => j.id === updatedJob.id ? updatedJob : j) })); }, []);

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
    ...data,
    isLoading,
    currentUser,
    systemBranding,
    refreshBranding,
    users,

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
    fetchSampleHistory,
    materialOrderHistory,
    fetchMaterialOrderHistory,
    addInstaller, 
    updateInstaller,
    deleteInstaller,
    addSample,
    updateSample,
    deleteSample,
    fetchSamples,
    addCustomer, 
    updateCustomer,
    deleteCustomer,
    addProject, 
    updateProject,
    deleteProject,
    addSampleCheckout, 
    updateSampleCheckout,
    extendSampleCheckout,
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
    addVendor,
    updateVendor,
    deleteVendor,
    updateJob
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