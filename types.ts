// src/types.ts

// Since ReactGridLayout.Layouts is not defined in this file,
// we assume it is correctly imported/defined elsewhere or we use 'any'.
// For clean compilation, we define a placeholder type if it's external:
type ReactGridLayout_Layouts = any; 

export interface MediaAsset {
  id: string;
  filePath: string;
  thumbnailPath?: string | null;
  fileType: string;
  category: 'products' | 'avatars' | 'branding' | 'jobs' | 'misc';
  uploadedBy?: string | null;
  createdAt: string;
  usageCount: number;
}

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
  'Roll',
  'Piece',
  'Box',
  'Each'
] as const;

export type Unit = typeof UNITS[number];

// --- ADDED: New constants for the sample refactor ---
export const PRODUCT_TYPES = [
  'Tile',
  'LVP',
  'LVT',
  'Laminate',
  'Sheet Product',
  'Carpet',
  'Quartz',
  'Dekton'
] as const;

export type ProductType = typeof PRODUCT_TYPES[number];

export const SAMPLE_TYPES = [
  'Board',
  'Hand Sample', 
  'Strap Set',
  'Folder'
] as const;

export type SampleType = typeof SAMPLE_TYPES[number];

export const SAMPLE_FORMATS = [
  'Loose',
  'Board'
] as const;

export type SampleFormat = typeof SAMPLE_FORMATS[number];
// --- END ADDED ---

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

// --- MODIFIED: Vendor interface updated for new data model ---
export interface Vendor {
  id: number;
  name: string;
  vendorType: 'Manufacturer' | 'Supplier' | 'Both' | null; // REPLACES isManufacturer/isSupplier
  defaultSupplierId?: number | null;          // ADDED: Self-referencing FK
  defaultProductType: ProductType | string | null;            // ADDED for smart defaults
  websiteUrl?: string | null;
  portalUrl?: string | null;
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
  sampleCount?: number; // ADDED for future dashboard UI
  defaultMarkup?: number | null;
  pricingMethod?: 'Markup' | 'Margin' | null;
}

export interface Customer {
  id: number;
  fullName: string;
  address?: string | null;
  phoneNumber?: string | null;
  email?: string | null;
  createdAt: string;
  jobs: {
    projectId: number;
    projectName: string;
    installerName: string | null;
    scheduledStartDate: string;
    scheduledEndDate: string;
  }[];
}

export interface SampleSizeVariant {
  value: string; // The size string (e.g., "12x24")
  unitCost?: number | null;
  cartonSize?: number | null;
  uom?: Unit | null;
}

// --- NEW: Product Line Architecture (Inventory 2.0) ---

export interface ProductVariant {
  id: string; // UUID
  productId: string;
  name: string; // e.g. "Gunstock" or "Matte White"
  
  // Attributes
  size?: string | null;
  color?: string | null;
  finish?: string | null;
  style?: string | null;
  wearLayer?: string | null; // NEW: For LVP (e.g. "20mil")
  thickness?: string | null; // NEW: For LVP/Tile (e.g. "5mm" or "8mm")

  // Financials & Logistics
  sku?: string | null;
  unitCost?: number | null;
  retailPrice?: number | null;
  pricingUnit?: Unit | null; // NEW: The unit the price is based on (e.g., /SF)
  uom?: Unit | null; // The physical inventory unit (e.g., Carton)
  cartonSize?: number | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null; // NEW: Optimized image path
  activeCheckouts?: number; // New field from SQL aggregation
  isMaster?: boolean; // New field for "Line Board" logic
  hasSample?: boolean; // New field for Physical Inventory tracking
}

export interface Product {
  id: string; // UUID
  manufacturerId: number | null;
  supplierId: number | null; // Preferred supplier
  name: string; // e.g. "Forever Oak Collection"
  productType: ProductType;
  description?: string | null;
  productLineUrl?: string | null;
  defaultImageUrl?: string | null;
  defaultThumbnailUrl?: string | null; // NEW: Optimized image path
  isDiscontinued: boolean;
  
  // Joined Fields
  manufacturerName?: string | null;
  variants: ProductVariant[];
}

