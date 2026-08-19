import { initializeApp } from 'firebase/app';
import { initializeFirestore, collection, getDocs, getDoc, updateDoc, doc, query, where } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import { sendReservationReminder } from './email';
import { APP_CONFIG } from '../constants';

let db: any = null;

try {
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    const app = initializeApp(config);
    db = initializeFirestore(app, {}, config.firestoreDatabaseId);
    console.log('Backend Firestore initialized for cron jobs.');
  }
} catch (err) {
  console.error('Error initializing backend Firestore:', err);
}

// Runs every 1 minute
export const startCronJobs = () => {
  if (!db) return;

  setInterval(async () => {
    try {
      const now = new Date().toISOString();
      const settingsSnap = await getDoc(doc(db, 'settings', 'main'));
      const settingsData = settingsSnap.exists() ? settingsSnap.data() : null;
      const autoSendManual = settingsData?.autoSendManualReservationsEmails === true;

      const q = query(
        collection(db, 'reservations'),
        where('reminderEmail.scheduled', '==', true),
        where('reminderEmail.sent', '==', false),
        where('status', 'in', ['pending', 'booked', 'confirmed'])
      );

      const snapshot = await getDocs(q);
      
      const promises: Promise<any>[] = [];

      snapshot.forEach((docSnap) => {
        promises.push((async () => {
          try {
            const data = docSnap.data();
            const isOnline = data.source === 'public';
            const shouldSendAutomated = isOnline || autoSendManual;

            if (!shouldSendAutomated) {
              // Skip automated reminder sending if manual reservation and auto-send is OFF
              return;
            }

            if (data.reminderEmail?.scheduledFor && data.reminderEmail.scheduledFor <= now) {
              // Check if the reservation is already long past (over 12 hours ago)
              let isPastBooking = false;
              try {
                if (data.date) {
                  const resDateTimeStr = `${data.date}T${data.time || '00:00'}:00`;
                  const resDateObj = new Date(resDateTimeStr);
                  if (Date.now() - resDateObj.getTime() > 12 * 60 * 60 * 1000) {
                    isPastBooking = true;
                  }
                }
              } catch (e) {
                // ignore
              }

              if (isPastBooking) {
                await updateDoc(doc(db, 'reservations', docSnap.id), {
                  reminderEmail: {
                    ...(data.reminderEmail || {}),
                    scheduled: false,
                    sent: false,
                    skipped: true,
                    skippedReason: 'Reservation is in the past'
                  }
                });
                return;
              }

              console.log(`[Cron] Processing reminder for reservation ${docSnap.id} (${data.customerName || 'Guest'})`);
              
              const timezone = settingsData?.timezone || 'Europe/Lisbon';
              const result = await sendReservationReminder({
                email: data.customerEmail || '',
                name: data.customerName,
                date: data.date,
                time: data.time,
                guests: data.guests,
                restaurantName: settingsData?.name || settingsData?.restaurantName || 'Nortada',
                resendApiKey: settingsData?.resendApiKey || process.env.RESEND_API_KEY || process.env.VITE_RESEND_API_KEY || '',
                resendFromEmail: settingsData?.resendFromEmail || process.env.RESEND_FROM_EMAIL || process.env.VITE_RESEND_FROM_EMAIL || '',
                restaurantEmail: settingsData?.email || APP_CONFIG.email,
                restaurantPhone: settingsData?.phone || APP_CONFIG.phone,
                restaurantAddress: settingsData?.address || APP_CONFIG.address,
                timezone: timezone,
                logoUrl: settingsData?.logoUrl || (settingsData?.useCloudinary ? settingsData?.cloudinaryLogoUrl : '') || '',
                bookingNumber: data.bookingNumber || data.id,
                language: data.language || 'pt',
                table: data.tableName,
                viewUrl: process.env.APP_URL ? `${process.env.APP_URL}/reservations/${data.bookingNumber || docSnap.id}` : undefined,
                cancelUrl: process.env.APP_URL ? `${process.env.APP_URL}/reservations/${data.bookingNumber || docSnap.id}/cancel` : undefined,
              });

              // Update doc
              if (result.success) {
                await updateDoc(doc(db, 'reservations', docSnap.id), {
                  reminderEmail: {
                    ...(data.reminderEmail || {}),
                    scheduled: false,
                    sent: true,
                    sentAt: now,
                    messageId: result.messageId || null,
                    error: null
                  }
                });
              } else {
                const attempts = ((data.reminderEmail as any)?.attempts || 0) + 1;
                const isPermanent = (result.status === 401 || result.status === 403) || attempts >= 3;
                
                console.warn(`[Cron] Could not send reminder to ${docSnap.id} (attempt ${attempts}): ${result.error}`);
                
                await updateDoc(doc(db, 'reservations', docSnap.id), {
                  reminderEmail: {
                    ...(data.reminderEmail || {}),
                    scheduled: !isPermanent,
                    failed: isPermanent,
                    attempts: attempts,
                    lastAttemptAt: now,
                    error: result.error || 'Failed to send'
                  }
                });
              }
            }
          } catch (docErr) {
            console.error(`[Cron] Error processing reservation ${docSnap.id}:`, docErr);
          }
        })());
      });

      await Promise.all(promises);
    } catch (err) {
      console.error('[Cron] Error in cron job execution:', err);
    }
  }, 60000); // 1 minute
};
