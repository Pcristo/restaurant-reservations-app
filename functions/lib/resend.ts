import { getFromEmail } from './emailTemplates';
import { getFirestoreSettings } from './firebaseAdmin';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  apiKey?: string;
  fromEmail?: string;
  restaurantName?: string;
}

export async function sendEmailViaResend(payload: SendEmailPayload, env: Record<string, any> = {}): Promise<{ success: boolean; messageId?: string; error?: string; status?: number }> {
  let rawKey = (payload.apiKey || env.RESEND_API_KEY || '').trim();
  let rawFrom = payload.fromEmail || env.RESEND_FROM_EMAIL || '';
  let restName = payload.restaurantName;

  // Fallback: Check Firestore settings if API key or from email not provided
  if (!rawKey || rawKey === 'undefined' || rawKey === 'null') {
    try {
      const settings = await getFirestoreSettings(env);
      if (settings?.resendApiKey) {
        rawKey = settings.resendApiKey.trim();
      }
      if (!rawFrom && settings?.resendFromEmail) {
        rawFrom = settings.resendFromEmail.trim();
      }
      if (!restName && (settings?.name || settings?.restaurantName)) {
        restName = settings.name || settings.restaurantName;
      }
    } catch (e) {
      console.warn('[Resend Edge] Could not fetch settings fallback from Firestore:', e);
    }
  }

  if (!rawKey || rawKey === 'undefined' || rawKey === 'null') {
    return {
      success: false,
      error: 'RESEND_API_KEY is not configured in Cloudflare environment or settings.',
      status: 400
    };
  }

  const to = (payload.to || '').trim();
  if (!to || !to.includes('@')) {
    return {
      success: false,
      error: 'A valid recipient email address is required.',
      status: 400
    };
  }

  const from = getFromEmail(rawFrom, restName);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${rawKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to,
        subject: payload.subject,
        html: payload.html
      })
    });

    const data: any = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errMsg = data?.message || data?.error?.message || (typeof data === 'string' ? data : `Resend API rejected request with status ${res.status}`);
      return {
        success: false,
        error: errMsg,
        status: res.status
      };
    }

    return {
      success: true,
      messageId: data?.id,
      status: 200
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Network error communicating with Resend API',
      status: 500
    };
  }
}
