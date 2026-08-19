import { jsonResponse, errorResponse } from '../../lib/response';
import { buildCancellationEmail } from '../../lib/emailTemplates';
import { sendEmailViaResend } from '../../lib/resend';
import { getFirestoreSettings } from '../../lib/firebaseAdmin';

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const env = context.env || {};

    if (!body.email) {
      return errorResponse('Recipient email address is required', 400);
    }

    let { resendApiKey, resendFromEmail, restaurantName, logoUrl, restaurantEmail, restaurantPhone, restaurantAddress, timezone } = body;
    
    if (!resendApiKey || !resendFromEmail || !restaurantName) {
      try {
        const settings = await getFirestoreSettings(env);
        if (!resendApiKey) resendApiKey = settings?.resendApiKey || env.VITE_RESEND_API_KEY || env.RESEND_API_KEY || '';
        if (!resendFromEmail) resendFromEmail = settings?.resendFromEmail || env.VITE_RESEND_FROM_EMAIL || env.RESEND_FROM_EMAIL || '';
        if (!restaurantName) restaurantName = settings?.name || settings?.restaurantName || 'DineMaster Pro';
        if (!logoUrl) logoUrl = settings?.logoUrl || (settings?.useCloudinary ? settings?.cloudinaryLogoUrl : '') || '';
        if (!restaurantEmail) restaurantEmail = settings?.email || '';
        if (!restaurantPhone) restaurantPhone = settings?.phone || '';
        if (!restaurantAddress) restaurantAddress = settings?.address || '';
        if (!timezone) timezone = settings?.timezone || 'Europe/Lisbon';
      } catch (e) {
        console.warn('[Cancellation Edge] Failed to fetch fallback settings:', e);
      }
    }

    const { subject, html } = buildCancellationEmail({
      ...body,
      resendApiKey,
      resendFromEmail,
      restaurantName,
      logoUrl,
      restaurantEmail,
      restaurantPhone,
      restaurantAddress,
      timezone
    });

    const result = await sendEmailViaResend({
      to: body.email,
      subject,
      html,
      apiKey: resendApiKey,
      fromEmail: resendFromEmail,
      restaurantName: restaurantName
    }, env);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to send cancellation email', result.status || 400);
    }

    return jsonResponse({
      success: true,
      messageId: result.messageId
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Internal server error sending cancellation email', 500);
  }
}
