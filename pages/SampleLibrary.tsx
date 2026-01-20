import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useProducts, useProductMutations } from '../hooks/useProducts';
import { useGridColumns } from '../hooks/useWindowSize';
import { useSampleCheckouts } from '../hooks/useSampleCheckouts';
import { PlusCircle, Search, LayoutGrid, Archive, X } from 'lucide-react'; 
import { Product, PricingSettings } from '../types';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import ProductForm from '../components/ProductForm'; 
import * as preferenceService from '../services/preferenceService';
import ProductDetailModal from '../components/ProductDetailModal';
import SampleCarousel from '../components/SampleCarousel';
import ProductCard from '../components/ProductCard';

const SampleLibrary: React.FC = () => {
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: sampleCheckouts = [] } = useSampleCheckouts();
  
  const productMutations = useProductMutations();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';

  const [searchTerm, setSearchTerm] = useState(initialSearch);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [pricingSettings, setPricingSettings] = useState<PricingSettings | null>(null);
  
  // Sync URL changes to local state
  useEffect(() => {
    const urlQuery = searchParams.get('search') || '';
    if (urlQuery !== searchTerm) {
      setSearchTerm(urlQuery);
    }
  }, [searchParams]);

  // Handle typing: update state AND URL
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchTerm(val);
    
    const newParams = new URLSearchParams(searchParams);
    if (val) newParams.set('search', val);
    else newParams.delete('search');
    setSearchParams(newParams, { replace: true });
  };
  
  const [viewMode, setViewMode] = useState<'active' | 'discontinued'>('active');

  useEffect(() => {
      const fetchSettings = async () => {
          try { setPricingSettings(await preferenceService.getPricingSettings()); }
          catch (e) { console.error("Failed to load pricing settings for library view."); }
      };
      fetchSettings();
  }, []);
  
  const [isSaving, setIsSaving] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    const openId = searchParams.get('open');
    if (openId && products.length > 0) {
      const productToOpen = products.find((p) => String(p.id) === openId);
      if (productToOpen) {
        setSelectedProduct(productToOpen);
        setIsDetailModalOpen(true);
      }
    }
  }, [searchParams, products]);

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    if (searchParams.has('open')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('open');
      setSearchParams(newParams, { replace: true });
    }
  };

  const resetAddModal = () => {
    setIsAddModalOpen(false);
  };

  const activeCheckouts = useMemo(() => {
      return sampleCheckouts
          .filter(sc => sc.actualReturnDate === null)
          .sort((a, b) => new Date(a.expectedReturnDate).getTime() - new Date(b.expectedReturnDate).getTime());
  }, [sampleCheckouts]);

  const filteredProducts = useMemo(() => {
    let baseList = products.filter(s => 
        viewMode === 'active' ? !s.isDiscontinued : s.isDiscontinued
    );

    const lowercasedTerm = searchTerm.toLowerCase();
    if (!lowercasedTerm) return baseList;

    return baseList.filter(p => {
        const nameMatch = p.name.toLowerCase().includes(lowercasedTerm);
        const manufMatch = p.manufacturerName?.toLowerCase().includes(lowercasedTerm);
        const variantMatch = p.variants.some(v => 
            (v.name && v.name.toLowerCase().includes(lowercasedTerm)) ||
            (v.size && v.size.toLowerCase().includes(lowercasedTerm)) ||
            (v.sku && v.sku.toLowerCase().includes(lowercasedTerm))
        );
        return nameMatch || manufMatch || variantMatch;
    });
  }, [products, searchTerm, viewMode]);

  const parentRef = useRef<HTMLDivElement>(null);
  const columns = useGridColumns();
  const [gridHeight, setGridHeight] = useState(600);

  useEffect(() => {
      const updateHeight = () => {
          const calculated = window.innerHeight - 280; 
          setGridHeight(calculated < 400 ? 400 : calculated); 
      };
      updateHeight();
      window.addEventListener('resize', updateHeight);
      return () => window.removeEventListener('resize', updateHeight);
  }, []);
  
  const rowCount = Math.ceil(filteredProducts.length / columns);
  
  const rowVirtualizer = useVirtualizer({
      count: rowCount,
      getScrollElement: () => parentRef.current,
      estimateSize: () => 320, 
      overscan: 5,
  });

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

  if (productsLoading) { 
    return <div className="flex items-center justify-center h-64 text-text-secondary">Loading library...</div>; 
  }

  // --- EARLY RETURN: DETAIL VIEW ---
  if (isDetailModalOpen && selectedProduct) {
    return (
      <ProductDetailModal
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        product={selectedProduct}
      />
    );
  }

  return (
    <div className="space-y-8">
      {/* Header & Controls - De-boxed MD3 Style */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-1 w-full">
          <h1 className="text-4xl font-bold text-text-primary tracking-tight">Sample Library</h1>
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
              {/* Segmented Control */}
              <div className="bg-surface-container-high p-1 rounded-full flex items-center shadow-inner">
                  <button 
                    onClick={() => setViewMode('active')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${
                        viewMode === 'active' ? 'bg-surface shadow text-primary' : 'text-text-secondary hover:text-text-primary hover:bg-surface-container-highest'
                    }`}
                  >
                      <LayoutGrid size={16} /> Active
                  </button>
                  <button 
                    onClick={() => setViewMode('discontinued')}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-2 rounded-full text-sm font-medium transition-all ${
                        viewMode === 'discontinued' ? 'bg-surface shadow text-error' : 'text-text-secondary hover:text-text-primary hover:bg-surface-container-highest'
                    }`}
                  >
                      <Archive size={16} /> Discontinued
                  </button>
              </div>

              {viewMode === 'active' && (
                  <button onClick={() => setIsAddModalOpen(true)} className="flex items-center justify-center bg-primary hover:bg-primary-hover text-on-primary font-semibold py-3 px-6 rounded-full transition-all shadow-lg hover:shadow-xl">
                    <PlusCircle className="w-5 h-5 mr-2" />
                    Add Product
                  </button>
              )}
          </div>
      </div>
      
      {/* Floating Search Bar */}
      <div className="relative w-full max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-secondary" size={20} />
          <input 
            type="text" 
            placeholder="Search by style, color, manufacturer, type, or SKU..." 
            value={searchTerm} 
            onChange={handleSearchChange} 
            className="w-full pl-12 pr-6 py-4 bg-surface-container-high border-none rounded-full text-text-primary focus:ring-2 focus:ring-primary/50 outline-none transition-shadow shadow-sm hover:shadow-md placeholder:text-text-tertiary" 
          />
      </div>

      {searchTerm === '' && viewMode === 'active' && activeCheckouts.length > 0 && (
        <>
          <SampleCarousel 
            title="Currently Checked Out" 
            checkouts={activeCheckouts} 
            onItemClick={handleProductClick} 
          /> 
          <div className="border-t border-outline/10 my-8"></div>
          <h2 className="text-2xl font-semibold mb-6 text-text-primary pl-1">All Products</h2>
        </>
      )}
      
      <div 
        ref={parentRef} 
        className="overflow-y-auto w-full relative rounded-xl"
        style={{ height: gridHeight }}
      >
        <div style={{ height: `${rowVirtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const startIndex = virtualRow.index * columns;
            const rowItems = productsLoading ? [] : filteredProducts.slice(startIndex, startIndex + columns);

            return (
                <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    className="absolute top-0 left-0 w-full flex gap-6 p-4"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                >
                    {rowItems.map((product) => (
                        <div key={product.id} className="flex-1 min-w-0"> 
                            <ProductCard 
                                product={product} 
                                pricingSettings={pricingSettings} 
                                onClick={handleProductClick} 
                                showDiscontinuedStyle={viewMode === 'discontinued'}
                            />
                        </div>
                    ))}
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
        <div className="fixed inset-0 bg-black/75 flex justify-center z-50 overflow-y-auto">
          <div className="bg-surface-container-high w-full min-h-full md:min-h-0 md:h-auto md:max-h-[90vh] md:max-w-3xl md:rounded-xl shadow-2xl flex flex-col border border-outline/10 md:my-auto relative" onClick={(e) => e.stopPropagation()}>
            
            <div className="p-4 border-b border-outline/10 flex justify-between items-center bg-surface-container-low md:rounded-t-xl">
                <h2 className="text-xl font-bold text-text-primary">Create New Product Line</h2>
                <button onClick={resetAddModal} className="p-2 hover:bg-surface-container-highest rounded-full text-text-secondary hover:text-text-primary"><X size={24} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow">
            <ProductForm 
                onSave={handleAddProduct} 
                onCancel={resetAddModal} 
                isSaving={isSaving} 
            />
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
};

export default SampleLibrary;