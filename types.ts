export const PROJECT_TYPES = [
  'Flooring',
  'Tile',
  'Kitchen Remodel',
  'Bathroom Remodel',
  'New Construction',
  'Other'
] as const;

export type ProjectType = typeof PROJECT_TYPES[number];

export const INSTALLATION_TYPES = [
  'Managed Installation',
  'Materials Only Sale',
  'Unmanaged Installer'
] as const;

export type InstallationType = typeof INSTALLATION_TYPES[number];

export const UNITS = [
  'SF',
  'SY',
  'LF',
  'Carton',
  'Sheet',
  'Roll'
] as const;

export type Unit = typeof UNITS[number];

export enum ProjectStatus {
  NEW = "New",
  SAMPLE_CHECKOUT = "Sample Checkout",
  AWAITING_DECISION = "Awaiting Decision",
  QUOTING = "Quoting",
  ACCEPTED = "Accepted",
  SCHEDULED = "Scheduled",
  COMPLETED = "Completed",
  CANCELLED = "Cancelled",
  CLOSED = "Closed",
}

export enum QuoteStatus {
  SENT = "Sent",
  ACCEPTED = "Accepted",
  REJECTED = "Rejected",
}

export interface Vendor {
  id: number;
  name: string;
  isManufacturer: boolean;
  isSupplier: boolean;
  address?: string | null;
  phone?: string | null;
  orderingEmail?: string | null;
  claimsEmail?: string | null;
  repName?: string | null;
  repPhone?: string | null;
  repEmail?: string | null;
  shippingMethod?: string | null;
  dedicatedShippingDay?: number | null; // 0=Sun, 6=Sat
  notes?: string | null;
}

export interface Customer {
  id: number;
  fullName: string;
  address: string;
  phoneNumber: string;
  email: string;
  createdAt: string;
  jobs: {
    projectId: number;
    projectName: string;
    installerName: string | null;
    scheduledStartDate: string;
    scheduledEndDate: string;
  }[];
}

export interface Sample {
  id: number;
  manufacturerId: number | null;
  supplierId: number | null;
  manufacturerName?: string | null; // Joined from vendors table
  supplierName?: string | null; // Joined from vendors table
  styleColor: string;
  sku: string | null;
  type: string;
  isAvailable: boolean;
  imageUrl?: string;
  productUrl?: string | null;
  checkoutProjectId?: number | null;
  checkoutProjectName?: string | null;
  checkoutCustomerName?: string | null;
  checkoutId?: number | null;
}

export interface Project {
  id: number;
  customerId: number;
  projectName: string;
  projectType: ProjectType;
  status: ProjectStatus;
  finalChoice: string | null;
  createdAt: string;
}

export interface SampleCheckout {
  id: number;
  projectId: number;
  sampleId: number;
  checkoutDate: string;
  expectedReturnDate: string;
  actualReturnDate: string | null;
}

export interface Installer {
  id: number;
  installerName: string;
  contactEmail: string;
  contactPhone: string;
  color?: string | null;
  jobs: {
    projectId: number;
    projectName: string;
    customerName: string;
    scheduledStartDate: string;
    scheduledEndDate: string;
  }[];
}

export interface Quote {
  id: number;
  projectId: number;
  installerId?: number | null;
  installationType: InstallationType;
  quoteDetails?: string | null;
  materialsAmount?: number | null;
  laborAmount?: number | null;
  installerMarkup?: number | null;
  laborDepositPercentage?: number | null;
  dateSent: string;
  status: QuoteStatus;
}

export interface Job {
  id: number;
  projectId: number;
  poNumber?: string | null;
  depositAmount?: number | null;
  depositReceived: boolean;
  contractsReceived: boolean;
  finalPaymentReceived: boolean;
  paperworkSignedUrl?: string | null;
  scheduledStartDate?: string | null;
  scheduledEndDate?: string | null;
  notes?: string | null;
}

export interface ChangeOrder {
  id: number;
  projectId: number;
  description: string;
  amount: number;
  type: 'Materials' | 'Labor';
  createdAt: string;
}

export interface OrderLineItem {
  id: number;
  quantity: number;
  unit: Unit | null;
  totalCost: number | null;
  sampleId: number;
  styleColor: string;
  manufacturerName: string | null;
}

