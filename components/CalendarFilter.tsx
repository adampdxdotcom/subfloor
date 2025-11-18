import React, { useState, useEffect, useRef } from 'react';
import { Installer, User } from '../types';
import { Filter } from 'lucide-react';

interface CalendarFilterProps {
  installers: Installer[];
  users: User[];
  selectedInstallerIds: Set<number>;
  selectedUserIds: Set<string>;
  onInstallerChange: (newSelectedIds: Set<number>) => void;
  onUserChange: (newSelectedIds: Set<string>) => void;
}

const CalendarFilter: React.FC<CalendarFilterProps> = ({ 
  installers, 
  users, 
  selectedInstallerIds, 
  selectedUserIds,
  onInstallerChange,
  onUserChange
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [wrapperRef]);

  // --- Installer Handlers ---
  const handleSelectAllInstallers = () => onInstallerChange(new Set(installers.map(i => i.id)));
  const handleDeselectAllInstallers = () => onInstallerChange(new Set());
  const handleSoloSelectInstaller = (id: number) => onInstallerChange(new Set([id]));
  const handleInstallerToggle = (id: number) => {
    const newIds = new Set(selectedInstallerIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    onInstallerChange(newIds);
  };

  // --- User Handlers ---
  const handleSelectAllUsers = () => onUserChange(new Set(users.map(u => u.userId)));
  const handleDeselectAllUsers = () => onUserChange(new Set());
  const handleSoloSelectUser = (id: string) => onUserChange(new Set([id]));
  const handleUserToggle = (id: string) => {
    const newIds = new Set(selectedUserIds);
    if (newIds.has(id)) newIds.delete(id);
    else newIds.add(id);
    onUserChange(newIds);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-700 transition-colors"
        aria-label="Filter calendar"
      >
        <Filter size={20} />
        <span>Filter</span>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-gray-900 border border-border rounded-lg shadow-xl z-20">
          <div className="max-h-[70vh] overflow-y-auto">
            {/* Installers Section */}
            <div className="p-3 border-b border-border">
              <h4 className="font-semibold text-text-primary">Filter by Installer</h4>
            </div>
            <div className="flex justify-between p-2">
              <button onClick={handleSelectAllInstallers} className="text-xs text-accent hover:underline">Select All</button>
              <button onClick={handleDeselectAllInstallers} className="text-xs text-accent hover:underline">Deselect All</button>
            </div>
            <div className="p-1">
              {(installers || []).map(installer => (
                <label key={`installer-${installer.id}`} className="flex items-center justify-between p-2 rounded hover:bg-gray-800">
                  <div className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={selectedInstallerIds.has(installer.id)} onChange={() => handleInstallerToggle(installer.id)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: installer.color || '#6b7280' }} />
                    <span className="text-sm text-text-secondary">{installer.installerName}</span>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); handleSoloSelectInstaller(installer.id); }} className="text-xs text-accent hover:underline px-2">Only</button>
                </label>
              ))}
            </div>

            {/* Users Section */}
            <div className="p-3 border-b border-t border-border mt-2">
              <h4 className="font-semibold text-text-primary">Filter by User</h4>
            </div>
            <div className="flex justify-between p-2">
              <button onClick={handleSelectAllUsers} className="text-xs text-accent hover:underline">Select All</button>
              <button onClick={handleDeselectAllUsers} className="text-xs text-accent hover:underline">Deselect All</button>
            </div>
            <div className="p-1">
              {(users || []).map(user => (
                <label key={`user-${user.userId}`} className="flex items-center justify-between p-2 rounded hover:bg-gray-800">
                  <div className="flex items-center gap-3 cursor-pointer">
                    <input type="checkbox" checked={selectedUserIds.has(user.userId)} onChange={() => handleUserToggle(user.userId)} className="h-4 w-4 rounded text-primary focus:ring-primary-dark bg-gray-700 border-gray-600" />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: user.color || '#6b7280' }} />
                    <span className="text-sm text-text-secondary">{user.email}</span>
                  </div>
                  <button onClick={(e) => { e.preventDefault(); handleSoloSelectUser(user.userId); }} className="text-xs text-accent hover:underline px-2">Only</button>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarFilter;