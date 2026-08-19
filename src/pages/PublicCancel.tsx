import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Reservation } from '../types';
import { useLanguage } from '../hooks/useLanguage';
import { XCircle, CheckCircle, Calendar, Users, Clock, ArrowLeft } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useSettings } from '../hooks/useSettings';
import { formatDisplayTime } from '../lib/utils';

export default function PublicCancel() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { settings } = useSettings();
  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<'idle' | 'cancelling' | 'success' | 'error'>('idle');

  useEffect(() => {
    async function fetchReservation() {
      if (!id) return;
      try {
        const docRef = doc(db, 'reservations', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setReservation({ id: docSnap.id, ...docSnap.data() } as Reservation);
        }
      } catch (error) {
        console.error('Error fetching reservation:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchReservation();
  }, [id]);

  const handleCancel = async () => {
    if (!id) return;
    setStatus('cancelling');
    try {
      const docRef = doc(db, 'reservations', id);
      await updateDoc(docRef, { status: 'cancelled' });
      
      if (reservation) {
        try {
          const { doc, setDoc } = await import('firebase/firestore');
          const alertId = 'alert-cancel-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
          const alertRef = doc(db, 'smart_alerts', alertId);
          await setDoc(alertRef, {
             id: alertId,
             type: 'cancelled_by_customer',
             title: 'Reservation Cancelled',
             message: `Customer ${(reservation.customerName || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')} cancelled their reservation for ${reservation.date.split('-').reverse().join('/')} at ${formatDisplayTime(reservation.time, settings)}.`,
             severity: 'medium',
             status: 'active',
             relatedReservationIds: [reservation.id],
             fingerprint: `cancel_${reservation.id}_${Date.now()}`,
             createdAt: new Date().toISOString(),
             bookingDate: reservation.date
          });
        } catch (alertErr) {
          console.error('Error generating cancellation alert:', alertErr);
        }
      }

      setReservation(prev => prev ? { ...prev, status: 'cancelled' } : null);
      setStatus('success');
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      setStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-500 font-medium">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  if (!reservation) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center">
          <XCircle size={64} className="mx-auto text-red-500 mb-6" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{t('public.error_title')}</h1>
          <p className="text-gray-600 mb-8">{t('res.no_res_found')}</p>
          <Link to="/" className="inline-flex items-center gap-2 text-amber-600 font-bold hover:underline">
            <ArrowLeft size={20} />
            {t('nav.book')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden">
        <div className="bg-amber-600 p-8 text-center text-white">
          <h1 className="text-2xl font-bold mb-2">{t('res.delete_title')}</h1>
          <p className="opacity-90">{t('public.book_desc')}</p>
        </div>

        <div className="p-8">
          {status === 'success' ? (
            <div className="text-center py-4">
              <CheckCircle size={64} className="mx-auto text-green-500 mb-6" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('res.cancelled')}</h2>
              <p className="text-gray-600 mb-8">{t('public.success_desc')}</p>
              <Link to="/" className="block w-full bg-amber-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-amber-700 transition-all">
                {t('nav.book')}
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-4 mb-8">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Calendar className="text-amber-600" size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t('common.date')}</p>
                    <p className="text-lg font-bold text-gray-900">{format(parseISO(reservation.date), 'dd/MM/yyyy')}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Clock className="text-amber-600" size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t('common.time')}</p>
                    <p className="text-lg font-bold text-gray-900">{reservation.time}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm">
                    <Users className="text-amber-600" size={24} />
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">{t('common.guests')}</p>
                    <p className="text-lg font-bold text-gray-900">{reservation.guests} {t('common.guests')}</p>
                  </div>
                </div>
              </div>

              {reservation.status === 'cancelled' ? (
                <div className="text-center p-4 bg-red-50 rounded-2xl border border-red-100">
                  <p className="text-red-700 font-bold">{t('res.cancelled')}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-gray-600 text-center px-4">
                    {t('res.delete_confirm')}
                  </p>
                  <button
                    onClick={handleCancel}
                    disabled={status === 'cancelling'}
                    className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-red-700 transition-all shadow-lg shadow-red-100 disabled:opacity-50"
                  >
                    {status === 'cancelling' ? t('common.loading') : t('res.delete_title')}
                  </button>
                  <Link to="/" className="block w-full text-center py-2 text-gray-500 font-bold hover:text-gray-700">
                    {t('common.cancel')}
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
