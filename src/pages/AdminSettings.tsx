import { FaFacebook, FaInstagram } from 'react-icons/fa';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { format, parseISO, addDays } from 'date-fns';
import { ChevronUp, MoreVertical, Save, Image as ImageIcon, Clock, MapPin, Phone, Mail, Plus, Trash2, MessageCircle, Globe, Music2, Share2, Calendar, Bell, Video, Copy, ExternalLink, Map, Lock, Unlock, Edit, RotateCcw, Trash, ArrowLeft, Cloud, Database, Eye, EyeOff, ChevronDown, Search, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useReservations } from '../hooks/useReservations';
import { useCustomers } from '../hooks/useCustomers';
import { DAYS_OF_WEEK } from '../constants';
import { cn, getOptimizedUrl, formatDisplayTime, findSpecialScheduleConflicts } from '../lib/utils';
import { SpecialSchedule } from '../types';
import CustomDropdown from '../components/CustomDropdown';
import { AppDatePicker } from '../components/AppDatePicker';
import { TimePicker } from '@mui/x-date-pickers';
import { renderTimeViewClock } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import firebaseConfig from '../../firebase-applet-config.json';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import RestaurantSEOSettings from '../components/admin/RestaurantSEOSettings';

dayjs.extend(customParseFormat);

