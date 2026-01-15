import React, { useState, useEffect, useRef } from 'react';
import { useData } from '../context/DataContext';
import { createGravatarHash } from '../utils/cryptoUtils';
import { LogOut, Settings, XCircle, Bell, Check } from 'lucide-react'; 
import { signOut } from 'supertokens-auth-react/recipe/session';
import { useLocation, Link } from 'react-router-dom'; 
import * as notificationService from '../services/notificationService'; 
import { getImageUrl } from '../utils/apiConfig';

const UserStatus = () => {
  const { currentUser, isLayoutEditMode, toggleLayoutEditMode, unreadCount, refreshNotifications } = useData();
  const location = useLocation(); 

  const [gravatarUrl, setGravatarUrl] = useState<string>('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [notifications, setNotifications] = useState<notificationService.Notification[]>([]); 
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isEditablePage = location.pathname.startsWith('/projects/');

  useEffect(() => {
    // PRIORITY 1: Use the uploaded avatar URL
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
        className="flex items-center space-x-3 text-text-primary hover:text-primary p-1 pr-3 rounded-full hover:bg-surface-container-high transition-colors border border-transparent hover:border-outline/10 group"
      >
        {unreadCount > 0 && (
            <span className="absolute top-0 left-0 -mt-1 -ml-1 w-5 h-5 bg-error-container text-error rounded-full text-[10px] flex items-center justify-center font-bold border border-surface z-10 shadow-sm">
                {unreadCount > 9 ? '9+' : unreadCount}
            </span>
        )}
        <img
          src={gravatarUrl}
          alt="User Avatar"
          className="w-8 h-8 rounded-full bg-surface-container-highest border border-outline/20 object-cover"
        />
        <span className="hidden sm:inline text-sm font-bold group-hover:text-primary transition-colors">{displayName}</span>
      </button>

      {isDropdownOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-surface-container-high rounded-xl shadow-xl z-50 border border-outline/10 overflow-hidden ring-1 ring-black/5">
          
          <div className="p-3 border-b border-outline/10 bg-surface-container-low flex justify-between items-center">
              <span className="text-xs font-bold text-text-secondary uppercase tracking-wider">Notifications</span>
              {unreadCount > 0 && (
                  <button 
                    onClick={async () => { await notificationService.markAllAsRead(); refreshNotifications(); setIsDropdownOpen(false); }}
                    className="text-xs text-primary hover:text-primary-hover font-medium flex items-center gap-1"
                  >
                      <Check size={12} /> Mark all read
                  </button>
              )}
          </div>

          <div className="max-h-60 overflow-y-auto">
              {notifications.length === 0 ? (
                  <div className="p-8 text-center text-text-secondary text-sm italic opacity-70">No notifications</div>
              ) : (
                  notifications.map(n => (
                      <Link 
                        key={n.id} 
                        to={n.linkUrl} 
                        onClick={() => handleNotificationClick(n)}
                        className={`block p-3 border-b border-outline/10 hover:bg-surface-container-highest transition-colors ${!n.isRead ? 'bg-primary-container/10 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                      >
                          <div className="flex gap-3">
                              <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm">
                                  {n.senderInitial || '?'} 
                              </div>
                              <div>
                                  <p className={`text-sm text-text-primary line-clamp-2 ${!n.isRead ? 'font-medium' : ''}`}>{n.message}</p>
                                  <p className="text-[10px] text-text-tertiary mt-1">{new Date(n.createdAt).toLocaleDateString()}</p>
                              </div>
                          </div>
                      </Link>
                  ))
              )}
          </div>

          <div className="p-2 border-t border-outline/10 bg-surface-container-low">
            {isEditablePage && (
              <button
                onClick={() => {
                  toggleLayoutEditMode();
                  setIsDropdownOpen(false); 
                }}
                className="w-full flex items-center px-3 py-2 text-sm text-text-primary rounded-lg hover:bg-surface-container-highest transition-colors"
              >
                {isLayoutEditMode ? (
                  <>
                    <XCircle size={16} className="mr-3 text-error" />
                    <span>Exit Edit Mode</span>
                  </>
                ) : (
                  <>
                    <Settings size={16} className="mr-3 text-primary" />
                    <span>Edit Page Layout</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onLogout}
              className="w-full flex items-center px-3 py-2 text-sm text-text-primary rounded-lg hover:bg-surface-container-highest transition-colors mt-1"
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