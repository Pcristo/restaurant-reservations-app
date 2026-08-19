import { jsonResponse, errorResponse } from '../lib/response';
import { sendSmsViaTwilio } from '../lib/twilio';

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const env = context.env || {};

    const result = await sendSmsViaTwilio(body, env);

    if (!result.success) {
      return errorResponse(result.error || 'Failed to send SMS', result.status || 400);
    }

    return jsonResponse({
      success: true,
      simulated: false,
      sid: result.sid
    });
  } catch (err: any) {
    return errorResponse(err?.message || 'Internal server error processing SMS', 500);
  }
}
