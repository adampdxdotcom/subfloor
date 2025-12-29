import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { NativeBiometric } from 'capacitor-native-biometric';
import { App } from '@capacitor/app';
import { Preferences } from '@capacitor/preferences';
import { Capacitor } from '@capacitor/core';
import LockScreen from '../components/security/LockScreen';
import { useData } from './DataContext';

interface BiometricContextType {
  isEnabled: boolean;
  enableBiometrics: () => Promise<boolean>;
  disableBiometrics: () => Promise<void>;
}

const BiometricContext = createContext<BiometricContextType>({} as BiometricContextType);

// Config: Lock after this many milliseconds of inactivity (e.g., 5 minutes)
const INACTIVITY_LIMIT = 5 * 60 * 1000; 

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useData();
  const [isLocked, setIsLocked] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false); 
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 0. LOAD PREFERENCE ON STARTUP
  useEffect(() => {
    const loadSettings = async () => {
      const { value } = await Preferences.get({ key: 'biometrics_enabled' });
      if (value === 'true') {
        setIsEnabled(true);
      }
    };
    loadSettings();
  }, []);

  // 1. Inactivity Timer Logic
  const resetTimer = () => {
    if (!isEnabled || !user) return;
    
    if (timerRef.current) clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      console.log('User inactive for too long. Locking app.');
      setIsLocked(true);
    }, INACTIVITY_LIMIT);
  };

  // 2. Set up Activity Listeners (Touches, Keypresses)
  useEffect(() => {
    if (!isEnabled || !user) return;

    const handleActivity = () => resetTimer();

    window.addEventListener('touchstart', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('keypress', handleActivity);
    
    // Start the timer immediately
    resetTimer();

    return () => {
      window.removeEventListener('touchstart', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keypress', handleActivity);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isEnabled, user]);


  // 3. Background/Foreground Listener
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener('appStateChange', ({ isActive }) => {
      if (!isActive && isEnabled && user) {
        // App went to background -> Immediate Lock
        setIsLocked(true);
      }
    });

    return () => {
        listener.then(h => h.remove());
    };
  }, [isEnabled, user]);


  // 4. The Unlock Function
  const performBiometricScan = async () => {
    try {
      const result = await NativeBiometric.verifyIdentity({
        reason: "Unlock Subfloor",
        title: "Verify Identity",
        subtitle: "Use Face ID or Fingerprint",
        description: "Verify your identity to access the application",
      });

      if (result) {
        setIsLocked(false);
        resetTimer();
      }
    } catch (error) {
      console.error("Biometric verification failed", error);
      // We don't unlock. User remains on Lock Screen.
    }
  };


  // 5. Exposed Methods for Settings
  const enableBiometrics = async () => {
    try {
      const check = await NativeBiometric.isAvailable();
      if (!check.isAvailable) {
        alert("Biometrics not available on this device");
        return false;
      }
      
      // Save to Disk
      await Preferences.set({ key: 'biometrics_enabled', value: 'true' });
      setIsEnabled(true);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const disableBiometrics = async () => {
    // Remove from Disk
    await Preferences.set({ key: 'biometrics_enabled', value: 'false' });
    setIsEnabled(false);
    setIsLocked(false);
  };

  // 6. Auto-Trigger Scan when Locked
  useEffect(() => {
    if (isLocked) {
      performBiometricScan();
    }
  }, [isLocked]);

  return (
    <BiometricContext.Provider value={{ isEnabled, enableBiometrics, disableBiometrics }}>
      {isLocked && <LockScreen onUnlock={performBiometricScan} />}
      {children}
    </BiometricContext.Provider>
  );
};

export const useBiometrics = () => useContext(BiometricContext);