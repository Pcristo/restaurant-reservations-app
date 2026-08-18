import { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, doc, deleteDoc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { initializeApp, getApps } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../firebase';
import { User } from '../types';
import firebaseConfig from '../../firebase-applet-config.json';

export function useUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as User))
        .filter(u => u.role !== 'customer');
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error('Error in users listener:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const updateUserRole = async (id: string, role: string) => {
    await updateDoc(doc(db, 'users', id), { role });
  };

  const updateUserStatus = async (id: string, status: 'active' | 'inactive') => {
    await updateDoc(doc(db, 'users', id), { status });
  };

  const updateUser = async (id: string, data: Partial<User>) => {
    await updateDoc(doc(db, 'users', id), data);
  };

  const addUser = async (userData: Omit<User, 'id'>, password?: string) => {
    if (password) {
      // Create or reuse a secondary app to avoid logging out the admin
      const secondaryApp = getApps().find(app => app.name === 'secondary') || initializeApp(firebaseConfig, 'secondary');
      const secondaryAuth = getAuth(secondaryApp);
      
      try {
        let result;
        try {
          result = await createUserWithEmailAndPassword(secondaryAuth, userData.email, password);
        } catch (initialErr: any) {
          if (initialErr.code === 'auth/email-already-in-use') {
            // It's possible the user was deleted from the db but orphaned in Auth.
            // Let's attempt to cleanup the orphan and retry.
            try {
              const res = await fetch('/api/admin/delete-user-by-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: userData.email })
              });
              if (res.ok) {
                // Retry creation
                result = await createUserWithEmailAndPassword(secondaryAuth, userData.email, password);
              } else {
                throw initialErr;
              }
            } catch (cleanupErr) {
               throw initialErr;
            }
          } else {
            throw initialErr;
          }
        }
        
        const uid = result.user.uid;
        let friendlyId = userData.email ? userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'user';
        friendlyId += '-' + Math.random().toString(36).substring(2, 6);
        const newId = friendlyId;
        await setDoc(doc(db, 'users', newId), {
          ...userData,
          id: newId,
          authUid: uid,
          createdAt: serverTimestamp(),
        });
        
        await signOut(secondaryAuth);
      } catch (error: any) {
        console.error('Error adding user:', error);
        throw error;
      }
    } else {
      // Logic for adding just the document (e.g. for Google users who will sign in later)
      // Note: This won't work for login unless they sign in with Google.
      // For now, let's assume if no password, it's just a placeholder.
      let friendlyId = userData.email ? userData.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'user';
      friendlyId += '-' + Math.random().toString(36).substring(2, 6);
      
      await setDoc(doc(db, 'users', friendlyId), {
        ...userData,
        id: friendlyId,
        createdAt: serverTimestamp(),
      });
    }
  };

  const deleteUser = async (id: string) => {
    try {
      let authUid = null;
      let email = null;
      
      const userDoc = await getDoc(doc(db, 'users', id));
      if (userDoc.exists()) {
        authUid = userDoc.data().authUid || userDoc.data().id; // fallback for legacy
        email = userDoc.data().email;
      }
      
      if (!authUid && !email) {
        const custDoc = await getDoc(doc(db, 'customers', id));
        if (custDoc.exists()) {
          authUid = custDoc.data().authUid;
          email = custDoc.data().email;
        }
      }

      if ((authUid && authUid.length > 10) || email) { 
        try {
          const res = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: authUid || null, email: email || null })
          });
          if (!res.ok) {
            console.error('Failed to delete auth user');
          }
        } catch (e) {
          console.error('Error calling delete API:', e);
        }
      }

      await deleteDoc(doc(db, 'users', id));
      await deleteDoc(doc(db, 'customers', id));
    } catch (err) {
      console.error('Error deleting user:', err);
      throw err;
    }
  };

  return { users, loading, updateUserRole, updateUserStatus, updateUser, addUser, deleteUser };
}
