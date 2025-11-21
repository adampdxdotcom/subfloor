import React, { useState, useEffect } from 'react';
import { Customer, Project, Sample, PricingSettings, Vendor } from '../types';
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules, formatCurrency } from '../utils/pricingUtils';

interface PrintableCheckoutProps {
  customer: Customer | null;
  project: Project | null;
  samples: Sample[];
  vendors: Vendor[]; // Needed for pricing rules
  returnDate: string;
}

// NOTE: This component does not need forwardRef with the new method.
export const PrintableCheckout: React.FC<PrintableCheckoutProps> = ({ customer, project, samples, vendors, returnDate }) => {
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

  const renderPricingMenu = (sample: Sample) => {
      if (!pricingSettings || !sample.sizes || sample.sizes.length === 0) return null;
      
      const vendorId = sample.supplierId || sample.manufacturerId;
      const vendor = vendors.find(v => v.id === vendorId);
      const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');

      return (
          <div className="mt-1 pl-2 border-l-2 border-gray-300 text-xs text-gray-600">
              <p className="font-semibold text-gray-500 mb-0.5">Available Options:</p>
              {sample.sizes.map((s, idx) => {
                  const isString = typeof s === 'string';
                  const name = isString ? s : s.value;
                  // Calculate Price
                  let priceDisplay = "";
                  if (!isString && s.unitCost) {
                      const retail = calculatePrice(Number(s.unitCost), rules.percentage, rules.method);
                      priceDisplay = `${formatCurrency(retail)} / ${s.uom || sample.uom || 'SF'}`;
                      
                      // Calculate Carton Price
                      if (s.cartonSize) {
                          const cartonPrice = retail * Number(s.cartonSize);
                          priceDisplay += `  (${formatCurrency(cartonPrice)} / Box)`;
                      }
                  }
                  
                  return (
                      <div key={idx} className="flex justify-between w-2/3">
                          <span>• {name}</span>
                          <span className="font-mono">{priceDisplay}</span>
                      </div>
                  );
              })}
          </div>
      );
  };

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
                <th className="p-2 font-semibold">Style / Color</th>
                <th className="p-2 font-semibold">Manufacturer</th>
                <th className="p-2 font-semibold">Type</th>
              </tr>
            </thead>
            <tbody>
              {samples.map((sample) => (
                <tr key={sample.id} className="border-b border-gray-200">
                  <td className="p-2 align-top">
                      <div className="font-bold">{sample.style} {sample.color ? `- ${sample.color}` : ''}</div>
                      {renderPricingMenu(sample)}
                  </td>
                  <td className="p-2 align-top">{sample.manufacturerName || 'N/A'}</td>
                  <td className="p-2 align-top">{sample.productType}</td>
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