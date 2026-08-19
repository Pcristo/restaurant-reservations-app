import { jsonResponse, errorResponse } from '../../lib/response';
import { buildConfirmationEmail } from '../../lib/emailTemplates';
import { sendEmailViaResend } from '../../lib/resend';

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const env = context.env || {};

    if (!body.email) {
      return errorResponse('Recipient email address is required', 400);
    }

    const { subject, html } = buildConfirmationEmail(body);

    const result = await sendEmailViaResend({
      to: body.email,
      subject,
      html,
      apiKey: body.resendApiKey,
      fromEmail: body.resendFromEmail,
      restaurantName: body.restaurantName
    }, env);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to send confirmation email', result.status || 400);
    }

    return jsonResponse({
      success: true,
      messageId: result.messageId
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Internal server error sending confirmation email', 500);
  }
}
