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
    <div className="relative" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest transition-colors border border-outline/10 hover:border-outline/20 shadow-sm"
        aria-label="Filter calendar"
      >
        <Filter size={20} className="text-primary" />
        <span className="font-medium text-text-primary">Filter</span>
        {selectionCount > 0 && (
            <span className="bg-primary text-on-primary text-xs font-bold rounded-full min-w-[20px] h-5 px-1 flex items-center justify-center">
                {selectionCount}
            </span>
        )}
      </button>

      {isOpen && (
        <>
            {/* ================= DESKTOP VIEW (Dropdown) ================= */}
            <div className="hidden md:block absolute top-full right-0 mt-2 w-80 bg-surface-container-high border border-outline/10 rounded-xl shadow-2xl z-20 overflow-hidden ring-1 ring-black/5">
            <div className="max-h-[70vh] overflow-y-auto">
                {/* Global Options */}
                <div className="p-3 border-b border-outline/10 bg-surface-container-low">
                  <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-highest cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={showDeliveries} 
                      onChange={(e) => onShowDeliveriesChange(e.target.checked)}
                      className="h-5 w-5 rounded border-outline/20 text-primary focus:ring-primary bg-surface-container-highest cursor-pointer" 
                    />
                    <span className="text-sm font-medium text-text-primary flex items-center gap-2">
                      <Truck size={14} /> Material Deliveries
                    </span>
                  </label>
                </div>

                {/* Installers Section */}
                <div className="p-3 bg-surface-container-highest/50 border-b border-outline/5">
                  <h4 className="font-bold text-text-secondary text-xs uppercase tracking-wider">Installers</h4>
                </div>
                <div className="flex justify-between px-3 py-2 bg-surface-container-low border-b border-outline/5">
                  <button onClick={handleSelectAllInstallers} className="text-xs text-primary font-medium hover:text-primary-hover">Select All</button>
                  <button onClick={handleDeselectAllInstallers} className="text-xs text-text-secondary hover:text-text-primary">Deselect All</button>
                </div>
                <div className="p-2 space-y-1">
                {(installers || []).map(installer => (
                    <div key={`installer-${installer.id}`} className="group flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-highest cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedInstallerIds.has(installer.id)} onChange={() => handleInstallerToggle(installer.id)} className="h-4 w-4 rounded border-outline/20 text-primary focus:ring-primary bg-surface-container-highest cursor-pointer" />
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: installer.color || '#6b7280' }} />
                          <span className={`text-sm ${selectedInstallerIds.has(installer.id) ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>{installer.installerName}</span>
                      </div>
                      <button onClick={(e) => { e.preventDefault(); handleSoloSelectInstaller(installer.id); }} className="opacity-0 group-hover:opacity-100 text-xs text-primary font-bold hover:bg-primary-container px-2 py-0.5 rounded transition-all">Only</button>
                    </div>
                ))}
                </div>

                {/* Users Section */}
                <div className="p-3 bg-surface-container-highest/50 border-y border-outline/5 mt-2">
                  <h4 className="font-bold text-text-secondary text-xs uppercase tracking-wider">Users</h4>
                </div>
                <div className="flex justify-between px-3 py-2 bg-surface-container-low border-b border-outline/5">
                  <button onClick={handleSelectAllUsers} className="text-xs text-primary font-medium hover:text-primary-hover">Select All</button>
                  <button onClick={handleDeselectAllUsers} className="text-xs text-text-secondary hover:text-text-primary">Deselect All</button>
                </div>
                <div className="p-2 space-y-1">
                {(users || []).map(user => (
                    <div key={`user-${user.userId}`} className="group flex items-center justify-between p-2 rounded-lg hover:bg-surface-container-highest cursor-pointer transition-colors">
                      <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedUserIds.has(user.userId)} onChange={() => handleUserToggle(user.userId)} className="h-4 w-4 rounded border-outline/20 text-primary focus:ring-primary bg-surface-container-highest cursor-pointer" />
                          <div className="w-4 h-4 rounded-full" style={{ backgroundColor: user.color || '#6b7280' }} />
                          <span className={`text-sm ${selectedUserIds.has(user.userId) ? 'text-text-primary font-medium' : 'text-text-secondary'}`}>{user.email}</span>
                      </div>
                      <button onClick={(e) => { e.preventDefault(); handleSoloSelectUser(user.userId); }} className="opacity-0 group-hover:opacity-100 text-xs text-primary font-bold hover:bg-primary-container px-2 py-0.5 rounded transition-all">Only</button>
                    </div>
                ))}
                </div>
            </div>
            </div>

            {/* ================= MOBILE VIEW (Full Screen Sheet) ================= */}
            <div className="md:hidden fixed inset-0 bg-surface-container-low z-50 flex flex-col animate-in slide-in-from-bottom-5 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-outline/10 bg-surface-container-high">
                    <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                        <Filter size={20} /> Filter Calendar
                    </h2>
                    <button onClick={() => setIsOpen(false)} className="p-2 bg-surface-container-highest rounded-full text-text-secondary hover:text-text-primary"><X size={24}/></button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-outline/10 bg-surface-container-high">
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
                <div className="p-4 bg-surface-container-low border-b border-outline/10">
                    <div className="flex items-center justify-between bg-surface-container-high p-4 rounded-xl border border-outline/5 shadow-sm">
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
                <div className="flex-1 overflow-y-auto p-4 bg-surface-container-low">
                    {activeTab === 'installers' && (
                        <div className="space-y-2">
                            {installers.map(installer => {
                                const isSelected = draftInstallerIds.has(installer.id);
                                return (
                                    <div key={installer.id} className="flex gap-2">
                                        <button 
                                            onClick={() => toggleDraftInstaller(installer.id)}
                                            className={`flex-1 flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                                                isSelected 
                                                ? 'bg-primary-container border-primary shadow-sm' 
                                                : 'bg-surface-container-high border-outline/10'
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
                                            className="px-4 font-bold text-xs uppercase tracking-wide text-primary border border-outline/10 rounded-xl hover:bg-primary-container bg-surface-container-high shadow-sm"
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
                                            className={`flex-1 flex items-center justify-between p-4 rounded-xl border text-left transition-all ${
                                                isSelected 
                                                ? 'bg-primary-container border-primary shadow-sm' 
                                                : 'bg-surface-container-high border-outline/10'
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
                                            className="px-4 font-bold text-xs uppercase tracking-wide text-primary border border-outline/10 rounded-xl hover:bg-primary-container bg-surface-container-high shadow-sm"
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
                <div className="p-4 bg-surface-container-high border-t border-outline/10 flex gap-3">
                    <button 
                        onClick={handleResetAll}
                        className="flex-1 py-3 text-text-primary font-medium hover:bg-surface-container-highest rounded-full transition-colors border border-outline/10 flex items-center justify-center gap-2"
                    >
                        <RotateCcw size={18} /> Reset All
                    </button>
                    <button 
                        onClick={handleApply}
                        className="flex-1 py-3 bg-primary text-on-primary font-bold rounded-full shadow-lg hover:bg-primary-hover transition-colors"
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