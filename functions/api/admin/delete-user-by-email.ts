import { jsonResponse, errorResponse } from '../../lib/response';
import { deleteUserFromAuth, lookupUserByEmail } from '../../lib/firebaseAdmin';

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const env = context.env || {};
    const { email } = body;

    if (!email) {
      return errorResponse('Missing email', 400);
    }

    const lookup = await lookupUserByEmail(email, env);
    if (lookup.user && lookup.user.localId) {
      const del = await deleteUserFromAuth(lookup.user.localId, env);
      if (!del.success) {
        return errorResponse(del.error || 'Failed to delete user', 400);
      }
    }

    return jsonResponse({ success: true });
  } catch (err: any) {
    return errorResponse(err?.message || 'Internal server error deleting user by email', 500);
  }
}