export default function AdminSettings() {
  const { settings, updateSettings, loading } = useSettings();
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(settings);
  const [initialFormData, setInitialFormData] = useState<any>(null);
  const [newClosedDay, setNewClosedDay] = useState("");
  const [newSpecialDay, setNewSpecialDay] = useState("");
  const [newPeriodStart, setNewPeriodStart] = useState("");
  const [newPeriodEnd, setNewPeriodEnd] = useState("");
  const [newPeriodNote, setNewPeriodNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [isCloudinaryLocked, setIsCloudinaryLocked] = useState(true);
  const [isResendLocked, setIsResendLocked] = useState(true);
  const [isFirebaseLocked, setIsFirebaseLocked] = useState(true);
  const [isTwilioLocked, setIsTwilioLocked] = useState(true);
  const [showResend, setShowResend] = useState(false);
  const [showFirebase, setShowFirebase] = useState(false);
  const [showTwilio, setShowTwilio] = useState(false);
  const [isDataHistoryLocked, setIsDataHistoryLocked] = useState(true);
  const [showDataHistoryPass, setShowDataHistoryPass] = useState(false);
  const [isAppUnlockPinLocked, setIsAppUnlockPinLocked] = useState(true);
  const [showAppUnlockPin, setShowAppUnlockPin] = useState(false);
  const [showPdfPassword, setShowPdfPassword] = useState(false);
  const [isFloorPlanAccordionOpen, setIsFloorPlanAccordionOpen] = useState(false);
  const [showCloudinary, setShowCloudinary] = useState(false);
  const { deletedReservations, historyReservations, restoreReservation, forceDeleteReservation, moveToHistoryReservation, bulkRestoreReservations, bulkForceDeleteReservations, bulkMoveToHistoryReservations } = useReservations({ includeAll: true });
  const { deletedCustomers, historyCustomers, restoreCustomer, forceDeleteCustomer, moveToHistoryCustomer, bulkRestoreCustomers, bulkForceDeleteCustomers, bulkMoveToHistoryCustomers } = useCustomers();
  const [showBin, setShowBin] = useState(false);
  const [showTopBinMenu, setShowTopBinMenu] = useState(false);
  const [showDataHistory, setShowDataHistory] = useState(false);
  const [showDataHistoryPrompt, setShowDataHistoryPrompt] = useState(false);
  const [selectedHistoryYear, setSelectedHistoryYear] = useState<string>('all');
  const [selectedHistoryDataType, setSelectedHistoryDataType] = useState<string>('all');
  const [dataHistoryPassInput, setDataHistoryPassInput] = useState('');

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showResetAccordion, setShowResetAccordion] = useState(false);
  const [showHeroAccordion, setShowHeroAccordion] = useState(false);
  const [showAdminDevelopingPassword, setShowAdminDevelopingPassword] = useState(false);
  const [testEmailRecipient, setTestEmailRecipient] = useState('');
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState<{ success?: boolean; message?: string } | null>(null);

  // Special Schedule State & Handlers
  const [isSpecialScheduleModalOpen, setIsSpecialScheduleModalOpen] = useState(false);
  const [editingSpecialSchedule, setEditingSpecialSchedule] = useState<SpecialSchedule | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleStartDate, setScheduleStartDate] = useState('');
  const [scheduleEndDate, setScheduleEndDate] = useState('');
  const [scheduleDays, setScheduleDays] = useState<string[]>(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']);
  const [scheduleClosed, setScheduleClosed] = useState(false);
  const [scheduleLunchActive, setScheduleLunchActive] = useState(true);
  const [scheduleLunchOpen, setScheduleLunchOpen] = useState('12:00');
  const [scheduleLunchClose, setScheduleLunchClose] = useState('15:00');
  const [scheduleActive, setScheduleActive] = useState(true);
  const [scheduleDinnerActive, setScheduleDinnerActive] = useState(true);
  const [scheduleDinnerOpen, setScheduleDinnerOpen] = useState('19:00');
  const [scheduleDinnerClose, setScheduleDinnerClose] = useState('23:00');
  const [scheduleInterval, setScheduleInterval] = useState(30);
  const [scheduleNote, setScheduleNote] = useState('');

  const getDayLabel = (day: string, lang: string) => {
    const mapPt: Record<string, string> = {
      Monday: 'Segunda',
      Tuesday: 'Terça',
      Wednesday: 'Quarta',
      Thursday: 'Quinta',
      Friday: 'Sexta',
      Saturday: 'Sábado',
      Sunday: 'Domingo',
      monday: 'Segunda',
      tuesday: 'Terça',
      wednesday: 'Quarta',
      thursday: 'Quinta',
      friday: 'Sexta',
      saturday: 'Sábado',
      sunday: 'Domingo',
    };
    if (lang === 'pt') return mapPt[day] || day;
    return day.charAt(0).toUpperCase() + day.slice(1);
  };

  const handleOpenAddSpecialSchedule = () => {
    setEditingSpecialSchedule(null);
    setScheduleName('');
    setScheduleActive(true);
    setScheduleStartDate('');
    setScheduleEndDate('');
    setScheduleDays([]);
    setScheduleClosed(false);
    setScheduleLunchActive(true);
    setScheduleLunchOpen('12:00');
    setScheduleLunchClose('15:00');
    setScheduleDinnerActive(true);
    setScheduleDinnerOpen('19:00');
    setScheduleDinnerClose('23:00');
    setScheduleInterval(formData?.reservationInterval || 30);
    setScheduleNote('');
    setIsSpecialScheduleModalOpen(true);
  };

  const handleOpenEditSpecialSchedule = (schedule: SpecialSchedule) => {
    setEditingSpecialSchedule(schedule);
    setScheduleName(schedule.name || '');
    setScheduleActive(schedule.active ?? true);
    setScheduleStartDate(schedule.startDate || '');
    setScheduleEndDate(schedule.endDate || '');
    setScheduleDays(schedule.days || []);
    setScheduleClosed(!!schedule.closed);
    setScheduleLunchActive(schedule.lunch?.active !== false);
    setScheduleLunchOpen(schedule.lunch?.open || '12:00');
    setScheduleLunchClose(schedule.lunch?.close || '15:00');
    setScheduleDinnerActive(schedule.dinner?.active !== false);
    setScheduleDinnerOpen(schedule.dinner?.open || '19:00');
    setScheduleDinnerClose(schedule.dinner?.close || '23:00');
    setScheduleInterval(schedule.reservationInterval || formData?.reservationInterval || 30);
    setScheduleNote(schedule.note || '');
    setIsSpecialScheduleModalOpen(true);
  };

  const handleSaveSpecialSchedule = () => {
    if (!scheduleName.trim()) {
      toast.error(language === 'pt' ? 'Por favor insira um nome para o horário especial.' : 'Please enter a name for the special schedule.');
      return;
    }
    if (!scheduleStartDate || !scheduleEndDate) {
      toast.error(language === 'pt' ? 'Por favor selecione a data de início e de fim.' : 'Please select a start and end date.');
      return;
    }
    if (scheduleStartDate > scheduleEndDate) {
      toast.error(language === 'pt' ? 'A data de fim deve ser igual ou posterior à data de início.' : 'End date must be on or after start date.');
      return;
    }
    if (scheduleDays.length === 0) {
      toast.error(language === 'pt' ? 'Selecione pelo menos um dia da semana.' : 'Select at least one day of the week.');
      return;
    }

    const newSchedule: SpecialSchedule = {
      id: editingSpecialSchedule ? editingSpecialSchedule.id : crypto.randomUUID(),
      name: scheduleName.trim(),
      active: scheduleActive,
      startDate: scheduleStartDate,
      endDate: scheduleEndDate,
      days: scheduleDays,
      closed: scheduleClosed,
      lunch: {
        active: scheduleLunchActive,
        open: scheduleLunchOpen,
        close: scheduleLunchClose,
      },
      dinner: {
        active: scheduleDinnerActive,
        open: scheduleDinnerOpen,
        close: scheduleDinnerClose,
      },
      reservationInterval: scheduleInterval,
      note: scheduleNote.trim(),
    };

    const currentSchedules = formData?.specialSchedules || [];
    let updatedSchedules: SpecialSchedule[] = [];

    if (editingSpecialSchedule) {
      updatedSchedules = currentSchedules.map((s) => (s.id === editingSpecialSchedule.id ? newSchedule : s));
    } else {
      updatedSchedules = [...currentSchedules, newSchedule];
    }

    setFormData({
      ...formData,
      specialSchedules: updatedSchedules,
    });

    setIsSpecialScheduleModalOpen(false);
    toast.success(
      language === 'pt'
        ? editingSpecialSchedule ? 'Horário especial atualizado.' : 'Horário especial adicionado.'
        : editingSpecialSchedule ? 'Special schedule updated.' : 'Special schedule added.'
    );
  };

  const handleDeleteSpecialSchedule = (id: string) => {
    const currentSchedules = formData?.specialSchedules || [];
    setFormData({
      ...formData,
      specialSchedules: currentSchedules.filter((s) => s.id !== id),
    });
    toast.success(language === 'pt' ? 'Horário especial removido.' : 'Special schedule removed.');
  };

  useEffect(() => {
    if (settings) {
      const base = {
        ...settings,
        resendApiKey: settings.resendApiKey || (import.meta as any).env.VITE_RESEND_API_KEY,
        resendFromEmail: settings.resendFromEmail || (import.meta as any).env.VITE_RESEND_FROM_EMAIL || '',
        firebaseApiKey: settings.firebaseApiKey || firebaseConfig.apiKey,
        firebaseAuthDomain: settings.firebaseAuthDomain || firebaseConfig.authDomain,
        firebaseProjectId: settings.firebaseProjectId || firebaseConfig.projectId,
        firebaseStorageBucket: settings.firebaseStorageBucket || firebaseConfig.storageBucket,
        firebaseMessagingSenderId: settings.firebaseMessagingSenderId || firebaseConfig.messagingSenderId,
        firebaseAppId: settings.firebaseAppId || firebaseConfig.appId,
        firebaseMeasurementId: settings.firebaseMeasurementId || firebaseConfig.measurementId,
        firebaseDatabaseId: settings.firebaseDatabaseId || firebaseConfig.firestoreDatabaseId,
        twilioAccountSid: settings.twilioAccountSid || (import.meta as any).env.VITE_TWILIO_ACCOUNT_SID || '',
        twilioAuthToken: settings.twilioAuthToken || (import.meta as any).env.VITE_TWILIO_AUTH_TOKEN || '',
        twilioPhoneNumber: settings.twilioPhoneNumber || (import.meta as any).env.VITE_TWILIO_PHONE_NUMBER || '',
        region: settings.region || 'portugal',
      };
      setFormData(base);
      setInitialFormData(base);
    }
  }, [settings]);

  useEffect(() => {
    if (formData?.showFloorPlanBg) {
      setIsFloorPlanAccordionOpen(true);
    } else {
      setIsFloorPlanAccordionOpen(false);
    }
  }, [formData?.showFloorPlanBg]);

  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/admin');
    }
  }, [isAdmin, loading, navigate]);

  if (loading || !formData) {
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  }

  if (!isAdmin) {
    return null;
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    // Deep comparison of current formData vs the baseline initialFormData
    if (initialFormData && JSON.stringify(formData) === JSON.stringify(initialFormData)) {
      toast.error(language === 'pt' ? 'Nenhuma alteração foi detetada.' : 'No changes were detected.');
      return;
    }

    setIsSaving(true);
    try {
      await updateSettings(formData);
      toast.success(t('common.save_success'));
    } catch (error) {
      console.error(error);
      toast.error(t('common.save_error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddPromotion = () => {
    const newPromo = {
      id: crypto.randomUUID(),
      active: false,
      startDate: '',
      endDate: '',
      title: 'New Promotion',
      subtitle: '',
      message: '',
      imageUrl: ''
    };
    setFormData({
      ...formData,
      promotionPopups: [...(formData.promotionPopups || []), newPromo]
    });
  };

  const handleUpdatePromotion = (id: string, updates: any) => {
    const newPromos = (formData.promotionPopups || []).map(p => {
      if (p.id === id) {
        // If we are activating this one, deactivate others
        if (updates.active === true) {
          // handled below by map
        }
        return { ...p, ...updates };
      }
      // If we activated another one, deactivate this one
      if (updates.active === true) {
        return { ...p, active: false };
      }
      return p;
    });
    setFormData({ ...formData, promotionPopups: newPromos });
  };

  const handleRemovePromotion = (id: string) => {
    setFormData({
      ...formData,
      promotionPopups: (formData.promotionPopups || []).filter(p => p.id !== id)
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!formData.cloudinaryCloudName || !formData.cloudinaryUploadPreset) {
      toast.error('Please configure Cloudinary Cloud Name and Upload Preset first.');
      return;
    }

    setUploadingField(field);
    const uploadUrl = `https://api.cloudinary.com/v1_1/${formData.cloudinaryCloudName}/image/upload`;
    
    try {
      const payload = new FormData();
      payload.append('file', file);
      payload.append('upload_preset', formData.cloudinaryUploadPreset!);
      
      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: payload
      });
      
      const data = await response.json();
      if (data.secure_url) {
        if (field === 'socialImageUrl') {
          setFormData(prev => ({
            ...prev,
            seo: {
              ...(prev.seo || {}),
              socialImageUrl: data.secure_url,
              cloudinarySocialImageUrl: data.secure_url
            }
          }));
          toast.success(language === 'pt' ? 'Imagem de partilha social carregada com sucesso!' : 'Social share image uploaded to Cloudinary successfully!');
        } else {
          // Map standard fields to cloudinary fields when uploading
          const cloudinaryFieldMap: Record<string, string> = {
            'logoUrl': 'cloudinaryLogoUrl',
            'faviconUrl': 'cloudinaryFaviconUrl',
            'heroImageUrl': 'cloudinaryHeroImageUrl',
            'footerImageUrl': 'cloudinaryFooterImageUrl'
          };
          const targetField = cloudinaryFieldMap[field] || field;
          setFormData(prev => ({ ...prev, [targetField]: data.secure_url } as any));
        }
      } else {
        toast.error('Upload failed: ' + (data.error?.message || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Error uploading image');
    } finally {
      setUploadingField(null);
    }
  };

  const handleHoursChange = (day: string, field: string, value: any, subfield?: string) => {
    if (!formData.openingHours) return;
    const currentDayHours = formData.openingHours[day] || { 
      open: '09:00', 
      close: '22:00', 
      closed: false,
      lunch: { open: '12:00', close: '15:00', active: false, fullHouse: true },
      dinner: { open: '19:00', close: '23:00', active: false, fullHouse: true }
    };

    let newDayHours = { ...currentDayHours };

    if (subfield) {
      newDayHours = {
        ...newDayHours,
        [field]: {
          ...(newDayHours[field as keyof typeof newDayHours] as any),
          [subfield]: value
        }
      };

      // Auto-set fullHouse when active is set to false or true
      if (subfield === 'active') {
         if (field === 'lunch' || field === 'dinner') {
           newDayHours[field].fullHouse = !value;
         }
      }
    } else {
      newDayHours = {
        ...newDayHours,
        [field]: value
      };
      
      // Auto-set lunch and dinner fullHouse when closed is toggled
      if (field === 'closed') {
         if (newDayHours.lunch) newDayHours.lunch.fullHouse = value === true;
         if (newDayHours.dinner) newDayHours.dinner.fullHouse = value === true;
      }
    }

    setFormData({
      ...formData,
      openingHours: {
        ...formData.openingHours,
        [day]: newDayHours
      }
    });
  };

  return (
    <div className={cn(
      cn("mx-auto py-8 px-4 sm:px-6 lg:px-8 transition-colors duration-300 min-h-screen", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]"),
      settings?.theme === 'dark' ? "text-white" : "text-gray-900"
    )}>
      <div className={cn(
        "flex flex-col md:flex-row justify-between md:items-center gap-4 mb-10 sticky z-30 py-4 px-2 -mx-2 backdrop-blur-md rounded-xl transition-all duration-300",
        isAdmin ? "top-[96px]" : "top-[64px]",
        settings?.theme === 'dark' 
          ? "bg-gray-950/80 border-b border-gray-800/50" 
          : "bg-white/80 border-b border-gray-100/50"
      )}>
        <div className="flex flex-col">
          <h1 className={cn(
            "text-3xl font-bold transition-colors duration-300",
            settings?.theme === 'dark' ? "text-white" : "text-gray-900"
          )}>{t('settings.title')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('settings.desc')}</p>
        </div>
        <div className="flex items-center justify-end gap-3 max-[500px]:flex-col max-[500px]:items-end w-full md:w-auto">
          <button
            onClick={() => navigate('/admin/tables')}
            className={cn(
              "flex-1 md:flex-none max-[500px]:flex-none flex items-center justify-center gap-2 border px-6 py-2 rounded-lg font-semibold transition-all shadow-sm",
              settings?.theme === 'dark' 
                ? "bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700" 
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            )}
          >
            <Map size={20} className="text-amber-600" />
            <span className="whitespace-nowrap">{t('tables.editor')}</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={cn(
              "flex-1 md:flex-none max-[500px]:flex-none flex items-center justify-center gap-2 px-6 py-2 rounded-lg font-semibold transition-all shadow-md disabled:opacity-50",
              settings?.theme === 'dark' 
                ? "bg-amber-700 text-white hover:bg-amber-800" 
                : "bg-amber-600 text-white hover:bg-amber-700"
            )}
          >
            <Save size={20} />
            <span className="whitespace-nowrap">{isSaving ? t('common.saving') : t('common.save')}</span>
          </button>
        </div>
      </div>

      <div className="mb-6 flex justify-end items-center gap-3">
        <button
          onClick={() => {
            if (showDataHistory) {
              setShowDataHistory(false);
              setShowBin(true);
              setSelectedHistoryYear('all');
            } else if (showBin) {
              setShowBin(false);
            } else {
              navigate('/admin');
            }
          }}
          className={cn(
            "p-2 rounded-full transition-all shadow-sm border",
            settings?.theme === 'dark' 
              ? "bg-gray-900 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-800" 
              : "bg-white text-gray-500 border-gray-100 hover:text-gray-700 hover:bg-gray-50"
          )}
        >
          <ArrowLeft size={24} />
        </button>
        <div className="relative flex items-center gap-2">
          <button
            onClick={() => setShowBin(true)}
            className={cn(
              "px-6 py-2 rounded-xl font-bold transition-all shadow-sm border flex items-center gap-2",
              showBin 
                ? (settings?.theme === 'dark' ? "bg-amber-600 text-white border-amber-600" : "bg-amber-600 text-white border-amber-600") 
                : (settings?.theme === 'dark' ? "bg-gray-900 text-gray-400 border-gray-800 hover:text-gray-200" : "bg-white text-gray-500 border-gray-100 hover:text-gray-700")
            )}
          >
            <Trash2 size={18} />
            {t('settings.bin') || "Recycle Bin"}
            {(deletedReservations.length + deletedCustomers.length) > 0 && (
              <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                {deletedReservations.length + deletedCustomers.length}
              </span>
            )}
          </button>
          
          {showBin && (historyReservations.length > 0 || historyCustomers.length > 0) && (
            <div className="relative group">
              <button 
              className={cn(
                "p-2 rounded-xl transition-all shadow-sm border flex items-center justify-center cursor-default sm:cursor-pointer",
                settings?.theme === 'dark' 
                  ? "bg-gray-900 text-gray-400 border-gray-800 hover:text-white hover:bg-gray-800" 
                  : "bg-white text-gray-500 border-gray-100 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <MoreVertical size={20} />
            </button>
            <div className="absolute top-full mt-2 right-0 w-48 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 py-2 z-30 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
              <button
                onClick={() => {
                  setShowDataHistoryPrompt(true);
                  setDataHistoryPassInput('');
                }}
                className={cn("w-full px-4 py-2 text-left text-[13px] flex items-center gap-3 font-medium transition-colors duration-300", settings?.theme === 'dark' ? "text-gray-400 hover:text-white hover:bg-gray-700/50" : "text-gray-600 hover:text-gray-900 hover:bg-gray-50")}
              >
                <Database size={16} className="text-amber-500" />
                <span>{t('settings.data_history') || "Data History"}</span>
              </button>
            </div>
          </div>
          )}
        </div>
      </div>

      {!showBin && !showDataHistory && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* General Info */}
        <div className={cn(
          "p-6 rounded-xl shadow-sm border space-y-6 transition-colors duration-300",
          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        )}>
          <h2 className={cn(
            "text-xl font-semibold flex items-center gap-2 border-b pb-3 transition-colors duration-300",
            settings?.theme === 'dark' ? "border-gray-800 text-white" : "border-gray-100 text-gray-900"
          )}>
            <MapPin className="text-amber-600" size={20} />
            {t('settings.basic')}
          </h2>
          
          <div className="space-y-4">


            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('common.name')}</label>
              <input 
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={cn(
                  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.description_pt')}</label>
              <textarea 
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                placeholder="Experience fine dining at its best..."
                className={cn(
                  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-colors",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.description_en')}</label>
              <textarea 
                value={formData.descriptionEn || ''}
                onChange={(e) => setFormData({ ...formData, descriptionEn: e.target.value })}
                rows={2}
                placeholder="Experience fine dining at its best..."
                className={cn(
                  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none transition-colors",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.website')}</label>
              <input 
                type="url"
                value={formData.websiteUrl || ''}
                onChange={(e) => setFormData({ ...formData, websiteUrl: e.target.value })}
                placeholder="https://example.com"
                className={cn(
                  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('common.address')}</label>
              <input 
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className={cn(
                  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-1",
                  settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>{t('common.phone')}</label>
                <input 
                  type="text"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                />
              </div>
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-1",
                  settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
                )}>{t('common.phone')} 2</label>
                <input 
                  type="text"
                  value={formData.secondaryPhone || ''}
                  onChange={(e) => setFormData({ ...formData, secondaryPhone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                />
              </div>
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('common.email')}</label>
              <input 
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={cn(
                  "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                )}
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                {language === 'pt' ? 'Região do Restaurante' : 'Restaurant Region'}
              </label>
              <CustomDropdown
                value={formData.region || 'portugal'}
                onChange={(val) => setFormData({ ...formData, region: val as 'portugal' | 'ireland' })}
                options={[
                  { value: 'portugal', label: 'Portugal (3 Legal Pages)' },
                  { value: 'ireland', label: 'Ireland (3 Legal Pages)' }
                ]}
                isDark={settings?.theme === 'dark'}
              />
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>
                {language === 'pt' ? 'Formato de Hora' : 'Time Format'}
              </label>
              <CustomDropdown
                value={formData.timeFormat || '24h'}
                onChange={(val) => setFormData({ ...formData, timeFormat: val as '12h' | '24h' })}
                options={[
                  { value: '24h', label: '24 Hours (14:30)' },
                  { value: '12h', label: '12 Hours (02:30 PM)' }
                ]}
                isDark={settings?.theme === 'dark'}
              />
            </div>

            <div className={cn(
              "pt-4 border-t transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/20 border-amber-900/50" : "bg-amber-50 border-amber-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                  )}>{t('settings.allow_online')}</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                  )}>{t('settings.allow_online_desc')}</p>
                </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.allowOnlineReservations ?? true} 
                    onChange={(e) => setFormData({ ...formData, allowOnlineReservations: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                  )}></div>
                </label>
              </div>


              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/50" : "bg-amber-50/50 border-amber-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                  )}>Auto-send Emails for Manual Reservations</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                  )}>If enabled, confirmation and reminder emails will be sent automatically when you create a reservation from the admin dashboard.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.autoSendManualReservationsEmails || false}
                    onChange={(e) => setFormData({ ...formData, autoSendManualReservationsEmails: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                  )}></div>
                </label>
              </div>

              <div className={cn(
                "p-4 rounded-xl border mt-3 transition-colors duration-300 space-y-2",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/50" : "bg-amber-50/50 border-amber-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                  )}>{t('settings.interval')}</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300 mb-2",
                    settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                  )}>{t('settings.interval_desc')}</p>
                </div>
                <CustomDropdown 
                  value={(formData.reservationInterval || 30).toString()}
                  onChange={(val) => setFormData({ ...formData, reservationInterval: parseInt(val) })}
                  options={[
                    { value: '15', label: '15 min' },
                    { value: '30', label: '30 min' },
                    { value: '45', label: '45 min' },
                    { value: '60', label: '60 min' }
                  ]}
                  isDark={settings?.theme === 'dark'}
                />
              </div>

              {/* SMS Phone Verification with Twilio */}
              <div className={cn(
                "p-4 rounded-xl border mt-3 flex items-center justify-between gap-4 transition-all duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/20 border-amber-900/50" : "bg-amber-50 border-amber-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                  )}>{t('settings.phone_verification')}</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                  )}>{t('settings.phone_verification_desc')}</p>
                </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.phoneVerificationEnabled ?? false} 
                    onChange={(e) => setFormData({ ...formData, phoneVerificationEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                  )}></div>
                </label>
              </div>

              {/* Default Phone Country Code */}
              <div className={cn(
                "p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/40" : "bg-amber-50/50 border-amber-100"
              )}>
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                    )}>
                      {language === 'pt' ? 'Indicativo de País Padrão (Telefone)' : 'Default Phone Country Code'}
                    </h3>
                    <p className={cn(
                      "text-[10px] transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                    )}>
                      {language === 'pt' 
                        ? 'Selecione o código de país padrão para os formulários de telefone.' 
                        : 'Select the default country code for the phone input forms.'}
                    </p>
                  </div>
                  <CustomDropdown
                    value={formData.defaultCountryCode || 'PT'}
                    onChange={(val) => setFormData({ ...formData, defaultCountryCode: val })}
                    options={[
                      { value: 'PT', label: 'Portugal (+351)' },
                      { value: 'US', label: 'United States (+1)' },
                      { value: 'GB', label: 'United Kingdom (+44)' },
                      { value: 'FR', label: 'France (+33)' },
                      { value: 'ES', label: 'Spain (+34)' },
                      { value: 'DE', label: 'Germany (+49)' },
                      { value: 'IT', label: 'Italy (+39)' },
                      { value: 'NL', label: 'Netherlands (+31)' },
                      { value: 'BE', label: 'Belgium (+32)' },
                      { value: 'CH', label: 'Switzerland (+41)' },
                      { value: 'IE', label: 'Ireland (+353)' },
                      { value: 'BR', label: 'Brazil (+55)' },
                      { value: 'CA', label: 'Canada (+1)' },
                      { value: 'AU', label: 'Australia (+61)' },
                      { value: 'AO', label: 'Angola (+244)' },
                      { value: 'MZ', label: 'Mozambique (+258)' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>
              </div>

              {/* Maximum Guests for Online Booking */}
              <div className={cn(
                "p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/40" : "bg-amber-50/50 border-amber-100"
              )}>
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                    )}>{t('settings.max_online_guests')}</h3>
                    <p className={cn(
                      "text-[10px] transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                    )}>{t('settings.max_online_guests_desc')}</p>
                  </div>
                  <div className="w-full sm:w-[120px] flex-shrink-0">
                    <input 
                      type="number"
                      min={1}
                      max={100}
                      value={formData.maxOnlineGuests ?? 10}
                      onChange={(e) => setFormData({ ...formData, maxOnlineGuests: parseInt(e.target.value) || 10 })}
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Online Booking Period (Months Ahead) */}
              <div className={cn(
                "p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/40" : "bg-amber-50/50 border-amber-100"
              )}>
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                    )}>{t('settings.max_months_ahead')}</h3>
                    <p className={cn(
                      "text-[10px] transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                    )}>{t('settings.max_months_ahead_desc')}</p>
                  </div>
                  <div className="w-full sm:w-[120px] flex-shrink-0">
                    <input 
                      type="number"
                      min={1}
                      max={12}
                      value={formData.maxMonthsAhead ?? 2}
                      onChange={(e) => setFormData({ ...formData, maxMonthsAhead: parseInt(e.target.value) || 2 })}
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Reservation Grace Period (Minutes) */}
              <div className={cn(
                "p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/40" : "bg-amber-50/50 border-amber-100"
              )}>
                <div className="flex flex-col gap-3">
                  <div>
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                    )}>{t('settings.grace_period')}</h3>
                    <p className={cn(
                      "text-[10px] transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                    )}>{t('settings.grace_period_desc')}</p>
                  </div>
                  <div className="w-full sm:w-[120px] flex-shrink-0">
                    <input 
                      type="number"
                      min={0}
                      max={180}
                      value={formData.gracePeriod ?? 15}
                      onChange={(e) => setFormData({ ...formData, gracePeriod: parseInt(e.target.value) >= 0 ? parseInt(e.target.value) : 0 })}
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Unique Booking Number Toggle */}
              <div className={cn(
                "p-4 rounded-xl border mt-3 transition-all duration-300 space-y-4",
                settings?.theme === 'dark' ? "bg-amber-900/15 border-amber-900/40" : "bg-amber-50/40 border-amber-100"
              )}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                    )}>{t('settings.enable_booking_number')}</h3>
                    <p className={cn(
                      "text-[10px] transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                    )}>{t('settings.enable_booking_number_desc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.enableBookingNumber ?? true} 
                      onChange={(e) => setFormData({ ...formData, enableBookingNumber: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                      settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                    )}></div>
                  </label>
                </div>

                {(formData.enableBookingNumber ?? true) && (
                  <div className="pt-2 border-t border-dashed border-amber-200/50">
                    <label className={cn(
                      "block text-xs font-medium mb-1",
                      settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
                    )}>
                      {language === 'pt' ? 'Prefixo de Código Customizado (3 letras)' : 'Customized Code Prefix (3 letters)'}
                    </label>
                    <input 
                      type="text"
                      maxLength={3}
                      placeholder="e.g. NOR"
                      value={formData.bookingNumberPrefix || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                        setFormData({ ...formData, bookingNumberPrefix: val });
                      }}
                      className={cn(
                        "w-full max-w-[150px] px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors font-mono uppercase",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                      )}
                    />
                    <p className={cn(
                      "text-[9.5px] mt-1 transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                    )}>
                      {language === 'pt' 
                        ? `Exemplo de número de reserva: ${(formData.bookingNumberPrefix || 'NOR').substring(0, 3)}-RES-07-26-000001`
                        : `Example booking number: ${(formData.bookingNumberPrefix || 'NOR').substring(0, 3)}-RES-07-26-000001`
                      }
                    </p>

                    <div className={cn(
                      "mt-4 border rounded-xl overflow-hidden transition-all duration-300",
                      settings?.theme === 'dark' ? "border-amber-950/40 bg-amber-950/5" : "border-amber-200/40 bg-amber-50/10"
                    )}>
                      <button
                        type="button"
                        onClick={() => setShowResetAccordion(!showResetAccordion)}
                        className="w-full flex items-center justify-between px-4 py-3 select-none text-left focus:outline-none"
                      >
                        <span className={cn(
                          "text-xs font-bold flex items-center gap-2",
                          settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                        )}>
                          {language === 'pt' ? 'Reset do número de reserva' : 'Reset reservation number'}
                        </span>
                        <ChevronDown 
                          size={16} 
                          className={cn(
                            "transition-transform duration-300 text-amber-600",
                            showResetAccordion ? "rotate-180" : "rotate-0"
                          )} 
                        />
                      </button>
                                <AnimatePresence initial={false}>
                        {showResetAccordion && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-2 border-t border-dashed border-amber-200/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <p className="text-[11.5px] text-gray-500 max-w-sm font-medium">
                                  {language === 'pt'
                                    ? 'Redefina a sequência numérica das reservas de volta para 000001.'
                                    : 'Reset the numeric sequence of bookings back to 000001.'}
                                </p>
                              </div>

                              {!showResetConfirm ? (
                                <button
                                  type="button"
                                  onClick={() => setShowResetConfirm(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 active:scale-95 text-white text-xs font-semibold rounded-lg transition-all self-start sm:self-center cursor-pointer whitespace-nowrap"
                                >
                                  <RotateCcw size={13} />
                                  {language === 'pt' ? 'Reiniciar para 0' : 'Reset to 0'}
                                </button>
                              ) : (
                                <div className={cn(
                                  "flex flex-col gap-2 p-3 rounded-lg border text-center items-center w-full sm:w-auto",
                                  settings?.theme === 'dark' ? "bg-red-950/20 border-red-900/50" : "bg-red-50 border-red-100"
                                )}>
                                  <span className="text-[11px] font-medium text-red-600">
                                    {language === 'pt'
                                      ? 'Tem a certeza que quer reiniciar os números para 0?'
                                      : 'Are you sure you wanna reset the numbers to 0?'}
                                  </span>
                                  <div className="flex items-center justify-center gap-2 w-full">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setFormData({
                                          ...formData,
                                          bookingNumberResetDate: new Date().toISOString()
                                        });
                                        setShowResetConfirm(false);
                                        toast.success(language === 'pt' ? 'Número de reserva redefinido! Guarde as definições para aplicar.' : 'Reservation number reset! Save settings to apply.');
                                      }}
                                      className="flex-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold rounded cursor-pointer min-w-[60px]"
                                    >
                                      {language === 'pt' ? 'Sim' : 'Yes'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setShowResetConfirm(false)}
                                      className="flex-1 px-3 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-[10px] font-bold rounded cursor-pointer min-w-[60px]"
                                    >
                                      {language === 'pt' ? 'Não' : 'No'}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                )}
              </div>

              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-blue-900/20 border-blue-900/50" : "bg-blue-50 border-blue-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-blue-400" : "text-blue-900"
                  )}>{t('settings.show_insights')}</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-blue-500/80" : "text-blue-700"
                  )}>{t('settings.show_insights_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.showCustomerInsights ?? false} 
                    onChange={(e) => setFormData({ ...formData, showCustomerInsights: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-blue-900" : "bg-gray-200 peer-focus:ring-blue-300"
                  )}></div>
                </label>
              </div>

              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/50" : "bg-amber-50/50 border-amber-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                  )}>{t('settings.show_live_upcoming')}</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                  )}>{t('settings.show_live_upcoming_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.showLiveUpcomingBox ?? true} 
                    onChange={(e) => setFormData({ ...formData, showLiveUpcomingBox: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                  )}></div>
                </label>
              </div>

              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-green-900/10 border-green-900/50" : "bg-green-50 border-green-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-green-400" : "text-green-900"
                  )}>{t('settings.show_lang_switch')}</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-green-500/80" : "text-green-700"
                  )}>{t('settings.show_lang_switch_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.showLanguageSwitch ?? true} 
                    onChange={(e) => setFormData({ ...formData, showLanguageSwitch: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-green-900" : "bg-gray-200 peer-focus:ring-green-300"
                  )}></div>
                </label>
              </div>

              <div className={cn(
                "flex items-center justify-between p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/50" : "bg-amber-50/50 border-amber-100"
              )}>
                <div>
                  <h3 className={cn(
                    "text-sm font-bold transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                  )}>{t('settings.silent_bell')}</h3>
                  <p className={cn(
                    "text-[10px] transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                  )}>{t('settings.silent_bell_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.silentBell ?? false} 
                    onChange={(e) => setFormData({ ...formData, silentBell: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                  )}></div>
                </label>
              </div>

              <div className={cn(
                "p-4 rounded-xl border mt-3 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-red-900/10 border-red-900/50" : "bg-red-50 border-red-100"
              )}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Lock className={cn(settings?.theme === 'dark' ? "text-red-400" : "text-red-600")} size={20} />
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-red-400" : "text-red-900"
                    )}>{t('settings.freeze_app')}</h3>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.freezeEnabled ?? false} 
                      onChange={(e) => setFormData({ ...formData, freezeEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600",
                      settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-red-900" : "bg-gray-200 peer-focus:ring-red-300"
                    )}></div>
                  </label>
                </div>
                
                <p className={cn(
                  "text-[10px] mb-4 transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-red-500/80" : "text-red-700"
                )}>{t('settings.freeze_desc')}</p>

                <div className="space-y-3">

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>{t('settings.freeze_time')}</label>
                    <input 
                      type="number"
                      min={1}
                      value={formData.freezeTime || 5}
                      onChange={(e) => setFormData({ ...formData, freezeTime: parseInt(e.target.value) })}
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-red-500 transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-900 border-red-900/50 text-white" : "bg-white border-red-200 text-red-900"
                      )}
                    />
                  </div>
                </div>
              </div>

              {/* Protect PDF with Password */}
              <div className={cn(
                "p-4 rounded-xl border flex items-center justify-between mt-3 transition-all duration-300",
                settings?.theme === 'dark' ? "bg-indigo-950/20 border-indigo-900/50" : "bg-indigo-50/70 border-indigo-100"
              )}>
                <div className="space-y-0.5">
                  <span className={cn(
                    "font-bold text-sm block",
                    settings?.theme === 'dark' ? "text-indigo-300" : "text-indigo-900"
                  )}>
                    {language === 'pt' ? 'Proteger PDF com Palavra-passe' : 'Protect PDF with password'}
                  </span>
                  <span className="text-xs text-gray-500 block">
                    {language === 'pt' 
                      ? 'Aplica encriptação por palavra-passe ao ficheiro .pdf gerado usando a Pass. de Desbloqueio (Auto-Lock & PDF)'
                      : 'Encrypts the generated .pdf file directly using the App Unlock Pass (Auto-Lock & PDF)'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                  <input 
                    type="checkbox"
                    checked={!!formData.protectPdfWithPassword}
                    onChange={(e) => setFormData({ ...formData, protectPdfWithPassword: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

            </div>
          </div>
        </div>

        {/* Visuals */}
        <div className={cn(
          "p-6 rounded-xl shadow-sm border space-y-6 transition-colors duration-300",
          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        )}>
          <h2 className={cn(
            "text-xl font-semibold flex items-center gap-2 border-b pb-3 transition-colors duration-300",
            settings?.theme === 'dark' ? "border-gray-800 text-white" : "border-gray-100 text-gray-900"
          )}>
            <ImageIcon className="text-amber-600" size={20} />
            {t('settings.branding')}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.logo')}</label>
              {formData.useCloudinary ? (
                <div className="space-y-2">
                  <input 
                    type="text"
                    value={formData.cloudinaryLogoUrl || ''}
                    onChange={(e) => setFormData({ ...formData, cloudinaryLogoUrl: e.target.value })}
                    placeholder="Cloudinary Logo URL"
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                  <label className={cn(
                    "relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                    uploadingField === 'logoUrl' ? "opacity-50 cursor-not-allowed" : "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10",
                    settings?.theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"
                  )}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingField === 'logoUrl'}
                      onChange={(e) => handleFileUpload(e, 'logoUrl')}
                    />
                    <Cloud size={16} className={uploadingField === 'logoUrl' ? "animate-pulse" : "text-amber-600"} />
                    <span className="text-xs font-medium">
                      {uploadingField === 'logoUrl' ? t('common.loading') : t('settings.upload_to_cloudinary')}
                    </span>
                  </label>
                </div>
              ) : (
                <input 
                  type="text"
                  value={formData.logoUrl || ''}
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                  placeholder="https://example.com/logo.png"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                />
              )}
              
              <div 
                className="mt-2 relative rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-white flex items-center justify-center p-2 group transition-all"
                style={{ height: `${Math.max(64, (formData.logoSize || 32) + 16)}px`, width: 'fit-content', minWidth: '128px' }}
              >
                {getOptimizedUrl(formData.logoUrl, formData, 'logo') ? (
                  <img 
                    src={getOptimizedUrl(formData.logoUrl, formData, 'logo')} 
                    alt="Logo Preview" 
                    className="w-auto object-contain transition-all"
                    style={{ height: `${formData.logoSize || 32}px` }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img 
                      src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=200&h=200&fit=crop&q=40" 
                      alt="Placeholder" 
                      className="absolute inset-0 w-full h-full object-cover opacity-20 grayscale"
                    />
                    <div className="relative z-10 flex flex-col items-center">
                      <ImageIcon size={20} className="text-gray-300" />
                      <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest mt-1">No Logo</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.logo_size')}</label>
              <div className="space-y-2">
                <div className={cn(
                  "flex justify-between text-xs transition-colors",
                  settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  <span>{t('settings.logo_size_desc')}</span>
                  <span className="font-mono font-bold">{formData.logoSize || 32}px</span>
                </div>
                <input 
                  type="range"
                  min="16"
                  max="120"
                  step="1"
                  value={formData.logoSize ?? 32}
                  onChange={(e) => setFormData({ ...formData, logoSize: parseInt(e.target.value) })}
                  className={cn(
                    "w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-600 transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-800" : "bg-gray-200"
                  )}
                />
              </div>
            </div>

            {/* Show Logo Switch */}
            <div className={cn(
              "flex items-center justify-between p-4 rounded-xl border transition-colors duration-300",
              settings?.theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-100"
            )}>
              <div>
                <h3 className={cn(
                  "text-sm font-bold transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-gray-200" : "text-gray-800"
                )}>{t('settings.show_logo')}</h3>
                <p className={cn(
                  "text-[10px] transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>{t('settings.show_logo_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.showLogo ?? true} 
                  onChange={(e) => setFormData({ ...formData, showLogo: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={cn(
                  "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                  settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                )}></div>
              </label>
            </div>

            {/* Show Restaurant Name Switch */}
            <div className={cn(
              "flex items-center justify-between p-4 rounded-xl border transition-colors duration-300",
              settings?.theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-100"
            )}>
              <div>
                <h3 className={cn(
                  "text-sm font-bold transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-gray-200" : "text-gray-800"
                )}>{t('settings.show_name')}</h3>
                <p className={cn(
                  "text-[10px] transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>{t('settings.show_name_desc')}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.showRestaurantName ?? true} 
                  onChange={(e) => setFormData({ ...formData, showRestaurantName: e.target.checked })}
                  className="sr-only peer"
                />
                <div className={cn(
                  "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                  settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                )}></div>
              </label>
            </div>

            {/* Dedicated Favicon Section */}
            <div className={cn(
              "p-4 rounded-xl border space-y-3 transition-colors duration-300",
              settings?.theme === 'dark' ? "bg-gray-800/40 border-gray-700" : "bg-gray-50/80 border-gray-200"
            )}>
              <div>
                <label className={cn(
                  "block text-sm font-semibold flex items-center gap-2",
                  settings?.theme === 'dark' ? "text-gray-200" : "text-gray-800"
                )}>
                  <Globe className="text-amber-600" size={16} />
                  {t('settings.favicon')}
                </label>
              </div>

              <p className={cn(
                "text-xs leading-relaxed",
                settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                {t('settings.favicon_desc')}
              </p>

              {formData.useCloudinary ? (
                <div className="space-y-2">
                  <input 
                    type="text"
                    value={formData.cloudinaryFaviconUrl || ''}
                    onChange={(e) => setFormData({ ...formData, cloudinaryFaviconUrl: e.target.value })}
                    placeholder="Cloudinary Favicon URL"
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors text-sm",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                  <label className={cn(
                    "relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                    uploadingField === 'faviconUrl' ? "opacity-50 cursor-not-allowed" : "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10",
                    settings?.theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-white"
                  )}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingField === 'faviconUrl'}
                      onChange={(e) => handleFileUpload(e, 'faviconUrl')}
                    />
                    <Cloud size={16} className={uploadingField === 'faviconUrl' ? "animate-pulse" : "text-amber-600"} />
                    <span className="text-xs font-medium">
                      {uploadingField === 'faviconUrl' ? t('common.loading') : t('settings.upload_to_cloudinary')}
                    </span>
                  </label>
                </div>
              ) : (
                <input 
                  type="text"
                  value={formData.faviconUrl || ''}
                  onChange={(e) => setFormData({ ...formData, faviconUrl: e.target.value })}
                  placeholder="https://example.com/favicon.ico or /favicon.svg"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors text-sm",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                />
              )}

              {/* Favicon Browser Tab Simulation & Preview */}
              <div className="pt-2">
                <div className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mb-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span>{t('settings.favicon_preview')}</span>
                    {(formData.faviconUrl || formData.cloudinaryFaviconUrl) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFormData({
                            ...formData,
                            faviconUrl: '',
                            cloudinaryFaviconUrl: ''
                          });
                          toast.success(
                            language === 'pt'
                              ? 'Favicon reposto para o padrão.'
                              : 'Favicon reset to default.'
                          );
                        }}
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-md border flex items-center gap-1 transition-colors cursor-pointer",
                          settings?.theme === 'dark'
                            ? "border-gray-700 text-gray-300 hover:bg-gray-700 hover:text-white bg-gray-800"
                            : "border-gray-300 text-gray-700 hover:bg-gray-100 hover:text-gray-900 bg-white"
                        )}
                        title={language === 'pt' ? 'Repor para o padrão' : 'Reset to default'}
                      >
                        <RotateCcw size={10} className="text-amber-600 dark:text-amber-400" />
                        <span>{language === 'pt' ? 'Padrão' : 'Default'}</span>
                      </button>
                    )}
                  </div>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-medium border",
                    (formData.faviconUrl || formData.cloudinaryFaviconUrl)
                      ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700"
                  )}>
                    {(formData.faviconUrl || formData.cloudinaryFaviconUrl)
                      ? t('settings.favicon_custom')
                      : t('settings.favicon_default')}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  {/* Standalone square preview */}
                  <div className={cn(
                    "w-12 h-12 rounded-lg border flex items-center justify-center p-2 shadow-xs bg-white shrink-0",
                    settings?.theme === 'dark' ? "border-gray-700" : "border-gray-200"
                  )}>
                    <img 
                      src={getOptimizedUrl(formData.faviconUrl, formData, 'favicon') || '/favicon.svg'} 
                      alt="Favicon Preview" 
                      className="w-8 h-8 object-contain rounded-sm"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/favicon.svg';
                      }}
                    />
                  </div>

                  {/* Browser Tab Simulation */}
                  <div className={cn(
                    "flex-1 min-w-[200px] max-w-sm rounded-t-lg border-t border-x px-3 py-2 flex items-center gap-2 shadow-xs",
                    settings?.theme === 'dark' 
                      ? "bg-gray-900 border-gray-700 text-gray-200" 
                      : "bg-white border-gray-300 text-gray-800"
                  )}>
                    <img 
                      src={getOptimizedUrl(formData.faviconUrl, formData, 'favicon') || '/favicon.svg'} 
                      alt="Tab Icon" 
                      className="w-4 h-4 object-contain shrink-0"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/favicon.svg';
                      }}
                    />
                    <span className="text-xs font-medium truncate flex-1">
                      {formData.name || 'Dino Pro Master'}
                    </span>
                    <X size={12} className="text-gray-400 shrink-0" />
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.hero')}</label>
              {formData.useCloudinary ? (
                <div className="space-y-2">
                  <input 
                    type="text"
                    value={formData.cloudinaryHeroImageUrl || ''}
                    onChange={(e) => setFormData({ ...formData, cloudinaryHeroImageUrl: e.target.value })}
                    placeholder="Cloudinary Hero URL"
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                  <label className={cn(
                    "relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                    uploadingField === 'heroImageUrl' ? "opacity-50 cursor-not-allowed" : "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10",
                    settings?.theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"
                  )}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingField === 'heroImageUrl'}
                      onChange={(e) => handleFileUpload(e, 'heroImageUrl')}
                    />
                    <Cloud size={16} className={uploadingField === 'heroImageUrl' ? "animate-pulse" : "text-amber-600"} />
                    <span className="text-xs font-medium">
                      {uploadingField === 'heroImageUrl' ? t('common.loading') : t('settings.upload_to_cloudinary')}
                    </span>
                  </label>
                </div>
              ) : (
                <input 
                  type="text"
                  value={formData.heroImageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, heroImageUrl: e.target.value })}
                  placeholder="https://example.com/hero.jpg"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                />
              )}
              
              <div className="mt-2 relative h-32 w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 flex items-center justify-center group">
                {getOptimizedUrl(formData.heroImageUrl, formData, 'hero') ? (
                  <img 
                    src={getOptimizedUrl(formData.heroImageUrl, formData, 'hero')} 
                    alt="Hero Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img 
                      src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800&h=400&fit=crop&q=40" 
                      alt="Placeholder" 
                      className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale"
                    />
                    <div className="relative z-10 flex flex-col items-center bg-white/60 dark:bg-black/40 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
                      <ImageIcon size={24} className="text-amber-600 mb-1" />
                      <span className="text-[10px] text-gray-900 dark:text-white font-bold uppercase tracking-widest">Hero Placeholder</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.hero_overlay')}</label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input 
                    type="color"
                    value={formData.heroOverlay?.startsWith('#') ? formData.heroOverlay : '#000000'}
                    onChange={(e) => setFormData({ ...formData, heroOverlay: e.target.value })}
                    className={cn(
                      "h-10 w-10 p-1 border rounded-lg cursor-pointer transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-mono transition-colors",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>{formData.heroOverlay || '#000000'}</span>
                </div>
                <div className="space-y-1">
                  <div className={cn(
                    "flex justify-between text-xs transition-colors",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    <span>{t('settings.intensity')}</span>
                    <span>{Math.round((formData.heroOverlayOpacity ?? 0.5) * 100)}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formData.heroOverlayOpacity ?? 0.5}
                    onChange={(e) => setFormData({ ...formData, heroOverlayOpacity: parseFloat(e.target.value) })}
                    className={cn(
                      "w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-600 transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800" : "bg-gray-200"
                    )}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.footer')}</label>
              {formData.useCloudinary ? (
                <div className="space-y-2">
                  <input 
                    type="text"
                    value={formData.cloudinaryFooterImageUrl || ''}
                    onChange={(e) => setFormData({ ...formData, cloudinaryFooterImageUrl: e.target.value })}
                    placeholder="Cloudinary Footer URL"
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                  <label className={cn(
                    "relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                    uploadingField === 'footerImageUrl' ? "opacity-50 cursor-not-allowed" : "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10",
                    settings?.theme === 'dark' ? "border-gray-700 bg-gray-800/50" : "border-gray-200 bg-gray-50"
                  )}>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      disabled={uploadingField === 'footerImageUrl'}
                      onChange={(e) => handleFileUpload(e, 'footerImageUrl')}
                    />
                    <Cloud size={16} className={uploadingField === 'footerImageUrl' ? "animate-pulse" : "text-amber-600"} />
                    <span className="text-xs font-medium">
                      {uploadingField === 'footerImageUrl' ? t('common.loading') : t('settings.upload_to_cloudinary')}
                    </span>
                  </label>
                </div>
              ) : (
                <input 
                  type="text"
                  value={formData.footerImageUrl || ''}
                  onChange={(e) => setFormData({ ...formData, footerImageUrl: e.target.value })}
                  placeholder="https://example.com/footer.jpg"
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                />
              )}
              
              <div className="mt-2 relative h-32 w-full rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 flex items-center justify-center group">
                {getOptimizedUrl(formData.footerImageUrl, formData, 'footer') ? (
                  <img 
                    src={getOptimizedUrl(formData.footerImageUrl, formData, 'footer')} 
                    alt="Footer Preview" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <img 
                      src="https://images.unsplash.com/photo-1552566626-52f8b828add9?w=800&h=400&fit=crop&q=40" 
                      alt="Placeholder" 
                      className="absolute inset-0 w-full h-full object-cover opacity-30 grayscale"
                    />
                    <div className="relative z-10 flex flex-col items-center bg-white/60 dark:bg-black/40 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
                      <ImageIcon size={24} className="text-amber-600 mb-1" />
                      <span className="text-[10px] text-gray-900 dark:text-white font-bold uppercase tracking-widest">Footer Placeholder</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <label className={cn(
                "block text-sm font-medium mb-1",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700"
              )}>{t('settings.footer_overlay')}</label>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <input 
                    type="color"
                    value={formData.footerOverlay?.startsWith('#') ? formData.footerOverlay : '#000000'}
                    onChange={(e) => setFormData({ ...formData, footerOverlay: e.target.value })}
                    className={cn(
                      "h-10 w-10 p-1 border rounded-lg cursor-pointer transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
                    )}
                  />
                  <span className={cn(
                    "text-sm font-mono transition-colors",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>{formData.footerOverlay || '#000000'}</span>
                </div>
                <div className="space-y-1">
                  <div className={cn(
                    "flex justify-between text-xs transition-colors",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    <span>{t('settings.intensity')}</span>
                    <span>{Math.round((formData.footerOverlayOpacity ?? 0.7) * 100)}%</span>
                  </div>
                  <input 
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={formData.footerOverlayOpacity ?? 0.7}
                    onChange={(e) => setFormData({ ...formData, footerOverlayOpacity: parseFloat(e.target.value) })}
                    className={cn(
                      "w-full h-2 rounded-lg appearance-none cursor-pointer accent-amber-600 transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800" : "bg-gray-200"
                    )}
                  />
                </div>
              </div>
            </div>

            <div className={cn(
              "p-4 rounded-xl border space-y-4 pt-6 transition-colors duration-300",
              settings?.theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
            )}>
              <h3 className={cn(
                "text-sm font-bold flex items-center gap-2 transition-colors duration-300",
                settings?.theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Globe size={16} className="text-amber-600" />
                {t('settings.website_customization')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('settings.font_family')}</label>
                  <CustomDropdown 
                    value={formData.fontFamily || 'Inter'}
                    onChange={(val) => setFormData({ ...formData, fontFamily: val as any })}
                    options={[
                      { value: 'Inter', label: 'Inter (Sans)' },
                      { value: 'Playfair Display', label: 'Playfair Display (Serif)' },
                      { value: 'Montserrat', label: 'Montserrat' },
                      { value: 'Open Sans', label: 'Open Sans' },
                      { value: 'Roboto', label: 'Roboto' },
                      { value: 'Lato', label: 'Lato' },
                      { value: 'Poppins', label: 'Poppins' },
                      { value: 'Merriweather', label: 'Merriweather' },
                      { value: 'Lora', label: 'Lora' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('settings.theme')}</label>
                  <div className={cn(
                    "flex p-1 rounded-lg border transition-colors duration-300",
                    settings?.theme === 'dark' ? "bg-gray-950 border-gray-700" : "bg-white border-gray-300"
                  )}>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, theme: 'light' })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                        (formData.theme || 'light') === 'light' 
                          ? "bg-amber-600 text-white shadow-sm" 
                          : (settings?.theme === 'dark' ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-50")
                      )}
                    >
                      {t('settings.light')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, theme: 'dark' })}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-1.5 text-xs font-medium rounded-md transition-all",
                        formData.theme === 'dark' 
                          ? "bg-gray-800 text-white shadow-sm" 
                          : (settings?.theme === 'dark' ? "text-gray-400 hover:bg-gray-800" : "text-gray-600 hover:bg-gray-50")
                      )}
                    >
                      {t('settings.dark')}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {language === 'pt' ? 'Altura da Secção Principal' : 'Hero Section Height'}
                  </label>
                  <CustomDropdown
                    value={formData.heroHeight || '60vh'}
                    onChange={(val) => setFormData({ ...formData, heroHeight: val as any })}
                    options={[
                      { value: '40vh', label: '40% of Screen (Compact)' },
                      { value: '50vh', label: '50% of Screen (Medium)' },
                      { value: '60vh', label: '60% of Screen (Default)' },
                      { value: '70vh', label: '70% of Screen (Large)' },
                      { value: '80vh', label: '80% of Screen (Very Large)' },
                      { value: '100vh', label: '100% of Screen (Full)' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {language === 'pt' ? 'Largura do Contentor' : 'Container Width'}
                  </label>
                  <CustomDropdown
                    value={formData.containerWidth || 'default'}
                    onChange={(val) => setFormData({ ...formData, containerWidth: val as any })}
                    options={[
                      { value: 'default', label: language === 'pt' ? 'Padrão (Máx 1267px)' : 'Default (Max 1267px)' },
                      { value: '1480px', label: language === 'pt' ? 'Largo (Máx 1480px)' : 'Large (Max 1480px)' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-gray-500">
                      {language === 'pt' ? 'Cor Primária da Marca' : 'Branding Color'}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const newFormData = { ...formData };
                        delete newFormData.primaryColor;
                        setFormData(newFormData);
                      }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title={language === 'pt' ? 'Repor Original' : 'Reset to Default'}
                    >
                      <RotateCcw size={14} />
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="color"
                      value={formData.primaryColor?.startsWith('#') ? formData.primaryColor : '#d97706'}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className={cn(
                        "h-10 w-10 p-1 border rounded-lg cursor-pointer transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-300"
                      )}
                    />
                    <span className={cn(
                      "text-sm font-mono transition-colors",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>{formData.primaryColor || '#d97706'}</span>
                  </div>
                </div>
                
                <div className="col-span-1 md:col-span-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={cn("text-sm font-bold", settings?.theme === 'dark' ? "text-white" : "text-gray-800")}>
                        {language === 'pt' ? 'Vistas Compactas' : 'Compact Views'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {language === 'pt' ? 'Reduz em 30% a altura das caixas de reservas e clientes' : 'Decreases the height of reservation and customer boxes by 30%'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.compactAdminViews || false} 
                        onChange={(e) => setFormData({ ...formData, compactAdminViews: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>

                <div className="col-span-1 md:col-span-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className={cn("text-sm font-bold", settings?.theme === 'dark' ? "text-white" : "text-gray-800")}>
                        {language === 'pt' ? 'Transições de Página' : 'Page Transitions'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {language === 'pt' ? 'Ativa animações e transições suaves durante a navegação entre as páginas' : 'Enables smooth animations and page transitions when navigating between pages'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.enablePageTransitions !== false} 
                        onChange={(e) => setFormData({ ...formData, enablePageTransitions: e.target.checked })}
                        className="sr-only peer" 
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('settings.button_radius')}</label>
                  <CustomDropdown 
                    value={formData.buttonBorderRadius || '8px'}
                    onChange={(val) => setFormData({ ...formData, buttonBorderRadius: val })}
                    options={[
                      { value: '0px', label: t('settings.radius_none') + ' (0px)' },
                      { value: '4px', label: t('settings.radius_sm') + ' (4px)' },
                      { value: '8px', label: t('settings.radius_md') + ' (8px)' },
                      { value: '12px', label: t('settings.radius_lg') + ' (12px)' },
                      { value: '16px', label: t('settings.radius_xl') + ' (16px)' },
                      { value: '24px', label: t('settings.radius_2xl') + ' (24px)' },
                      { value: '9999px', label: t('settings.radius_full') + ' (9999px)' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('settings.box_radius')}</label>
                  <CustomDropdown 
                    value={formData.boxBorderRadius || '16px'}
                    onChange={(val) => setFormData({ ...formData, boxBorderRadius: val })}
                    options={[
                      { value: '0px', label: t('settings.radius_none') + ' (0px)' },
                      { value: '4px', label: t('settings.radius_sm') + ' (4px)' },
                      { value: '8px', label: t('settings.radius_md') + ' (8px)' },
                      { value: '12px', label: t('settings.radius_lg') + ' (12px)' },
                      { value: '16px', label: t('settings.radius_xl') + ' (16px)' },
                      { value: '24px', label: t('settings.radius_2xl') + ' (24px)' },
                      { value: '9999px', label: t('settings.radius_full') + ' (9999px)' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('settings.input_radius')}</label>
                  <CustomDropdown 
                    value={formData.inputBorderRadius || '8px'}
                    onChange={(val) => setFormData({ ...formData, inputBorderRadius: val })}
                    options={[
                      { value: '0px', label: t('settings.radius_none') + ' (0px)' },
                      { value: '4px', label: t('settings.radius_sm') + ' (4px)' },
                      { value: '8px', label: t('settings.radius_md') + ' (8px)' },
                      { value: '12px', label: t('settings.radius_lg') + ' (12px)' },
                      { value: '16px', label: t('settings.radius_xl') + ' (16px)' },
                      { value: '24px', label: t('settings.radius_2xl') + ' (24px)' },
                      { value: '9999px', label: t('settings.radius_full') + ' (9999px)' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    {language === 'pt' ? 'Fundo do Preloader' : 'Preloader Background'}
                  </label>
                  <CustomDropdown 
                    value={formData.preloaderBg || 'white'}
                    onChange={(val) => setFormData({ ...formData, preloaderBg: val as any })}
                    options={[
                      { value: 'white', label: language === 'pt' ? 'Tema Branco' : 'White Theme' },
                      { value: 'dark', label: language === 'pt' ? 'Tema Escuro' : 'Dark Theme' },
                      { value: 'brand', label: language === 'pt' ? 'Tema da Marca' : 'Brand Theme' }
                    ]}
                    isDark={settings?.theme === 'dark'}
                  />
                </div>
              </div>
            </div>

            {/* Pages & Maintenance */}
            <div className={cn(
              "p-4 rounded-xl border space-y-4 pt-6 transition-colors duration-300",
              settings?.theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
            )}>
              <h3 className={cn(
                "text-sm font-bold flex items-center gap-2 transition-colors duration-300",
                settings?.theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Lock size={16} className="text-amber-600" />
                {language === 'pt' ? 'Páginas e Manutenção' : 'Pages & Maintenance'}
              </h3>
              
              <div className="space-y-4">
                <div className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-colors duration-300",
                  settings?.theme === 'dark' ? "bg-gray-950 border-gray-800" : "bg-white border-gray-200"
                )}>
                  <div>
                    <h4 className="text-sm font-bold">
                      {language === 'pt' ? 'Modo de Manutenção' : 'Maintenance Mode'}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {language === 'pt' 
                        ? 'Desativar as reservas públicas e exibir uma página de manutenção para os clientes.' 
                        : 'Disable public booking and display a maintenance page to customers.'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={formData.maintenanceModeEnabled ?? false} 
                      onChange={(e) => setFormData({ ...formData, maintenanceModeEnabled: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                      settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                    )}></div>
                  </label>
                </div>

                {formData.maintenanceModeEnabled && (
                  <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex flex-col gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {language === 'pt' ? 'Mensagem de Manutenção (PT)' : 'Maintenance Message (PT)'}
                        </label>
                        <textarea 
                          value={formData.maintenanceMessage || ''}
                          onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                          placeholder={
                            language === 'pt' 
                              ? 'De momento o nosso sistema de reservas encontra-se em manutenção. Por favor, tente mais tarde ou contacte-nos diretamente.' 
                              : 'Our booking system is currently undergoing maintenance. Please try again later or contact us directly.'
                          }
                          rows={3}
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                            settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          {language === 'pt' ? 'Mensagem de Manutenção (EN)' : 'Maintenance Message (EN)'}
                        </label>
                        <textarea 
                          value={formData.maintenanceMessageEn || ''}
                          onChange={(e) => setFormData({ ...formData, maintenanceMessageEn: e.target.value })}
                          placeholder="Our booking system is currently undergoing maintenance. Please try again later or contact us directly."
                          rows={3}
                          className={cn(
                            "w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                            settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                          )}
                        />
                      </div>
                    </div>

                    <div className={cn(
                      "border rounded-xl overflow-hidden transition-all duration-300",
                      settings?.theme === 'dark' ? "border-amber-950/40 bg-amber-950/5" : "border-amber-200/40 bg-amber-50/10"
                    )}>
                      <button
                        type="button"
                        onClick={() => setShowHeroAccordion(!showHeroAccordion)}
                        className="w-full flex items-center justify-between px-4 py-3 select-none text-left focus:outline-none"
                      >
                        <span className={cn(
                          "text-xs font-bold flex items-center gap-2",
                          settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                        )}>
                          {language === 'pt' ? 'Mostrar Imagem Principal de Fundo (100vh)' : 'Show Fullscreen Background Image (100vh)'}
                        </span>
                        <ChevronDown 
                          size={16} 
                          className={cn(
                            "transition-transform duration-300 text-amber-600",
                            showHeroAccordion ? "rotate-180" : "rotate-0"
                          )} 
                        />
                      </button>
                      
                      <AnimatePresence initial={false}>
                        {showHeroAccordion && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 pt-2 border-t border-dashed border-amber-200/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div>
                                <p className="text-[11.5px] text-gray-500 max-w-sm font-medium">
                                  {language === 'pt' 
                                    ? 'Exibir uma imagem de fundo impressionante ocupando toda a tela (100vh).' 
                                    : 'Display a stunning fullscreen background image covering the entire viewport (100vh).'}
                                </p>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer self-start sm:self-center">
                                <input 
                                  type="checkbox" 
                                  checked={formData.maintenanceShowHero ?? false} 
                                  onChange={(e) => setFormData({ ...formData, maintenanceShowHero: e.target.checked })}
                                  className="sr-only peer"
                                />
                                <div className={cn(
                                  "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                                  settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                                )}></div>
                              </label>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                  </div>
                )}

                {/* Developing Mode */}
                <div className={cn(
                  "flex flex-col gap-4 p-4 rounded-xl border transition-colors duration-300",
                  settings?.theme === 'dark' ? "bg-gray-950 border-gray-800" : "bg-white border-gray-200"
                )}>
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold">
                        {language === 'pt' ? 'Modo de Desenvolvimento' : 'Developing Mode'}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {language === 'pt' 
                          ? 'Ativar uma tela de bloqueio com palavra-passe que cobre todo o website.' 
                          : 'Activate a password-protected lock screen covering the entire website.'}
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={formData.developingModeEnabled ?? false} 
                        onChange={(e) => setFormData({ ...formData, developingModeEnabled: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className={cn(
                        "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                        settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                      )}></div>
                    </label>
                  </div>

                  {formData.developingModeEnabled && (
                    <div className="space-y-3 pt-3 border-t border-dashed border-gray-200/50 dark:border-gray-800/50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">
                          {language === 'pt' ? 'Palavra-passe de Acesso' : 'Access Password'}
                        </label>
                        <div className="relative">
                          <input 
                            type={showAdminDevelopingPassword ? "text" : "password"}
                            value={formData.developingPassword || ''}
                            onChange={(e) => setFormData({ ...formData, developingPassword: e.target.value })}
                            placeholder={language === 'pt' ? 'Palavra-passe para desbloquear a app' : 'Password to unlock the app'}
                            className={cn(
                              "w-full pl-3 pr-10 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                              settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                            )}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminDevelopingPassword(!showAdminDevelopingPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 cursor-pointer p-0.5"
                          >
                            {showAdminDevelopingPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              {/* Floor Plan Layout Section */}
              <div className={cn(
                "p-4 rounded-xl border mt-3 space-y-4 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/10 border-amber-900/50" : "bg-amber-50 border-amber-100"
              )}>
                <div className="flex items-center justify-between cursor-pointer select-none" onClick={() => setIsFloorPlanAccordionOpen(!isFloorPlanAccordionOpen)}>
                  <div className="flex items-center gap-2">
                    <Map className={cn(settings?.theme === 'dark' ? "text-amber-400" : "text-amber-600")} size={20} />
                    <h3 className={cn(
                      "text-sm font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-900"
                    )}>{t('settings.floor_plan_title')}</h3>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="relative inline-flex items-center cursor-pointer" onClick={(e) => e.stopPropagation()}>
                      <input 
                        type="checkbox" 
                        checked={formData.showFloorPlanBg !== false}
                        onChange={(e) => setFormData({ ...formData, showFloorPlanBg: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className={cn(
                        "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                        settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                      )}></div>
                    </label>
                    <button type="button" className="text-gray-500 hover:text-gray-700 transition-colors">
                      {isFloorPlanAccordionOpen ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                </div>

                <p className={cn(
                  "text-[10px] transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-700"
                )}>{t('settings.floor_plan_show_desc')}</p>

                <AnimatePresence>
                {(formData.showFloorPlanBg !== false && isFloorPlanAccordionOpen) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                  >
                    <div className="space-y-4 pt-3 border-t border-amber-200/50 dark:border-amber-900/30 mt-3">
                    {/* Background Type Option (Default vs Custom) */}
                    <div className="space-y-2">
                      <p className={cn(
                        "text-[10px] font-medium uppercase tracking-wider transition-colors",
                        settings?.theme === 'dark' ? "text-amber-400" : "text-amber-700"
                      )}>{t('settings.floor_plan_bg_type')}</p>
                      
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, useDefaultFloorPlanBg: true })}
                          className={cn(
                            "flex-1 py-2 px-4 rounded-lg text-xs font-bold border transition-all duration-200",
                            formData.useDefaultFloorPlanBg === true
                              ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                              : (settings?.theme === 'dark'
                                  ? "bg-gray-900 border-gray-700 text-amber-100 hover:bg-gray-800"
                                  : "bg-white border-gray-200 text-amber-900 hover:bg-gray-50")
                          )}
                        >
                          {t('settings.floor_plan_use_default')}
                        </button>
                        
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, useDefaultFloorPlanBg: false })}
                          className={cn(
                            "flex-1 py-2 px-4 rounded-lg text-xs font-bold border transition-all duration-200",
                            formData.useDefaultFloorPlanBg !== true
                              ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                              : (settings?.theme === 'dark'
                                  ? "bg-gray-900 border-gray-700 text-amber-100 hover:bg-gray-800"
                                  : "bg-white border-gray-200 text-amber-900 hover:bg-gray-50")
                          )}
                        >
                          {t('settings.floor_plan_use_custom')}
                        </button>
                      </div>
                      
                      <p className={cn(
                        "text-[10px] italic transition-colors",
                        settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-600"
                      )}>{t('settings.floor_plan_bg_type_desc')}</p>
                    </div>

                    {/* Image URL & Cloudinary Upload */}
                    <div className="space-y-2">
                      <p className={cn(
                        "text-[10px] font-medium uppercase tracking-wider transition-colors",
                        settings?.theme === 'dark' ? "text-amber-400" : "text-amber-700"
                      )}>{t('settings.floor_plan_url')}</p>
                      
                      {formData.useCloudinary ? (
                        <div className="space-y-2">
                          <input 
                            type="text"
                            value={formData.floorPlanBgUrl || ''}
                            onChange={(e) => setFormData({ ...formData, floorPlanBgUrl: e.target.value })}
                            placeholder="e.g. https://example.com/layout.png"
                            disabled={formData.useDefaultFloorPlanBg === true}
                            className={cn(
                              "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-semibold transition-colors",
                              formData.useDefaultFloorPlanBg === true ? "opacity-50 cursor-not-allowed" : "",
                              settings?.theme === 'dark' ? "bg-gray-900 border-amber-900/50 text-amber-100 placeholder-amber-800" : "bg-white border-amber-200 text-amber-900 placeholder-amber-200"
                            )}
                          />
                          <label className={cn(
                            "relative flex items-center justify-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-all",
                            formData.useDefaultFloorPlanBg === true ? "opacity-40 cursor-not-allowed pointer-events-none" : "",
                            uploadingField === 'floorPlanBgUrl' ? "opacity-50 cursor-not-allowed" : "hover:border-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/10",
                            settings?.theme === 'dark' ? "border-amber-900/50 bg-gray-900/50" : "border-amber-200 bg-amber-50/50"
                          )}>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="absolute inset-0 opacity-0 cursor-pointer"
                              disabled={uploadingField === 'floorPlanBgUrl' || formData.useDefaultFloorPlanBg === true}
                              onChange={(e) => handleFileUpload(e, 'floorPlanBgUrl')}
                            />
                            <Cloud size={16} className={uploadingField === 'floorPlanBgUrl' ? "animate-pulse" : "text-amber-600"} />
                            <span className="text-xs font-medium">
                              {uploadingField === 'floorPlanBgUrl' ? t('common.loading') : t('settings.upload_to_cloudinary')}
                            </span>
                          </label>
                        </div>
                      ) : (
                        <input 
                          type="text"
                          value={formData.floorPlanBgUrl || ''}
                          onChange={(e) => setFormData({ ...formData, floorPlanBgUrl: e.target.value })}
                          placeholder="e.g. https://example.com/layout.png"
                          disabled={formData.useDefaultFloorPlanBg === true}
                          className={cn(
                            "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-semibold transition-colors",
                            formData.useDefaultFloorPlanBg === true ? "opacity-50 cursor-not-allowed" : "",
                            settings?.theme === 'dark' ? "bg-gray-900 border-amber-900/50 text-amber-100 placeholder-amber-800" : "bg-white border-amber-200 text-amber-900 placeholder-amber-200"
                          )}
                        />
                      )}
                      
                      <p className={cn(
                        "text-[10px] italic transition-colors",
                        settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-600"
                      )}>{t('settings.floor_plan_url_desc')}</p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <p className={cn(
                          "text-[10px] font-medium uppercase tracking-wider transition-colors",
                          settings?.theme === 'dark' ? "text-amber-400" : "text-amber-700"
                        )}>{t('settings.floor_plan_opacity')}</p>
                        <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                          {Math.round((formData.floorPlanOpacity ?? 1.0) * 100)}%
                        </span>
                      </div>
                      <input 
                        type="range"
                        min="0.1"
                        max="1"
                        step="0.05"
                        value={formData.floorPlanOpacity ?? 1.0}
                        onChange={(e) => setFormData({ ...formData, floorPlanOpacity: parseFloat(e.target.value) })}
                        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer dark:bg-amber-950 accent-amber-600"
                      />
                    </div>
                  </div>
                  </motion.div>
                )}
                </AnimatePresence>
              </div>

                {/* Data History Password */}
                <div className={cn(
              "p-4 rounded-xl border flex items-center justify-between gap-4 transition-all duration-300",
              settings?.theme === 'dark' ? "bg-amber-900/20 border-amber-900/50" : "bg-amber-50 border-amber-100"
            )}>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <Lock size={16} className="text-amber-600" />
                  <span className={cn(
                    "font-bold text-sm",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-800"
                  )}>Data History Password</span>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input
                    type={showDataHistoryPass ? "text" : "password"}
                    value={formData.dataHistoryPassword || ''}
                    onChange={(e) => setFormData({ ...formData, dataHistoryPassword: e.target.value })}
                    disabled={isDataHistoryLocked}
                    className={cn(
                      "w-full px-4 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                      isDataHistoryLocked && "opacity-60 cursor-not-allowed border-dashed"
                    )}
                    placeholder="Enter password to restrict Data History"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowDataHistoryPass(!showDataHistoryPass)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      showDataHistoryPass ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:text-amber-600"
                    )}
                    title={showDataHistoryPass ? "Hide details" : "Show details"}
                  >
                    {showDataHistoryPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsDataHistoryLocked(!isDataHistoryLocked)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      isDataHistoryLocked ? "text-gray-400 hover:text-amber-600" : "text-amber-600 hover:bg-amber-100"
                    )}
                    title={isDataHistoryLocked ? "Unlock to edit" : "Lock settings"}
                  >
                    {isDataHistoryLocked ? <Lock size={14} /> : <Unlock size={14} className="text-amber-600 font-bold" />}
                  </button>
                </div>
              </div>
            </div>
              </div>

              {/* App Unlock PIN */}
              <div className={cn(
                "p-4 rounded-xl border flex items-center justify-between gap-4 mt-3 transition-all duration-300",
                settings?.theme === 'dark' ? "bg-amber-900/20 border-amber-900/50" : "bg-amber-50 border-amber-100"
              )}>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Lock size={16} className="text-amber-600" />
                    <span className={cn(
                      "font-bold text-sm",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-800"
                    )}>{language === 'pt' ? 'Pass. de Desbloqueio (Auto-Lock & PDF)' : 'App Unlock Pass (Auto-Lock & PDF)'}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type={showAppUnlockPin ? "text" : "password"}
                      value={formData.appUnlockPin || ''}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
                        setFormData({ ...formData, appUnlockPin: val, pdfPassword: val });
                      }}
                      disabled={isAppUnlockPinLocked}
                      className={cn(
                        "w-full px-4 py-1.5 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isAppUnlockPinLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                      placeholder="Max 10 chars"
                      maxLength={10}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowAppUnlockPin(!showAppUnlockPin)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors overflow-hidden",
                        showAppUnlockPin ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:text-amber-600"
                      )}
                      title={showAppUnlockPin ? "Hide details" : "Show details"}
                    >
                      {showAppUnlockPin ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setIsAppUnlockPinLocked(!isAppUnlockPinLocked)}
                      className={cn(
                        "p-1.5 rounded-lg transition-colors overflow-hidden",
                        isAppUnlockPinLocked ? "text-gray-400 hover:text-amber-600" : "text-amber-600 hover:bg-amber-100"
                      )}
                      title={isAppUnlockPinLocked ? "Unlock to edit" : "Lock settings"}
                    >
                      {isAppUnlockPinLocked ? <Lock size={14} /> : <Unlock size={14} className="text-amber-600 font-bold" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className={cn(
          "p-6 rounded-xl shadow-sm border space-y-6 transition-colors duration-300",
          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        )}>
          <h2 className={cn(
            "text-xl font-semibold flex items-center gap-2 border-b pb-3 transition-colors duration-300",
            settings?.theme === 'dark' ? "border-gray-800 text-white" : "border-gray-100 text-gray-900"
          )}>
            <Share2 className="text-amber-600" size={20} />
            {t('settings.social')}
          </h2>
          
          <div className="space-y-4">
            {(formData.socialLinks || []).map((link, index) => (
              <div key={index} className={cn(
                "flex items-center gap-2 p-3 rounded-lg border transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
              )}>
                <div className="flex-shrink-0 text-gray-400">
                  {link.platform === 'facebook' && <FaFacebook size={18} />}
                  {link.platform === 'instagram' && <FaInstagram size={18} />}
                  {link.platform === 'tiktok' && <Music2 size={18} />}
                  {link.platform === 'youtube' && <Video size={18} />}
                  {link.platform === 'tripadvisor' && (
                    <img 
                      src="https://www.vectorlogo.zone/logos/tripadvisor/tripadvisor-icon.svg" 
                      alt="TripAdvisor" 
                      className="w-[18px] h-[18px]"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
                <div className="flex-grow transition-colors">
                  <div className={cn(
                    "text-[10px] font-bold uppercase mb-1 transition-colors",
                    settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                  )}>{link.platform}</div>
                  <input 
                    type="url"
                    value={link.url}
                    onChange={(e) => {
                      const newLinks = [...(formData.socialLinks || [])];
                      newLinks[index] = { ...newLinks[index], url: e.target.value };
                      setFormData({ ...formData, socialLinks: newLinks });
                    }}
                    placeholder="https://..."
                    className={cn(
                      "w-full bg-transparent border-none p-0 text-sm focus:ring-0 transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                    )}
                  />
                </div>
                <button 
                  onClick={() => {
                    const newLinks = (formData.socialLinks || []).filter((_, i) => i !== index);
                    setFormData({ ...formData, socialLinks: newLinks });
                  }}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <div className="grid grid-cols-3 gap-2 pt-2">
              <button
                disabled={formData.socialLinks?.some(l => l.platform === 'facebook')}
                onClick={() => setFormData({ 
                  ...formData, 
                  socialLinks: [...(formData.socialLinks || []), { platform: 'facebook', url: '' }] 
                })}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 border rounded-lg transition-all group",
                  settings?.theme === 'dark' 
                    ? "border-gray-800 hover:border-amber-500 hover:bg-amber-900/20" 
                    : "border-gray-200 hover:border-amber-500 hover:bg-amber-50",
                  formData.socialLinks?.some(l => l.platform === 'facebook') && "opacity-40 cursor-not-allowed filter grayscale"
                )}
              >
                <FaFacebook size={18} className="text-gray-400 group-hover:text-amber-600" />
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  settings?.theme === 'dark' ? "text-gray-500 group-hover:text-gray-300" : "text-gray-500 group-hover:text-gray-700"
                )}>Facebook</span>
              </button>
              <button
                disabled={formData.socialLinks?.some(l => l.platform === 'instagram')}
                onClick={() => setFormData({ 
                  ...formData, 
                  socialLinks: [...(formData.socialLinks || []), { platform: 'instagram', url: '' }] 
                })}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 border rounded-lg transition-all group",
                  settings?.theme === 'dark' 
                    ? "border-gray-800 hover:border-amber-500 hover:bg-amber-900/20" 
                    : "border-gray-200 hover:border-amber-500 hover:bg-amber-50",
                  formData.socialLinks?.some(l => l.platform === 'instagram') && "opacity-40 cursor-not-allowed filter grayscale"
                )}
              >
                <FaInstagram size={18} className="text-gray-400 group-hover:text-amber-600" />
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  settings?.theme === 'dark' ? "text-gray-500 group-hover:text-gray-300" : "text-gray-500 group-hover:text-gray-700"
                )}>Instagram</span>
              </button>
              <button
                disabled={formData.socialLinks?.some(l => l.platform === 'tiktok')}
                onClick={() => setFormData({ 
                  ...formData, 
                  socialLinks: [...(formData.socialLinks || []), { platform: 'tiktok', url: '' }] 
                })}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 border rounded-lg transition-all group",
                  settings?.theme === 'dark' 
                    ? "border-gray-800 hover:border-amber-500 hover:bg-amber-900/20" 
                    : "border-gray-200 hover:border-amber-500 hover:bg-amber-50",
                  formData.socialLinks?.some(l => l.platform === 'tiktok') && "opacity-40 cursor-not-allowed filter grayscale"
                )}
              >
                <Music2 size={18} className="text-gray-400 group-hover:text-amber-600" />
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  settings?.theme === 'dark' ? "text-gray-500 group-hover:text-gray-300" : "text-gray-500 group-hover:text-gray-700"
                )}>TikTok</span>
              </button>
              <button
                disabled={formData.socialLinks?.some(l => l.platform === 'youtube')}
                onClick={() => setFormData({ 
                  ...formData, 
                  socialLinks: [...(formData.socialLinks || []), { platform: 'youtube', url: '' }] 
                })}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 border rounded-lg transition-all group",
                  settings?.theme === 'dark' 
                    ? "border-gray-800 hover:border-amber-500 hover:bg-amber-900/20" 
                    : "border-gray-200 hover:border-amber-500 hover:bg-amber-50",
                  formData.socialLinks?.some(l => l.platform === 'youtube') && "opacity-40 cursor-not-allowed filter grayscale"
                )}
              >
                <Video size={18} className="text-gray-400 group-hover:text-amber-600" />
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  settings?.theme === 'dark' ? "text-gray-500 group-hover:text-gray-300" : "text-gray-500 group-hover:text-gray-700"
                )}>YouTube</span>
              </button>
              <button
                disabled={formData.socialLinks?.some(l => l.platform === 'tripadvisor')}
                onClick={() => setFormData({ 
                  ...formData, 
                  socialLinks: [...(formData.socialLinks || []), { platform: 'tripadvisor', url: '' }] 
                })}
                className={cn(
                  "flex flex-col items-center gap-1 p-2 border rounded-lg transition-all group",
                  settings?.theme === 'dark' 
                    ? "border-gray-800 hover:border-amber-500 hover:bg-amber-900/20" 
                    : "border-gray-200 hover:border-amber-500 hover:bg-amber-50",
                  formData.socialLinks?.some(l => l.platform === 'tripadvisor') && "opacity-40 cursor-not-allowed filter grayscale"
                )}
              >
                <img 
                  src="https://www.vectorlogo.zone/logos/tripadvisor/tripadvisor-icon.svg" 
                  alt="TripAdvisor" 
                  className="w-[18px] h-[18px] opacity-60 group-hover:opacity-100 transition-opacity grayscale group-hover:grayscale-0"
                  referrerPolicy="no-referrer"
                />
                <span className={cn(
                  "text-[10px] font-medium transition-colors",
                  settings?.theme === 'dark' ? "text-gray-500 group-hover:text-gray-300" : "text-gray-500 group-hover:text-gray-700"
                )}>TripAdvisor</span>
              </button>
            </div>

            {/* TripAdvisor Widget Section */}
            <div className={cn(
              "mt-8 pt-6 border-t transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <img 
                      src="https://www.vectorlogo.zone/logos/tripadvisor/tripadvisor-icon.svg" 
                      alt="TripAdvisor" 
                      className="w-4 h-4"
                      referrerPolicy="no-referrer"
                    />
                    {t('settings.tripadvisor_widget')}
                  </h3>
                  <p className="text-xs text-gray-500">{t('settings.tripadvisor_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.showTripadvisorWidget || false} 
                    onChange={(e) => setFormData({ ...formData, showTripadvisorWidget: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                  )}></div>
                </label>
              </div>
              
              <textarea
                value={formData.tripadvisorWidget || ''}
                onChange={(e) => setFormData({ ...formData, tripadvisorWidget: e.target.value })}
                rows={4}
                className={cn(
                  "w-full px-4 py-2 text-sm font-mono border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none placeholder:italic transition-colors duration-300",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200"
                )}
                placeholder="<div id='TA_selfserveprop...'></div> <script src='...'></script>"
              />
              <p className="text-[10px] text-gray-400 mt-2 italic">
                {t('settings.tripadvisor_note')}
              </p>
            </div>

            {/* Google Maps Widget Section */}
            <div className={cn(
              "mt-8 pt-6 border-t transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wider flex items-center gap-2 transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Map className="text-amber-600" size={16} />
                    {t('settings.google_maps_widget')}
                  </h3>
                  <p className="text-xs text-gray-500">{t('settings.google_maps_desc')}</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={formData.showGoogleMapsWidget || false} 
                    onChange={(e) => setFormData({ ...formData, showGoogleMapsWidget: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className={cn(
                    "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                    settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                  )}></div>
                </label>
              </div>
              
              <textarea
                value={formData.googleMapsWidget || ''}
                onChange={(e) => setFormData({ ...formData, googleMapsWidget: e.target.value })}
                rows={4}
                className={cn(
                  "w-full px-4 py-2 text-sm font-mono border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none resize-none placeholder:italic transition-colors duration-300",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200"
                )}
                placeholder="<iframe src='https://www.google.com/maps/embed?...'></iframe>"
              />
              <p className="text-[10px] text-gray-400 mt-2 italic">
                {t('settings.google_maps_note')}
              </p>
            </div>

            {/* Email Service Section */}
            <div className={cn(
              "mt-8 pt-6 border-t transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Mail className="text-amber-600" size={16} />
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wider transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {t('settings.resend_api')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowResend(!showResend)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      showResend ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:text-amber-600"
                    )}
                    title={showResend ? "Hide details" : "Show details"}
                  >
                    {showResend ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsResendLocked(!isResendLocked)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      isResendLocked ? "text-gray-400 hover:text-amber-600" : "text-amber-600 hover:bg-amber-100"
                    )}
                    title={isResendLocked ? "Unlock to edit" : "Lock settings"}
                  >
                    {isResendLocked ? <Lock size={14} /> : <Unlock size={14} className="text-amber-600 font-bold" />}
                  </button>
                </div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.resend_api_key')}</label>
                <input 
                  type={showResend ? "text" : "password"}
                  value={formData.resendApiKey || ''}
                  onChange={(e) => setFormData({ ...formData, resendApiKey: e.target.value })}
                  placeholder="re_123456789"
                  disabled={isResendLocked}
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                    isResendLocked && "opacity-60 cursor-not-allowed border-dashed"
                  )}
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">
                  {t('settings.resend_api_desc')}
                </p>
              </div>


              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.resend_from_email')}</label>
                <input 
                  type={showResend ? "text" : "password"}
                  value={formData.resendFromEmail || ''}
                  onChange={(e) => setFormData({ ...formData, resendFromEmail: e.target.value })}
                  placeholder="onboarding@resend.dev"
                  disabled={isResendLocked}
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                    settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                    isResendLocked && "opacity-60 cursor-not-allowed border-dashed"
                  )}
                />
                <p className="text-[10px] text-gray-500 mt-1 italic">
                  {t('settings.resend_from_email_desc')}
                </p>
              </div>

              {/* Test Email Section */}
              <div className={cn(
                "p-3 rounded-lg border flex flex-col gap-2 mt-2",
                settings?.theme === 'dark' ? "bg-gray-800/60 border-gray-700" : "bg-amber-50/50 border-amber-200"
              )}>
                <label className="block text-[10px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                  {language === 'pt' ? 'Testar Envio de Email Resend' : 'Test Resend Email Delivery'}
                </label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={testEmailRecipient}
                    onChange={(e) => setTestEmailRecipient(e.target.value)}
                    placeholder={formData.email || "exemplo@gmail.com"}
                    className={cn(
                      "flex-1 px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-2 focus:ring-amber-500",
                      settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300"
                    )}
                  />
                  <button
                    type="button"
                    disabled={isSendingTestEmail}
                    onClick={async () => {
                      const target = (testEmailRecipient || formData.email || '').trim();
                      if (!target) {
                        toast.error(language === 'pt' ? 'Indique um email de destino.' : 'Please enter a recipient email.');
                        return;
                      }
                      setIsSendingTestEmail(true);
                      setTestEmailResult(null);
                      try {
                        const res = await fetch('/api/email/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            email: target,
                            resendApiKey: formData.resendApiKey,
                            resendFromEmail: formData.resendFromEmail,
                            restaurantName: formData.name || settings?.name,
                            language,
                          })
                        });
                        const data = await res.json();
                        if (data.success) {
                          toast.success(language === 'pt' ? 'Email de teste enviado!' : 'Test email sent!');
                          setTestEmailResult({ success: true, message: language === 'pt' ? `Enviado com sucesso para ${target}` : `Sent successfully to ${target}` });
                        } else {
                          toast.error(data.error || 'Failed to send test email');
                          setTestEmailResult({ success: false, message: data.error || 'Failed' });
                        }
                      } catch (err: any) {
                        toast.error(err.message || 'Error sending test email');
                        setTestEmailResult({ success: false, message: err.message });
                      } finally {
                        setIsSendingTestEmail(false);
                      }
                    }}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold whitespace-nowrap transition-colors disabled:opacity-50"
                  >
                    {isSendingTestEmail ? (language === 'pt' ? 'A enviar...' : 'Sending...') : (language === 'pt' ? 'Enviar Teste' : 'Send Test')}
                  </button>
                </div>
                {testEmailResult && (
                  <p className={cn(
                    "text-[11px] font-medium mt-0.5",
                    testEmailResult.success ? "text-green-600 dark:text-green-400" : "text-red-500"
                  )}>
                    {testEmailResult.message}
                  </p>
                )}
              </div>
            </div>

            {/* Firebase Configuration Section */}
            <div className={cn(
              "mt-8 pt-6 border-t transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Database className="text-amber-600" size={16} />
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wider transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {t('settings.firebase_config')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowFirebase(!showFirebase)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      showFirebase ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:text-amber-600"
                    )}
                    title={showFirebase ? "Hide details" : "Show details"}
                  >
                    {showFirebase ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsFirebaseLocked(!isFirebaseLocked)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      isFirebaseLocked ? "text-gray-400 hover:text-amber-600" : "text-amber-600 hover:bg-amber-100"
                    )}
                    title={isFirebaseLocked ? "Unlock to edit" : "Lock settings"}
                  >
                    {isFirebaseLocked ? <Lock size={14} /> : <Unlock size={14} className="text-amber-600 font-bold" />}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_api_key')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseApiKey || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseApiKey: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_auth_domain')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseAuthDomain || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseAuthDomain: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_project_id')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseProjectId || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseProjectId: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_database_id')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseDatabaseId || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseDatabaseId: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_storage_bucket')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseStorageBucket || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseStorageBucket: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_messaging_sender_id')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseMessagingSenderId || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseMessagingSenderId: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_app_id')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseAppId || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseAppId: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.firebase_measurement_id')}</label>
                    <input 
                      type={showFirebase ? "text" : "password"}
                      value={formData.firebaseMeasurementId || ''}
                      onChange={(e) => setFormData({ ...formData, firebaseMeasurementId: e.target.value })}
                      disabled={isFirebaseLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isFirebaseLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 mt-2 italic">
                  {t('settings.firebase_desc')}
                </p>
              </div>
            </div>

            {/* Twilio Configuration Section */}
            <div className={cn(
              "mt-8 pt-6 border-t transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Phone className="text-amber-600" size={16} />
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wider transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {t('settings.twilio_config')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowTwilio(!showTwilio)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      showTwilio ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:text-amber-600"
                    )}
                    title={showTwilio ? "Hide details" : "Show details"}
                  >
                    {showTwilio ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsTwilioLocked(!isTwilioLocked)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      isTwilioLocked ? "text-gray-400 hover:text-amber-600" : "text-amber-600 hover:bg-amber-100"
                    )}
                    title={isTwilioLocked ? "Unlock to edit" : "Lock settings"}
                  >
                    {isTwilioLocked ? <Lock size={14} /> : <Unlock size={14} className="text-amber-600 font-bold" />}
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.twilio_account_sid')}</label>
                  <input 
                    type={showTwilio ? "text" : "password"}
                    value={formData.twilioAccountSid || ''}
                    onChange={(e) => setFormData({ ...formData, twilioAccountSid: e.target.value })}
                    disabled={isTwilioLocked}
                    className={cn(
                      "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                      isTwilioLocked && "opacity-60 cursor-not-allowed border-dashed"
                    )}
                    placeholder="AC..."
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.twilio_auth_token')}</label>
                    <input 
                      type={showTwilio ? "text" : "password"}
                      value={formData.twilioAuthToken || ''}
                      onChange={(e) => setFormData({ ...formData, twilioAuthToken: e.target.value })}
                      disabled={isTwilioLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isTwilioLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                      placeholder="••••••••••••••••••••••••••••••••"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.twilio_phone_number')}</label>
                    <input 
                      type={showTwilio ? "text" : "password"}
                      value={formData.twilioPhoneNumber || ''}
                      onChange={(e) => setFormData({ ...formData, twilioPhoneNumber: e.target.value })}
                      disabled={isTwilioLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isTwilioLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                      placeholder="+1234567890"
                    />
                  </div>
                </div>

                <p className="text-[10px] text-gray-500 mt-2 italic">
                  {t('settings.twilio_desc')}
                </p>
              </div>
            </div>

            {/* Cloudinary Configuration Section */}
            <div className={cn(
              "mt-8 pt-6 border-t transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Cloud size={16} className="text-amber-600" />
                  <h3 className={cn(
                    "text-sm font-bold uppercase tracking-wider transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {t('settings.cloudinary')}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    type="button"
                    onClick={() => setShowCloudinary(!showCloudinary)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      showCloudinary ? "text-amber-600 hover:bg-amber-100" : "text-gray-400 hover:text-amber-600"
                    )}
                    title={showCloudinary ? "Hide details" : "Show details"}
                  >
                    {showCloudinary ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setIsCloudinaryLocked(!isCloudinaryLocked)}
                    className={cn(
                      "p-1.5 rounded-lg transition-colors overflow-hidden",
                      isCloudinaryLocked ? "text-gray-400 hover:text-amber-600" : "text-amber-600 hover:bg-amber-100"
                    )}
                    title={isCloudinaryLocked ? "Unlock to edit" : "Lock settings"}
                  >
                    {isCloudinaryLocked ? <Lock size={14} /> : <Unlock size={14} className="text-amber-600 font-bold" />}
                  </button>
                  <label className="relative inline-flex items-center cursor-pointer scale-75">
                    <input 
                      type="checkbox" 
                      checked={formData.useCloudinary ?? false} 
                      onChange={(e) => setFormData({ ...formData, useCloudinary: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className={cn(
                      "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                      settings?.theme === 'dark' ? "bg-gray-800 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                    )}></div>
                  </label>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.cloudinary_cloud_name')}</label>
                    <input 
                      type={showCloudinary ? "text" : "password"}
                      value={formData.cloudinaryCloudName || ''}
                      onChange={(e) => setFormData({ ...formData, cloudinaryCloudName: e.target.value })}
                      placeholder="demo"
                      disabled={isCloudinaryLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isCloudinaryLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.cloudinary_api_key')}</label>
                    <input 
                      type={showCloudinary ? "text" : "password"}
                      value={formData.cloudinaryApiKey || ''}
                      onChange={(e) => setFormData({ ...formData, cloudinaryApiKey: e.target.value })}
                      placeholder="123456789012345"
                      disabled={isCloudinaryLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isCloudinaryLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.cloudinary_api_secret')}</label>
                    <input 
                      type={showCloudinary ? "text" : "password"}
                      value={formData.cloudinaryApiSecret || ''}
                      onChange={(e) => setFormData({ ...formData, cloudinaryApiSecret: e.target.value })}
                      placeholder="••••••••••••••••"
                      disabled={isCloudinaryLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isCloudinaryLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">{t('settings.cloudinary_upload_preset')}</label>
                    <input 
                      type={showCloudinary ? "text" : "password"}
                      value={formData.cloudinaryUploadPreset || ''}
                      onChange={(e) => setFormData({ ...formData, cloudinaryUploadPreset: e.target.value })}
                      placeholder="ml_default"
                      disabled={isCloudinaryLocked}
                      className={cn(
                        "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm transition-colors duration-300",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-300",
                        isCloudinaryLocked && "opacity-60 cursor-not-allowed border-dashed"
                      )}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Restaurant SEO Settings Section */}
        <RestaurantSEOSettings
          formData={formData}
          setFormData={setFormData}
          uploadingField={uploadingField}
          handleFileUpload={handleFileUpload}
          theme={settings?.theme}
        />

        {/* Promotion Popups */}
        <div className={cn(
          "p-6 rounded-xl shadow-sm border space-y-6 lg:col-span-3 transition-colors duration-300",
          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        )}>
          <div className={cn(
            "flex justify-between items-center border-b pb-3 transition-colors duration-300",
            settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
          )}>
            <h2 className={cn(
              "text-xl font-semibold flex items-center gap-2 transition-colors duration-300",
              settings?.theme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              <Bell className="text-amber-600" size={20} />
              {t('settings.message_popup')}
            </h2>
            <button
              onClick={handleAddPromotion}
              className={cn(
                "flex items-center gap-1 text-sm px-3 py-1 rounded-lg border transition-colors",
                settings?.theme === 'dark' 
                  ? "bg-amber-900/20 text-amber-400 border-amber-900/50 hover:bg-amber-900/40" 
                  : "bg-amber-50 text-amber-600 border-amber-100 hover:bg-amber-100"
              )}
            >
              <Plus size={16} />
              Add Message
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {(formData.promotionPopups || []).length === 0 && (
              <div className={cn(
                "col-span-full py-12 text-center rounded-2xl border-2 border-dashed transition-colors",
                settings?.theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-100"
              )}>
                <Bell className="mx-auto text-gray-300 mb-2" size={40} />
                <p className={cn(
                  "transition-colors",
                  settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>{t('common.no_messages')}</p>
                <button 
                  onClick={handleAddPromotion}
                  className="mt-4 text-amber-600 font-bold hover:underline"
                >
                  {t('common.create_first')}
                </button>
              </div>
            )}
            
            {(formData.promotionPopups || []).map((promo) => (
              <div key={promo.id} className={cn(
                "p-5 rounded-2xl border transition-all space-y-4 relative duration-300",
                promo.active 
                  ? (settings?.theme === 'dark' ? "bg-emerald-950/20 border-emerald-800/60 shadow-sm" : "bg-emerald-50/40 border-emerald-200 shadow-sm") 
                  : (settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-gray-400" : "bg-white border-gray-100")
              )}>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border",
                      promo.active 
                        ? (settings?.theme === 'dark' ? "bg-emerald-900/60 text-emerald-300 border-emerald-700" : "bg-emerald-100 text-emerald-800 border-emerald-200") 
                        : (settings?.theme === 'dark' ? "bg-gray-700 text-gray-500 border-transparent" : "bg-gray-100 text-gray-500 border-transparent")
                    )}>
                      {promo.active && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />}
                      {promo.active ? (language === 'pt' ? 'Ativo' : 'Active') : (language === 'pt' ? 'Rascunho' : 'Draft')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Calendar size={10} />
                      {promo.startDate && promo.endDate ? (
                        `${format(parseISO(promo.startDate), 'dd/MM/yyyy')} - ${format(parseISO(promo.endDate), 'dd/MM/yyyy')}`
                      ) : 'No dates set'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="relative inline-flex items-center cursor-pointer" title={language === 'pt' ? 'Ativar/Desativar Pop-up' : 'Enable/Disable Popup'}>
                      <input 
                        type="checkbox" 
                        checked={promo.active} 
                        onChange={(e) => handleUpdatePromotion(promo.id, { active: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className={cn(
                        "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600",
                        settings?.theme === 'dark' ? "bg-gray-700 peer-focus:ring-emerald-900" : "bg-gray-200 peer-focus:ring-emerald-300"
                      )}></div>
                    </label>
                    <button 
                      onClick={() => handleRemovePromotion(promo.id)}
                      className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={cn(
                        "block text-[10px] font-bold uppercase mb-1 transition-colors",
                        settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                      )}>{t('common.start_date')}</label>
                      <AppDatePicker value={promo.startDate} onChange={(val) => handleUpdatePromotion(promo.id, { startDate: val })} className={cn(
                          "w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-colors",
                          settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                        )}
                      />
                    </div>
                    <div>
                      <label className={cn(
                        "block text-[10px] font-bold uppercase mb-1 transition-colors",
                        settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                      )}>{t('common.end_date')}</label>
                      <AppDatePicker value={promo.endDate} onChange={(val) => handleUpdatePromotion(promo.id, { endDate: val })} className={cn(
                          "w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-colors",
                          settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                    )}>{t('settings.promo_title')} (EN)</label>
                    <input 
                      type="text"
                      value={promo.title}
                      onChange={(e) => handleUpdatePromotion(promo.id, { title: e.target.value })}
                      placeholder="Special Promotion"
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-amber-500 transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                    )}>{t('settings.promo_title')} (PT)</label>
                    <input 
                      type="text"
                      value={promo.titlePt || ''}
                      onChange={(e) => handleUpdatePromotion(promo.id, { titlePt: e.target.value })}
                      placeholder="Promoção Especial"
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-amber-500 transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                    )}>{t('settings.promo_subtitle')} (EN)</label>
                    <input 
                      type="text"
                      value={promo.subtitle}
                      onChange={(e) => handleUpdatePromotion(promo.id, { subtitle: e.target.value })}
                      placeholder="Don't miss out!"
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-amber-500 transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                    )}>{t('settings.promo_subtitle')} (PT)</label>
                    <input 
                      type="text"
                      value={promo.subtitlePt || ''}
                      onChange={(e) => handleUpdatePromotion(promo.id, { subtitlePt: e.target.value })}
                      placeholder="Não perca!"
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-amber-500 transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                    )}>{t('common.image_url')}</label>
                    <input 
                      type="text"
                      value={promo.imageUrl}
                      onChange={(e) => handleUpdatePromotion(promo.id, { imageUrl: e.target.value })}
                      placeholder="https://..."
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-xs outline-none focus:ring-1 focus:ring-amber-500 transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                      )}
                    />
                    <p className="mt-1 text-[9px] text-gray-500 italic">
                      Use images 650px by 240px for better results
                    </p>
                  </div>

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                    )}>{t('settings.promo_message')} (EN)</label>
                    <textarea 
                      value={promo.message}
                      onChange={(e) => handleUpdatePromotion(promo.id, { message: e.target.value })}
                      rows={3}
                      placeholder="Promo message..."
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-amber-500 resize-none transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                      )}
                    />
                  </div>

                  <div>
                    <label className={cn(
                      "block text-[10px] font-bold uppercase mb-1 transition-colors",
                      settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
                    )}>{t('settings.promo_message')} (PT)</label>
                    <textarea 
                      value={promo.messagePt || ''}
                      onChange={(e) => handleUpdatePromotion(promo.id, { messagePt: e.target.value })}
                      rows={3}
                      placeholder="Mensagem promocional..."
                      className={cn(
                        "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-1 focus:ring-amber-500 resize-none transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-200"
                      )}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Opening Hours */}
        <div className={cn(
          "p-6 rounded-xl shadow-sm border space-y-6 lg:col-span-3 transition-colors duration-300",
          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        )}>
          <h2 className={cn(
            "text-xl font-semibold flex items-center gap-2 border-b pb-3 transition-colors duration-300",
            settings?.theme === 'dark' ? "border-gray-800 text-white" : "border-gray-100 text-gray-900"
          )}>
            <Clock className={cn("transition-colors", settings?.theme === 'dark' ? "text-gray-400" : "text-amber-600")} size={20} />
            {t('common.opening_hours')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            {formData.openingHours && DAYS_OF_WEEK.map((day) => {
              const hours = formData.openingHours[day] || { 
                open: '09:00', 
                close: '22:00', 
                closed: false,
                lunch: { open: '12:00', close: '15:00', active: false },
                dinner: { open: '19:00', close: '23:00', active: false }
              };
              return (
                <div key={day} className={cn(
                  "p-4 rounded-xl border transition-all duration-300",
                  hours.closed 
                    ? (settings?.theme === 'dark' ? "bg-gray-800 border-gray-800" : "bg-gray-50 border-gray-100") 
                    : (settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 shadow-sm" : "bg-white border-gray-200 shadow-sm")
                )}>
                  <div className={cn(
                    "flex justify-between items-center mb-4 border-b pb-2 transition-colors duration-300",
                    settings?.theme === 'dark' ? "border-gray-700" : "border-gray-50"
                  )}>
                    <span className={cn(
                      "font-bold transition-colors duration-300",
                      settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                    )}>{t(`days.${day.toLowerCase()}`)}</span>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={!hours.closed} 
                        onChange={(e) => handleHoursChange(day, 'closed', !e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                  </div>
                  
                  {!hours.closed ? (
                    <div className="space-y-4">
                      {/* General Hours Title Only */}
                      <div className="space-y-2">
                        <div className={cn(
                          "text-[10px] font-bold uppercase tracking-wider border-b pb-1 transition-colors",
                          settings?.theme === 'dark' ? "text-gray-500 border-gray-700" : "text-gray-400 border-gray-50"
                        )}>{t('common.general_hours')}</div>
                      </div>

                      {/* Lunch Session */}
                      <div className={cn(
                        "space-y-2 pt-2 border-t transition-colors",
                        settings?.theme === 'dark' ? "border-gray-700" : "border-gray-50"
                      )}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "text-[10px] font-bold uppercase tracking-wider transition-colors",
                              settings?.theme === 'dark' ? "text-amber-500" : "text-amber-600"
                            )}>{t('common.lunch')}</div>
                              <button
                                type="button"
                                onClick={() => handleHoursChange(day, 'lunch', !hours.lunch?.fullHouse, 'fullHouse')}
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-black transition-colors uppercase",
                                  hours.lunch?.fullHouse
                                    ? "bg-red-600 text-white border-red-600"
                                    : "text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500"
                                )}
                              >
                                {hours.lunch?.fullHouse ? t('res.lunch_full').replace('ALMOÇO ', '').replace('LUNCH ', '') : t('res.lunch_open').replace('ALMOÇO ', '').replace('LUNCH ', '')}
                              </button>
                          </div>
                          <input 
                            type="checkbox"
                            checked={hours.lunch?.active || false}
                            onChange={(e) => handleHoursChange(day, 'lunch', e.target.checked, 'active')}
                            className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
                          />
                        </div>
                        {hours.lunch?.active && (
                          <div className="grid grid-cols-2 gap-2">
                        <div className={cn(
                          "flex flex-col p-2.5 rounded-xl border transition-colors",
                          settings?.theme === 'dark' ? "bg-amber-950/20 border-amber-900/30" : "bg-amber-50/50 border-amber-100/50"
                        )}>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                            settings?.theme === 'dark' ? "text-amber-400" : "text-amber-600"
                          )}>
                            <Clock size={11} className={cn("-mt-0.5", settings?.theme === 'dark' && "text-gray-400")} />
                            {t('common.open')}
                          </span>
                          <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                            ampm={formData?.timeFormat === '12h'}
                            format={formData?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                            value={dayjs(hours.lunch.open, 'HH:mm')}
                            onChange={(newValue) => {
                              if (newValue) handleHoursChange(day, 'lunch', newValue.format('HH:mm'), 'open');
                            }}
                            slotProps={{
                              textField: {
                                variant: 'standard',
                                sx: { 
                                  '& .MuiInputBase-input': { 
                                    fontSize: '0.9rem',
                                    fontWeight: 800,
                                    padding: 0,
                                    color: settings?.theme === 'dark' ? '#d1d5db' : '#78350f',
                                    width: '160px'
                                  },
                                  '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                                }
                              }
                            }}
                          />
                        </div>
                        <div className={cn(
                          "flex flex-col p-2.5 rounded-xl border transition-colors",
                          settings?.theme === 'dark' ? "bg-amber-950/20 border-amber-900/30" : "bg-amber-50/50 border-amber-100/50"
                        )}>
                          <span className={cn(
                            "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                            settings?.theme === 'dark' ? "text-amber-400" : "text-amber-600"
                          )}>
                            <Clock size={11} className={cn("-mt-1", settings?.theme === 'dark' && "text-gray-400")} />
                            {t('common.close')}
                          </span>
                          <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                            ampm={formData?.timeFormat === '12h'}
                            format={formData?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                            value={dayjs(hours.lunch.close, 'HH:mm')}
                            onChange={(newValue) => {
                              if (newValue) handleHoursChange(day, 'lunch', newValue.format('HH:mm'), 'close');
                            }}
                            slotProps={{
                              textField: {
                                variant: 'standard',
                                sx: { 
                                  '& .MuiInputBase-input': { 
                                    fontSize: '0.9rem',
                                    fontWeight: 800,
                                    padding: 0,
                                    color: settings?.theme === 'dark' ? '#d1d5db' : '#78350f',
                                    width: '160px'
                                  },
                                  '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                                }
                              }
                            }}
                          />
                        </div>
                          </div>
                        )}
                      </div>

                      {/* Dinner Session */}
                      <div className={cn(
                        "space-y-2 pt-2 border-t transition-colors",
                        settings?.theme === 'dark' ? "border-gray-700" : "border-gray-50"
                      )}>
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <div className={cn(
                              "text-[10px] font-bold uppercase tracking-wider transition-colors",
                              settings?.theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
                            )}>{t('common.dinner')}</div>
                              <button
                                type="button"
                                onClick={() => handleHoursChange(day, 'dinner', !hours.dinner?.fullHouse, 'fullHouse')}
                                className={cn(
                                  "text-[9px] px-1.5 py-0.5 rounded font-black transition-colors uppercase",
                                  hours.dinner?.fullHouse
                                    ? "bg-red-600 text-white border-red-600"
                                    : "text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500"
                                )}
                              >
                                {hours.dinner?.fullHouse ? t('res.dinner_full').replace('JANTAR ', '').replace('DINNER ', '') : t('res.dinner_open').replace('JANTAR ', '').replace('DINNER ', '')}
                              </button>
                          </div>
                          <input 
                            type="checkbox"
                            checked={hours.dinner?.active || false}
                            onChange={(e) => handleHoursChange(day, 'dinner', e.target.checked, 'active')}
                            className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
                          />
                        </div>
                        {hours.dinner?.active && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className={cn(
                              "flex flex-col p-2.5 rounded-xl border transition-colors",
                              settings?.theme === 'dark' ? "bg-indigo-950/20 border-indigo-900/30" : "bg-indigo-50/50 border-indigo-100/50"
                            )}>
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                                settings?.theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
                              )}>
                                <Clock size={11} className={cn("-mt-0.5", settings?.theme === 'dark' && "text-gray-400")} />
                                {t('common.open')}
                              </span>
                              <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                ampm={formData?.timeFormat === '12h'}
                                format={formData?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                                value={dayjs(hours.dinner.open, 'HH:mm')}
                                onChange={(newValue) => {
                                  if (newValue) handleHoursChange(day, 'dinner', newValue.format('HH:mm'), 'open');
                                }}
                                slotProps={{
                                  textField: {
                                    variant: 'standard',
                                    sx: { 
                                      '& .MuiInputBase-input': { 
                                        fontSize: '0.9rem',
                                        fontWeight: 800,
                                        padding: 0,
                                        color: settings?.theme === 'dark' ? '#d1d5db' : '#312e81',
                                        width: '160px'
                                      },
                                      '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                                    }
                                  }
                                }}
                              />
                            </div>
                            <div className={cn(
                              "flex flex-col p-2.5 rounded-xl border transition-colors",
                              settings?.theme === 'dark' ? "bg-indigo-950/20 border-indigo-900/30" : "bg-indigo-50/50 border-indigo-100/50"
                            )}>
                              <span className={cn(
                                "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                                settings?.theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
                              )}>
                                <Clock size={11} className={cn("-mt-1", settings?.theme === 'dark' && "text-gray-400")} />
                                {t('common.close')}
                              </span>
                              <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                                ampm={formData?.timeFormat === '12h'}
                                format={formData?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                                value={dayjs(hours.dinner.close, 'HH:mm')}
                                onChange={(newValue) => {
                                  if (newValue) handleHoursChange(day, 'dinner', newValue.format('HH:mm'), 'close');
                                }}
                                slotProps={{
                                  textField: {
                                    variant: 'standard',
                                    sx: { 
                                      '& .MuiInputBase-input': { 
                                        fontSize: '0.9rem',
                                        fontWeight: 800,
                                        padding: 0,
                                        color: settings?.theme === 'dark' ? '#d1d5db' : '#312e81',
                                        width: '160px'
                                      },
                                      '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center text-gray-400 text-sm font-medium italic bg-gray-50 rounded-lg">
                      {t('common.closed')}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Time Rules & Gaps */}
            <div className={cn(
              "p-4 rounded-xl border shadow-sm flex flex-col justify-center transition-colors",
              settings?.theme === 'dark' ? "bg-amber-950/10 border-amber-900/50" : "bg-amber-50 border-amber-200"
            )}>
              <div className={cn(
                "flex items-center gap-2 mb-3 border-b pb-2 transition-colors",
                settings?.theme === 'dark' ? "border-amber-900/50" : "border-amber-100"
              )}>
                <Clock className={cn("transition-colors", settings?.theme === 'dark' ? "text-gray-400" : "text-amber-600")} size={18} />
                <span className={cn(
                  "font-bold transition-colors",
                  settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                )}>{language === 'pt' ? 'Regras de Tempo' : 'Time Rules'}</span>
              </div>

              <div className="space-y-2">
                <p className={cn(
                  "text-[10px] font-medium uppercase tracking-wider transition-colors",
                  settings?.theme === 'dark' ? "text-amber-400" : "text-amber-700"
                )}>{language === 'pt' ? 'Tempo antes do fecho para última reserva online (minutos)' : 'Time before close for last online reservation (minutes)'}</p>
                <input 
                  type="number" 
                  min="0"
                  step="5"
                  value={formData.lastOnlineReservationMinutes !== undefined ? formData.lastOnlineReservationMinutes : 30}
                  onChange={(e) => setFormData({ ...formData, lastOnlineReservationMinutes: parseInt(e.target.value) || 0 })}
                  className={cn(
                    "w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-amber-500 outline-none text-sm font-semibold transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-900 border-amber-900/50 text-amber-100" : "bg-white border-amber-200 text-amber-900"
                  )}
                />
                <p className={cn(
                  "text-[10px] italic transition-colors",
                  settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-600"
                )}>{language === 'pt' ? 'Ex: 30 minutos significa que a última reserva será 30 min antes do fecho do turno.' : 'E.g., 30 minutes means the last reservation will be 30 min before the shift closes.'}</p>
              </div>

              <div className={cn(
                "space-y-2 mt-4 pt-4 border-t transition-colors",
                settings?.theme === 'dark' ? "border-amber-900/50" : "border-amber-100"
              )}>
                <p className={cn(
                  "text-[10px] font-bold uppercase tracking-wider transition-colors",
                  settings?.theme === 'dark' ? "text-amber-400" : "text-amber-700"
                )}>{t('settings.min_gap')}</p>
                <CustomDropdown 
                  value={(formData.minReservationGap || 135).toString()}
                  onChange={(val) => setFormData({ ...formData, minReservationGap: parseInt(val) })}
                  options={[
                    { value: '60', label: '60 min (1h)' },
                    { value: '90', label: '90 min (1h 30m)' },
                    { value: '105', label: '105 min (1h 45m)' },
                    { value: '120', label: '120 min (2h)' },
                    { value: '135', label: '135 min (2h 15m)' },
                    { value: '150', label: '150 min (2h 30m)' }
                  ]}
                  isDark={settings?.theme === 'dark'}
                />
                <p className={cn(
                  "text-[10px] italic transition-colors",
                  settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-600"
                )}>{t('settings.min_gap_desc')}</p>
              </div>

              <div className={cn(
                "space-y-2 mt-4 pt-4 border-t transition-colors",
                settings?.theme === 'dark' ? "border-amber-900/50" : "border-amber-100"
              )}>
                <p className={cn(
                  "text-[10px] font-bold uppercase tracking-wider transition-colors",
                  settings?.theme === 'dark' ? "text-amber-400" : "text-amber-700"
                )}>{language === 'pt' ? 'Intervalo de Tempo no Cronograma' : 'Cronograma Time Range'}</p>
                <CustomDropdown 
                  value={formData.cronogramaTimeRange || 'service'}
                  onChange={(val) => setFormData({ ...formData, cronogramaTimeRange: val as 'service' | '24h' })}
                  options={[
                    { value: 'service', label: language === 'pt' ? 'Apenas Serviço' : 'Service Only' },
                    { value: '24h', label: '24 Horas' }
                  ]}
                  isDark={settings?.theme === 'dark'}
                />
                
                {formData.cronogramaTimeRange === '24h' && (
                  <div className="mt-3">
                    <p className={cn(
                      "text-[10px] font-bold uppercase tracking-wider transition-colors mb-1",
                      settings?.theme === 'dark' ? "text-amber-400" : "text-amber-700"
                    )}>{language === 'pt' ? 'Hora de Início (24h)' : 'Start Time (24h)'}</p>
                    <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                      value={dayjs(formData.cronogramaStartTime || '00:00', 'HH:mm')}
                      onChange={(newValue) => {
                        if (newValue) {
                          setFormData({ ...formData, cronogramaStartTime: newValue.format('HH:mm') });
                        }
                      }}
                      ampm={formData?.timeFormat === '12h'}
                      format={formData?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                      slotProps={{
                        textField: {
                          variant: 'standard',
                          sx: { 
                            '& .MuiInputBase-input': { 
                              fontSize: '0.9rem',
                              fontWeight: 800,
                              padding: '8px 0',
                              color: settings?.theme === 'dark' ? '#d1d5db' : '#78350f',
                            },
                            '&::before': { display: 'none' },
                            '&::after': { display: 'none' }
                          }
                        }
                      }}
                    />
                  </div>
                )}
                
                <p className={cn(
                  "text-[10px] italic transition-colors mt-2",
                  settings?.theme === 'dark' ? "text-amber-500/80" : "text-amber-600"
                )}>{language === 'pt' ? 'Define o intervalo de tempo mostrado por padrão no Cronograma.' : 'Sets the default time range shown on the Cronograma.'}</p>
              </div>

            </div>
          </div>
        </div>

        {/* Special Opening Hours (Date-Range Overrides) */}
        {(() => {
          const scheduleConflicts = findSpecialScheduleConflicts(formData?.specialSchedules || []);
          return (
            <div className={cn(
              "p-6 rounded-xl shadow-sm border space-y-6 lg:col-span-3 transition-colors duration-300",
              settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
            )}>
              <div className="flex flex-col gap-4 border-b pb-4 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                  <h2 className={cn(
                    "text-xl font-semibold flex items-center gap-2 transition-colors duration-300",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    <Clock className="text-amber-600" size={22} />
                    {language === 'pt' ? 'Horários Especiais & Períodos de Funcionamento' : 'Special Opening Hours & Date Ranges'}
                  </h2>
                  <p className={cn("text-xs transition-colors w-full md:w-[40%]", settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
                    {language === 'pt'
                      ? 'Sobreponha temporariamente o horário semanal padrão para um intervalo de datas (ex: terças de verão, festividades). Ao terminar a data de fim, o sistema regressa automaticamente ao horário semanal normal.'
                      : 'Temporarily override regular weekly schedules for a specific date range (e.g. Summer Tuesdays, Holidays). Returns automatically to normal weekly hours when ended.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleOpenAddSpecialSchedule}
                  className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2.5 rounded-xl transition-colors shadow-sm text-sm self-start"
                >
                  <Plus size={18} />
                  {language === 'pt' ? 'Adicionar Horário Especial' : 'Add Special Opening Hours'}
                </button>
              </div>

              {/* Conflict warning banner */}
              {scheduleConflicts.length > 0 && (
                <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-sm space-y-2">
                  <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                    <Clock size={18} />
                    <span>{language === 'pt' ? 'Aviso de Conflito de Horários' : 'Schedule Conflict Warning'}</span>
                  </div>
                  <p className="text-xs">
                    {language === 'pt'
                      ? 'Existem horários especiais com datas e dias da semana sobrepostos:'
                      : 'Overlapping special schedules detected:'}
                  </p>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {scheduleConflicts.map((c, idx) => (
                      <li key={idx}>
                        <strong>{c.s1.name}</strong> & <strong>{c.s2.name}</strong> — {language === 'pt' ? 'Dias' : 'Days'}: {c.overlappingDays.map(d => getDayLabel(d, language)).join(', ')}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* List of Special Schedules */}
              {(!formData?.specialSchedules || formData.specialSchedules.length === 0) ? (
                <div className={cn(
                  "p-8 text-center rounded-xl border border-dashed transition-colors",
                  settings?.theme === 'dark' ? "border-gray-800 text-gray-400 bg-gray-900/50" : "border-gray-200 text-gray-500 bg-gray-50/50"
                )}>
                  <Calendar className="mx-auto mb-2 opacity-40 text-amber-500" size={32} />
                  <p className="text-sm font-medium">
                    {language === 'pt' ? 'Nenhum horário especial configurado.' : 'No special opening hours configured.'}
                  </p>
                  <p className="text-xs opacity-75 mt-1">
                    {language === 'pt'
                      ? 'Clique em "+ Adicionar Horário Especial" para criar um horário temporário.'
                      : 'Click "+ Add Special Opening Hours" to create a temporary schedule override.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {formData.specialSchedules.map((schedule) => {
                    const todayStr = format(new Date(), 'yyyy-MM-dd');
                    const isWithinDates = todayStr >= schedule.startDate && todayStr <= schedule.endDate;
                    const isScheduleActive = schedule.active ?? true;
                    const isActive = isWithinDates && isScheduleActive;
                    const isUpcoming = todayStr < schedule.startDate && isScheduleActive;
                    const isExpired = todayStr > schedule.endDate && isScheduleActive;
                    const isInactive = !isScheduleActive;

                    const formatRangeDate = (dStr: string) => {
                      try {
                        if (!dStr) return '';
                        const d = parseISO(dStr);
                        if (!isNaN(d.getTime())) return format(d, 'dd/MM/yyyy');
                        return dStr;
                      } catch {
                        return dStr || '';
                      }
                    };

                    return (
                      <div
                        key={schedule.id}
                        className={cn(
                          "p-5 rounded-xl border flex flex-col justify-between transition-all duration-200 shadow-sm relative overflow-hidden",
                          isInactive && (settings?.theme === 'dark' ? "bg-gray-800/40 border-gray-700/60 opacity-60" : "bg-gray-100/70 border-gray-300/80 opacity-60"),
                          !isInactive && (
                            isActive 
                              ? (settings?.theme === 'dark' ? "bg-emerald-950/20 border-emerald-800/60" : "bg-emerald-50/40 border-emerald-200")
                              : isUpcoming
                                ? (settings?.theme === 'dark' ? "bg-amber-950/20 border-amber-800/50" : "bg-amber-50/40 border-amber-200")
                                : (settings?.theme === 'dark' ? "bg-gray-800/80 border-gray-700" : "bg-gray-50/70 border-gray-200")
                          )
                        )}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div>
                              <h3 className={cn("font-bold text-base", settings?.theme === 'dark' ? "text-white" : "text-gray-900")}>
                                {schedule.name}
                              </h3>
                              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold mt-1">
                                <Calendar size={14} />
                                <span>
                                  {formatRangeDate(schedule.startDate)} — {formatRangeDate(schedule.endDate)}
                                </span>
                              </div>
                            </div>

                            {/* Status Badge & Toggle */}
                            <div className="flex items-center gap-3">
                              {/* Toggle */}
                              <label className="relative inline-flex items-center cursor-pointer" title={language === 'pt' ? 'Ativar/Desativar Horário Especial' : 'Enable/Disable Special Schedule'}>
                                <input 
                                  type="checkbox" 
                                  checked={schedule.active ?? true} 
                                  onChange={(e) => {
                                    const isChecked = e.target.checked;
                                    const updatedSchedules = formData.specialSchedules?.map(s => 
                                      s.id === schedule.id ? { ...s, active: isChecked } : s
                                    ) || [];
                                    setFormData({ ...formData, specialSchedules: updatedSchedules });
                                  }}
                                  className="sr-only peer"
                                />
                                <div className={cn(
                                  "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                                  settings?.theme === 'dark' ? "bg-gray-700 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                                )}></div>
                              </label>
                              {isActive && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700 shrink-0">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                  {language === 'pt' ? 'Ativo' : 'Active'}
                                </span>
                              )}
                              {isUpcoming && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 border border-amber-200 dark:border-amber-700 shrink-0">
                                  {language === 'pt' ? 'Agendado' : 'Upcoming'}
                                </span>
                              )}
                              {isExpired && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 shrink-0">
                                  {language === 'pt' ? 'Expirado' : 'Expired'}
                                </span>
                              )}
                              {isInactive && (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400 border border-gray-300 dark:border-gray-700 shrink-0">
                                  {language === 'pt' ? 'Inativo' : 'Inactive'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Days of week tags */}
                          <div className="flex flex-wrap gap-2 mb-3">
                            {(schedule.days || []).map((day) => (
                              <span
                                key={day}
                                className={cn(
                                  "text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider bg-amber-600 text-white shadow-sm"
                                )}
                              >
                                {getDayLabel(day, language)}
                              </span>
                            ))}
                          </div>

                          {/* Hours / Service summary */}
                          {schedule.closed ? (
                            <div className="p-2.5 rounded-lg bg-red-100/60 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-2">
                              <X size={14} />
                              <span>{language === 'pt' ? 'Encerrado (Fechado nestes dias)' : 'Closed (Off on these days)'}</span>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div className={cn("p-2 rounded-lg border", settings?.theme === 'dark' ? "bg-gray-900/50 border-gray-700/60" : "bg-white border-gray-100")}>
                                <span className="font-bold text-[10px] uppercase text-amber-600 dark:text-amber-400 block mb-0.5">
                                  {language === 'pt' ? 'Almoço' : 'Lunch'}
                                </span>
                                {schedule.lunch?.active ? (
                                  <span className="font-semibold">{schedule.lunch.open} - {schedule.lunch.close}</span>
                                ) : (
                                  <span className="text-gray-400 italic">{language === 'pt' ? 'Fechado' : 'Closed'}</span>
                                )}
                              </div>
                              <div className={cn("p-2 rounded-lg border", settings?.theme === 'dark' ? "bg-gray-900/50 border-gray-700/60" : "bg-white border-gray-100")}>
                                <span className="font-bold text-[10px] uppercase text-amber-600 dark:text-amber-400 block mb-0.5">
                                  {language === 'pt' ? 'Jantar' : 'Dinner'}
                                </span>
                                {schedule.dinner?.active ? (
                                  <span className="font-semibold">{schedule.dinner.open} - {schedule.dinner.close}</span>
                                ) : (
                                  <span className="text-gray-400 italic">{language === 'pt' ? 'Fechado' : 'Closed'}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {schedule.note && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 italic mt-2">
                              "{schedule.note}"
                            </p>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-gray-200 dark:border-gray-700/60">
                          <button
                            type="button"
                            onClick={() => handleOpenEditSpecialSchedule(schedule)}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-amber-700 hover:bg-amber-100 dark:text-amber-400 dark:hover:bg-amber-950/50 transition-colors"
                          >
                            <Edit size={14} />
                            {language === 'pt' ? 'Editar' : 'Edit'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteSpecialSchedule(schedule.id)}
                            className="flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-lg text-red-600 hover:bg-red-100 dark:text-red-400 dark:hover:bg-red-950/50 transition-colors"
                          >
                            <Trash2 size={14} />
                            {language === 'pt' ? 'Eliminar' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* Special Days */}
        <div className={cn(
          "p-6 rounded-xl shadow-sm border space-y-6 lg:col-span-3 transition-colors duration-300",
          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        )}>
          <h2 className={cn(
            "text-xl font-semibold flex items-center gap-2 border-b pb-3 transition-colors duration-300",
            settings?.theme === 'dark' ? "border-gray-800 text-white" : "border-gray-100 text-gray-900"
          )}>
            <Calendar className="text-amber-600" size={20} />
            {t('settings.special_days')}
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {/* Regular Special Days */}
            {Object.entries(formData.specialDays || {}).map(([date, config]: [string, any]) => (
              <SpecialDayCard formData={formData} 
                key={date} 
                date={date} 
                config={config} 
                isRecurring={false}
                settings={settings}
                onDelete={() => {
                  const newSpecial = { ...(formData.specialDays || {}) };
                  delete newSpecial[date];
                  setFormData({ ...formData, specialDays: newSpecial });
                }}
                onUpdate={(newConfig) => {
                  setFormData({
                    ...formData,
                    specialDays: { ...(formData.specialDays || {}), [date]: newConfig }
                  });
                }}
                onMove={(oldDate, oldRecurring, newDate, newRecurring) => {
                  const newFormData = { ...formData };
                  const config = oldRecurring 
                    ? { ...(newFormData.recurringSpecialDays || {}) }[oldDate]
                    : { ...(newFormData.specialDays || {}) }[oldDate];
                  
                  if (!config) return;

                  // Remove from old
                  if (oldRecurring) {
                    const newRecurringDays = { ...(newFormData.recurringSpecialDays || {}) };
                    delete newRecurringDays[oldDate];
                    newFormData.recurringSpecialDays = newRecurringDays;
                  } else {
                    const newDays = { ...(newFormData.specialDays || {}) };
                    delete newDays[oldDate];
                    newFormData.specialDays = newDays;
                  }

                  // Add to new
                  if (newRecurring) {
                    newFormData.recurringSpecialDays = { 
                      ...(newFormData.recurringSpecialDays || {}), 
                      [newDate]: config 
                    };
                  } else {
                    newFormData.specialDays = { 
                      ...(newFormData.specialDays || {}), 
                      [newDate]: config 
                    };
                  }
                  setFormData(newFormData);
                }}
              />
            ))}

            {/* Recurring Special Days */}
            {Object.entries(formData.recurringSpecialDays || {}).map(([date, config]: [string, any]) => (
              <SpecialDayCard formData={formData} 
                key={date} 
                date={date} 
                config={config} 
                isRecurring={true}
                settings={settings}
                onDelete={() => {
                  const newSpecial = { ...(formData.recurringSpecialDays || {}) };
                  delete newSpecial[date];
                  setFormData({ ...formData, recurringSpecialDays: newSpecial });
                }}
                onUpdate={(newConfig) => {
                  setFormData({
                    ...formData,
                    recurringSpecialDays: { ...(formData.recurringSpecialDays || {}), [date]: newConfig }
                  });
                }}
                onMove={(oldDate, oldRecurring, newDate, newRecurring) => {
                  const newFormData = { ...formData };
                  const config = oldRecurring 
                    ? { ...(newFormData.recurringSpecialDays || {}) }[oldDate]
                    : { ...(newFormData.specialDays || {}) }[oldDate];
                  
                  if (!config) return;

                  // Remove from old
                  if (oldRecurring) {
                    const newRecurringDays = { ...(newFormData.recurringSpecialDays || {}) };
                    delete newRecurringDays[oldDate];
                    newFormData.recurringSpecialDays = newRecurringDays;
                  } else {
                    const newDays = { ...(newFormData.specialDays || {}) };
                    delete newDays[oldDate];
                    newFormData.specialDays = newDays;
                  }

                  // Add to new
                  if (newRecurring) {
                    newFormData.recurringSpecialDays = { 
                      ...(newFormData.recurringSpecialDays || {}), 
                      [newDate]: config 
                    };
                  } else {
                    newFormData.specialDays = { 
                      ...(newFormData.specialDays || {}), 
                      [newDate]: config 
                    };
                  }
                  setFormData(newFormData);
                }}
              />
            ))}

            <div className={cn(
              "p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 min-h-[160px] transition-colors",
              settings?.theme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200"
            )}>
              <div className="flex flex-col gap-2 w-full">
                <AppDatePicker id="new-special-day" value={newSpecialDay} onChange={(val)=>setNewSpecialDay(val)} className={cn(
                    "w-full px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300"
                  )}
                />
                <label className={cn(
                  "flex items-center gap-2 text-xs cursor-pointer transition-colors",
                  settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                )}>
                  <input type="checkbox" id="special-is-recurring" className="rounded text-amber-600 focus:ring-amber-500" />
                  {t('settings.recurring_yearly')}
                </label>
              </div>
              <button 
                onClick={() => {
                  const isRecurring = (document.getElementById('special-is-recurring') as HTMLInputElement).checked;
                  if (newSpecialDay) {
                    let val = newSpecialDay;
                    let dateKey = val;
                    if (isRecurring) {
                      dateKey = val.substring(5); // MM-DD
                    }
                    
                    const newConfig = { 
                      active: true, 
                      closed: false, 
                      reservationInterval: 15,
                      lunch: { active: false, open: '12:00', close: '15:00' },
                      dinner: { active: true, open: '19:00', close: '23:00' }
                    };
                    
                    if (isRecurring) {
                      setFormData({
                        ...formData,
                        recurringSpecialDays: {
                          ...(formData.recurringSpecialDays || {}),
                          [dateKey]: newConfig
                        }
                      });
                    } else {
                      setFormData({
                        ...formData,
                        specialDays: {
                          ...(formData.specialDays || {}),
                          [dateKey]: newConfig
                        }
                      });
                    }
                    setNewSpecialDay('');
                    (document.getElementById('special-is-recurring') as HTMLInputElement).checked = false;
                  }
                }}
                className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white font-bold shadow-sm px-4 py-2.5 rounded-xl hover:bg-amber-700 transition-colors"
              >
                <Plus size={18} />
                {t('settings.add_special')}
              </button>
            </div>
          </div>
        </div>

        {/* Closed Days */}
        <div className={cn(
          "p-6 rounded-xl shadow-sm border space-y-6 md:col-span-2 transition-colors duration-300",
          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
        )}>
          <h2 className={cn(
            "text-xl font-semibold flex items-center gap-2 border-b pb-3 transition-colors duration-300",
            settings?.theme === 'dark' ? "border-gray-800 text-white" : "border-gray-100 text-gray-900"
          )}>
            <Trash2 className="text-red-600" size={20} />
            {t('settings.specific_closed')}
          </h2>
          
          <div className="space-y-6">
            <div className="flex flex-wrap gap-3">
              {/* Regular Closed Days */}
              {(formData.closedDays || []).map((date, index) => (
                <div key={index} className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
                  settings?.theme === 'dark' ? "bg-red-950/30 text-red-400 border-red-900/50" : "bg-red-50 text-red-700 border-red-100"
                )}>
                  <span className="text-sm font-medium">{format(parseISO(date), 'dd/MM/yyyy')}</span>
                  <button 
                    onClick={() => {
                      const newDays = [...(formData.closedDays || [])];
                      newDays.splice(index, 1);
                      setFormData({ ...formData, closedDays: newDays });
                    }}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              {/* Recurring Closed Days */}
              {(formData.recurringClosedDays || []).map((dayMonth, index) => (
                <div key={`rec-${index}`} className={cn(
                  "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
                  settings?.theme === 'dark' ? "bg-amber-950/30 text-amber-500 border-amber-900/50" : "bg-amber-50 text-amber-700 border-amber-100"
                )}>
                  <span className="text-sm font-medium">{dayMonth} {language === 'pt' ? '(Anual)' : '(Yearly)'}</span>
                  <button 
                    onClick={() => {
                      const newDays = [...(formData.recurringClosedDays || [])];
                      newDays.splice(index, 1);
                      setFormData({ ...formData, recurringClosedDays: newDays });
                    }}
                    className="hover:opacity-70 transition-opacity"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <AppDatePicker id="new-closed-day" value={newClosedDay} onChange={(val)=>setNewClosedDay(val)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button 
                    onClick={() => {
                      const isRecurring = (document.getElementById('closed-is-recurring') as HTMLInputElement).checked;
                      if (newClosedDay) {
                        let val = newClosedDay;
                        if (isRecurring) {
                          const dayMonth = val.substring(5); // MM-DD
                          const current = formData.recurringClosedDays || [];
                          if (!current.includes(dayMonth)) {
                            setFormData({ ...formData, recurringClosedDays: [...current, dayMonth] });
                          }
                        } else {
                          if (!formData.closedDays.includes(val)) {
                            setFormData({ ...formData, closedDays: [...formData.closedDays, val] });
                          }
                        }
                        setNewClosedDay('');
                        (document.getElementById('closed-is-recurring') as HTMLInputElement).checked = false;
                      }
                    }}
                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                  <input type="checkbox" id="closed-is-recurring" className="rounded text-amber-600 focus:ring-amber-500" />
                  {t('settings.recurring_yearly')}
                </label>
              </div>
            </div>
            
            {/* Closed Periods Section */}
            <div className={cn(
              "pt-6 border-t font-sans transition-colors duration-300",
              settings?.theme === 'dark' ? "border-gray-800" : "border-gray-100"
            )}>
              <h3 className={cn(
                "text-lg font-bold mb-4 flex items-center gap-2 transition-colors duration-300",
                settings?.theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Calendar className="text-amber-600" size={18} />
                {t('settings.closed_periods')}
              </h3>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  {(formData.closedPeriods || []).map((period, index) => {
                    const formatPeriodDate = (dStr: string) => {
                      try {
                        if (!dStr) return '';
                        const d = parseISO(dStr);
                        if (!isNaN(d.getTime())) return format(d, 'dd/MM/yyyy');
                        return dStr;
                      } catch {
                        return dStr || '';
                      }
                    };

                    const getBackOnDate = (dStr: string) => {
                      try {
                        if (!dStr) return '';
                        const d = parseISO(dStr);
                        if (!isNaN(d.getTime())) return format(addDays(d, 1), 'dd/MM/yyyy');
                        return '';
                      } catch {
                        return '';
                      }
                    };

                    const backOn = getBackOnDate(period.endDate);

                    return (
                      <div key={index} className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-xl border transition-colors",
                        settings?.theme === 'dark' ? "bg-amber-950/20 text-amber-400 border-amber-900/40" : "bg-amber-50 text-amber-700 border-amber-100"
                      )}>
                        <div className="flex flex-col">
                          <span className="text-xs font-bold uppercase tracking-wider">{period.note || 'Holiday'}</span>
                          <span className="text-sm">
                            {formatPeriodDate(period.startDate)} {t('common.to')} {formatPeriodDate(period.endDate)}
                            {backOn && (
                              <span className="ml-2 opacity-60 italic text-xs">
                                ({t('public.back_on')} {backOn})
                              </span>
                            )}
                          </span>
                        </div>
                        <button 
                          onClick={() => {
                            const newPeriods = [...(formData.closedPeriods || [])];
                            newPeriods.splice(index, 1);
                            setFormData({ ...formData, closedPeriods: newPeriods });
                          }}
                          className="hover:opacity-70 transition-opacity p-1"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div className={cn(
                  "p-4 rounded-xl border space-y-4 transition-colors duration-300",
                  settings?.theme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-100"
                )}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{t('settings.start_date')}</label>
                      <AppDatePicker id="period-start" value={newPeriodStart} onChange={(val)=>setNewPeriodStart(val)} className={cn(
                          "w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                          settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{t('settings.end_date')}</label>
                      <AppDatePicker id="period-end" value={newPeriodEnd} onChange={(val)=>setNewPeriodEnd(val)} className={cn(
                          "w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                          settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                        )}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-gray-500 mb-1">{t('settings.period_note')}</label>
                      <input 
                        type="text"
                        id="period-note"
                        value={newPeriodNote}
                        onChange={(e) => setNewPeriodNote(e.target.value)}
                        placeholder={language === 'pt' ? "Férias da Páscoa" : "Easter Holidays"}
                        className={cn(
                          "w-full px-3 py-2 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                          settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900"
                        )}
                      />
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (newPeriodStart && newPeriodEnd) {
                        const newPeriod = {
                          startDate: newPeriodStart,
                          endDate: newPeriodEnd,
                          note: newPeriodNote.trim()
                        };
                        setFormData({
                          ...formData,
                          closedPeriods: [...(formData.closedPeriods || []), newPeriod]
                        });
                        setNewPeriodStart('');
                        setNewPeriodEnd('');
                        setNewPeriodNote('');
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg hover:bg-amber-700 transition-colors font-bold shadow-sm"
                  >
                    <Plus size={18} />
                    {t('settings.add_period')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )}

      {showDataHistory && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <h2 className={cn("text-2xl font-bold flex items-center gap-2 transition-colors duration-300", settings?.theme === 'dark' ? "text-white" : "text-gray-900")}>
              <Database className="text-amber-500" size={24} />
              {t('settings.data_history') || "Histórico de Dados"}
            </h2>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {(() => {
                const years = Array.from(new Set(
                  historyReservations.map((r: any) => r.date ? r.date.substring(0, 4) : '')
                    .filter(Boolean)
                )).sort().reverse();
                if (years.length > 0) {
                  return (
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Database size={16} className="text-amber-500" />
                        </div>
                        <CustomDropdown
                          value={selectedHistoryDataType}
                          onChange={(val) => setSelectedHistoryDataType(val)}
                          options={[
                            { value: 'all', label: t('settings.all_data') || "All Data" },
                            { value: 'reservations', label: t('nav.reservations') || "Reservations" },
                            { value: 'customers', label: t('nav.customers') || "Customers" }
                          ]}
                          isDark={settings?.theme === 'dark'}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <ChevronDown size={14} className="text-gray-400" />
                        </div>
                      </div>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Calendar size={16} className="text-amber-500" />
                        </div>
                        <CustomDropdown
                          value={selectedHistoryYear}
                          onChange={(val) => setSelectedHistoryYear(val)}
                          options={[
                            { value: 'all', label: 'All Years' },
                            ...years.map(year => ({ value: year.toString(), label: year.toString() }))
                          ]}
                          isDark={settings?.theme === 'dark'}
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                          <ChevronDown size={14} className="text-gray-400" />
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}
              
            </div>
          </div>
          
          {(() => {
            let filteredReservations = selectedHistoryYear === 'all' 
              ? historyReservations 
              : historyReservations.filter((r: any) => r.date && r.date.startsWith(selectedHistoryYear));
              
            let filteredCustomers = selectedHistoryYear === 'all' 
              ? historyCustomers 
              : historyCustomers.filter((c: any) => c.createdAt && c.createdAt.startsWith(selectedHistoryYear));
            
            if (selectedHistoryDataType === 'customers') {
              filteredReservations = [];
            } else if (selectedHistoryDataType === 'reservations') {
              filteredCustomers = [];
            }

            if (filteredReservations.length === 0 && filteredCustomers.length === 0) {
              return (
                <div className="py-20 text-center">
                  <Database size={48} className="mx-auto text-gray-300 mb-4 opacity-50" />
                  <p className="text-gray-500 font-medium">Data History is empty for this selection</p>
                </div>
              );
            }

            return (
              <>
                {filteredReservations.length > 0 && (
                  <BinSection 
                    reservations={filteredReservations}
                    isDataHistory={true}
                    onRestore={restoreReservation}
                    onPermanentDelete={forceDeleteReservation}
                    onBulkRestore={bulkRestoreReservations}
                    onBulkPermanentDelete={bulkForceDeleteReservations}
                    t={t}
                    theme={settings?.theme}
                  />
                )}
                {filteredCustomers.length > 0 && (
                  <BinCustomersSection 
                    customers={filteredCustomers}
                    isDataHistory={true}
                    onRestore={restoreCustomer}
                    onPermanentDelete={forceDeleteCustomer}
                    onBulkRestore={bulkRestoreCustomers}
                    onBulkPermanentDelete={bulkForceDeleteCustomers}
                    t={t}
                    theme={settings?.theme}
                  />
                )}
              </>
            );
          })()}
        </div>
      )}

      {showBin && (
        <div className="space-y-8">
          {deletedReservations.length === 0 && deletedCustomers.length === 0 ? (
            <div className="py-20 text-center">
              <Trash2 size={48} className="mx-auto text-gray-300 mb-4 opacity-50" />
              <p className="text-gray-500 font-medium">{t('settings.bin_empty') || "Your recycling bin is empty"}</p>
            </div>
          ) : (
            <>
              {deletedReservations.length > 0 && (
                <BinSection 
                  reservations={deletedReservations}
                  onRestore={restoreReservation}
                  onPermanentDelete={moveToHistoryReservation}
                  onBulkRestore={bulkRestoreReservations}
                  onBulkPermanentDelete={bulkMoveToHistoryReservations}
                  theme={settings?.theme}
                  t={t}
                  onShowDataHistory={() => {
                    setShowDataHistoryPrompt(true);
                    setDataHistoryPassInput('');
                  }}
                  hasHistory={historyReservations.length > 0 || historyCustomers.length > 0}
                />
              )}
              {deletedCustomers.length > 0 && (
                <BinCustomersSection 
                  customers={deletedCustomers}
                  onRestore={restoreCustomer}
                  onPermanentDelete={moveToHistoryCustomer}
                  onBulkRestore={bulkRestoreCustomers}
                  onBulkPermanentDelete={bulkMoveToHistoryCustomers}
                  theme={settings?.theme}
                  t={t}
                  onShowDataHistory={() => {
                    setShowDataHistoryPrompt(true);
                    setDataHistoryPassInput('');
                  }}
                  hasHistory={historyReservations.length > 0 || historyCustomers.length > 0}
                />
              )}
            </>
          )}
        </div>
      )}

      {showDataHistoryPrompt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl border border-gray-100 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
              <h3 className="text-xl font-bold flex items-center gap-2 transition-colors duration-300 text-white">
                <Lock className="text-amber-500" size={24} />
                {t('settings.data_history_access') || "Data History Access"}
              </h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-gray-500 dark:text-gray-400 text-sm">
                {t('settings.data_history_access_desc') || "Please enter the Data History password to access permanently deleted records."}
              </p>
              <input 
                type="password"
                value={dataHistoryPassInput}
                onChange={(e) => setDataHistoryPassInput(e.target.value)}
                placeholder={t('settings.enter_password') || "Introduzir palavra-passe"}
                className="w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm dark:bg-gray-900 dark:border-gray-700 dark:text-white"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    if (settings?.dataHistoryPassword && dataHistoryPassInput === settings?.dataHistoryPassword) {
                      setShowDataHistoryPrompt(false);
                      setShowDataHistory(true);
                      setShowBin(false);
                    } else if (!settings?.dataHistoryPassword) {
                       toast.error('Data History password is not configured yet. Set it in Settings.');
                    } else {
                      toast.error('Incorrect password');
                    }
                  }
                }}
              />
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-900/50 flex gap-3">
              <button 
                onClick={() => setShowDataHistoryPrompt(false)}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >{t('common.cancel') || "Cancelar"}</button>
              <button 
                onClick={() => {
                  if (settings?.dataHistoryPassword && dataHistoryPassInput === settings?.dataHistoryPassword) {
                    setShowDataHistoryPrompt(false);
                    setShowDataHistory(true);
                    setShowBin(false);
                  } else if (!settings?.dataHistoryPassword) {
                     toast.error('Data History password is not configured yet. Set it in Settings.');
                  } else {
                    toast.error('Incorrect password');
                  }
                }}
                className="flex-1 px-4 py-3 rounded-xl font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-lg transition-all"
              >{t('settings.access') || "Aceder"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Special Schedule Add/Edit Modal */}
      <AnimatePresence>
        {isSpecialScheduleModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "w-full max-w-xl rounded-2xl shadow-2xl border flex flex-col max-h-[90vh] overflow-hidden",
                settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
              )}
            >
              <div className={cn(
                "flex-shrink-0 px-6 py-5 border-b dark:border-gray-800 z-10 flex items-center justify-between",
                settings?.theme === 'dark' ? "bg-gray-900" : "bg-white"
              )}>
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <Clock className="text-amber-600" size={22} />
                  {editingSpecialSchedule
                    ? (language === 'pt' ? 'Editar Horário Especial' : 'Edit Special Schedule')
                    : (language === 'pt' ? 'Adicionar Horário Especial' : 'Add Special Schedule')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsSpecialScheduleModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="space-y-4">
                  {/* Active Toggle in Modal */}
                  <div className={cn(
                    "p-3.5 rounded-xl border flex items-center justify-between transition-colors",
                    settings?.theme === 'dark' ? "bg-gray-800/80 border-gray-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <div>
                      <span className={cn("font-bold text-sm block", settings?.theme === 'dark' ? "text-white" : "text-gray-900")}>
                        {language === 'pt' ? 'Estado do Horário Especial' : 'Schedule Status'}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 block">
                        {language === 'pt' ? 'Quando desativado, este horário deixa imediatamente de se aplicar.' : 'When inactive, this schedule immediately stops applying.'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs font-bold px-2 py-0.5 rounded",
                        scheduleActive
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                          : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                      )}>
                        {scheduleActive ? (language === 'pt' ? 'Ativo' : 'Active') : (language === 'pt' ? 'Inativo' : 'Inactive')}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={scheduleActive} 
                          onChange={(e) => setScheduleActive(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className={cn(
                          "w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600",
                          settings?.theme === 'dark' ? "bg-gray-700 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
                        )}></div>
                      </label>
                    </div>
                  </div>

                  {/* Schedule Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    {language === 'pt' ? 'Nome do Horário Especial' : 'Schedule Title / Name'} *
                  </label>
                  <input
                    type="text"
                    value={scheduleName}
                    onChange={(e) => setScheduleName(e.target.value)}
                    placeholder={language === 'pt' ? 'Ex: Terças de Verão, Horário de Páscoa' : 'E.g., Summer Tuesdays, Easter Opening'}
                    className={cn(
                      "w-full px-4 py-2.5 rounded-xl border text-sm font-semibold outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                  />
                </div>

                {/* Date Range */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                      {language === 'pt' ? 'Data de Início (Dia/Mês/Ano)' : 'Start Date (DD/MM/YYYY)'} *
                    </label>
                    <AppDatePicker
                      value={scheduleStartDate}
                      onChange={(val) => setScheduleStartDate(val)}
                      format="DD/MM/YYYY"
                      placeholder="DD/MM/YYYY"
                      className={cn(
                        "w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                      )}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                      {language === 'pt' ? 'Data de Fim (Dia/Mês/Ano)' : 'End Date (DD/MM/YYYY)'} *
                    </label>
                    <AppDatePicker
                      value={scheduleEndDate}
                      onChange={(val) => setScheduleEndDate(val)}
                      format="DD/MM/YYYY"
                      placeholder="DD/MM/YYYY"
                      className={cn(
                        "w-full px-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                        settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                      )}
                    />
                  </div>
                </div>

                {/* Days of week selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      {language === 'pt' ? 'Dias da Semana Aplicáveis' : 'Applicable Days of the Week'} *
                    </label>
                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setScheduleDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])}
                        className="text-amber-600 hover:underline"
                      >
                        {language === 'pt' ? 'Todos' : 'All'}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setScheduleDays(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])}
                        className="text-amber-600 hover:underline"
                      >
                        {language === 'pt' ? 'Dias Úteis' : 'Weekdays'}
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => setScheduleDays(['Saturday', 'Sunday'])}
                        className="text-amber-600 hover:underline"
                      >
                        {language === 'pt' ? 'Fim de Semana' : 'Weekends'}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                      const selected = scheduleDays.includes(day);
                      return (
                        <button
                          key={day}
                          type="button"
                          onClick={() => {
                            if (selected) {
                              setScheduleDays(scheduleDays.filter((d) => d !== day));
                            } else {
                              setScheduleDays([...scheduleDays, day]);
                            }
                          }}
                          className={cn(
                            "px-3 py-2 rounded-xl text-xs font-bold transition-all border text-center flex items-center justify-center gap-1.5",
                            selected
                              ? "bg-amber-600 border-amber-600 text-white shadow-sm"
                              : settings?.theme === 'dark'
                                ? "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                                : "bg-gray-200 border-gray-300 text-gray-700 hover:bg-gray-300"
                          )}
                        >
                          <span>{getDayLabel(day, language)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Closed checkbox */}
                <div className="p-3 rounded-xl border bg-white border-amber-200 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-sm block text-gray-900">
                      {language === 'pt' ? 'Encerrar Nestes Dias' : 'Mark Period / Days as Closed'}
                    </span>
                    <span className="text-xs text-gray-500 block">
                      {language === 'pt' ? 'Não aceita reservas no almoço nem no jantar.' : 'Completely closes Lunch & Dinner services during these days.'}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={scheduleClosed}
                    onChange={(e) => setScheduleClosed(e.target.checked)}
                    className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                </div>

                {/* Shifts */}
                {!scheduleClosed && (
                  <div className="space-y-4 pt-2 border-t dark:border-gray-800">
                    {/* Lunch */}
                    <div className="p-4 rounded-xl border space-y-3 border-gray-200 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm uppercase text-amber-600">
                          {language === 'pt' ? 'Serviço de Almoço' : 'Lunch Service'}
                        </span>
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-gray-700">
                          <input
                            type="checkbox"
                            checked={scheduleLunchActive}
                            onChange={(e) => setScheduleLunchActive(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          {language === 'pt' ? 'Ativo' : 'Active'}
                        </label>
                      </div>

                      {scheduleLunchActive && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                              {language === 'pt' ? 'Hora Abertura' : 'Open Time'}
                            </label>
                            <input
                              type="time"
                              value={scheduleLunchOpen}
                              onChange={(e) => setScheduleLunchOpen(e.target.value)}
                              className="w-full px-3 py-1.5 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 bg-white border-gray-300 text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                              {language === 'pt' ? 'Hora Fecho' : 'Close Time'}
                            </label>
                            <input
                              type="time"
                              value={scheduleLunchClose}
                              onChange={(e) => setScheduleLunchClose(e.target.value)}
                              className="w-full px-3 py-1.5 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 bg-white border-gray-300 text-gray-900"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dinner */}
                    <div className="p-4 rounded-xl border space-y-3 border-gray-200 bg-white">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm uppercase text-amber-600">
                          {language === 'pt' ? 'Serviço de Jantar' : 'Dinner Service'}
                        </span>
                        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-gray-700">
                          <input
                            type="checkbox"
                            checked={scheduleDinnerActive}
                            onChange={(e) => setScheduleDinnerActive(e.target.checked)}
                            className="rounded text-amber-600 focus:ring-amber-500"
                          />
                          {language === 'pt' ? 'Ativo' : 'Active'}
                        </label>
                      </div>

                      {scheduleDinnerActive && (
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                              {language === 'pt' ? 'Hora Abertura' : 'Open Time'}
                            </label>
                            <input
                              type="time"
                              value={scheduleDinnerOpen}
                              onChange={(e) => setScheduleDinnerOpen(e.target.value)}
                              className="w-full px-3 py-1.5 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 bg-white border-gray-300 text-gray-900"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold uppercase text-gray-500 mb-1">
                              {language === 'pt' ? 'Hora Fecho' : 'Close Time'}
                            </label>
                            <input
                              type="time"
                              value={scheduleDinnerClose}
                              onChange={(e) => setScheduleDinnerClose(e.target.value)}
                              className="w-full px-3 py-1.5 border rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-amber-500 bg-white border-gray-300 text-gray-900"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Note */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                    {language === 'pt' ? 'Nota / Descrição (Opcional)' : 'Note / Description (Optional)'}
                  </label>
                  <input
                    type="text"
                    value={scheduleNote}
                    onChange={(e) => setScheduleNote(e.target.value)}
                    placeholder={language === 'pt' ? 'Ex: Horário especial de Verão' : 'E.g. Summer special schedule'}
                    className={cn(
                      "w-full px-4 py-2 rounded-xl border text-sm outline-none focus:ring-2 focus:ring-amber-500 transition-colors",
                      settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-50 border-gray-200 text-gray-900"
                    )}
                  />
                </div>
              </div>
              </div>

              {/* Modal Actions */}
              <div className={cn(
                "flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t dark:border-gray-800",
                settings?.theme === 'dark' ? "bg-gray-900" : "bg-gray-50/80"
              )}>
                <button
                  type="button"
                  onClick={() => setIsSpecialScheduleModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
                >
                  {language === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={handleSaveSpecialSchedule}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm"
                >
                  {editingSpecialSchedule
                    ? (language === 'pt' ? 'Guardar Alterações' : 'Save Changes')
                    : (language === 'pt' ? 'Adicionar Horário' : 'Add Schedule')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SpecialDayCard: React.FC<{
  formData?: any;
  date: string;
  config: any;
  isRecurring: boolean;
  onDelete: () => void;
  onUpdate: (newConfig: any) => void;
  onMove: (oldDate: string, oldRecurring: boolean, newDate: string, newRecurring: boolean) => void;
  settings?: any;
}> = ({ formData, date, config, isRecurring, onDelete, onUpdate, onMove, settings }) => {
  const { t } = useLanguage();
  const [isEditingDate, setIsEditingDate] = useState(false);
  const [editDateValue, setEditDateValue] = useState(isRecurring ? `2024-${date}` : date);
  const [editIsRecurring, setEditIsRecurring] = useState(isRecurring);

  const formatSpecialDayDisplay = (d: string, recurring: boolean) => {
    if (!d) return '';
    if (recurring) {
      const parts = d.split('-');
      if (parts.length === 2) {
        return `${parts[1]}/${parts[0]}`;
      }
      return d;
    }
    try {
      const parsed = parseISO(d);
      if (!isNaN(parsed.getTime())) {
        return format(parsed, 'dd/MM/yyyy');
      }
    } catch {}
    return d;
  };

  const handleDateMove = () => {
    let finalDate = editDateValue;
    if (editIsRecurring) {
      finalDate = editDateValue.substring(5); // MM-DD
    }
    
    if (finalDate !== date || editIsRecurring !== isRecurring) {
      onMove(date, isRecurring, finalDate, editIsRecurring);
    }
    setIsEditingDate(false);
  };
  
  const isInactive = config.active === false;

  return (
    <div className={cn(
      "p-4 rounded-xl border transition-all duration-300",
      isInactive && (settings?.theme === 'dark' ? "bg-gray-800/40 border-gray-700/60 opacity-60" : "bg-gray-100/70 border-gray-300/80 opacity-60"),
      !isInactive && (
        config.closed 
          ? (settings?.theme === 'dark' ? "bg-red-950/20 border-red-900/50" : "bg-red-50 border-red-200") 
          : (settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 shadow-sm" : "bg-white border-gray-200 shadow-sm")
      )
    )}>
      <div className={cn(
        "flex justify-between items-start mb-4 border-b pb-2 transition-colors duration-300",
        settings?.theme === 'dark' ? "border-gray-700" : "border-gray-50"
      )}>
        <div className="flex flex-col flex-grow">
          {isEditingDate ? (
            <div className="space-y-2 pr-4">
              <AppDatePicker 
                value={editDateValue} 
                onChange={(val) => setEditDateValue(val)} 
                format="DD/MM/YYYY"
                placeholder="DD/MM/YYYY"
                className={cn(
                  "w-full px-2 py-1 border rounded text-xs outline-none focus:ring-1 focus:ring-amber-500",
                  settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-white" : "bg-white border-gray-300"
                )}
              />
              <label className={cn(
                "flex items-center gap-2 text-[10px] whitespace-nowrap cursor-pointer",
                settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                <input 
                  type="checkbox" 
                  checked={editIsRecurring} 
                  onChange={(e) => setEditIsRecurring(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3" 
                />
                {t('settings.recurring_yearly')}
              </label>
              <div className="flex gap-2">
                <button 
                  onClick={handleDateMove}
                  className="bg-amber-600 text-white px-2 py-1 rounded text-[10px] font-bold hover:bg-amber-700"
                >
                  {t('common.save')}
                </button>
                <button 
                  onClick={() => {
                    setIsEditingDate(false);
                    setEditDateValue(isRecurring ? `2024-${date}` : date);
                    setEditIsRecurring(isRecurring);
                  }}
                  className="bg-gray-200 text-gray-700 px-2 py-1 rounded text-[10px] font-bold hover:bg-gray-300"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative flex items-center gap-2">
              <div className="flex flex-col">
                <span className={cn(
                  "font-bold transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                )}>{formatSpecialDayDisplay(date, isRecurring)}</span>
                {isRecurring && <span className={cn(
                  "text-[10px] font-bold uppercase tracking-widest transition-colors",
                  settings?.theme === 'dark' ? "text-amber-500" : "text-amber-600"
                )}>{t('common.yearly_recurring')}</span>}
              </div>
              <button 
                onClick={() => setIsEditingDate(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-amber-600"
              >
                <Edit size={14} />
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Active status toggle */}
          <div className="flex items-center gap-1.5" title={isInactive ? 'Inativo / Inactive' : 'Ativo / Active'}>
            <span className={cn(
              "text-[10px] font-bold uppercase px-2 py-0.5 rounded",
              isInactive
                ? "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
            )}>
              {isInactive ? (t('common.inactive') || 'Inativo') : (t('common.active') || 'Ativo')}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={!isInactive} 
                onChange={(e) => {
                  const isActive = e.target.checked;
                  onUpdate({ 
                    ...config, 
                    active: isActive
                  });
                }}
                className="sr-only peer"
              />
              <div className={cn(
                "w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-600",
                settings?.theme === 'dark' ? "bg-gray-700 peer-focus:ring-amber-900" : "bg-gray-200 peer-focus:ring-amber-300"
              )}></div>
            </label>
          </div>

          <button 
            onClick={onDelete}
            className={cn(
              "transition-colors p-1 ml-1",
              settings?.theme === 'dark' ? "text-gray-500 hover:text-red-400" : "text-gray-400 hover:text-red-600"
            )}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {isInactive ? (
        <div className="p-3 rounded-lg bg-gray-100 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400 text-xs italic text-center">
          Dia especial desativado (não altera horários nem bloqueia reservas).
        </div>
      ) : config.closed ? (
        <div className="p-2.5 rounded-lg bg-red-100/60 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <X size={14} />
            <span>Encerrado (Fechado o dia todo)</span>
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ ...config, closed: false })}
            className="text-[10px] underline font-bold"
          >
            Abrir
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Lunch Session */}
          <div className={cn(
            "space-y-2 pt-2 border-t transition-colors",
            settings?.theme === 'dark' ? "border-gray-700" : "border-gray-50"
          )}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wider transition-colors",
                  settings?.theme === 'dark' ? "text-amber-500" : "text-amber-600"
                )}>{t('common.lunch')}</div>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...config, lunch: { ...config.lunch, fullHouse: !config.lunch?.fullHouse } })}
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded font-black transition-colors uppercase",
                      config.lunch?.fullHouse
                        ? "bg-red-600 text-white border-red-600"
                        : "text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500"
                    )}
                  >
                    {config.lunch?.fullHouse ? t('res.lunch_full').replace('ALMOÇO ', '').replace('LUNCH ', '') : t('res.lunch_open').replace('ALMOÇO ', '').replace('LUNCH ', '')}
                  </button>
              </div>
              <input 
                type="checkbox"
                checked={config.lunch?.active || false}
                onChange={(e) => {
                  const isActive = e.target.checked;
                  onUpdate({ 
                    ...config, 
                    lunch: { 
                      open: config.lunch?.open || '12:00', 
                      close: config.lunch?.close || '15:00', 
                      active: isActive,
                      fullHouse: !isActive
                    } 
                  });
                }}
                className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500"
              />
            </div>
            {config.lunch?.active && (
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(
                  "flex flex-col p-2.5 rounded-xl border transition-colors",
                  settings?.theme === 'dark' ? "bg-amber-950/20 border-amber-900/30" : "bg-amber-50/50 border-amber-100/50"
                )}>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-600"
                  )}>
                    <Clock size={10} className={cn(settings?.theme === 'dark' && "text-gray-400")} />
                    {t('common.open')}
                  </span>
                  <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                    ampm={formData?.timeFormat === '12h'}
                    value={dayjs(config.lunch.open, 'HH:mm')}
                    onChange={(newValue) => {
                      if (newValue) onUpdate({ ...config, lunch: { ...config.lunch, open: newValue.format('HH:mm') } });
                    }}
                    slotProps={{
                      textField: {
                        variant: 'standard',
                        sx: { 
                          '& .MuiInput-input': { 
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            padding: 0,
                            color: settings?.theme === 'dark' ? '#d1d5db' : '#78350f',
                            width: '100px'
                          },
                          '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                        }
                      }
                    }}
                  />
                </div>
                <div className={cn(
                  "flex flex-col p-2.5 rounded-xl border transition-colors",
                  settings?.theme === 'dark' ? "bg-amber-950/20 border-amber-900/30" : "bg-amber-50/50 border-amber-100/50"
                )}>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                    settings?.theme === 'dark' ? "text-amber-400" : "text-amber-600"
                  )}>
                    <Clock size={10} className={cn(settings?.theme === 'dark' && "text-gray-400")} />
                    {t('common.close')}
                  </span>
                  <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                    ampm={formData?.timeFormat === '12h'}
                    value={dayjs(config.lunch.close, 'HH:mm')}
                    onChange={(newValue) => {
                      if (newValue) onUpdate({ ...config, lunch: { ...config.lunch, close: newValue.format('HH:mm') } });
                    }}
                    slotProps={{
                      textField: {
                        variant: 'standard',
                        sx: { 
                          '& .MuiInput-input': { 
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            padding: 0,
                            color: settings?.theme === 'dark' ? '#d1d5db' : '#78350f',
                            width: '100px'
                          },
                          '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Dinner Session */}
          <div className={cn(
            "space-y-2 pt-2 border-t transition-colors",
            settings?.theme === 'dark' ? "border-gray-700" : "border-gray-50"
          )}>
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "text-[10px] font-bold uppercase tracking-wider transition-colors",
                  settings?.theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
                )}>{t('common.dinner')}</div>
                  <button
                    type="button"
                    onClick={() => onUpdate({ ...config, dinner: { ...config.dinner, fullHouse: !config.dinner?.fullHouse } })}
                    className={cn(
                      "text-[9px] px-1.5 py-0.5 rounded font-black transition-colors uppercase",
                      config.dinner?.fullHouse
                        ? "bg-red-600 text-white border-red-600"
                        : "text-gray-400 border-gray-200 hover:border-red-300 hover:text-red-500"
                    )}
                  >
                    {config.dinner?.fullHouse ? t('res.dinner_full').replace('JANTAR ', '').replace('DINNER ', '') : t('res.dinner_open').replace('JANTAR ', '').replace('DINNER ', '')}
                  </button>
              </div>
              <input 
                type="checkbox"
                checked={config.dinner?.active || false}
                onChange={(e) => {
                  const isActive = e.target.checked;
                  onUpdate({ 
                    ...config, 
                    dinner: { 
                      open: config.dinner?.open || '19:00', 
                      close: config.dinner?.close || '23:00', 
                      active: isActive,
                      fullHouse: !isActive
                    } 
                  });
                }}
                className="w-4 h-4 text-indigo-600 bg-gray-100 border-gray-300 rounded focus:ring-indigo-500"
              />
            </div>
            {config.dinner?.active && (
              <div className="grid grid-cols-2 gap-2">
                <div className={cn(
                  "flex flex-col p-2.5 rounded-xl border transition-colors",
                  settings?.theme === 'dark' ? "bg-indigo-950/20 border-indigo-900/30" : "bg-indigo-50/50 border-indigo-100/50"
                )}>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                    settings?.theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
                  )}>
                    <Clock size={10} className={cn(settings?.theme === 'dark' && "text-gray-400")} />
                    {t('common.open')}
                  </span>
                  <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                    ampm={formData?.timeFormat === '12h'}
                    value={dayjs(config.dinner.open, 'HH:mm')}
                    onChange={(newValue) => {
                      if (newValue) onUpdate({ ...config, dinner: { ...config.dinner, open: newValue.format('HH:mm') } });
                    }}
                    slotProps={{
                      textField: {
                        variant: 'standard',
                        sx: { 
                          '& .MuiInput-input': { 
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            padding: 0,
                            color: settings?.theme === 'dark' ? '#d1d5db' : '#312e81',
                            width: '100px'
                          },
                          '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                        }
                      }
                    }}
                  />
                </div>
                <div className={cn(
                  "flex flex-col p-2.5 rounded-xl border transition-colors",
                  settings?.theme === 'dark' ? "bg-indigo-950/20 border-indigo-900/30" : "bg-indigo-50/50 border-indigo-100/50"
                )}>
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 mb-1 transition-colors",
                    settings?.theme === 'dark' ? "text-indigo-400" : "text-indigo-600"
                  )}>
                    <Clock size={10} className={cn(settings?.theme === 'dark' && "text-gray-400")} />
                    {t('common.close')}
                  </span>
                  <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                    ampm={formData?.timeFormat === '12h'}
                    value={dayjs(config.dinner.close, 'HH:mm')}
                    onChange={(newValue) => {
                      if (newValue) onUpdate({ ...config, dinner: { ...config.dinner, close: newValue.format('HH:mm') } });
                    }}
                    slotProps={{
                      textField: {
                        variant: 'standard',
                        sx: { 
                          '& .MuiInput-input': { 
                            fontSize: '0.9rem',
                            fontWeight: 800,
                            padding: 0,
                            color: settings?.theme === 'dark' ? '#d1d5db' : '#312e81',
                            width: '100px'
                          },
                          '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className={cn(
              "block text-[10px] font-bold uppercase mb-1 transition-colors",
              settings?.theme === 'dark' ? "text-gray-500" : "text-gray-400"
            )}>{t('settings.interval')}</label>
            <CustomDropdown 
              value={(config.reservationInterval || 30).toString()}
              onChange={(val) => onUpdate({ ...config, reservationInterval: parseInt(val) })}
              options={[
                { value: '15', label: '15 min' },
                { value: '30', label: '30 min' },
                { value: '45', label: '45 min' },
                { value: '60', label: '60 min' }
              ]}
              isDark={settings?.theme === 'dark'}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// Add this at the end of the file, before sub-components
const BinSection = ({ reservations, onRestore, onPermanentDelete, onBulkRestore, onBulkPermanentDelete, theme, t, onShowDataHistory, hasHistory, isDataHistory, settings }: any) => {
  
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;
  
  const filteredItems = (reservations || []).filter((r: any) => 
    r.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    r.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((r: any) => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    await onBulkRestore(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDelete(true);
    setConfirmDelete('bulk');
  };

  return (
    <div className={cn(
      "p-6 rounded-xl shadow-sm border space-y-6 transition-colors duration-300",
      theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
    )}>
      <div className="flex justify-between items-center border-b pb-3 border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 relative">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Trash2 className="text-red-500" size={20} />
              {isDataHistory ? (t('settings.data_history') || "Data History") : (t('settings.bin') || "Recycle Bin")} - {t('nav.reservations') || "Reservations"}
            </h2>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-sm font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full uppercase tracking-wider text-[10px]">
                {selectedIds.length} {t('common.selected') || "Selected"}
              </span>
              <button
                onClick={handleBulkRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg transition-colors border border-green-200 dark:border-green-800"
              >
                <RotateCcw size={14} />
                {t('res.restore_selected') || "Restore Selected"}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors border border-red-200 dark:border-red-800"
              >
                <Trash size={14} />
                {t('res.delete_selected') || "Delete Selected"}
              </button>
            </div>
          )}
        </div>
        
        <div className="relative mt-4 sm:mt-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('common.search') || "Search..."}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={cn(
              "pl-9 pr-4 py-2 rounded-xl text-sm w-full sm:w-64 border focus:ring-2 outline-none transition-all",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-amber-500/50 focus:border-amber-500"
                : "bg-gray-50 border-gray-200 focus:ring-amber-500/20 focus:border-amber-500"
            )}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
              <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 w-10">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                </th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">{t('common.customer')}</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">{t('common.date')}</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">{t('common.guests')}</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedItems.map((res: any) => (
                <tr 
                  key={res.id} 
                  className={cn(
                    "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                    selectedIds.includes(res.id) && "bg-amber-50/30 dark:bg-amber-900/5"
                  )}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(res.id)}
                        onChange={() => toggleSelect(res.id)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-sm">{res.customerName}</div>
                    <div className="text-[10px] text-gray-500">{res.customerEmail}</div>
                  </td>
                  <td className="px-4 py-4 text-xs font-medium">
                    {res.date ? (res.date.includes('-') ? format(parseISO(res.date), 'dd-MM-yyyy') : res.date) : ''} at {formatDisplayTime(res.time, settings)}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {res.guests} {t('common.guests')}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onRestore(res.id)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Restore"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setIsBulkDelete(false);
                          setConfirmDelete(res.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Forever"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {totalPages > 0 && (
            <div className="mt-8 flex items-center justify-between px-4">
              <p className="text-sm text-gray-500 font-medium">
                {t('common.page') || "Página"} {Math.min(currentPage, totalPages)} {t('common.of') || "de"} {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={Math.min(currentPage, totalPages) === 1}
                  className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={Math.min(currentPage, totalPages) === totalPages}
                  className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors bg-white shadow-sm"
                >
                  <ChevronRight size={20} />
                </button>
              </div>
            </div>
          )}

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-md p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-gray-950 border border-gray-800" : "bg-white"
          )}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">
                {isDataHistory ? (t('res.data_history_delete_title') || "Are you sure you want to permanently delete this data?") : (t('res.delete_forever') || "Are you sure you want to delete this data?")}
              </h3>
              <p className="text-gray-500 text-sm">
                {isDataHistory ? (t('res.data_history_delete_desc') || "This action cannot be undone. Once deleted, this data will be permanently removed and cannot be recovered.") : (t('res.delete_forever_desc') || "Deleted data can only be recovered by an administrator with data recovery access.")}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setConfirmDelete(null);
                  setIsBulkDelete(false);
                }}
                className="flex-1 px-4 py-3 rounded-2xl font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (isBulkDelete) {
                    await onBulkPermanentDelete(selectedIds);
                    setSelectedIds([]);
                  } else if (confirmDelete) {
                    await onPermanentDelete(confirmDelete);
                    setSelectedIds(prev => prev.filter(id => id !== confirmDelete));
                  }
                  setConfirmDelete(null);
                  setIsBulkDelete(false);
                }}
                className="flex-1 px-4 py-3 rounded-2xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const BinCustomersSection = ({ customers, onRestore, onPermanentDelete, onBulkRestore, onBulkPermanentDelete, theme, t, onShowDataHistory, hasHistory, isDataHistory }: any) => {
  
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const itemsPerPage = 10;
  
  const filteredItems = (customers || []).filter((c: any) => 
    c.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkDelete, setIsBulkDelete] = useState(false);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredItems.length && filteredItems.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredItems.map((c: any) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    await onBulkRestore(selectedIds);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setIsBulkDelete(true);
    setConfirmDelete('bulk');
  };

  return (
    <div className={cn(
      "p-6 rounded-xl shadow-sm border space-y-6 transition-colors duration-300 mt-6",
      theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100"
    )}>
      <div className="flex justify-between items-center border-b pb-3 border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 relative">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <Trash2 className="text-red-500" size={20} />
              {isDataHistory ? (t('settings.data_history') || "Data History") : (t('settings.bin') || "Recycle Bin")} - {t('nav.customers') || "Customers"}
            </h2>
          </div>
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-200">
              <span className="text-sm font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/20 px-3 py-1 rounded-full uppercase tracking-wider text-[10px]">
                {selectedIds.length} {t('common.selected') || "Selected"}
              </span>
              <button
                onClick={handleBulkRestore}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-green-700 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:hover:bg-green-900/40 rounded-lg transition-colors border border-green-200 dark:border-green-800"
              >
                <RotateCcw size={14} />
                {t('res.restore_selected') || "Restore Selected"}
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg transition-colors border border-red-200 dark:border-red-800"
              >
                <Trash size={14} />
                {t('res.delete_selected') || "Delete Selected"}
              </button>
            </div>
          )}
        </div>
        
        <div className="relative mt-4 sm:mt-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder={t('common.search') || "Search..."}
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className={cn(
              "pl-9 pr-4 py-2 rounded-xl text-sm w-full sm:w-64 border focus:ring-2 outline-none transition-all",
              theme === 'dark'
                ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:ring-amber-500/50 focus:border-amber-500"
                : "bg-gray-50 border-gray-200 focus:ring-amber-500/20 focus:border-amber-500"
            )}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-[10px] font-bold uppercase text-gray-500 tracking-wider">
              <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 w-10">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === filteredItems.length && filteredItems.length > 0}
                    onChange={toggleSelectAll}
                      className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                  </div>
                </th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">{t('common.name')}</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">{t('common.email')}</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">{t('common.phone')}</th>
                <th className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {paginatedItems.map((c: any) => (
                <tr 
                  key={c.id} 
                  className={cn(
                    "hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors",
                    selectedIds.includes(c.id) && "bg-amber-50/30 dark:bg-amber-900/5"
                  )}
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-bold text-sm">{c.name}</div>
                  </td>
                  <td className="px-4 py-4 text-xs font-medium">
                    {c.email}
                  </td>
                  <td className="px-4 py-4 text-xs">
                    {c.phone}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => onRestore(c.id)}
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Restore"
                      >
                        <RotateCcw size={18} />
                      </button>
                      <button
                        onClick={() => {
                          setIsBulkDelete(false);
                          setConfirmDelete(c.id);
                        }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Delete Forever"
                      >
                        <Trash size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className={cn(
            "w-full max-w-md p-8 rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200",
            theme === 'dark' ? "bg-gray-950 border border-gray-800" : "bg-white"
          )}>
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash size={32} />
              </div>
              <h3 className="text-xl font-bold mb-2">
                {isDataHistory ? (t('res.data_history_delete_title') || "Are you sure you want to permanently delete this data?") : (t('res.delete_forever') || "Are you sure you want to delete this data?")}
              </h3>
              <p className="text-gray-500 text-sm">
                {isDataHistory ? (t('res.data_history_delete_desc') || "This action cannot be undone. Once deleted, this data will be permanently removed and cannot be recovered.") : (t('res.delete_forever_desc') || "Deleted data can only be recovered by an administrator with data recovery access.")}
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setConfirmDelete(null);
                  setIsBulkDelete(false);
                }}
                className={cn(
                  "flex-1 px-4 py-3 rounded-2xl font-bold transition-all border",
                  theme === 'dark' 
                    ? "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800" 
                    : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                )}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={async () => {
                  if (isBulkDelete) {
                    await onBulkPermanentDelete(selectedIds);
                    setSelectedIds([]);
                  } else if (confirmDelete) {
                    await onPermanentDelete(confirmDelete);
                    setSelectedIds(prev => prev.filter(id => id !== confirmDelete));
                  }
                  setConfirmDelete(null);
                  setIsBulkDelete(false);
                }}
                className="flex-1 px-4 py-3 rounded-2xl font-bold bg-red-600 hover:bg-red-700 text-white shadow-lg transition-all"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
