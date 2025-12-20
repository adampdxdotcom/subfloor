import React, { useState, useEffect, useRef } from 'react';
import { Installer, User } from '../types';
import { Filter, X, Check, Truck, RotateCcw } from 'lucide-react';

interface CalendarFilterProps {
  installers: Installer[];
  users: User[];
  selectedInstallerIds: Set<number>;
  selectedUserIds: Set<string>;
  showDeliveries: boolean;
  onInstallerChange: (newSelectedIds: Set<number>) => void;
  onUserChange: (newSelectedIds: Set<string>) => void;
  onShowDeliveriesChange: (show: boolean) => void;
}

const CalendarFilter: React.FC<CalendarFilterProps> = ({ 
  installers, 
  users, 
  selectedInstallerIds, 
  selectedUserIds,
  showDeliveries,
  onInstallerChange,
  onUserChange,
  onShowDeliveriesChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // --- Mobile State (Drafts) ---
  const [activeTab, setActiveTab] = useState<'installers' | 'users'>('installers');
  const [draftInstallerIds, setDraftInstallerIds] = useState<Set<number>>(new Set());
  const [draftUserIds, setDraftUserIds] = useState<Set<string>>(new Set());
  const [draftShowDeliveries, setDraftShowDeliveries] = useState(true);

  // Initialize draft state when opening
  useEffect(() => {
    if (isOpen) {
      setDraftInstallerIds(new Set(selectedInstallerIds));
      setDraftUserIds(new Set(selectedUserIds));
      setDraftShowDeliveries(showDeliveries);
    }
  }, [isOpen, selectedInstallerIds, selectedUserIds, showDeliveries]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Only check click outside logic if we are on Desktop (dropdown mode)
      // On mobile, the modal is full screen so "outside" clicks aren't really possible/relevant in the same way
      if (window.innerWidth >= 768 && wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  // --- Desktop Handlers (Live Updates) ---
  const handleSelectAllInstallers = () => onInstallerChange(new Set(installers.map(i => i.id)));
  const handleDeselectAllInstallers = () => onInstallerChange(new Set());
  const handleSoloSelectInstaller = (id: number) => onInstallerChange(new Set([id]));
  const handleInstallerToggle = (id: number) => {
    const newIds = new Set(selectedInstallerIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    onInstallerChange(newIds);
  };

  const handleSelectAllUsers = () => onUserChange(new Set(users.map(u => u.userId)));
  const handleDeselectAllUsers = () => onUserChange(new Set());
  const handleSoloSelectUser = (id: string) => onUserChange(new Set([id]));
  const handleUserToggle = (id: string) => {
    const newIds = new Set(selectedUserIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    onUserChange(newIds);
  };

  // --- Mobile Handlers (Draft Updates) ---
  const toggleDraftInstaller = (id: number) => {
    const newSet = new Set(draftInstallerIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setDraftInstallerIds(newSet);
  };

  const toggleDraftUser = (id: string) => {
    const newSet = new Set(draftUserIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setDraftUserIds(newSet);
  };

  const handleSoloDraftInstaller = (id: number) => {
      setDraftInstallerIds(new Set([id]));
  };

  const handleSoloDraftUser = (id: string) => {
      setDraftUserIds(new Set([id]));
  };

  const handleApply = () => {
    onInstallerChange(draftInstallerIds);
    onUserChange(draftUserIds);
    onShowDeliveriesChange(draftShowDeliveries);
    setIsOpen(false);
  };

  const handleResetAll = () => {
    setDraftInstallerIds(new Set(installers.map(i => i.id)));
    setDraftUserIds(new Set(users.map(u => u.userId)));
    setDraftShowDeliveries(true);
  };

  const selectionCount = selectedInstallerIds.size + selectedUserIds.size;

  return (
    <div className="" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-background transition-colors border border-transparent hover:border-border"
        aria-label="Filter calendar"
      >
        <Filter size={20} className="text-primary" />
        <span className="font-medium text-text-primary">Filter</span>
        {selectionCount > 0 && (
            <span className="bg-primary text-on-primary text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {selectionCount}
            </span>
        )}
      </button>

      {isOpen && (
        <>
            {/* ================= DESKTOP VIEW (Dropdown) ================= */}
            <div className="hidden md:block absolute top-full right-0 mt-2 w-72 bg-surface border border-border rounded-lg shadow-xl z-20">
            <div className="max-h-[70vh] overflow-y-auto">
                {/* Global Options */}
                <div className="p-2 border-b border-border">
                  <label className="flex items-center gap-2 p-2 rounded hover:bg-background cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={showDeliveries} 
                      onChange={(e) => onShowDeliveriesChange(e.target.checked)}
                      className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border" 
                    />
                    <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Truck size={14} /> Material Deliveries
                    </span>
                  </label>
                </div>

                {/* Installers Section */}
                <div className="p-3 border-b border-border bg-surface-hover/30">
                  <h4 className="font-semibold text-text-primary text-sm">Installers</h4>
                </div>
                <div className="flex justify-between p-2 bg-surface">
                  <button onClick={handleSelectAllInstallers} className="text-xs text-accent hover:underline">Select All</button>
                  <button onClick={handleDeselectAllInstallers} className="text-xs text-accent hover:underline">Deselect All</button>
                </div>
                <div className="p-1">
                {(installers || []).map(installer => (
                    <label key={`installer-${installer.id}`} className="flex items-center justify-between p-2 rounded hover:bg-background cursor-pointer">
                    <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedInstallerIds.has(installer.id)} onChange={() => handleInstallerToggle(installer.id)} className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border" />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: installer.color || '#6b7280' }} />
                        <span className="text-sm text-text-secondary">{installer.installerName}</span>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); handleSoloSelectInstaller(installer.id); }} className="text-xs text-accent hover:underline px-2">Only</button>
                    </label>
                ))}
                </div>

                {/* Users Section */}
                <div className="p-3 border-b border-t border-border mt-2">
                <h4 className="font-semibold text-text-primary text-sm">Users</h4>
                </div>
                <div className="flex justify-between p-2">
                <button onClick={handleSelectAllUsers} className="text-xs text-accent hover:underline">Select All</button>
                <button onClick={handleDeselectAllUsers} className="text-xs text-accent hover:underline">Deselect All</button>
                </div>
                <div className="p-1">
                {(users || []).map(user => (
                    <label key={`user-${user.userId}`} className="flex items-center justify-between p-2 rounded hover:bg-background cursor-pointer">
                    <div className="flex items-center gap-3">
                        <input type="checkbox" checked={selectedUserIds.has(user.userId)} onChange={() => handleUserToggle(user.userId)} className="h-4 w-4 rounded text-primary focus:ring-primary bg-background border-border" />
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: user.color || '#6b7280' }} />
                        <span className="text-sm text-text-secondary">{user.email}</span>
                    </div>
                    <button onClick={(e) => { e.preventDefault(); handleSoloSelectUser(user.userId); }} className="text-xs text-accent hover:underline px-2">Only</button>
                    </label>
                ))}
                </div>
            </div>
            </div>

            {/* ================= MOBILE VIEW (Full Screen Sheet) ================= */}
            <div className="md:hidden fixed inset-0 bg-surface z-50 flex flex-col animate-in slide-in-from-bottom-5 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-surface">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <Filter size={20} /> Filter Calendar
                    </h2>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-background rounded-full text-text-secondary hover:text-text-primary"><X size={24}/></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-border bg-surface">
                    <button 
                        onClick={() => setActiveTab('installers')}
                        className={`flex-1 py-4 font-semibold text-sm uppercase tracking-wide transition-colors ${activeTab === 'installers' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}
                    >
                        Installers ({draftInstallerIds.size})
                    </button>
                    <button 
                        onClick={() => setActiveTab('users')}
                        className={`flex-1 py-4 font-semibold text-sm uppercase tracking-wide transition-colors ${activeTab === 'users' ? 'border-b-2 border-primary text-primary' : 'text-text-secondary'}`}
                    >
                        Users ({draftUserIds.size})
                    </button>
                </div>

                {/* Options Row */}
                <div className="p-4 bg-background border-b border-border">
                    <div className="flex items-center justify-between bg-surface p-3 rounded-lg border border-border shadow-sm">
                        <span className="font-medium text-text-primary flex items-center gap-2">
                            <Truck size={18} /> Show Deliveries
                        </span>
                        <div 
                            className={`w-12 h-7 rounded-full p-1 cursor-pointer transition-colors ${draftShowDeliveries ? 'bg-primary' : 'bg-gray-300'}`}
                            onClick={() => setDraftShowDeliveries(!draftShowDeliveries)}
                        >
                            <div className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform ${draftShowDeliveries ? 'translate-x-5' : ''}`} />
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 bg-background">
                    {activeTab === 'installers' && (
                        <div className="space-y-2">
                            {installers.map(installer => {
                                const isSelected = draftInstallerIds.has(installer.id);
                                return (
                                    <div key={installer.id} className="flex gap-2">
                                        <button 
                                            onClick={() => toggleDraftInstaller(installer.id)}
                                            className={`flex-1 flex items-center justify-between p-4 rounded-lg border text-left transition-all ${
                                                isSelected 
                                                ? 'bg-primary/10 border-primary shadow-sm' 
                                                : 'bg-surface border-border hover:border-primary/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: installer.color || '#6b7280' }} />
                                                <span className={`font-medium ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                                                    {installer.installerName}
                                                </span>
                                            </div>
                                            {isSelected && <Check size={20} className="text-primary" />}
                                        </button>
                                        <button 
                                            onClick={() => handleSoloDraftInstaller(installer.id)}
                                            className="px-4 font-bold text-xs uppercase tracking-wide text-primary border border-primary/30 rounded-lg hover:bg-primary/5 bg-surface"
                                        >
                                            Only
                                        </button>
                                    </div>
                                );
                            })}
                            {installers.length === 0 && <p className="text-text-secondary text-center p-4">No installers found.</p>}
                        </div>
                    )}

                    {activeTab === 'users' && (
                        <div className="space-y-2">
                            {users.map(user => {
                                const isSelected = draftUserIds.has(user.userId);
                                return (
                                    <div key={user.userId} className="flex gap-2">
                                        <button 
                                            onClick={() => toggleDraftUser(user.userId)}
                                            className={`flex-1 flex items-center justify-between p-4 rounded-lg border text-left transition-all ${
                                                isSelected 
                                                ? 'bg-primary/10 border-primary shadow-sm' 
                                                : 'bg-surface border-border hover:border-primary/50'
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: user.color || '#6b7280' }} />
                                                <span className={`font-medium ${isSelected ? 'text-primary' : 'text-text-primary'}`}>
                                                    {user.email}
                                                </span>
                                            </div>
                                            {isSelected && <Check size={20} className="text-primary" />}
                                        </button>
                                        <button 
                                            onClick={() => handleSoloDraftUser(user.userId)}
                                            className="px-4 font-bold text-xs uppercase tracking-wide text-primary border border-primary/30 rounded-lg hover:bg-primary/5 bg-surface"
                                        >
                                            Only
                                        </button>
                                    </div>
                                );
                            })}
                            {users.length === 0 && <p className="text-text-secondary text-center p-4">No users found.</p>}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-surface border-t border-border flex gap-3">
                    <button 
                        onClick={handleResetAll}
                        className="flex-1 py-3 text-text-primary font-medium hover:bg-background rounded-lg transition-colors border border-border flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={18} /> Reset All
                    </button>
                    <button 
                        onClick={handleApply}
                        className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-lg shadow-md hover:bg-primary-hover transition-colors"
                    >
                        Apply Filters
                    </button>
                </div>
            </div>
        </>
      )}
    </div>
  );
};

export default CalendarFilter;