// --- MODIFIED: Sample interface completely overhauled ---
/** @deprecated - Will be replaced by Product & ProductVariant */
export interface Sample {
  id: number;
  manufacturerId: number | null;
  supplierId: number | null;
  productType: ProductType | string; // ADDED, REQUIRED
  style: string;                     // ADDED, REQUIRED
  line?: string | null;              // ADDED
  sizes?: (string | SampleSizeVariant)[]; // MODIFIED: Supports legacy strings + new objects
  finish?: string | null;            // ADDED
  color?: string | null;             // ADDED
  sampleFormat?: SampleFormat | null;// ADDED for Tile
  boardColors?: string | null;       // ADDED for Tile Boards
  
  // --- Pricing & Packaging Fields ---
  unitCost?: number | null;
  uom?: Unit | null;
  cartonSize?: number | null;
  
  sku: string | null;
  isAvailable: boolean;
  isDiscontinued: boolean; // ADDED
  imageUrl?: string;
  productUrl?: string | null;
  
  // REMOVED: Old flat fields
  // styleColor: string;
  // type: string;

  // Joined/derived fields for display purposes
  manufacturerName?: string | null; 
  supplierName?: string | null;
  checkoutProjectId?: number | null;
  checkoutProjectName?: string | null;
  checkoutCustomerName?: string | null;
  checkoutId?: number | null;
  checkoutExpectedReturnDate?: string | null;
}

export interface Project {
  id: number;
  customerId: number;
  clientInstallerId?: number | null;
  projectName: string;
  projectType: ProjectType;
  status: ProjectStatus;
  finalChoice: string | null;
  managerId?: string | null;
  createdAt: string;
}

export interface SampleCheckout {
  id: number;
  projectId: number;
  sampleId: number;
  variantId?: string | null; 
  sampleType?: SampleType;
  quantity?: number;
  checkoutDate: string;
  expectedReturnDate: string;
  actualReturnDate: string | null;
  isSelected?: boolean;
}

export interface Installer {
  id: number;
  installerName: string;
  contactEmail: string;
  contactPhone: string;
  color?: string | null;
  activeSampleCount?: number;
  type?: 'Managed' | 'Unmanaged';
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
  poNumber?: string | null;
  installationType: InstallationType;
  quoteDetails?: string | null;
  materialsAmount?: number | null;
  laborAmount?: number | null;
  installerMarkup?: number | null;
  laborDepositPercentage?: number | null;
  dateSent: string;
  status: QuoteStatus;
}

export interface JobAppointment {
  id: number;
  jobId: number;
  quoteId?: number | null;
  installerId: number | null;
  appointmentName: string;
  startDate: string;
  endDate: string;
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
  isOnHold: boolean;
  notes?: string | null;
  isMaterialOnly?: boolean;
  appointments: JobAppointment[];
}

export interface JobNote {
  id: number;
  jobId: number;
  userId: string;
  content: string;
  authorName: string;
  authorAvatar?: string | null;
  authorEmail?: string; // NEW
  createdAt: string;
  isPinned: boolean;
}

export interface ChangeOrder {
  id: number;
  projectId: number;
  quoteId?: number | null;
  description: string;
  amount: number;
  type: 'Materials' | 'Labor';
  createdAt: string;
}

// --- MODIFIED: OrderLineItem updated to reflect new sample structure ---
export interface OrderLineItem {
  id: number;
  quantity: number;
  unit: Unit | null;
  totalCost: number | null;
  sampleId: number;
  // Denormalized fields for display convenience
  style: string;
  color: string | null;
  manufacturerName: string | null;
  unitCostSnapshot?: number | null;
  markupSnapshot?: number | null;
  unitPriceSold?: number | null;
}

