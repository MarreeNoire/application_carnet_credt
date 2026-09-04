'use client';

import { useEffect } from 'react';
import { setupOnlineListener } from '@/lib/syncService';

export default function OnlineListener() {
  // Set up online listener for transaction sync
  useEffect(() => {
    return setupOnlineListener();
  }, []);

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      // Register the service worker
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    }
  }, []);

  return null;
}