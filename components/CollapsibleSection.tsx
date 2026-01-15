import React, { useState, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';

interface CollapsibleSectionProps {
  title: string;
  icon: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}

const CollapsibleSection: React.FC<CollapsibleSectionProps> = ({ title, icon, actions, children, defaultOpen = true }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="bg-surface-container-high rounded-2xl shadow-sm border border-outline/10">
      {/* Header */}
      <div 
        className="flex justify-between items-center p-4 cursor-pointer hover:bg-surface-container-highest/50 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex items-center">
          <span className="text-primary mr-4">{icon}</span>
          <h2 className="text-lg font-bold text-text-primary">{title}</h2>
        </div>
        <div className="flex items-center space-x-4">
          {/* Stop propagation on actions so clicking buttons doesn't collapse the section */}
          <div onClick={(e) => e.stopPropagation()}>
            {actions}
          </div>
          <ChevronDown 
            className={`w-6 h-6 text-text-secondary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Collapsible Content */}
      <div 
        className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[2000px]' : 'max-h-0'}`}
      >
        <div className="px-4 pb-4 pt-2 border-t border-outline/10">
          {children}
        </div>
      </div>
    </div>
  );
};

export default CollapsibleSection;