import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { getEndpoint } from '../utils/apiConfig';
// NOTE: No top-level import of '@capacitor/push-notifications' here!

const PushNotificationManager: React.FC = () => {
  const [logs, setLogs] = useState<string[]>([]);

  const log = (msg: string) => {
    // Keep a small log history for debugging
    setLogs(prev => [msg, ...prev].slice(0, 4));
  };

  useEffect(() => {
    // 1. WEB GUARD: Stop immediately if on browser
    if (!Capacitor.isNativePlatform()) return;

    const init = async () => {
      try {
        // 2. DYNAMIC IMPORT: Load the library ONLY now
        const { PushNotifications } = await import('@capacitor/push-notifications');

        log("Checking Perms...");
        const status = await PushNotifications.checkPermissions();
        
        if (status.receive !== 'granted') {
            const req = await PushNotifications.requestPermissions();
            if (req.receive !== 'granted') {
                log("User DENIED");
                return;
            }
        }

        log("Registering...");
        await PushNotifications.register();

        // 3. LISTENERS
        await PushNotifications.removeAllListeners();

        await PushNotifications.addListener('registration', async (token: any) => {
            log(`TOKEN: ${token.value.substring(0,6)}...`);
            try {
                 await fetch(getEndpoint('/api/notifications/register-device'), {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                      token: token.value, 
                      platform: 'android',
                      model: navigator.userAgent
                  }),
                  credentials: 'include'
              });
              log("SERVER SENT OK");
            } catch(e: any) {
                log(`API FAIL: ${e.message}`);
            }
        });

        await PushNotifications.addListener('registrationError', (err: any) => {
            log(`REG FAIL: ${JSON.stringify(err)}`);
        });

      } catch (err: any) {
        console.error("Push Init Failed:", err);
        log(`INIT ERR: ${err.message}`);
      }
    };

    init();
  }, []);

  // Debug Box (Only shows if there are logs, effectively hiding it on Web)
  if (logs.length === 0) return null;

  return (
    <div style={{
        position: 'fixed', 
        top: 60, 
        left: 10, 
        zIndex: 999999, 
        backgroundColor: 'rgba(200, 0, 0, 0.8)', 
        color: 'white', 
        padding: 8,
        fontSize: 10,
        fontWeight: 'bold',
        pointerEvents: 'none',
        borderRadius: 4
    }}>
        {logs.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
};

export default PushNotificationManager;