export interface MaterialOrder {
  id: number;
  projectId: number;
  supplierId: number | null;
  supplierName?: string | null; // Joined from vendors table
  orderDate: string;
  etaDate: string | null;
  status: string;
  lineItems: OrderLineItem[];
}

export interface AppData {
  customers: Customer[];
  projects: Project[];
  samples: Sample[];
  sampleCheckouts: SampleCheckout[];
  installers: Installer[];
  quotes: Quote[];
  jobs: Job[];
  changeOrders: ChangeOrder[];
  materialOrders: MaterialOrder[];
  vendors: Vendor[];
}

export interface ActivityLogEntry {
  id: number;
  userId: string;
  actionType: 'CREATE' | 'UPDATE' | 'DELETE' | 'ACCEPT' | string;
  targetEntity: 'CUSTOMER' | 'JOB' | 'PROJECT' | 'QUOTE' | 'INSTALLER' | 'VENDOR' | 'SAMPLE' | string;
  targetId: string;
  details: any;
  createdAt: string;
  userEmail: string;
}

// =================================================================
//  RBAC MODIFICATIONS
// =================================================================

export interface User {
  userId: string;
  email: string;
  roles: string[]; // <-- ADDED: To support roles on the user list page
}

export interface CurrentUser {
  userId: string;
  email: string;
  roles: string[]; // <-- ADDED: The current user's roles for UI checks
}

// =================================================================

export interface DataContextType extends AppData {
  isLoading: boolean;
  currentUser: CurrentUser | null;
  customerHistory: ActivityLogEntry[];
  fetchCustomerHistory: (customerId: number) => Promise<void>;
  projectHistory: ActivityLogEntry[];
  fetchProjectHistory: (projectId: number) => Promise<void>;
  quotesHistory: ActivityLogEntry[];
  fetchQuotesHistory: (projectId: number) => Promise<void>;
  installerHistory: ActivityLogEntry[];
  fetchInstallerHistory: (installerId: number) => Promise<void>;
  vendorHistory: ActivityLogEntry[];
  fetchVendorHistory: (vendorId: number) => Promise<void>;
  sampleHistory: ActivityLogEntry[];
  fetchSampleHistory: (sampleId: number) => Promise<void>;
  // vvvvvvvvvvvv ADDED FOR COMPLETENESS vvvvvvvvvvvv
  materialOrderHistory: ActivityLogEntry[];
  fetchMaterialOrderHistory: (orderId: number) => Promise<void>;
  // ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
  fetchSamples: () => Promise<void>;
  addInstaller: (installer: Omit<Installer, 'id' | 'jobs'>) => Promise<Installer>;
  updateInstaller: (installer: Installer) => Promise<void>;
  deleteInstaller: (installerId: number) => Promise<void>;
  addSample: (sampleData: any) => Promise<Sample>;
  updateSample: (sampleId: number, sampleData: any) => Promise<void>;
  deleteSample: (sampleId: number) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'jobs'>) => void;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (customerId: number) => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'createdAt'> & { installerId?: number }) => Promise<Project>;
  updateProject: (project: Partial<Project> & { id: number }) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  addSampleCheckout: (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>) => Promise<void>;
  updateSampleCheckout: (checkout: SampleCheckout) => Promise<void>;
  extendSampleCheckout: (checkout: SampleCheckout) => Promise<void>;
  addQuote: (quote: Omit<Quote, 'id'|'dateSent'>) => Promise<void>;
  updateQuote: (quote: Partial<Quote> & {id: number}) => Promise<void>;
  acceptQuote: (quote: Partial<Quote> & { id: number }) => Promise<void>;
  saveJobDetails: (jobDetails: Omit<Job, 'id' | 'paperworkSignedUrl'>) => Promise<void>;
  updateJob: (job: Job) => void;
  addChangeOrder: (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'>) => Promise<void>;
  updateChangeOrder: (changeOrderId: number, changeOrderData: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt'>>) => Promise<void>;
  addMaterialOrder: (orderData: any) => Promise<void>;
  updateMaterialOrder: (orderId: number, orderData: any) => Promise<void>;
  deleteMaterialOrder: (orderId: number) => Promise<void>;
  addVendor: (vendor: Omit<Vendor, 'id'>) => Promise<void>;
  updateVendor: (vendor: Vendor) => Promise<void>;
  deleteVendor: (vendorId: number) => Promise<void>;
}