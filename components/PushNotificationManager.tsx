import React, { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token, ActionPerformed } from '@capacitor/push-notifications';
import { getEndpoint } from '../utils/apiConfig';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const PushNotificationManager: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 1. Guard Clause: Only run on Native Android/iOS
    if (!Capacitor.isNativePlatform()) return;

    const registerPush = async () => {
      // 2. Request Permission
      const permStatus = await PushNotifications.checkPermissions();

      let currentStatus = permStatus.receive;

      if (currentStatus === 'prompt') {
        const newStatus = await PushNotifications.requestPermissions();
        currentStatus = newStatus.receive;
      }

      if (currentStatus !== 'granted') {
        // User denied permissions
        return;
      }

      // 3. Register with Apple/Google
      await PushNotifications.register();
    };

    registerPush();

    // 4. Listeners
    
    // A. Registration Success -> Send Token to Backend
    const regListener = PushNotifications.addListener('registration', async (token: Token) => {
      console.log('Push Registration Success:', token.value);
      try {
        await fetch(getEndpoint('/api/notifications/register-device'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                token: token.value, 
                platform: 'android',
                model: (window as any).navigator.userAgent // Simple user agent for now
            }),
            credentials: 'include'
        });
      } catch (e) {
        console.error('Failed to send token to server', e);
      }
    });

    // B. Registration Error
    const errListener = PushNotifications.addListener('registrationError', (error: any) => {
      console.error('Push Registration Error: ', error);
    });

    // C. Message Received (While App is Open)
    const msgListener = PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
      // Show a toast so the user knows something happened
      toast(notification.title || 'New Notification', {
        icon: '🔔',
        duration: 4000
      });
    });

    // D. Action Performed (User Tapped Notification)
    const actionListener = PushNotifications.addListener('pushNotificationActionPerformed', (notification: ActionPerformed) => {
        const data = notification.notification.data;
        // Deep linking logic
        if (data.url) {
            navigate(data.url);
        } else if (data.projectId) {
            navigate(`/projects/${data.projectId}`);
        }
    });

    // Cleanup listeners on unmount
    return () => {
        regListener.then(l => l.remove());
        errListener.then(l => l.remove());
        msgListener.then(l => l.remove());
        actionListener.then(l => l.remove());
    };

  }, [navigate]);

  return null; // Headless component, renders nothing
};

export default PushNotificationManager;