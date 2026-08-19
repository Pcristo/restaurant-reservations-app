import { jsonResponse, errorResponse } from '../../lib/response';
import { deleteUserFromAuth, lookupUserByEmail } from '../../lib/firebaseAdmin';

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const env = context.env || {};
    let { uid, email } = body;

    if (!uid && !email) {
      return errorResponse('Missing uid or email', 400);
    }

    if ((!uid || uid.length < 10) && email) {
      const lookup = await lookupUserByEmail(email, env);
      if (lookup.user && lookup.user.localId) {
        uid = lookup.user.localId;
      }
    }

    if (uid && uid.length >= 10) {
      const del = await deleteUserFromAuth(uid, env);
      if (!del.success) {
        return errorResponse(del.error || 'Failed to delete user', 400);
      }
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || 'Internal server error deleting user', 500);
  }
}
