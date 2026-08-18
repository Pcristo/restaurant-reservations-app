import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { RestaurantSettings } from '../types';
import { DEFAULT_SETTINGS } from '../constants';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export function useSettings() {
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'settings', 'main'), (docSnap) => {
      if (docSnap.exists()) {
        setSettings({ id: docSnap.id, ...(docSnap.data() || {}) } as unknown as RestaurantSettings);
      } else {
        setSettings({ ...DEFAULT_SETTINGS, id: 'main' } as RestaurantSettings);
      }
      setLoading(false);
    }, (error) => {
      setSettings({ ...DEFAULT_SETTINGS, id: 'main' } as RestaurantSettings);
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
