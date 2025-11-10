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
  manufacturer: string | null;
  styleColor: string;
  sku: string | null;
  type: string;
  isAvailable: boolean;
  imageUrl?: string;
  productUrl?: string | null;
  checkoutProjectId?: number | null;
  checkoutProjectName?: string | null;
  checkoutCustomerName?: string | null;
  // --- THIS IS THE NEW PROPERTY ---
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
  unitCost: number | null;
  sampleId: number;
  styleColor: string;
  manufacturer: string | null;
}

export interface MaterialOrder {
  id: number;
  projectId: number;
  supplier: string | null;
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
}

export interface DataContextType extends AppData {
  isLoading: boolean;
  fetchSamples: () => Promise<void>;
  addInstaller: (installer: Omit<Installer, 'id' | 'jobs'>) => Promise<Installer>;
  updateInstaller: (installer: Installer) => Promise<void>;
  deleteInstaller: (installerId: number) => Promise<void>;
  addSample: (sample: Omit<Sample, 'id' | 'isAvailable' | 'imageUrl'>) => Promise<Sample>;
  updateSample: (sampleId: number, sampleData: Partial<Omit<Sample, 'id' | 'isAvailable' | 'imageUrl'>>) => Promise<void>;
  deleteSample: (sampleId: number) => Promise<void>;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'jobs'>) => void;
  updateCustomer: (customer: Customer) => Promise<void>;
  deleteCustomer: (customerId: number) => Promise<void>;
  addProject: (project: Omit<Project, 'id' | 'createdAt'> & { installerId?: number }) => Promise<Project>;
  updateProject: (project: Partial<Project> & { id: number }) => Promise<void>;
  deleteProject: (projectId: number) => Promise<void>;
  addSampleCheckout: (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>) => Promise<void>;
  updateSampleCheckout: (checkout: SampleCheckout) => Promise<void>;
  // --- We've already added this in a previous step, so it should be present. ---
  extendSampleCheckout: (checkout: SampleCheckout) => Promise<void>;
  addQuote: (quote: Omit<Quote, 'id'|'dateSent'>) => Promise<void>;
  updateQuote: (quote: Partial<Quote> & {id: number}) => Promise<void>;
  saveJobDetails: (jobDetails: Omit<Job, 'id' | 'paperworkSignedUrl'>) => Promise<void>;
  updateJob: (job: Job) => void;
  addChangeOrder: (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'>) => Promise<void>;
  updateChangeOrder: (changeOrderId: number, changeOrderData: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt'>>) => Promise<void>;
  addMaterialOrder: (orderData: any) => Promise<void>;
  updateMaterialOrder: (orderId: number, orderData: any) => Promise<void>;
}