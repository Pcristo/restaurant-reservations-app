import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Reservation } from '../types';

interface NotificationContextType {
  hasNewBookings: boolean;
  setHasNewBookings: (val: boolean) => void;
  newBookingsList: Reservation[];
  addNotificationBooking: (res: Reservation) => void;
  removeNotificationBooking: (id: string) => void;
  clearNotificationBookings: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [newBookingsList, setNewBookingsList] = React.useState<Reservation[]>(() => {
    const saved = localStorage.getItem('new_bookings_list');
    try {
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        const todayStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
        return parsed.filter(res => res.date >= todayStr);
      }
      return [];
    } catch (e) {
      return [];
    }
  });

  const [hasNewBookings, setHasNewBookings] = React.useState(() => {
    const saved = localStorage.getItem('new_bookings_list');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) && parsed.length > 0;
      } catch (e) {
        return false;
      }
    }
    return false;
  });

  React.useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }); // Gets YYYY-MM-DD in local time
    
    const valid = newBookingsList.filter(res => res.date >= todayStr);
    if (valid.length !== newBookingsList.length) {
      setNewBookingsList(valid);
      return; // The next render will handle the localStorage and state update
    }

    localStorage.setItem('new_bookings_list', JSON.stringify(newBookingsList));
    setHasNewBookings(newBookingsList.length > 0);
  }, [newBookingsList]);

  const addNotificationBooking = (res: Reservation) => {
    setNewBookingsList((prev) => {
      // Avoid duplicates
      if (prev.some((item) => item.id === res.id)) return prev;
      return [res, ...prev];
    });
  };

  const removeNotificationBooking = (id: string) => {
    setNewBookingsList((prev) => prev.filter((item) => item.id !== id));
  };

  const clearNotificationBookings = () => {
    setNewBookingsList([]);
  };

  return (
    <NotificationContext.Provider value={{ 
      hasNewBookings, 
      setHasNewBookings,
      newBookingsList,
      addNotificationBooking,
      removeNotificationBooking,
      clearNotificationBookings
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}

