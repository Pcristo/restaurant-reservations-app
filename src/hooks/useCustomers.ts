import { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './useAuth';
import { Customer } from '../types';

const generateFriendlyId = (text: string) => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};


  const deleteCustomerAuth = async (id: string) => {
    try {
      const custDoc = await getDoc(doc(db, 'customers', id));
      if (custDoc.exists()) {
        const data = custDoc.data();
        if (data.authUid || data.email) {
          try {
            await fetch('/api/admin/delete-user', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ uid: data.authUid || null, email: data.email || null })
            });
          } catch (e) {
            console.error('Error deleting customer auth:', e);
          }
        }
      }
    } catch (err) {
      console.error('Error checking auth for customer:', err);
    }
  };

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const { isStaff, isAdmin, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || (!isStaff && !isAdmin)) {
      if (!authLoading) setLoading(false);
      return;
    }

    const unsubscribe = onSnapshot(collection(db, 'customers'), (snapshot) => {
      const customersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(customersData);
      setLoading(false);
    }, (error) => {
      console.error('Error in customers listener:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isStaff, isAdmin, authLoading]);

  const activeCustomers = customers.filter(c => !c.isDeleted && !c.isHistory);
  const deletedCustomers = customers.filter(c => c.isDeleted && !c.isHistory);
  const historyCustomers = customers.filter(c => c.isHistory);

  const addCustomer = async (customer: Omit<Customer, 'id'>) => {
    if (customer.email && customer.email.trim() !== '') {
      const emailLower = customer.email.trim().toLowerCase();
      // Check activeCustomers first for speed
      const existing = activeCustomers.find(c => c.email?.trim().toLowerCase() === emailLower);
      if (existing) {
        throw new Error("A customer with this email already exists.");
      }
      
      // Strict database check
      const qCust = query(collection(db, 'customers'), where('email', '==', emailLower));
      const snapCust = await getDocs(qCust);
      if (!snapCust.empty) {
        throw new Error("A customer with this email already exists in the database.");
      }
    }
    const cleanCustomer = Object.fromEntries(
      Object.entries(customer).filter(([_, v]) => v !== undefined)
    );
    
    let friendlyId = cleanCustomer.email ? generateFriendlyId(String(cleanCustomer.email).split('@')[0]) : (cleanCustomer.phone ? generateFriendlyId(String(cleanCustomer.phone)) : 'customer');
    if (!friendlyId) friendlyId = 'customer';
    // Append 4 random alphanumeric characters to prevent collision
    friendlyId += '-' + Math.random().toString(36).substring(2, 6);
    
    await setDoc(doc(db, 'customers', friendlyId), { 
      ...cleanCustomer, 
      id: friendlyId,
      createdAt: new Date().toISOString().split('T')[0] 
    });
  };

  const updateCustomer = async (id: string, customer: Partial<Customer>) => {
    if (customer.email && customer.email.trim() !== '') {
      const emailLower = customer.email.trim().toLowerCase();
      const existing = activeCustomers.find(c => c.email?.trim().toLowerCase() === emailLower && c.id !== id);
      if (existing) {
        throw new Error("A customer with this email already exists.");
      }

      // Strict database check
      const qCust = query(collection(db, 'customers'), where('email', '==', emailLower));
      const snapCust = await getDocs(qCust);
      let isDuplicate = false;
      snapCust.docs.forEach(docSnap => {
        if (docSnap.id !== id) isDuplicate = true;
      });
      if (isDuplicate) {
        throw new Error("A customer with this email already exists in the database.");
      }
    }
    const cleanCustomer = Object.fromEntries(
      Object.entries(customer).filter(([_, v]) => v !== undefined)
    );
    await updateDoc(doc(db, 'customers', id), cleanCustomer);
  };

  const deleteCustomer = async (id: string, soft: boolean = true) => {
    if (soft) {
      await updateDoc(doc(db, 'customers', id), { isDeleted: true });
    } else {
      await deleteCustomerAuth(id);
      await deleteDoc(doc(db, 'customers', id));
    }
  };

  const restoreCustomer = async (id: string) => {
    await updateDoc(doc(db, 'customers', id), { isDeleted: false, isHistory: false });
  };

  const moveToHistoryCustomer = async (id: string) => {
    await updateDoc(doc(db, 'customers', id), { isHistory: true });
  };

  const bulkMoveToHistoryCustomers = async (ids: string[]) => {
    await Promise.all(ids.map(id => updateDoc(doc(db, 'customers', id), { isHistory: true })));
  };

  const forceDeleteCustomer = async (id: string) => {
    await deleteCustomerAuth(id);
    await deleteDoc(doc(db, 'customers', id));
  };

  const bulkForceDeleteCustomers = async (ids: string[]) => {
    await Promise.all(ids.map(async (id) => {
      await deleteCustomerAuth(id);
      await deleteDoc(doc(db, 'customers', id));
    }));
  };

  const bulkRestoreCustomers = async (ids: string[]) => {
    await Promise.all(ids.map(id => updateDoc(doc(db, 'customers', id), { isDeleted: false, isHistory: false })));
  };

  return { 
    customers: activeCustomers, 
    allCustomers: customers,
    deletedCustomers,
    loading, 
    addCustomer, 
    updateCustomer, 
    deleteCustomer,
    restoreCustomer,
    forceDeleteCustomer,
    bulkForceDeleteCustomers,
    moveToHistoryCustomer,
    bulkMoveToHistoryCustomers,
    historyCustomers,
    bulkRestoreCustomers
  };
}
