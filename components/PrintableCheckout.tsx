import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Customer, Project, PricingSettings } from '../types';
import { CheckoutItem } from './SampleSelector';
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules, formatCurrency } from '../utils/pricingUtils';

interface PrintableCheckoutProps {
  customer: Customer | null;
  project: Project | null;
  checkoutItems: CheckoutItem[];
  returnDate: string;
}

const InfoRow: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex gap-2 items-baseline leading-tight text-sm">
    <span className="text-gray-500 font-medium whitespace-nowrap min-w-[120px]">{label}:</span>
    <span className="text-black font-bold">{value}</span>
  </div>
);

export const PrintableCheckout: React.FC<PrintableCheckoutProps> = ({ customer, project, checkoutItems, returnDate }) => {
  const { systemBranding, vendors } = useData();
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
        try { setPricingSettings(await preferenceService.getPricingSettings()); }
        catch (e) { console.error("Failed to load pricing settings for printable summary."); }
    };
    fetchSettings();
  }, []);
  
  if (!customer) {
    return null;
  }

  // Handle Installer objects masked as Customers (Installers have installerName, not fullName)
  const recipientName = (customer as any).installerName || customer.fullName;
  const recipientPhone = (customer as any).phone || customer.phoneNumber;
  const recipientEmail = customer.email;

  const getCalculatedPrices = (item: CheckoutItem) => {
    if (!item.unitCost || !pricingSettings) return null;
    // Use ID for precise lookup, fallback to name if ID missing
    const vendor = vendors.find(v => v.id === item.manufacturerId) || vendors.find(v => v.vendorName === item.manufacturerName);
    const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');
    const retailPrice = calculatePrice(Number(item.unitCost), rules.percentage, rules.method);
    const cartonPrice = item.cartonSize ? retailPrice * Number(item.cartonSize) : null;
    return { retailPrice, cartonPrice };
  };

  // Helper: Format Phone Number
  const formatPhone = (phone: string) => {
    const cleaned = ('' + phone).replace(/\D/g, '');
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
    return phone;
  };

  // Helper: Format Hours for Single Line
  const formatHoursSingleLine = (hours: string) => {
    return hours.split(/\n/)
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join(' | ');
  };

  return (
    // This div is the container for everything that will appear on the printed page.
    <div id="printable-summary" className="p-10 bg-white text-black font-sans text-sm">
      <header className="flex justify-between items-start pb-4 border-b-2 border-gray-300">
        <div>
          <h1 className="text-4xl font-bold text-gray-800">{systemBranding?.companyName || 'Subfloor'}</h1>
          <p className="text-gray-600">Sample Checkout Summary</p>
          
          {/* Company Contact Info */}
          <div className="mt-2 text-sm text-gray-500 space-y-0.5">
            {systemBranding?.companyPhone && (
                <p>{formatPhone(systemBranding.companyPhone)}</p>
            )}
            
            {systemBranding?.companyAddress && (
                <p className="whitespace-pre-line leading-tight">{systemBranding.companyAddress}</p>
            )}
            
            {systemBranding?.companyWebsite && (
                <p>{systemBranding.companyWebsite}</p>
            )}


            {/* Hours Display */}
            {systemBranding?.companyHours && (
                <div className={`mt-1 pt-1 ${systemBranding.companyHoursFormat === 'stacked' ? 'block' : 'flex gap-2'}`}>
                    <span className="font-semibold text-gray-600 text-xs uppercase tracking-wide">Hours:</span>
                    {systemBranding.companyHoursFormat === 'stacked' ? (
                        <p className="whitespace-pre-line leading-tight pl-0.5">
                            {systemBranding.companyHours}
                        </p>
                    ) : (
                         <p>{formatHoursSingleLine(systemBranding.companyHours)}</p>
                    )}
                </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="font-bold text-base">{recipientName}</p>
          {recipientPhone && <p className="text-gray-700">{recipientPhone}</p>}
          {recipientEmail && <p className="text-gray-700">{recipientEmail}</p>}
        </div>
      </header>

      <main className="mt-8">
        {project && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold mb-2 pb-1 border-b border-gray-200">Project Details</h2>
            <p><strong className="font-semibold">Project Name:</strong> {project.projectName}</p>
            <p><strong className="font-semibold">Project Type:</strong> {project.projectType}</p>
          </div>
        )}

        <div>
          <h2 className="text-xl font-semibold mb-2 pb-1 border-b border-gray-200">Samples Checked Out</h2>
          <div className="mt-4 space-y-4">
            {checkoutItems.map((item, idx) => {
              const prices = getCalculatedPrices(item);
              // Use the corrected productLineUrl field
              const qrUrl = `/api/products/${item.productId}/variants/${item.interestVariantId}/qr?fallback=${encodeURIComponent(item.productUrl || 'https://wildwooddesigncenter.com')}`;
              
              return (
                <div key={idx} className="flex flex-row items-center justify-between gap-4 pt-4 border-t border-gray-200">
                  {/* Left Side: Info */}
                  <div className="flex-1 space-y-1">
                    <InfoRow label="Product / Variant" value={`${item.productName} / ${item.interestName}`} />
                    <InfoRow label="Manufacturer" value={item.manufacturerName || 'N/A'} />
                    {item.size && <InfoRow label="Size" value={item.size} />}
                    <div className="flex flex-wrap gap-x-8 gap-y-1">
                        {prices?.retailPrice && (
                            <InfoRow 
                                label="Retail Price" 
                                value={`${formatCurrency(prices.retailPrice)} ${item.pricingUnit ? `/ ${item.pricingUnit}` : (item.uom ? `/ ${item.uom}` : '')}`} 
                            />
                        )}
                        
                        {/* Only show Carton info if it's NOT priced by Sheet and has carton data */}
                        {item.productType !== 'Carpet' && item.pricingUnit?.toLowerCase() !== 'sheet' && item.cartonSize && prices?.cartonPrice && (
                            <InfoRow 
                                label="Carton" 
                                value={`${item.cartonSize} ${item.uom || ''} (${formatCurrency(prices.cartonPrice)})`} 
                            />
                        )}
                    </div>
                  </div>
                  {/* Right Side: QR Code */}
                  <div className="flex-shrink-0">
                    <img 
                        src={qrUrl} 
                        alt={`QR code for ${item.productName}`} 
                        className="w-24 h-24 bg-white p-1 border object-contain" 
                    />
                  </div>
                </div>
              );
            })}
          </div>
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