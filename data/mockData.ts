
import { AppData, ProjectStatus, ProjectType, QuoteStatus } from '../types';

export const initialData: AppData = {
  customers: [
    { id: 1, fullName: 'John Doe', address: '123 Main St, Anytown, USA', phoneNumber: '555-123-4567', email: 'john.doe@example.com', createdAt: new Date().toISOString() },
    { id: 2, fullName: 'Jane Smith', address: '456 Oak Ave, Anytown, USA', phoneNumber: '555-987-6543', email: 'jane.smith@example.com', createdAt: new Date().toISOString() },
  ],
  samples: [
    { id: 1, sampleName: 'Everlife Oak #712', sku: 'EVO712', type: 'LVP', isAvailable: true },
    { id: 2, sampleName: 'Maple Hardwood Dark', sku: 'MHD200', type: 'Hardwood', isAvailable: false },
    { id: 3, sampleName: 'Carrara Marble Tile', sku: 'CMT01', type: 'Tile', isAvailable: true },
    { id: 4, sampleName: 'Plush Carpet Grey', sku: 'PCG99', type: 'Carpet', isAvailable: true },
  ],
  projects: [
    { id: 1, customerId: 1, projectName: 'Kitchen Remodel', projectType: ProjectType.KITCHEN, status: ProjectStatus.QUOTING, finalChoice: null, createdAt: new Date().toISOString() },
    { id: 2, customerId: 2, projectName: 'Main Floor LVP', projectType: ProjectType.FULL_HOME, status: ProjectStatus.SCHEDULED, finalChoice: 'Everlife Oak #712', createdAt: new Date().toISOString() },
    { id: 3, customerId: 1, projectName: 'Basement Carpet', projectType: ProjectType.OTHER, status: ProjectStatus.SAMPLE_CHECKOUT, finalChoice: null, createdAt: new Date().toISOString() },
  ],
  sampleCheckouts: [
    { id: 1, projectId: 1, sampleId: 1, checkoutDate: new Date().toISOString(), expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), actualReturnDate: null },
    { id: 2, projectId: 3, sampleId: 4, checkoutDate: new Date().toISOString(), expectedReturnDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), actualReturnDate: null },
    { id: 3, projectId: 2, sampleId: 2, checkoutDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), expectedReturnDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), actualReturnDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString() },
  ],
  installers: [
    { id: 1, installerName: 'Flooring Masters Inc.', contactEmail: 'contact@fm.com', contactPhone: '555-333-4444' },
    { id: 2, installerName: 'Pro Install Crew', contactEmail: 'quotes@proinstall.com', contactPhone: '555-555-5555' },
  ],
  quotes: [
    { id: 1, projectId: 1, installerId: 1, quoteDetails: 'LVP installation for kitchen, approx 300 sqft.', amount: 4500.00, dateSent: new Date().toISOString(), status: QuoteStatus.SENT },
    { id: 2, projectId: 2, installerId: 2, quoteDetails: 'Full main floor LVP, approx 1200 sqft.', amount: 15000.00, dateSent: new Date().toISOString(), status: QuoteStatus.ACCEPTED },
  ],
  jobs: [
    { id: 1, projectId: 2, downPaymentAmount: 7500.00, downPaymentReceived: true, paperworkSignedUrl: '/path/to/signed/doc.pdf', scheduledStartDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], scheduledEndDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], notes: 'Customer needs old flooring removed.' },
  ],
};
