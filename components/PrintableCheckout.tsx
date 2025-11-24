import React, { useState, useEffect } from 'react';
import { Customer, Project, PricingSettings, Vendor } from '../types';
import { CheckoutItem } from './SampleSelector'; // Import from selector
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules, formatCurrency } from '../utils/pricingUtils';

interface PrintableCheckoutProps {
  customer: Customer | null;
  project: Project | null;
  checkoutItems: CheckoutItem[]; // Updated Prop
  vendors: Vendor[]; 
  returnDate: string;
}

export const PrintableCheckout: React.FC<PrintableCheckoutProps> = ({ customer, project, checkoutItems, vendors, returnDate }) => {
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

  useEffect(() => {
      const fetchSettings = async () => {
          try { setPricingSettings(await preferenceService.getPricingSettings()); }
          catch (e) { console.error("Failed to load pricing settings for printout."); }
      };
      fetchSettings();
  }, []);

  if (!customer || !project) {
    return null;
  }

  return (
    // This div is the container for everything that will appear on the printed page.
    <div id="printable-summary" className="p-10 bg-white text-black font-sans">
      <header className="flex justify-between items-start pb-4 border-b-2 border-gray-300">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">Joblogger</h1>
          <p className="text-gray-600">Sample Checkout Summary</p>
        </div>
        <div className="text-right text-sm">
          <p className="font-bold text-base">{customer.fullName}</p>
          {customer.phoneNumber && <p className="text-gray-700">{customer.phoneNumber}</p>}
          {customer.email && <p className="text-gray-700">{customer.email}</p>}
        </div>
      </header>

      <main className="mt-8">
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2 pb-1 border-b border-gray-200">Project Details</h2>
          <p><strong className="font-semibold">Project Name:</strong> {project.projectName}</p>
          <p><strong className="font-semibold">Project Type:</strong> {project.projectType}</p>
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-2 pb-1 border-b border-gray-200">Samples Checked Out</h2>
          <table className="w-full mt-4 text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="p-2 font-semibold">Product / Variant</th>
                <th className="p-2 font-semibold">Manufacturer</th>
                <th className="p-2 font-semibold">Sample Type</th>
              </tr>
            </thead>
            <tbody>
              {checkoutItems.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="p-2 align-top">
                      <div className="font-bold">{item.productName}</div>
                      <div className="text-sm text-gray-600">{item.variantName}</div>
                  </td>
                  <td className="p-2 align-top">{item.manufacturerName || 'N/A'}</td>
                  <td className="p-2 align-top">
                      {item.sampleType} <span className="text-sm text-gray-500">(Qty: {item.quantity})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>

      <footer className="mt-12 pt-4 border-t-2 border-gray-300">
        <p className="font-bold text-lg">
          Expected Return Date: {new Date(returnDate).toLocaleDateString()}
        </p>
        <p className="mt-4 text-sm text-gray-600">
          Please return all samples by the date listed above. Thank you!
        </p>
      </footer>
    </div>
  );
};