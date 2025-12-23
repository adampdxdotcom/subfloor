import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { createGravatarHash } from '../utils/cryptoUtils';
import { LogOut, Settings, XCircle, Bell, Check } from 'lucide-react'; 
import { signOut } from 'supertokens-auth-react/recipe/session';
import { useLocation, Link } from 'react-router-dom'; 
import * as notificationService from '../services/notificationService'; 
import { getImageUrl } from '../utils/apiConfig'; // Added import

const UserStatus = () => {
  const { currentUser, isLayoutEditMode, toggleLayoutEditMode, unreadCount, refreshNotifications } = useData();
  const location = useLocation(); 

  const [gravatarUrl, setGravatarUrl] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<notificationService.Notification[]>([]); 
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isEditablePage = location.pathname.startsWith('/projects/');

  useEffect(() => {
    // PRIORITY 1: Use the uploaded avatar URL (wrapped in getImageUrl to handle relative paths)
    if (currentUser?.avatarUrl) {
      setGravatarUrl(getImageUrl(currentUser.avatarUrl));
    } 
    // PRIORITY 2: Fallback to Gravatar hash if no custom avatar
    else if (currentUser?.email) {
      const hash = createGravatarHash(currentUser.email);
      setGravatarUrl(`https://www.gravatar.com/avatar/${hash}?s=40&d=mp`);
    }
  }, [currentUser, currentUser?.avatarUrl]); 

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

  useEffect(() => {
      if (isDropdownOpen) {
          notificationService.getNotifications().then(setNotifications);
          refreshNotifications();
      }
  }, [isDropdownOpen, refreshNotifications]);

  const onLogout = async () => {
    await signOut();
    window.location.href = "/auth";
  };
  
  if (!currentUser) {
    return null;
  }

  const displayName = currentUser.firstName 
    ? `${currentUser.firstName} ${currentUser.lastName || ''}` 
    : currentUser.email;

  const handleNotificationClick = async (n: notificationService.Notification) => {
      if (!n.isRead) {
          await notificationService.markAsRead(n.id);
          refreshNotifications();
      }
      setIsDropdownOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
        className="flex items-center space-x-3 text-text-primary p-1 rounded-md hover:bg-background transition-colors"
      >
        {unreadCount > 0 && (
            <span className="absolute top-0 left-0 -mt-1 -ml-1 w-4 h-4 bg-red-500 rounded-full text-[10px] flex items-center justify-center text-white font-bold border border-surface z-10">
                {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
        <img
          src={gravatarUrl}
          alt="User Avatar"
          className="w-8 h-8 rounded-full bg-gray-600 border-2 border-gray-400 object-cover"
        />
        <span className="hidden sm:inline text-sm font-medium">{displayName}</span>
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface rounded-md shadow-lg z-50 border border-border overflow-hidden">
          
          <div className="p-3 border-b border-border bg-background flex justify-between items-center">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                  <button 
                    onClick={async () => { await notificationService.markAllAsRead(); refreshNotifications(); setIsDropdownOpen(false); }}
                    className="text-xs text-accent hover:text-white flex items-center gap-1"
                  >
                      <Check size={12} /> Mark all read
                  </button>
              )}
          </div>

          <div className="max-h-60 overflow-y-auto">
              {notifications.length === 0 ? (
                  <div className="p-4 text-center text-text-secondary text-sm italic">No notifications</div>
              ) : (
                  notifications.map(n => (
                      <Link 
                        key={n.id} 
                        to={n.linkUrl} 
                        onClick={() => handleNotificationClick(n)}
                        className={`block p-3 border-b border-border hover:bg-background transition-colors ${!n.isRead ? 'bg-accent/10 border-l-4 border-l-accent' : ''}`}
                      >
                          <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {n.senderInitial || '?'} 
                              </div>
                              <div>
                                  <p className="text-sm text-text-primary line-clamp-2">{n.message}</p>
                                  <p className="text-[10px] text-text-tertiary mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                              </div>
                          </div>
                      </Link>
                  ))
              )}
          </div>

          <div className="p-2 border-t border-border bg-background/50">
            {isEditablePage && (
              <button
                onClick={() => {
                  toggleLayoutEditMode();
                  setIsDropdownOpen(false); 
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