export interface MaterialOrder {
  id: number;
  projectId: number;
  supplierId: number | null;
  supplierName?: string | null; // Joined from vendors table
  orderDate: string;
  etaDate: string | null;
  purchaserType: 'Customer' | 'Installer';
  status: string;
  dateReceived?: string; // New
  notes?: string; // New
  parentOrderId?: number; // New
  // Expanded fields for Receiving Workflow
  projectName?: string;
  customerName?: string;
  customerEmail?: string;
  installerName?: string;
  installerEmail?: string;
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
  users: User[]; // ADDED from DataContext
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

export interface User {
  id: string; // Corrected from userId to id
  userId: string;
  email: string;
  roles: string[];
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  color?: string | null; // Added to support calendar color in user lists
}

export interface CurrentUser {
  userId: string;
  email: string;
  roles: string[];
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  preferences?: UserPreferences; // ADDED: Current user will now hold their own preferences
}

export interface Attendee {
  attendeeId: string;
  attendeeType: 'user' | 'installer';
}

export interface Event {
  id: number;
  title: string;
  notes: string | null;
  startTime: string; // ISO string format
  endTime: string;   // ISO string format
  isAllDay: boolean;
  jobId: number | null;
  createdByUserId: string;
  createdAt: string; // ISO string format
  attendees?: Attendee[];
}

// --- NEW: Interface for Dashboard Email Settings ---
export interface DashboardEmailSettings {
  isEnabled: boolean;
  frequency: 'daily' | 'on_event';
  includeSamplesDue: boolean;
  includeUpcomingJobs: boolean;
  upcomingJobsDays: number;
  includePendingQuotes: boolean;
  pendingQuotesDays: number;
}

export interface PricingSettings {
  retailMarkup: number;
  contractorMarkup: number;
  calculationMethod: 'Markup' | 'Margin';
}

export interface SystemBranding {
  logoUrl: string | null;
  faviconUrl: string | null;
  companyName?: string;
  systemTimezone?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  backgroundColor?: string;
  surfaceColor?: string;
  textPrimaryColor?: string;
  textSecondaryColor?: string;
}

// --- IMPORT TOOL TYPES ---
export interface ImportProfile {
    id: number;
    profileName: string;
    mappingRules: Record<string, string>; // e.g. { "productName": "Column A", "unitCost": "Price" }
    createdAt: string;
}

// The standard fields our database expects
export type ImportField = 
    | 'productName' 
    | 'manufacturer' 
    | 'variantName' // Color/Style
    | 'sku' 
    | 'size' 
    | 'cartonSize'
    | 'unitCost' 
    | 'retailPrice';

// A single row of data after it has been mapped from CSV
export interface MappedRow {
    productName?: string;
    manufacturer?: string;
    variantName?: string;
    sku?: string;
    size?: string;
    cartonSize?: number;
    unitCost?: number;
    retailPrice?: number;
    // Metadata
    originalRowIndex: number;
    status?: 'new' | 'update' | 'error' | 'ignored';
}

// --- ADDED: Spreadsheet Cleaner Types ---

export interface ExcelSheetData {
    fileName: string;
    headers: string[];
    rows: any[]; // Raw objects from XLSX
}

export interface KnownSize {
    id: string;
    label: string; // The clean output, e.g. "12x24"
    matchers?: string[]; // Aliases/Messy inputs, e.g. ["M122", "Tile 12 by 24"]
}

export interface SizeAlias {
    id: number;
    aliasText: string;
    mappedSize: string;
}

export interface ParsedRow {
    id: string;
    originalData: Record<string, any>;

    // --- State per cleaning mode ---
    sizeTargetText?: string;
    sizeStatus?: 'MATCHED' | 'UNKNOWN' | 'NEW';
    extractedSize?: string | null;
    sizeSelectionSource?: string;

    nameTargetText?: string;
    nameStatus?: 'MATCHED' | 'UNKNOWN' | 'NEW';
    extractedName?: string | null;

    manualOverride?: boolean;
}

// --- MODIFIED & CONSOLIDATED: A single, flexible type for all user preferences ---
export interface UserPreferences {
  project_dashboard_layout?: ReactGridLayout_Layouts; // Legacy field
  projectLayouts?: ReactGridLayout_Layouts; // New preferred field
  calendar_user_colors?: { [userId: string]: string }; // Legacy field
  dashboard_email_settings?: DashboardEmailSettings; // Legacy field
  dashboardEmail?: DashboardEmailSettings; // New preferred field
  calendarColor?: string; // New preferred field
}

export interface DataContextType extends AppData {
  isLoading: boolean;
  currentUser: CurrentUser | null;
  systemBranding: SystemBranding | null;
  refreshBranding: () => Promise<void>;
  users: User[]; // Explicitly expose User list
  isLayoutEditMode: boolean;
  toggleLayoutEditMode: () => void;
  updateCurrentUserProfile: (firstName: string, lastName: string) => Promise<void>;
  uploadCurrentUserAvatar: (file: File) => Promise<void>;
  deleteCurrentUserAvatar: (file: File) => Promise<void>;
  // --- MODIFIED: Simplified the save preferences function ---
  saveCurrentUserPreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  // --- END MODIFIED ---
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
  materialOrderHistory: ActivityLogEntry[];
  fetchMaterialOrderHistory: (orderId: number) => Promise<void>;
  
  // Legacy Sample Functions (Will be replaced)
  fetchSamples: () => Promise<void>;
  addSample: (sampleData: any) => Promise<Sample>;
  updateSample: (sampleId: number, sampleData: any) => Promise<void>;
  deleteSample: (sampleId: number) => Promise<void>;
  
  // --- REMOVED MUTATIONS ---
  // addInstaller, updateInstaller, deleteInstaller are now in useInstallerMutations
  // addCustomer, updateCustomer, deleteCustomer are now in useCustomerMutations
  // addProject, updateProject, deleteProject are now in useProjectMutations
  addSampleCheckout: (checkout: Omit<SampleCheckout, 'id' | 'checkoutDate' | 'actualReturnDate'>) => Promise<void>;
  updateSampleCheckout: (checkout: SampleCheckout) => Promise<void>;
  extendSampleCheckout: (checkout: SampleCheckout) => Promise<void>;
  toggleSampleSelection: (checkout: SampleCheckout) => Promise<void>; // New
  addQuote: (quote: Omit<Quote, 'id'|'dateSent'>) => Promise<void>;
  updateQuote: (quote: Partial<Quote> & {id: number}) => Promise<void>;
  acceptQuote: (quote: Partial<Quote> & { id: number }) => Promise<void>;
  saveJobDetails: (jobDetails: Partial<Job>) => Promise<void>;
  updateJob: (job: Job) => void;
  addChangeOrder: (changeOrder: Omit<ChangeOrder, 'id' | 'createdAt'>) => Promise<void>;
  updateChangeOrder: (changeOrderId: number, changeOrderData: Partial<Omit<ChangeOrder, 'id' | 'projectId' | 'createdAt'>>) => Promise<void>;
  deleteChangeOrder: (changeOrderId: number) => Promise<void>;
  addMaterialOrder: (orderData: any) => Promise<void>;
  updateMaterialOrder: (orderId: number, orderData: any) => Promise<void>;
  deleteMaterialOrder: (orderId: number) => Promise<void>;
  receiveMaterialOrder: (orderId: number, data: { dateReceived: string; notes: string; sendEmailNotification: boolean }) => Promise<void>;
  reportMaterialOrderDamage: (orderId: number, data: { items: any[]; replacementEta: string; notes: string; sendEmailNotification: boolean }) => Promise<void>;
  // addVendor, updateVendor, deleteVendor are now in useVendorMutations
  
  unreadCount: number; // NEW
  refreshNotifications: () => Promise<void>; // NEW

  // NEW INVENTORY CRUD
  fetchProducts: () => Promise<void>;
  addProduct: (formData: FormData) => Promise<Product>;
  updateProduct: (id: string, formData: FormData) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addVariant: (productId: string, formData: FormData) => Promise<ProductVariant>;
  addVariantsBatch: (productId: string, variantsData: any[]) => Promise<void>; // New
  updateVariant: (variantId: string, formData: FormData) => Promise<ProductVariant>;
  deleteVariant: (variantId: string, productId: string) => Promise<void>;

  toggleSampleDiscontinued: (sampleId: number, isDiscontinued: boolean) => Promise<void>;
}

export interface EmailTemplate {
  key: string;
  subject: string;
  body_content: string | null;
  description: string;
  available_variables: string[];
  updated_at?: string;
}