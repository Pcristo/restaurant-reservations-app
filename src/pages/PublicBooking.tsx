import React, { useState, useEffect } from 'react';
import { useSettings } from '../hooks/useSettings';
import { useTables } from '../hooks/useTables';
import { useReservations } from '../hooks/useReservations';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { format, addMinutes, parse, isSameDay, isBefore, isAfter, addDays, parseISO, addMonths } from 'date-fns';
import { Calendar, Users, Clock, CheckCircle, AlertCircle, X, Bell, LogIn, Phone, Ban, ShieldCheck, Loader2, Copy, Check } from 'lucide-react';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'motion/react';
import { cn, getOptimizedUrl, formatDisplayTime, getEffectiveOpeningHours } from '../lib/utils';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Link, useLocation } from 'react-router-dom';
import { loadReCaptcha, executeReCaptcha } from '../lib/recaptcha';
import { APP_CONFIG } from '../data/appConfig';
import { SEOHead } from '../components/SEOHead';

import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { toast } from 'react-hot-toast';
export default function PublicBooking() {
  const location = useLocation();

  useEffect(() => {
    if (location.search.includes('scrollTo=booking')) {
      setTimeout(() => {
        const bookingSection = document.getElementById('booking-section');
        if (bookingSection) {
          bookingSection.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    }
  }, [location]);
  const { settings, loading: settingsLoading } = useSettings();
  const { tables, areas = [], loading: tablesLoading } = useTables();
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const maxDateStr = React.useMemo(() => {
    const monthsAhead = settings?.maxMonthsAhead ?? 2;
    const maxDate = addMonths(new Date(), monthsAhead);
    return format(maxDate, 'yyyy-MM-dd');
  }, [settings?.maxMonthsAhead]);

  const isDateTooFar = React.useMemo(() => {
    if (!date || !maxDateStr) return false;
    return date > maxDateStr;
  }, [date, maxDateStr]);

  const { reservations, loading: resLoading, addReservation, updateReservation } = useReservations({ date });
  const { language, t } = useLanguage();

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>, max: number, fieldName: string) => {
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      if (e.currentTarget.value.length >= max) {
        toast.error(
          language === 'pt'
            ? `Limite de ${max} caracteres atingido para ${fieldName}`
            : `Maximum length of ${max} characters reached for ${fieldName}`,
          { id: 'char-limit-error' }
        );
      }
    }
  };
  const { user, isAdmin, isStaff } = useAuth();

  const [guests, setGuests] = useState(2);

  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle');
  const [copiedRef, setCopiedRef] = useState(false);
  const [showClosedModal, setShowClosedModal] = useState(false);
  const [showPromoPopup, setShowPromoPopup] = useState(false);
  const [isVerified, setIsVerified] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [initialResLoaded, setInitialResLoaded] = useState(false);

  useEffect(() => {
    if (!resLoading && !settingsLoading && !tablesLoading) {
      setInitialResLoaded(true);
    }
  }, [resLoading, settingsLoading, tablesLoading]);

  useEffect(() => {
    const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
    if (siteKey) {
      loadReCaptcha(siteKey);
    }
  }, []);

  // Handle TripAdvisor Widget Scripts
  useEffect(() => {
    if (settings?.showTripadvisorWidget && settings?.tripadvisorWidget) {
      const container = document.createElement('div');
      container.innerHTML = settings.tripadvisorWidget;
      const scripts = container.querySelectorAll('script');
      
      scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        if (oldScript.innerHTML) newScript.innerHTML = oldScript.innerHTML;
        document.body.appendChild(newScript);
      });

      return () => {
        // Cleaning up might be tricky as TripAdvisor might inject global variables or other elements
        // but we can at least remove the scripts we added if they had sources
        scripts.forEach(s => {
          const added = document.querySelector(`script[src="${s.src}"]`);
          if (added) added.remove();
        });
      };
    }
  }, [settings?.showTripadvisorWidget, settings?.tripadvisorWidget]);
  const [activePopup, setActivePopup] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    notes: ''
  });

  const [confirmedBooking, setConfirmedBooking] = useState<{
    name: string;
    phone: string;
    email: string;
    date: string;
    time: string;
    guests: number;
    bookingNumber?: string;
  } | null>(null);

  const [profilePhoneVerified, setProfilePhoneVerified] = useState(false);
  const [profilePhone, setProfilePhone] = useState('');
  const [isPhoneVerified, setIsPhoneVerified] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [sentCode, setSentCode] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [verificationError, setVerificationError] = useState('');

  useEffect(() => {
    if (settings?.phoneVerificationEnabled) {
      if (user && user.role === 'customer' && profilePhoneVerified && formData.phone === profilePhone && profilePhone) {
        setIsPhoneVerified(true);
      } else {
        setIsPhoneVerified(false);
        setSentCode(null);
        setVerificationCode('');
        setVerificationError('');
      }
    }
  }, [formData.phone, settings?.phoneVerificationEnabled, profilePhoneVerified, profilePhone, user]);

  const handleSendCode = async () => {
    if (!formData.phone) {
      toast.error(language === 'pt' ? 'Por favor, insira o número de telefone' : 'Please enter a phone number');
      return;
    }
    setIsSendingCode(true);
    setVerificationError('');
    try {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const fullPhoneNumber = formData.phone;
      
      const verificationRef = doc(db, 'phone_verifications', fullPhoneNumber);
      await setDoc(verificationRef, {
        code,
        phoneNumber: fullPhoneNumber,
        createdAt: new Date().toISOString(),
        expiredAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      // Call the backend API route to deliver the code via real Twilio SMS or simulation
      let resData: any = { success: false, simulated: true };
      try {
        const response = await fetch('/api/send-sms', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            phoneNumber: fullPhoneNumber,
            code,
            restaurantName: settings?.name || APP_CONFIG.appName,
            twilioAccountSid: settings?.twilioAccountSid,
            twilioAuthToken: settings?.twilioAuthToken,
            twilioPhoneNumber: settings?.twilioPhoneNumber,
          }),
        });
        resData = await response.json();
      } catch (fetchErr) {
        console.warn('Backend fetch failed, falling back to simulated SMS:', fetchErr);
      }

      setSentCode(code);
      toast.success(t('common.code_sent'));
    } catch (error) {
      console.error('Error sending phone verification:', error);
      toast.error(language === 'pt' ? 'Erro ao enviar código.' : 'Error sending verification code.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode) return;
    setIsCheckingCode(true);
    setVerificationError('');
    try {
      const fullPhoneNumber = formData.phone;
      const verificationRef = doc(db, 'phone_verifications', fullPhoneNumber);
      const docSnap = await getDoc(verificationRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        const isExpired = new Date(data.expiredAt) < new Date();
        if (data.code === verificationCode.trim() && !isExpired) {
          setIsPhoneVerified(true);
          toast.success(language === 'pt' ? 'Número verificado com sucesso!' : 'Phone number verified successfully!');
        } else if (isExpired) {
          setVerificationError(language === 'pt' ? 'O código expirou. Peça um novo.' : 'The code has expired. Request a new one.');
        } else {
          setVerificationError(t('common.invalid_code'));
        }
      } else {
        setVerificationError(t('common.invalid_code'));
      }
    } catch (error) {
      console.error('Error verifying code:', error);
      setVerificationError(language === 'pt' ? 'Erro ao verificar o código.' : 'Error verifying verification code.');
    } finally {
      setIsCheckingCode(false);
    }
  };

  const maxCapacity = React.useMemo(() => {
    if (settings?.maxOnlineGuests !== undefined && settings?.maxOnlineGuests !== null) {
      return Number(settings.maxOnlineGuests);
    }
    if (!tables || tables.length === 0) return 10;
    return Math.max(...tables.map(t => Number(t.seats) || 0));
  }, [tables, settings?.maxOnlineGuests]);

  // Ensure guests doesn't exceed maxCapacity
  useEffect(() => {
    if (guests > maxCapacity) {
      setGuests(maxCapacity);
    }
  }, [maxCapacity, guests]);

  const closedInfo = React.useMemo(() => {
    if (!settings || !date) return { isClosed: false };
    try {
      const eff = getEffectiveOpeningHours(date, settings);
      if (eff.closed) {
        if (eff.sourceType === 'closed_period') {
          const period = settings.closedPeriods?.find(p => date >= p.startDate && date <= p.endDate);
          const nextDay = period ? addDays(parseISO(period.endDate), 1) : null;
          const backDate = nextDay ? format(nextDay, 'dd/MM/yyyy') : undefined;
          return { 
            isClosed: true, 
            reason: period?.note || eff.scheduleName || null,
            backDate,
            type: 'period'
          };
        }
        return { isClosed: true, reason: null };
      }

      return { isClosed: false };
    } catch (err) {
      return { isClosed: false };
    }
  }, [date, settings]);

  const isClosed = closedInfo.isClosed;

  const getClosedMessage = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    if (date === todayStr) {
      return language === 'pt'
        ? 'Estamos fechados hoje. Por favor, selecione outra data.'
        : 'We are closed today. Please select another date.';
    }
    return closedInfo.type === 'period' 
      ? t('public.closed_period_message')
          .replace('{reason}', closedInfo.reason || 'holidays')
          .replace('{date}', closedInfo.backDate || '')
      : t('public.closed_message');
  };

  useEffect(() => {
    if (isClosed) {
      setShowClosedModal(true);
      setSelectedTime(null);
    }
  }, [isClosed]);

  useEffect(() => {
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    
    // Check for active popup in the new array format first
    const activeFromList = (settings?.promotionPopups || []).find(p => {
      if (!p.active) return false;
      const isWithinRange = (!p.startDate || todayStr >= p.startDate) && (!p.endDate || todayStr <= p.endDate);
      return isWithinRange;
    });

    if (activeFromList) {
      setActivePopup(activeFromList);
      setShowPromoPopup(true);
    }
  }, [settings]);

  useEffect(() => {
    if (user && user.role === 'customer') {
      const fetchCustomerData = async () => {
        try {
          const customerDoc = await getDoc(doc(db, 'customers', user.id));
          if (customerDoc.exists()) {
            const data = customerDoc.data();
            const fetchedPhone = data.phone || '';
            const isVerified = !!data.phoneVerified;
            setProfilePhone(fetchedPhone);
            setProfilePhoneVerified(isVerified);
            setFormData(prev => ({
              ...prev,
              name: data.name || user.name || prev.name,
              email: data.email || user.email || prev.email,
              phone: fetchedPhone || prev.phone
            }));
            if (isVerified && fetchedPhone) {
              setIsPhoneVerified(true);
            }
          } else {
            setFormData(prev => ({
              ...prev,
              name: user.name || prev.name,
              email: user.email || prev.email
            }));
          }
        } catch (err) {
          console.error('Error fetching customer data:', err);
        }
      };
      fetchCustomerData();
    }
  }, [user]);

  const { availableSlots, sessionStatus } = React.useMemo(() => {
    if (!settings || !settings.openingHours || !tables.length || isClosed || !date) {
      return { 
        availableSlots: { lunch: [], dinner: [], general: [] }, 
        sessionStatus: { lunch: 'closed', dinner: 'closed' } 
      };
    }
    
    try {
      const dateObj = parseISO(date);
      const eff = getEffectiveOpeningHours(date, settings);

      if (eff.closed) {
        return { 
          availableSlots: { lunch: [], dinner: [], general: [] }, 
          sessionStatus: { lunch: 'closed', dinner: 'closed' } 
        };
      }

      const groupedSlots: { lunch: string[]; dinner: string[]; general: string[] } = { lunch: [], dinner: [], general: [] };
      const interval = eff.reservationInterval || settings.reservationInterval || 30;
      
      const sessionStatus: { lunch: 'open' | 'full' | 'closed' | 'passed'; dinner: 'open' | 'full' | 'closed' | 'passed' } = {
        lunch: 'closed',
        dinner: 'closed'
      };

      // Determine session status - consider global fullHouseDates as well
      const isDateFull = settings.fullHouseDates?.includes(date);
      const isLunchFull = isDateFull || settings.fullHouseLunchDates?.includes(date);
      const isDinnerFull = isDateFull || settings.fullHouseDinnerDates?.includes(date);

      if (eff.lunch?.active) {
        sessionStatus.lunch = (isLunchFull || eff.lunch.fullHouse) ? 'full' : 'open';
      }
      if (eff.dinner?.active) {
        sessionStatus.dinner = (isDinnerFull || eff.dinner.fullHouse) ? 'full' : 'open';
      }

      // If the whole date is full, ensure all active sessions are marked full
      if (isDateFull) {
        if (sessionStatus.lunch !== 'closed') sessionStatus.lunch = 'full';
        if (sessionStatus.dinner !== 'closed') sessionStatus.dinner = 'full';
      }
    
      // Determine which time ranges to use
      const ranges: { open: string; close: string; type: 'lunch' | 'dinner' | 'general' }[] = [];
      const hasActiveSessions = !!(eff.lunch?.active || eff.dinner?.active);
      
      if (sessionStatus.lunch === 'open' && eff.lunch?.open && eff.lunch.close) {
        ranges.push({ open: eff.lunch.open, close: eff.lunch.close, type: 'lunch' });
      }
      
      if (sessionStatus.dinner === 'open' && eff.dinner?.open && eff.dinner.close) {
        ranges.push({ open: eff.dinner.open, close: eff.dinner.close, type: 'dinner' });
      }
      
      // Fallback to general hours if no specific sessions are active
      if (!hasActiveSessions && !isDateFull && eff.open && eff.close && eff.open !== eff.close) {
        ranges.push({ open: eff.open, close: eff.close, type: 'general' });
      }

      const now = new Date();
      const isToday = isSameDay(dateObj, now);
      const thresholdTime = addMinutes(now, 20);
      
      if (isToday) {
        if (sessionStatus.lunch !== 'closed' && sessionStatus.lunch !== 'full') {
          const lunchClose = eff.lunch?.active ? eff.lunch.close : null;
          if (lunchClose) {
            const closeTime = parse(lunchClose, 'HH:mm', dateObj);
            const lastBookingTime = addMinutes(closeTime, -(settings.lastOnlineReservationMinutes || 0));
            if (isBefore(lastBookingTime, thresholdTime)) {
              sessionStatus.lunch = 'passed';
            }
          }
        }
        if (sessionStatus.dinner !== 'closed' && sessionStatus.dinner !== 'full') {
          const dinnerClose = eff.dinner?.active ? eff.dinner.close : null;
          if (dinnerClose) {
            const closeTime = parse(dinnerClose, 'HH:mm', dateObj);
            const lastBookingTime = addMinutes(closeTime, -(settings.lastOnlineReservationMinutes || 0));
            if (isBefore(lastBookingTime, thresholdTime)) {
              sessionStatus.dinner = 'passed';
            }
          }
        }
      }

      ranges.forEach(range => {
        if (!range.open || !range.close) return;
        
        try {
          let current = parse(range.open, 'HH:mm', dateObj);
          const end = parse(range.close, 'HH:mm', dateObj);
          if (isNaN(current.getTime()) || isNaN(end.getTime())) return;
          
          const limit = addMinutes(end, -(settings.lastOnlineReservationMinutes || 0));

          while (isBefore(current, end)) {
            if ((settings.lastOnlineReservationMinutes || 0) > 0 && isBefore(limit, current)) {
              current = addMinutes(current, interval);
              continue;
            }

            const timeStr = format(current, 'HH:mm');

            // Filter out past slots or slots within 20 minutes of current time if today
            if (isToday && isBefore(current, thresholdTime)) {
              current = addMinutes(current, interval);
              continue;
            }

            const currentDateTime = parse(timeStr, 'HH:mm', dateObj);
            
            const availableTables = tables.filter(table => {
              if (table.seats < guests) return false;
              if (table.isBlocked) return false;
              if (table.isActive === false) return false;
              if (table.allowOnlineReservations === false) return false;
              
              const sessionType = range.type === 'lunch' ? 'lunch' : range.type === 'dinner' ? 'dinner' : null;

              if (sessionType && table.activeSessions && table.activeSessions[sessionType] === false) return false;
              if (sessionType && table.onlineSessions && table.onlineSessions[sessionType] === false) return false;

              // Check if the area allows online reservations
              if (table.areaId) {
                const area = areas.find(a => a.id === table.areaId);
                if (area) {
                  const override = area.dateOverrides?.[date];
                  const currentBookingMode = override?.bookingMode !== undefined ? override.bookingMode : area.bookingMode;
                  const currentSessionMode = override?.sessionMode !== undefined ? override.sessionMode : area.sessionMode;
                  const specialEventSessions = override?.specialEventSessions !== undefined ? override.specialEventSessions : (area.specialEventSessions || ['lunch', 'dinner']);

                  if (area.allowOnlineReservations === false) return false;
                  const isSpecialActive = currentBookingMode === 'special_event' && (!sessionType || specialEventSessions.includes(sessionType));
                  if (currentBookingMode === 'manual' || currentBookingMode === 'permanently_closed' || isSpecialActive) return false;
                  const closedSessions = override?.closedSessions !== undefined ? override.closedSessions : (area.closedSessions || ['lunch', 'dinner']);
                  if (currentBookingMode === 'closed' && (!sessionType || closedSessions.includes(sessionType))) return false;
                  if (area.bookingMode === 'closed' && area.closedStartDate && area.closedEndDate) {
                    if (date >= area.closedStartDate && date <= area.closedEndDate && (!sessionType || closedSessions.includes(sessionType))) return false;
                  }
                  if (currentSessionMode && sessionType) {
                    if (currentSessionMode === 'lunch' && sessionType === 'dinner') return false;
                    if (currentSessionMode === 'dinner' && sessionType === 'lunch') return false;
                  }
                }
              }
              let isAvailableForSession = true;
              if (sessionType && table.extraAvailability?.[date]) {
                isAvailableForSession = table.extraAvailability[date][sessionType] !== false;
              } else if (sessionType && table.extraSessions) {
                isAvailableForSession = table.extraSessions[sessionType] !== false;
              }

              if (!isAvailableForSession) return false;

              // Check if table is available for the selected date
              if (date) {
                const selectedDateObj = dateObj;
                
                if (table.isExtra) {
                  // Extra tables are ONLY available on the specific dates
                  const isAvailableOnDate = (table.availableDate && isSameDay(selectedDateObj, parseISO(table.availableDate))) || 
                                           (table.availableDates && table.availableDates.includes(date));
                  
                  if (!isAvailableOnDate) {
                    return false;
                  }
                } else if (table.availableDate) {
                  // Regular tables are available from the date onwards
                  const availableDateObj = parseISO(table.availableDate);
                  if (isBefore(selectedDateObj, availableDateObj) && !isSameDay(selectedDateObj, availableDateObj)) {
                    return false;
                  }
                }
              }

              // Determine joinGroup for table.id on date and timeStr
              const sessionKey = (range.type === 'lunch' || range.type === 'dinner') ? range.type : 'default';
              const currentJoin = table.dailyJoins?.[date]?.[sessionKey];
              const joinGroup = currentJoin && currentJoin.joinedTables && currentJoin.joinedTables.length > 0
                ? [table.id, ...currentJoin.joinedTables]
                : [table.id];

              // Check if there is a blocked reservation (status === 'blocked') on ANY table in the joinGroup for this date, or if the table is blocked via blockedDates
              const isGroupBlocked = reservations.some(r => {
                return r.date === date && r.status === 'blocked' && joinGroup.includes(r.tableId || '');
              }) || joinGroup.some(tid => {
                const tObj = tables.find(t => t.id === tid);
                if (!tObj) return false;
                return !!(tObj.blockedDates?.[date]?.[sessionKey] || tObj.blockedDates?.[date]?.default || tObj.isBlocked);
              });

              if (isGroupBlocked) {
                return false; // Table is blocked/fully-booked
              }

              // Count overlapping active reservations in the group
              const overlappingRes = reservations.filter(r => {
                if (!joinGroup.includes(r.tableId || '') || r.date !== date) return false;
                if (['cancelled', 'no-show', 'completed', 'blocked'].includes(r.status)) return false;

                const resStart = parse(r.time, 'HH:mm', dateObj);
                const gap = settings?.minReservationGap || 135;
                const resEnd = addMinutes(resStart, gap);
                const slotEnd = addMinutes(currentDateTime, gap);

                return (
                  (isBefore(currentDateTime, resEnd) && (isAfter(currentDateTime, resStart) || currentDateTime.getTime() === resStart.getTime())) ||
                  (isBefore(resStart, slotEnd) && (isAfter(resStart, currentDateTime) || resStart.getTime() === currentDateTime.getTime()))
                );
              });

              const hasOverlap = overlappingRes.length >= 1;

              return !hasOverlap;
            });

            if (availableTables.length > 0) {
              if (!groupedSlots[range.type].includes(timeStr)) {
                groupedSlots[range.type].push(timeStr);
              }
            }
            
            current = addMinutes(current, interval);
          }
        } catch (err) {
          console.error('Error parsing range:', range, err);
        }
      });

      return { availableSlots: groupedSlots, sessionStatus };
    } catch (err) {
      console.error('Error calculating slots:', err);
      return { 
        availableSlots: { lunch: [], dinner: [], general: [] }, 
        sessionStatus: { lunch: 'closed', dinner: 'closed' } 
      };
    }
  }, [date, guests, settings, tables, reservations, isClosed]);

  const getSessionFromTime = (timeStr: string) => {
    if (!settings || !date) return null;
    try {
      const eff = getEffectiveOpeningHours(date, settings);
      if (eff.lunch?.active && eff.lunch.open && eff.lunch.close && 
          timeStr >= eff.lunch.open && timeStr <= eff.lunch.close) return 'lunch';
      if (eff.dinner?.active && eff.dinner.open && eff.dinner.close && 
          timeStr >= eff.dinner.open && timeStr <= eff.dinner.close) return 'dinner';
    } catch (e) {
      console.error(e);
    }
    return null;
  };

  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTime) return;

    if (!formData.name || formData.name.trim() === '') {
      toast.error(language === 'pt' ? 'O nome é obrigatório.' : 'Name is required.');
      setBookingStatus('idle');
      return;
    }

    if (!formData.email || formData.email.trim() === '') {
      toast.error(language === 'pt' ? 'O email é obrigatório.' : 'Email is required.');
      setBookingStatus('idle');
      return;
    }

    if (!formData.phone || formData.phone.trim() === '') {
      toast.error(language === 'pt' ? 'O número de telefone é obrigatório.' : 'Phone number is required.');
      setBookingStatus('idle');
      return;
    }

    if (settings?.phoneVerificationEnabled && !isPhoneVerified) {
      toast.error(language === 'pt' 
        ? 'Por favor, verifique o seu número de telefone por SMS primeiro.' 
        : 'Please verify your phone number via SMS first.');
      setBookingStatus('idle');
      return;
    }

    setBookingStatus('submitting');
    
    try {
      const token = await executeReCaptcha('booking');
      if (!token || token === 'error-token') {
        toast.error(t('captcha.robot_alert'));
        setBookingStatus('idle');
        return;
      }
    } catch (err) {
      console.error('reCAPTCHA error:', err);
    }

    try {
      const gap = settings?.minReservationGap || 135;
      const currentDateTime = parse(selectedTime, 'HH:mm', parseISO(date));
      const slotEnd = addMinutes(currentDateTime, gap);

      const sessionType = getSessionFromTime(selectedTime);
      const availableTables = tables.filter(table => {
        if (table.seats < guests || table.isBlocked || table.isActive === false || table.allowOnlineReservations === false) return false;
        if (sessionType && (sessionType === 'lunch' || sessionType === 'dinner')) {
          if (table.activeSessions && table.activeSessions[sessionType] === false) return false;
          if (table.onlineSessions && table.onlineSessions[sessionType] === false) return false;
        }

        // Check if the area allows online reservations
        if (table.areaId) {
          const area = areas.find(a => a.id === table.areaId);
          if (area) {
            const override = area.dateOverrides?.[date];
            const currentBookingMode = override?.bookingMode !== undefined ? override.bookingMode : area.bookingMode;
            const currentSessionMode = override?.sessionMode !== undefined ? override.sessionMode : area.sessionMode;
            const specialEventSessions = override?.specialEventSessions !== undefined ? override.specialEventSessions : (area.specialEventSessions || ['lunch', 'dinner']);

            if (area.allowOnlineReservations === false) return false;
            const isSpecialActive = currentBookingMode === 'special_event' && (!sessionType || specialEventSessions.includes(sessionType));
                  if (currentBookingMode === 'manual' || currentBookingMode === 'permanently_closed' || isSpecialActive) return false;
                  const closedSessions = override?.closedSessions !== undefined ? override.closedSessions : (area.closedSessions || ['lunch', 'dinner']);
                  if (currentBookingMode === 'closed' && (!sessionType || closedSessions.includes(sessionType))) return false;
                  if (area.bookingMode === 'closed' && area.closedStartDate && area.closedEndDate) {
                    if (date >= area.closedStartDate && date <= area.closedEndDate && (!sessionType || closedSessions.includes(sessionType))) return false;
                  }
            if (currentSessionMode && sessionType) {
              if (currentSessionMode === 'lunch' && sessionType === 'dinner') return false;
              if (currentSessionMode === 'dinner' && sessionType === 'lunch') return false;
            }
          }
        }

        // Session-specific activity
        if (sessionType) {
          if (table.extraAvailability?.[date]) {
            if (table.extraAvailability[date][sessionType as 'lunch' | 'dinner'] === false) return false;
          } else if (table.extraSessions) {
            if (table.extraSessions[sessionType as 'lunch' | 'dinner'] === false) return false;
          }
        }

        // Date-specific availability
        if (table.isExtra) {
          const isAvailableOnDate = (table.availableDate && isSameDay(parseISO(date), parseISO(table.availableDate))) || 
                                   (table.availableDates && table.availableDates.includes(date));
          if (!isAvailableOnDate) return false;
        } else if (table.availableDate) {
          const availableDateObj = parseISO(table.availableDate);
          if (isBefore(parseISO(date), availableDateObj) && !isSameDay(parseISO(date), availableDateObj)) return false;
        }
        
        // Determine joinGroup for table.id on date and selectedTime
        const sessionKey = sessionType || 'default';
        const currentJoin = table.dailyJoins?.[date]?.[sessionKey];
        const joinGroup = currentJoin && currentJoin.joinedTables && currentJoin.joinedTables.length > 0
          ? [table.id, ...currentJoin.joinedTables]
          : [table.id];

        // Check if there is a blocked reservation (status === 'blocked') on ANY table in the joinGroup for this date, or if the table is blocked via blockedDates
        const isGroupBlocked = reservations.some(r => {
          return r.date === date && r.status === 'blocked' && joinGroup.includes(r.tableId || '');
        }) || joinGroup.some(tid => {
          const tObj = tables.find(t => t.id === tid);
          if (!tObj) return false;
          return !!(tObj.blockedDates?.[date]?.[sessionKey] || tObj.blockedDates?.[date]?.default || tObj.isBlocked);
        });

        if (isGroupBlocked) {
          return false; // Table is blocked/fully-booked
        }

        // Count overlapping active reservations in the group
        const overlappingRes = reservations.filter(r => {
          if (!joinGroup.includes(r.tableId || '') || r.date !== date) return false;
          if (['cancelled', 'no-show', 'completed', 'blocked'].includes(r.status)) return false;

          const resStart = parse(r.time, 'HH:mm', parseISO(date));
          const resEnd = addMinutes(resStart, gap);

          return (
            (isBefore(currentDateTime, resEnd) && (isAfter(currentDateTime, resStart) || currentDateTime.getTime() === resStart.getTime())) ||
            (isBefore(resStart, slotEnd) && (isAfter(resStart, currentDateTime) || resStart.getTime() === currentDateTime.getTime()))
          );
        });

        const hasOverlap = overlappingRes.length >= 1;

        return !hasOverlap;
      });

      // Fetch customer and check for favorite tables if authenticated
      let favoriteTablesList: string[] = [];
      let isCustomerRegular = false;
      if (user?.id) {
        try {
          const custDoc = await getDoc(doc(db, 'customers', user.id));
          if (custDoc.exists()) {
            const customerData = custDoc.data();
            isCustomerRegular = !!customerData.isRegular;
            if (customerData.favoriteTables && Array.isArray(customerData.favoriteTables)) {
              favoriteTablesList = customerData.favoriteTables;
            }
          }
        } catch (err) {
          console.warn('Non-fatal customer preference lookup error:', err);
        }
      }

      const getOverlapCount = (table: any) => {
        const sessionKey = sessionType || 'default';
        const currentJoin = table.dailyJoins?.[date]?.[sessionKey];
        const joinGroup = currentJoin && currentJoin.joinedTables && currentJoin.joinedTables.length > 0
          ? [table.id, ...currentJoin.joinedTables]
          : [table.id];

        const overlappingRes = reservations.filter(r => {
          if (!joinGroup.includes(r.tableId || '') || r.date !== date) return false;
          if (['cancelled', 'no-show', 'completed', 'blocked'].includes(r.status)) return false;

          const resStart = parse(r.time, 'HH:mm', parseISO(date));
          const resEnd = addMinutes(resStart, gap);

          return (
            (isBefore(currentDateTime, resEnd) && (isAfter(currentDateTime, resStart) || currentDateTime.getTime() === resStart.getTime())) ||
            (isBefore(resStart, slotEnd) && (isAfter(resStart, currentDateTime) || resStart.getTime() === currentDateTime.getTime()))
          );
        });

        return overlappingRes.length;
      };

      // Sort: 1. Overlapping reservation count asc (completely free first) 2. Smallest capacity first 3. Name numerically
      availableTables.sort((a, b) => {
        const overlapsA = getOverlapCount(a);
        const overlapsB = getOverlapCount(b);
        if (overlapsA !== overlapsB) return overlapsA - overlapsB;

        const seatsA = Number(a.seats);
        const seatsB = Number(b.seats);
        if (seatsA !== seatsB) return seatsA - seatsB;

        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      });

      let chosenTable = null;
      let needsVerifyTableNumber = false;
      let preferredTableUnavailable = false;

      if (favoriteTablesList.length > 0) {
        // Look for favorite tables in priority order
        for (const favTableId of favoriteTablesList) {
          const found = availableTables.find(t => t.id === favTableId);
          if (found) {
            chosenTable = found;
            break;
          }
        }

        if (!chosenTable && availableTables.length > 0) {
          needsVerifyTableNumber = true;
          preferredTableUnavailable = true;
          // Find sections of favorite tables
          const favoriteSections = new Set(
            favoriteTablesList
              .map((id: string) => tables.find((t: any) => t.id === id)?.areaId)
              .filter(Boolean)
          );
          
          if (favoriteSections.size > 0) {
            // Try to find an available table in one of those sections
            const tableInSection = availableTables.find(t => favoriteSections.has(t.areaId));
            if (tableInSection) {
              chosenTable = tableInSection;
            }
          }
        }
      }

      if (!chosenTable && availableTables.length > 0) {
        chosenTable = availableTables[0];
      }

      const reservationData: any = {
        customerName: formData.name,
        customerPhone: formData.phone,
        customerEmail: formData.email,
        date,
        time: selectedTime,
        guests,
        tableId: chosenTable?.id || '',
        notes: formData.notes,
        status: 'booked',
        source: (isAdmin || isStaff) ? 'admin' : 'public',
        verifyTableNumber: needsVerifyTableNumber,
        preferredTableUnavailable,
        isRegularCustomer: isCustomerRegular,
        language: language === 'pt' ? 'pt' : 'en'
      };

      if (user?.id) {
        reservationData.customerUid = user.id;
      }

      const addedRes = await addReservation(reservationData);

      // Send confirmation email
      try {
        const resEmail = await fetch('/api/email/confirmation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: formData.email,
            name: formData.name,
            date: date,
            time: formatDisplayTime(selectedTime, settings),
            guests: guests,
            restaurantName: settings?.name || APP_CONFIG.appName,
            resendApiKey: settings?.resendApiKey,
            resendFromEmail: settings?.resendFromEmail,
            language: language,
            logoUrl: settings?.logoUrl || (settings?.useCloudinary ? settings?.cloudinaryLogoUrl : '') || '',
            restaurantEmail: settings?.email || '',
            restaurantPhone: settings?.phone || '',
            restaurantAddress: settings?.address || '',
            bookingNumber: addedRes?.bookingNumber || '',
            reservationId: addedRes?.id || '',
            timezone: settings?.timezone || 'Europe/Lisbon',
            viewUrl: window.location.origin + '/reservations/' + (addedRes?.bookingNumber || addedRes?.id),
            cancelUrl: window.location.origin + '/reservations/' + (addedRes?.bookingNumber || addedRes?.id) + '/cancel'
          }),
        });
        
        const emailData = await resEmail.json();
        
        if (emailData.success) {
           await updateReservation(addedRes.id, {
             confirmationEmail: {
               sent: true,
               sentAt: new Date().toISOString(),
               messageId: emailData.messageId
             }
           } as any);
        }

      } catch (err) {
        console.error('Error sending confirmation email:', err);
      }

      // We no longer update the customer profile with booking form data
      // as requested by the user, to prevent overwriting their saved info.

      setConfirmedBooking({
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        date,
        time: selectedTime || '',
        guests,
        bookingNumber: addedRes?.bookingNumber
      });

      setBookingStatus('success');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(
        language === 'pt'
          ? `Obrigado, ${formData.name}! ${t('public.success_title')}`
          : `Thank you, ${formData.name}! ${t('public.success_title')}`
      );
    } catch (error) {
      console.error(error);
      setBookingStatus('error');
      toast.error(t('res.cancel_error')); // Using a generic error key for now
    }
  };

  if (settingsLoading || tablesLoading || (!initialResLoaded && resLoading)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600"></div>
      </div>
    );
  }

  if (bookingStatus === 'success') {
    const customerName = confirmedBooking?.name || formData.name;
    const bookingDate = confirmedBooking?.date || date;
    const bookingTime = confirmedBooking?.time || selectedTime || '';
    const bookingGuests = confirmedBooking?.guests || guests;
    const bookingNumber = confirmedBooking?.bookingNumber;
    const bookingEmail = confirmedBooking?.email || formData.email;

    return (
      <div className="max-w-lg mx-auto py-12 sm:py-16 px-4 text-center">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0, y: 16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className={cn(
            "p-6 sm:p-7 rounded-2xl shadow-xl border relative overflow-hidden transition-colors duration-300",
            settings?.theme === 'dark' 
              ? "bg-gray-900 border-gray-800 text-white" 
              : "bg-white border-gray-200 text-gray-900"
          )}
        >
          {/* Top Success Badge */}
          <div 
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm"
            style={{
              backgroundColor: settings?.theme === 'dark' ? 'rgba(34, 197, 94, 0.18)' : '#dcfce7',
              color: '#15803d'
            }}
          >
            <CheckCircle size={32} className="stroke-[2.5]" />
          </div>

          {/* Warm Personal Thanks Greeting with Customer Name */}
          <div className="mb-2.5">
            <span 
              className={cn(
                "inline-block text-xs sm:text-[13px] font-extrabold uppercase tracking-wider px-3 py-1 rounded-full border",
                settings?.theme === 'dark' 
                  ? "bg-gray-800 border-gray-700 text-amber-300" 
                  : "bg-amber-100/70 border-amber-200 text-gray-900"
              )}
            >
              {language === 'pt'
                ? `Obrigado, ${customerName}!`
                : `Thank you, ${customerName}!`}
            </span>
          </div>

          {/* Title & Subtitle */}
          <h2 className={cn(
            "text-xl sm:text-2xl font-black mb-1.5 tracking-tight",
            settings?.theme === 'dark' ? "text-white" : "text-gray-950"
          )}>
            {t('public.success_title')}
          </h2>
          <p className={cn(
            "text-xs sm:text-sm mb-5 font-semibold",
            settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
          )}>
            {language === 'pt' ? (
              <>
                Esperamos por si no{' '}
                <span 
                  className="font-bold" 
                  style={{ color: settings?.primaryColor || '#d97706' }}
                >
                  {settings?.name?.trim() || APP_CONFIG.appName || 'DineMaster Pro'}
                </span>
                .
              </>
            ) : (
              <>
                We look forward to seeing you at{' '}
                <span 
                  className="font-bold" 
                  style={{ color: settings?.primaryColor || '#d97706' }}
                >
                  {settings?.name?.trim() || APP_CONFIG.appName || 'DineMaster Pro'}
                </span>
                .
              </>
            )}
          </p>

          {/* Structured Reservation Details Card */}
          <div className={cn(
            "p-3.5 sm:p-4 rounded-xl mb-4.5 text-left border divide-y transition-colors shadow-sm",
            settings?.theme === 'dark'
              ? "bg-gray-800/90 border-gray-700 divide-gray-700/80 text-gray-200"
              : "bg-gray-50/90 border-gray-200 divide-gray-200/80 text-gray-700"
          )}>
            {customerName && (
              <div className="flex items-center justify-between pb-2 sm:pb-2.5 text-xs sm:text-[13.5px]">
                <span className="font-bold text-gray-700 dark:text-gray-200">{t('common.name')}:</span>
                <span className="font-bold text-gray-700 dark:text-gray-200">{customerName}</span>
              </div>
            )}
            <div className="flex items-center justify-between py-2 sm:py-2.5 text-xs sm:text-[13.5px]">
              <span className="font-bold text-gray-700 dark:text-gray-200">{t('common.date')}:</span>
              <span className="font-bold text-gray-700 dark:text-gray-200">
                {bookingDate ? format(parseISO(bookingDate), 'dd/MM/yyyy') : ''}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 sm:py-2.5 text-xs sm:text-[13.5px]">
              <span className="font-bold text-gray-700 dark:text-gray-200">{t('common.time')}:</span>
              <span className="font-bold text-gray-700 dark:text-gray-200">
                {bookingTime ? formatDisplayTime(bookingTime, settings) : ''}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 sm:py-2.5 text-xs sm:text-[13.5px]">
              <span className="font-bold text-gray-700 dark:text-gray-200">{t('common.guests')}:</span>
              <span className="font-bold text-gray-700 dark:text-gray-200">
                {bookingGuests} {bookingGuests === 1 ? (language === 'pt' ? 'Pessoa' : 'Guest') : (language === 'pt' ? 'Pessoas' : 'Guests')}
              </span>
            </div>
            {bookingNumber && (
              <div className="flex items-center justify-between pt-2 sm:pt-2.5 text-xs sm:text-[13.5px]">
                <span className="font-bold text-gray-700 dark:text-gray-200">
                  {language === 'pt' ? 'Nº de Reserva' : 'Booking Ref'}:
                </span>
                <div className="flex items-center gap-1.5">
                  <span 
                    className="font-mono font-bold text-xs sm:text-[13.5px]"
                    style={{ color: settings?.primaryColor || '#d97706' }}
                  >
                    #{bookingNumber}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`#${bookingNumber}`);
                      setCopiedRef(true);
                      toast.success(
                        language === 'pt' 
                          ? 'Nº de reserva copiado!' 
                          : 'Booking ref copied!'
                      );
                      setTimeout(() => setCopiedRef(false), 2500);
                    }}
                    title={language === 'pt' ? 'Copiar número de reserva' : 'Copy booking reference'}
                    className="p-1 text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white rounded hover:bg-gray-200/70 dark:hover:bg-gray-700 transition-colors cursor-pointer inline-flex items-center justify-center"
                    aria-label="Copy booking reference"
                  >
                    {copiedRef ? (
                      <Check size={13} className="text-green-600 dark:text-green-400 stroke-[2.5]" />
                    ) : (
                      <Copy size={13} />
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {bookingEmail && (
            <p className={cn(
              "text-[11px] sm:text-xs mb-5 leading-relaxed font-medium",
              settings?.theme === 'dark' ? "text-gray-400" : "text-gray-600"
            )}>
              {language === 'pt'
                ? `Enviámos uma confirmação detalhada para ${bookingEmail}.`
                : `A confirmation email has been sent to ${bookingEmail}.`}
            </p>
          )}

          {/* Action Button */}
          <button 
            onClick={() => {
              setBookingStatus('idle');
              setSelectedTime(null);
              setConfirmedBooking(null);
              setFormData({ name: '', phone: '', email: '', notes: '' });
            }}
            className="w-full text-white py-3 px-5 rounded-xl font-bold text-xs sm:text-[14px] transition-all shadow-md hover:opacity-95 hover:shadow-lg active:scale-[0.99] cursor-pointer"
            style={{ 
              backgroundColor: settings?.primaryColor || '#d97706',
              boxShadow: `0 8px 16px -4px ${settings?.primaryColor ? settings.primaryColor + '35' : 'rgba(217, 119, 6, 0.25)'}`
            }}
          >
            {language === 'pt' ? 'Fazer Nova Reserva' : 'Book Another Table'}
          </button>
        </motion.div>
      </div>
    );
  }

  const heroStyle = settings?.heroImageUrl || (settings?.useCloudinary && settings?.cloudinaryHeroImageUrl) ? {
    backgroundImage: `url(${getOptimizedUrl(settings?.heroImageUrl, settings, 'hero')})`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  } : {
    backgroundImage: 'url(https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2070)',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };

  return (
    <div className={cn(
      "pb-20 transition-colors duration-300",
      settings?.theme === 'dark' ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
    )}>
      <SEOHead settings={settings} language={language} />
      <section className="relative flex items-center justify-center" style={{ ...heroStyle, height: settings?.heroHeight || '60vh' }}>
        <div 
          className="absolute inset-0" 
          style={{ 
            backgroundColor: settings?.heroOverlay || '#000000',
            opacity: settings?.heroOverlayOpacity ?? 0.5
          }}
        />
        <div className="relative text-center text-white px-4 max-w-4xl mx-auto">
          <motion.h1 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-5xl md:text-7xl font-bold mb-6 tracking-tight"
          >
            {settings?.name || APP_CONFIG.appName}
          </motion.h1>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-xl md:text-2xl text-gray-200 mb-8 font-light"
          >
            {language === 'en'
              ? (settings?.descriptionEn || settings?.description || t('public.book_desc'))
              : (settings?.description || settings?.descriptionEn || t('public.book_desc'))}
          </motion.p>
          <motion.button
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            onClick={() => window.scrollTo({ top: 600, behavior: 'smooth' })}
            className="bg-amber-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:bg-amber-700 transition-all shadow-xl shadow-black/20"
          >
            {t('nav.book')}
          </motion.button>
        </div>
      </section>

      <div id="booking-section" className="max-w-[1165px] w-full mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className={cn(
            "text-4xl font-bold mb-4 transition-colors",
            settings?.theme === 'dark' ? "text-gray-300" : "text-gray-900"
          )}>{t('public.book_title')}</h1>
          <p className={cn(
            "text-lg italic transition-colors",
            settings?.theme === 'dark' ? "text-gray-400" : "text-gray-600"
          )}>
            {t('public.experience_fine_dining').replace('{name}', settings?.name || 'Restaurante Nortada')}
          </p>
        </div>

        {settings?.allowOnlineReservations === false ? (
          <div className="max-w-xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-gray-100 text-center"
            >
              <div className="w-20 h-20 bg-amber-100 text-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-inner shadow-amber-200/50">
                <Phone size={40} />
              </div>
              <h2 className="text-3xl font-black text-gray-900 mb-4 leading-tight">{t('settings.call_now')}</h2>
              <p className="text-gray-500 mb-10 text-lg leading-relaxed">
                {t('settings.call_only_desc')}
              </p>
              <div className="space-y-4">
                <a 
                  href={`tel:${settings?.phone}`}
                  className="w-full inline-flex items-center justify-center gap-3 bg-amber-600 text-white px-10 py-5 rounded-[1.5rem] font-black text-xl hover:bg-amber-700 transition-all shadow-xl shadow-amber-200 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Phone size={24} fill="currentColor" />
                  {settings?.phone}
                </a>
                {settings?.secondaryPhone && (
                  <a 
                    href={`tel:${settings?.secondaryPhone}`}
                    className="w-full inline-flex items-center justify-center gap-3 bg-gray-50 text-gray-700 px-10 py-4 rounded-[1.5rem] font-bold text-lg hover:bg-gray-100 transition-all border border-gray-100"
                  >
                    {settings.secondaryPhone}
                  </a>
                )}
              </div>
            </motion.div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className={cn(
                "p-6 rounded-2xl shadow-sm border transition-colors duration-300",
                settings?.theme === 'dark' 
                  ? "bg-gray-900 border-gray-800 text-white" 
                  : "bg-white border-gray-100 text-gray-900"
              )}>
                <div className={cn(
                  "flex items-center gap-3 mb-6 border-b pb-4 transition-colors duration-300",
                  settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
                )}>
                  <Calendar className="text-amber-600" size={24} />
                  <h2 className="text-xl font-semibold">1. {t('public.select_date')}</h2>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>
                      {t('common.date')}
                    </label>
                    <DatePicker
                      value={dayjs(date, 'YYYY-MM-DD')}
                      onChange={(newValue) => {
                        if (newValue) {
                          const selectedDate = newValue.format('YYYY-MM-DD');
                          setDate(selectedDate);
                          if (selectedDate > maxDateStr) {
                            toast.error(
                              language === 'pt'
                                ? `Não é possível reservar com mais de ${settings?.maxMonthsAhead ?? 2} meses de antecedência.`
                                : `You cannot book more than ${settings?.maxMonthsAhead ?? 2} months in advance.`
                            );
                          }
                        }
                      }}
                      minDate={dayjs(new Date().getFullYear() < 2026 ? '2026-01-01' : format(new Date(), 'yyyy-MM-dd'))}
                      format="DD/MM/YYYY"
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          sx: {
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '0.5rem',
                              backgroundColor: isClosed || isDateTooFar ? (settings?.theme === 'dark' ? 'rgba(127, 29, 29, 0.15)' : '#fef2f2') : (settings?.theme === 'dark' ? '#111827' : '#ffffff'),
                              '& fieldset': {
                                borderColor: isClosed || isDateTooFar ? '#fca5a5' : '#d1d5db',
                              },
                              '&:hover fieldset': {
                                borderColor: '#f59e0b',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#f59e0b',
                                borderWidth: '2px',
                              },
                            },
                            '& .MuiInputBase-input': {
                              padding: '8.5px 14px',
                              color: settings?.theme === 'dark' ? '#ffffff' : '#111827',
                            },
                            '& .MuiSvgIcon-root': {
                              color: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280'
                            }
                          }
                        }
                      }}
                    />
                    {isClosed && (
                      <p className="text-xs text-red-600 mt-1 font-medium">{t('settings.closed')}</p>
                    )}
                    {isDateTooFar && (
                      <div className="mt-3 p-3 bg-red-50 border border-red-100 dark:bg-red-950/20 dark:border-red-900/30 rounded-xl flex items-start gap-2 text-red-700 dark:text-red-400">
                        <AlertCircle size={16} className="mt-0.5 shrink-0 animate-pulse text-red-600" />
                        <div>
                          <p className="text-xs font-bold">
                            {language === 'pt' 
                              ? 'Período de Reserva Excedido' 
                              : 'Booking Period Exceeded'}
                          </p>
                          <p className="text-[11px] mt-0.5 leading-relaxed">
                            {language === 'pt'
                              ? `Não estamos a aceitar reservas online para esta data ainda. O Período de Reserva Online é de ${settings?.maxMonthsAhead ?? 2} meses (até ${format(parseISO(maxDateStr), 'dd/MM/yyyy')}).`
                              : `We are not accepting online bookings for this date yet. The Online Booking Period is set to ${settings?.maxMonthsAhead ?? 2} months (until ${format(parseISO(maxDateStr), 'dd/MM/yyyy')}).`}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-2 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>{t('common.guests')}</label>
                    <div className="flex items-center gap-3">
                      <button 
                        type="button"
                        onClick={() => setGuests(Math.max(1, guests - 1))}
                        className="p-2 text-2xl font-bold rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-all transform scale-105 active:scale-95 cursor-pointer"
                        style={{ color: settings?.primaryColor || '#d97706' }}
                      >
                        -
                      </button>
                      <span className="text-lg font-semibold w-8 text-center">{guests}</span>
                      <button 
                        type="button"
                        onClick={() => setGuests(Math.min(maxCapacity, guests + 1))}
                        disabled={guests >= maxCapacity}
                        className={cn(
                          "p-2 text-2xl font-bold rounded-lg transition-all transform scale-105 active:scale-95",
                          guests >= maxCapacity 
                            ? "text-gray-300 dark:text-gray-600 cursor-not-allowed" 
                            : "hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer"
                        )}
                        style={guests < maxCapacity ? { color: settings?.primaryColor || '#d97706' } : undefined}
                        title={guests >= maxCapacity ? "Maximum capacity reached" : ""}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-100 flex items-start gap-2 text-amber-700">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  <p className="text-xs font-medium leading-relaxed">
                    {t('public.large_group_note').replace('{max}', maxCapacity.toString())}
                  </p>
                </div>
              </div>

              <div className={cn(
                "p-6 rounded-2xl shadow-sm border transition-colors duration-300 relative min-h-[200px]",
                settings?.theme === 'dark' 
                  ? "bg-gray-900 border-gray-800 text-white" 
                  : "bg-white border-gray-100 text-gray-900"
              )}>
                <div className={cn(
                  "flex items-center gap-3 mb-6 border-b pb-4 transition-colors duration-300",
                  settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
                )}>
                  <Clock className="text-amber-600" size={24} />
                  <h2 className="text-xl font-semibold">{language === 'pt' ? '2. Selecione a Hora' : '2. Select Time'}</h2>
                </div>
                {resLoading && initialResLoaded && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-gray-900/70 backdrop-blur-[1px] flex items-center justify-center z-10 rounded-2xl">
                    <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
                      <Loader2 className="animate-spin" size={20} />
                      {language === 'pt' ? 'A carregar horários...' : 'Loading times...'}
                    </div>
                  </div>
                )}
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={date + '_' + guests}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.22, ease: "easeOut" }}
                  >
                    {isDateTooFar ? (
                      <div className="p-8 text-center bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-2xl">
                        <Ban className="text-red-500 mx-auto mb-4" size={48} />
                        <h3 className="text-xl font-bold text-red-900 dark:text-red-400 mb-2">
                          {language === 'pt' ? 'Reservas Online Indisponíveis' : 'Online Bookings Unavailable'}
                        </h3>
                        <p className="text-red-700 dark:text-red-300 text-sm leading-relaxed max-w-md mx-auto">
                          {language === 'pt'
                            ? `Não estamos a aceitar reservas online para esta data ainda. O Período de Reserva Online está definido para ${settings?.maxMonthsAhead ?? 2} meses (até ${format(parseISO(maxDateStr), 'dd/MM/yyyy')}).`
                            : `We are not accepting online bookings for this date yet. The Online Booking Period is set to ${settings?.maxMonthsAhead ?? 2} months (until ${format(parseISO(maxDateStr), 'dd/MM/yyyy')}).`}
                        </p>
                      </div>
                    ) : Object.entries(availableSlots).some(([_, slots]) => slots.length > 0) || (sessionStatus.lunch !== 'closed' && sessionStatus.lunch !== 'passed') || (sessionStatus.dinner !== 'closed' && sessionStatus.dinner !== 'passed') || (settings?.fullHouseDates?.includes(date) && sessionStatus.lunch === 'closed' && sessionStatus.dinner === 'closed') ? (
                      <div className="space-y-6">
                        {/* General Full House message if no specific sessions but day is marked full */}
                        {settings?.fullHouseDates?.includes(date) && sessionStatus.lunch === 'closed' && sessionStatus.dinner === 'closed' && (
                          <div className="p-8 text-center bg-red-50 rounded-2xl border border-red-100 mb-6">
                            <Ban className="text-red-500 mx-auto mb-4" size={48} />
                            <h3 className="text-xl font-bold text-red-900 mb-2">
                              {t('res.full_house')}
                            </h3>
                            <p className="text-red-700">
                              {t('res.full_house_desc')}
                            </p>
                          </div>
                        )}

                        {sessionStatus.lunch !== 'passed' && (
                          <div>
                            <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <div className="h-px flex-grow bg-amber-100" />
                              {t('common.lunch')}
                              <div className="h-px flex-grow bg-amber-100" />
                            </h3>
                            {sessionStatus.lunch === 'closed' ? (
                              <div className="p-4 text-center bg-gray-50 rounded-xl border border-gray-100">
                                <Ban className="text-gray-400 mx-auto mb-2" size={24} />
                                <p className="text-sm font-bold text-gray-700 leading-tight">
                                  {language === 'pt' ? 'Fechado para Almoço' : 'Closed for Lunch'}
                                </p>
                              </div>
                            ) : sessionStatus.lunch === 'full' ? (
                              <div className="p-4 text-center bg-red-50 rounded-xl border border-red-100">
                                <Ban className="text-red-500 mx-auto mb-2" size={24} />
                                <p className="text-sm font-bold text-red-900 leading-tight">
                                  {t('res.full_house')}
                                </p>
                                <p className="text-[11px] text-red-700 mt-1">
                                  {t('res.full_house_desc')}
                                </p>
                              </div>
                            ) : availableSlots.lunch.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {availableSlots.lunch.map((time) => (
                                  <button
                                    key={time}
                                    type="button"
                                    onClick={() => setSelectedTime(time)}
                                    className={cn(
                                      "py-2 px-1 rounded-lg text-[13px] font-bold border transition-all",
                                      selectedTime === time
                                        ? "bg-amber-600 text-white border-amber-600 shadow-md scale-105"
                                        : "bg-white text-gray-700 border-gray-200 hover:border-amber-500 hover:text-amber-600"
                                    )}
                                  >
                                    {formatDisplayTime(time, settings)}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center bg-red-50 rounded-xl border border-red-100">
                                <Ban className="text-red-500 mx-auto mb-2" size={24} />
                                <p className="text-sm font-bold text-red-900 leading-tight">
                                  {t('res.full_house')}
                                </p>
                                <p className="text-[11px] text-red-700 mt-1">
                                  {t('res.full_house_desc')}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {sessionStatus.dinner !== 'passed' && (
                          <div>
                            <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider mb-3 flex items-center gap-2">
                              <div className="h-px flex-grow bg-indigo-100" />
                              {t('common.dinner')}
                              <div className="h-px flex-grow bg-indigo-100" />
                            </h3>
                            {sessionStatus.dinner === 'closed' ? (
                              <div className="p-4 text-center bg-gray-50 rounded-xl border border-gray-100">
                                <Ban className="text-gray-400 mx-auto mb-2" size={24} />
                                <p className="text-sm font-bold text-gray-700 leading-tight">
                                  {language === 'pt' ? 'Fechado para Jantar' : 'Closed for Dinner'}
                                </p>
                              </div>
                            ) : sessionStatus.dinner === 'full' ? (
                              <div className="p-4 text-center bg-red-50 rounded-xl border border-red-100">
                                <Ban className="text-red-500 mx-auto mb-2" size={24} />
                                <p className="text-sm font-bold text-red-900 leading-tight">
                                  {t('res.full_house')}
                                </p>
                                <p className="text-[11px] text-red-700 mt-1">
                                  {t('res.full_house_desc')}
                                </p>
                              </div>
                            ) : availableSlots.dinner.length > 0 ? (
                              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                {availableSlots.dinner.map((time) => (
                                  <button
                                    key={time}
                                    type="button"
                                    onClick={() => setSelectedTime(time)}
                                    className={cn(
                                      "py-2 px-1 rounded-lg text-[13px] font-bold border transition-all",
                                      selectedTime === time
                                        ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
                                        : "bg-white text-gray-700 border-gray-200 hover:border-indigo-500 hover:text-indigo-600"
                                    )}
                                  >
                                    {formatDisplayTime(time, settings)}
                                  </button>
                                ))}
                              </div>
                            ) : (
                              <div className="p-4 text-center bg-red-50 rounded-xl border border-red-100">
                                <Ban className="text-red-500 mx-auto mb-2" size={24} />
                                <p className="text-sm font-bold text-red-900 leading-tight">
                                  {t('res.full_house')}
                                </p>
                                <p className="text-[11px] text-red-700 mt-1">
                                  {t('res.full_house_desc')}
                                </p>
                              </div>
                            )}
                          </div>
                        )}

                        {availableSlots.general.length > 0 && sessionStatus.lunch !== 'full' && sessionStatus.dinner !== 'full' && (
                          <div>
                            { (availableSlots.lunch.length > 0 || availableSlots.dinner.length > 0 || sessionStatus.lunch === 'full' || sessionStatus.dinner === 'full') && (
                              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                                <div className="h-px flex-grow bg-gray-100" />
                                {t('common.general')}
                                <div className="h-px flex-grow bg-gray-100" />
                              </h3>
                            )}
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                              {availableSlots.general.map((time) => (
                                <button
                                  key={time}
                                  type="button"
                                  onClick={() => setSelectedTime(time)}
                                  className={cn(
                                    "py-2 px-1 rounded-lg text-[13px] font-bold border transition-all",
                                    selectedTime === time
                                      ? "bg-amber-600 text-white border-amber-600 shadow-md scale-105"
                                      : "bg-white text-gray-700 border-gray-200 hover:border-amber-500 hover:text-amber-600"
                                  )}
                                >
                                  {formatDisplayTime(time, settings)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                        <AlertCircle size={48} className="mb-4 opacity-20" />
                        <p>{isClosed ? t('settings.closed') : t('res.no_bookings')}</p>
                        <p className="text-sm">{isClosed ? getClosedMessage() : t('res.no_res_found')}</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

            <div className="lg:col-span-1">
              <form onSubmit={handleBooking} className={cn(
                "px-6 py-5 rounded-2xl shadow-sm border sticky top-24 transition-colors duration-300",
                settings?.theme === 'dark' 
                  ? "bg-gray-900 border-gray-800 text-white" 
                  : "bg-white border-gray-100 text-gray-900"
              )}>
                <div className={cn(
                  "flex items-center gap-3 mb-6 border-b pb-4 transition-colors duration-300",
                  settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
                )}>
                  <Users className="text-amber-600" size={24} />
                  <h2 className="text-xl font-semibold">3. {t('public.guest_info')}</h2>
                </div>

                {!user && (
                  <div className="mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col gap-3">
                    <p className="text-sm text-blue-700 font-medium">
                      {t('public.login_manage')}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <Link 
                        to="/login?role=customer" 
                        className="flex items-center justify-center gap-2 bg-white text-gray-600 border border-gray-200 py-1 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
                      >
                        {t('nav.login')}
                      </Link>
                      <Link 
                        to="/login?role=customer&mode=signup" 
                        className="flex items-center justify-center gap-2 bg-white text-blue-600 border border-blue-200 py-1 rounded-lg text-sm font-bold hover:bg-blue-50 transition-colors"
                      >
                        <LogIn size={16} />
                        {t('nav.signup')}
                      </Link>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1 transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>{t('common.name')} <span className="text-red-500 font-bold ml-0.5">*</span></label>
                    <input 
                      type="text"
                      maxLength={50}
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                      placeholder={t('common.placeholder_name')}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors duration-300",
                        settings?.theme === 'dark' 
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1 transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>{t('common.phone')} <span className="text-red-500 font-bold ml-0.5">*</span></label>
                    <div className={cn(
                      "flex items-center px-4 py-2 border rounded-lg focus-within:ring-2 focus-within:ring-amber-500 transition-colors duration-300",
                      settings?.theme === 'dark' 
                        ? "bg-gray-800 border-gray-700 text-white" 
                        : "bg-white border-gray-300 text-gray-900"
                    )}>
                      <PhoneInput
                        defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                        value={formData.phone}
                        onChange={(val) => setFormData({ ...formData, phone: val || '' })}
                        placeholder={t('common.placeholder_phone')}
                        className="w-full text-sm outline-none"
                      />
                    </div>

                    {settings?.phoneVerificationEnabled && (
                      <div className="mt-2">
                        {isPhoneVerified ? (
                          <div className="flex items-center gap-2 text-xs text-emerald-800 font-bold p-2.5 rounded-lg bg-white border border-emerald-300 shadow-sm">
                            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>{t('common.phone_verified')} ({formData.phone})</span>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex gap-2 items-center">
                              <button
                                type="button"
                                disabled={isSendingCode || !formData.phone}
                                onClick={handleSendCode}
                                className={cn(
                                  "px-4 py-1.5 text-xs font-semibold rounded-lg shadow-sm border transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5",
                                  settings?.theme === 'dark'
                                    ? "bg-amber-950/40 border-amber-900/50 text-amber-400 hover:bg-amber-900/30"
                                    : "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
                                )}
                              >
                                {isSendingCode && <Loader2 className="w-3 h-3 animate-spin" />}
                                {sentCode ? (language === 'pt' ? 'Reenviar Código' : 'Resend Code') : t('common.send_code')}
                              </button>
                            </div>

                            {sentCode && (
                              <div className="mt-2 p-3 rounded-lg border flex flex-col gap-2 bg-gray-50/50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-800">
                                <label className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                  {t('common.verification_code')}
                                </label>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="123456"
                                    className={cn(
                                      "w-32 px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors font-mono tracking-widest text-center",
                                      settings?.theme === 'dark'
                                        ? "bg-gray-800 border-gray-700 text-white placeholder-gray-600"
                                        : "bg-white border-gray-300 text-gray-900 placeholder-gray-400"
                                    )}
                                  />
                                  <button
                                    type="button"
                                    disabled={isCheckingCode || verificationCode.length < 6}
                                    onClick={handleVerifyCode}
                                    className="px-4 py-1.5 text-xs font-semibold rounded-lg shadow-sm text-white bg-amber-600 hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5"
                                  >
                                    {isCheckingCode && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {t('common.verify_code')}
                                  </button>
                                </div>
                                {verificationError && (
                                  <p className="text-[11px] text-red-500 font-medium mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />
                                    {verificationError}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1 transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>{t('common.email')} <span className="text-red-500 font-bold ml-0.5">*</span></label>
                    <input 
                      type="email"
                      maxLength={100}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                      placeholder={t('common.placeholder_email')}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors duration-300",
                        settings?.theme === 'dark' 
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1 transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>{t('common.notes')}</label>
                    <textarea 
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      onKeyDown={(e) => handleKeyDown(e, 90, t('common.notes'))}
                      placeholder={t('common.placeholder_notes')}
                      rows={3}
                      maxLength={90}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-colors duration-300",
                        settings?.theme === 'dark' 
                          ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500" 
                          : "bg-white border-gray-300 text-gray-900"
                      )}
                    />
                  </div>

                  {/* Google reCAPTCHA v3 Compliance Notice */}
                  {selectedTime && !isClosed && (
                    <div className={cn(
                      "p-3 rounded-xl border flex items-center justify-between transition-all duration-300 mt-4 shadow-sm bg-opacity-50",
                      settings?.theme === 'dark'
                        ? "bg-gray-800 border-gray-700 text-white"
                        : "bg-gray-50 border-gray-200 text-gray-900"
                    )}>
                      <div className="flex items-center gap-2">
                        <ShieldCheck size={18} className="text-amber-600 animate-pulse" />
                        <span className="text-xs text-gray-600 dark:text-gray-300">
                          {language === 'pt' ? 'Protegido por reCAPTCHA v3' : 'Protected by reCAPTCHA v3'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 text-right flex flex-col">
                        <span className="font-semibold tracking-wider text-[8px] uppercase">reCAPTCHA v3</span>
                        <div className="flex gap-1 mt-0.5 justify-end">
                          <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer" className="hover:underline text-[8px]">Privacy</a>
                          <span>•</span>
                          <a href="https://policies.google.com/terms" target="_blank" rel="noreferrer" className="hover:underline text-[8px]">Terms</a>
                        </div>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={!selectedTime || bookingStatus === 'submitting' || isClosed || isDateTooFar}
                    className={cn(
                      "w-full py-4 rounded-lg font-bold text-lg shadow-lg transition-all mt-4",
                      !selectedTime || bookingStatus === 'submitting' || isClosed || isDateTooFar
                        ? "bg-gray-200 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed shadow-none"
                        : "bg-amber-600 text-white hover:bg-amber-700 hover:shadow-amber-200 active:scale-95"
                    )}
                  >
                    {bookingStatus === 'submitting' ? t('common.loading') : t('public.confirm_booking')}
                  </button>
                  
                  {(!selectedTime && !isClosed && !isDateTooFar) && (
                    <p className="text-xs text-center text-gray-500 mt-2">
                      {language === 'pt' 
                        ? 'Por favor, escolha um horário.' 
                        : 'No time selected yet for reservations, please choose a time slot.'}
                    </p>
                  )}
                  {isDateTooFar && (
                    <p className="text-xs text-center text-red-500 mt-2 font-medium">
                      {language === 'pt'
                        ? `Por favor, selecione uma data dentro do período de ${settings?.maxMonthsAhead ?? 2} meses permitido.`
                        : `Please select a date within the allowed booking window of ${settings?.maxMonthsAhead ?? 2} months.`}
                    </p>
                  )}
                  {isClosed && (
                    <p className="text-xs text-center text-red-500 mt-2 font-medium">
                      {getClosedMessage()}
                    </p>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* TripAdvisor Widget */}
        {settings?.showTripadvisorWidget && settings?.tripadvisorWidget && (
          <div className={cn(
            "mt-16 pt-12 border-t transition-colors",
            settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
          )}>
            <div className="flex flex-col items-center">
              <h3 className={cn(
                "text-xl font-bold mb-8 flex items-center gap-3 transition-colors",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-900"
              )}>
                <img 
                  src="https://www.vectorlogo.zone/logos/tripadvisor/tripadvisor-icon.svg" 
                  alt="TripAdvisor" 
                  className="w-8 h-8"
                  referrerPolicy="no-referrer"
                />
                {t('public.reviews_tripadvisor') || "What our guests say on TripAdvisor"}
              </h3>
              <div 
                className="w-full max-w-2xl flex justify-center overflow-auto py-4"
                dangerouslySetInnerHTML={{ 
                  __html: settings.tripadvisorWidget.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "") 
                }} 
              />
            </div>
          </div>
        )}
      </div>

      {/* Closed Day Modal */}
      {showClosedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-3xl p-8 w-full max-w-sm shadow-2xl relative text-center"
          >
            <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle size={40} />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('settings.closed')}</h3>
            <p className="text-gray-600 mb-8">
              {getClosedMessage()}
            </p>
            <button 
              onClick={() => setShowClosedModal(false)}
              className="w-full bg-gray-900 text-white py-3 rounded-lg font-semibold hover:bg-gray-800 transition-colors"
            >
              {t('common.confirm')}
            </button>
          </motion.div>
        </div>
      )}

      {/* Promotion Popup Modal */}
      {showPromoPopup && activePopup && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white rounded-[2rem] w-full max-w-md shadow-2xl relative overflow-hidden"
          >
            {/* Promotion Image as Header */}
            {activePopup.imageUrl ? (
              <div 
                className="w-full h-48 bg-cover bg-center relative"
                style={{ 
                  backgroundImage: `url(${getOptimizedUrl(activePopup.imageUrl, settings)})`,
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
                
                {(settings?.logoUrl || settings?.cloudinaryLogoUrl) && (
                  <div 
                    className="absolute -bottom-[24px] right-0 z-20 px-3 rounded-tl-2xl rounded-bl-2xl flex items-center justify-center"
                    style={{ backgroundColor: settings?.primaryColor || '#d97706', height: '60px' }}
                  >
                    <img 
                      src={getOptimizedUrl(settings?.logoUrl, settings, 'logo')} 
                      alt="Logo" 
                      className="w-auto object-contain drop-shadow-md brightness-0 invert" 
                      style={{ height: `${Math.min((settings?.logoSize || 40) * 1.41, 82)}px` }}
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                )}
              </div>
            ) : (
              <div 
                className="absolute top-0 right-0 w-32 h-32 rounded-full -mr-16 -mt-16 z-0 opacity-10"
                style={{ backgroundColor: settings?.primaryColor || '#d97706' }}
              />
            )}
            
            <button 
              onClick={() => {
                setShowPromoPopup(false);
              }}
              className={cn(
                "absolute top-4 right-4 p-2 rounded-full transition-colors z-20",
                activePopup.imageUrl 
                  ? "bg-black/20 text-white hover:bg-black/40 backdrop-blur-sm" 
                  : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              )}
            >
              <X size={20} />
            </button>

            <div className="p-8 relative z-10">
              {!activePopup.imageUrl && (
                <div 
                  className="w-16 h-16 rounded-2xl flex items-center justify-center mb-6 rotate-3 relative overflow-hidden"
                  style={{ color: settings?.primaryColor || '#d97706' }}
                >
                  <div className="absolute inset-0 opacity-15" style={{ backgroundColor: settings?.primaryColor || '#d97706' }} />
                  <Bell size={32} className="relative z-10" />
                </div>
              )}
              
              <h3 className="text-3xl font-black text-gray-900 mb-2 leading-tight">
                {language === 'pt' && activePopup.titlePt ? activePopup.titlePt : activePopup.title}
              </h3>
              
              {(language === 'pt' && activePopup.subtitlePt ? activePopup.subtitlePt : activePopup.subtitle) && (
                <p 
                  className="font-bold uppercase tracking-widest text-xs mb-4"
                  style={{ color: settings?.primaryColor || '#d97706' }}
                >
                  {language === 'pt' && activePopup.subtitlePt ? activePopup.subtitlePt : activePopup.subtitle}
                </p>
              )}
              
              <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-8">
                <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {language === 'pt' && activePopup.messagePt ? activePopup.messagePt : activePopup.message}
                </p>
              </div>

              <button 
                onClick={() => {
                  setShowPromoPopup(false);
                }}
                className="w-full text-white py-4 rounded-lg font-bold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
                style={{ 
                  backgroundColor: settings?.primaryColor || '#d97706',
                  boxShadow: `0 10px 15px -3px ${settings?.primaryColor ? settings.primaryColor + '40' : 'rgba(217, 119, 6, 0.4)'}`
                }}
              >
                {t('common.confirm')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
