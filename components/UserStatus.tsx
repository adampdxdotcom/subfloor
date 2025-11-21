import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { createGravatarHash } from '../utils/cryptoUtils';
import { LogOut, Settings, XCircle } from 'lucide-react'; // <-- Import new icons
import { signOut } from 'supertokens-auth-react/recipe/session';
import { useLocation } from 'react-router-dom'; // <-- Import to check current page

const UserStatus = () => {
  // --- MODIFIED: Get new state and functions from context ---
  const { currentUser, isLayoutEditMode, toggleLayoutEditMode } = useData();
  const location = useLocation(); // Get the current URL path

  const [gravatarUrl, setGravatarUrl] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // --- Check if the current page is one that supports layout editing ---
  const isEditablePage = location.pathname.startsWith('/projects/');

  useEffect(() => {
    // PRIORITY 1: Use the uploaded avatar URL directly if it exists
    if (currentUser?.avatarUrl) {
        setGravatarUrl(currentUser.avatarUrl);
    } 
    // PRIORITY 2: Fallback to Gravatar hash if no custom avatar
    else if (currentUser?.email) {
      const hash = createGravatarHash(currentUser.email);
      setGravatarUrl(`https://www.gravatar.com/avatar/${hash}?s=40&d=mp`);
    }
  }, [currentUser, currentUser?.avatarUrl]); // Re-run if the uploaded URL changes

  // Effect to close dropdown if clicking outside of it
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const onLogout = async () => {
    await signOut();
    window.location.href = "/auth";
  };
  
  if (!currentUser) {
    return null;
  }

  // Use First Name if available, otherwise fall back to email
  const displayName = currentUser.firstName 
    ? `${currentUser.firstName} ${currentUser.lastName || ''}` 
    : currentUser.email;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* --- MODIFIED: This is now the button to open the dropdown --- */}
      <button 
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-3 text-text-primary p-1 rounded-md hover:bg-background transition-colors"
      >
        <img
          src={gravatarUrl}
          alt="User Avatar"
          className="w-8 h-8 rounded-full bg-gray-600 border-2 border-gray-400 object-cover"
        />
        <span className="hidden sm:inline text-sm font-medium">{displayName}</span>
      </button>

      {/* --- NEW: The Dropdown Menu --- */}
      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-surface rounded-md shadow-lg z-50 border border-border">
          <div className="p-2">
            
            {/* --- NEW: Edit Page Layout Button (conditional) --- */}
            {isEditablePage && (
              <button
                onClick={() => {
                  toggleLayoutEditMode();
                  setIsDropdownOpen(false); // Close dropdown on click
                }}
                className="w-full flex items-center px-3 py-2 text-sm text-text-primary rounded-md hover:bg-background transition-colors"
              >
                {isLayoutEditMode ? (
                  <>
                    <XCircle size={16} className="mr-3 text-red-400" />
                    <span>Exit Edit Mode</span>
                  </>
                ) : (
                  <>
                    <Settings size={16} className="mr-3 text-accent" />
                    <span>Edit Page Layout</span>
                  </>
                )}
              </button>
            )}

            {/* Logout Button (now a menu item) */}
            <button
              onClick={onLogout}
              className="w-full flex items-center px-3 py-2 text-sm text-text-primary rounded-md hover:bg-background transition-colors mt-1"
            >
              <LogOut size={16} className="mr-3" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserStatus;