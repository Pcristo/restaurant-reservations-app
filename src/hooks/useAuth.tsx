import React, { useState, useEffect, createContext, useContext } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut, 
  User as FirebaseUser,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updatePassword as firebaseUpdatePassword,
  sendPasswordResetEmail,
  sendEmailVerification
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, query, where, getDocs, deleteDoc, or } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { auth, db } from '../firebase';
import { User, UserRole } from '../types';
import { useLanguage } from './useLanguage';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (role?: UserRole, isSignup?: boolean) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string, name: string) => Promise<void>;
  logout: (silent?: boolean) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  isAdmin: boolean;
  isStaff: boolean;
  isCustomer: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const isCreatingUser = React.useRef(false);
  const { t, language } = useLanguage();

  const syncExistingCustomerDetails = async (uid: string, email: string, defaultName: string) => {
    try {
      if (!email) return;
      const emailLower = email.trim().toLowerCase();
      const customersRef = collection(db, 'customers');
      let existingData: any = {};
      let docsToDelete: string[] = [];

      try {
        const q = query(customersRef, where('email', '==', emailLower));
        const querySnapshot = await getDocs(q);

        querySnapshot.forEach((docSnap) => {
          if (docSnap.id !== uid) {
            const data = docSnap.data();
            existingData = {
              name: data.name || existingData.name || defaultName,
              phone: data.phone || existingData.phone || '',
              notes: data.notes || existingData.notes || '',
              isRegular: data.isRegular !== undefined ? data.isRegular : (existingData.isRegular || false),
              favoriteTables: data.favoriteTables || existingData.favoriteTables || [],
            };
            docsToDelete.push(docSnap.id);
          }
        });
      } catch (readErr) {
        console.warn('Could not read existing customer records (expected for non-admin during signup):', readErr);
      }

      // Create / Merge user customer record at their UID
      const baseName = (existingData.name || defaultName).split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
      const newId = 'reg_' + (baseName || 'user') + '_' + Math.random().toString(36).substring(2,6);

      const finalCustomerData = { 
        id: newId,
        authUid: uid,
        name: existingData.name || defaultName,
        email: email,
        phone: existingData.phone || '',
        notes: existingData.notes || '',
        isRegular: existingData.isRegular !== undefined ? existingData.isRegular : false,
        favoriteTables: existingData.favoriteTables || [],
        isRegistered: true
      };

      await setDoc(doc(db, 'customers', newId), finalCustomerData, { merge: true });

      // Delete duplicate customer entries that don't match the new UID
      for (const oldId of docsToDelete) {
        try {
          await deleteDoc(doc(db, 'customers', oldId));
        } catch (delErr) {
          console.error('Error deleting duplicate customer record:', delErr);
        }
      }

      // Now, update all existing reservations under this email to have the new customerUid
      const resRef = collection(db, 'reservations');
      const resQuery = query(resRef, where('customerEmail', '==', email));
      const resSnapshot = await getDocs(resQuery);

      for (const resDoc of resSnapshot.docs) {
        try {
          await setDoc(doc(db, 'reservations', resDoc.id), { customerUid: newId }, { merge: true });
        } catch (updErr) {
          console.error('Error updating reservation customerUid:', updErr);
        }
      }

      // Also try with lowercase or trimmed email fallback for reservations
      const allResQuery = query(resRef);
      const allResSnapshot = await getDocs(allResQuery);
      for (const resDoc of allResSnapshot.docs) {
        const resData = resDoc.data();
        if (resData.customerEmail?.trim().toLowerCase() === emailLower && resData.customerUid !== newId) {
          try {
            await setDoc(doc(db, 'reservations', resDoc.id), { customerUid: newId }, { merge: true });
          } catch (updErr) {
            console.error('Error updating reservation customerUid fallback:', updErr);
          }
        }
      }
    } catch (err) {
      console.error('Error syncing existing customer details:', err);
    }
  };

  useEffect(() => {
    let unsubscribeProfile: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }

      try {
        if (firebaseUser) {
          const userQ = query(collection(db, 'users'), where('authUid', '==', firebaseUser.uid));
          
          // Use onSnapshot for real-time profile updates
          unsubscribeProfile = onSnapshot(userQ, async (snap) => {
            try {
              if (!snap.empty) {
                const docSnap = snap.docs[0];
                isCreatingUser.current = false;
                const userData = docSnap.data() as User;
                // ... rest of existence logic ...
                const intendedRole = localStorage.getItem('intendedRole');
                const isEmailProvider = firebaseUser.providerData.some(p => p.providerId === 'password');

                // Only enforce email verification for customers
                if (isEmailProvider && !firebaseUser.emailVerified && userData.role === 'customer') {
                  const justSignedUp = localStorage.getItem('justSignedUp') === 'true';
                  await signOut(auth);
                  setUser(null);
                  if (justSignedUp) {
                    toast.success(t('auth.verify_email_sent'));
                    localStorage.removeItem('justSignedUp');
                  } else {
                    toast.error(t('auth.verify_email_first'));
                  }
                  setLoading(false);
                  return;
                }

                if (userData.status === 'inactive') {
                  await signOut(auth);
                  setUser(null);
                  toast.error(t('common.account_suspended') || 'Account suspended');
                  localStorage.removeItem('intendedRole');
                } else if (intendedRole === 'staff' && userData.role === 'customer') {
                  await signOut(auth);
                  setUser(null);
                  toast.error(language === 'pt' ? 'O acesso à área de Administração é restrito.' : 'Access to the Admin area is restricted.');
                  localStorage.removeItem('intendedRole');
                } else {
                  setUser({ id: docSnap.id, ...userData } as User);
                  if (userData.role === 'customer') {
                    syncExistingCustomerDetails(firebaseUser.uid, userData.email, userData.name || firebaseUser.displayName || 'Customer');
                  }
                  if (intendedRole) {
                    toast.success(t('auth.login_success') || 'Login successful');
                    localStorage.removeItem('intendedRole');
                  }
                }
                setLoading(false);
              } else {
                // Not found in users. Check if they are a customer (who are no longer stored in users)
                const custQ = query(collection(db, 'customers'), where('authUid', '==', firebaseUser.uid));
                const custSnap = await getDocs(custQ);
                
                if (!custSnap.empty) {
                  const custDoc = custSnap.docs[0];
                  const custData = custDoc.data();
                  
                  const isEmailProvider = firebaseUser.providerData.some(p => p.providerId === 'password');
                  if (isEmailProvider && !firebaseUser.emailVerified) {
                    await signOut(auth);
                    setUser(null);
                    toast.error(t('auth.verify_email_first'));
                    setLoading(false);
                    return;
                  }
                  
                  if (custData.status === 'inactive') {
                    await signOut(auth);
                    setUser(null);
                    toast.error(t('common.account_suspended') || 'Account suspended');
                    return;
                  }
                  
                  setUser({ 
                    id: custDoc.id,
                    email: custData.email,
                    name: custData.name,
                    role: 'customer',
                    status: custData.status || 'active'
                  });
                  setLoading(false);
                  return;
                }

                // If we are already in the process of creating, don't try again
                if (isCreatingUser.current) return;
                
                // Check for email verification for new signups (likely customers)
                const isEmailProvider = firebaseUser.providerData.some(p => p.providerId === 'password');
                if (isEmailProvider && !firebaseUser.emailVerified) {
                  const justSignedUp = localStorage.getItem('justSignedUp') === 'true';
                  await signOut(auth);
                  setUser(null);
                  if (justSignedUp) {
                    toast.success(t('auth.verify_email_sent'));
                    localStorage.removeItem('justSignedUp');
                  } else {
                    toast.error(t('auth.verify_email_first'));
                  }
                  setLoading(false);
                  return;
                }

                // Only attempt creation if truly missing
                const intendedRole = localStorage.getItem('intendedRole') as UserRole || 'customer';
                const isAdminEmail = firebaseUser.email === "pcristo35@gmail.com";
                const role: UserRole = isAdminEmail ? 'admin' : 'customer';
                
                // --- NEW LOGIC: ENFORCE REGISTRATION BEFORE LOGIN ---
                const isCancellingAccount = sessionStorage.getItem('isCancellingAccount') === 'true';

                if (isCancellingAccount) {
                  setLoading(false);
                  return;
                }

                if (role === 'customer' && !isEmailProvider && !isAdminEmail) {
                   const isGoogleSignup = localStorage.getItem('isGoogleSignup') === 'true';
                   localStorage.removeItem('isGoogleSignup'); // Clean up flag
                   if (!isGoogleSignup) {
                      // They are trying to login, but they never registered
                      await signOut(auth);
                      setUser(null);
                      if (intendedRole === 'staff') {
                         toast.error(language === 'pt' ? 'O acesso à área de Administração é restrito.' : 'Access to the Admin area is restricted.');
                      } else {
                         toast.error(t('login.no_account') || "Account not found. Please register first.");
                      }
                      setLoading(false);
                      return;
                   }
                }
                // ----------------------------------------------------
                
                const newId = firebaseUser.uid;

                const newUser: User = { 
                  id: newId,
                  authUid: firebaseUser.uid,
                  email: firebaseUser.email!, 
                  role, 
                  status: 'active',
                  name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Unknown'
                };

                isCreatingUser.current = true;
                try {
                  if (role !== 'customer') {
                    await setDoc(doc(db, 'users', newId), newUser);
                  }
                  // We also need to create a matching customer record if it's a customer
                  if (role === 'customer') {
                    await syncExistingCustomerDetails(firebaseUser.uid, newUser.email, newUser.name);
                  }
                } catch (createErr) {
                  console.error('Error creating user document:', createErr);
                  isCreatingUser.current = false;
                  setLoading(false);
                  return;
                }
                
                localStorage.removeItem('intendedRole');
                if (role === 'customer') {
                   const custQ2 = query(collection(db, 'customers'), where('authUid', '==', firebaseUser.uid));
                   const custSnap2 = await getDocs(custQ2);
                   if (!custSnap2.empty) {
                      const c = custSnap2.docs[0];
                      setUser({ id: c.id, email: c.data().email, name: c.data().name, role: 'customer', status: 'active' });
                   } else {
                      setUser({ id: firebaseUser.uid, email: newUser.email, name: newUser.name, role: 'customer', status: 'active' });
                   }
                   isCreatingUser.current = false;
                   setLoading(false);
                }
                // For non-customers, we wait for the next fire which will have exists() === true
              }
            } catch (err) {
              console.error('Error in profile listener:', err);
              setLoading(false);
            }
          }, (error) => {
            console.error('Profile listener error:', error);
            setLoading(false);
          });
        } else {
          setUser(null);
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        setUser(null);
        setLoading(false);
      }
    });

    return () => {

      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [t]);

  const signIn = async (role: UserRole = 'customer', isSignup: boolean = false) => {
    try {
      localStorage.setItem('intendedRole', role);
      if (isSignup) {
        localStorage.setItem('isGoogleSignup', 'true');
      } else {
        localStorage.removeItem('isGoogleSignup');
      }
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Sign in error:', error);
      toast.error(t('auth.login_error'));
    }
  };

  const signInWithEmail = async (email: string, pass: string) => {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error: any) {
      console.error('Sign in error:', error);
      let message = t('auth.login_error');
      
      if (error.code === 'auth/invalid-credential' || 
          error.code === 'auth/user-not-found' || 
          error.code === 'auth/wrong-password') {
        message = t('auth.invalid_credentials');
      } else if (error.message && !error.message.includes('Firebase:')) {
        message = error.message;
      }
      
      toast.error(message);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string, name: string) => {
    try {
      // Use customer role by default for email signup
      localStorage.setItem('intendedRole', 'customer');
      localStorage.setItem('justSignedUp', 'true');
      let result;
      try {
        result = await createUserWithEmailAndPassword(auth, email, pass);
      } catch (initialErr: any) {
        if (initialErr.code === 'auth/email-already-in-use') {
          // It's possible the user was deleted from the db but orphaned in Auth.
          // Let's attempt to cleanup the orphan and retry.
          try {
            const res = await fetch('/api/admin/delete-user-by-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email })
            });
            if (res.ok) {
              // Retry creation
              result = await createUserWithEmailAndPassword(auth, email, pass);
            } else {
              throw initialErr; // API failed, throw original error
            }
          } catch (cleanupErr) {
            throw initialErr; // Network/fetch failed, throw original error
          }
        } else {
          throw initialErr;
        }
      }
      
      const uid = result.user.uid;
      
      // Send verification email
      await sendEmailVerification(result.user);
      
      const newUser: User = {
        id: uid,
        email,
        name,
        role: 'customer',
        status: 'active'
      };

      // Do NOT save to 'users' for customer signup
      // await setDoc(doc(db, 'users', uid), newUser);
      await syncExistingCustomerDetails(uid, email, name);
    } catch (error: any) {
      console.error('Sign up error:', error);
      let message = t('auth.login_error');
      
      if (error.code === 'auth/email-already-in-use') {
        message = t('auth.email_in_use');
      } else if (error.message && !error.message.includes('Firebase:')) {
        message = error.message;
      }
      
      toast.error(message);
      throw error;
    }
  };

  const logout = async (silent: boolean = false) => {
    try {
      await signOut(auth);
      if (!silent) {
        toast.success(t('auth.logged_out'));
      }
    } catch (error) {
      console.error('Logout error:', error);
      if (!silent) {
        toast.error(t('auth.logout_error'));
      }
    }
  };

  const updatePassword = async (newPassword: string) => {
    if (!auth.currentUser) throw new Error('Not authenticated');
    try {
      await firebaseUpdatePassword(auth.currentUser, newPassword);
      toast.success(t('common.save_success'));
    } catch (error: any) {
      console.error('Update password error:', error);
      toast.error(error.message || t('res.cancel_error'));
      throw error;
    }
  };

  const resetPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      toast.success(t('public.success_title'));
    } catch (error: any) {
      console.error('Reset password error:', error);
      toast.error(error.message || t('res.cancel_error'));
      throw error;
    }
  };

  const isAdmin = user?.role === 'admin';
  const isStaff = user?.role === 'staff' || isAdmin;
  const isCustomer = user?.role === 'customer';

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      signIn, 
      signInWithEmail,
      signUpWithEmail,
      logout, 
      updatePassword,
      resetPassword,
      isAdmin, 
      isStaff, 
      isCustomer 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
