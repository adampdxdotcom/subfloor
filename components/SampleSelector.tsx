import React, { useState, useMemo, useEffect } from 'react';
import { useProducts } from '../hooks/useProducts';
import { useSampleCheckouts } from '../hooks/useSampleCheckouts';
import { Product, ProductVariant, SAMPLE_TYPES, SampleType } from '../types';
import { Layers, ScanLine, X, Search, PlusCircle, ChevronRight, AlertCircle, Lock } from 'lucide-react';
import { toast } from 'react-hot-toast';
import QrScanner from './QrScanner';

export interface CheckoutItem {
    variantId: string;
    interestVariantId: string;
    productName: string;
    variantName: string;
    interestName: string;
    manufacturerName?: string;
    sampleType: SampleType;
    quantity: number;
}

interface SampleSelectorProps {
  onItemsChange: (items: CheckoutItem[]) => void;
  onRequestNewSample?: (searchTerm: string) => void;
  externalSelectedProduct?: Product | null;
}

const SampleSelector: React.FC<SampleSelectorProps> = ({ onItemsChange, onRequestNewSample, externalSelectedProduct }) => {
  const { data: products = [] } = useProducts();
  const { data: sampleCheckouts = [] } = useSampleCheckouts();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItems, setSelectedItems] = useState<CheckoutItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  const [pendingProduct, setPendingProduct] = useState<Product | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');
  const [interestVariantId, setInterestVariantId] = useState<string>('');

  // Helper type for search results
  type SearchResult = 
    | { type: 'variant'; product: Product; variant: ProductVariant } // Direct Physical Sample
    | { type: 'master'; product: Product; variant: ProductVariant }  // Generic Product Line Match (Board)
    | { type: 'virtual'; product: Product; physical: ProductVariant; interest: ProductVariant }; // Specific Variant via Board

  // INVENTORY CHECK: Set of Variant IDs that are currently OUT
  const checkedOutVariantIds = useMemo(() => {
      const outIds = new Set<string>();
      sampleCheckouts.forEach(checkout => {
          if (checkout.actualReturnDate === null) {
              outIds.add(String(checkout.variantId));
          }
      });
      return outIds;
  }, [sampleCheckouts]);

  const searchResults = useMemo<SearchResult[]>(() => {
    if (searchTerm.length < 2) return [];
    const term = searchTerm.toLowerCase();
    const results: SearchResult[] = [];

    products.forEach(p => {
        if (p.isDiscontinued) return;

        const master = p.variants.find(v => v.isMaster);
        const pNameMatch = p.name.toLowerCase().includes(term);
        const manuMatch = (p.manufacturerName || '').toLowerCase().includes(term);

        // Iterate all variants to find text matches
        p.variants.forEach(v => {
            if (v.isMaster) return; // Skip master itself in text search

            const matchName = (v.name || '').toLowerCase().includes(term);
            const matchSku = (v.sku || '').toLowerCase().includes(term);

            if (matchName || matchSku) {
                if (v.hasSample) {
                    // Case A: Specific variant HAS a physical sample
                    results.push({ type: 'variant', product: p, variant: v });
                } else if (master) {
                    // Case B: Specific variant matched, NO sample, but can be ordered via Master Board
                    results.push({ type: 'virtual', product: p, physical: master, interest: v });
                }
            }
        });

        // Case C: Generic Product Match (only if Master Board exists)
        // We only add this if the Parent Name matches, to avoid cluttering if we already showed specific variants
        if (master && (pNameMatch || manuMatch)) {
             // Deduplicate: Don't show generic result if it's covered by specific 'virtual' results? 
             // Actually, usually helpful to show the "Full Line" option too.
             results.push({ type: 'master', product: p, variant: master });
        }
    });

    return results;
  }, [searchTerm, products]);

  useEffect(() => {
    onItemsChange(selectedItems);
  }, [selectedItems, onItemsChange]);

  useEffect(() => {
      if (externalSelectedProduct) {
          setPendingProduct(externalSelectedProduct);
          setInterestVariantId('');
          if (externalSelectedProduct.variants.length > 0) {
             const master = externalSelectedProduct.variants.find(v => v.isMaster);
             setSelectedVariantId(master ? master.id : externalSelectedProduct.variants[0].id);
          } else {
             setSelectedVariantId(''); 
          }
      }
  }, [externalSelectedProduct]);

  const handleResultClick = (result: SearchResult) => {
      // SCENARIO 1: Direct Add (Physical Sample Exists)
      if (result.type === 'variant') {
          if (checkedOutVariantIds.has(String(result.variant.id))) {
              toast.error("This sample is currently checked out.");
              return;
          }
          
          const newItem: CheckoutItem = {
              variantId: result.variant.id,
              interestVariantId: result.variant.id,
              productName: result.product.name,
              variantName: result.variant.name || result.variant.size || 'Default',
              interestName: result.variant.name || result.variant.size || 'Default',
              manufacturerName: result.product.manufacturerName || '',
              sampleType: 'Sample',
              quantity: 1
          };
          addCheckoutItem(newItem);
          setSearchTerm('');
      } 
      // SCENARIO 2: Virtual Add (Variant Interest via Master Board)
      else if (result.type === 'virtual') {
          if (checkedOutVariantIds.has(String(result.physical.id))) {
              toast.error("The Master Board for this item is checked out.");
              return;
          }

          const newItem: CheckoutItem = {
              variantId: result.physical.id, // The Board
              interestVariantId: result.interest.id, // The Specific Style
              productName: result.product.name,
              variantName: result.physical.name || 'Master Board',
              interestName: result.interest.name || result.interest.size || 'Default',
              manufacturerName: result.product.manufacturerName || '',
              sampleType: 'Board',
              quantity: 1
          };
          addCheckoutItem(newItem);
          setSearchTerm('');
      }
      // SCENARIO 3: Generic Master Board (User must pick interest)
      else {
          setPendingProduct(result.product);
          setSelectedVariantId(result.variant.id); // Physical item is the master board
          setInterestVariantId(''); // User must pick this
      }
  };

  const addCheckoutItem = (newItem: CheckoutItem) => {
      const existingIndex = selectedItems.findIndex(i => i.variantId === newItem.variantId && i.interestVariantId === newItem.interestVariantId);
      if (existingIndex >= 0) {
          toast.error("Item already in list.");
      } else {
          setSelectedItems(prev => [...prev, newItem]);
          toast.success(`Added ${newItem.interestName}`);
      }
  };

  const confirmAddItem = () => {
      if (!pendingProduct || !selectedVariantId || !interestVariantId) return;

      const variant = pendingProduct.variants.find(v => v.id === selectedVariantId);
      const interestVariant = pendingProduct.variants.find(v => v.id === interestVariantId);
      
      if (!variant || !interestVariant) return;
      
      // Final sanity check before adding
      if (checkedOutVariantIds.has(String(variant.id))) {
          toast.error("This physical sample is currently checked out.");
          return;
      }

      const newItem: CheckoutItem = {
          variantId: variant.id,
          interestVariantId: interestVariant.id,
          productName: pendingProduct.name,
          variantName: variant.name || variant.size || 'Default',
          interestName: interestVariant.name || interestVariant.size || 'Default',
          manufacturerName: pendingProduct.manufacturerName || '',
          sampleType: variant.isMaster ? 'Board' : 'Sample', 
          quantity: 1
      };

      addCheckoutItem(newItem);
      setPendingProduct(null);
      setSearchTerm('');
  };

  const removeItem = (index: number) => {
      setSelectedItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleScanSuccess = (decodedText: string) => {
    setIsScanning(false);
    let variantId = '';
    let productId = '';
    
    try {
        if (decodedText.includes('?')) {
            const url = new URL(decodedText);
            variantId = url.searchParams.get('variantId') || ''; 
            productId = url.searchParams.get('productId') || '';
        } else {
            variantId = decodedText;
        }

        if (!variantId && !productId) throw new Error("Could not parse ID");

        let foundProduct: Product | undefined;
        
        if (productId) {
            foundProduct = products.find(p => String(p.id) === String(productId));
        } else if (variantId) {
            // Check inventory before finding product
            if (checkedOutVariantIds.has(String(variantId))) {
                toast.error("This sample is already checked out!");
                return;
            }
            
            for (const p of products) {
                if (p.variants.some(v => String(v.id) === String(variantId))) {
                    foundProduct = p;
                    break;
                }
            }
        }

        if (foundProduct) {
            setPendingProduct(foundProduct);
            if (variantId) {
                setSelectedVariantId(variantId);
                setInterestVariantId(variantId);
            } else {
                const master = foundProduct.variants.find(v => v.isMaster);
                if (master) setSelectedVariantId(master.id);
                setInterestVariantId(''); 
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
        {/* LEFT COLUMN */}
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
                        
                        {searchResults.map((result, idx) => (
                            <div 
                                key={`${result.product.id}-${idx}`} 
                                onClick={() => handleResultClick(result)}
                                className="p-3 bg-background hover:bg-surface border border-border rounded-lg cursor-pointer flex justify-between items-center group"
                            >
                                <div>
                                    {result.type === 'variant' ? (
                                        <>
                                            <p className="font-bold text-md text-text-primary">{result.variant.name}</p>
                                            <p className="text-xs text-text-secondary">{result.product.name} • {result.variant.size || 'Sample'}</p>
                                        </>
                                    ) : result.type === 'virtual' ? (
                                        <>
                                            <p className="font-bold text-md text-text-primary">{result.interest.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-tertiary/10 text-tertiary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Via Board</span>
                                                <p className="text-xs text-text-secondary">{result.product.name}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <p className="font-bold text-lg text-text-primary">{result.product.name}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Board</span>
                                                <p className="text-xs text-text-secondary">Full Line Sample</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Check availability of physical item (variant for 'variant', physical for 'virtual', variant for 'master') */}
                                    {checkedOutVariantIds.has(String(result.type === 'virtual' ? result.physical.id : result.variant.id)) && (
                                        <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-1 rounded-full">OUT</span>
                                    )}
                                    <ChevronRight size={16} className="text-text-tertiary group-hover:text-primary" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                /* VARIANT PICKER MODE (UPDATED) */
                <div className="flex flex-col h-full animate-in slide-in-from-right-4 fade-in duration-200">
                    
                    <div className="bg-surface p-4 rounded-lg border border-border flex-1 flex flex-col gap-4">
                        <div>
                            <h4 className="font-bold text-lg text-text-primary">{pendingProduct.name}</h4>
                            <p className="text-sm text-text-secondary">{pendingProduct.manufacturerName}</p>
                            
                            {/* Physical Sample Selector (Visible if multiple samples exist) */}
                            <div className="mt-2">
                                <label className="block text-xs font-bold text-text-secondary mb-1">Physical Item</label>
                                <select 
                                    value={selectedVariantId} 
                                    onChange={e => setSelectedVariantId(e.target.value)} 
                                    className="w-full p-2 bg-surface-container rounded border border-outline/20 text-sm font-medium"
                                >
                                    {pendingProduct.variants
                                        .filter(v => v.isMaster || v.hasSample)
                                        .sort((a, b) => (a.isMaster === b.isMaster) ? 0 : a.isMaster ? -1 : 1)
                                        .map(v => (
                                            <option key={v.id} value={v.id}>
                                                {v.name} {v.isMaster ? '(Master Board)' : '(Sample)'}
                                            </option>
                                        ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                            <label className="block text-sm font-bold text-text-primary mb-1">
                                Choose Variant <span className="text-red-500">*</span>
                            </label>
                            {pendingProduct.variants.length === 0 ? (
                                <p className="text-red-500 text-sm">No variants available.</p>
                            ) : (
                            <select 
                                value={interestVariantId} 
                                onChange={e => setInterestVariantId(e.target.value)} 
                                size={5}
                                className="w-full flex-1 p-2 bg-background border-2 border-primary/20 focus:border-primary rounded text-text-primary cursor-pointer"
                            >   
                                <option value="" disabled className="text-text-tertiary">-- Select an option --</option>
                                {pendingProduct.variants
                                    .filter(v => !v.isMaster) 
                                    .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                    .map(v => {
                                        // NOTE: We check inventory on the physical sample (v.id), 
                                        // but logic says we select INTEREST here. 
                                        // If this variant *is* the sample (Inventory V2 logic), we lock it.
                                        const isOut = checkedOutVariantIds.has(String(v.id));
                                        
                                        return (
                                    <option key={v.id} value={v.id} disabled={isOut} className={`py-1 flex justify-between ${isOut ? 'text-red-400 opacity-70 bg-red-500/10' : ''}`}>
                                        {v.name} {v.size ? `(${v.size})` : ''} {isOut ? '(Out)' : ''}
                                    </option>
                                        );
                                    })}
                            </select>
                            )}
                            {!interestVariantId && (
                                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                                    <AlertCircle size={12} /> Selection required
                                </p>
                            )}
                        </div>

                        {/* Updated Footer Actions */}
                        <div className="mt-auto pt-4 flex gap-3">
                            <button 
                                onClick={() => setPendingProduct(null)} 
                                className="flex-1 py-3 bg-secondary hover:bg-secondary-hover text-on-secondary font-medium rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={confirmAddItem}
                                disabled={!interestVariantId || checkedOutVariantIds.has(selectedVariantId)} // Disable if physical sample is out
                                className="flex-[2] py-3 bg-primary hover:bg-primary-hover disabled:bg-gray-400 text-on-primary font-bold rounded-lg shadow-md transition-all whitespace-nowrap"
                            >
                                {interestVariantId ? 'Add to List' : 'Select a Style'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* RIGHT COLUMN */}
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
                                <div className="flex items-center gap-1 mt-1">
                                    <span className="text-xs text-text-secondary">Interested in:</span>
                                    <span className="text-sm font-bold text-primary">{item.interestName}</span>
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