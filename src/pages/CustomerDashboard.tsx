import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, getDocs, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { db, auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { Reservation } from '../types';
import { format, parseISO, isAfter } from 'date-fns';
import { Calendar, Clock, Users, MapPin, XCircle, CheckCircle, AlertCircle, ChevronRight, ChevronLeft, Phone, Mail, Edit2, Trash2, MoreHorizontal } from 'lucide-react';
import { cn, formatDisplayTime } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { useSettings } from '../hooks/useSettings';

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';

import { toast } from 'react-hot-toast';

export default function CustomerDashboard() {
  const { user, logout, updatePassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { settings } = useSettings();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCancelConfirm, setShowCancelConfirm] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'upcoming' | 'cancelled' | 'past'>('all');
  const [pastPage, setPastPage] = useState(1);
  const [selectedUpcomingYear, setSelectedUpcomingYear] = useState<string>('all');
  const [selectedCancelledYear, setSelectedCancelledYear] = useState<string>('all');
  const [cancelledPage, setCancelledPage] = useState(1);
  const [selectedPastYear, setSelectedPastYear] = useState<string>('all');
  const itemsPerPage = 20;
  const [showCancelAccountConfirm, setShowCancelAccountConfirm] = useState(false);
  const [isCancellingAccount, setIsCancellingAccount] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  
  const [profile, setProfile] = useState({ 
    name: user?.name || '', 
    phone: user?.phone || '', 
    email: user?.email || '' 
  });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Initialize with available user context
    setProfile(prev => ({
      name: prev.name || user.name || '',
      phone: prev.phone || user.phone || '',
      email: prev.email || user.email || ''
    }));

    // Fetch profile
    const fetchProfile = async () => {
      try {
        let name = user.name || '';
        let email = user.email || '';
        let phone = user.phone || '';

        const docRef = doc(db, 'customers', user.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.name) name = data.name;
          if (data.email) email = data.email;
          if (data.phone) phone = data.phone;
        }

        // If phone is missing, try querying customers by authUid or email
        if (!phone) {
          try {
            if (user.authUid || user.id) {
              const qCust = query(collection(db, 'customers'), where('authUid', '==', user.authUid || user.id));
              const snapCust = await getDocs(qCust);
              if (!snapCust.empty) {
                const cData = snapCust.docs[0].data();
                if (cData.phone) phone = cData.phone;
                if (!name && cData.name) name = cData.name;
              }
            }
          } catch (e) {}
        }

        // If phone is still missing, try users/{user.id}
        if (!phone) {
          try {
            const userSnap = await getDoc(doc(db, 'users', user.id));
            if (userSnap.exists()) {
              const uData = userSnap.data();
              if (uData.phone) phone = uData.phone;
              if (uData.name && !name) name = uData.name;
              if (uData.email && !email) email = uData.email;
            }
          } catch (e) {}
        }

        setProfile({
          name: name || user.name || '',
          phone: phone || user.phone || '',
          email: email || user.email || ''
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
      }
    };

    fetchProfile();

    const reservationsMap = new Map<string, Reservation>();

    const updateAndSetReservations = () => {
      let resData = Array.from(reservationsMap.values());
      // Filter out reservations marked as deleted by customer
      resData = resData.filter(r => !(r as any).isDeletedByCustomer);
      // Sort by date and time (newest first)
      resData.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time}`);
        const dateB = new Date(`${b.date}T${b.time}`);
        return dateB.getTime() - dateA.getTime();
      });
      setReservations(resData);
      setLoading(false);
    };

    const qUid = query(
      collection(db, 'reservations'),
      where('customerUid', '==', user.id)
    );

    const unsubUid = onSnapshot(qUid, (snapshot) => {
      snapshot.docs.forEach(d => {
        reservationsMap.set(d.id, { id: d.id, ...d.data() } as Reservation);
      });
      updateAndSetReservations();
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reservations (customer uid filter)');
      setLoading(false);
    });

    let unsubEmail = () => {};
    if (user.email) {
      const qEmail = query(
        collection(db, 'reservations'),
        where('customerEmail', '==', user.email)
      );
      unsubEmail = onSnapshot(qEmail, (snapshot) => {
        snapshot.docs.forEach(d => {
          reservationsMap.set(d.id, { id: d.id, ...d.data() } as Reservation);
        });
        updateAndSetReservations();
      }, (error) => {
        console.warn('Error querying customer reservations by email:', error);
      });
    }

    return () => {
      unsubUid();
      unsubEmail();
    };
  }, [user]);

  const handleDeleteAllPast = async () => {
    try {
      const pastReservations = reservations.filter(r => r.status === 'cancelled' || r.status === 'completed' || !isAfter(parseISO(`${r.date}T${r.time}`), new Date()));
      await Promise.all(pastReservations.map(res => 
        updateDoc(doc(db, 'reservations', res.id), {
          isDeletedByCustomer: true,
          status: 'cancelled'
        })
      ));
      setShowDeleteAllConfirm(false);
      toast.success(language === 'pt' ? 'Histórico limpo com sucesso' : 'History cleared successfully');
    } catch (error) {
      console.error('Error deleting all reservations:', error);
      toast.error(language === 'pt' ? 'Falha ao remover histórico' : 'Failed to clear history');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reservations', id), {
        isDeletedByCustomer: true,
        status: 'cancelled'
      });
      setShowDeleteConfirm(null);
      toast.success(t('res.delete_success') || 'Reservation removed from your view.');
    } catch (error) {
      console.error('Error deleting reservation:', error);
      toast.error(t('res.delete_error') || 'Failed to remove reservation.');
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await updateDoc(doc(db, 'reservations', id), {
        status: 'cancelled'
      });
      
      const res = reservations.find(r => r.id === id);
      if (res) {
        try {
          const alertId = 'alert-cancel-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
          const alertRef = doc(db, 'smart_alerts', alertId);
          await setDoc(alertRef, {
             id: alertId,
             type: 'cancelled_by_customer',
             title: 'Reservation Cancelled',
             message: `Customer ${(res.customerName || '').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')} cancelled their reservation for ${res.date.split('-').reverse().join('/')} at ${formatDisplayTime(res.time, settings)}.`,
             severity: 'medium',
             status: 'active',
             relatedReservationIds: [res.id],
             fingerprint: `cancel_${res.id}_${Date.now()}`,
             createdAt: new Date().toISOString(),
             bookingDate: res.date
          });
        } catch (alertErr) {
          console.error('Error generating cancellation alert:', alertErr);
        }
      }

      setShowCancelConfirm(null);
      toast.success(t('res.cancel_success'));
    } catch (error) {
      console.error('Error cancelling reservation:', error);
      toast.error(t('res.cancel_error'));
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (password || confirmPassword) {
      if (password !== confirmPassword) {
        toast.error(language === 'pt' ? 'As palavras-passe não coincidem' : 'Passwords do not match');
        return;
      }
      if (password.length < 6) {
        toast.error(language === 'pt' ? 'A palavra-passe deve ter pelo menos 6 caracteres' : 'Password must be at least 6 characters');
        return;
      }
    }

    setIsSavingProfile(true);
    try {
      // Check email uniqueness before saving
      if (profile.email && profile.email.trim() !== '' && profile.email.toLowerCase() !== user.email?.toLowerCase()) {
        const emailLower = profile.email.trim().toLowerCase();
        const qCust = query(collection(db, 'customers'), where('email', '==', emailLower));
        const snapCust = await getDocs(qCust);
        
        let isDuplicate = false;
        snapCust.docs.forEach(docSnap => {
          if (docSnap.id !== user.id) isDuplicate = true;
        });

        if (isDuplicate) {
          toast.error(language === 'pt' ? 'Já existe um cliente com este e-mail.' : 'A customer with this email already exists.');
          setIsSavingProfile(false);
          return;
        }
      }

      if (password) {
        try {
          await updatePassword(password);
        } catch (pwError: any) {
          // If requires recent login, show specific error
          if (pwError.code === 'auth/requires-recent-login') {
            toast.error(language === 'pt' ? 'Por favor, faça login novamente para alterar a sua palavra-passe.' : 'Please log in again to change your password.');
            setIsSavingProfile(false);
            return;
          }
          throw pwError; // Let outer catch handle it
        }
      }

      // Use setDoc with merge: true to save profile in customers
      await setDoc(doc(db, 'customers', user.id), { 
        ...profile, 
        id: user.id, 
        authUid: user.authUid || user.id,
        isRegistered: true 
      }, { merge: true });

      // Mirror in users collection
      try {
        await setDoc(doc(db, 'users', user.id), { 
          id: user.id,
          authUid: user.authUid || user.id,
          name: profile.name,
          email: profile.email,
          phone: profile.phone,
          role: 'customer',
          status: 'active'
        }, { merge: true });
      } catch (userErr) {
        console.warn('Could not mirror profile in users collection:', userErr);
      }
      
      setIsEditingProfile(false);
      toast.success(t('profile.save_success'));
      setPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error(t('profile.save_error'));
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCancelAccount = async () => {
    if (!user) return;
    setIsCancellingAccount(true);
    sessionStorage.setItem('isCancellingAccount', 'true');
    try {
      // 1. Delete Firestore records
      await deleteDoc(doc(db, 'users', user.id));
      await deleteDoc(doc(db, 'customers', user.id));
      
      // 2. Try to delete the actual Auth user (if session is fresh enough)
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          await currentUser.delete();
        } catch (authErr) {
          console.warn('Could not delete Firebase Auth user, proceeding with sign out:', authErr);
        }
      }
      
      toast.success(language === 'pt' ? 'Conta cancelada com sucesso.' : 'Account cancelled successfully.');
      setShowCancelAccountConfirm(false);
      await logout(true);
      sessionStorage.removeItem('isCancellingAccount');
      navigate('/');
    } catch (error) {
      console.error('Error cancelling account:', error);
      toast.error(language === 'pt' ? 'Erro ao cancelar conta.' : 'Error cancelling account.');
    } finally {
      setIsCancellingAccount(false);
    }
  };

  const getStatusBadge = (status: Reservation['status']) => {
    const styles = {
      pending: "bg-amber-100 text-amber-700",
      booked: "bg-blue-100 text-blue-700",
      confirmed: "bg-green-100 text-green-700",
      delayed: "bg-orange-100 text-orange-700",
      arrived: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
      completed: "bg-yellow-100 text-yellow-800",
      'no-show': "bg-gray-100 text-gray-700",
      blocked: "bg-gray-200 text-gray-400",
      'waiting-list': "bg-gray-100 text-gray-700 border border-gray-200/50"
    };
    return (
      <span className={cn("px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider", styles[status])}>
        {t(`res.${status}`)}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto py-12 px-4 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-amber-600 border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-gray-500 font-medium">{t('common.loading')}</p>
      </div>
    );
  }

  const upcomingRaw = reservations.filter(r => r.status !== 'cancelled' && r.status !== 'completed' && isAfter(parseISO(`${r.date}T${r.time}`), new Date()));
  const cancelledRaw = reservations.filter(r => r.status === 'cancelled');
  const completedRaw = reservations.filter(r => r.status === 'completed' || (r.status !== 'cancelled' && !isAfter(parseISO(`${r.date}T${r.time}`), new Date())));
  const pastRaw = reservations.filter(r => r.status === 'cancelled' || r.status === 'completed' || !isAfter(parseISO(`${r.date}T${r.time}`), new Date()));
  
  const upcomingYears = Array.from(new Set(upcomingRaw.map(r => r.date.substring(0, 4)))).sort((a, b) => b.localeCompare(a));
  const cancelledYears = Array.from(new Set(cancelledRaw.map(r => r.date.substring(0, 4)))).sort((a, b) => b.localeCompare(a));
  const pastYears = Array.from(new Set(pastRaw.map(r => r.date.substring(0, 4)))).sort((a, b) => b.localeCompare(a));
  
  const upcoming = selectedUpcomingYear === 'all' ? upcomingRaw : upcomingRaw.filter(r => r.date.startsWith(selectedUpcomingYear));
  const cancelled = selectedCancelledYear === 'all' ? cancelledRaw : cancelledRaw.filter(r => r.date.startsWith(selectedCancelledYear));
  const past = selectedPastYear === 'all' ? pastRaw : pastRaw.filter(r => r.date.startsWith(selectedPastYear));
  const completed = selectedPastYear === 'all' ? completedRaw : completedRaw.filter(r => r.date.startsWith(selectedPastYear));

  return (
    <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-12">
        <div>
          <p className="text-amber-600 font-bold mb-1">{t('dashboard.welcome_back')} {profile.name || user?.name}</p>
          <h1 className="text-4xl font-black text-gray-900 mb-2">{t('nav.my_bookings')}</h1>
          <p className="text-gray-500 text-lg">{t('dashboard.manage_bookings_desc')}</p>
        </div>
        <Link
          to="/?scrollTo=booking"
          className="inline-flex items-center justify-center gap-2 bg-amber-600 text-white px-6 py-3.5 rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 text-base shrink-0 self-start sm:self-auto cursor-pointer"
        >
          <Calendar size={18} />
          {t('res.book_table')}
          <ChevronRight size={18} />
        </Link>
      </div>

      {/* Profile Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 mb-12">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <div className="w-2 h-8 bg-blue-500 rounded-full" />
              {t('profile.title')}
            </h2>
            <p className="text-sm text-gray-500 mt-1">{t('profile.desc')}</p>
          </div>
          {!isEditingProfile && (
            <div className="flex gap-2 relative">
              <button
                onClick={() => { setPassword(''); setConfirmPassword(''); setIsEditingProfile(true); }}
                className="px-4 py-2 text-amber-600 font-bold hover:bg-amber-50 rounded-xl transition-all flex items-center gap-2 cursor-pointer"
              >
                <Edit2 size={18} />
                {t('common.edit')}
              </button>
              
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
                >
                  <MoreHorizontal size={20} />
                </button>
                
                {showProfileMenu && (
                  <>
                    <div 
                      className="fixed inset-0 z-10" 
                      onClick={() => setShowProfileMenu(false)}
                    />
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg shadow-gray-200/50 border border-gray-100 py-1 z-20">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          setShowCancelAccountConfirm(true);
                        }}
                        className="w-full text-left px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors cursor-pointer"
                      >
                        <Trash2 size={16} />
                        {language === 'pt' ? 'Cancelar Conta' : 'Cancel Account'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {isEditingProfile ? (
          <form onSubmit={handleSaveProfile} className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
              <input
                required
                type="text"
                value={profile.name}
                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
              <div className="w-full px-4 py-2.5 border border-gray-200 rounded-2xl focus-within:ring-2 focus-within:ring-amber-500 outline-none transition-all flex items-center bg-white">
                <PhoneInput
                  defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                  value={profile.phone}
                  onChange={(val) => setProfile({ ...profile, phone: val || '' })}
                  className="w-full outline-none text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email')}</label>
              <input
                required
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
              />
            </div>
            
            <div className="md:col-span-3 mt-2 mb-1">
              <h4 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">
                {language === 'pt' ? 'Alterar Palavra-passe (Opcional)' : 'Change Password (Optional)'}
              </h4>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {language === 'pt' ? 'Nova Palavra-passe' : 'New Password'}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {language === 'pt' ? 'Confirmar Palavra-passe' : 'Confirm Password'}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-amber-500 outline-none transition-all"
              />
            </div>
            <div className="md:col-span-3 flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSavingProfile}
                className="bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 disabled:opacity-50"
              >
                {isSavingProfile ? t('common.loading') : t('common.save')}
              </button>
              <button
                type="button"
                onClick={() => { setPassword(''); setConfirmPassword(''); setIsEditingProfile(false); }}
                className="bg-gray-100 text-gray-700 px-8 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-all"
              >
                {t('common.cancel')}
              </button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
              <div className="w-12 h-12 bg-white shadow-sm text-amber-600 rounded-xl flex items-center justify-center">
                <Users size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('common.name')}</p>
                <p className="font-bold text-gray-900">{profile.name || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl">
              <div className="w-12 h-12 bg-white shadow-sm text-amber-600 rounded-xl flex items-center justify-center">
                <Phone size={24} />
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('common.phone')}</p>
                <p className="font-bold text-gray-900">{profile.phone || '—'}</p>
              </div>
            </div>
            <div className="relative">
              {user?.authProvider === 'google' && (
                <div className="absolute -top-3 right-4 bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold flex items-center gap-1.5 border border-blue-100 shadow-sm z-10">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/></svg>
                  {language === 'pt' ? 'Registado com Google' : 'Registered with Google'}
                </div>
              )}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-2xl h-full">
                <div className="w-12 h-12 bg-white shadow-sm text-amber-600 rounded-xl flex items-center justify-center shrink-0">
                  <Mail size={24} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('common.email')}</p>
                  <p className="font-bold text-gray-900 truncate">{profile.email || '—'}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {reservations.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
          <div className="w-20 h-20 bg-gray-50 text-gray-300 rounded-full flex items-center justify-center mx-auto mb-6">
            <Calendar size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">{t('res.no_bookings')}</h2>
          <p className="text-gray-500 mb-8">{t('res.no_bookings_yet')}</p>
          <Link 
            to="/?scrollTo=booking" 
            className="inline-flex items-center gap-2 bg-amber-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 cursor-pointer"
          >
            {t('res.book_table')}
            <ChevronRight size={20} />
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Filter Tabs Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => { setFilterTab('all'); setPastPage(1); setCancelledPage(1); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer",
                filterTab === 'all'
                  ? "bg-gray-900 text-white shadow-md shadow-gray-900/10"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {language === 'pt' ? 'Todas' : 'All'} ({reservations.length})
            </button>
            <button
              onClick={() => { setFilterTab('upcoming'); setPastPage(1); setCancelledPage(1); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer",
                filterTab === 'upcoming'
                  ? "bg-amber-600 text-white shadow-md shadow-amber-600/20"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {language === 'pt' ? 'Próximas' : 'Upcoming'} ({upcomingRaw.length})
            </button>
            <button
              onClick={() => { setFilterTab('cancelled'); setPastPage(1); setCancelledPage(1); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer",
                filterTab === 'cancelled'
                  ? "bg-red-600 text-white shadow-md shadow-red-600/20"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {language === 'pt' ? 'Canceladas' : 'Cancelled'} ({cancelledRaw.length})
            </button>
            <button
              onClick={() => { setFilterTab('past'); setPastPage(1); setCancelledPage(1); }}
              className={cn(
                "px-4 py-2.5 rounded-2xl text-sm font-bold transition-all whitespace-nowrap cursor-pointer",
                filterTab === 'past'
                  ? "bg-gray-700 text-white shadow-md shadow-gray-700/10"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              )}
            >
              {language === 'pt' ? 'Concluídas / Passadas' : 'Completed / Past'} ({completedRaw.length})
            </button>
          </div>

          {/* Upcoming Section */}
          {(filterTab === 'all' || filterTab === 'upcoming') && upcomingRaw.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-8 bg-amber-500 rounded-full" />
                  {t('dashboard.upcoming')} ({upcoming.length})
                </h2>
                {upcomingYears.length > 0 && (
                  <select
                    value={selectedUpcomingYear}
                    onChange={(e) => setSelectedUpcomingYear(e.target.value)}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="all">{language === 'pt' ? 'Todos os Anos' : 'All Years'}</option>
                    {upcomingYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 gap-6">
                {upcoming.map((res) => (
                  <div key={res.id} className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="flex flex-col md:flex-row justify-between gap-6">
                      <div className="flex-grow space-y-4">
                        <div className="flex items-center justify-between md:justify-start md:gap-4">
                          {getStatusBadge(res.status)}
                          {res.bookingNumber && settings?.enableBookingNumber !== false && (
                            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[10.5px] font-mono font-bold uppercase rounded-md border border-gray-200">
                              {res.bookingNumber}
                            </span>
                          )}
                          <div className="flex items-center gap-2 text-gray-500 font-medium">
                            <Calendar size={18} className="text-amber-600" />
                            {format(parseISO(res.date), 'dd/MM/yyyy')}
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                              <Clock size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('common.time')}</p>
                              <p className="font-bold text-gray-900">{formatDisplayTime(res.time, settings)}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-400">
                              <Users size={20} />
                            </div>
                            <div>
                              <p className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{t('common.guests')}</p>
                              <p className="font-bold text-gray-900">{res.guests} {t('common.guests')}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center gap-3">
                        {res.status !== 'cancelled' && (
                          <button
                            onClick={() => setShowCancelConfirm(res.id)}
                            className="flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-2xl transition-colors cursor-pointer"
                          >
                            <XCircle size={18} />
                            {t('res.cancel')}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* If upcoming filter selected but 0 upcoming */}
          {filterTab === 'upcoming' && upcomingRaw.length === 0 && (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
              <Calendar size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 font-bold mb-4">{language === 'pt' ? 'Não existem reservas futuras ativas.' : 'No upcoming bookings found.'}</p>
              <Link 
                to="/?scrollTo=booking" 
                className="inline-flex items-center gap-2 bg-amber-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-amber-700 transition-all text-sm"
              >
                {t('res.book_table')}
                <ChevronRight size={16} />
              </Link>
            </div>
          )}

          {/* Cancelled Section */}
          {(filterTab === 'all' || filterTab === 'cancelled') && cancelledRaw.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-8 bg-red-500 rounded-full" />
                  {language === 'pt' ? 'Reservas Canceladas' : 'Cancelled Bookings'} ({cancelled.length})
                </h2>
                {cancelledYears.length > 0 && (
                  <select
                    value={selectedCancelledYear}
                    onChange={(e) => setSelectedCancelledYear(e.target.value)}
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="all">{language === 'pt' ? 'Todos os Anos' : 'All Years'}</option>
                    {cancelledYears.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {cancelled.map((res) => (
                  <div key={res.id} className="bg-red-50/30 rounded-2xl p-5 border border-red-100 flex items-center justify-between group hover:bg-red-50/50 transition-colors">
                    <div className="flex items-center gap-6">
                      <div className="text-center min-w-[80px] bg-white rounded-xl py-2 px-3 border border-red-100">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{format(parseISO(res.date), 'yyyy')}</p>
                        <p className="text-xs font-bold text-red-600 uppercase">{format(parseISO(res.date), 'MMM')}</p>
                        <p className="text-2xl font-black text-gray-900">{format(parseISO(res.date), 'dd')}</p>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          {getStatusBadge('cancelled')}
                          {res.bookingNumber && settings?.enableBookingNumber !== false && (
                            <span className="px-2 py-0.5 bg-white text-gray-700 text-[10px] font-mono font-bold uppercase rounded-md border border-red-100">
                              {res.bookingNumber}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-700 font-medium">
                          <span className="flex items-center gap-1 font-bold text-gray-900">
                            <Clock size={15} className="text-gray-400" />
                            {formatDisplayTime(res.time, settings)}
                          </span>
                          <span className="text-gray-300">•</span>
                          <span className="flex items-center gap-1">
                            <Users size={15} className="text-gray-400" />
                            {res.guests} {t('common.guests')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowDeleteConfirm(res.id)}
                      className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-100/50 rounded-xl transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                      title={t('res.delete_forever')}
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* If cancelled filter selected but 0 cancelled */}
          {filterTab === 'cancelled' && cancelledRaw.length === 0 && (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
              <CheckCircle size={32} className="mx-auto text-emerald-500 mb-3" />
              <p className="text-gray-600 font-bold">{language === 'pt' ? 'Não existem reservas canceladas.' : 'No cancelled bookings.'}</p>
            </div>
          )}

          {/* Past / Completed Section */}
          {(filterTab === 'all' || filterTab === 'past') && (filterTab === 'past' ? completedRaw.length > 0 : completedRaw.length > 0) && (
            <section className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <div className="w-2 h-8 bg-gray-300 rounded-full" />
                  {language === 'pt' ? 'Reservas Concluídas / Histórico' : 'Completed / Past Bookings'} ({completed.length})
                </h2>
                <div className="flex items-center gap-3">
                  {pastYears.length > 0 && (
                    <select
                      value={selectedPastYear}
                      onChange={(e) => {
                        setSelectedPastYear(e.target.value);
                        setPastPage(1);
                      }}
                      className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-gray-100 border border-gray-200 text-gray-700 outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      <option value="all">{language === 'pt' ? 'Todos os Anos' : 'All Years'}</option>
                      {pastYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  )}
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-gray-100 hover:bg-red-50 text-gray-500 hover:text-red-600 transition-colors flex items-center gap-1.5 border border-gray-200 hover:border-red-200 cursor-pointer"
                    title={language === 'pt' ? 'Limpar Histórico' : 'Clear History'}
                  >
                    <Trash2 size={14} />
                    {language === 'pt' ? 'Limpar Tudo' : 'Clear All'}
                  </button>
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={pastPage}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="grid grid-cols-1 gap-4 opacity-75"
                >
                  {completed.slice((pastPage - 1) * itemsPerPage, pastPage * itemsPerPage).map((res) => (
                    <div key={res.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-center justify-between group">
                      <div className="flex items-center gap-6">
                        <div className="text-center min-w-[80px]">
                          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{format(parseISO(res.date), 'yyyy')}</p>
                          <p className="text-xs font-bold text-gray-400 uppercase">{format(parseISO(res.date), 'MMM')}</p>
                          <p className="text-2xl font-black text-gray-900">{format(parseISO(res.date), 'dd')}</p>
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            {res.bookingNumber && settings?.enableBookingNumber !== false && (
                              <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 text-[9.5px] font-mono font-bold uppercase rounded-md border border-gray-200">
                                {res.bookingNumber}
                              </span>
                            )}
                            <p className="font-bold text-gray-900">{formatDisplayTime(res.time, settings)}</p>
                            <span className="text-gray-300">•</span>
                            <p className="text-sm text-gray-500">{res.guests} {t('common.guests')}</p>
                          </div>
                          {getStatusBadge(res.status)}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowDeleteConfirm(res.id)}
                        className="p-3 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                        title={t('res.delete_forever')}
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              </AnimatePresence>
              {completed.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-6 px-4">
                  <p className="text-sm text-gray-500 font-medium">
                    {language === 'pt' ? 'Página' : 'Page'} {pastPage} {language === 'pt' ? 'de' : 'of'} {Math.max(1, Math.ceil(completed.length / itemsPerPage))}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setPastPage(p => Math.max(1, p - 1));
                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 250);
                      }}
                      disabled={pastPage === 1}
                      className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <button
                      onClick={() => {
                        setPastPage(p => Math.min(Math.ceil(completed.length / itemsPerPage), p + 1));
                        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 250);
                      }}
                      disabled={pastPage >= Math.ceil(completed.length / itemsPerPage)}
                      className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* If past filter selected but 0 past */}
          {filterTab === 'past' && completedRaw.length === 0 && (
            <div className="bg-white rounded-3xl p-8 text-center border border-gray-100 shadow-sm">
              <Calendar size={32} className="mx-auto text-gray-400 mb-3" />
              <p className="text-gray-600 font-bold">{language === 'pt' ? 'Não existem reservas passadas.' : 'No past bookings found.'}</p>
            </div>
          )}
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
              {language === 'pt' ? 'Limpar Histórico' : 'Clear History'}
            </h3>
            <p className="text-gray-500 text-center mb-8">
              {language === 'pt' ? (
                <>Tem a certeza de que pretende eliminar todo o histórico de reservas? Esta ação é permanente e não pode ser desfeita.</>
              ) : (
                <>Are you sure you want to delete all reservation history? This action is permanent and cannot be undone.</>
              )}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleDeleteAllPast}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setShowDeleteAllConfirm(false)}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <Trash2 size={32} />
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
              {language === 'pt' ? 'Eliminar Histórico de Reservas' : 'Delete Reservation History'}
            </h3>
            <p className="text-gray-500 text-center mb-8">
              {language === 'pt' ? (
                <>Tem a certeza de que pretende eliminar este histórico de reservas? Esta ação é permanente e não pode ser desfeita.</>
              ) : (
                <>Are you sure you want to delete this reservation history? This action is permanent and cannot be undone.</>
              )}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                {t('common.delete')}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">{t('res.delete_title')}</h3>
            <p className="text-gray-500 text-center mb-8">
              {t('res.delete_confirm')}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleCancel(showCancelConfirm)}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
              >
                {t('res.cancel')}
              </button>
              <button
                onClick={() => setShowCancelConfirm(null)}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
              >
                {t('res.keep')}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Cancel Account Confirmation Modal */}
      {showCancelAccountConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[150] p-4">
          <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mb-6 mx-auto">
              <AlertCircle size={32} />
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-900 mb-2">
              {language === 'pt' ? 'Cancelar Conta?' : 'Cancel Account?'}
            </h3>
            <p className="text-gray-500 text-center mb-8">
              {language === 'pt' 
                ? 'Tem a certeza de que deseja cancelar e excluir permanentemente a sua conta? Esta ação não pode ser desfeita e irá remover todos os seus dados e histórico de reservas.' 
                : 'Are you sure you want to cancel and permanently delete your account? This action cannot be undone and will remove all your profile data and reservation history.'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleCancelAccount}
                disabled={isCancellingAccount}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 disabled:opacity-50"
              >
                {isCancellingAccount 
                  ? (language === 'pt' ? 'A cancelar...' : 'Cancelling...') 
                  : (language === 'pt' ? 'Sim, Cancelar Conta' : 'Yes, Cancel Account')}
              </button>
              <button
                onClick={() => setShowCancelAccountConfirm(false)}
                disabled={isCancellingAccount}
                className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
