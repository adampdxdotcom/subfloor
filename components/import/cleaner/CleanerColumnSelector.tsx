import React from 'react';
import { ExcelSheetData } from '../../../types';
import { ArrowRight, Loader2 } from 'lucide-react';

interface CleanerColumnSelectorProps {
  data: ExcelSheetData;
  onConfirm: (columnKey: string) => void;
  onBack: () => void;
  isBrainLoading: boolean;
}

export const CleanerColumnSelector: React.FC<CleanerColumnSelectorProps> = ({ data, onConfirm, onBack, isBrainLoading }) => {
  const [selectedCol, setSelectedCol] = React.useState<string | null>(null);

  // Preview first 5 rows
  const previewRows = data.rows.slice(0, 5);

  return (
    <div className="w-full max-w-5xl mx-auto bg-surface-container-high rounded-xl shadow-sm border border-outline/20 overflow-hidden flex flex-col h-[600px]">
      <div className="p-6 border-b border-outline/10 bg-surface-container-low flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Select Description Column</h2>
          <p className="text-sm text-text-secondary mt-1">Which column contains the product name and size info?</p>
        </div>
        <div className="flex gap-3">
            <button 
                onClick={onBack}
                className="px-4 py-2 text-sm font-bold text-text-secondary hover:text-text-primary transition-colors"
            >
                Back
            </button>
            <button
            disabled={!selectedCol || isBrainLoading}
            onClick={() => selectedCol && onConfirm(selectedCol)}
            className={`flex items-center gap-2 px-6 py-2 rounded-full text-sm font-bold transition-all ${
                selectedCol && !isBrainLoading
                ? 'bg-primary text-on-primary hover:bg-primary-hover shadow-sm' 
                : 'bg-surface-container-highest text-text-secondary cursor-not-allowed'
            }`}
            >
            {isBrainLoading ? (
                <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Loading Memory...
                </>
            ) : (
                <>Next: Clean Sizes <ArrowRight className="w-4 h-4" /></>
            )}
            </button>
        </div>
      </div>

      <div className="overflow-auto flex-1 p-6">
        <table className="min-w-full text-sm text-left border-collapse">
          <thead className="text-xs uppercase bg-surface-container sticky top-0 z-10">
            <tr>
              {data.headers.map((header) => (
                <th 
                  key={header} 
                  scope="col" 
                  className={`px-6 py-4 cursor-pointer hover:bg-surface-container-highest border-b-2 transition-colors ${
                      selectedCol === header 
                      ? 'bg-primary-container border-primary text-primary' 
                      : 'border-outline/10 text-text-secondary'
                  }`}
                  onClick={() => setSelectedCol(header)}
                >
                  <div className="flex items-center gap-2">
                    <input 
                      type="radio" 
                      checked={selectedCol === header} 
                      onChange={() => setSelectedCol(header)}
                      className="w-4 h-4 text-primary bg-surface-container border-outline focus:ring-primary accent-primary"
                    />
                    <span className="font-bold tracking-wide">{header}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-outline/10">
            {previewRows.map((row, idx) => (
              <tr key={idx} className="bg-surface-container-high hover:bg-surface-container-highest transition-colors">
                {data.headers.map((header) => (
                  <td 
                      key={`${idx}-${header}`} 
                      className={`px-6 py-4 text-text-secondary ${selectedCol === header ? 'bg-primary-container/20 text-text-primary font-medium' : ''}`}
                  >
                    <div className="truncate max-w-[200px]">
                        {row[header]?.toString() || ''}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};