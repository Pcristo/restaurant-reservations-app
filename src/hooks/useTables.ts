import { useState, useEffect } from 'react';
import { collection, onSnapshot, updateDoc, deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Table, Area } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

const generateFriendlyId = (text: string) => {
  if (!text) return '';
  return String(text)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');
};

export function useTables() {
  const [tables, setTables] = useState<Table[]>(() => {
    try {
      const cached = localStorage.getItem('cached_tables');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [areas, setAreas] = useState<Area[]>(() => {
    try {
      const cached = localStorage.getItem('cached_areas');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let tablesLoaded = false;
    let areasLoaded = false;

    const unsubscribeTables = onSnapshot(collection(db, 'tables'), (snapshot) => {
      const tablesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table));
      setTables(tablesData);
      try {
        localStorage.setItem('cached_tables', JSON.stringify(tablesData));
      } catch (e) {}
      tablesLoaded = true;
      if (areasLoaded) setLoading(false);
    }, (error) => {
      setLoading(false);
      handleFirestoreError(error, OperationType.LIST, 'tables');
    });

    const unsubscribeAreas = onSnapshot(collection(db, 'areas'), (snapshot) => {
      const areasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Area));
      areasData.sort((a, b) => (a.order || 0) - (b.order || 0));
      setAreas(areasData);
      try {
        localStorage.setItem('cached_areas', JSON.stringify(areasData));
      } catch (e) {}
      areasLoaded = true;
      if (tablesLoaded) setLoading(false);
    }, (error) => {
      // If the areas collection doesn't exist yet, we can gracefully default it to empty list
      setAreas((prev) => prev || []);
      areasLoaded = true;
      if (tablesLoaded) setLoading(false);
    });

    return () => {
      unsubscribeTables();
      unsubscribeAreas();
    };
  }, []);

  const addTable = async (table: Omit<Table, 'id'>) => {
    let friendlyId = 'table-' + generateFriendlyId(table.name || '');
    if (friendlyId === 'table-') friendlyId = 'table-' + Date.now();
    
    // Check if a table with this ID already exists, append a random string if it does to prevent overwriting
    // For simplicity just append random string if name exists
    friendlyId += '-' + Math.random().toString(36).substring(2, 6);
    
    await setDoc(doc(db, 'tables', friendlyId), { ...table, id: friendlyId });
  };

  const updateTable = async (id: string, table: Partial<Table>) => {
    const { id: _, ...data } = table as any;
    await updateDoc(doc(db, 'tables', id), data);
  };

  const deleteTable = async (id: string) => {
    await deleteDoc(doc(db, 'tables', id));
  };

  const addArea = async (area: Omit<Area, 'id'>) => {
    let friendlyId = generateFriendlyId(area.name || '');
    if (!friendlyId) friendlyId = 'area-' + Date.now();
    friendlyId += '-' + Math.random().toString(36).substring(2, 6);
    await setDoc(doc(db, 'areas', friendlyId), { ...area, id: friendlyId });
  };

  const updateArea = async (id: string, area: Partial<Area>) => {
    const { id: _, ...data } = area as any;
    await updateDoc(doc(db, 'areas', id), data);
  };

  const deleteArea = async (id: string) => {
    await deleteDoc(doc(db, 'areas', id));
  };

  return { tables, areas, loading, addTable, updateTable, deleteTable, addArea, updateArea, deleteArea };
}
