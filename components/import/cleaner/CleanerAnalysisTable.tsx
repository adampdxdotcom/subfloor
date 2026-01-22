import React, { useState, useMemo, useEffect, useRef } from 'react';
import { ParsedRow, KnownSize } from '../../../types';
import * as sampleService from '../../../services/sampleService'; // Import Service
import { Check, X, AlertCircle, Plus, ArrowRight, Save, MousePointerClick, GripVertical, RefreshCw, Search, Box } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface CleanerAnalysisTableProps {
  rows: ParsedRow[];
  knownSizes: KnownSize[];
  setRows: React.Dispatch<React.SetStateAction<ParsedRow[]>>;
  setKnownSizes: React.Dispatch<React.SetStateAction<KnownSize[]>>;
  onExport: () => void;
  onReset: () => void;
  mode: 'SIZES' | 'NAMES' | 'PRICES'; // New Prop
  knownProductAliases: any[];
}

interface SelectionState {
    id: string;
    text: string;
    x: number;
    y: number;
}

export const CleanerAnalysisTable: React.FC<CleanerAnalysisTableProps> = ({ 
  rows, 
  knownSizes, 
  setRows, 
  setKnownSizes, 
  onExport,
  onReset,
  mode,
  knownProductAliases
}) => {
  const [filter, setFilter] = useState<'ALL' | 'MATCHED' | 'UNKNOWN'>('ALL');
  const [selection, setSelection] = useState<SelectionState | null>(null);
  
  // Editing state for known sizes
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // NAME CLEANER STATE
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<string[]>([]);

  const tableRef = useRef<HTMLDivElement>(null);

  const getRowState = (row: ParsedRow) => {
      if (mode === 'SIZES') {
          return { targetText: row.sizeTargetText || '', status: row.sizeStatus || 'UNKNOWN', value: row.extractedSize || '' };
      }
      if (mode === 'NAMES') {
          return { targetText: row.nameTargetText || '', status: row.nameStatus || 'UNKNOWN', value: row.extractedName || '' };
      }
      if (mode === 'PRICES') {
          return { targetText: row.priceTargetText || '', status: row.priceStatus || 'UNKNOWN', value: row.extractedPrice || '' };
      }
      return { targetText: '', status: 'UNKNOWN', value: '' };
  };

  // Fetch product names for sidebar
  useEffect(() => {
      if (mode !== 'NAMES') { setProductResults([]); return; }
      
      const delayDebounce = setTimeout(() => {
          if (!productSearch) { setProductResults([]); return; }
          sampleService.searchProductNames(productSearch).then(names => {
              setProductResults(names);
          });
      }, 300);

      return () => clearTimeout(delayDebounce);
  }, [productSearch, mode]);

  const stats = useMemo(() => ({
    total: rows.length,
    matched: rows.filter(r => getRowState(r).status === 'MATCHED').length,
    unknown: rows.filter(r => getRowState(r).status === 'UNKNOWN' || getRowState(r).status === 'NEW').length,
  }), [rows, mode]);

  const filteredRows = useMemo(() => {
    let result = rows.filter(row => {
        const { status } = getRowState(row);
        if (filter === 'ALL') return true;
        if (filter === 'MATCHED') return status === 'MATCHED';
        if (filter === 'UNKNOWN') return status === 'UNKNOWN' || status === 'NEW';
        return true;
    });

    // GROUPING LOGIC FOR NAMES MODE
    if (mode === 'NAMES') {
        const groups = new Map();
        result.forEach(row => {
            const key = getRowState(row).targetText;
            if (key && !groups.has(key)) {
                groups.set(key, { ...row, count: 1 });
            } else if (key) {
                groups.get(key).count++;
            }
        });
        return Array.from(groups.values());
    }

    return result;
  }, [rows, filter, mode]);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
        if ((e.target as HTMLElement).closest('.selection-tooltip')) return;
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed) {
            setSelection(null);
        }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleTextMouseUp = (e: React.MouseEvent, rowId: string) => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;

      const text = sel.toString().trim();
      if (text.length > 0) {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          setSelection({
              id: rowId,
              text: text,
              x: rect.left + (rect.width / 2),
              y: rect.top - 10
          });
      }
  };

  const applySelectionAsSize = () => {
      if (!selection) return;
      
      setRows(prev => prev.map(row => {
          if (row.id !== selection.id) return row;
          // Check if this selected text happens to be a known size already
          const isKnown = knownSizes.some(k => k.label.toLowerCase() === selection!.text.toLowerCase());
          
          return {
              ...row,
              extractedSize: selection.text, 
              sizeSelectionSource: selection.text,
              sizeStatus: isKnown ? 'MATCHED' : 'NEW',
              manualOverride: true
          }
      }));
      
      setSelection(null);
      window.getSelection()?.removeAllRanges();
  };

  const handleUpdateRowValue = (id: string, newValue: string, targetText: string) => {
    if (mode === 'NAMES') {
        setRows(prev => prev.map(r => {
            if (getRowState(r).targetText === targetText) {
                return { 
                    ...r, 
                    extractedName: newValue,
                    nameStatus: newValue ? 'NEW' : 'UNKNOWN',
                    manualOverride: true 
                };
            }
            return r;
        }));
    } else { // SIZES MODE
        setRows(prev => prev.map(row => {
            if (row.id !== id) return row;
            
            const normalizedNew = newValue.toLowerCase().trim();
            const isKnown = knownSizes.some(k => k.label.toLowerCase() === normalizedNew);
            
            return {
              ...row,
              extractedSize: newValue, 
              sizeStatus: isKnown ? 'MATCHED' : 'NEW',
              manualOverride: true
            };
          }));
    }
  };

  const handleAddToKnown = (row: ParsedRow) => {
    const { value, targetText } = getRowState(row);
    if (!value) return;
    
    const cleanValue = value.trim();
    
    // --- MODE: NAMES ---
    if (mode === 'NAMES') {
        const aliasText = targetText; // The raw messy name
        
        // Save to DB
        sampleService.createProductAlias(aliasText, cleanValue)
            .then(() => toast.success(`Learned: "${aliasText}" -> "${cleanValue}"`))
            .catch(() => toast.error("Failed to save naming rule"));

        // Update UI: Find all rows with this exact raw text and update them
        setRows(prev => prev.map(r => {
            if (getRowState(r).targetText === aliasText) {
                return { ...r, extractedName: cleanValue, nameStatus: 'MATCHED' };
            }
            return r;
        }));
        return;
    }

    // --- MODE: SIZES (Legacy Logic) ---
    // Check if this size already exists in our known list
    const existingIndex = knownSizes.findIndex(k => k.label.toLowerCase() === cleanValue.toLowerCase());
    
    let updatedKnownSizes = [...knownSizes];
    const matchersToAdd: string[] = [];

    // If we have a selection source (e.g. "M122") that is different from the final label ("2x2")
    if (row.sizeSelectionSource && row.sizeSelectionSource.toLowerCase() !== cleanValue.toLowerCase()) {
        matchersToAdd.push(row.sizeSelectionSource);
    }

    if (existingIndex >= 0) {
        // Size exists! We might be adding a new alias to it.
        const existing = updatedKnownSizes[existingIndex];
        const uniqueNewMatchers = matchersToAdd.filter(m => 
            !existing.matchers?.some(em => em.toLowerCase() === m.toLowerCase()) &&
            m.toLowerCase() !== existing.label.toLowerCase()
        );

        if (uniqueNewMatchers.length > 0) {
             updatedKnownSizes[existingIndex] = {
                 ...existing,
                 matchers: [...(existing.matchers || []), ...uniqueNewMatchers]
             };
        }
    } else {
        // New Size entirely
        updatedKnownSizes.push({ 
            id: Date.now().toString(), 
            label: cleanValue,
            matchers: matchersToAdd 
        });
    }

    setKnownSizes(updatedKnownSizes);
    
    const aliasToSave = row.sizeSelectionSource || targetText;
    if (aliasToSave && aliasToSave.toLowerCase() !== cleanValue.toLowerCase()) {
        sampleService.createSizeAlias(aliasToSave, cleanValue)
            .then(() => toast.success(`Learned: "${aliasToSave}" = "${cleanValue}"`))
            .catch(() => toast.error("Failed to save rule."));
    }
    
    sampleService.createSize(cleanValue).catch(() => {}); 

    // Auto-update ALL rows (Rescan logic for sizes)
    const scanTargets = [cleanValue, ...matchersToAdd];
    const nakedLabel = cleanValue.replace(/["']/g, ''); 
    const parts = nakedLabel.split('x'); 
    let dimensionRegex: RegExp | null = null;
    if (parts.length === 2 && !isNaN(parseFloat(parts[0]))) {
         dimensionRegex = new RegExp(`\\b${parts[0].trim()}\\s*x\\s*${parts[1].trim()}\\b`, 'i');
    }

    setRows(prev => prev.map(r => {
      const { status, value: rowValue, targetText: rowTarget } = getRowState(r);
      if (rowValue === cleanValue) return { ...r, sizeStatus: 'MATCHED' };
      
      if (status === 'NEW' && rowValue?.toLowerCase() === cleanValue.toLowerCase()) {
         return { ...r, extractedSize: cleanValue, sizeStatus: 'MATCHED' };
      }

      if (status === 'UNKNOWN' || !rowValue) {
          const textLower = (rowTarget || '').toLowerCase();
          if (scanTargets.some(t => textLower.includes(t.toLowerCase()))) {
               return { ...r, extractedSize: cleanValue, sizeStatus: 'MATCHED' };
          }
          if (dimensionRegex && dimensionRegex.test(rowTarget || '')) {
              return { ...r, extractedSize: cleanValue, sizeStatus: 'MATCHED' };
          }
      }
      return r;
    }));
  };

  const startEditing = (size: KnownSize) => {
    setEditingId(size.id);
    setEditValue(size.label);
  };

  const saveEditing = (id: string, oldLabel: string) => {
    if (editingId !== id) return;

    const newLabel = editValue.trim();
    if (!newLabel) {
        setEditingId(null);
        return;
    }

    if (newLabel === oldLabel) {
        setEditingId(null);
        return;
    }

    setKnownSizes(prev => prev.map(k => k.id === id ? { ...k, label: newLabel } : k));
    
    setRows(prev => prev.map(row => {
        if (row.extractedSize === oldLabel) { // Only affects sizes
            return { ...row, extractedSize: newLabel };
        }
        return row;
    }));
    
    setEditingId(null);
  };

  return (
    <div className="flex flex-col h-screen max-h-[85vh] bg-surface-container-high rounded-xl shadow-sm border border-outline/20 overflow-hidden relative">
      
      {/* Selection Tooltip */}
      {selection && (
          <div 
            className="fixed z-50 transform -translate-x-1/2 -translate-y-full mb-2 selection-tooltip"
            style={{ left: selection.x, top: selection.y }}
          >
              <button
                onClick={applySelectionAsSize}
                className="bg-text-primary text-background text-xs font-bold py-1.5 px-3 rounded-lg shadow-lg flex items-center gap-1 hover:brightness-110 transition-colors"
              >
                  <MousePointerClick className="w-3 h-3" />
                  Set as Size
              </button>
              <div className="w-2 h-2 bg-text-primary transform rotate-45 absolute bottom-[-4px] left-1/2 -translate-x-1/2"></div>
          </div>
      )}

      {/* Toolbar */}
      <div className="p-4 border-b border-outline/10 bg-surface-container-low flex flex-wrap gap-4 justify-between items-center">
        <div className="flex gap-2">
            <button 
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 text-sm font-bold rounded-full transition-colors border ${
                    filter === 'ALL' 
                    ? 'bg-primary-container text-primary border-primary' 
                    : 'text-text-secondary border-transparent hover:bg-surface-container-highest'
                }`}
            >
                All ({stats.total})
            </button>
            <button 
                onClick={() => setFilter('MATCHED')}
                className={`px-3 py-1.5 text-sm font-bold rounded-full transition-colors border ${
                    filter === 'MATCHED' 
                    ? 'bg-success-container text-success border-success' 
                    : 'text-text-secondary border-transparent hover:bg-surface-container-highest'
                }`}
            >
                Matched ({stats.matched})
            </button>
            <button 
                onClick={() => setFilter('UNKNOWN')}
                className={`px-3 py-1.5 text-sm font-bold rounded-full transition-colors border ${
                    filter === 'UNKNOWN' 
                    ? 'bg-warning-container text-warning border-warning' 
                    : 'text-text-secondary border-transparent hover:bg-surface-container-highest'
                }`}
            >
                Review Needed ({stats.unknown})
            </button>
        </div>

        <div className="flex gap-2">
             <button 
                onClick={onExport}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-on-primary text-sm font-bold rounded-full hover:bg-primary-hover shadow-sm transition-colors"
            >
               Use This Data <ArrowRight className="w-4 h-4" />
            </button>
             <button 
                onClick={onReset}
                className="flex items-center gap-2 px-3 py-2 border border-outline/20 text-text-secondary text-sm font-bold rounded-full hover:bg-surface-container-highest transition-colors"
            >
               Start Over
            </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative" ref={tableRef}>
        {/* Main Table */}
        <div className="flex-1 overflow-auto bg-surface-container">
            <table className="min-w-full divide-y divide-outline/10">
                <thead className="bg-surface-container sticky top-0 z-10 shadow-sm">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider">Original Description</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider w-48">
                            {mode === 'SIZES' ? 'Extracted Size' : mode === 'NAMES' ? 'Mapped Name' : 'Clean Price'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider w-32">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-bold text-text-secondary uppercase tracking-wider w-32">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-surface-container-high divide-y divide-outline/10">
                    {filteredRows.map((row) => {
                        const { targetText, status, value } = getRowState(row);
                        return (
                        <tr key={`${row.id}-${mode}`} className={`group/row transition-colors ${status === 'UNKNOWN' ? 'bg-warning-container/5' : 'hover:bg-surface-container-highest/30'}`}>
                            <td 
                                className="px-6 py-4 text-sm text-text-primary break-words max-w-md cursor-text relative"
                                onMouseUp={(e) => handleTextMouseUp(e, row.id)}
                            >
                                <span className="font-medium opacity-90">{targetText}</span>
                                {/* Group Count Badge */}
                                {(row as any).count > 1 && (
                                    <span className="ml-3 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-surface-container-highest text-text-secondary border border-outline/10 shadow-sm">
                                        x{(row as any).count}
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                <input 
                                    type="text" 
                                    value={value}
                                    onChange={(e) => handleUpdateRowValue(row.id, e.target.value, targetText)}
                                    onDragOver={(e) => {
                                        e.preventDefault();
                                        e.dataTransfer.dropEffect = 'copy';
                                    }}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const droppedValue = e.dataTransfer.getData('application/size') || e.dataTransfer.getData('application/product-name');
                                        if (droppedValue) handleUpdateRowValue(row.id, droppedValue, targetText);
                                    }}
                                    className={`w-full px-4 py-2 text-sm border rounded-full focus:ring-2 focus:ring-offset-0 outline-none transition-all shadow-sm ${
                                        status === 'MATCHED' 
                                            ? 'border-success/30 bg-success-container/30 text-text-primary focus:ring-success/50' 
                                            : status === 'NEW' 
                                                ? 'border-primary/30 bg-primary-container/30 text-text-primary focus:ring-primary/50' 
                                                : 'border-transparent bg-surface-container-highest text-text-primary focus:bg-surface-container focus:border-primary/30 focus:ring-primary/50'
                                    }`}
                                    placeholder={mode === 'NAMES' ? 'Drag or type name...' : '?'}
                                />
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                                {status === 'MATCHED' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-success-container text-success">
                                        <Check className="w-3 h-3 mr-1" /> Match
                                    </span>
                                )}
                                {status === 'NEW' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-primary-container text-primary">
                                        <AlertCircle className="w-3 h-3 mr-1" /> New Entry
                                    </span>
                                )}
                                {status === 'UNKNOWN' && (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-warning-container text-warning">
                                        <X className="w-3 h-3 mr-1" /> Missing
                                    </span>
                                )}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-text-secondary">
                                {(status === 'NEW' || (status === 'MATCHED' && row.manualOverride)) && (
                                    <button 
                                        onClick={() => handleAddToKnown(row)}
                                        className="text-primary hover:text-primary-hover flex items-center text-xs font-bold uppercase tracking-wide"
                                        title={row.manualOverride ? `Update rule for "${value}"` : `Add "${value}" to memory`}
                                    >
                                        {row.manualOverride ? (
                                            <><RefreshCw className="w-3 h-3 mr-1" /> Change Rule</>
                                        ) : (
                                            <><Plus className="w-3 h-3 mr-1" /> Learn Rule</>
                                        )}
                                    </button>
                                )}
                            </td>
                        </tr>
                    )})}
                    {filteredRows.length === 0 && (
                        <tr>
                            <td colSpan={4} className="px-6 py-12 text-center text-text-secondary">
                                No rows found for this filter.
                            </td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>

        {/* Sidebar: Known Sizes (Only in SIZES mode) */}
        {mode === 'SIZES' && (
        <div className="w-64 bg-surface-container-high border-l border-outline/10 flex flex-col shadow-xl z-20">
            <div className="p-4 border-b border-outline/10 bg-surface-container-low">
                <h3 className="font-bold text-text-primary flex items-center gap-2">
                    <Save className="w-4 h-4" /> Known Sizes
                </h3>
                <p className="text-xs text-text-secondary mt-1">Drag size to row to apply.</p>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {knownSizes.map((size) => (
                    <div 
                        key={size.id} 
                        draggable={!editingId}
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/size', size.label);
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className={`group flex items-center justify-between px-3 py-2 text-sm text-text-primary bg-surface-container-highest rounded-lg hover:bg-surface-container transition-colors ${!editingId ? 'cursor-grab active:cursor-grabbing' : ''}`}
                    >
                        {editingId === size.id ? (
                            <input 
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={() => saveEditing(size.id, size.label)}
                                onKeyDown={(e) => {
                                    if(e.key === 'Enter') saveEditing(size.id, size.label);
                                    if(e.key === 'Escape') setEditingId(null);
                                }}
                                className="w-full bg-surface-container border border-primary rounded px-1 py-0.5 outline-none text-sm text-text-primary"
                            />
                        ) : (
                            <>
                                <div className="flex items-center flex-1 gap-2 overflow-hidden">
                                    <GripVertical className="w-3 h-3 text-text-secondary flex-shrink-0" />
                                    <span 
                                        className="font-mono cursor-pointer hover:text-primary truncate"
                                        onClick={() => startEditing(size)}
                                        title="Click to edit"
                                    >
                                        {size.label}
                                    </span>
                                </div>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setKnownSizes(prev => prev.filter(k => k.id !== size.id));
                                    }}
                                    className="opacity-0 group-hover:opacity-100 text-text-secondary hover:text-error ml-2"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </>
                        )}
                    </div>
                ))}
            </div>
             <div className="p-4 border-t border-outline/10 bg-surface-container-low">
                 <form 
                    onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.target as HTMLFormElement;
                        const input = form.elements.namedItem('newSize') as HTMLInputElement;
                        if (input.value) {
                            handleAddToKnown({ 
                                id: Date.now().toString(),
                                originalData: {},
                                extractedSize: input.value, sizeTargetText: input.value, sizeStatus: 'NEW'
                            } as ParsedRow);
                            input.value = '';
                        }
                    }}
                    className="flex gap-2"
                 >
                     <input 
                         name="newSize" 
                         className="flex-1 px-3 py-1.5 text-sm bg-surface-container border border-outline/20 rounded-md text-text-primary focus:border-primary focus:ring-1 focus:ring-primary outline-none" 
                         placeholder="Add size..." 
                     />
                     <button type="submit" className="p-1.5 bg-primary text-on-primary rounded-md hover:bg-primary-hover">
                         <Plus className="w-4 h-4" />
                     </button>
                 </form>
             </div>
        </div>
        )}

        {/* Sidebar: Existing Products (NAMES mode) */}
        {mode === 'NAMES' && (
        <div className="w-72 bg-surface-container-high border-l border-outline/10 flex flex-col shadow-xl z-20">
            <div className="p-4 border-b border-outline/10 bg-surface-container-low space-y-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-bold text-text-primary flex items-center gap-2">
                        <Box className="w-4 h-4" /> Existing Products
                    </h3>
                    <span className="text-[10px] bg-surface-container-highest px-2 py-0.5 rounded-full text-text-secondary font-mono">
                        {productResults.length}
                    </span>
                </div>
                
                <div className="relative group">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary group-focus-within:text-primary transition-colors" />
                    <input 
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        placeholder="Search products..." 
                        className="w-full pl-9 pr-3 py-2 text-sm bg-surface-container border border-transparent focus:border-primary/20 rounded-lg text-text-primary focus:bg-surface-container-high focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                </div>
            </div>

            <div className="overflow-y-auto flex-1 p-2 space-y-1">
                {productResults.map((name, i) => (
                    <div 
                        key={i} 
                        draggable
                        onDragStart={(e) => {
                            e.dataTransfer.setData('application/product-name', name);
                            e.dataTransfer.effectAllowed = 'copy';
                        }}
                        className="group flex items-center justify-between px-3 py-2 text-sm text-text-primary bg-surface-container-highest rounded-lg hover:bg-surface-container transition-colors cursor-grab active:cursor-grabbing border border-transparent hover:border-outline/10"
                    >
                        <div className="flex items-center flex-1 gap-2 overflow-hidden">
                            <GripVertical className="w-3 h-3 text-text-secondary flex-shrink-0 opacity-50 group-hover:opacity-100 transition-opacity" />
                            <span className="font-medium truncate">{name}</span>
                        </div>
                    </div>
                ))}
                
                {productResults.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center text-text-secondary px-6">
                        <Search className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-xs">No products found matching "{productSearch}"</p>
                    </div>
                )}
            </div>
        </div>
        )}
      </div>
    </div>
  );
};

export default CleanerAnalysisTable;