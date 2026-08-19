// Edge-compatible Firebase Auth and Firestore REST API helpers

export function parseFirestoreFields(fields: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, val] of Object.entries(fields)) {
    if (val.stringValue !== undefined) result[key] = val.stringValue;
    else if (val.integerValue !== undefined) result[key] = parseInt(val.integerValue, 10);
    else if (val.doubleValue !== undefined) result[key] = parseFloat(val.doubleValue);
    else if (val.booleanValue !== undefined) result[key] = val.booleanValue;
    else if (val.mapValue?.fields !== undefined) result[key] = parseFirestoreFields(val.mapValue.fields);
    else if (val.nullValue !== undefined) result[key] = null;
    else if (val.arrayValue?.values !== undefined) {
      result[key] = val.arrayValue.values.map((v: any) => {
        if (v.stringValue !== undefined) return v.stringValue;
        if (v.integerValue !== undefined) return parseInt(v.integerValue, 10);
        if (v.mapValue?.fields !== undefined) return parseFirestoreFields(v.mapValue.fields);
        return v;
      });
    } else result[key] = val;
  }
  return result;
}

export async function getFirestoreSettings(env: Record<string, any> = {}): Promise<Record<string, any>> {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || 'AIzaSyCwz2rJuoFJTs5MaWz8Mt_lejyzThC2D_A';
  const projectId = env.VITE_FIREBASE_PROJECT_ID || env.FIREBASE_PROJECT_ID || 'ai-studio-applet-webapp-d8b8b';
  const databaseId = env.VITE_FIREBASE_DATABASE_ID || env.FIREBASE_DATABASE_ID || 'ai-studio-d300d625-58ae-4ec1-853a-8c66bbf46c83';

  const dbIds = [databaseId, '(default)'];
  for (const dbId of dbIds) {
    try {
      const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents/settings/main?key=${apiKey}`;
      const res = await fetch(url);
      if (res.ok) {
        const doc = await res.json();
        if (doc.fields) {
          return parseFirestoreFields(doc.fields);
        }
      }
    } catch (e) {
      // try next
    }
  }
  return {};
}

export async function deleteUserFromAuth(uid: string, env: Record<string, any> = {}): Promise<{ success: boolean; error?: string }> {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || 'AIzaSyCwz2rJuoFJTs5MaWz8Mt_lejyzThC2D_A';
  if (!apiKey) {
    return { success: false, error: 'Firebase API key is not configured.' };
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid })
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      // If user not found, treat as already deleted
      if (data?.error?.message === 'USER_NOT_FOUND') {
        return { success: true };
      }
      return { success: false, error: data?.error?.message || `Failed with status ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error communicating with Firebase Auth' };
  }
}

export async function lookupUserByEmail(email: string, env: Record<string, any> = {}): Promise<{ success: boolean; user?: any; error?: string }> {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || 'AIzaSyCwz2rJuoFJTs5MaWz8Mt_lejyzThC2D_A';
  if (!apiKey) {
    return { success: false, error: 'Firebase API key is not configured.' };
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: [email] })
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data?.error?.message === 'EMAIL_NOT_FOUND') {
        return { success: true, user: null };
      }
      return { success: false, error: data?.error?.message || `Failed with status ${res.status}` };
    }

    const user = data.users && data.users.length > 0 ? data.users[0] : null;
    return { success: true, user };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error communicating with Firebase Auth' };
  }
}

export async function updateUserPasswordInAuth(uid: string, newPassword: string, env: Record<string, any> = {}): Promise<{ success: boolean; error?: string }> {
  const apiKey = env.VITE_FIREBASE_API_KEY || env.FIREBASE_API_KEY || 'AIzaSyCwz2rJuoFJTs5MaWz8Mt_lejyzThC2D_A';
  if (!apiKey) {
    return { success: false, error: 'Firebase API key is not configured.' };
  }

  try {
    const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ localId: uid, password: newPassword })
    });

    const data: any = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data?.error?.message || `Failed with status ${res.status}` };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Error communicating with Firebase Auth' };
  }
}
