import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { getEndpoint } from '../utils/apiConfig';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const PushNotificationManager: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      try {
        // DEBUG: Tell us we started
        // toast('Checking Push Permissions...', { icon: '🔍' });

        const permStatus = await PushNotifications.checkPermissions();
        
        // DEBUG: Tell us current status
        // toast(`Current Status: ${permStatus.receive}`);

        let currentStatus = permStatus.receive;

        if (currentStatus === 'prompt') {
          const newStatus = await PushNotifications.requestPermissions();
          currentStatus = newStatus.receive;
          // DEBUG: Result of request
          // toast(`New Status: ${currentStatus}`);
        }

        if (currentStatus !== 'granted') {
          toast.error('Push Notifications Denied');
          return;
        }

        // Register
        await PushNotifications.register();
      } catch (e: any) {
        toast.error(`Push Setup Failed: ${e.message}`);
      }
    };

    // Listeners
    const addListeners = async () => {
      await PushNotifications.removeAllListeners();

      await PushNotifications.addListener('registration', async (token: Token) => {
        // DEBUG: Success!
        // toast.success('Push Registered!'); 
        console.log('Push Token:', token.value);
        
        try {
          const res = await fetch(getEndpoint('/api/notifications/register-device'), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                  token: token.value, 
                  platform: 'android',
                  model: (window as any).navigator.userAgent
              }),
              credentials: 'include'
          });
          
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(txt);
          }
          // toast.success("Server Linked");
        } catch (e: any) {
          console.error(e);
          toast.error(`Server Link Failed: ${e.message}`);
        }
      });

      await PushNotifications.addListener('registrationError', (error: any) => {
        // THIS IS THE KEY ONE TO WATCH FOR:
        toast.error(`Reg Error: ${JSON.stringify(error)}`);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
        toast(notification.title || 'New Notification', { icon: '🔔' });
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
          const data = notification.notification.data;
          if (data.url) navigate(data.url);
          else if (data.projectId) navigate(`/projects/${data.projectId}`);
      });
    };

    addListeners();
    registerPush();

  }, [navigate]);

  return null;
};

export default PushNotificationManager;