import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { RestaurantSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(() => {
    try {
      const cached = localStorage.getItem('cached_restaurant_settings');
      return cached ? JSON.parse(cached) : { ...DEFAULT_SETTINGS, id: 'main' };
    } catch {
      return { ...DEFAULT_SETTINGS, id: 'main' };
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...(docSnap.data() || {}) } as unknown as RestaurantSettings;
        setSettings(data);
        try {
          localStorage.setItem('cached_restaurant_settings', JSON.stringify(data));
        } catch (e) {}
      } else {
        setSettings({ ...DEFAULT_SETTINGS, id: 'main' } as RestaurantSettings);
      }
      setLoading(false);
    }, (error) => {
      setSettings((prev) => prev || ({ ...DEFAULT_SETTINGS, id: 'main' } as RestaurantSettings));
      setLoading(false);
      handleFirestoreError(error, OperationType.GET, 'settings/main');
    });

    return () => unsubscribe();
  }, []);

  const updateSettings = async (newSettings: RestaurantSettings) => {
    await setDoc(doc(db, 'settings', 'main'), { ...newSettings, id: 'main' });
  };

  return { settings, loading, updateSettings };
}
