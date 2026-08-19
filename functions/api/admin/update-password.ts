import { jsonResponse, errorResponse } from '../../lib/response';
import { updateUserPasswordInAuth } from '../../lib/firebaseAdmin';

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const env = context.env || {};
    const { uid, newPassword } = body;

    if (!uid || !newPassword) {
      return errorResponse('Missing uid or newPassword', 400);
    }

    if (newPassword.length < 6) {
      return errorResponse('Password must be at least 6 characters', 400);
    }

    const result = await updateUserPasswordInAuth(uid, newPassword, env);
    if (!result.success) {
      return errorResponse(result.error || 'Failed to update user password', 400);
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || 'Internal server error updating password', 500);
  }
}
