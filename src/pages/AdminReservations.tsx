import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useReservations } from '../hooks/useReservations';
import { useTables } from '../hooks/useTables';
import { useCustomers } from '../hooks/useCustomers';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { useConfirm } from '../hooks/useConfirm';
import { useNotifications } from '../hooks/useNotifications';
import { useAuth } from '../hooks/useAuth';
import { useUsers } from '../hooks/useUsers';
import { 
  format, 
  isSameDay, 
  parseISO, 
  addMinutes,
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  addWeeks, 
  subWeeks,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
  isSameMonth,
  addDays,
  subDays,
  isBefore
} from 'date-fns';
import { 
  Search, Plus, Filter, Calendar, Clock, Users, 
  Phone, Mail, CheckCircle, XCircle, Clock4, Trash2, Edit2, X, ChevronRight, User, UserPlus,
  ChevronLeft, LayoutGrid, List, CalendarDays, Ban, AlertCircle, AlertTriangle, Map, Globe,
  ChevronDown, Eye, EyeOff, Copy, Check, Table as TableIcon, RefreshCw, Printer, MoreHorizontal
} from 'lucide-react';
import { cn, formatDisplayTime, getReservationTableDisplay, getTableDisplayForDropdown, getDailyJoinForSession, getEffectiveOpeningHours } from '../lib/utils';
import { Reservation, Customer } from '../types';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { TimePicker } from '@mui/x-date-pickers';
import { renderTimeViewClock } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { toast } from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { APP_CONFIG } from '../data/appConfig';
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown';

dayjs.extend(customParseFormat);

type ViewMode = 'day' | 'week' | 'month';

