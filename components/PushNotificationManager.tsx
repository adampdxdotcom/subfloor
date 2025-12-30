import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { getEndpoint } from '../utils/apiConfig';
import { useNavigate } from 'react-router-dom';

const PushNotificationManager: React.FC = () => {
  const navigate = useNavigate();
  const [debugLog, setDebugLog] = useState<string[]>([]);

  const addLog = (msg: string) => {
    setDebugLog(prev => [msg, ...prev].slice(0, 5)); // Keep last 5 logs
  };

  useEffect(() => {
    // 1. Force it to run and tell us if it thinks it is native
    const isNative = Capacitor.isNativePlatform();
    addLog(`Is Native? ${isNative}`);

    if (!isNative) return;

    const registerPush = async () => {
      try {
        addLog('Checking Perms...');
        const permStatus = await PushNotifications.checkPermissions();
        addLog(`Perm Status: ${permStatus.receive}`);

        let currentStatus = permStatus.receive;

        if (currentStatus === 'prompt') {
          addLog('Requesting Prompt...');
          const newStatus = await PushNotifications.requestPermissions();
          currentStatus = newStatus.receive;
          addLog(`New Status: ${currentStatus}`);
        }

        if (currentStatus !== 'granted') {
          addLog('DENIED.');
          return;
        }

        addLog('Registering...');
        await PushNotifications.register();
      } catch (e: any) {
        addLog(`ERR: ${e.message}`);
      }
    };

    const addListeners = async () => {
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener('registration', async (token: Token) => {
        addLog(`GOT TOKEN! ${token.value.substring(0, 5)}...`);
        
        try {
          const res = await fetch(getEndpoint('/api/notifications/register-device'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  token: token.value, 
                  platform: 'android',
                  model: navigator.userAgent
              }),
              credentials: 'include'
          });
          
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
          }
          addLog("SERVER SAVED OK!");
        } catch (e: any) {
          addLog(`API FAIL: ${e.message}`);
        }
      });

      await PushNotifications.addListener('registrationError', (error: any) => {
        addLog(`REG ERROR: ${JSON.stringify(error)}`);
      });
    };

    addListeners();
    registerPush();

  }, [navigate]);

  // RENDER A VISIBLE DEBUG BOX
  return (
    <div className="fixed top-12 left-0 right-0 bg-red-600 text-white text-xs font-mono p-2 z-[99999] opacity-90 pointer-events-none">
        <p className="font-bold border-b border-white mb-1">PUSH DEBUGGER</p>
        {debugLog.map((log, i) => (
            <div key={i}>{log}</div>
        ))}
    </div>
  );
};

export default PushNotificationManager;