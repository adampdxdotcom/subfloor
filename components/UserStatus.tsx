import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import { createGravatarHash } from '../utils/cryptoUtils'; // Our new helper
import { LogOut } from 'lucide-react'; // Removed unused UserIcon import
import { signOut } from 'supertokens-auth-react/recipe/session';

const UserStatus = () => {
  const { currentUser } = useData();
  const [gravatarUrl, setGravatarUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  // --- MODIFIED useEffect ---
  useEffect(() => {
    // This effect is now synchronous.
    if (currentUser?.email) {
      const hash = createGravatarHash(currentUser.email);
      setGravatarUrl(`https://www.gravatar.com/avatar/${hash}?s=40&d=mp`);
      setIsLoading(false);
    } else if (currentUser === null) {
      // If there is no user session, we can stop loading.
      setIsLoading(false);
    }
  }, [currentUser]);

  const onLogout = async () => {
    await signOut();
    // SuperTokens will automatically handle redirecting to the login page
    window.location.href = "/auth";
  };

  // If we're still waiting for the session to be ready, show nothing.
  if (isLoading) {
    return null;
  }

  // If there's no user, show nothing.
  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex items-center space-x-3 text-white">
      {/* Gravatar Image */}
      <img
        src={gravatarUrl}
        alt="User Avatar"
        className="w-8 h-8 rounded-full bg-gray-600 border-2 border-gray-400"
      />
      {/* User Email */}
      <span className="hidden sm:inline text-sm font-medium">{currentUser.email}</span>
      {/* Logout Button */}
      <button
        onClick={onLogout}
        className="p-2 rounded-full hover:bg-white/20 transition-colors"
        title="Logout"
      >
        <LogOut size={18} />
      </button>
    </div>
  );
};

export default UserStatus;