export default function AdminReservations() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dateParam = searchParams.get('date');

  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('search') || '');
  const [localSearchTerm, setLocalSearchTerm] = useState(searchTerm);
  const [searchCurrentDateOnly, setSearchCurrentDateOnly] = useState(false);

  React.useEffect(() => {
    const handler = setTimeout(() => setSearchTerm(localSearchTerm), 300);
    return () => clearTimeout(handler);
  }, [localSearchTerm]);

  React.useEffect(() => {
    const search = searchParams.get('search');
    if (search !== null) {
      setSearchTerm(search);
      setLocalSearchTerm(search);
    }
  }, []); // Only run on mount or when searchParams completely change

  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [slideDirection, setSlideDirection] = useState(0);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const calendarButtonRef = React.useRef<HTMLButtonElement>(null);
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    if (dateParam) {
      try {
        return parseISO(dateParam);
      } catch {
        return new Date();
      }
    }
    return new Date();
  });

  React.useEffect(() => {
    if (dateParam) {
      try {
        setCurrentDate(parseISO(dateParam));
      } catch (err) {
        console.error(err);
      }
    }
  }, [dateParam]);

  const prevDateRef = React.useRef(currentDate);
  React.useEffect(() => {
    if (prevDateRef.current.getTime() !== currentDate.getTime()) {
      if ((searchTerm || localSearchTerm) && !searchCurrentDateOnly) {
        setSearchTerm('');
        setLocalSearchTerm('');
        if (searchParams.has('search')) {
          searchParams.delete('search');
          navigate(`?${searchParams.toString()}`, { replace: true });
        }
      }
      prevDateRef.current = currentDate;
    }
  }, [currentDate, searchTerm, navigate, searchParams, searchCurrentDateOnly]);

  const dateOptions = useMemo(() => {
    if (searchTerm.trim() !== '') {
      if (!searchCurrentDateOnly) {
        return { includeAll: true };
      }
    }
    if (viewMode === 'day') {
      return { date: format(currentDate, 'yyyy-MM-dd') };
    } else if (viewMode === 'week') {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    } else if (viewMode === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return {
        startDate: format(start, 'yyyy-MM-dd'),
        endDate: format(end, 'yyyy-MM-dd'),
      };
    }
    return {};
  }, [viewMode, currentDate, searchTerm, searchCurrentDateOnly]);

  const { reservations, addReservation, updateReservation, deleteReservation, loading } = useReservations(dateOptions);
  const { tables, areas = [] } = useTables();
  const { customers, addCustomer, updateCustomer } = useCustomers();
  const { settings, updateSettings } = useSettings();
  const { language, t } = useLanguage();
  const { user: currentUser } = useAuth();
  const { confirm, ConfirmationDialog } = useConfirm();
  const { users } = useUsers();

  const currentStaffNumber = useMemo(() => {
    if (!currentUser) return undefined;
    if (currentUser.staffNumber) return currentUser.staffNumber;
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) return (idx + 1).toString().padStart(3, '0');
    return '001';
  }, [currentUser, users]);

  const getExistingCustomer = useCallback((res: Reservation | Partial<Reservation>) => {
    if (!res) return null;
    const emailToFind = res.customerEmail?.trim().toLowerCase();
    const phoneToFind = res.customerPhone?.trim().replace(/\s+/g, '');
    const nameToFind = res.customerName?.trim().toLowerCase();

    const findPrioritizingRegistered = (predicate: (c: Customer) => boolean) => {
      const matches = customers.filter(predicate);
      if (matches.length === 0) return null;
      return matches.find(c => c.isRegistered) || matches[0];
    };

    if (emailToFind) {
      const found = findPrioritizingRegistered(c => c.email?.trim().toLowerCase() === emailToFind);
      if (found) return found;
    }
    if (phoneToFind) {
      const found = findPrioritizingRegistered(c => c.phone?.trim().replace(/\s+/g, '') === phoneToFind);
      if (found) return found;
    }
    if (nameToFind) {
      const found = findPrioritizingRegistered(c => c.name?.trim().toLowerCase() === nameToFind);
      if (found) return found;
    }
    return null;
  }, [customers]);

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

  // Do not reset new bookings automatically when visiting reservations page
  // The user wants them to persist until specifically viewed or dismissed.

  const [showAddModal, setShowAddModal] = useState(false);
  const [saveNewCustomer, setSaveNewCustomer] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [isEmailStatusOpen, setIsEmailStatusOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTableDropdownOpen, setIsTableDropdownOpen] = useState(false);
  const tableDropdownContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        tableDropdownContainerRef.current &&
        !tableDropdownContainerRef.current.contains(event.target as Node)
      ) {
        setIsTableDropdownOpen(false);
      }
    }
    if (isTableDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isTableDropdownOpen]);

  const reservationStatusOptions: DropdownOption[] = [
    { value: 'pending', label: t('res.pending'), colorDot: 'bg-amber-500' },
    { value: 'booked', label: t('res.booked'), colorDot: 'bg-blue-500' },
    { value: 'confirmed', label: t('res.confirmed'), colorDot: 'bg-green-500' },
    { value: 'delayed', label: t('res.delayed') || "Delayed", colorDot: 'bg-orange-500' },
    { value: 'arrived', label: t('res.arrived'), colorDot: 'bg-green-600' },
    { value: 'no-show', label: t('res.no_show') || t('res.no-show') || "No-show", colorDot: 'bg-gray-500' },
    { value: 'completed', label: t('res.completed'), colorDot: 'bg-yellow-400' },
    { value: 'cancelled', label: t('res.cancelled'), colorDot: 'bg-red-500' },
    { value: 'waiting-list', label: t('res.waiting-list'), colorDot: 'bg-gray-400' },
  ];
  useEffect(() => {
    if (editingRes) {
      setIsEmailStatusOpen(false);
    }
  }, [editingRes]);

  const [resOverlapWarning, setResOverlapWarning] = useState<{
    resData: any;
    conflictingRes: Reservation;
    isEdit: boolean;
  } | null>(null);
  const [newRes, setNewRes] = useState<Partial<Reservation>>({
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '19:00',
    guests: 2,
    status: 'booked',
    notes: '',
    tableId: 'auto'
  });

  const filterDate = format(currentDate, 'yyyy-MM-dd');

  const sessions = useMemo(() => {
    if (!settings) return { lunch: false, dinner: false };
    const eff = getEffectiveOpeningHours(filterDate, settings);

    return {
      lunch: eff.lunch?.active ?? false,
      dinner: eff.dinner?.active ?? false,
      lunchTimes: eff.lunch,
      dinnerTimes: eff.dinner
    };
  }, [settings, filterDate]);

  const isClosed = useMemo(() => {
    if (!settings) return false;
    try {
      const eff = getEffectiveOpeningHours(filterDate, settings);
      return eff.closed;
    } catch (err) {
      return false;
    }
  }, [filterDate, currentDate, settings]);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [showWaitlistOnly, setShowWaitlistOnly] = useState(false);
  const [isViewsDropdownOpen, setIsViewsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsViewsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [editingCustomerFromRes, setEditingCustomerFromRes] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState<{
    name: string;
    phone: string;
    email: string;
    notes: string;
    language: 'pt' | 'en';
    isRegular: boolean;
    favoriteTables: string[];
  }>({
    name: '',
    phone: '',
    email: '',
    notes: '',
    language: 'en',
    isRegular: false,
    favoriteTables: []
    });
  const [selectedTableToAdd, setSelectedTableToAdd] = useState('');

  const addFavoriteTable = (tableId: string) => {
    if (!tableId) return;
    const currentFavs = customerForm.favoriteTables || [];
    if (!currentFavs.includes(tableId)) {
      setCustomerForm({
        ...customerForm,
        favoriteTables: [...currentFavs, tableId]
      });
    }
    setSelectedTableToAdd('');
  };

  const removeFavoriteTable = (tableId: string) => {
    const currentFavs = customerForm.favoriteTables || [];
    setCustomerForm({
      ...customerForm,
      favoriteTables: currentFavs.filter(id => id !== tableId)
    });
  };

  const handleOpenSaveAsCustomer = (res: Reservation) => {
    const emailToFind = res.customerEmail?.trim().toLowerCase();
    const existingCustomer = emailToFind 
      ? customers.find(c => c.email?.trim().toLowerCase() === emailToFind)
      : null;

    if (existingCustomer) {
      setEditingCustomerFromRes(existingCustomer);
      setCustomerForm({
        name: existingCustomer.name || '',
        phone: existingCustomer.phone || '',
        email: existingCustomer.email || '',
        notes: existingCustomer.notes || '',
        language: (existingCustomer.language as 'pt' | 'en') || 'pt',
        isRegular: !!existingCustomer.isRegular,
        favoriteTables: existingCustomer.favoriteTables || []
      });
    } else {
      setEditingCustomerFromRes(null);
      setCustomerForm({
        name: res.customerName || '',
        phone: res.customerPhone || '',
        email: res.customerEmail || '',
        notes: res.notes || '',
        language: 'pt',
        isRegular: !!res.isRegularCustomer,
        favoriteTables: []
    });
    }
    setSelectedTableToAdd('');
    setShowAddCustomerModal(true);
  };

  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (customerForm.email) {
      const emailExists = customers.some(c => 
        c.email?.trim().toLowerCase() === customerForm.email.trim().toLowerCase() && 
        c.id !== editingCustomerFromRes?.id
      );
      if (emailExists) {
        toast.error(language === 'pt' ? 'Já existe um cliente com este email.' : 'A customer with this email already exists.');
        return;
      }
    }

    try {
      if (editingCustomerFromRes) {
        await updateCustomer(editingCustomerFromRes.id, {
          name: customerForm.name,
          phone: customerForm.phone,
          email: customerForm.email,
          notes: customerForm.notes,
          isRegular: customerForm.isRegular,
          language: customerForm.language || (language as 'pt' | 'en') || 'en',
          favoriteTables: customerForm.favoriteTables
        });
        toast.success(t('customers.update_success') || "Customer details updated successfully!");
      } else {
        await addCustomer({
          name: customerForm.name,
          phone: customerForm.phone,
          email: customerForm.email,
          notes: customerForm.notes,
          isRegular: customerForm.isRegular,
          language: customerForm.language || (language as 'pt' | 'en') || 'en',
          favoriteTables: customerForm.favoriteTables
        });
        toast.success(t('customers.save_as_customer_success') || "Customer saved successfully!");
      }
      setShowAddCustomerModal(false);
      setEditingCustomerFromRes(null);
      setSelectedTableToAdd('');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error saving customer");
    }
  };

  const toggleSelectAll = (reservationsOnView: Reservation[]) => {
    if (selectedIds.length === reservationsOnView.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reservationsOnView.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setShowBulkDeleteConfirm(true);
  };

  const executeBulkDelete = async () => {
    await Promise.all(selectedIds.map(id => deleteReservation(id)));
    setSelectedIds([]);
    setShowBulkDeleteConfirm(false);
    toast.success(t('res.delete_success') || "Reservations deleted successfully");
  };

  const getSessionFromTime = (time: string,
 dateStr: string, manualSession?: 'lunch' | 'dinner') => {
    if (manualSession) return manualSession;
    if (!settings) return 'general';
    const eff = getEffectiveOpeningHours(dateStr, settings);

    const lunch = eff.lunch;
    const dinner = eff.dinner;

    if (lunch && lunch.active !== false && time >= lunch.open && time <= lunch.close) return 'lunch';
    if (dinner && dinner.active !== false && time >= dinner.open && time <= dinner.close) return 'dinner';
    return 'general';
  };

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      // Do not display blocked/fully booked placeholders in the reservation list
      if (res.status === 'blocked') return false;

      // If showing waitlist only, filter by that first
      if (showWaitlistOnly && !res.isWaitlist) return false;

      const matchesSearch = 
        res.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (res.customerPhone?.includes(searchTerm) ?? false) ||
        (res.customerEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        (res.bookingNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false) ||
        res.id === searchTerm;
      
      let matchesTimeRange = false;
      const resDate = parseISO(res.date);

      if (searchTerm.trim() !== '' && !searchCurrentDateOnly && !searchParams.get('date')) {
        matchesTimeRange = true;
      } else {
        if (viewMode === 'day' || (searchTerm.trim() !== '' && (searchCurrentDateOnly || searchParams.get('date')))) {
          matchesTimeRange = isSameDay(resDate, currentDate);
        } else if (viewMode === 'week') {
          const start = startOfWeek(currentDate, { weekStartsOn: 1 });
          const end = endOfWeek(currentDate, { weekStartsOn: 1 });
          matchesTimeRange = resDate >= start && resDate <= end;
        } else if (viewMode === 'month') {
          matchesTimeRange = isSameMonth(resDate, currentDate);
        }
      }

      return matchesSearch && matchesTimeRange;
    }).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      
      if (a.time !== b.time) return a.time.localeCompare(b.time);
      
      const nameA = tables.find(t => t.id === a.tableId)?.name;
      const nameB = tables.find(t => t.id === b.tableId)?.name;
      
      if (!nameA && nameB) return 1;
      if (nameA && !nameB) return -1;
      
      if (nameA && nameB && nameA !== nameB) {
        return nameA.localeCompare(nameB, undefined, { numeric: true });
      }

      return 0;
    });
  }, [reservations, searchTerm, viewMode, currentDate, showWaitlistOnly, tables, searchCurrentDateOnly]);

  const reservationsByDay = useMemo(() => {
    const grouped: Record<string, Reservation[]> = {};
    filteredReservations.forEach(res => {
      if (!grouped[res.date]) grouped[res.date] = [];
      grouped[res.date].push(res);
    });
    return grouped;
  }, [filteredReservations]);

  const daysToDisplay = useMemo(() => {
    if (viewMode === 'day') return [currentDate];
    if (viewMode === 'week') {
      return eachDayOfInterval({
        start: startOfWeek(currentDate, { weekStartsOn: 1 }),
        end: endOfWeek(currentDate, { weekStartsOn: 1 })
      });
    }
    if (viewMode === 'month') {
      return eachDayOfInterval({
        start: startOfMonth(currentDate),
        end: endOfMonth(currentDate)
      });
    }
    return [];
  }, [viewMode, currentDate]);

  interface AreaGroup {
    areaId: string;
    areaName: string;
    isUnassigned?: boolean;
    reservations: Reservation[];
  }

  const groupReservationsByArea = useCallback((resList: Reservation[]): AreaGroup[] => {
    if (!resList || resList.length === 0) return [];

    const areaMap: Record<string, Reservation[]> = {};
    const unassignedRes: Reservation[] = [];

    const sortedAreas = [...areas].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    sortedAreas.forEach(a => {
      areaMap[a.id] = [];
    });

    resList.forEach(res => {
      if (!res.tableId || res.isWaitlist) {
        unassignedRes.push(res);
        return;
      }

      const tableIds = res.tableId.split(/[,/]/).map(s => s.trim()).filter(Boolean);
      let matchedAreaId: string | null = null;

      for (const tid of tableIds) {
        const table = tables.find(t => t.id === tid);
        if (table?.areaId) {
          matchedAreaId = table.areaId;
          break;
        }
      }

      if (matchedAreaId && areaMap[matchedAreaId]) {
        areaMap[matchedAreaId].push(res);
      } else if (matchedAreaId) {
        if (!areaMap[matchedAreaId]) {
          areaMap[matchedAreaId] = [];
        }
        areaMap[matchedAreaId].push(res);
      } else {
        unassignedRes.push(res);
      }
    });

    const result: AreaGroup[] = [];

    sortedAreas.forEach(area => {
      const list = areaMap[area.id] || [];
      if (list.length > 0) {
        result.push({
          areaId: area.id,
          areaName: area.name,
          reservations: list
        });
      }
    });

    Object.entries(areaMap).forEach(([areaId, list]) => {
      if (!sortedAreas.some(a => a.id === areaId) && list.length > 0) {
        const customArea = areas.find(a => a.id === areaId);
        result.push({
          areaId,
          areaName: customArea?.name || (language === 'pt' ? 'Outra Área' : 'Other Area'),
          reservations: list
        });
      }
    });

    if (unassignedRes.length > 0) {
      result.push({
        areaId: 'unassigned',
        areaName: language === 'pt' ? 'Sem Área Atribuída' : 'Unassigned Area',
        isUnassigned: true,
        reservations: unassignedRes
      });
    }

    return result;
  }, [areas, tables, language]);

  const renderAreaGroupedReservations = (resList: Reservation[], sessionThemeColor: 'amber' | 'indigo' | 'gray' = 'amber') => {
    if (!resList || resList.length === 0) return null;

    if (areas.length === 0) {
      return (
        <div className="grid grid-cols-1 gap-4">
          {resList.map((res) => (
            <div key={res.id} className="flex gap-4 items-start">
              <input
                type="checkbox"
                checked={selectedIds.includes(res.id)}
                onChange={() => toggleSelect(res.id)}
                className="mt-6 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
              <div className="flex-grow">
                <ReservationCard 
                  res={res} 
                  tables={tables} 
                  areas={areas}
                  onUpdateStatus={handleUpdateStatus}
                  onEdit={setEditingRes}
                  onDelete={(id) => setShowDeleteConfirm(id)}
                  onSaveAsCustomer={handleOpenSaveAsCustomer}
                  isSelected={selectedIds.includes(res.id)}
                  checkReservationOverlap={checkReservationOverlap}
                />
              </div>
            </div>
          ))}
        </div>
      );
    }

    const groups = groupReservationsByArea(resList);

    return (
      <div className="space-y-6">
        {groups.map((group) => {
          const guestCount = group.reservations.reduce((acc, r) => acc + r.guests, 0);
          return (
            <div key={group.areaId} className="space-y-3">
              {/* Small text area separator */}
              <div className="flex items-center gap-2 pt-1 pb-0.5 pl-8">
                <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <LayoutGrid 
                    size={13} 
                    className={cn(
                      "shrink-0",
                      group.isUnassigned 
                        ? "text-gray-400" 
                        : sessionThemeColor === 'indigo' 
                        ? "text-indigo-600" 
                        : sessionThemeColor === 'gray'
                        ? "text-gray-500"
                        : "text-amber-600"
                    )} 
                  />
                  <span className={cn(group.isUnassigned ? "text-gray-500 italic" : "text-gray-700")}>
                    {group.areaName}
                  </span>
                  <span className="text-[11px] font-semibold text-gray-400 normal-case">
                    ({group.reservations.length} {group.reservations.length === 1 ? (language === 'pt' ? 'reserva' : 'reservation') : (language === 'pt' ? 'reservas' : 'reservations')} • {guestCount} {guestCount === 1 ? (language === 'pt' ? 'lugar' : 'seat') : (language === 'pt' ? 'lugares' : 'seats')})
                  </span>
                </div>
                <div className="h-px flex-grow bg-gray-200/70" />
              </div>

              {/* Reservation list in this area */}
              <div className="grid grid-cols-1 gap-4">
                {group.reservations.map((res) => (
                  <div key={res.id} className="flex gap-4 items-start">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(res.id)}
                      onChange={() => toggleSelect(res.id)}
                      className="mt-6 w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <div className="flex-grow">
                      <ReservationCard 
                        res={res} 
                        tables={tables} 
                        areas={areas}
                        onUpdateStatus={handleUpdateStatus}
                        onEdit={setEditingRes}
                        onDelete={(id) => setShowDeleteConfirm(id)}
                        onSaveAsCustomer={handleOpenSaveAsCustomer}
                        isSelected={selectedIds.includes(res.id)}
                        checkReservationOverlap={checkReservationOverlap}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const availableTables = useMemo(() => {
    const targetDate = editingRes ? editingRes.date : newRes.date;
    const targetTime = editingRes ? editingRes.time : newRes.time;
    if (!targetDate || !targetTime || !settings) return tables;

    const eff = getEffectiveOpeningHours(targetDate, settings);
    const lunch = eff.lunch;
    const dinner = eff.dinner;

    let session: 'lunch' | 'dinner' | 'general' = 'general';
    if (lunch?.active && targetTime >= lunch.open && targetTime < lunch.close) session = 'lunch';
    else if (dinner?.active && targetTime >= dinner.open && targetTime < dinner.close) session = 'dinner';

    return tables.filter(table => {
      if (table.isActive === false) return false;
      if (session !== 'general' && table.activeSessions && table.activeSessions[session as 'lunch' | 'dinner'] === false) return false;
      
      const selectedDateObj = parseISO(targetDate);
      
      if (table.isExtra) {
        const isAvailableOnDate = (table.availableDate && isSameDay(selectedDateObj, parseISO(table.availableDate))) || 
                                 (table.availableDates && table.availableDates.includes(targetDate));
        
        let isAvailableForSession = true;
        if (session !== 'general' && table.extraAvailability?.[targetDate]) {
          isAvailableForSession = table.extraAvailability[targetDate][session as 'lunch' | 'dinner'] !== false;
        } else if (session !== 'general' && table.extraSessions) {
          isAvailableForSession = table.extraSessions[session as 'lunch' | 'dinner'] !== false;
        }

        if (!isAvailableOnDate || !isAvailableForSession) return false;
      } else if (table.availableDate) {
        const availDate = parseISO(table.availableDate);
        if (isBefore(selectedDateObj, availDate) && !isSameDay(selectedDateObj, availDate)) return false;
      }
      
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [tables, editingRes?.date, editingRes?.time, newRes.date, newRes.time, settings]);

  const handlePrev = () => {
    setSlideDirection(-1);
    if (viewMode === 'day') setCurrentDate(subDays(currentDate, 1));
    if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
  };

  const handleNext = () => {
    setSlideDirection(1);
    if (viewMode === 'day') setCurrentDate(addDays(currentDate, 1));
    if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
  };

  const getJoinGroupForTable = useCallback((tableId: string, dateStr: string, timeStr: string) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return [tableId];

    if (!settings) return [tableId];
    const eff = getEffectiveOpeningHours(dateStr, settings);
    const lunchTimes = eff.lunch;
    const dinnerTimes = eff.dinner;
    const lunchActive = eff.lunch?.active;
    const dinnerActive = eff.dinner?.active;

    let sessionKey: 'lunch' | 'dinner' | 'default' = 'default';
    if (lunchActive && lunchTimes && timeStr >= lunchTimes.open && timeStr <= lunchTimes.close) {
      sessionKey = 'lunch';
    } else if (dinnerActive && dinnerTimes && timeStr >= dinnerTimes.open && timeStr <= dinnerTimes.close) {
      sessionKey = 'dinner';
    }

    const currentJoin = table.dailyJoins?.[dateStr]?.[sessionKey];
    if (currentJoin && currentJoin.joinedTables && currentJoin.joinedTables.length > 0) {
      return [tableId, ...currentJoin.joinedTables];
    }
    return [tableId];
  }, [tables, settings]);

  const findBestTable = (guests: number, date: string, time: string,
    manualSession?: 'lunch' | 'dinner', currentResId?: string, favoriteTables?: string[]) => {
    if (!settings || !tables || !tables.length) return "";
    
    // 1. Contextual context for the target date/time
    const targetDate = date;
    const targetTime = time;
    const eff = getEffectiveOpeningHours(targetDate, settings);

    const lunch = eff.lunch;
    const dinner = eff.dinner;

    let session: 'lunch' | 'dinner' | 'general' = 'general';
    if (lunch?.active && targetTime >= lunch.open && targetTime < lunch.close) session = 'lunch';
    else if (dinner?.active && targetTime >= dinner.open && targetTime < dinner.close) session = 'dinner';

    // 2. Identify all valid candidate tables for this specific window
    const candidates = tables.filter(table => {
      // Basic status check
      if (table.isActive === false) return false;
      if (session !== 'general' && table.activeSessions && table.activeSessions[session as 'lunch' | 'dinner'] === false) return false;
      
      // Capacity check (Defense: ensure we have a valid seating number)
      const tableSeats = Number(table.seats);
      if (isNaN(tableSeats) || tableSeats < guests) return false;

      // Date & Session specific logic
      const selectedDateObj = parseISO(targetDate);
      if (table.isExtra) {
        const isAvailableOnDate = (table.availableDate && isSameDay(selectedDateObj, parseISO(table.availableDate))) || 
                                 (table.availableDates && table.availableDates.includes(targetDate));
        
        let isAvailableForSession = true;
        if (session !== 'general' && table.extraAvailability?.[targetDate]) {
          isAvailableForSession = table.extraAvailability[targetDate][session as 'lunch' | 'dinner'] !== false;
        } else if (session !== 'general' && table.extraSessions) {
          isAvailableForSession = table.extraSessions[session as 'lunch' | 'dinner'] !== false;
        }

        if (!isAvailableOnDate || !isAvailableForSession) return false;
      } else if (table.availableDate) {
        const availDate = parseISO(table.availableDate);
        if (isBefore(selectedDateObj, availDate) && !isSameDay(selectedDateObj, availDate)) return false;
      }

      return true;
    });

    if (candidates.length === 0) return "";

    // 3. Gap and Overlap analysis
    const gap = settings.minReservationGap || 135;
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const newStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const newEnd = addMinutes(newStart, gap);

    // Calculate overlapping reservations count and check if fully booked for each candidate
    const mappedTables = candidates.map(table => {
      const joinGroup = getJoinGroupForTable(table.id, date, time);

      // Check if there is a manual block (status === 'blocked') on ANY table in the group for that day/session.
      const isGroupBlocked = reservations.some(r => {
        if (r.id === currentResId || r.date !== date || r.status !== 'blocked') return false;
        return joinGroup.includes(r.tableId || '');
      });

      if (isGroupBlocked) {
        return { table, overlappingCount: 9999, isFullyBooked: true };
      }

      // Count active overlapping reservations in the group
      const overlappingRes = reservations.filter(r => {
        if (r.id === currentResId || r.date !== date) return false;
        if (['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(r.status)) return false;
        if (!joinGroup.includes(r.tableId || '')) return false;

        const [rYear, rMonth, rDay] = r.date.split('-').map(Number);
        const [rHours, rMinutes] = r.time.split(':').map(Number);
        const resStart = new Date(rYear, rMonth - 1, rDay, rHours, rMinutes, 0, 0);
        const resEnd = addMinutes(resStart, gap);

        return (newStart < resEnd && resStart < newEnd);
      });

      const isFullyBooked = overlappingRes.length >= 1;

      return {
        table,
        overlappingCount: overlappingRes.length,
        isFullyBooked
      };
    });

    const freeTables = mappedTables.filter(item => !item.isFullyBooked);

    if (freeTables.length === 0) return "";

    // Sort: 1. OverlappingCount asc (completely free first) 2. Smallest capacity 3. Name alphabetical
    freeTables.sort((a, b) => {
      if (favoriteTables && favoriteTables.length > 0) {
        const aFavIndex = favoriteTables.indexOf(a.table.id);
        const bFavIndex = favoriteTables.indexOf(b.table.id);
        if (aFavIndex !== -1 && bFavIndex === -1) return -1;
        if (bFavIndex !== -1 && aFavIndex === -1) return 1;
        if (aFavIndex !== -1 && bFavIndex !== -1) return aFavIndex - bFavIndex;

        const favoriteAreas = new Set(
          favoriteTables.map(id => tables.find(t => t.id === id)?.areaId).filter(Boolean)
        );
        const aInFavArea = favoriteAreas.has(a.table.areaId);
        const bInFavArea = favoriteAreas.has(b.table.areaId);
        if (aInFavArea && !bInFavArea) return -1;
        if (!aInFavArea && bInFavArea) return 1;
      }
      if (a.overlappingCount !== b.overlappingCount) {
        return a.overlappingCount - b.overlappingCount;
      }
      
      const seatsA = parseInt(String(a.table.seats || 0), 10);
      const seatsB = parseInt(String(b.table.seats || 0), 10);
      if (seatsA !== seatsB) return seatsA - seatsB;
      
      return a.table.name.localeCompare(b.table.name, undefined, { 
        numeric: true, 
        sensitivity: 'base' 
      });
    });

    return freeTables[0].table.id;
  };

  const getClosedReason = (dateStr: string, timeStr: string, manualSession?: 'lunch' | 'dinner' | string) => {
    if (!settings) return { closed: false };
    try {
      const dateObj = parseISO(dateStr);
      const dayName = format(dateObj, 'EEEE');
      
      const eff = getEffectiveOpeningHours(dateStr, settings);
      if (eff.closed) return { closed: true, reason: 'day', dayName };

      const session = getSessionFromTime(timeStr, dateStr, manualSession as 'lunch' | 'dinner' | undefined);
      if (session === 'lunch' && eff.lunch && !eff.lunch.active) return { closed: true, reason: 'lunch', dayName };
      if (session === 'dinner' && eff.dinner && !eff.dinner.active) return { closed: true, reason: 'dinner', dayName };
      if (session === 'general') return { closed: true, reason: 'day', dayName };
      
      return { closed: false };
    } catch {
      return { closed: false };
    }
  };

  const checkIfDateIsClosed = (dateStr: string) => {
    if (!settings) return false;
    try {
      const eff = getEffectiveOpeningHours(dateStr, settings);
      return eff.closed;
    } catch (err) {
      return false;
    }
  };

  const checkIfSectionIsClosed = useCallback((
    tableId: string | undefined,
    dateStr: string | undefined,
    timeStr: string | undefined,
    manualSession?: string
  ) => {
    if (!tableId || tableId === 'auto' || tableId === 'none' || !dateStr) return false;
    const table = tables.find(t => t.id === tableId);
    if (!table || !table.areaId) return false;

    const area = areas.find(a => a.id === table.areaId);
    if (!area) return false;

    const sessionKey = dateStr && timeStr ? getSessionFromTime(timeStr, dateStr, manualSession as any) : undefined;
    
    const override = area.dateOverrides?.[dateStr];
    const effectiveBookingMode = override?.bookingMode !== undefined ? override.bookingMode : area.bookingMode;
    const effectiveClosedSessions = override?.closedSessions !== undefined ? override.closedSessions : (area.closedSessions || ['lunch', 'dinner']);
    const effectiveSessionMode = override?.sessionMode !== undefined ? override.sessionMode : area.sessionMode;
    const effectiveAllowOnline = override?.allowOnlineReservations !== undefined ? override.allowOnlineReservations : area.allowOnlineReservations;

    const isAreaFullyClosed = (
      (effectiveBookingMode === 'closed' && (!sessionKey || effectiveClosedSessions?.includes(sessionKey as any)) && (!area.closedStartDate || dateStr >= area.closedStartDate) && (!area.closedEndDate || dateStr <= area.closedEndDate)) || 
      effectiveBookingMode === 'permanently_closed' || 
      (effectiveAllowOnline === false && effectiveBookingMode !== 'manual' && effectiveBookingMode !== 'closed' && (effectiveBookingMode as string) !== 'permanently_closed')
    );

    const isSessionClosed = !isAreaFullyClosed && sessionKey && (
      (effectiveSessionMode === 'lunch' && sessionKey === 'dinner') ||
      (effectiveSessionMode === 'dinner' && sessionKey === 'lunch')
    );

    return Boolean(isAreaFullyClosed || isSessionClosed);
  }, [tables, areas]);

  const checkReservationOverlap = useCallback((
    currentResId: string | undefined,
    tableId: string,
    date: string,
    time: string,
    manualSession?: 'lunch' | 'dinner'
  ) => {
    if (!tableId || tableId === 'auto' || tableId === 'none') return null;

    // Get all linked tables in the join group
    const joinGroup = getJoinGroupForTable(tableId, date, time);

    // 1. Check if there is a manual block (status === 'blocked') on ANY table in the group for that day/session.
    const isGroupBlocked = reservations.some(r => {
      if (r.id === currentResId || r.date !== date || r.status !== 'blocked') return false;
      return joinGroup.includes(r.tableId || '');
    });

    if (isGroupBlocked) {
      const blockedRes = reservations.find(r => {
        if (r.id === currentResId || r.date !== date || r.status !== 'blocked') return false;
        return joinGroup.includes(r.tableId || '');
      });
      return blockedRes || null;
    }

    const sessionKey = getSessionFromTime(time, date, manualSession);
    const isTableBlocked = joinGroup.some(tid => {
      const tObj = tables.find(t => t.id === tid);
      if (!tObj) return false;
      return !!(tObj.blockedDates?.[date]?.[sessionKey] || tObj.blockedDates?.[date]?.default || tObj.isBlocked);
    });

    if (isTableBlocked) {
      return {
        id: 'blocked-simulated',
        customerName: 'BLOCKED',
        customerEmail: '',
        customerPhone: '',
        date: date,
        time: '00:00',
        guests: 0,
        tableId: tableId,
        status: 'blocked',
        notes: 'Manual block',
        source: 'admin'
      } as any;
    }

    const gap = settings?.minReservationGap || 135;
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const newStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const newEnd = addMinutes(newStart, gap);

    // Find all active reservations on ANY table in the join group that overlap with the new slot.
    const overlappingGroupReservations = reservations.filter(r => {
      if (r.id === currentResId || r.date !== date) return false;
      if (['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(r.status)) return false;
      if (!joinGroup.includes(r.tableId || '')) return false;

      const [rYear, rMonth, rDay] = r.date.split('-').map(Number);
      const [rHours, rMinutes] = r.time.split(':').map(Number);
      const resStart = new Date(rYear, rMonth - 1, rDay, rHours, rMinutes, 0, 0);
      const resEnd = addMinutes(resStart, gap);

      return (newStart < resEnd && resStart < newEnd);
    });

    if (overlappingGroupReservations.length >= 1) {
      return overlappingGroupReservations[0];
    }

    return null;
  }, [reservations, settings, getJoinGroupForTable]);

  const formConflict = useMemo(() => {
    const targetRes = editingRes || newRes;
    if (!targetRes || !targetRes.tableId || !targetRes.date || !targetRes.time || targetRes.isWaitlist) return null;
    if (['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(targetRes.status)) return null;
    return checkReservationOverlap(editingRes?.id, targetRes.tableId, targetRes.date, targetRes.time, targetRes.manualSession);
  }, [editingRes, newRes, checkReservationOverlap]);

  const executeAddReservation = async (resData: Omit<Reservation, 'id'>) => {
    setIsSubmitting(true);
    try {
      let customerUid = resData.customerUid;
      if (!customerUid) {
        const foundCustomer = getExistingCustomer(resData);
        if (foundCustomer ) {
          customerUid = foundCustomer.id;
        }
      }

      const enrichedData = {
        ...resData,
        source: resData.source || 'admin',
        bookedByStaffNumber: resData.bookedByStaffNumber || currentStaffNumber,
        customerUid
      };
      const addedRes = await addReservation(enrichedData);

      // Send confirmation email if email exists and setting is enabled
      if (resData.customerEmail && settings?.autoSendManualReservationsEmails) {
        try {
          const resEmail = await fetch('/api/email/confirmation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: resData.customerEmail,
              name: resData.customerName,
              date: resData.date,
              time: formatDisplayTime(resData.time, settings),
              guests: resData.guests,
              restaurantName: settings?.name || APP_CONFIG.appName,
              resendApiKey: settings?.resendApiKey || (import.meta as any).env?.VITE_RESEND_API_KEY || (import.meta as any).env?.RESEND_API_KEY || '',
              resendFromEmail: settings?.resendFromEmail || (import.meta as any).env?.VITE_RESEND_FROM_EMAIL || (import.meta as any).env?.RESEND_FROM_EMAIL || '',
              language: resData.language || language,
              logoUrl: settings?.logoUrl || (settings?.useCloudinary ? settings?.cloudinaryLogoUrl : '') || '',
              restaurantEmail: settings?.email || APP_CONFIG.email,
              restaurantPhone: settings?.phone || APP_CONFIG.phone,
              restaurantAddress: settings?.address || APP_CONFIG.address,
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
          } else {
            console.warn('[Admin Create Confirmation Email Failed]:', emailData.error);
            await updateReservation(addedRes.id, {
              confirmationEmail: {
                sent: false,
                failed: true,
                error: emailData.error || 'Failed to send confirmation email',
                lastAttemptAt: new Date().toISOString()
              }
            } as any);
          }
        } catch (err) {
          console.error('Error sending confirmation email:', err);
        }
      }
      
      // Check if customer exists, if not add them
      if (saveNewCustomer) {
        try {
          await addCustomer({
            name: resData.customerName,
            phone: resData.customerPhone || "",
            email: resData.customerEmail,
            notes: resData.notes,
            language: resData.language || language || 'en'
          });
          toast.success(t('customers.save_as_customer_success') || "Customer saved successfully!");
        } catch (customerError) {
          console.error("Error adding customer:", customerError);
          // Non-blocking for the reservation
        }
      }

      setSaveNewCustomer(false);
      setShowAddModal(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success(t('res.book_success') || 'Reservation added successfully!');
      
      setNewRes({
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        date: format(currentDate, 'yyyy-MM-dd'),
        time: '19:00',
        guests: 2,
        status: 'booked',
        notes: '',
        tableId: 'auto'
      });
    } catch (error) {
      console.error("Error adding reservation:", error);
      toast.error(t('res.book_error') || 'Error adding reservation. Please try again.');
    } finally {
      setIsSubmitting(false);
      setResOverlapWarning(null);
    }
  };

  const executeUpdateReservation = async (resData: Reservation) => {
    setIsSubmitting(true);
    try {
      let customerUid = resData.customerUid;
      if (!customerUid) {
        const foundCustomer = getExistingCustomer(resData);
        if (foundCustomer ) {
          customerUid = foundCustomer.id;
        }
      }
      const updatedData = { ...resData, customerUid };
      await updateReservation(resData.id, updatedData);
      setEditingRes(null);
      toast.success(t('common.save_success') || 'Reservation updated successfully!');
      
      // Auto-send update or cancellation email if confirmation was already sent
      if (resData.confirmationEmail?.sent) {
         try {
           const endpoint = resData.status === 'cancelled' ? '/api/email/cancellation' : '/api/email/update';
           fetch(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: resData.customerEmail,
                name: resData.customerName,
                date: resData.date,
                time: formatDisplayTime(resData.time, settings),
                guests: resData.guests,
                restaurantName: settings?.name || APP_CONFIG.appName,
                resendApiKey: settings?.resendApiKey || (import.meta as any).env?.VITE_RESEND_API_KEY || (import.meta as any).env?.RESEND_API_KEY || '',
                resendFromEmail: settings?.resendFromEmail || (import.meta as any).env?.VITE_RESEND_FROM_EMAIL || (import.meta as any).env?.RESEND_FROM_EMAIL || '',
                language: resData.language || language,
                logoUrl: settings?.logoUrl || (settings?.useCloudinary ? settings?.cloudinaryLogoUrl : '') || '',
                restaurantEmail: settings?.email || APP_CONFIG.email,
                restaurantPhone: settings?.phone || APP_CONFIG.phone,
                restaurantAddress: settings?.address || APP_CONFIG.address,
                bookingNumber: resData.bookingNumber || '',
                reservationId: resData.id,
                timezone: settings?.timezone || 'Europe/Lisbon',
                viewUrl: window.location.origin + '/reservations/' + (resData.bookingNumber || resData.id),
                cancelUrl: window.location.origin + '/reservations/' + (resData.bookingNumber || resData.id) + '/cancel'
              })
           });
         } catch(e) {}
      }
    } catch (error) {
      console.error("Error updating reservation:", error);
      toast.error(t('common.save_error') || 'Error updating reservation.');
    } finally {
      setIsSubmitting(false);
      setResOverlapWarning(null);
    }
  };

  const handleAddReservation = async (e: React.FormEvent) => {
    e.preventDefault();

    let isRestaurantClosed = false;
    let restaurantClosedReason: string | undefined = undefined;

    if (newRes.date && newRes.time) {
      const closedStatus = getClosedReason(newRes.date, newRes.time, newRes.manualSession);
      isRestaurantClosed = closedStatus.closed;
      restaurantClosedReason = closedStatus.reason;
    } else if (newRes.date && checkIfDateIsClosed(newRes.date)) {
      isRestaurantClosed = true;
      restaurantClosedReason = 'day';
    }

    let sectionClosedAlreadyPrompted = false;
    if (isRestaurantClosed) {
      let msg = '';
      if (restaurantClosedReason === 'lunch') {
        msg = language === 'pt' 
          ? "O restaurante está fechado ao almoço neste dia. Tem a certeza que deseja efetuar esta reserva?" 
          : "The restaurant is closed for lunch on this day. Are you sure you want to make this reservation?";
      } else if (restaurantClosedReason === 'dinner') {
        msg = language === 'pt' 
          ? "O restaurante está fechado ao jantar neste dia. Tem a certeza que deseja efetuar esta reserva?" 
          : "The restaurant is closed for dinner on this day. Are you sure you want to make this reservation?";
      } else {
        msg = language === 'pt' 
          ? "O restaurante está fechado neste dia. Tem a certeza que deseja efetuar esta reserva?" 
          : "The restaurant is closed on this day. Are you sure you want to make this reservation?";
      }
      if (!await confirm(msg)) return;
    } else {
      const isSectionClosed = checkIfSectionIsClosed(newRes.tableId, newRes.date, newRes.time, newRes.manualSession);
      if (isSectionClosed) {
        const msg = language === 'pt'
          ? "Esta sala/secção está fechada neste dia. Tem a certeza que deseja permitir uma reserva nesta sala/secção?"
          : "This section is closed on this day. Are you sure you want to allow a booking for this section?";
        if (!await confirm(msg)) return;
        sectionClosedAlreadyPrompted = true;
      }
    }

    if (saveNewCustomer) {
      if (!newRes.customerEmail?.trim()) {
        toast.error(language === 'pt' ? 'O email é obrigatório para guardar um novo cliente.' : 'Email is required to save a new customer.');
        return;
      }
      const emailExists = customers.some(c => c.email?.trim().toLowerCase() === newRes.customerEmail?.trim().toLowerCase());
      if (emailExists) {
        toast.error(language === 'pt' ? 'Já existe um cliente com este email.' : 'A customer with this email already exists.');
        return;
      }
    }

    const resData = { ...newRes, source: 'admin' } as Omit<Reservation, 'id'>;
    
    // Handle the 'auto' or empty tableId selection
    if (!resData.isWaitlist && (resData.tableId === 'auto' || !resData.tableId) && resData.date && resData.time) {
      // If it's explicitly 'none', we don't auto-assign
      if (resData.tableId === 'none') {
        resData.tableId = "";
      } else {
        // Default behavior is now auto-assign if empty or 'auto'
        const customer = getExistingCustomer(resData);
        const bestTable = findBestTable(resData.guests, resData.date, resData.time, resData.manualSession, undefined, customer?.favoriteTables);
        if (bestTable) {
          resData.tableId = bestTable;
          if (customer?.favoriteTables && customer.favoriteTables.length > 0) {
            resData.verifyTableNumber = !customer.favoriteTables.includes(bestTable);
            if (resData.verifyTableNumber) {
              (resData as any).preferredTableUnavailable = true;
            }
          } else {
            resData.verifyTableNumber = false;
          }
        } else {
          resData.tableId = ""; // Fallback
        }
      }
    } else if (resData.tableId === 'none') {
      resData.tableId = "";
    }

    // Check if auto-assigned table belongs to a closed section (if not already prompted)
    if (!isRestaurantClosed && !sectionClosedAlreadyPrompted && resData.tableId) {
      const isSectionClosed = checkIfSectionIsClosed(resData.tableId, resData.date, resData.time, resData.manualSession);
      if (isSectionClosed) {
        const msg = language === 'pt'
          ? "Esta sala/secção está fechada neste dia. Tem a certeza que deseja permitir uma reserva nesta sala/secção?"
          : "This section is closed on this day. Are you sure you want to allow a booking for this section?";
        if (!await confirm(msg)) return;
      }
    }

    // Check for overlap
    if (resData.tableId && !resData.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(resData.status)) {
      const conflict = checkReservationOverlap(undefined, resData.tableId, resData.date, resData.time, resData.manualSession);
      if (conflict) {
        setResOverlapWarning({
          resData,
          conflictingRes: conflict,
          isEdit: false
        });
        return;
      }
    }

    await executeAddReservation(resData);
  };

  const handleResendConfirmation = async (res: Reservation) => {
    if (res.confirmationEmail?.sent) return; // Prevent double send
    try {
      const response = await fetch('/api/email/confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: res.customerEmail,
          name: res.customerName,
          date: res.date,
          time: formatDisplayTime(res.time, settings),
          guests: res.guests,
          restaurantName: settings?.name || APP_CONFIG.appName,
          resendApiKey: settings?.resendApiKey || (import.meta as any).env?.VITE_RESEND_API_KEY || (import.meta as any).env?.RESEND_API_KEY || '',
          resendFromEmail: settings?.resendFromEmail || (import.meta as any).env?.VITE_RESEND_FROM_EMAIL || (import.meta as any).env?.RESEND_FROM_EMAIL || '',
          language: res.language || language,
          logoUrl: settings?.logoUrl || (settings?.useCloudinary ? settings?.cloudinaryLogoUrl : '') || '',
          restaurantEmail: settings?.email || APP_CONFIG.email,
          restaurantPhone: settings?.phone || APP_CONFIG.phone,
          restaurantAddress: settings?.address || APP_CONFIG.address,
          bookingNumber: res.bookingNumber || '',
          reservationId: res.id,
          timezone: settings?.timezone || 'Europe/Lisbon',
          viewUrl: window.location.origin + '/reservations/' + (res.bookingNumber || res.id),
          cancelUrl: window.location.origin + '/reservations/' + (res.bookingNumber || res.id) + '/cancel'
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Confirmation email sent");
        const newConf = { sent: true, sentAt: new Date().toISOString(), messageId: data.messageId, failed: false };
        await updateReservation(res.id, { confirmationEmail: newConf } as any);
        if (editingRes?.id === res.id) setEditingRes({ ...editingRes, confirmationEmail: newConf });
      } else {
        toast.error("Failed to send: " + data.error);
        const newConf = { sent: false, failed: true, error: data.error || 'Failed to send confirmation email', lastAttemptAt: new Date().toISOString() };
        await updateReservation(res.id, { confirmationEmail: newConf } as any);
        if (editingRes?.id === res.id) setEditingRes({ ...editingRes, confirmationEmail: newConf });
      }
    } catch (e: any) {
      toast.error("Error sending email: " + (e?.message || ''));
    }
  };

  const handleSendReminderNow = async (res: Reservation) => {
    if (res.reminderEmail?.sent) return; // Prevent double send

    // Check date restriction: manual reminder can only be sent on the day of or 1 day before the reservation
    if (res.date) {
      try {
        const dateStr = res.date.trim().split('T')[0];
        const [year, month, day] = dateStr.split('-').map(Number);
        if (year && month && day) {
          const resDateObj = new Date(year, month - 1, day, 0, 0, 0, 0);
          const now = new Date();
          const todayObj = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
          const oneDayBeforeRes = new Date(resDateObj);
          oneDayBeforeRes.setDate(oneDayBeforeRes.getDate() - 1);

          if (todayObj < oneDayBeforeRes) {
            toast.error(
              language === 'pt'
                ? 'O e-mail de lembrete só pode ser enviado no próprio dia ou 1 dia antes da reserva.'
                : 'Reminder email can only be sent on the day of the reservation or 1 day before.'
            );
            return;
          }
        }
      } catch (e) {
        console.error("Error checking date for reminder email:", e);
      }
    }

    try {
      const response = await fetch('/api/email/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: res.customerEmail,
          name: res.customerName,
          date: res.date,
          time: formatDisplayTime(res.time, settings),
          guests: res.guests,
          restaurantName: settings?.name || APP_CONFIG.appName,
          resendApiKey: settings?.resendApiKey || (import.meta as any).env?.VITE_RESEND_API_KEY || (import.meta as any).env?.RESEND_API_KEY || '',
          resendFromEmail: settings?.resendFromEmail || (import.meta as any).env?.VITE_RESEND_FROM_EMAIL || (import.meta as any).env?.RESEND_FROM_EMAIL || '',
          language: res.language || language,
          logoUrl: settings?.logoUrl || (settings?.useCloudinary ? settings?.cloudinaryLogoUrl : '') || '',
          restaurantEmail: settings?.email || APP_CONFIG.email,
          restaurantPhone: settings?.phone || APP_CONFIG.phone,
          restaurantAddress: settings?.address || APP_CONFIG.address,
          bookingNumber: res.bookingNumber || '',
          reservationId: res.id,
          timezone: settings?.timezone || 'Europe/Lisbon',
          viewUrl: window.location.origin + '/reservations/' + (res.bookingNumber || res.id),
          cancelUrl: window.location.origin + '/reservations/' + (res.bookingNumber || res.id) + '/cancel'
        }),
      });
      const data = await response.json();
      if (data.success) {
        toast.success("Reminder email sent");
        const newRem = { ...res.reminderEmail, scheduled: false, sent: true, sentAt: new Date().toISOString(), messageId: data.messageId };
        await updateReservation(res.id, { reminderEmail: newRem } as any);
        if (editingRes?.id === res.id) setEditingRes({ ...editingRes, reminderEmail: newRem });
      } else {
        toast.error("Failed to send: " + data.error);
      }
    } catch (e) {
      toast.error("Error sending email");
    }
  };

  const handleUpdateReservation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRes) return;

    let isRestaurantClosed = false;
    let restaurantClosedReason: string | undefined = undefined;

    if (editingRes.date && editingRes.time) {
      const closedStatus = getClosedReason(editingRes.date, editingRes.time, editingRes.manualSession);
      isRestaurantClosed = closedStatus.closed;
      restaurantClosedReason = closedStatus.reason;
    } else if (editingRes.date && checkIfDateIsClosed(editingRes.date)) {
      isRestaurantClosed = true;
      restaurantClosedReason = 'day';
    }

    let sectionClosedAlreadyPrompted = false;
    if (isRestaurantClosed) {
      let msg = '';
      if (restaurantClosedReason === 'lunch') {
        msg = language === 'pt' 
          ? "O restaurante está fechado ao almoço neste dia. Tem a certeza que deseja efetuar esta reserva?" 
          : "The restaurant is closed for lunch on this day. Are you sure you want to make this reservation?";
      } else if (restaurantClosedReason === 'dinner') {
        msg = language === 'pt' 
          ? "O restaurante está fechado ao jantar neste dia. Tem a certeza que deseja efetuar esta reserva?" 
          : "The restaurant is closed for dinner on this day. Are you sure you want to make this reservation?";
      } else {
        msg = language === 'pt' 
          ? "O restaurante está fechado neste dia. Tem a certeza que deseja efetuar esta reserva?" 
          : "The restaurant is closed on this day. Are you sure you want to make this reservation?";
      }
      if (!await confirm(msg)) return;
    } else {
      const isSectionClosed = checkIfSectionIsClosed(editingRes.tableId, editingRes.date, editingRes.time, editingRes.manualSession);
      if (isSectionClosed) {
        const msg = language === 'pt'
          ? "Esta sala/secção está fechada neste dia. Tem a certeza que deseja permitir uma reserva nesta sala/secção?"
          : "This section is closed on this day. Are you sure you want to allow a booking for this section?";
        if (!await confirm(msg)) return;
        sectionClosedAlreadyPrompted = true;
      }
    }

    const resData = { ...editingRes };
    
    // Handle the 'auto' or empty tableId selection
    if (!resData.isWaitlist && (resData.tableId === 'auto' || !resData.tableId) && resData.date && resData.time) {
      if (resData.tableId === 'none') {
        resData.tableId = "";
      } else {
        const customer = getExistingCustomer(resData);
        const bestTable = findBestTable(resData.guests, resData.date, resData.time, resData.manualSession, resData.id, customer?.favoriteTables);
        if (bestTable) {
          resData.tableId = bestTable;
          if (customer?.favoriteTables && customer.favoriteTables.length > 0) {
            resData.verifyTableNumber = !customer.favoriteTables.includes(bestTable);
            if (resData.verifyTableNumber) {
              (resData as any).preferredTableUnavailable = true;
            }
          } else {
            resData.verifyTableNumber = false;
          }
        } else {
          resData.tableId = "";
        }
      }
    } else if (resData.tableId === 'none') {
      resData.tableId = "";
    }

    // Check if auto-assigned table belongs to a closed section (if not already prompted)
    if (!isRestaurantClosed && !sectionClosedAlreadyPrompted && resData.tableId) {
      const isSectionClosed = checkIfSectionIsClosed(resData.tableId, resData.date, resData.time, resData.manualSession);
      if (isSectionClosed) {
        const msg = language === 'pt'
          ? "Esta sala/secção está fechada neste dia. Tem a certeza que deseja permitir uma reserva nesta sala/secção?"
          : "This section is closed on this day. Are you sure you want to allow a booking for this section?";
        if (!await confirm(msg)) return;
      }
    }

    // Check for overlap
    if (resData.tableId && !resData.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(resData.status)) {
      const conflict = checkReservationOverlap(resData.id, resData.tableId, resData.date, resData.time, resData.manualSession);
      if (conflict) {
        setResOverlapWarning({
          resData,
          conflictingRes: conflict,
          isEdit: true
        });
        return;
      }
    }

    await executeUpdateReservation(resData);
  };

  const handleUpdateStatus = async (id: string, status: Reservation['status']) => {
    await updateReservation(id, { status });
  };

  if (loading && reservations.length === 0 && !searchTerm) return <div className="p-8 text-center">{t('common.loading')}</div>;

  const AdminStats = ({ resCount, guestCount }: { resCount: number, guestCount: number }) => {
    const totalCapacity = tables.reduce((acc, t) => acc + (t.seats || 0), 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((guestCount / totalCapacity) * 100) : 0;
    
    let occupancyColor = "bg-green-100 text-green-700";
    if (occupancyRate > 80) occupancyColor = "bg-red-100 text-red-700";
    else if (occupancyRate > 60) occupancyColor = "bg-orange-100 text-orange-700";
    else if (occupancyRate > 35) occupancyColor = "bg-yellow-100 text-yellow-700";

    return (
      <div className="flex items-center gap-3 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100">
        <div className="flex items-center gap-1.5 px-2 border-r border-gray-200">
          <Calendar size={14} className="text-amber-600" />
          <span className="text-xs font-bold text-gray-700">{resCount}</span>
        </div>
        <div className="flex items-center gap-1.5 px-2 border-r border-gray-200">
          <Users size={14} className="text-amber-600" />
          <span className="text-xs font-bold text-gray-700">{guestCount}</span>
        </div>
        {totalCapacity > 0 && (
          <div className="flex items-center gap-1.5 px-2">
            <div className="flex items-center text-amber-600">
              <Users size={14} />
              <Users size={14} className="-ml-0.5" />
            </div>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${occupancyColor}`} title={language === 'pt' ? 'Taxa de Ocupação' : 'Occupancy Rate'}>
              {occupancyRate}%
            </span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn("mx-auto py-8 px-4 sm:px-6 lg:px-8", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className={cn(
            "text-3xl font-bold transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-900"
          )}>{t('nav.reservations')}</h1>
          <p className={cn(
            "transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-500"
          )}>{t('dashboard.today_res')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-white p-1 rounded-2xl shadow-sm border border-gray-100 h-[42px] items-center">
          <button 
            onClick={() => { setSlideDirection(0); setViewMode('day'); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all h-full",
              viewMode === 'day' ? "bg-amber-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <List size={16} /> {t('common.day')}
          </button>
          <button 
            onClick={() => { setSlideDirection(0); setViewMode('week'); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all h-full",
              viewMode === 'week' ? "bg-amber-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <LayoutGrid size={16} /> {t('common.week')}
          </button>
          <button 
            onClick={() => { setSlideDirection(0); setViewMode('month'); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all h-full",
              viewMode === 'month' ? "bg-amber-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
            )}
          >
            <CalendarDays size={16} /> {t('common.month')}
          </button>
        </div>
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl shadow-sm border border-gray-100 h-[42px]">
          <button 
            onClick={handlePrev}
            className="p-2 hover:bg-gray-50 rounded-xl text-gray-500 transition-colors flex items-center justify-center h-full"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-1.5 px-0.5 h-full">
            <button 
              ref={calendarButtonRef}
              onClick={() => setIsCalendarOpen(true)}
              className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 hover:text-amber-700 transition-all flex items-center justify-center cursor-pointer"
              title={language === 'pt' ? 'Escolher data' : 'Choose date'}
            >
              <Calendar size={17} />
            </button>
            <DatePicker
              open={isCalendarOpen}
              onClose={() => setIsCalendarOpen(false)}
              value={dayjs(currentDate)}
              onChange={(newValue) => {
                if (newValue) {
                  const newDate = newValue.toDate();
                  setSlideDirection(newDate > currentDate ? 1 : newDate < currentDate ? -1 : 0);
                  setCurrentDate(newDate);
                }
              }}
              slotProps={{
                textField: {
                  sx: { display: 'none' }
                },
                popper: {
                  anchorEl: calendarButtonRef.current,
                  placement: 'bottom-start'
                }
              }}
            />
            <div className="px-1 font-bold text-gray-900 min-w-[128px] text-center text-xs sm:text-sm overflow-hidden h-full flex items-center justify-center relative">
              <AnimatePresence mode="popLayout" initial={false} custom={slideDirection}>
                <motion.span
                  key={viewMode + currentDate.toISOString()}
                  custom={slideDirection}
                  variants={{
                    initial: (d) => ({ y: d === 0 ? 15 : 0, x: d !== 0 ? d * 30 : 0, opacity: 0, filter: 'blur(2px)' }),
                    animate: { y: 0, x: 0, opacity: 1, filter: 'blur(0px)' },
                    exit: (d) => ({ y: d === 0 ? -15 : 0, x: d !== 0 ? d * -30 : 0, opacity: 0, filter: 'blur(2px)' })
                  }}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className="whitespace-nowrap absolute"
                >
                  {viewMode === 'day' && (isSameDay(currentDate, new Date()) ? (language === 'pt' ? 'Hoje' : 'Today') : format(currentDate, 'dd/MM/yyyy'))}
                  {viewMode === 'week' && `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'dd/MM/yyyy')}`}
                  {viewMode === 'month' && format(currentDate, 'MMMM yyyy')}
                </motion.span>
              </AnimatePresence>
            </div>
            <button type="button"
              onClick={() => {
                const now = new Date();
                setSlideDirection(now > currentDate ? 1 : now < currentDate ? -1 : 0);
                setCurrentDate(now);
              }}
              title={language === 'pt' ? 'Ir para Hoje' : 'Go to Today'}
              className="p-1.5 hover:bg-gray-50 rounded-xl text-amber-500 hover:text-amber-600 transition-colors flex items-center justify-center"
            >
              <RefreshCw size={14} />
            </button>
          </div>
          <button 
            onClick={handleNext}
            className="p-2 hover:bg-gray-100 rounded-xl text-gray-500 transition-colors flex items-center justify-center h-full"
          >
            <ChevronRight size={18} />
          </button>
        </div>


          <button
            onClick={() => {
              setNewRes(prev => ({ ...prev, date: format(currentDate, 'yyyy-MM-dd'), tableId: 'auto' }));
              setShowAddModal(true);
            }}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold transition-all shadow-lg",
              "bg-amber-600 text-white hover:bg-amber-700 shadow-amber-100"
            )}
          >
            <Plus size={20} />
            {t('res.book_table') || (language === 'pt' ? 'Reservar Mesa' : 'Book a Table')}
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col lg:flex-row gap-4 mb-8">
        <div className="flex-grow max-w-[85%] bg-white p-2 rounded-2xl shadow-sm border border-gray-100 flex items-center relative">
          <Search className="ml-3 text-gray-400" size={18} />
          {/* Visually hidden inputs to trap browser autofill */}
          <div className="absolute opacity-0 w-0 h-0 overflow-hidden pointer-events-none" aria-hidden="true" tabIndex={-1}>
            <input type="text" name="trap_name" autoComplete="name" tabIndex={-1} />
            <input type="email" name="trap_email" autoComplete="email" tabIndex={-1} />
            <input type="tel" name="trap_phone" autoComplete="tel" tabIndex={-1} />
          </div>
          
          <input 
            type="text"
            name="search-reservations-ignore"
            autoComplete="off"
            data-lpignore="true"
            data-form-type="other"
            placeholder={language === 'pt' ? 'Procurar por nome, telefone, email ou nº de reserva...' : 'Search by name, phone, email or booking number...'}
            value={localSearchTerm}
            onChange={(e) => setLocalSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-transparent border-none focus:ring-0 outline-none"
          />

          {/* Calendar Date Search Filter Toggle */}
          <button
            type="button"
            onClick={() => setSearchCurrentDateOnly(!searchCurrentDateOnly)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all mr-1 cursor-pointer border shrink-0",
              searchCurrentDateOnly
                ? "bg-amber-500 text-white border-amber-600 shadow-xs"
                : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:text-gray-900"
            )}
            title={
              searchCurrentDateOnly
                ? (language === 'pt' 
                    ? 'A pesquisar apenas na data do calendário. Clique para pesquisar em todas as reservas.' 
                    : 'Searching selected calendar date only. Click to search all DB reservations.')
                : (language === 'pt' 
                    ? 'A pesquisar em todas as reservas da BD. Clique para restringir à data do calendário.' 
                    : 'Searching all DB reservations. Click to limit to selected calendar date.')
            }
          >
            <CalendarDays size={16} className={searchCurrentDateOnly ? "text-white" : "text-amber-600"} />
            <span className="hidden sm:inline">
              {searchCurrentDateOnly 
                ? (language === 'pt' ? 'Data Selecionada' : 'Calendar Date') 
                : (language === 'pt' ? 'Todas as Datas' : 'All Dates')}
            </span>
          </button>

          {localSearchTerm && (
            <button 
              onClick={() => {
                setSearchTerm('');
                setLocalSearchTerm('');
                if (searchParams.has('search')) {
                  searchParams.delete('search');
                  navigate(`?${searchParams.toString()}`, { replace: true });
                }
              }}
              className="mr-3 p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
              title={language === 'pt' ? 'Limpar pesquisa' : 'Clear search'}
            >
              <X size={16} />
            </button>
          )}
        </div>

        

        

        {/* Online Reservations Status Label */}
        {(() => {
          const isLunchOnline = !isClosed && sessions.lunch && !(settings?.fullHouseLunchDates?.includes(filterDate) || settings?.fullHouseDates?.includes(filterDate));
          const isDinnerOnline = !isClosed && sessions.dinner && !(settings?.fullHouseDinnerDates?.includes(filterDate) || settings?.fullHouseDates?.includes(filterDate));
          return (
            <div className="flex flex-col justify-center items-center px-4 py-1 bg-white border border-gray-200 rounded-2xl shadow-sm h-[42px] whitespace-nowrap">
              <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 leading-none mb-1">
                {language === 'pt' ? 'Reservas Online' : 'Online Reservations'}
              </span>
              <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 leading-none">
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 font-medium text-xs">{language === 'pt' ? 'Almoço' : 'Lunch'}</span>
                  <div className={cn("w-2 h-2 rounded-full shrink-0", isLunchOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]")} />
                  <span className={cn("font-bold text-[11px]", isLunchOnline ? "text-green-600" : "text-red-500")}>
                    {isLunchOnline ? 'ON' : 'OFF'}
                  </span>
                </div>
                <span className="text-gray-300 font-bold">-</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-gray-600 font-medium text-xs">{language === 'pt' ? 'Jantar' : 'Dinner'}</span>
                  <div className={cn("w-2 h-2 rounded-full shrink-0", isDinnerOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]")} />
                  <span className={cn("font-bold text-[11px]", isDinnerOnline ? "text-green-600" : "text-red-500")}>
                    {isDinnerOnline ? 'ON' : 'OFF'}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Views Dropdown Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsViewsDropdownOpen(!isViewsDropdownOpen)}
            className={cn(
              "px-6 py-2.5 border rounded-2xl shadow-sm text-sm font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-w-[160px]",
              showWaitlistOnly 
                ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100/50" 
                : "bg-white border-gray-100 text-gray-700 hover:bg-gray-50"
            )}
          >
            <Eye size={18} className={cn(showWaitlistOnly ? "text-amber-600" : "text-gray-400")} />
            <span>
              {showWaitlistOnly 
                ? (language === 'pt' ? 'Ver: Lista Espera' : 'View: Waitlist') 
                : (language === 'pt' ? 'Mais' : 'More')}
            </span>
            <ChevronDown size={16} className="text-gray-400 transition-transform duration-200" style={{ transform: isViewsDropdownOpen ? 'rotate(180deg)' : 'none' }} />
          </button>

          {isViewsDropdownOpen && (
            <div className="absolute right-0 lg:left-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl py-2 z-[120] animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Online reservations toggle buttons */}
              {(() => {
                const isLunchOnline = !isClosed && sessions.lunch && !(settings?.fullHouseLunchDates?.includes(filterDate) || settings?.fullHouseDates?.includes(filterDate));
                const isDinnerOnline = !isClosed && sessions.dinner && !(settings?.fullHouseDinnerDates?.includes(filterDate) || settings?.fullHouseDates?.includes(filterDate));
                return (
                  <div className="pb-1">
                    <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                      {language === 'pt' ? 'Reservas Online' : 'Online Reservations'}
                    </div>
                    <button
                      disabled={isClosed || !sessions.lunch}
                      onClick={async () => {
                        setIsViewsDropdownOpen(false);
                        if (settings && !isClosed && sessions.lunch) {
                          const currentDates = settings.fullHouseLunchDates || [];
                          const isFullHouse = currentDates.includes(filterDate) || settings.fullHouseDates?.includes(filterDate);
                          const newDates = isFullHouse 
                            ? currentDates.filter(d => d !== filterDate)
                            : [...currentDates, filterDate];
                          
                          const globalDates = settings.fullHouseDates || [];
                          const newGlobalDates = globalDates.filter(d => d !== filterDate);
                          
                          await updateSettings({ 
                            ...settings, 
                            fullHouseLunchDates: newDates,
                            fullHouseDates: newGlobalDates
                          });
                        }
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors flex items-center gap-2.5 text-sm font-semibold",
                        (isClosed || !sessions.lunch) ? "opacity-50 cursor-not-allowed" : "text-gray-700 hover:text-amber-800"
                      )}
                    >
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", isLunchOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]")} />
                      <span>{language === 'pt' ? 'Almoço online' : 'Lunch online'} {isLunchOnline ? 'ON' : 'OFF'}</span>
                    </button>

                    <button
                      disabled={isClosed || !sessions.dinner}
                      onClick={async () => {
                        setIsViewsDropdownOpen(false);
                        if (settings && !isClosed && sessions.dinner) {
                          const currentDates = settings.fullHouseDinnerDates || [];
                          const isFullHouse = currentDates.includes(filterDate) || settings.fullHouseDates?.includes(filterDate);
                          const newDates = isFullHouse 
                            ? currentDates.filter(d => d !== filterDate)
                            : [...currentDates, filterDate];
                          
                          const globalDates = settings.fullHouseDates || [];
                          const newGlobalDates = globalDates.filter(d => d !== filterDate);
                          
                          await updateSettings({ 
                            ...settings, 
                            fullHouseDinnerDates: newDates,
                            fullHouseDates: newGlobalDates
                          });
                        }
                      }}
                      className={cn(
                        "w-full text-left px-4 py-2.5 hover:bg-amber-50 transition-colors flex items-center gap-2.5 text-sm font-semibold",
                        (isClosed || !sessions.dinner) ? "opacity-50 cursor-not-allowed" : "text-gray-700 hover:text-amber-800"
                      )}
                    >
                      <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", isDinnerOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]")} />
                      <span>{language === 'pt' ? 'Jantar online' : 'Dinner online'} {isDinnerOnline ? 'ON' : 'OFF'}</span>
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                  </div>
                );
              })()}

              {/* Option 1: Live View */}
              <button
                onClick={() => {
                  setIsViewsDropdownOpen(false);
                  const dateStr = format(currentDate, 'yyyy-MM-dd');
                  navigate(`/admin/live?date=${dateStr}`);
                }}
                className="w-full text-left px-4 py-3 hover:bg-amber-50 text-gray-700 hover:text-amber-800 transition-colors flex items-center gap-3 text-sm font-semibold"
              >
                <Map size={18} className="text-amber-500" />
                <span>{language === 'pt' ? 'Ver no Mapa (Live)' : 'Live View (Map)'}</span>
              </button>

              <div className="border-t border-gray-100 my-1" />

              {/* Option 2: Waitlist toggle */}
              <button
                onClick={() => {
                  setIsViewsDropdownOpen(false);
                  setShowWaitlistOnly(!showWaitlistOnly);
                }}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-amber-50 transition-colors flex items-center justify-between text-sm font-semibold",
                  showWaitlistOnly ? "text-amber-800 bg-amber-50/50" : "text-gray-700 hover:text-amber-800"
                )}
              >
                <div className="flex items-center gap-3">
                  <Clock4 size={18} className={cn(showWaitlistOnly ? "text-amber-600" : "text-gray-400")} />
                  <span>{language === 'pt' ? 'Lista de Espera' : 'Waitlist'}</span>
                </div>
                {showWaitlistOnly && (
                  <span className="h-2 w-2 rounded-full bg-amber-600" />
                )}
              </button>
              <div className="border-t border-gray-100 my-1" />
              {/* Option 3: Print Section */}
              <button
                onClick={() => {
                  setIsViewsDropdownOpen(false);
                  const url = `/admin/print/section?date=${format(currentDate, 'yyyy-MM-dd')}`;
                  navigate(url);
                }}
                className="w-full text-left px-4 py-3 hover:bg-amber-50 text-gray-700 hover:text-amber-800 transition-colors flex items-center gap-3 text-sm font-semibold"
              >
                <Printer size={18} className="text-amber-500" />
                <span>{language === 'pt' ? 'Imprimir' : 'Print'}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed top-[165px] right-4 md:right-8 xl:right-[calc((100vw-1280px)/2+32px)] z-[60] flex items-center gap-4 bg-white border border-amber-200 px-6 py-3 rounded-2xl shadow-2xl animate-in slide-in-from-top-4 duration-300 text-gray-900">
          <span className="text-sm font-bold text-amber-600 uppercase tracking-wider">
            {selectedIds.length} {t('common.selected') || "Selected"}
          </span>
          <div className="w-px h-6 bg-gray-200" />
          <button
            onClick={() => toggleSelectAll(filteredReservations)}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 transition-colors"
          >
            {selectedIds.length === filteredReservations.length ? t('common.deselect_all') || "Deselect All" : t('common.select_all') || "Select All"}
          </button>
          <button
            onClick={handleBulkDelete}
            className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
          >
            <Trash2 size={18} />
            {t('res.delete_selected') || "Delete Selected"}
          </button>
          <button
            onClick={() => setSelectedIds([])}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>
      )}

      {/* Reservations View */}
        <div className="w-full relative min-h-[300px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode + currentDate.toISOString() + searchTerm}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {searchTerm.trim() !== '' ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2 flex-wrap">
              {language === 'pt' ? 'Resultados da Pesquisa' : 'Search Results'}
              <span className="text-sm font-normal text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-full">
                {filteredReservations.length} {filteredReservations.length === 1 ? (language === 'pt' ? 'encontrada' : 'found') : (language === 'pt' ? 'encontradas' : 'found')}
              </span>
              <span className="text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <CalendarDays size={13} />
                {searchCurrentDateOnly 
                  ? (language === 'pt' ? `Apenas ${format(currentDate, 'dd/MM/yyyy')}` : `Selected: ${format(currentDate, 'dd/MM/yyyy')}`) 
                  : (language === 'pt' ? 'Todas as Datas' : 'All Database Dates')}
              </span>
            </h2>
          </div>

          {filteredReservations.length === 0 ? (
            <EmptyState message={t('res.no_res_found')} />
          ) : (
            renderAreaGroupedReservations(filteredReservations, 'amber')
          )}
        </div>
      ) : viewMode === 'day' ? (
        <div className="space-y-8">
          {(() => {
            const lunchRes = filteredReservations.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'lunch');
            const dinnerRes = filteredReservations.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'dinner');
            const generalRes = filteredReservations.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'general');

            if (filteredReservations.length === 0) {
              return <EmptyState message={t('res.no_res_found')} />;
            }

            return (
              <>
                {lunchRes.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={lunchRes.every(r => selectedIds.includes(r.id))}
                          onChange={() => {
                            const allInLunchSelected = lunchRes.every(r => selectedIds.includes(r.id));
                            if (allInLunchSelected) {
                              setSelectedIds(prev => prev.filter(id => !lunchRes.find(r => r.id === id)));
                            } else {
                              setSelectedIds(prev => [...new Set([...prev, ...lunchRes.map(r => r.id)])]);
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="h-px w-8 bg-amber-100" />
                      </div>
                      <h3 className="text-sm font-bold text-amber-600 uppercase tracking-wider whitespace-nowrap">
                        {t('common.lunch')}
                      </h3>
                      <AdminStats 
                        resCount={lunchRes.length} 
                        guestCount={lunchRes.reduce((acc, r) => acc + r.guests, 0)} 
                      />
                      <div className="h-px flex-grow bg-amber-100" />
                    </div>
                    {renderAreaGroupedReservations(lunchRes, 'amber')}
                  </div>
                )}

                {dinnerRes.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={dinnerRes.every(r => selectedIds.includes(r.id))}
                          onChange={() => {
                            const allInSelected = dinnerRes.every(r => selectedIds.includes(r.id));
                            if (allInSelected) {
                              setSelectedIds(prev => prev.filter(id => !dinnerRes.find(r => r.id === id)));
                            } else {
                              setSelectedIds(prev => [...new Set([...prev, ...dinnerRes.map(r => r.id)])]);
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="h-px w-8 bg-indigo-100" />
                      </div>
                      <h3 className="text-sm font-bold text-indigo-600 uppercase tracking-wider whitespace-nowrap">
                        {t('common.dinner')}
                      </h3>
                      <AdminStats 
                        resCount={dinnerRes.length} 
                        guestCount={dinnerRes.reduce((acc, r) => acc + r.guests, 0)} 
                      />
                      <div className="h-px flex-grow bg-indigo-100" />
                    </div>
                    {renderAreaGroupedReservations(dinnerRes, 'indigo')}
                  </div>
                )}

                {generalRes.length > 0 && (
                  <div className="space-y-4">
                    {(lunchRes.length > 0 || dinnerRes.length > 0) && (
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={generalRes.every(r => selectedIds.includes(r.id))}
                            onChange={() => {
                              const allInSelected = generalRes.every(r => selectedIds.includes(r.id));
                              if (allInSelected) {
                                setSelectedIds(prev => prev.filter(id => !generalRes.find(r => r.id === id)));
                              } else {
                                setSelectedIds(prev => [...new Set([...prev, ...generalRes.map(r => r.id)])]);
                              }
                            }}
                            className="w-4 h-4 rounded border-gray-300 text-gray-400 focus:ring-gray-300 cursor-pointer"
                          />
                          <div className="h-px w-8 bg-gray-100" />
                        </div>
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider whitespace-nowrap">
                          {t('common.general')}
                        </h3>
                        <AdminStats 
                          resCount={generalRes.length} 
                          guestCount={generalRes.reduce((acc, r) => acc + r.guests, 0)} 
                        />
                        <div className="h-px flex-grow bg-gray-100" />
                      </div>
                    )}
                    {renderAreaGroupedReservations(generalRes, 'gray')}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
        <div className={cn(
          "grid gap-6",
          viewMode === 'week' ? "grid-cols-1 md:grid-cols-7" : "grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-7"
        )}>
          {daysToDisplay.map((day) => {
            const dayStr = format(day, 'yyyy-MM-dd');
            const dayReservations = reservationsByDay[dayStr] || [];
            const isToday = isSameDay(day, new Date());
            
            return (
              <div 
                key={dayStr} 
                className={cn(
                  "flex flex-col min-h-[200px] bg-white rounded-2xl border transition-all",
                  isToday ? "border-amber-500 ring-1 ring-amber-500 shadow-lg" : "border-gray-100 shadow-sm"
                )}
              >
                <div 
                  onClick={() => {
                    setCurrentDate(day);
                    setViewMode('day');
                  }}
                  title={language === 'pt' ? 'Ver reservas deste dia' : 'View reservations for this day'}
                  className={cn(
                    "p-3 border-b flex flex-col items-center cursor-pointer transition-colors group/dayheader",
                    isToday 
                      ? "bg-amber-50 border-amber-100 hover:bg-amber-100/70" 
                      : "bg-gray-50/50 border-gray-100 hover:bg-gray-100"
                  )}
                >
                  <span className={cn(
                    "text-[10px] font-bold uppercase tracking-widest group-hover/dayheader:text-amber-600 transition-colors",
                    isToday ? "text-amber-600" : "text-gray-400"
                  )}>
                    {t(`days.${format(day, 'EEE').toLowerCase()}`)}
                  </span>
                  <span className={cn(
                    "text-xl font-black mb-2 group-hover/dayheader:scale-105 transition-transform",
                    isToday ? "text-amber-700" : "text-gray-900"
                  )}>
                    {format(day, 'd')}
                  </span>
                  {dayReservations.length > 0 && (
                    <div className="flex items-center gap-2 bg-white/50 px-2 py-0.5 rounded-full border border-gray-100">
                      <div className="flex items-center gap-1">
                        <Calendar size={10} className="text-amber-500" />
                        <span className="text-[9px] font-bold text-gray-600">{dayReservations.length}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Users size={10} className="text-amber-500" />
                        <span className="text-[9px] font-bold text-gray-600">
                          {dayReservations.reduce((acc, r) => acc + r.guests, 0)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-2 space-y-2 flex-grow overflow-y-auto max-h-[400px]">
                  {dayReservations.length > 0 ? (
                    <div className="space-y-2">
                       <button
                        onClick={() => {
                          const allInDaySelected = dayReservations.every(r => selectedIds.includes(r.id));
                          if (allInDaySelected) {
                            setSelectedIds(prev => prev.filter(id => !dayReservations.find(r => r.id === id)));
                          } else {
                            setSelectedIds(prev => [...new Set([...prev, ...dayReservations.map(r => r.id)])]);
                          }
                        }}
                        className="w-full py-1 text-[9px] font-bold text-gray-400 hover:text-amber-600 transition-colors border border-dashed border-gray-100 rounded-lg"
                      >
                        {dayReservations.every(r => selectedIds.includes(r.id)) ? t('common.deselect_all') : t('common.select_all')}
                      </button>
                      {(() => {
                        const lunchRes = dayReservations.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'lunch');
                        const dinnerRes = dayReservations.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'dinner');
                        const generalRes = dayReservations.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'general');

                        return (
                          <div className="space-y-3">
                            {lunchRes.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <div className="h-px flex-grow bg-amber-100" />
                                  <span className="text-[9px] font-extrabold text-amber-600 uppercase tracking-wide flex items-center gap-1">
                                    {t('common.lunch')} ({lunchRes.length})
                                    {(() => {
                                      const totalCapacity = tables.reduce((acc, t) => acc + (t.seats || 0), 0);
                                      const guestCount = lunchRes.reduce((acc, r) => acc + r.guests, 0);
                                      const occupancyRate = totalCapacity > 0 ? Math.round((guestCount / totalCapacity) * 100) : 0;
                                      let occupancyColor = "bg-green-100 text-green-700";
                                      if (occupancyRate > 80) occupancyColor = "bg-red-100 text-red-700";
                                      else if (occupancyRate > 60) occupancyColor = "bg-orange-100 text-orange-700";
                                      else if (occupancyRate > 35) occupancyColor = "bg-yellow-100 text-yellow-700";
                                      return totalCapacity > 0 ? (
                                        <span className="flex items-center gap-0.5">
                                          <span className="flex items-center text-amber-600">
                                            <Users size={8} />
                                            <Users size={8} className="-ml-0.5" />
                                          </span>
                                          <span className={`px-1 rounded ${occupancyColor}`}>{occupancyRate}%</span>
                                        </span>
                                      ) : null;
                                    })()}
                                  </span>
                                  <div className="h-px w-2 bg-amber-100" />
                                </div>
                                <div className="space-y-1.5">
                                  {lunchRes.map(res => (
                                    <div key={res.id} className="flex gap-1.5 items-start">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(res.id)}
                                        onChange={() => toggleSelect(res.id)}
                                        className="mt-2.5 w-3 h-3 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                                      />
                                      <div 
                                        onClick={() => setEditingRes(res)}
                                        className={cn(
                                          "flex-grow p-1.5 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-95 shadow-sm min-w-0",
                                          selectedIds.includes(res.id) ? "ring-1 ring-amber-500 border-amber-500" : "",
                                          res.status === 'confirmed' ? "bg-green-50 border-green-100 text-green-800" :
                                          res.status === 'booked' ? "bg-blue-50 border-blue-100 text-blue-800" :
                                          res.status === 'pending' ? "bg-amber-50 border-amber-100 text-amber-800" :
                                          res.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-800" :
                                          "bg-gray-50 border-gray-100 text-gray-800"
                                        )}
                                      >
                                        <div className="flex justify-between items-center mb-0.5">
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="text-[9px] font-bold">{formatDisplayTime(res.time, settings)}</span>
                                            {res.verifyTableNumber && (
                                              <AlertCircle size={7} className="text-rose-600 animate-pulse flex-shrink-0" />
                                            )}
                                            {res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && (() => {
                                              const conflict = checkReservationOverlap(res.id, res.tableId, res.date, res.time, res.manualSession);
                                              return conflict && conflict.status !== 'blocked';
                                            })() && (
                                              <AlertCircle size={7} className="text-red-600 animate-pulse flex-shrink-0" />
                                            )}
                                            {!res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && (
                                              <Ban size={7} className="text-red-600 animate-pulse flex-shrink-0" />
                                            )}
                                          </div>
                                          <div className={cn(
                                            "w-1 h-1 rounded-full flex-shrink-0",
                                            res.status === 'confirmed' ? "bg-green-500" :
                                            res.status === 'booked' ? "bg-blue-500" :
                                            res.status === 'pending' ? "bg-amber-500" :
                                            res.status === 'cancelled' ? "bg-red-500" : "bg-gray-500"
                                          )} />
                                        </div>
                                        <p className="text-[10px] font-bold truncate leading-tight">{res.customerName}</p>
                                        <div className="flex items-center gap-1 text-[8px] opacity-70 mt-0.5">
                                          <Users size={7} />
                                          <span>{res.guests}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {dinnerRes.length > 0 && (
                              <div className="space-y-1">
                                <div className="flex items-center gap-1">
                                  <div className="h-px flex-grow bg-indigo-100" />
                                  <span className="text-[9px] font-extrabold text-indigo-600 uppercase tracking-wide flex items-center gap-1">
                                    {t('common.dinner')} ({dinnerRes.length})
                                    {(() => {
                                      const totalCapacity = tables.reduce((acc, t) => acc + (t.seats || 0), 0);
                                      const guestCount = dinnerRes.reduce((acc, r) => acc + r.guests, 0);
                                      const occupancyRate = totalCapacity > 0 ? Math.round((guestCount / totalCapacity) * 100) : 0;
                                      let occupancyColor = "bg-green-100 text-green-700";
                                      if (occupancyRate > 80) occupancyColor = "bg-red-100 text-red-700";
                                      else if (occupancyRate > 60) occupancyColor = "bg-orange-100 text-orange-700";
                                      else if (occupancyRate > 35) occupancyColor = "bg-yellow-100 text-yellow-700";
                                      return totalCapacity > 0 ? (
                                        <span className="flex items-center gap-0.5">
                                          <span className="flex items-center text-indigo-600">
                                            <Users size={8} />
                                            <Users size={8} className="-ml-0.5" />
                                          </span>
                                          <span className={`px-1 rounded ${occupancyColor}`}>{occupancyRate}%</span>
                                        </span>
                                      ) : null;
                                    })()}
                                  </span>
                                  <div className="h-px w-2 bg-indigo-100" />
                                </div>
                                <div className="space-y-1.5">
                                  {dinnerRes.map(res => (
                                    <div key={res.id} className="flex gap-1.5 items-start">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(res.id)}
                                        onChange={() => toggleSelect(res.id)}
                                        className="mt-2.5 w-3 h-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer flex-shrink-0"
                                      />
                                      <div 
                                        onClick={() => setEditingRes(res)}
                                        className={cn(
                                          "flex-grow p-1.5 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-95 shadow-sm min-w-0",
                                          selectedIds.includes(res.id) ? "ring-1 ring-amber-500 border-amber-500" : "",
                                          res.status === 'confirmed' ? "bg-green-50 border-green-100 text-green-800" :
                                          res.status === 'booked' ? "bg-blue-50 border-blue-100 text-blue-800" :
                                          res.status === 'pending' ? "bg-amber-50 border-amber-100 text-amber-800" :
                                          res.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-800" :
                                          "bg-gray-50 border-gray-100 text-gray-800"
                                        )}
                                      >
                                        <div className="flex justify-between items-center mb-0.5">
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="text-[9px] font-bold">{formatDisplayTime(res.time, settings)}</span>
                                            {res.verifyTableNumber && (
                                              <AlertCircle size={7} className="text-rose-600 animate-pulse flex-shrink-0" />
                                            )}
                                            {res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && (() => {
                                              const conflict = checkReservationOverlap(res.id, res.tableId, res.date, res.time, res.manualSession);
                                              return conflict && conflict.status !== 'blocked';
                                            })() && (
                                              <AlertCircle size={7} className="text-red-600 animate-pulse flex-shrink-0" />
                                            )}
                                            {!res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && (
                                              <Ban size={7} className="text-red-600 animate-pulse flex-shrink-0" />
                                            )}
                                          </div>
                                          <div className={cn(
                                            "w-1 h-1 rounded-full flex-shrink-0",
                                            res.status === 'confirmed' ? "bg-green-500" :
                                            res.status === 'booked' ? "bg-blue-500" :
                                            res.status === 'pending' ? "bg-amber-500" :
                                            res.status === 'cancelled' ? "bg-red-500" : "bg-gray-500"
                                          )} />
                                        </div>
                                        <p className="text-[10px] font-bold truncate leading-tight">{res.customerName}</p>
                                        <div className="flex items-center gap-1 text-[8px] opacity-70 mt-0.5">
                                          <Users size={7} />
                                          <span>{res.guests}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {generalRes.length > 0 && (
                              <div className="space-y-1">
                                {(lunchRes.length > 0 || dinnerRes.length > 0) && (
                                  <div className="flex items-center gap-1">
                                    <div className="h-px flex-grow bg-gray-100" />
                                    <span className="text-[9px] font-extrabold text-gray-400 uppercase tracking-wide">
                                      {t('common.general')} ({generalRes.length})
                                    </span>
                                    <div className="h-px w-2 bg-gray-100" />
                                  </div>
                                )}
                                <div className="space-y-1.5">
                                  {generalRes.map(res => (
                                    <div key={res.id} className="flex gap-1.5 items-start">
                                      <input
                                        type="checkbox"
                                        checked={selectedIds.includes(res.id)}
                                        onChange={() => toggleSelect(res.id)}
                                        className="mt-2.5 w-3 h-3 rounded border-gray-300 text-amber-600 focus:ring-amber-500 cursor-pointer flex-shrink-0"
                                      />
                                      <div 
                                        onClick={() => setEditingRes(res)}
                                        className={cn(
                                          "flex-grow p-1.5 rounded-lg border text-left cursor-pointer transition-all hover:scale-[1.01] active:scale-95 shadow-sm min-w-0",
                                          selectedIds.includes(res.id) ? "ring-1 ring-amber-500 border-amber-500" : "",
                                          res.status === 'confirmed' ? "bg-green-50 border-green-100 text-green-800" :
                                          res.status === 'booked' ? "bg-blue-50 border-blue-100 text-blue-800" :
                                          res.status === 'pending' ? "bg-amber-50 border-amber-100 text-amber-800" :
                                          res.status === 'cancelled' ? "bg-red-50 border-red-100 text-red-800" :
                                          "bg-gray-50 border-gray-100 text-gray-800"
                                        )}
                                      >
                                        <div className="flex justify-between items-center mb-0.5">
                                          <div className="flex items-center gap-1 min-w-0">
                                            <span className="text-[9px] font-bold">{formatDisplayTime(res.time, settings)}</span>
                                            {res.verifyTableNumber && (
                                              <AlertCircle size={7} className="text-rose-600 animate-pulse flex-shrink-0" />
                                            )}
                                            {res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && (() => {
                                              const conflict = checkReservationOverlap(res.id, res.tableId, res.date, res.time, res.manualSession);
                                              return conflict && conflict.status !== 'blocked';
                                            })() && (
                                              <AlertCircle size={7} className="text-red-600 animate-pulse flex-shrink-0" />
                                            )}
                                            {!res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && (
                                              <Ban size={7} className="text-red-600 animate-pulse flex-shrink-0" />
                                            )}
                                          </div>
                                          <div className={cn(
                                            "w-1 h-1 rounded-full flex-shrink-0",
                                            res.status === 'confirmed' ? "bg-green-500" :
                                            res.status === 'booked' ? "bg-blue-500" :
                                            res.status === 'pending' ? "bg-amber-500" :
                                            res.status === 'cancelled' ? "bg-red-500" : "bg-gray-500"
                                          )} />
                                        </div>
                                        <p className="text-[10px] font-bold truncate leading-tight">{res.customerName}</p>
                                        <div className="flex items-center gap-1 text-[8px] opacity-70 mt-0.5">
                                          <Users size={7} />
                                          <span>{res.guests}</span>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center py-8">
                      <p className="text-[10px] text-gray-300 font-medium italic">{t('res.no_bookings')}</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
            </motion.div>
          </AnimatePresence>
        </div>
      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl">
            <h3 className="text-2xl font-bold mb-4">{t('res.delete_title')}</h3>
            <p className="text-gray-600 mb-8">{t('res.delete_confirm')}</p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t('res.keep')}
              </button>
              <button 
                onClick={async () => {
                  await deleteReservation(showDeleteConfirm);
                  setShowDeleteConfirm(null);
                }}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl text-gray-900">
            <h3 className="text-2xl font-bold mb-4">{t('res.delete_title')}</h3>
            <p className="text-gray-600 mb-8">
              {t('res.delete_selected') || "Delete Selected"} {selectedIds.length} {t('nav.reservations').toLowerCase()}?
            </p>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowBulkDeleteConfirm(false)}
                className="flex-1 px-6 py-3 border border-gray-200 rounded-2xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                {t('res.keep')}
              </button>
              <button 
                onClick={executeBulkDelete}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {(showAddModal || editingRes) && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-2 sm:p-4 overflow-hidden"
          onClick={() => { setShowAddModal(false); setEditingRes(null); }}
        >
          <div 
            className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-gray-100 shrink-0">
              <h3 className="text-2xl font-bold">
                {editingRes ? t('res.edit') : t('res.book_table') || (language === 'pt' ? 'Reservar Mesa' : 'Book a Table')}
              </h3>
              <button 
                onClick={() => { setShowAddModal(false); setEditingRes(null); }} 
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={28} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
            <form 
              onSubmit={editingRes ? handleUpdateReservation : handleAddReservation} 
              className="flex flex-col gap-6"
            >
              {(() => {
                const activeRes = editingRes || (newRes as Reservation);
                let isRestClosed = false;
                let restClosedReason: string | undefined = undefined;

                if (activeRes.date && activeRes.time) {
                  const res = getClosedReason(activeRes.date, activeRes.time, activeRes.manualSession);
                  isRestClosed = res.closed;
                  restClosedReason = res.reason;
                } else if (activeRes.date && checkIfDateIsClosed(activeRes.date)) {
                  isRestClosed = true;
                  restClosedReason = 'day';
                }

                const isSectClosed = !isRestClosed && Boolean(
                  activeRes.tableId && checkIfSectionIsClosed(activeRes.tableId, activeRes.date, activeRes.time, activeRes.manualSession)
                );

                if (isRestClosed) {
                  let title = language === 'pt' ? 'Restaurante Fechado' : 'Restaurant Closed';
                  let detail = language === 'pt' 
                    ? 'O restaurante está fechado neste dia. Tem a certeza que deseja efetuar esta reserva?' 
                    : 'The restaurant is closed on this day. Are you sure you want to make this reservation?';

                  if (restClosedReason === 'lunch') {
                    title = language === 'pt' ? 'Restaurante Fechado ao Almoço' : 'Restaurant Closed for Lunch';
                    detail = language === 'pt'
                      ? 'O restaurante está fechado ao almoço neste dia. Tem a certeza que deseja efetuar esta reserva?'
                      : 'The restaurant is closed for lunch on this day. Are you sure you want to make this reservation?';
                  } else if (restClosedReason === 'dinner') {
                    title = language === 'pt' ? 'Restaurante Fechado ao Jantar' : 'Restaurant Closed for Dinner';
                    detail = language === 'pt'
                      ? 'O restaurante está fechado ao jantar neste dia. Tem a certeza que deseja efetuar esta reserva?'
                      : 'The restaurant is closed for dinner on this day. Are you sure you want to make this reservation?';
                  }

                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm font-medium flex items-center gap-3 shadow-sm">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">{title}</p>
                        <p className="text-xs text-amber-800 mt-0.5">{detail}</p>
                      </div>
                    </div>
                  );
                }

                if (isSectClosed) {
                  return (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 text-sm font-medium flex items-center gap-3 shadow-sm">
                      <AlertTriangle size={20} className="text-amber-600 shrink-0" />
                      <div>
                        <p className="font-bold">
                          {language === 'pt' ? 'Sala/Secção Fechada' : 'Section Closed'}
                        </p>
                        <p className="text-xs text-amber-800 mt-0.5">
                          {language === 'pt' 
                            ? 'Esta sala/secção está fechada neste dia. Tem a certeza que deseja permitir uma reserva nesta sala/secção?' 
                            : 'This section is closed on this day. Are you sure you want to allow a booking for this section?'}
                        </p>
                      </div>
                    </div>
                  );
                }

                return null;
              })()}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-400 uppercase text-xs tracking-widest">{t('public.guest_info')}</h4>
                  {(() => {
                    const resToUse = editingRes || (newRes as Reservation);
                    const existingCust = getExistingCustomer(resToUse);
                    if (existingCust) {
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            if (!resToUse.customerName) {
                              toast.error(language === 'pt' ? "Por favor, preencha o nome primeiro" : "Please fill in the name first");
                              return;
                            }
                            handleOpenSaveAsCustomer(resToUse);
                          }}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-lg transition-all"
                        >
                          <Edit2 size={14} />
                          {language === 'pt' ? 'Editar Cliente' : 'Edit Customer'}
                        </button>
                      );
                    }
                    return (
                      <button
                        type="button"
                        onClick={() => {
                          if (!resToUse.customerName) {
                            toast.error(language === 'pt' ? "Por favor, preencha o nome primeiro" : "Please fill in the name first");
                            return;
                          }
                          handleOpenSaveAsCustomer(resToUse);
                        }}
                        className="text-xs text-amber-600 hover:text-amber-700 font-bold flex items-center gap-1 bg-amber-50 px-2 py-1 rounded-lg transition-all"
                      >
                        <UserPlus size={14} />
                        {language === 'pt' ? 'Adicionar Novo Cliente' : 'Add New Customer'}
                      </button>
                    );
                  })()}
                </div>
                {editingRes && (
                  <div className="flex gap-4">
                    {editingRes.bookingNumber && settings?.enableBookingNumber !== false && (
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          {language === 'pt' ? 'Número da Reserva' : 'Booking Number'}
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            readOnly
                            value={editingRes.bookingNumber}
                            className="flex-grow px-4 py-2 border border-gray-200 rounded-xl bg-gray-50 text-gray-500 font-mono font-bold outline-none cursor-not-allowed"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(editingRes.bookingNumber || '');
                              setCopied(true);
                              setTimeout(() => setCopied(false), 2000);
                              toast.success(language === 'pt' ? 'Número da reserva copiado!' : 'Booking number copied!');
                            }}
                            className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 text-gray-500 hover:text-amber-600 transition-colors cursor-pointer"
                            title={language === 'pt' ? 'Copiar' : 'Copy'}
                          >
                            {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
                    <input 
                      required
                      type="text"
                      list="customer-names"
                      maxLength={50}
                      value={editingRes ? editingRes.customerName : newRes.customerName}
                      onChange={(e) => {
                        const name = e.target.value;
                        const customer = customers.find(c => c.name === name);
                        if (editingRes) {
                          setEditingRes({ 
                            ...editingRes, 
                            customerName: name,
                            customerPhone: customer ? customer.phone : editingRes.customerPhone,
                            customerEmail: customer ? customer.email : editingRes.customerEmail,
                            language: customer ? (customer.language || 'en') : editingRes.language
                          });
                        } else {
                          setNewRes({ 
                            ...newRes, 
                            customerName: name,
                            customerPhone: customer ? customer.phone : newRes.customerPhone,
                            customerEmail: customer ? customer.email : newRes.customerEmail,
                            language: customer ? (customer.language || 'en') : newRes.language
                          });
                        }
                      }}
                      onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                    <datalist id="customer-names">
                      {customers.map((c, i) => (
                        <option key={i} value={c.name} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.email')}</label>
                    <input 
                      type="email"
                      maxLength={100}
                      value={editingRes ? editingRes.customerEmail : newRes.customerEmail}
                      onChange={(e) => editingRes ? setEditingRes({ ...editingRes, customerEmail: e.target.value as 'pt' | 'en'
    }) : setNewRes({ ...newRes, customerEmail: e.target.value as 'pt' | 'en'
    })}
                      onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                </div>
                <div className="md:w-1/2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone')}</label>
                  <div className="w-full px-4 py-1.5 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-amber-500 bg-white">
                    <PhoneInput
                      defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                      value={editingRes ? editingRes.customerPhone : newRes.customerPhone}
                      onChange={(val) => editingRes ? setEditingRes({ ...editingRes, customerPhone: val || '' }) : setNewRes({ ...newRes, customerPhone: val || '' })}
                      className="w-full text-sm outline-none text-gray-900"
                    />
                  </div>
                </div>

                {!editingRes && (
                  <div className="mt-4 flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveNewCustomer"
                      checked={saveNewCustomer}
                      onChange={(e) => setSaveNewCustomer(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 w-4 h-4 border-gray-300"
                    />
                    <label htmlFor="saveNewCustomer" className="text-sm font-medium text-gray-700">
                      {t('customers.save_as_customer')}
                    </label>
                  </div>
                )}


              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-400 uppercase text-xs tracking-widest">{t('public.select_date')}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.date')}</label>
                    <DatePicker
                      value={dayjs(editingRes ? editingRes.date : newRes.date, 'YYYY-MM-DD')}
                      format="DD/MM/YYYY"
                      onChange={(newValue) => {
                        if (newValue) {
                          const formattedDate = newValue.format('YYYY-MM-DD');
                          if (editingRes) {
                            setEditingRes({ ...editingRes, date: formattedDate });
                          } else {
                            setNewRes({ ...newRes, date: formattedDate });
                          }
                        }
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          sx: { 
                            '& .MuiInputBase-root': { 
                              borderRadius: '0.75rem',
                              fontSize: '0.875rem',
                            }
                          }
                        }
                      }}
                    />
                    {editingRes && editingRes.source !== 'public' && (
                      <div className="mt-2">
                        <label className="block text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-1">
                          {language === 'pt' ? 'Criada por' : 'Created by'}
                        </label>
                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-md border border-rose-100 w-1/2">
                          <User size={12} className="text-rose-500" />
                          <span>
                            Staff #{editingRes.bookedByStaffNumber || '001'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.time')}</label>
                    <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                      ampm={settings?.timeFormat === '12h'}
                      format={settings?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                      minutesStep={settings?.reservationInterval || 30}
                      value={dayjs(editingRes ? editingRes.time : newRes.time, 'HH:mm')}
                      onChange={(newValue) => {
                        if (newValue) {
                          const formattedTime = newValue.format('HH:mm');
                          if (editingRes) {
                            setEditingRes({ ...editingRes, time: formattedTime });
                          } else {
                            setNewRes({ ...newRes, time: formattedTime });
                          }
                        }
                      }}
                      slotProps={{
                        textField: {
                          fullWidth: true,
                          size: 'small',
                          required: true,
                          sx: {
                            '& .MuiOutlinedInput-root': {
                              borderRadius: '0.75rem',
                              backgroundColor: 'white',
                              '& fieldset': {
                                borderColor: '#e5e7eb',
                              },
                              '&:hover fieldset': {
                                borderColor: '#d1d5db',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#d97706',
                              },
                            },
                          }
                        }
                      }}
                    />
                    <div className="flex flex-col gap-1 mt-2">
                      {sessions.lunchTimes?.close && (
                        <label className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          <input 
                            type="checkbox" 
                            checked={(editingRes ? editingRes.manualSession : newRes.manualSession) === 'lunch'}
                            onChange={(e) => {
                              const val = e.target.checked ? 'lunch' : undefined;
                              editingRes ? setEditingRes({ ...editingRes, manualSession: val }) : setNewRes({ ...newRes, manualSession: val });
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3 border-gray-300"
                          />
                          {language === 'pt' ? `Aceitar Almoço (após as ${sessions.lunchTimes.close}H)` : `Accept as Lunch (after ${sessions.lunchTimes.close}H)`}
                        </label>
                      )}
                      {sessions.dinnerTimes?.close && (
                        <label className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                          <input 
                            type="checkbox" 
                            checked={(editingRes ? editingRes.manualSession : newRes.manualSession) === 'dinner'}
                            onChange={(e) => {
                              const val = e.target.checked ? 'dinner' : undefined;
                              editingRes ? setEditingRes({ ...editingRes, manualSession: val }) : setNewRes({ ...newRes, manualSession: val });
                            }}
                            className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3 border-gray-300"
                          />
                          {language === 'pt' ? `Aceitar Jantar (após as ${sessions.dinnerTimes.close}H)` : `Accept as Dinner (after ${sessions.dinnerTimes.close}H)`}
                        </label>
                      )}
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.guests')}</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      value={editingRes ? editingRes.guests : newRes.guests}
                      onChange={(e) => editingRes ? setEditingRes({ ...editingRes, guests: parseInt(e.target.value) }) : setNewRes({ ...newRes, guests: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
                    />
                  </div>
                  <div className="col-span-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.table')}</label>
                    <div className="relative" ref={tableDropdownContainerRef}>
                      <button 
                        type="button"
                        className={cn(
                          "w-full px-3.5 py-2.5 border rounded-xl font-medium shadow-xs transition-all cursor-pointer flex justify-between items-center bg-white text-sm outline-none",
                          isTableDropdownOpen
                            ? "border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10 text-gray-900"
                            : "border-gray-200 text-gray-800 hover:border-gray-300 hover:bg-gray-50/80"
                        )}
                        onClick={() => setIsTableDropdownOpen(!isTableDropdownOpen)}
                      >
                        {(() => {
                          const tableId = editingRes ? editingRes.tableId : newRes.tableId;
                          if (tableId === 'auto') return <span className="font-semibold text-gray-800">{t('res.auto_assign') || "Auto-assign Table"}</span>;
                          if (tableId === 'none' || !tableId) return <span className="text-gray-500">{t('res.no_table_assign') || "No Table Assignment"}</span>;
                          const table = availableTables.find(t => t.id === tableId) || tables.find(t => t.id === tableId);
                          if (!table) return <span className="text-gray-500">{t('res.unassigned')}</span>;
                          const areaName = areas.find(a => a.id === table.areaId)?.name;
                          const shapeMapPt: Record<string, string> = { square: 'Quadrada', round: 'Redonda', rectangular: 'Retangular', rectangle: 'Retângulo' };
                          const shapeMapEn: Record<string, string> = { square: 'Square', round: 'Round', rectangular: 'Rectangle', rectangle: 'Rectangle' };
                          const shapeKey = table.shape || 'square';
                          const shapeStr = language === 'pt' ? (shapeMapPt[shapeKey] || shapeKey) : (shapeMapEn[shapeKey] || shapeKey);
                          const targetDate = editingRes ? editingRes.date : newRes.date;
                          const targetTime = editingRes ? editingRes.time : newRes.time;
                          const manualSession = editingRes ? editingRes.manualSession : newRes.manualSession;
                          const sessionKey = getSessionFromTime(targetTime, targetDate, manualSession);
                          const tableDisplayInfo = getTableDisplayForDropdown(table, targetDate, sessionKey, tables);
                          const displayTableName = tableDisplayInfo.name || getReservationTableDisplay({ tableId: table.id, date: targetDate, time: targetTime, manualSession }, tables, language as any, settings);
                          const totalSeats = tableDisplayInfo.seats || Number(table.seats);
                          return (
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-green-500 text-white rounded-md text-xs font-bold shadow-xs truncate max-w-[150px]">{displayTableName}</span>
                              <span className="text-sm font-medium text-gray-700">({totalSeats} {t('common.guests')}){areaName ? ` [${areaName}]` : ''} - {shapeStr}</span>
                            </div>
                          );
                        })()}
                        <ChevronDown size={16} className={cn("text-gray-400 transition-transform duration-200", isTableDropdownOpen && "rotate-180 text-amber-600")} />
                      </button>
                      
                      {isTableDropdownOpen && (
                        <div className="absolute top-[calc(100%+6px)] left-0 w-full bg-white border border-gray-100 rounded-2xl shadow-xl z-[150] max-h-64 overflow-y-auto py-1.5 animate-in fade-in slide-in-from-top-2 duration-150 custom-scrollbar">
                          <div 
                            className="px-3.5 py-2 hover:bg-amber-50/70 hover:text-amber-900 cursor-pointer text-sm font-semibold transition-colors flex items-center gap-2"
                            onClick={() => {
                              const val = 'auto';
                              if (editingRes) {
                                if (editingRes.isWaitlist) {
                                  setEditingRes({ ...editingRes, tableId: val, isWaitlist: false, status: 'booked' });
                                } else {
                                  setEditingRes({ ...editingRes, tableId: val });
                                }
                              } else {
                                if (newRes.isWaitlist) {
                                  setNewRes({ ...newRes, tableId: val, isWaitlist: false, status: 'booked' });
                                } else {
                                  setNewRes({ ...newRes, tableId: val });
                                }
                              }
                              setIsTableDropdownOpen(false);
                            }}
                          >
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            {t('res.auto_assign') || "Auto-assign Table"}
                          </div>
                          <div 
                            className="px-3.5 py-2 hover:bg-amber-50/70 hover:text-amber-900 cursor-pointer text-sm font-semibold border-t border-gray-50 transition-colors flex items-center gap-2"
                            onClick={() => {
                              const val = 'none';
                              if (editingRes) {
                                if (editingRes.isWaitlist) {
                                  setEditingRes({ ...editingRes, tableId: val, isWaitlist: false, status: 'booked' });
                                } else {
                                  setEditingRes({ ...editingRes, tableId: val });
                                }
                              } else {
                                if (newRes.isWaitlist) {
                                  setNewRes({ ...newRes, tableId: val, isWaitlist: false, status: 'booked' });
                                } else {
                                  setNewRes({ ...newRes, tableId: val });
                                }
                              }
                              setIsTableDropdownOpen(false);
                            }}
                          >
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            {t('res.no_table_assign') || "No Table Assignment"}
                          </div>
                          {(() => {
                            const targetDate = editingRes ? editingRes.date : newRes.date;
                            const targetTime = editingRes ? editingRes.time : newRes.time;
                            const manualSession = editingRes ? editingRes.manualSession : newRes.manualSession;
                            const sessionKey = getSessionFromTime(targetTime, targetDate, manualSession);
                            const currentResId = editingRes ? editingRes.id : undefined;

                            const grouped = availableTables.reduce((acc: Record<string, typeof availableTables>, table) => {
                              const area = areas.find(a => a.id === table.areaId);
                              const areaName = area?.name || 'Outras';
                              if (!acc[areaName]) acc[areaName] = [];
                              acc[areaName].push(table);
                              return acc;
                            }, {} as Record<string, typeof availableTables>);
                            
                            return Object.entries(grouped).map(([areaName, areaTables]) => {
                              const area = areas.find(a => a.name === areaName);
                              const isAreaFullyClosed = area && (
                                (area.bookingMode === 'closed' && (!sessionKey || area.closedSessions?.includes(sessionKey as any)) && (!area.closedStartDate || targetDate >= area.closedStartDate) && (!area.closedEndDate || targetDate <= area.closedEndDate)) || 
                                area.bookingMode === 'permanently_closed' || 
                                (area.allowOnlineReservations === false && area.bookingMode !== 'manual' && area.bookingMode !== 'closed' && (area.bookingMode as string) !== 'permanently_closed')
                              );
                              const isSessionClosed = area && !isAreaFullyClosed && (
                                (area.sessionMode === 'lunch' && sessionKey === 'dinner') ||
                                (area.sessionMode === 'dinner' && sessionKey === 'lunch')
                              );
                              const isAreaClosed = isAreaFullyClosed || isSessionClosed;

                              return (
                              <div key={areaName}>
                                <div className="px-3.5 py-1.5 bg-gray-50/90 text-[11px] font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5 border-y border-gray-100">
                                  <LayoutGrid size={12} className="text-gray-400" /> {areaName}
                                </div>
                                {areaTables.map(table => {
                                  const tableDisplayInfo = getTableDisplayForDropdown(table, targetDate, sessionKey, tables);
                                  
                                  if (tableDisplayInfo.isJoined && tableDisplayInfo.joinedIds.length > 1) {
                                    const groupTables = tableDisplayInfo.joinedIds
                                      .map(id => tables.find(t => t.id === id))
                                      .filter(Boolean) as typeof tables;
                                    groupTables.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
                                    const primaryTable = groupTables[0];
                                    if (primaryTable && table.id !== primaryTable.id) {
                                      return null;
                                    }
                                  }

                                  const shapeMapPt: Record<string, string> = { square: 'Quadrada', round: 'Redonda', rectangular: 'Retangular', rectangle: 'Retângulo' };
                                  const shapeMapEn: Record<string, string> = { square: 'Square', round: 'Round', rectangular: 'Rectangle', rectangle: 'Rectangle' };
                                  const shapeKey = table.shape || 'square';
                                  const shapeStr = language === 'pt' ? (shapeMapPt[shapeKey] || shapeKey) : (shapeMapEn[shapeKey] || shapeKey);
                                  
                                  const isTableBlocked = table.blockedDates?.[targetDate]?.[sessionKey] || table.blockedDates?.[targetDate]?.default || table.isBlocked || isAreaClosed;
                                  const joinGroupIds = tableDisplayInfo.joinedIds;
                                  const tableBookingsList = reservations.filter(r => r.date === targetDate && r.tableId && joinGroupIds.includes(r.tableId) && r.status !== 'cancelled' && r.status !== 'blocked' && r.id !== currentResId && getSessionFromTime(r.time, r.date, r.manualSession) === sessionKey);
                                  const tableBookingsCount = tableBookingsList.length;
                                  const circleColor = isTableBlocked ? 'bg-red-500' : (tableBookingsCount === 0 ? 'bg-green-500' : (tableBookingsCount === 1 ? 'bg-yellow-500' : 'bg-red-500'));
                                  const bookingTimes = tableBookingsList.map(r => r.time).sort().join(' / ');

                                  return (
                                    <div 
                                      key={table.id}
                                      className="px-3.5 py-2 hover:bg-amber-50/70 hover:text-amber-900 cursor-pointer flex items-center justify-between text-sm border-t border-gray-50/80 transition-colors"
                                      onClick={() => {
                                        const val = table.id;
                                        if (editingRes) {
                                          if (editingRes.isWaitlist) {
                                            setEditingRes({ ...editingRes, tableId: val, isWaitlist: false, status: 'booked' });
                                          } else {
                                            setEditingRes({ ...editingRes, tableId: val });
                                          }
                                        } else {
                                          if (newRes.isWaitlist) {
                                            setNewRes({ ...newRes, tableId: val, isWaitlist: false, status: 'booked' });
                                          } else {
                                            setNewRes({ ...newRes, tableId: val });
                                          }
                                        }
                                        setIsTableDropdownOpen(false);
                                      }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 bg-green-500 text-white rounded-md text-xs font-bold shadow-xs">{tableDisplayInfo.name}</span>
                                        <span className="text-gray-700 font-medium">({tableDisplayInfo.seats} {t('common.guests')}) - {shapeStr}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {bookingTimes && (
                                          <span className="px-1.5 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold">
                                            {bookingTimes}
                                          </span>
                                        )}
                                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${circleColor}`} />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              );
                            });
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row md:items-end gap-6">
                  <div className="flex-1">
                    <CustomDropdown
                      label={t('common.status')}
                      value={editingRes ? editingRes.status : newRes.status}
                      onChange={(val) => {
                        const newStatus = val as Reservation['status'];
                        const updates: Partial<Reservation> = { status: newStatus };
                        if (newStatus === 'waiting-list') {
                          updates.isWaitlist = true;
                          updates.tableId = "";
                        } else if ((editingRes && editingRes.status === 'waiting-list') || (!editingRes && newRes.status === 'waiting-list')) {
                          updates.isWaitlist = false;
                        }

                        if (editingRes) {
                          setEditingRes({ ...editingRes, ...updates });
                        } else {
                          setNewRes({ ...newRes, ...updates });
                        }
                      }}
                      options={reservationStatusOptions}
                    />
                  </div>

                <div className="flex flex-row items-center gap-8 pt-2">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingRes ? (editingRes.isWaitlist || false) : (newRes.isWaitlist || false)}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          if (editingRes) {
                            setEditingRes({ 
                              ...editingRes, 
                              isWaitlist: isChecked,
                              status: (isChecked ? 'waiting-list' : (editingRes.status === 'waiting-list' ? 'booked' : editingRes.status)) as Reservation['status'],
                              tableId: isChecked ? "" : editingRes.tableId
                            });
                          } else {
                            setNewRes({ 
                              ...newRes, 
                              isWaitlist: isChecked,
                              status: (isChecked ? 'waiting-list' : (newRes.status === 'waiting-list' ? 'booked' : newRes.status)) as Reservation['status'],
                              tableId: isChecked ? "" : newRes.tableId
                            });
                          }
                        }}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                    </label>
                    <span className="text-sm font-bold text-gray-700">{t('res.waitlist')}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={editingRes ? !editingRes.verifyTableNumber : !newRes.verifyTableNumber}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          if (editingRes) {
                            setEditingRes({ 
                              ...editingRes, 
                              verifyTableNumber: !isChecked
                            });
                          } else {
                            setNewRes({ 
                              ...newRes, 
                              verifyTableNumber: !isChecked
                            });
                          }
                        }}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                    <span className="text-sm font-bold text-gray-700">{language === 'pt' ? 'Mesa Verificada' : 'Table Verified'}</span>
                  </div>
                </div>
                </div>
              </div>

              {editingRes && (
                <div className="md:col-span-2">
                  <button 
                    type="button"
                    onClick={() => setIsEmailStatusOpen(!isEmailStatusOpen)} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 cursor-pointer font-bold text-gray-800 text-sm flex justify-between items-center transition-colors hover:bg-gray-100 relative z-10"
                  >
                    {language === 'pt' ? 'Estado do Email' : 'Email Status'}
                    <ChevronDown size={18} className={`text-gray-500 transition-transform ${isEmailStatusOpen ? 'rotate-180' : ''}`} />
                  </button>
                  <div className={`grid transition-all duration-300 ease-in-out ${isEmailStatusOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="overflow-hidden">
                      <div className="border border-gray-200 border-t-0 rounded-b-xl p-4 -mt-2 pt-6 bg-white grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shadow-inner">
                        <div className="sm:col-span-2 mb-2 pb-3 border-b border-gray-100 flex items-center justify-between">
                          <span className="font-medium text-gray-700">{language === 'pt' ? 'Idioma preferido do cliente' : 'Email Language'}</span>
                          <div className="flex bg-gray-100 p-1 rounded-lg">
                            <button
                              type="button"
                              onClick={() => setEditingRes({ ...editingRes, language: 'pt' })}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${editingRes.language === 'pt' ? 'bg-white shadow text-amber-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >PT</button>
                            <button
                              type="button"
                              onClick={() => setEditingRes({ ...editingRes, language: 'en' })}
                              className={`px-3 py-1 text-xs rounded-md transition-colors ${editingRes.language !== 'pt' ? 'bg-white shadow text-amber-600 font-bold' : 'text-gray-500 hover:text-gray-700'}`}
                            >EN</button>
                          </div>
                        </div>
                        <div>
                      <div className="font-medium text-gray-600 mb-1">{language === 'pt' ? 'Email de Confirmação' : 'Confirmation Email'}</div>
                      <div className="flex items-center gap-2">
                        {editingRes.confirmationEmail?.sent ? (
                          <span className="text-green-600 flex items-center gap-1 font-semibold"><CheckCircle size={14} /> {language === 'pt' ? 'Enviado' : 'Sent'}</span>
                        ) : editingRes.confirmationEmail?.failed ? (
                          <span className="text-red-600 flex items-center gap-1 font-semibold"><AlertCircle size={14} /> {language === 'pt' ? 'Falhou o Envio' : 'Failed to Send'}</span>
                        ) : (
                          <span className="text-gray-500">{language === 'pt' ? 'Não Enviado' : 'Not Sent'}</span>
                        )}
                        {!editingRes.confirmationEmail?.sent && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); handleResendConfirmation(editingRes); }}
                            className="text-amber-600 font-bold hover:underline"
                          >
                            {editingRes.confirmationEmail?.failed ? (language === 'pt' ? 'Tentar Novamente' : 'Retry') : (language === 'pt' ? 'Enviar' : 'Send')}
                          </button>
                        )}
                      </div>
                      {editingRes.confirmationEmail?.failed && editingRes.confirmationEmail?.error && (
                        <div className="text-red-600 text-[11px] mt-1.5 bg-red-50 p-2 rounded-lg border border-red-100 font-medium leading-tight">
                          {editingRes.confirmationEmail.error}
                        </div>
                      )}
                      {editingRes.confirmationEmail?.sentAt && (
                        <div className="text-gray-400 mt-1">{new Date(editingRes.confirmationEmail.sentAt).toLocaleString()}</div>
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-600 mb-1">{language === 'pt' ? 'Email de Lembrete' : 'Reminder Email'}</div>
                      <div className="flex items-center gap-2">
                        {editingRes.reminderEmail?.sent ? (
                          <span className="text-green-600 flex items-center gap-1"><CheckCircle size={14} /> {language === 'pt' ? 'Enviado' : 'Sent'}</span>
                        ) : (editingRes.source === 'public' || settings?.autoSendManualReservationsEmails) ? (
                          <span className="text-amber-600 flex items-center gap-1"><Clock size={14} /> {language === 'pt' ? 'Agendado' : 'Scheduled'}</span>
                        ) : (
                          <span className="text-gray-600 flex items-center gap-1 font-medium"><User size={14} className="text-gray-500" /> {language === 'pt' ? 'Manual' : 'Manual'}</span>
                        )}
                        {!editingRes.reminderEmail?.sent && (
                          <button 
                            type="button" 
                            onClick={(e) => { e.preventDefault(); handleSendReminderNow(editingRes); }}
                            className="text-amber-600 hover:underline"
                          >
                            {language === 'pt' ? 'Enviar Agora' : 'Send Now'}
                          </button>
                        )}
                      </div>
                      {(editingRes.source === 'public' || settings?.autoSendManualReservationsEmails) && editingRes.reminderEmail?.scheduledFor && !editingRes.reminderEmail?.sent && (
                        <div className="text-gray-500 mt-1">{language === 'pt' ? 'Agendado para:' : 'Scheduled for:'} {new Date(editingRes.reminderEmail.scheduledFor).toLocaleString()}</div>
                      )}
                      {editingRes.reminderEmail?.sentAt && (
                        <div className="text-gray-400 mt-1">{language === 'pt' ? 'Enviado a:' : 'Sent at:'} {new Date(editingRes.reminderEmail.sentAt).toLocaleString()}</div>
                      )}
                    </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
                <textarea 
                  value={editingRes ? editingRes.notes : newRes.notes}
                  onChange={(e) => editingRes ? setEditingRes({ ...editingRes, notes: e.target.value as 'pt' | 'en'
    }) : setNewRes({ ...newRes, notes: e.target.value as 'pt' | 'en'
    })}
                  onKeyDown={(e) => handleKeyDown(e, 90, t('common.notes'))}
                  rows={3}
                  maxLength={90}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none"
                />
              </div>

              {formConflict && (
                <div className="md:col-span-2 bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3 items-start">
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="font-bold text-red-800 text-sm">{t('res.conflict_title') || 'Time Conflict!'}</h5>
                    <p className="text-xs text-red-700 mt-1">
                      {(t('res.conflict_desc') || 'This assignment overlaps with an existing booking for {name} at {time}. The required gap between bookings is {gap}.')
                        .replace('{name}', formConflict.customerName)
                        .replace('{time}', formatDisplayTime(formConflict.time, settings))
                        .replace('{gap}', (() => {
                          const gapMinutes = settings?.minReservationGap || 135;
                          const h = Math.floor(gapMinutes / 60);
                          const m = gapMinutes % 60;
                          if (language === 'pt') {
                            if (m === 0) return h + ' horas';
                            return h + ' horas e ' + m + ' minutos';
                          } else {
                            if (m === 0) return h + ' hours';
                            return h + ' hours and ' + m + ' minutes';
                          }
                        })())}
                    </p>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting}
                className="md:col-span-2 w-full bg-amber-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('common.loading')}
                  </>
                ) : (
                  editingRes ? t('common.save') : (t('res.book_table') || (language === 'pt' ? 'Reservar Mesa' : 'Book a Table'))
                )}
              </button>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* Save as Customer Modal */}
      {showAddCustomerModal && (
        <div id="save-customer-modal-overlay" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4 overflow-y-auto">
          <div id="save-customer-modal-container" className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl my-8">
            <div className="flex justify-between items-center mb-6">
              <h3 id="save-customer-modal-title" className="text-2xl font-bold text-gray-900">
                {editingCustomerFromRes ? t('customers.edit_details') : t('customers.save_as_customer')}
              </h3>
              <button 
                id="save-customer-modal-close-btn"
                onClick={() => {
                  setShowAddCustomerModal(false);
                  setEditingCustomerFromRes(null);
                }} 
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form id="save-customer-modal-form" onSubmit={handleAddCustomerSubmit} className="space-y-4">
              <div>
                <label id="lbl-customer-name" className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')}</label>
                <input 
                  id="input-customer-name"
                  required
                  type="text"
                  maxLength={50}
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value as 'pt' | 'en'
    })}
                  onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-gray-900"
                />
              </div>

              <div>
                <label id="lbl-customer-phone" className="block text-sm font-medium text-gray-700 mb-1">{t('common.phone') || 'Phone'}</label>
                <div id="input-customer-phone-container" className="w-full px-4 py-2.5 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-amber-500 bg-white">
                  <PhoneInput
                    defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                    value={customerForm.phone}
                    onChange={(val) => setCustomerForm({ ...customerForm, phone: val || '' })}
                    className="w-full text-sm outline-none text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label id="lbl-customer-email" className="block text-sm font-medium text-gray-700 mb-1">{t('common.email') || 'Email'}</label>
                <input 
                  id="input-customer-email"
                  type="email"
                  maxLength={100}
                  value={customerForm.email}
                  onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value as 'pt' | 'en'
    })}
                  onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-gray-900"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label id="lbl-customer-notes" className="block text-sm font-medium text-gray-700">{t('common.notes')}</label>
                  
                  {/* Regular Customer Checkbox */}
                  <div className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      id="modal-isRegular"
                      checked={customerForm.isRegular}
                      onChange={(e) => {
                        setCustomerForm({ ...customerForm, isRegular: e.target.checked });
                      }}
                      className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded"
                    />
                    <label htmlFor="modal-isRegular" className="text-xs font-medium text-gray-500 select-none">
                      {language === 'en' ? 'Regular' : 'Regular'}
                    </label>
                  </div>
                </div>
                <textarea 
                  id="input-customer-notes"
                  value={customerForm.notes}
                  onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value as 'pt' | 'en'
    })}
                  onKeyDown={(e) => handleKeyDown(e, 300, t('common.notes'))}
                  rows={3}
                  maxLength={300}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none resize-none text-gray-900"
                />
              </div>

              {/* Favorite Tables Management */}
              <div className="border-t border-gray-100 pt-4 mt-4 space-y-3">
                <label className="block text-sm font-bold text-gray-700">
                  {language === 'en' ? 'Favorite Tables (Choice Priority)' : 'Mesas Favoritas (Ordem de Escolha)'}
                </label>
                
                {/* List current choices */}
                {(customerForm.favoriteTables || []).length > 0 && (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {(customerForm.favoriteTables || []).map((tableId, index) => {
                      const tbl = tables.find(t => t.id === tableId);
                      return (
                        <div key={tableId} className="flex items-center justify-between bg-gray-50 border border-gray-100 p-2 rounded-lg text-xs">
                          <span className="flex items-center gap-2">
                            <span className="w-5 h-5 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-bold text-[10px]">
                              {index + 1}
                            </span>
                            <span className="font-semibold text-gray-800">
                              {tbl ? tbl.name : tableId}
                            </span>
                            <span className="text-gray-400">
                              ({tbl ? `${tbl.seats} ${t('common.seats') || 'seats'}` : ''})
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeFavoriteTable(tableId)}
                            className="text-[10px] text-red-500 hover:text-red-700 font-semibold px-1.5 py-0.5 rounded hover:bg-red-50"
                          >
                            {t('common.remove') || 'Remove'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Dropdown to add next choice */}
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <CustomDropdown
                      size="sm"
                      value={selectedTableToAdd}
                      onChange={(val) => setSelectedTableToAdd(val)}
                      placeholder={language === 'en' ? '-- Select Table to Add --' : '-- Escolha a Mesa para Adicionar --'}
                      options={[
                        { value: '', label: language === 'en' ? '-- Select Table to Add --' : '-- Escolha a Mesa para Adicionar --' },
                        ...tables
                          .filter(tbl => !(customerForm.favoriteTables || []).includes(tbl.id))
                          .map(tbl => ({
                            value: tbl.id,
                            label: `${tbl.name} (${tbl.seats} ${t('common.seats') || 'seats'})`
                          }))
                      ]}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedTableToAdd) {
                        addFavoriteTable(selectedTableToAdd);
                        setSelectedTableToAdd('');
                      }
                    }}
                    disabled={!selectedTableToAdd}
                    className="px-3.5 py-2 bg-amber-50 text-amber-700 border border-amber-200 rounded-xl text-xs font-semibold hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 shadow-xs cursor-pointer"
                  >
                    + {language === 'en' ? 'Add' : 'Adicionar'}
                  </button>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  id="save-customer-modal-cancel-btn"
                  type="button"
                  onClick={() => {
                    setShowAddCustomerModal(false);
                    setEditingCustomerFromRes(null);
                  }}
                  className="flex-1 px-6 py-3 border border-gray-200 rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  {t('common.cancel') || 'Cancel'}
                </button>
                <button 
                  id="save-customer-modal-save-btn"
                  type="submit"
                  className="flex-1 px-6 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-100"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Overlap Warning Modal */}
      {resOverlapWarning && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border-4 border-amber-400">
            <div className="flex items-center gap-4 mb-6 text-amber-600">
              <Clock size={40} />
              <h3 className="text-2xl font-bold">{t('res.conflict_title') || 'Time Conflict!'}</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              {(t('res.conflict_desc') || 'This assignment overlaps with an existing booking for {name} at {time}. The required gap between bookings is {gap}.')
                .replace('{name}', resOverlapWarning.conflictingRes.customerName)
                .replace('{time}', formatDisplayTime(resOverlapWarning.conflictingRes.time, settings))
                .replace('{gap}', (() => {
                  const gapMinutes = settings?.minReservationGap || 135;
                  const h = Math.floor(gapMinutes / 60);
                  const m = gapMinutes % 60;
                  if (language === 'pt') {
                    if (m === 0) return h + ' horas';
                    return h + ' horas e ' + m + ' minutos';
                  } else {
                    if (m === 0) return h + ' hours';
                    return h + ' hours and ' + m + ' minutes';
                  }
                })())}
            </p>

            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  if (resOverlapWarning.isEdit) {
                    executeUpdateReservation(resOverlapWarning.resData);
                  } else {
                    executeAddReservation(resOverlapWarning.resData);
                  }
                }}
                className="w-full bg-amber-600 text-white py-4 rounded-2xl font-bold hover:bg-amber-700 transition-colors"
              >
                {t('res.assign_anyway') || 'Assign Anyway'}
              </button>
              <button 
                onClick={() => setResOverlapWarning(null)}
                className="w-full bg-gray-100 border border-gray-200 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel') || 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmationDialog />
    </div>
  );
}

const ReservationCard: React.FC<{ 
  res: Reservation, 
  tables: any[], 
  areas?: any[],
  onUpdateStatus: (id: string, status: Reservation['status']) => void,
  onEdit: (res: Reservation) => void,
  onDelete: (id: string) => void,
  onSaveAsCustomer?: (res: Reservation) => void,
  isSelected?: boolean,
  checkReservationOverlap?: (id: string | undefined, tableId: string, date: string, time: string,
    manualSession?: 'lunch' | 'dinner') => any
}> = ({ res, tables, areas = [], onUpdateStatus, onEdit, onDelete, onSaveAsCustomer, isSelected, checkReservationOverlap }) => {
  const { language, t } = useLanguage();
  const { settings } = useSettings();
  const { customers } = useCustomers();
  const navigate = useNavigate();
  const [showContact, setShowContact] = React.useState(false);
  const [showContactActions, setShowContactActions] = React.useState(false);

  const isRegular = !!(res.isRegularCustomer || (customers && res.customerEmail && customers.some(c => 
    c.isRegular && c.email && c.email.trim().toLowerCase() === res.customerEmail.trim().toLowerCase()
  )));
  
  const isCustomerSaved = !!(customers && res.customerEmail && customers.some(c => 
    c.email && c.email.trim().toLowerCase() === res.customerEmail.trim().toLowerCase()
  ));

  return (
    <div className={cn(
      "bg-white rounded-2xl shadow-sm border flex flex-col md:flex-row items-start md:items-center justify-between gap-6 hover:shadow-md",
      !settings?.compactAdminViews && "transition-all duration-300",
      settings?.compactAdminViews ? "py-2.5 px-5" : "py-3.5 px-5",
      isSelected ? "border-amber-500 ring-2 ring-amber-500 ring-opacity-20 shadow-lg scale-[1.01]" : "border-gray-100"
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          "h-12 rounded-xl flex items-center justify-center font-bold text-[14.3px]",
          settings?.timeFormat === '12h' ? "w-[72px]" : "w-12",
          res.status === 'confirmed' ? "bg-green-100 text-green-700" :
          res.status === 'delayed' ? "bg-orange-100 text-orange-700 font-bold" :
          res.status === 'arrived' ? "bg-green-100 text-green-700" :
          res.status === 'no-show' ? "bg-gray-100 text-gray-700" :
          res.status === 'booked' ? "bg-blue-100 text-blue-700" :
          res.status === 'pending' ? "bg-amber-100 text-amber-700" :
          res.status === 'cancelled' ? "bg-red-100 text-red-700" :
          res.status === 'completed' ? "bg-yellow-100 text-yellow-700" :
          res.status === 'waiting-list' ? "bg-gray-100 text-gray-700 font-medium" :
          "bg-gray-100 text-gray-700"
        )}>
          {formatDisplayTime(res.time, settings)}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            {isCustomerSaved ? (
              <button 
                onClick={() => navigate(`/admin/customers?search=${encodeURIComponent(res.customerEmail || res.customerName)}`)}
                className="font-bold text-blue-600 text-lg hover:no-underline transition-colors cursor-pointer text-left focus:outline-none"
              >
                {res.customerName}
              </button>
            ) : (
              <h3 className="font-bold text-gray-900 text-lg">{res.customerName}</h3>
            )}
            {res.bookingNumber && settings?.enableBookingNumber !== false && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 text-[11px] font-mono font-bold rounded-md border border-gray-200 flex items-center gap-1.5">
                {res.bookingNumber}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(res.bookingNumber || '');
                    toast.success(language === 'pt' ? 'Número da reserva copiado!' : 'Booking number copied!');
                  }}
                  className="hover:text-amber-600 p-0.5 rounded transition-colors cursor-pointer"
                  title={language === 'pt' ? 'Copiar' : 'Copy'}
                >
                  <Copy size={11} />
                </button>
              </span>
            )}
            {isRegular && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold uppercase rounded-md border border-amber-200">
                REGULAR
              </span>
            )}
            {res.isWaitlist && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase rounded-md border border-gray-200">
                {t('res.waitlist')}
              </span>
            )}
            {res.verifyTableNumber && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-700 text-[10px] font-bold uppercase rounded-md border border-rose-200 animate-pulse">
                <AlertCircle size={10} strokeWidth={3} />
                {language === 'en' ? 'Verify Table Number' : 'Verificar Mesa'}
              </span>
            )}
            {res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && checkReservationOverlap && (() => {
              const conflict = checkReservationOverlap(res.id, res.tableId, res.date, res.time, res.manualSession);
              return conflict && conflict.status !== 'blocked';
            })() && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-md border border-red-200 animate-pulse animate-duration-1000">
                <AlertTriangle size={10} strokeWidth={3} />
                {language === 'en' ? 'Time Conflict' : 'Conflito de Horário'}
              </span>
            )}
            {!res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status) && (
              <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-md border border-red-200 animate-pulse">
                <Ban size={10} strokeWidth={3} />
                {language === 'pt' ? 'Sem Mesa' : 'No Table'}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500 mt-1">
            <span className="flex items-center gap-1">
              <Users size={14} /> {res.guests} {res.guests === 1 ? (language === 'pt' ? 'pessoa' : 'guest') : (language === 'pt' ? 'pessoas' : 'guests')}
            </span>
            <span className="flex items-center gap-1.5">
              <Phone size={14} />
              <span className={cn(
                "transition-all duration-200",
                !showContact && "blur-[4.5px] select-none pointer-events-none"
              )}>
                {res.customerPhone}
              </span>
            </span>
            {res.customerEmail && (
              <span className="flex items-center gap-1.5">
                <Mail size={14} />
                <span className={cn(
                  "transition-all duration-200",
                  !showContact && "blur-[4.5px] select-none pointer-events-none"
                )}>
                  {res.customerEmail}
                </span>
              </span>
            )}
            <button
              type="button"
              onClick={() => setShowContact(!showContact)}
              className="inline-flex items-center justify-center p-1 rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors ml-1 mr-1"
              title={showContact ? (language === 'pt' ? 'Ocultar Contactos' : 'Hide Contact Details') : (language === 'pt' ? 'Mostrar Contactos' : 'Show Contact Details')}
            >
              {showContact ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <span className="flex items-center gap-1"><Calendar size={14} /> {format(parseISO(res.date), 'dd/MM/yyyy')}</span>
            {res.tableId && (
              <span className="font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1 bg-green-500 text-white border border-green-600 text-xs">
                <TableIcon size={12} className="text-white" />
                <span>{getReservationTableDisplay(res, tables, language as any, settings)}</span>
              </span>
            )}
          </div>
          {res.notes && (
            <div className="mt-2 p-2 bg-amber-50 rounded-lg border border-amber-100 text-xs text-amber-800 italic">
              "{res.notes}"
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
        <div className={cn(
          "px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider",
          res.status === 'confirmed' ? "bg-green-100 text-green-700" :
          res.status === 'delayed' ? "bg-orange-100 text-orange-700" :
          res.status === 'arrived' ? "bg-green-500 text-white shadow-sm" :
          res.status === 'no-show' ? "bg-gray-500 text-white shadow-sm" :
          res.status === 'booked' ? "bg-blue-100 text-blue-700" :
          res.status === 'pending' ? "bg-amber-100 text-amber-700" :
          res.status === 'cancelled' ? "bg-red-500 text-white shadow-sm" :
          res.status === 'completed' ? "bg-yellow-400 text-yellow-900 shadow-sm" :
          res.status === 'waiting-list' ? "bg-gray-100 text-gray-700 shadow-none border border-gray-200" :
          "bg-gray-100 text-gray-700"
        )}>
          {t(`res.${res.status}`)}
        </div>

        <div className="flex items-center gap-0.5 ml-auto">
          {res.status === 'pending' && (
            <button 
              onClick={() => onUpdateStatus(res.id, 'confirmed')}
              className="p-1 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
              title="Confirm"
            >
              <CheckCircle size={15} />
            </button>
          )}
          <button 
            onClick={() => onSaveAsCustomer?.(res)}
            className="p-1 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
            title={t('customers.save_as_customer')}
          >
            <UserPlus size={15} />
          </button>
          <button 
            onClick={() => onEdit(res)}
            className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit"
          >
            <Edit2 size={15} />
          </button>
          <button 
            onClick={() => { onDelete(res.id); }}
            className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 size={15} />
          </button>
          
          <div className="w-px h-4 bg-gray-200 mx-0.5"></div>

          <button
            onClick={() => setShowContactActions(!showContactActions)}
            className={cn(
              "p-1 rounded transition-colors flex items-center justify-center",
              showContactActions ? "text-gray-900 bg-gray-100" : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            )}
            title={language === 'pt' ? "Mais opções" : "More options"}
          >
            <MoreHorizontal size={15} />
          </button>
          
          <AnimatePresence>
            {showContactActions && (
              <motion.div
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 'auto', opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="flex items-center gap-0.5 overflow-hidden whitespace-nowrap origin-left"
              >
                {res.customerEmail ? (
                  <a
                    href={`mailto:${res.customerEmail}`}
                    className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center justify-center no-underline hover:no-underline"
                    title={language === 'pt' ? `Enviar email para ${res.customerName}` : `Send email to ${res.customerName}`}
                  >
                    <Mail size={15} />
                  </a>
                ) : (
                  <span className="p-1 text-gray-300 rounded cursor-not-allowed" title={language === 'pt' ? 'Sem email' : 'No email'}>
                    <Mail size={15} />
                  </span>
                )}

                {res.customerPhone ? (
                  <>
                    <a
                      href={`tel:${res.customerPhone}`}
                      className="p-1 text-amber-600 hover:bg-amber-50 rounded transition-colors flex items-center justify-center no-underline hover:no-underline"
                      title={language === 'pt' ? `Ligar para ${res.customerName}` : `Call ${res.customerName}`}
                    >
                      <Phone size={15} />
                    </a>
                    <WhatsAppButton 
                      phone={res.customerPhone} 
                      customerName={res.customerName}
                      region={settings?.region}
                      defaultCountryCode={settings?.defaultCountryCode}
                      language={language}
                      iconSize={15}
                    />
                  </>
                ) : (
                  <>
                    <span className="p-1 text-gray-300 rounded cursor-not-allowed">
                       <Phone size={15} />
                    </span>
                    <WhatsAppButton 
                       phone={null}
                       language={language}
                       iconSize={15}
                    />
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

const EmptyState: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="text-center py-20 bg-white rounded-3xl border-2 border-dashed border-gray-100">
      <Calendar size={64} className="mx-auto text-gray-200 mb-4" />
      <p className="text-gray-400 text-lg">{message}</p>
    </div>
  );
}
