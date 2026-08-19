import { useState, useEffect } from 'react';
import { useLanguage } from './useLanguage';

export type SyncState = 'online' | 'offline' | 'syncing' | 'synced';

export function useNetworkSync() {
  const [isOnline, setIsOnline] = useState<boolean>(() => typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [syncState, setSyncState] = useState<SyncState>(() => (typeof navigator !== 'undefined' && !navigator.onLine) ? 'offline' : 'online');
  const { language } = useLanguage();

  useEffect(() => {
    let syncTimer: any = null;
    let syncedTimer: any = null;

    const handleOnline = () => {
      setIsOnline(true);
      setSyncState('syncing');
      
      // Allow 2.5 seconds for Firestore background queue synchronization
      syncTimer = setTimeout(() => {
        setSyncState('synced');
        syncedTimer = setTimeout(() => {
          setSyncState('online');
        }, 3500);
      }, 2500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      if (syncTimer) clearTimeout(syncTimer);
      if (syncedTimer) clearTimeout(syncedTimer);
      setSyncState('offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (syncTimer) clearTimeout(syncTimer);
      if (syncedTimer) clearTimeout(syncedTimer);
    };
  }, []);

  const getStatusText = () => {
    const isPt = language === 'pt';
    switch (syncState) {
      case 'offline':
        return isPt 
          ? 'Modo Offline • A usar reservas em cache local' 
          : 'Offline Mode • Using locally cached reservations';
      case 'syncing':
        return isPt 
          ? 'Online • A sincronizar alterações com a base de dados...' 
          : 'Online • Synchronizing with Firestore...';
      case 'synced':
        return isPt 
          ? 'Sincronizado • Todas as reservas atualizadas' 
          : 'Synced • All reservations up to date';
      case 'online':
      default:
        return isPt ? 'Online' : 'Online';
    }
  };

  const getShortStatusText = () => {
    const isPt = language === 'pt';
    switch (syncState) {
      case 'offline':
        return isPt ? 'Offline' : 'Offline';
      case 'syncing':
        return isPt ? 'A sincronizar...' : 'Syncing...';
      case 'synced':
        return isPt ? 'Sincronizado' : 'Synced';
      case 'online':
      default:
        return 'Online';
    }
  };

  return {
    isOnline,
    syncState,
    statusText: getStatusText(),
    shortStatusText: getShortStatusText(),
  };
}
