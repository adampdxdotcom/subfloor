import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useProducts, useProductMutations } from '../hooks/useProducts';
import { useGridColumns } from '../hooks/useWindowSize';
import { useSampleCheckouts, useSampleCheckoutMutations } from '../hooks/useSampleCheckouts';
import { useVendors } from '../hooks/useVendors';
import { PlusCircle, Search, Download, Clock, Undo2, Archive, LayoutGrid, ChevronRight, ExternalLink } from 'lucide-react';
import { Product, Vendor, PricingSettings } from '../types';
import { Link, useSearchParams } from 'react-router-dom'; // Added useSearchParams
import { toast } from 'react-hot-toast';
import AddEditVendorModal from '../components/AddEditVendorModal';
import ProductForm from '../components/ProductForm'; 
import * as preferenceService from '../services/preferenceService';
import { calculatePrice, getActivePricingRules } from '../utils/pricingUtils';
import ProductDetailModal from '../components/ProductDetailModal'; // Import New Modal
import SampleCarousel from '../components/SampleCarousel'; // Import Carousel
import ProductCard from '../components/ProductCard'; // NEW COMPONENT

const SampleLibrary: React.FC = () => {
  // --- HOOKS REPLACEMENT ---
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: sampleCheckouts = [] } = useSampleCheckouts();
  const { data: vendors = [] } = useVendors(); // Kept if needed for future logic, though mostly used in modals
  
  const productMutations = useProductMutations();
  // Note: updateSampleCheckout/extendSampleCheckout logic is inside ProductDetailModal/Carousel usually, 
  // so we don't strictly need those mutation functions here in the parent unless passing them down.

  // --- NEW: Handle URL Search Params ---
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  
  // Sync URL when search changes
  useEffect(() => {
      const params = new URLSearchParams();
      if (searchTerm) params.set('search', searchTerm);
      setSearchParams(params, { replace: true });
  }, [searchTerm, setSearchParams]);
  
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

  // --- VIRTUALIZATION SETUP ---
  const parentRef = useRef<HTMLDivElement>(null);
  const columns = useGridColumns(); // Get 1, 2, 3, or 4 columns based on screen width
  const [gridHeight, setGridHeight] = useState(600); // Default height

  // Calculate available height for the grid dynamically
  useEffect(() => {
      const updateHeight = () => {
          // Window height - Topbar (64px) - Page Header/Padding (~220px)
          const calculated = window.innerHeight - 280; 
          setGridHeight(calculated < 400 ? 400 : calculated); // Minimum 400px
      };
      
      updateHeight();
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
  }, []);
  
  // --- VIRTUALIZATION LOGIC ---
  const rowCount = Math.ceil(filteredProducts.length / columns);
  
  const rowVirtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 320, // Estimate card height + gap (~300px card + 20px gap)
      overscan: 5,
  });

  // --- MODIFIED: Add Product Handler ---
  const handleAddProduct = async (formData: FormData) => {
    setIsSaving(true);
    try {
      await productMutations.addProduct.mutateAsync(formData);
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

  if (productsLoading) { return <div>Loading library...</div>; }

  return (
    <div className="space-y-6">
      
      <div className="bg-surface p-6 rounded-lg shadow-md border border-border">
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
      
      {/* VIRTUALIZED GRID CONTAINER */}
      <div 
        ref={parentRef} 
        className="overflow-y-auto w-full relative bg-surface border border-border rounded-lg shadow-md"
        style={{ height: gridHeight }}
      >
        <div 
           style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}
        >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columns;
            // Get the chunk of items for this specific row
            const rowItems = filteredProducts.slice(startIndex, startIndex + columns);

            return (
                <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full flex gap-6 p-4"
                    style={{
                        transform: `translateY(${virtualRow.start}px)`,
                    }}
                >
                    {rowItems.map((product) => (
                        <div key={product.id} className="flex-1 min-w-0"> 
                            {/* min-w-0 prevents flex items from overflowing */}
                            <ProductCard 
                                product={product} 
                                pricingSettings={pricingSettings} 
                                onClick={handleProductClick} 
                                showDiscontinuedStyle={viewMode === 'discontinued'} 
                            />
                        </div>
                    ))}
                    {/* Spacer divs to fill empty slots in the last row so items align left */}
                    {rowItems.length < columns && Array.from({ length: columns - rowItems.length }).map((_, i) => (
                        <div key={`spacer-${i}`} className="flex-1" />
                    ))}
                </div>
            );
        })}
        </div>

        {filteredProducts.length === 0 && (<p className="text-text-secondary col-span-full text-center py-10">No products found.</p>)}
      </div>

      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
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