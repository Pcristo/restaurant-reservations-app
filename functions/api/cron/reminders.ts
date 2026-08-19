import { jsonResponse, errorResponse } from '../../lib/response';
import { buildReminderEmail } from '../../lib/emailTemplates';
import { sendEmailViaResend } from '../../lib/resend';
import { getFirestoreSettings, parseFirestoreFields } from '../../lib/firebaseAdmin';

export async function onRequest(context: any) {
  try {
    const env = context.env || {};
    const projectId = env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || 'ai-studio-applet-webapp-d8b8b';
    const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || 'AIzaSyCwz2rJuoFJTs5MaWz8Mt_lejyzThC2D_A';
    const databaseId = env.VITE_FIREBASE_DATABASE_ID || env.FIREBASE_DATABASE_ID || 'ai-studio-d300d625-58ae-4ec1-853a-8c66bbf46c83';

    if (!projectId || !apiKey) {
      return errorResponse('Firebase project configuration is missing in environment', 400);
    }

    // 1. Fetch settings
    const settings = await getFirestoreSettings(env);

    // 2. Query reservations
    const dbIds = [databaseId, '(default)'];
    let results: any[] = [];
    let activeDbId = databaseId;

    for (const dbId of dbIds) {
      try {
        const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents:runQuery?key=${apiKey}`;
        const queryBody = {
          structuredQuery: {
            from: [{ collectionId: 'reservations' }],
            where: {
              fieldFilter: {
                field: { fieldPath: 'reminderEmail.scheduled' },
                op: 'EQUAL',
                value: { booleanValue: true }
              }
            }
          }
        };

        const res = await fetch(queryUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryBody)
        });

        if (res.ok) {
          results = await res.json();
          activeDbId = dbId;
          break;
        }
      } catch (e) {
        // try next
      }
    }

    const now = new Date().toISOString();
    let processed = 0;
    let sent = 0;
    let failed = 0;

    for (const item of results) {
      if (!item.document) continue;
      processed++;
      const docPath = item.document.name;
      const id = docPath.split('/').pop();
      const fields = parseFirestoreFields(item.document.fields || {});

      // Check if reminder is sent or not scheduled
      if (fields.reminderEmail?.sent === true) continue;
      if (fields.reminderEmail?.scheduledFor && fields.reminderEmail.scheduledFor > now) continue;
      if (!['pending', 'booked', 'confirmed'].includes(fields.status)) continue;

      // Check if past reservation
      let isPastBooking = false;
      try {
        if (fields.date) {
          const resDateTimeStr = `${fields.date}T${fields.time || '00:00'}:00`;
          const resDateObj = new Date(resDateTimeStr);
          if (Date.now() - resDateObj.getTime() > 12 * 60 * 60 * 1000) {
            isPastBooking = true;
          }
        }
      } catch (e) {
        // ignore
      }

      if (isPastBooking) {
        // Mark as skipped in firestore
        await patchFirestoreDoc(projectId, activeDbId, apiKey, `reservations/${id}`, {
          'reminderEmail.scheduled': { booleanValue: false },
          'reminderEmail.sent': { booleanValue: false },
          'reminderEmail.skipped': { booleanValue: true },
          'reminderEmail.skippedReason': { stringValue: 'Reservation is in the past' }
        }, ['reminderEmail.scheduled', 'reminderEmail.sent', 'reminderEmail.skipped', 'reminderEmail.skippedReason']);
        continue;
      }

      // Generate and send reminder
      const { subject, html } = buildReminderEmail({
        email: fields.customerEmail || '',
        name: fields.customerName || 'Guest',
        date: fields.date,
        time: fields.time,
        guests: fields.guests || 2,
        restaurantName: settings?.name || settings?.restaurantName || 'DineMaster Pro',
        resendApiKey: settings?.resendApiKey || env.VITE_RESEND_API_KEY || env.RESEND_API_KEY || '',
        resendFromEmail: settings?.resendFromEmail || env.VITE_RESEND_FROM_EMAIL || env.RESEND_FROM_EMAIL || '',
        restaurantEmail: settings?.email || 'hello@dinemasterpro.com',
        restaurantPhone: settings?.phone || '+353 1 555 0100',
        restaurantAddress: settings?.address || '123 Example Street, Dublin, D01 XXXX, Ireland',
        timezone: settings?.timezone || 'Europe/Lisbon',
        logoUrl: settings?.logoUrl || (settings?.useCloudinary ? settings?.cloudinaryLogoUrl : '') || '',
        bookingNumber: fields.bookingNumber || id,
        language: fields.language || 'pt',
        table: fields.tableName,
        viewUrl: env.APP_URL ? `${env.APP_URL}/reservations/${fields.bookingNumber || id}` : undefined,
        cancelUrl: env.APP_URL ? `${env.APP_URL}/reservations/${fields.bookingNumber || id}/cancel` : undefined
      });

      const emailResult = await sendEmailViaResend({
        to: fields.customerEmail || '',
        subject,
        html,
        apiKey: settings?.resendApiKey || env.VITE_RESEND_API_KEY || env.RESEND_API_KEY || '',
        fromEmail: settings?.resendFromEmail || env.VITE_RESEND_FROM_EMAIL || env.RESEND_FROM_EMAIL || '',
        restaurantName: settings?.name || settings?.restaurantName || 'DineMaster Pro'
      }, env);

      if (emailResult.success) {
        sent++;
        await patchFirestoreDoc(projectId, activeDbId, apiKey, `reservations/${id}`, {
          'reminderEmail.scheduled': { booleanValue: false },
          'reminderEmail.sent': { booleanValue: true },
          'reminderEmail.sentAt': { stringValue: now },
          'reminderEmail.messageId': { stringValue: emailResult.messageId || '' }
        }, ['reminderEmail.scheduled', 'reminderEmail.sent', 'reminderEmail.sentAt', 'reminderEmail.messageId']);
      } else {
        failed++;
        const attempts = (fields.reminderEmail?.attempts || 0) + 1;
        const isPermanent = attempts >= 3;
        await patchFirestoreDoc(projectId, activeDbId, apiKey, `reservations/${id}`, {
          'reminderEmail.scheduled': { booleanValue: !isPermanent },
          'reminderEmail.failed': { booleanValue: isPermanent },
          'reminderEmail.attempts': { integerValue: String(attempts) },
          'reminderEmail.lastAttemptAt': { stringValue: now },
          'reminderEmail.error': { stringValue: emailResult.error || 'Failed to send' }
        }, ['reminderEmail.scheduled', 'reminderEmail.failed', 'reminderEmail.attempts', 'reminderEmail.lastAttemptAt', 'reminderEmail.error']);
      }
    }

    return jsonResponse({
      success: true,
      processed,
      sent,
      failed,
      timestamp: now
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Error in cron reminders handler', 500);
  }
}

async function patchFirestoreDoc(projectId: string, databaseId: string, apiKey: string, path: string, fields: Record<string, any>, updateMask: string[]) {
  const maskQuery = updateMask.map(m => `updateMask.fieldPaths=${encodeURIComponent(m)}`).join('&');
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents/${path}?key=${apiKey}&${maskQuery}`;
  
  await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields })
  });
}
