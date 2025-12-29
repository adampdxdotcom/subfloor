import React from 'react';
import { Fingerprint, LogOut } from 'lucide-react';
import { signOut } from "supertokens-auth-react/recipe/session";

interface LockScreenProps {
  onUnlock: () => void;
}

const LockScreen: React.FC<LockScreenProps> = ({ onUnlock }) => {
  const handleLogout = async () => {
    await signOut();
    window.location.href = "/auth";
  };

  // Get the company name from the window title or default
  const appName = document.title || 'Subfloor';

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
      <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-8 shadow-xl border border-slate-700">
        <Fingerprint className="w-12 h-12 text-blue-500" />
      </div>
      
      <h1 className="text-2xl font-bold mb-2">{appName} is Locked</h1>
      <p className="text-slate-400 mb-12 text-center">
        Verify your identity to resume your session
      </p>

      <button
        onClick={onUnlock}
        className="w-full max-w-xs bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 mb-4"
      >
        <Fingerprint className="w-6 h-6" />
        <span>Unlock with Biometrics</span>
      </button>

      <button
        onClick={handleLogout}
        className="text-slate-400 hover:text-white flex items-center gap-2 py-4"
      >
        <LogOut className="w-4 h-4" />
        <span>Log Out</span>
      </button>
    </div>
  );
};

export default LockScreen;