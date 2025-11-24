import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { PlusCircle, Search, Download, Clock, Undo2, Archive, LayoutGrid, ChevronRight } from 'lucide-react';
import { Product, Vendor, PricingSettings } from '../types';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import AddEditVendorModal from '../components/AddEditVendorModal';
import ProductForm from '../components/ProductForm'; 
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import ProductDetailModal from '../components/ProductDetailModal'; // Import New Modal
import SampleCarousel from '../components/SampleCarousel'; // Import Carousel

const SampleLibrary: React.FC = () => {
  const {
    products, addProduct, isLoading, vendors, 
    sampleCheckouts, updateSampleCheckout, extendSampleCheckout
  } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  
  // --- NEW: Tab State ---
  const [viewMode, setViewMode] = useState<'active' | 'discontinued'>('active');

  useEffect(() => {
      const fetchSettings = async () => {
          try { setPricingSettings(await preferenceService.getPricingSettings()); }
          catch (e) { console.error("Failed to load pricing settings for library view."); }
      };
      fetchSettings();
  }, []);
  
  // --- All form-related state has been REMOVED from this component ---

  const [isSaving, setIsSaving] = useState(false);
  
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // This is now only used by the image uploader, can be refactored further if needed
  const resetAddModal = () => {
    setIsAddModalOpen(false);
  };

  // --- FIXED: Filter active checkouts for the carousel ---
  const activeCheckouts = useMemo(() => {
      return sampleCheckouts
          .filter(sc => sc.actualReturnDate === null)
          .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime());
  }, [sampleCheckouts]);

  // --- MODIFIED: Filter Logic handles Tabs AND Search ---
  const filteredProducts = useMemo(() => {
    // 1. First filter by the Tab (Active vs Discontinued)
    let baseList = products.filter(s => 
        viewMode === 'active' ? !s.isDiscontinued : s.isDiscontinued
    );

    // 2. Then filter by search term
    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) return baseList;

    return baseList.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(lowercasedTerm);
        const manufMatch = p.manufacturerName?.toLowerCase().includes(lowercasedTerm);
        
        // Deep Search: Check variants too!
        const variantMatch = p.variants.some(v => 
            (v.name && v.name.toLowerCase().includes(lowercasedTerm)) ||
            (v.size && v.size.toLowerCase().includes(lowercasedTerm)) ||
            (v.sku && v.sku.toLowerCase().includes(lowercasedTerm))
        );
        
        return nameMatch || manufMatch || variantMatch;
    });
  }, [products, searchTerm, viewMode]);

  // --- MODIFIED: Add Product Handler ---
  const handleAddProduct = async (formData: FormData) => {
    setIsSaving(true);
    try {
      await addProduct(formData); // NEW
      toast.success('Product added successfully!');
      resetAddModal();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add product.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleProductClick = (product: Product) => {
    setSelectedProduct(product);
    setIsDetailModalOpen(true);
  };

  // Helper to calculate display price for cards
  const getDisplayPriceRange = (product: Product) => {
      if (!product.variants || product.variants.length === 0 || !pricingSettings) return null;
      
      // Get active vendor
      const vendorId = product.supplierId || product.manufacturerId;
      const vendor = vendors.find(v => v.id === vendorId);
      const rules = getActivePricingRules(vendor, pricingSettings, 'Customer');

      const prices = product.variants
        .filter(v => v.unitCost)
        .map(v => calculatePrice(Number(v.unitCost), rules.percentage, rules.method));
      
      if (prices.length === 0) return null;
      
      const min = Math.min(...prices);
      const max = Math.max(...prices);
      
      if (min === max) return `$${min.toFixed(2)}`;
      return `$${min.toFixed(2)} - $${max.toFixed(2)}`;
  };

  if (isLoading) { return <div>Loading library...</div>; }

  return (
    <div className="container mx-auto p-4">
      <div className="bg-surface p-6 rounded-lg shadow-md mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-text-primary">Sample Library</h1>
          <div className="flex items-center gap-4">
              {/* --- NEW: View Toggle Buttons --- */}
              <div className="bg-background p-1 rounded-lg flex items-center border border-border">
                  <button 
                    onClick={() => setViewMode('active')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        viewMode === 'active' ? 'bg-surface shadow text-primary' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                      <LayoutGrid size={16} /> Active
                  </button>
                  <button 
                    onClick={() => setViewMode('discontinued')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                        viewMode === 'discontinued' ? 'bg-surface shadow text-red-400' : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                      <Archive size={16} /> Discontinued
                  </button>
              </div>

              {viewMode === 'active' && (
                  <button onClick={() => setIsAddModalOpen(true)} className="flex items-center bg-primary hover:bg-primary-hover text-on-primary font-bold py-2 px-4 rounded-lg transition-colors shadow-md">
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Add New Product
                  </button>
              )}
          </div>
        </div>
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" size={18} />
          <input type="text" placeholder="Search by style, color, manufacturer, type, or SKU..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-3 bg-background border border-border rounded-lg text-text-primary focus:ring-2 focus:ring-primary outline-none transition-all shadow-inner" />
        </div>
      </div>

      {searchTerm === '' && viewMode === 'active' && activeCheckouts.length > 0 && (
        <>
          <SampleCarousel 
            title="Currently Checked Out" 
            checkouts={activeCheckouts} 
            onItemClick={handleProductClick} 
          /> 
          <div className="border-t border-border my-8"></div>
          <h2 className="text-2xl font-semibold mb-6 text-text-primary">All Products</h2>
        </>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mt-6">
        {filteredProducts.map(product => {
          // DEBUG: Check console to see exactly what URL is coming from backend
          // console.log("Rendering Product:", product.id, product.defaultImageUrl);
          return (
          <div key={product.id} className="bg-surface rounded-lg shadow-md border border-border overflow-hidden group flex flex-col cursor-pointer hover:shadow-lg transition-shadow" onClick={() => handleProductClick(product)}>
            
            {/* Image Area */}
            <div className="w-full h-48 bg-background flex items-center justify-center relative">
                {product.defaultImageUrl ? (
                    <img src={product.defaultImageUrl} alt={product.name} className="w-full h-full object-cover" />
                ) : (
                    <div className="text-center p-4">
                        <span className="text-4xl opacity-20 font-bold text-text-tertiary block mb-2">
                            {product.name.substring(0, 2).toUpperCase()}
                        </span>
                        <span className="text-xs text-text-secondary">No Image</span>
                    </div>
                )}
                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                    {product.variants.length} Variants
                </div>
            </div>

            <div className="p-4 flex flex-col flex-grow">
              <h3 className="font-bold text-lg text-text-primary truncate" title={product.name}>{product.name}</h3>
              <p className="text-sm text-text-secondary truncate">{product.manufacturerName || 'Unknown Vendor'}</p>
              
              {/* Price Range */}
              <div className="mt-2">
                  {getDisplayPriceRange(product) ? (
                      <p className="text-sm font-semibold text-green-400">
                          {getDisplayPriceRange(product)} <span className="text-text-secondary font-normal text-xs">/ Unit</span>
                      </p>
                  ) : (
                      <p className="text-xs text-text-tertiary italic">No pricing set</p>
                  )}
              </div>

              <div className="flex-grow" />
              
              {viewMode === 'discontinued' && (
                  <div className="mb-2 text-center bg-red-900/30 text-red-400 text-xs font-bold py-1 rounded border border-red-900/50 uppercase tracking-wider">Discontinued</div>
              )}
              
              <div className="flex justify-between items-center mt-4 pt-3 border-t border-border">
                <span className="text-xs font-semibold bg-background text-text-secondary px-2 py-1 rounded">{product.productType}</span>
                <ChevronRight size={16} className="text-text-tertiary" />
              </div>
            </div>
          </div>
        )})}
        {filteredProducts.length === 0 && (<p className="text-text-secondary col-span-full text-center py-10">No products found.</p>)}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-surface p-8 rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-2xl font-bold mb-6 text-text-primary">Create New Product Line</h2>
            
            <ProductForm 
                onSave={handleAddProduct} 
                onCancel={resetAddModal} 
                isSaving={isSaving} 
            />

          </div>
        </div>
      )}
      {isDetailModalOpen && selectedProduct && (<ProductDetailModal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} product={selectedProduct} />)}
    </div>
  );
};

export default SampleLibrary;