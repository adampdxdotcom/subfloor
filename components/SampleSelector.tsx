import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { Product, ProductVariant, SAMPLE_TYPES, SampleType } from '../types';
import { Layers, ScanLine, X, Search, PlusCircle, ChevronRight } from 'lucide-react';
import { toast } from 'react-hot-toast';
import QrScanner from './QrScanner';

// Define what the parent expects to receive
export interface CheckoutItem {
    variantId: string;
    // Display fields
    productName: string;
    variantName: string;
    manufacturerName?: string;
    // Checkout fields
    sampleType: SampleType;
    quantity: number;
}

interface SampleSelectorProps {
  onItemsChange: (items: CheckoutItem[]) => void;
  onRequestNewSample?: (searchTerm: string) => void;
  externalSelectedProduct?: Product | null;
}

const SampleSelector: React.FC<SampleSelectorProps> = ({ onItemsChange, onRequestNewSample, externalSelectedProduct }) => {
  const { products } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<CheckoutItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  // --- Internal State for the "Variant Picker" ---
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  
  // Default values since UI inputs are removed
  const selectedType: SampleType = 'Board';
  const selectedQuantity: number = 1;

  // --- SEARCH LOGIC ---
  const searchResults = useMemo(() => {
    if (searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    
    return products.filter(p => 
      !p.isDiscontinued &&
      (
        p.name.toLowerCase().includes(term) ||
        p.manufacturerName?.toLowerCase().includes(term) ||
        // Deep search variants
        p.variants.some(v => 
            (v.name && v.name.toLowerCase().includes(term)) ||
            (v.sku && v.sku.toLowerCase().includes(term))
        )
      )
    );
  }, [searchTerm, products]);

  // Notify parent whenever local state changes
  useEffect(() => {
    onItemsChange(selectedItems);
  }, [selectedItems, onItemsChange]);

  // Handle external selection (e.g. after creating a new sample)
  useEffect(() => {
      if (externalSelectedProduct) {
          setPendingProduct(externalSelectedProduct);
          // Try to select master or first variant
          if (externalSelectedProduct.variants.length > 0) {
             const master = externalSelectedProduct.variants.find(v => v.isMaster);
             setSelectedVariantId(master ? master.id : externalSelectedProduct.variants[0].id);
          } else {
             setSelectedVariantId(''); 
          }
      }
  }, [externalSelectedProduct]);

  const handleProductClick = (product: Product) => {
      setPendingProduct(product);
      
      if (product.variants.length > 0) {
          const master = product.variants.find(v => v.isMaster);
          setSelectedVariantId(master ? master.id : product.variants[0].id);
      } else {
          setSelectedVariantId(''); // Should handle empty variants case?
      }
  };

  const confirmAddItem = () => {
      if (!pendingProduct || !selectedVariantId) return;

      const variant = pendingProduct.variants.find(v => v.id === selectedVariantId);
      if (!variant) return;

      const newItem: CheckoutItem = {
          variantId: variant.id,
          productName: pendingProduct.name,
          variantName: variant.name || variant.size || 'Default',
          manufacturerName: pendingProduct.manufacturerName || '',
          sampleType: selectedType,
          quantity: selectedQuantity
      };

      // Check for duplicates (same variant AND type)
      const existingIndex = selectedItems.findIndex(i => i.variantId === newItem.variantId && i.sampleType === newItem.sampleType);
      
      if (existingIndex >= 0) {
          // Update quantity
          const updated = [...selectedItems];
          updated[existingIndex].quantity += newItem.quantity;
          setSelectedItems(updated);
          toast.success(`Updated quantity for ${newItem.variantName}`);
      } else {
          setSelectedItems(prev => [...prev, newItem]);
          toast.success(`Added ${newItem.variantName}`);
      }

      // Reset
      setPendingProduct(null);
      setSearchTerm('');
  };

  const removeItem = (index: number) => {
      setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  // --- QR SCAN LOGIC ---
  const handleScanSuccess = (decodedText: string) => {
    setIsScanning(false);
    
    let variantId = '';
    let productId = '';
    
    try {
        // Handle full URL format: http://.../scan-result?variantId=... OR ?productId=...
        if (decodedText.includes('?')) {
            const url = new URL(decodedText);
            variantId = url.searchParams.get('variantId') || ''; 
            productId = url.searchParams.get('productId') || '';
        } else {
            // Fallback: Assume raw UUID or legacy format
            variantId = decodedText;
        }

        if (!variantId && !productId) throw new Error("Could not parse ID");

        // Find the product containing this variant
        let foundProduct: Product | undefined;
        
        if (productId) {
            // Direct Product Lookup
            foundProduct = products.find(p => String(p.id) === String(productId));
        } else if (variantId) {
            // Variant Lookup
            for (const p of products) {
                if (p.variants.some(v => String(v.id) === String(variantId))) {
                    foundProduct = p;
                    break;
                }
            }
        }


        if (foundProduct) {
            // Match found! Open the picker
            setPendingProduct(foundProduct);
            
            if (variantId) {
                setSelectedVariantId(variantId);
            } else {
                // Product Scan: Check for Master Board
                const master = foundProduct.variants.find(v => v.isMaster);
                if (master) setSelectedVariantId(master.id);
            }
            toast.success("Item found!");
        } else {
            toast.error("Item not found in library.");
        }

    } catch (e) {
        console.error("Scan Error:", e);
        toast.error("Invalid QR Code");
    }
  };

  if (isScanning) {
    return <QrScanner onScanSuccess={handleScanSuccess} onClose={() => setIsScanning(false)} />;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[500px]">
        {/* LEFT COLUMN: Search & Picker */}
        <div className="flex flex-col h-full border-r border-border pr-4">
            
            {!pendingProduct ? (
                /* SEARCH MODE */
                <div className="flex flex-col h-full">
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
                        <input 
                            type="text" 
                            autoFocus
                            placeholder="Search product lines..." 
                            value={searchTerm} 
                            onChange={e => setSearchTerm(e.target.value)} 
                            className="w-full p-3 pl-10 bg-background border-2 border-border rounded-lg text-text-primary focus:border-primary outline-none" 
                        />
                    </div>
                    
                    <div className="flex-1 overflow-y-auto space-y-2">
                        {searchTerm.length > 1 && onRequestNewSample && (
                             <div 
                                onClick={() => onRequestNewSample(searchTerm)}
                                className="p-3 mb-2 bg-primary/10 hover:bg-primary/20 border border-primary/30 rounded-lg cursor-pointer flex justify-between items-center group animate-in fade-in"
                            >
                                <div className="flex items-center gap-3">
                                    <PlusCircle size={20} className="text-primary" />
                                    <div>
                                        <p className="font-bold text-primary">Create "{searchTerm}"</p>
                                        <p className="text-xs text-text-secondary">Add this product to library</p>
                                    </div>
                                </div>
                                <ChevronRight size={16} className="text-primary" />
                            </div>
                        )}

                        {searchTerm.length < 2 && (
                            <div className="text-center py-8 text-text-tertiary">
                                <p>Type to search for products...</p>
                                <button type="button" onClick={() => setIsScanning(true)} className="mt-4 flex items-center justify-center gap-2 p-3 bg-surface hover:bg-background border border-border rounded-lg text-primary font-semibold transition-colors mx-auto">
                                    <ScanLine size={20} /> Scan QR Code
                                </button>
                            </div>
                        )}
                        
                        {searchResults.map(product => (
                            <div 
                                key={product.id} 
                                onClick={() => handleProductClick(product)}
                                className="p-3 bg-background hover:bg-surface border border-border rounded-lg cursor-pointer flex justify-between items-center group"
                            >
                                <div>
                                    <p className="font-bold text-text-primary">{product.name}</p>
                                    <p className="text-xs text-text-secondary">{product.manufacturerName}</p>
                                </div>
                                <ChevronRight size={16} className="text-text-tertiary group-hover:text-primary" />
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* VARIANT PICKER MODE */
                <div className="flex flex-col h-full animate-in slide-in-from-right-4 fade-in duration-200">
                    <div className="flex items-center gap-2 mb-4 text-sm text-text-secondary cursor-pointer hover:text-primary" onClick={() => setPendingProduct(null)}>
                        ← Back to Search
                    </div>
                    
                    <div className="bg-surface p-4 rounded-lg border border-border flex-1 flex flex-col gap-4">
                        <div>
                            <h4 className="font-bold text-lg text-text-primary">{pendingProduct.name}</h4>
                            <p className="text-sm text-text-secondary">{pendingProduct.manufacturerName}</p>
                        </div>

                        {/* VARIANT SELECTOR - UNLOCKED & SIMPLIFIED */}
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-1">Select Item</label>
                            {pendingProduct.variants.length === 0 ? (
                                <p className="text-red-500 text-sm">No variants available.</p>
                            ) : (
                            <select 
                                value={selectedVariantId} 
                                onChange={e => setSelectedVariantId(e.target.value)} 
                                className="w-full p-2 bg-background border border-border rounded text-text-primary cursor-pointer"
                            >   
                                {/* Sort: Master first, then alphabetical */}
                                {pendingProduct.variants
                                    .filter(v => v.isMaster || v.hasSample) // Only show if we have a sample (or it's master)
                                    .sort((a, b) => (a.isMaster === b.isMaster) ? 0 : a.isMaster ? -1 : 1)
                                    .map(v => (
                                    <option key={v.id} value={v.id} className={v.isMaster ? 'font-bold' : ''}>
                                        {v.isMaster ? '★ ' : ''}
                                        {v.name} {v.size ? `(${v.size})` : ''} {v.sku ? `- ${v.sku}` : ''}
                                    </option>
                                ))}
                            </select>
                            )}
                        </div>

                        <div className="mt-auto pt-4">
                            <button 
                                onClick={confirmAddItem}
                                className="w-full py-3 bg-primary hover:bg-primary-hover text-on-primary font-bold rounded-lg shadow-md"
                            >
                                Add to Checkout List
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT COLUMN: Checkout List */}
        <div className="flex flex-col h-full bg-background rounded-lg border border-border p-4">
            <h4 className="font-bold text-text-primary mb-4 border-b border-border pb-2">Checkout List ({selectedItems.length})</h4>
            
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                {selectedItems.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-text-tertiary text-sm italic">
                        List is empty. Add items from the left.
                    </div>
                ) : (
                    selectedItems.map((item, idx) => (
                        <div key={`${item.variantId}-${idx}`} className="bg-surface p-3 rounded border border-border flex justify-between items-start">
                            <div>
                                <p className="font-bold text-sm text-text-primary">{item.productName}</p>
                                <p className="text-xs text-text-secondary">{item.variantName}</p>
                                <div className="flex gap-2 mt-1">
                                    <span className="text-xs bg-background border border-border px-1.5 py-0.5 rounded text-text-secondary">{item.sampleType}</span>
                                    <span className="text-xs bg-blue-900/30 text-blue-200 px-1.5 py-0.5 rounded border border-blue-800">Qty: {item.quantity}</span>
                                </div>
                            </div>
                            <button onClick={() => removeItem(idx)} className="text-text-tertiary hover:text-red-400 p-1">
                                <X size={16} />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};

export default SampleSelector;