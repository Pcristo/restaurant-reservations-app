import { useState, useEffect, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, where, addDoc, updateDoc, setDoc, doc, deleteDoc, getDocs, serverTimestamp, getDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { format, parseISO, isBefore, addDays, parse, addMinutes } from 'date-fns';
import { Reservation, Table, Area } from '../types';
import { useAuth } from './useAuth';
import { useSettings } from './useSettings';
import { useLanguage } from './useLanguage';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

export interface SmartAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  status: 'active' | 'viewed' | 'dismissed' | 'resolved' | 'expired';
  relatedReservationIds: string[];
  fingerprint: string;
  createdAt: string;
  viewedAt?: string;
  dismissedAt?: string;
  dismissedBy?: string;
  expiresAt?: string;
  bookingDate?: string;
}

const RESTAURANT_ID = 'default';

export function useSmartAlerts() {
  const [alerts, setAlerts] = useState<SmartAlert[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const { isStaff, isAdmin } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const { language } = useLanguage();
  
  // Fetch tables and areas for capacity alerts
  useEffect(() => {
    if (!isStaff && !isAdmin) return;
    const unsubTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      setTables(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table)));
    });
    const unsubAreas = onSnapshot(collection(db, 'areas'), (snapshot) => {
      setAreas(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area)));
    });
    return () => {
      unsubTables();
      unsubAreas();
    };
  }, [isStaff, isAdmin]);

  // 1. Fetch smart alerts from Firestore
  useEffect(() => {
    if (!isStaff && !isAdmin) {
      setAlerts([]);
      setLoading(false);
      return;
    }

    const alertsRef = collection(db, `smart_alerts`);
    const q = query(alertsRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedAlerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as SmartAlert[];
      setAlerts(fetchedAlerts);
      setLoading(false);
      
      // Run cleanup when alerts are fetched
      runCleanup(fetchedAlerts);
    }, (error) => {
      console.error("Error fetching smart alerts", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isStaff, isAdmin]);

  const runCleanup = async (currentAlerts: SmartAlert[]) => {
    const now = new Date();
    for (const alert of currentAlerts) {
      let shouldDelete = false;
      try {
        const rawDate = alert.bookingDate || (typeof alert.createdAt === 'string' ? alert.createdAt.split('T')[0] : null);

        if (rawDate && typeof rawDate === 'string') {
          const parsed = parseISO(rawDate);
          if (!isNaN(parsed.getTime())) {
            const expiryDate = addDays(parsed, 3);
            if (isBefore(expiryDate, now)) {
              shouldDelete = true;
            }
          }
        } else if (alert.expiresAt && typeof alert.expiresAt === 'string') {
          const expiresDate = parseISO(alert.expiresAt);
          if (!isNaN(expiresDate.getTime()) && isBefore(expiresDate, now)) {
            shouldDelete = true;
          }
        }
      } catch (e) {
        console.error("Error during alert cleanup date check:", e);
      }

      if (shouldDelete) {
        try {
          await deleteDoc(doc(db, `smart_alerts`, alert.id));
        } catch (e) {
          console.error("Failed to delete expired alert", e);
        }
      }
    }
  };

  // 2. Generate alerts based on current reservations
  useEffect(() => {
    if (!isStaff && !isAdmin) return;
    if (loading) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const q = query(
      collection(db, 'reservations'),
      where('date', '>=', todayStr)
    );

    const getSessionFromTime = (time: string, date: string, manualSession?: string) => {
      if (manualSession) return manualSession;
      const hour = parseInt(time.split(':')[0], 10);
      return hour < 17 ? 'lunch' : 'dinner';
    };

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const reservations = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Reservation[];
      const newAlertsData: Omit<SmartAlert, 'id'>[] = [];

      // A. Duplicate reservations check
      const emailMap = new globalThis.Map();
      const nameMap = new globalThis.Map();

      reservations.forEach(res => {
        if (!res.date) return;
        if (res.isDeleted || res.isHistory) return;
        if (['cancelled', 'completed', 'no-show'].includes(res.status)) return;
        
        const session = getSessionFromTime(res.time, res.date, (res as any).manualSession);
        
        if (res.customerEmail) {
          const emailKey = `${res.date}_${session}_${res.customerEmail.trim().toLowerCase()}`;
          if (!emailMap.has(emailKey)) emailMap.set(emailKey, []);
          emailMap.get(emailKey).push(res);
        }

        if (res.customerName) {
          const nameKey = `${res.date}_${session}_${res.customerName.trim().toLowerCase()}`;
          if (!nameMap.has(nameKey)) nameMap.set(nameKey, []);
          nameMap.get(nameKey).push(res);
        }
      });

      const duplicateIds = new Set();
      
      const formatDateStr = (dateStr: string) => {
        const parts = dateStr.split('-');
        if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
        return dateStr;
      };

      emailMap.forEach((resArr, key) => {
        if (resArr.length > 1) {
          const [date, session, email] = key.split('_');
          const fingerprint = `dup_email_${key}`;
          resArr.forEach((r: any) => duplicateIds.add(r.id));
          
          newAlertsData.push({
            type: 'duplicate_reservation',
            title: 'Possible Duplicate Reservations',
            message: `The system found ${resArr.length} reservations using the email ${resArr[0].customerEmail || email} for ${session} on ${formatDateStr(date)}.`,
            severity: 'medium',
            status: 'active',
            relatedReservationIds: resArr.map((r: any) => r.id),
            fingerprint,
            createdAt: new Date().toISOString(),
            bookingDate: date
          });
        }
      });

      nameMap.forEach((resArr, key) => {
        if (resArr.length > 1) {
          const [date, session, name] = key.split('_');
          const fingerprint = `dup_name_${key}`;
          
          const allAlreadyFlagged = resArr.every((r: any) => duplicateIds.has(r.id));
          if (!allAlreadyFlagged) {
            resArr.forEach((r: any) => duplicateIds.add(r.id));
            
            const rawName = resArr[0].customerName || name;
            const capitalizedName = rawName.split(' ').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()).join(' ');

            newAlertsData.push({
              type: 'duplicate_reservation',
              title: 'Possible Duplicate Reservations',
              message: `The system found ${resArr.length} reservations using the name ${capitalizedName} for ${session} on ${formatDateStr(date)}.`,
              severity: 'medium',
              status: 'active',
              relatedReservationIds: resArr.map((r: any) => r.id),
              fingerprint,
              createdAt: new Date().toISOString(),
              bookingDate: date
            });
          }
        }
      });

      // C. Time conflict check
      const tableSessionMap = new globalThis.Map();
      const gap = settings?.minReservationGap || 135;
      
      reservations.forEach(res => {
        if (!res.date || !res.tableId) return;
        if (res.isDeleted || res.isHistory) return;
        if (['cancelled', 'completed', 'no-show', 'blocked'].includes(res.status)) return;
        if (duplicateIds.has(res.id)) return;
        
        const session = getSessionFromTime(res.time, res.date, res.manualSession);
        const key = `${res.date}_${session}_${res.tableId}`;
        if (!tableSessionMap.has(key)) tableSessionMap.set(key, []);
        tableSessionMap.get(key).push(res);
      });

      tableSessionMap.forEach((resArr, key) => {
        if (resArr.length > 1) {
          const overlaps = [];
          for (let i = 0; i < resArr.length; i++) {
            for (let j = i + 1; j < resArr.length; j++) {
              const resA = resArr[i];
              const resB = resArr[j];
              
              try {
                const startA = parse(resA.time, 'HH:mm', new Date());
                const endA = addMinutes(startA, gap);
                
                const startB = parse(resB.time, 'HH:mm', new Date());
                const endB = addMinutes(startB, gap);
                
                if (startA < endB && startB < endA) {
                  overlaps.push(resA.id);
                  overlaps.push(resB.id);
                }
              } catch(e) {}
            }
          }
          
          if (overlaps.length > 0) {
            const uniqueOverlaps = [...new Set(overlaps)];
            const [date, session, tableId] = key.split('_');
            
            let tableName = resArr.find(r => r.id === uniqueOverlaps[0])?.tableName;
            if (!tableName || tableName.length > 10) {
               tableName = "a Table";
            } else {
               tableName = `Table ${tableName}`;
            }

            const customerNames = uniqueOverlaps.map(id => {
              const r = resArr.find(res => res.id === id);
              if (r && r.customerName) {
                return r.customerName.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
              }
              return 'Unknown';
            }).join(' and ');

            const fingerprint = `time_conflict_${key}`;
            
            newAlertsData.push({
              type: 'time_conflict',
              title: 'Time Conflict',
              message: `Time conflict detected on ${tableName} between the customers ${customerNames} during ${session} on ${formatDateStr(date)}.`,
              severity: 'high',
              status: 'active',
              relatedReservationIds: uniqueOverlaps,
              fingerprint,
              createdAt: new Date().toISOString(),
              bookingDate: date
            });
          }
        }
      });

      // B. Verify table assignments
      reservations.forEach(res => {
        if (res.isDeleted || res.isHistory) return;
        
        const isMissingTable = !res.tableId && (!(res as any).tableIds || (res as any).tableIds.length === 0);
        const needsVerification = res.verifyTableNumber || isMissingTable;
        
        if (needsVerification && !['cancelled', 'completed', 'no-show', 'waiting-list'].includes(res.status) && !duplicateIds.has(res.id)) {
           const session = getSessionFromTime(res.time, res.date, (res as any).manualSession);
           const fingerprint = `verify_${res.id}`;
           const formattedName = (res.customerName || '').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
           
           const isPt = language === 'pt';
           const message = res.preferredTableUnavailable 
             ? (isPt 
                 ? `A reserva de ${formattedName} para ${formatDateStr(res.date)} necessita de verificação de mesa. A(s) mesa(s) preferida(s) do cliente não estava(m) disponível(eis) e foi atribuída uma mesa alternativa.`
                 : `Reservation for ${formattedName} on ${formatDateStr(res.date)} requires table verification. The customer's preferred table(s) were unavailable and an alternative table was assigned.`)
             : isMissingTable
             ? (isPt
                 ? `A reserva de ${formattedName} para ${formatDateStr(res.date)} não está atribuída a nenhuma mesa e necessita de atribuição.`
                 : `Reservation for ${formattedName} on ${formatDateStr(res.date)} is not assigned to any table and requires table assignment.`)
             : (isPt
                 ? `A reserva de ${formattedName} para ${formatDateStr(res.date)} necessita de verificação de mesa.`
                 : `Reservation for ${formattedName} on ${formatDateStr(res.date)} requires table verification.`);
             
           newAlertsData.push({
             type: 'table_assignment_verify',
             title: 'Table Assignment Verify',
             message,
             severity: 'low',
             status: 'active',
             relatedReservationIds: [res.id],
             fingerprint,
             createdAt: new Date().toISOString(),
             bookingDate: res.date
           });
        }
      });

      // D. Capacity alert check (85% capacity or higher for the entire restaurant based on total seats created on active tables)
      if (tables.length > 0) {
        const totalRestaurantCapacity = tables
          .filter(t => t.isActive !== false)
          .reduce((sum, t) => sum + (Number(t.seats) || 0), 0);

        if (totalRestaurantCapacity > 0) {
          const dateSessionMap = new globalThis.Map<string, Reservation[]>();

          reservations.forEach(res => {
            if (!res.date) return;
            if (res.isDeleted || res.isHistory) return;
            if (['cancelled', 'completed', 'no-show'].includes(res.status)) return;

            const session = getSessionFromTime(res.time, res.date, (res as any).manualSession);
            const key = `${res.date}_${session}`;
            if (!dateSessionMap.has(key)) dateSessionMap.set(key, []);
            dateSessionMap.get(key)!.push(res);
          });

          dateSessionMap.forEach((resList, key) => {
            const [date, session] = key.split('_');
            const totalGuests = resList.reduce((sum, r) => sum + (Number(r.guests) || 0), 0);
            const occupancyRate = Math.round((totalGuests / totalRestaurantCapacity) * 100);

            if (occupancyRate >= 85) {
              const fingerprint = `capacity_restaurant_${date}_${session}`;
              const sessionName = session === 'lunch' ? 'Lunch' : 'Dinner';
              newAlertsData.push({
                type: 'capacity_alert',
                title: 'Capacity Alert',
                message: `The restaurant reached ${occupancyRate}% capacity for ${sessionName} on ${formatDateStr(date)} (${totalGuests}/${totalRestaurantCapacity} guests).`,
                severity: 'low',
                status: 'active',
                relatedReservationIds: resList.map(r => r.id),
                fingerprint,
                createdAt: new Date().toISOString(),
                bookingDate: date
              });
            }
          });
        }
      }

      // Check existing alerts to avoid creating duplicates
      const alertsRef = collection(db, `smart_alerts`);
      const existingAlertsSnapshot = await getDocs(alertsRef);
      const existingAlerts = existingAlertsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as SmartAlert[];
      
      const newFingerprints = new Set(newAlertsData.map(a => a.fingerprint));

      for (const alertData of newAlertsData) {
        const existingAlert = existingAlerts.find(a => a.fingerprint === alertData.fingerprint);
        
        if (!existingAlert) {
          try {
            const safeId = encodeURIComponent(alertData.fingerprint).replace(/\./g, '_').replace(/%/g, '_');
            await setDoc(doc(db, `smart_alerts`, safeId), { ...alertData, id: safeId });
          } catch (e) {
            console.error("Failed to generate alert", e);
          }
        } else {
           const currentCount = existingAlert.relatedReservationIds?.length || 0;
           const newCount = alertData.relatedReservationIds.length;
              
           if (newCount !== currentCount || existingAlert.message !== alertData.message) {
             const updates: any = {
                relatedReservationIds: alertData.relatedReservationIds,
                message: alertData.message
             };
             if (newCount > currentCount && existingAlert.status !== 'active') {
                updates.status = 'active';
             }
             try {
                await updateDoc(doc(db, `smart_alerts`, existingAlert.id), updates);
             } catch (e) {
                console.error("Failed to update alert", e);
             }
           }
        }
      }

      for (const existingAlert of existingAlerts) {
         if (!newFingerprints.has(existingAlert.fingerprint) && existingAlert.status !== 'resolved' && ['duplicate_reservation', 'table_assignment_verify', 'time_conflict', 'capacity_alert'].includes(existingAlert.type)) {
             try {
                await updateDoc(doc(db, `smart_alerts`, existingAlert.id), { 
                  status: 'resolved',
                  resolvedAt: new Date().toISOString()
                });
             } catch (e) {
                console.error("Failed to mark alert as resolved", e);
             }
         }
      }

    });

    return () => unsubscribe();
  }, [isStaff, isAdmin, loading, settings, settingsLoading, tables, areas]);

  const deleteAlert = useCallback(async (alertId: string) => {
    if (!auth.currentUser) return;
    try {
      await deleteDoc(doc(db, `smart_alerts`, alertId));
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `smart_alerts/${alertId}`);
    }
  }, []);

  const dismissAlert = useCallback(async (alertId: string) => {
    if (!auth.currentUser) return;
    try {
      const alertRef = doc(db, `smart_alerts`, alertId);
      const now = new Date();
      const alertSnap = await getDoc(alertRef);
      const alertData = alertSnap.data() as SmartAlert | undefined;
      const alertDateStr = alertData?.bookingDate || (typeof alertData?.createdAt === 'string' ? alertData.createdAt.split('T')[0] : format(now, 'yyyy-MM-dd'));
      
      let expiresAt: string;
      try {
        const parsed = parseISO(alertDateStr);
        if (!isNaN(parsed.getTime())) {
          expiresAt = addDays(parsed, 3).toISOString();
        } else {
          expiresAt = addDays(now, 3).toISOString();
        }
      } catch {
        expiresAt = addDays(now, 3).toISOString();
      }
      
      await updateDoc(alertRef, {
        status: 'dismissed',
        dismissedAt: now.toISOString(),
        dismissedBy: auth.currentUser.uid,
        expiresAt
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `smart_alerts/${alertId}`);
    }
  }, []);

  const resolveAlert = useCallback(async (alertId: string) => {
    if (!auth.currentUser) return;
    try {
      const alertRef = doc(db, `smart_alerts`, alertId);
      const now = new Date();
      const alertSnap = await getDoc(alertRef);
      const alertData = alertSnap.data() as SmartAlert | undefined;
      const alertDateStr = alertData?.bookingDate || (typeof alertData?.createdAt === 'string' ? alertData.createdAt.split('T')[0] : format(now, 'yyyy-MM-dd'));
      
      let expiresAt: string;
      try {
        const parsed = parseISO(alertDateStr);
        if (!isNaN(parsed.getTime())) {
          expiresAt = addDays(parsed, 3).toISOString();
        } else {
          expiresAt = addDays(now, 3).toISOString();
        }
      } catch {
        expiresAt = addDays(now, 3).toISOString();
      }
      
      await updateDoc(alertRef, {
        status: 'resolved',
        resolvedAt: now.toISOString(),
        resolvedBy: auth.currentUser.uid,
        expiresAt
      });
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `smart_alerts/${alertId}`);
    }
  }, []);

  const activeAlerts = useMemo(() => {
    return alerts
      .filter(a => a.status === 'active')
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
  }, [alerts]);

  return { 
    smartAlerts: activeAlerts, 
    allSmartAlerts: alerts, 
    dismissAlert,
    resolveAlert,
    deleteAlert,
    loading 
  };
}
