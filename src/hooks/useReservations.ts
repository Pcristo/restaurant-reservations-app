import { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, query, where, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Reservation } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { format, addDays, parseISO } from 'date-fns';
import { APP_CONFIG } from '../data/appConfig';
import { getEffectiveOpeningHours } from '../lib/utils';

const generateFriendlyId = (text: string) => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

export interface UseReservationsOptions {
  date?: string;
  startDate?: string;
  endDate?: string;
  includeAll?: boolean;
}

export function useReservations(options?: UseReservationsOptions) {
  const [operationalRes, setOperationalRes] = useState<Reservation[]>([]);
  const [onDemandRes, setOnDemandRes] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');

  // 1. Continuous synchronization of today's and tomorrow's reservations (operational cache)
  useEffect(() => {
    const q = query(
      collection(db, 'reservations'),
      where('date', 'in', [todayStr, tomorrowStr])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
      setOperationalRes(data);
      if (!options?.date && !options?.startDate && !options?.endDate && !options?.includeAll) {
        setLoading(false);
      }
    }, (error) => {
      console.error('Error in operational reservations sync:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [todayStr, tomorrowStr, options?.date, options?.startDate, options?.endDate, options?.includeAll]);

  // 2. On-demand query based on requested date/range or includeAll option
  useEffect(() => {
    const hasOnDemand = options?.date || options?.startDate || options?.endDate || options?.includeAll;
    if (!hasOnDemand) {
      setOnDemandRes([]);
      return;
    }

    setLoading(true);
    let q;

    if (options?.includeAll) {
      q = query(collection(db, 'reservations'));
    } else if (options?.startDate && options?.endDate) {
      q = query(
        collection(db, 'reservations'),
        where('date', '>=', options.startDate),
        where('date', '<=', options.endDate)
      );
    } else if (options?.date) {
      q = query(
        collection(db, 'reservations'),
        where('date', '==', options.date)
      );
    } else {
      setOnDemandRes([]);
      setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
      setOnDemandRes(data);
      setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'reservations');
    });

    return () => unsubscribe();
  }, [options?.date, options?.startDate, options?.endDate, options?.includeAll]);

  // Combine both arrays, removing duplicates by reservation ID
  const reservations = useMemo(() => {
    const mergedMap = new Map<string, Reservation>();
    operationalRes.forEach(r => mergedMap.set(r.id, r));
    onDemandRes.forEach(r => mergedMap.set(r.id, r));
    return Array.from(mergedMap.values());
  }, [operationalRes, onDemandRes]);

  const activeReservations = reservations.filter(r => !r.isDeleted && !r.isHistory && r.status !== 'history');
  const deletedReservations = reservations.filter(r => r.isDeleted && !r.isHistory && r.status !== 'history');
  const historyReservations = reservations.filter(r => r.isHistory || r.status === 'history');

  const autoUnblockTable = async (res: Reservation) => {
    if (!res.tableId || !res.date) return;
    try {
      const tableRef = doc(db, 'tables', res.tableId);
      const tableSnap = await getDoc(tableRef);
      if (tableSnap.exists()) {
        const tableData = tableSnap.data();
        const blockedDates = { ...(tableData.blockedDates || {}) };
        const dateRecord = { ...(blockedDates[res.date] || {}) };
        
        let sessionKey = 'general';
        try {
          const settingsRef = doc(db, 'settings', 'main');
          const settingsSnap = await getDoc(settingsRef);
          if (settingsSnap.exists()) {
            const settings = settingsSnap.data();
            const eff = getEffectiveOpeningHours(res.date, settings as any);
            const lunch = eff.lunch;
            const dinner = eff.dinner;

            if (lunch?.active && res.time >= lunch.open && res.time < lunch.close) {
              sessionKey = 'lunch';
            } else if (dinner?.active && res.time >= dinner.open && res.time < dinner.close) {
              sessionKey = 'dinner';
            }
          }
        } catch (e) {
          console.error("Error fetching settings for auto-unblock session resolution:", e);
        }

        dateRecord[sessionKey] = false;
        dateRecord['default'] = false;
        dateRecord['general'] = false;
        
        const hasActiveBlock = Object.values(dateRecord).some(val => val === true);
        if (!hasActiveBlock) {
          delete blockedDates[res.date];
        } else {
          blockedDates[res.date] = dateRecord;
        }

        await updateDoc(tableRef, { blockedDates });
      }
    } catch (err) {
      console.error("Error auto-unblocking table:", err);
    }
  };

  const addReservation = async (reservation: Omit<Reservation, 'id'>) => {
    let enableBookingNumber = true;
    let restaurantName = APP_CONFIG.appName;
    let bookingNumberPrefix = '';
    let bookingNumberResetDate: string | undefined = undefined;
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'main'));
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        if (settingsData.enableBookingNumber !== undefined) {
          enableBookingNumber = settingsData.enableBookingNumber;
        }
        if (settingsData.bookingNumberPrefix) {
          bookingNumberPrefix = settingsData.bookingNumberPrefix;
        }
        if (settingsData.bookingNumberResetDate) {
          bookingNumberResetDate = settingsData.bookingNumberResetDate;
        }
        if (settingsData.name) {
          restaurantName = settingsData.name;
        } else if (settingsData.restaurantName) {
          restaurantName = settingsData.restaurantName;
        }
      }
    } catch (e) {
      console.error("Error fetching settings for booking number check:", e);
    }

    let bookingNumber: string | undefined = undefined;

    if (enableBookingNumber) {
      let prefix = '';
      if (bookingNumberPrefix && bookingNumberPrefix.trim().length > 0) {
        prefix = bookingNumberPrefix.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
      } else {
        const words = restaurantName.split(/[\s_\-]+/);
        const ignoredWords = ['the', 'restaurant', 'restaurante', 'o', 'a', 'os', 'as', 'pro', 'dine', 'master'];
        
        const filteredWords = words.filter(w => {
          const cleanW = w.replace(/[^a-zA-Z]/g, '');
          return !ignoredWords.includes(cleanW.toLowerCase()) && cleanW.length > 0;
        });
        
        const targetWord = filteredWords.length > 0 ? filteredWords[0] : (words[0] || 'Nortada');
        const cleanName = targetWord.replace(/[^a-zA-Z]/g, '').toUpperCase();
        prefix = cleanName.substring(0, 3);
      }
      while (prefix.length < 3) {
        prefix += 'X';
      }

      const dateParts = reservation.date ? reservation.date.split('-') : [];
      const year = dateParts[0] || new Date().getFullYear().toString();
      const month = dateParts[1] || String(new Date().getMonth() + 1).padStart(2, '0');
      const yearLastTwo = year.substring(year.length - 2);

      let nextNum = 1;
      try {
        const q = query(
          collection(db, 'reservations'),
          where('date', '>=', `${year}-01-01`),
          where('date', '<=', `${year}-12-31`)
        );
        const querySnapshot = await getDocs(q);
        let maxNum = 0;
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (bookingNumberResetDate && data.createdAt && data.createdAt < bookingNumberResetDate) {
            return;
          }
          if (data.bookingNumber) {
            const parts = data.bookingNumber.split('-');
            if (parts.length > 0) {
              const lastPart = parts[parts.length - 1];
              const num = parseInt(lastPart, 10);
              if (!isNaN(num) && num > maxNum) {
                maxNum = num;
              }
            }
          }
        });
        nextNum = maxNum + 1;
      } catch (e) {
        console.error("Error generating booking number:", e);
      }
      bookingNumber = `${prefix}-RES-${month}-${yearLastTwo}-${String(nextNum).padStart(6, '0')}`;
    }

    // Schedule reminder for 24h before
    let reminderEmail = { scheduled: false, scheduledFor: null, sent: false };
    if (reservation.date && reservation.time) {
       try {
         // Naive 24h calculation in local time (frontend)
         // Assuming reservation.date is YYYY-MM-DD and time is HH:mm
         const resDate = new Date(`${reservation.date}T${reservation.time}:00`);
         const reminderDate = new Date(resDate.getTime() - 24 * 60 * 60 * 1000);
         reminderEmail = {
           scheduled: true,
           scheduledFor: reminderDate.toISOString(),
           sent: false
         };
       } catch (e) {
         console.error('Error calculating reminder date:', e);
       }
    }

    const cleanReservation = Object.fromEntries(
      Object.entries(reservation).filter(([_, v]) => v !== undefined)
    );
    cleanReservation.reminderEmail = reminderEmail;


    let friendlyId = 'res-' + reservation.date + '-' + (reservation.customerName ? generateFriendlyId(reservation.customerName).substring(0, 15) : 'walkin');
    friendlyId += '-' + Math.random().toString(36).substring(2, 6);

    await setDoc(doc(db, 'reservations', friendlyId), {
      ...cleanReservation,
      id: friendlyId,
      ...(bookingNumber ? { bookingNumber } : {}),
      createdAt: new Date().toISOString()
    });
    return { id: friendlyId, bookingNumber };
  };

  const updateReservation = async (id: string, reservation: Partial<Reservation>) => {
    const { id: _, ...data } = reservation as any;
    
    if (data.status === 'cancelled') {
      const res = reservations.find(r => r.id === id);
      if (res) {
        await autoUnblockTable(res);
      }
    }
    
    if (data.date || data.time) {
      const res = reservations.find(r => r.id === id);
      if (res) {
         const newDate = data.date || res.date;
         const newTime = data.time || res.time;
         if (newDate && newTime) {
           try {
             const resDate = new Date(`${newDate}T${newTime}:00`);
             const reminderDate = new Date(resDate.getTime() - 24 * 60 * 60 * 1000);
             data.reminderEmail = {
               ...(res.reminderEmail || {}),
               scheduled: true,
               scheduledFor: reminderDate.toISOString(),
             };
           } catch (e) {}
         }
      }
    }
    
    if (data.status === 'cancelled') {
       const res = reservations.find(r => r.id === id);
       if (res && res.reminderEmail) {
          data.reminderEmail = {
            ...res.reminderEmail,
            scheduled: false,
            sent: false
          };
       }
    }

    const cleanData = Object.fromEntries(
      Object.entries(data).filter(([_, v]) => v !== undefined)
    );

    await updateDoc(doc(db, 'reservations', id), cleanData);
  };

  const deleteReservation = async (id: string, soft: boolean = true) => {
    const res = reservations.find(r => r.id === id);
    if (res) {
      await autoUnblockTable(res);
    }
    if (soft) {
      await updateDoc(doc(db, 'reservations', id), { isDeleted: true });
    } else {
      await deleteDoc(doc(db, 'reservations', id));
    }
  };

  const restoreReservation = async (id: string) => {
    await updateDoc(doc(db, 'reservations', id), { isDeleted: false, isHistory: false });
  };

  const bulkRestoreReservations = async (ids: string[]) => {
    await Promise.all(ids.map(id => updateDoc(doc(db, 'reservations', id), { isDeleted: false, isHistory: false })));
  };

  const moveToHistoryReservation = async (id: string) => {
    await updateDoc(doc(db, 'reservations', id), { isHistory: true });
  };

  const bulkMoveToHistoryReservations = async (ids: string[]) => {
    await Promise.all(ids.map(id => updateDoc(doc(db, 'reservations', id), { isHistory: true })));
  };

  const forceDeleteReservation = async (id: string) => {
    await deleteDoc(doc(db, 'reservations', id));
  };

  const bulkForceDeleteReservations = async (ids: string[]) => {
    await Promise.all(ids.map(id => deleteDoc(doc(db, 'reservations', id))));
  };

  return { 
    reservations: activeReservations, 
    allReservations: reservations,
    deletedReservations, 
    loading, 
    addReservation, 
    updateReservation, 
    deleteReservation, 
    restoreReservation, 
    bulkRestoreReservations,
    forceDeleteReservation,
    bulkForceDeleteReservations,
    moveToHistoryReservation,
    bulkMoveToHistoryReservations,
    historyReservations
  };
}

