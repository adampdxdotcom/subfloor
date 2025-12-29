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

// CONFIG: 5 Minutes in Milliseconds
const LOCK_TIME_MS = 5 * 60 * 1000; 
const PREF_KEY_ENABLED = 'biometrics_enabled';
const PREF_KEY_LAST_ACTIVE = 'bio_last_active_timestamp';

export const BiometricProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useData();
  const [isLocked, setIsLocked] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false); 
  
  // Ref to hold the in-memory timer (for "Screen On" idling)
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- 1. INITIALIZATION (Run Once on Boot) ---
  useEffect(() => {
    const init = async () => {
      // A. Load "Enabled" Preference
      const { value: enabledVal } = await Preferences.get({ key: PREF_KEY_ENABLED });
      const shouldEnable = enabledVal === 'true';
      setIsEnabled(shouldEnable);

      // B. Check if we should lock IMMEDIATELY (Fresh Boot after delay)
      if (shouldEnable) {
        const { value: lastActiveStr } = await Preferences.get({ key: PREF_KEY_LAST_ACTIVE });
        if (lastActiveStr) {
          const lastActive = parseInt(lastActiveStr, 10);
          const diff = Date.now() - lastActive;
          if (diff > LOCK_TIME_MS) {
            console.log(`[Bio] Boot Lock: Inactive for ${Math.round(diff/1000)}s`);
            setIsLocked(true);
          }
        }
      }
    };
    init();
  }, []);


  // --- 2. BACKGROUND / FOREGROUND HANDLER ---
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener('appStateChange', async ({ isActive }) => {
      if (!isEnabled) return;

      if (!isActive) {
        // APP WENT TO BACKGROUND: Save the current time
        // This acts as our "Anchor" for when we come back.
        await Preferences.set({ key: PREF_KEY_LAST_ACTIVE, value: Date.now().toString() });
      } 
      else {
        // APP CAME TO FOREGROUND: Check the difference
        const { value: lastActiveStr } = await Preferences.get({ key: PREF_KEY_LAST_ACTIVE });
        if (lastActiveStr) {
          const diff = Date.now() - parseInt(lastActiveStr, 10);
          if (diff > LOCK_TIME_MS) {
            console.log(`[Bio] Resume Lock: Inactive for ${Math.round(diff/1000)}s`);
            setIsLocked(true);
          }
        }
      }
    });

    return () => { listener.then(l => l.remove()); };
  }, [isEnabled]);


  // --- 3. IN-APP IDLE TIMER (Screen stays on) ---
  const resetIdleTimer = () => {
    if (!isEnabled || isLocked) return;

    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    
    idleTimerRef.current = setTimeout(() => {
      console.log('[Bio] Idle Lock: Screen left on too long');
      setIsLocked(true);
    }, LOCK_TIME_MS);

    // Also update the disk timestamp periodically so if the battery dies 
    // right now, we know when the user was last active.
    // (Optimization: We could throttle this, but doing it on interaction is safest for now)
    Preferences.set({ key: PREF_KEY_LAST_ACTIVE, value: Date.now().toString() });
  };

  useEffect(() => {
    if (!isEnabled) return;

    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    window.addEventListener('keypress', resetIdleTimer);
    
    resetIdleTimer(); // Start clock

    return () => {
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('keypress', resetIdleTimer);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isEnabled, isLocked]);


  // --- 4. ACTIONS ---

  const performBiometricScan = async () => {
    try {
      // NOTE: This throws an error if failed/cancelled
      await NativeBiometric.verifyIdentity({
        reason: "Unlock Subfloor",
        title: "Verify Identity",
        subtitle: "Unlock App",
        description: "Please authenticate to continue",
      });

      // Success
      setIsLocked(false);
      resetIdleTimer();
      // Update timestamp so we don't immediately re-lock if we switch apps
      Preferences.set({ key: PREF_KEY_LAST_ACTIVE, value: Date.now().toString() });

    } catch (error) {
      console.error("[Bio] Scan failed or cancelled", error);
      // Do nothing -> Stay locked
    }
  };

  const enableBiometrics = async () => {
    try {
      const check = await NativeBiometric.isAvailable();
      if (!check.isAvailable) {
        alert("Biometrics not available on this device");
        return false;
      }
      
      // Save enabled state AND current time (to prevent immediate lockout)
      await Preferences.set({ key: PREF_KEY_ENABLED, value: 'true' });
      await Preferences.set({ key: PREF_KEY_LAST_ACTIVE, value: Date.now().toString() });
      
      setIsEnabled(true);
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  };

  const disableBiometrics = async () => {
    await Preferences.set({ key: PREF_KEY_ENABLED, value: 'false' });
    setIsEnabled(false);
    setIsLocked(false);
  };

  // Trigger scan when locked
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