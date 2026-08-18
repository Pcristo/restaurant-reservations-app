import React, { useMemo, useState, useRef, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import Draggable from 'react-draggable';
import { useTables } from '../hooks/useTables';
import { useReservations } from '../hooks/useReservations';
import { useCustomers } from '../hooks/useCustomers';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { WhatsAppButton } from '../components/WhatsAppButton';
import { useConfirm } from '../hooks/useConfirm';
import { useAuth } from '../hooks/useAuth';
import { useUsers } from '../hooks/useUsers';
import { useNotifications } from '../hooks/useNotifications';
import { format, isToday, parseISO, addHours, subHours, startOfDay, addMinutes, parse, isBefore, isSameDay } from 'date-fns';
import { MoreVertical, Users, Circle, Square, RectangleHorizontal, Clock, CheckCircle, XCircle, Calendar as CalendarIcon, X, ChevronLeft, ChevronRight, Phone, Mail, MessageSquare, Edit, Link, Plus, Eye, EyeOff, Ban, ChevronUp, ChevronDown, AlertTriangle, Maximize2, Minimize2, Sun, Moon, RefreshCw, AlertCircle, Globe, Table as TableIcon, GripVertical, Pencil, Search , Copy, FileText, Sparkles, Printer, Camera } from 'lucide-react';
import { DragDropContext, Droppable, Draggable as DndDraggable } from '@hello-pangea/dnd';
import { cn, getOptimizedUrl, formatDisplayTime, getEffectiveOpeningHours } from '../lib/utils';
import { Table, Reservation } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { TimePicker } from '@mui/x-date-pickers';
import { renderTimeViewClock } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { toast } from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import restaurantFloorPlan from '../assets/restaurant_floor-plan.jpg';
import CronogramaView from '../components/CronogramaView';
import CustomDropdown, { DropdownOption } from '../components/CustomDropdown';
import { triggerPrint } from '../utils/printUtils';
import { takeScreenshot } from '../utils/screenshotUtils';

const cleanTableName = (name: string) => {
  return name.replace(/table\s*/gi, '').replace(/mesa\s*/gi, '').trim();
};

dayjs.extend(customParseFormat);

interface FloorPlanContainerProps {
  sessionKey: string;
  onResize: (key: string, width: number, height: number) => void;
  children: React.ReactNode;
  hasBgImage?: boolean;
}

const FloorPlanContainer: React.FC<FloorPlanContainerProps> = ({ sessionKey, onResize, children, hasBgImage }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        onResize(sessionKey, rect.width || 1000, rect.height || 600);
      }
    });

    observer.observe(el);

    const rect = el.getBoundingClientRect();
    if (rect.width && rect.height) {
      onResize(sessionKey, rect.width, rect.height);
    }

    return () => {
      observer.disconnect();
    };
  }, [sessionKey, onResize]);

  return (
    <div 
      ref={containerRef}
      className={cn(
        "relative min-w-[1000px] h-full floor-plan-canvas-scaler",
        hasBgImage ? "bg-white" : "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"
      )}
    >
      {children}
    </div>
  );
};

export default function AdminLiveView() {
  const { tables, areas = [], loading: tablesLoading, updateTable, updateArea } = useTables();
  const { customers } = useCustomers();
  const { settings, loading: settingsLoading, updateSettings } = useSettings();
  const { t, language } = useLanguage();
  const { confirm, ConfirmationDialog } = useConfirm();
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [showAreaOverrideModal, setShowAreaOverrideModal] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);
  const [editingAreaOverrideId, setEditingAreaOverrideId] = useState<string | null>(null);
  const [editingAreaBookingMode, setEditingAreaBookingMode] = useState<'online' | 'manual' | 'closed' | 'special_event' | 'permanently_closed'>('online');
  const [editingAreaSpecialEventName, setEditingAreaSpecialEventName] = useState('');
  const [editingAreaSpecialEventSessions, setEditingAreaSpecialEventSessions] = useState<('lunch' | 'dinner')[]>(['lunch', 'dinner']);
  const [editingAreaSessionMode, setEditingAreaSessionMode] = useState<'both' | 'lunch' | 'dinner'>('both');
  const [editingAreaClosedSessions, setEditingAreaClosedSessions] = useState<('lunch' | 'dinner')[]>(['lunch', 'dinner']);

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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const urlDate = searchParams.get('date');
  const [selectedDate, setSelectedDate] = useState(urlDate || format(new Date(), 'yyyy-MM-dd'));
  const [viewMode, setViewMode] = useState<'floorplan' | 'cronograma'>('floorplan');
  const { hasNewBookings, newBookingsList, removeNotificationBooking } = useNotifications();

  useEffect(() => {
    if (urlDate) {
      setSelectedDate(urlDate);
    }
  }, [urlDate]);

  const { reservations, loading: resLoading, updateReservation, addReservation } = useReservations({ date: selectedDate });
  const { user: currentUser } = useAuth();
  const { users } = useUsers();

  const currentStaffNumber = useMemo(() => {
    if (!currentUser) return undefined;
    if (currentUser.staffNumber) return currentUser.staffNumber;
    const idx = users.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) return (idx + 1).toString().padStart(3, '0');
    return '001';
  }, [currentUser, users]);

  const [selectedRes, setSelectedRes] = useState<Reservation | null>(null);
  const [showWalkInModal, setShowWalkInModal] = useState<string | null>(null);
  const [showTimeEditModal, setShowTimeEditModal] = useState<string | null>(null);
  const [timeEditSessionType, setTimeEditSessionType] = useState<'lunch' | 'dinner' | undefined>(undefined);
  const [showJoinModal, setShowJoinModal] = useState<string | null>(null);
  const [showNewResModal, setShowNewResModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newResData, setNewResData] = useState({
    name: "",
    email: "",
    phone: "",
    guests: 2,
    time: format(new Date(), 'HH:mm'),
    tableId: "",
    tableName: "",
    notes: "",
    manualSelection: false,
    verifyTableNumber: false,
    language: 'en',
      manualSession: undefined as "lunch" | "dinner" | undefined
  });
  const [joinSessionType, setJoinSessionType] = useState<'lunch' | 'dinner' | undefined>(undefined);
  const [fullscreenSession, setFullscreenSession] = useState<'lunch' | 'dinner' | 'default' | null>(null);
  const [fullscreenTheme, setFullscreenTheme] = useState<'light' | 'dark'>('light');
  const [showFullscreenReservations, setShowFullscreenReservations] = useState(true);
  const [joiningSelectedIds, setJoiningSelectedIds] = useState<string[]>([]);
  const [joiningSeats, setJoiningSeats] = useState<number>(0);
  const [walkInGuests, setWalkInGuests] = useState(2);
  const [sortOrder, setSortOrder] = useState<'time' | 'table'>('time');
  const [searchQuery, setSearchQuery] = useState("");
  const [isUpcomingExpanded, setIsUpcomingExpanded] = useState(true);
  const [walkInName, setWalkInName] = useState("");
  const [walkInPhone, setWalkInPhone] = useState("");
  const [walkInTime, setWalkInTime] = useState(format(new Date(), 'HH:mm'));
  const [draggedAreaId, setDraggedAreaId] = useState<string | null>(null);
  const [defaultToDinner, setDefaultToDinner] = useState(() => localStorage.getItem('defaultToDinner') === 'true');
  const [generalBoxPosition, setGeneralBoxPosition] = useState<'lunch' | 'dinner'>(() => {

    const saved = localStorage.getItem('defaultToDinner') === 'true';
    return saved ? 'dinner' : 'lunch';
  });
  const [overlapWarning, setOverlapWarning] = useState<{
    resId: string;
    tableId: string;
    tableName?: string;
    conflictingRes: Reservation;
    type: 'table' | 'time' | 'walkin';
    newTime?: string;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lunchScrollRef = useRef<HTMLDivElement>(null);
  const dinnerScrollRef = useRef<HTMLDivElement>(null);

  const [floorPlanSizes, setFloorPlanSizes] = useState<Record<string, { width: number; height: number }>>({});
  const [isLaptopOrBelow, setIsLaptopOrBelow] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    setIsLaptopOrBelow(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsLaptopOrBelow(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  const handleFloorPlanResize = React.useCallback((key: string, w: number, h: number) => {
    setFloorPlanSizes((prev) => {
      if (prev[key]?.width === w && prev[key]?.height === h) return prev;
      return { ...prev, [key]: { width: w, height: h } };
    });
  }, []);

  useEffect(() => {
    const scrollRight = (ref: React.RefObject<HTMLDivElement>) => {
      if (ref.current) {
        ref.current.scrollLeft = ref.current.scrollWidth - ref.current.clientWidth;
      }
    };
    if (!tablesLoading && !resLoading) {
      setTimeout(() => {
        scrollRight(lunchScrollRef);
        scrollRight(dinnerScrollRef);
      }, 100);
    }
  }, [tablesLoading, resLoading, selectedDate]);

  useEffect(() => {
    if (showJoinModal) {
      const table = tables.find(t => t.id === showJoinModal);
      if (table) {
        const session = joinSessionType || 'default';
        const currentJoin = table.dailyJoins?.[selectedDate]?.[session as 'lunch' | 'dinner'];
        setJoiningSelectedIds(currentJoin?.joinedTables || []);
        setJoiningSeats(currentJoin?.joinedSeats || table.seats);
      }
    }
  }, [showJoinModal, tables, selectedDate, joinSessionType]);

  const isFirstRender = useRef(true);
  const userClickedArrow = useRef(false);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!userClickedArrow.current) {
      return;
    }
    userClickedArrow.current = false;
    const timer = setTimeout(() => {
      if (generalBoxPosition === 'lunch') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        const navElement = document.getElementById('navbar-top');
        if (navElement) {
          navElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else {
          const topElement = document.getElementById('admin-live-view-top');
          if (topElement) {
            topElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      } else {
        const element = document.getElementById(`floor-plan-${generalBoxPosition}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          const fallback = document.getElementById('upcoming-active-box');
          if (fallback) {
            fallback.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [generalBoxPosition]);

  // Initial load scroll to dinner if default to dinner is checked
  useEffect(() => {
    if (!tablesLoading && !resLoading && defaultToDinner) {
      const timer = setTimeout(() => {
        const element = document.getElementById('floor-plan-dinner');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [tablesLoading, resLoading, defaultToDinner]);

  const filteredReservations = useMemo(() => {
    return reservations.filter(r => r.date === selectedDate);
  }, [reservations, selectedDate]);

  const isClosed = useMemo(() => {
    if (!settings || !selectedDate) return false;
    try {
      const eff = getEffectiveOpeningHours(selectedDate, settings);
      return eff.closed;
    } catch (err) {
      return false;
    }
  }, [selectedDate, settings]);

  const displayReservations = useMemo(() => {
    return filteredReservations.filter(r => r.status !== 'blocked' && r.status !== 'cancelled');
  }, [filteredReservations]);

  const sessions = useMemo(() => {
    if (!settings) return { lunch: false, dinner: false };
    const eff = getEffectiveOpeningHours(selectedDate, settings);

    return {
      lunch: eff.lunch?.active,
      dinner: eff.dinner?.active,
      lunchTimes: eff.lunch,
      dinnerTimes: eff.dinner
    };
  }, [settings, selectedDate]);

  const getSessionFromTime = (time: string, manualSession?: 'lunch' | 'dinner') => {
    if (manualSession) return manualSession;
    if (sessions.lunchTimes && time >= sessions.lunchTimes.open && time <= sessions.lunchTimes.close) {
      return 'lunch';
    }
    if (sessions.dinnerTimes && time >= sessions.dinnerTimes.open && time <= sessions.dinnerTimes.close) {
      return 'dinner';
    }
    const hour = parseInt(time.split(':')[0], 10);
    if (!isNaN(hour)) {
      if (hour >= 11 && hour < 17) return 'lunch';
      if (hour >= 17 || hour < 4) return 'dinner';
    }
    return 'default';
  };

  const getTableStatuses = (resList: Reservation[], session?: 'lunch' | 'dinner') => {
    const now = new Date();
    const statuses: Record<string, { 
      status: 'available' | 'partially-booked' | 'fully-booked', 
      resCount: number,
      isBlocked: boolean,
      activeRes?: Reservation,
      upcomingRes?: Reservation,
      isInactive?: boolean,
      joinedName?: string
    }> = {};

    const processedGroups = new Set<string>();

    tables.forEach(table => {
      const sessionKey = session || 'default';
      const currentJoin = table.dailyJoins?.[selectedDate]?.[sessionKey as 'lunch' | 'dinner'];
      const joinGroup = currentJoin?.joinedTables ? [table.id, ...currentJoin.joinedTables].sort() : [table.id];
      const groupKey = joinGroup.join(',');

      if (processedGroups.has(groupKey)) return;
      processedGroups.add(groupKey);

      const groupTables = joinGroup.map(id => tables.find(t => t.id === id)).filter(Boolean) as Table[];
      const joinedName = groupTables.map(t => t.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('/');
      
      const tableRes = [...resList]
        .filter(r => joinGroup.includes(r.tableId || ''))
        .sort((a, b) => a.time.localeCompare(b.time));
      
      const isBlocked = tableRes.some(r => r.status === 'blocked') || groupTables.some(t => {
        const sessionKey = session || 'default';
        return !!(t.blockedDates?.[selectedDate]?.[sessionKey] || t.blockedDates?.[selectedDate]?.default || t.isBlocked);
      });
      const actualRes = tableRes.filter(r => r.status !== 'blocked' && r.status !== 'cancelled');
      const resCount = actualRes.length;
      
      let status: 'available' | 'partially-booked' | 'fully-booked' | 'inactive' = 'available';
      
      let isActive = groupTables.every(t => {
        if (t.isActive === false) return false;
        if (session && (session === 'lunch' || session === 'dinner') && t.activeSessions && t.activeSessions[session] === false) return false;
        return true;
      });
      let isAvailableForDate = true;
      let sessionSpecificInactive = false;

      // Check availability for all tables in group
      for (const t of groupTables) {
        if (selectedDate) {
          const selDate = parseISO(selectedDate);
          
          // Session specific availability
          if (session) {
            if (t.extraAvailability?.[selectedDate]) {
              if (t.extraAvailability[selectedDate][session] === false) {
                sessionSpecificInactive = true;
              }
            } else if (t.extraSessions) {
              if (t.extraSessions[session] === false) {
                sessionSpecificInactive = true;
              }
            }
          }

          if (t.isExtra) {
            const isAvailableOnDate = (t.availableDate && isSameDay(selDate, parseISO(t.availableDate))) || 
                                     (t.availableDates && t.availableDates.includes(selectedDate));
            
            if (!isAvailableOnDate) {
              sessionSpecificInactive = true;
            }
          } else if (t.availableDate) {
            const availDate = parseISO(t.availableDate);
            if (isBefore(selDate, availDate) && !isSameDay(selDate, availDate)) {
              isAvailableForDate = false;
            }
          }
        }
      }

      if (!isActive || !isAvailableForDate || sessionSpecificInactive) {
        status = 'inactive';
      } else if (isBlocked || resCount >= 2) {
        status = 'fully-booked';
      } else if (resCount === 1) {
        status = 'partially-booked';
      }

      let activeRes: Reservation | undefined;
      let upcomingRes: Reservation | undefined;
      
      if (selectedDate === format(new Date(), 'yyyy-MM-dd')) {
        activeRes = actualRes.find(r => {
          const resTime = parseISO(`${r.date}T${r.time}`);
          const gap = settings?.minReservationGap || 135;
          const endTime = addMinutes(resTime, gap);
          return now >= resTime && now <= endTime;
        });
        
        upcomingRes = actualRes.find(r => {
          const resTime = parseISO(`${r.date}T${r.time}`);
          return resTime > now;
        });
      } else {
        upcomingRes = actualRes[0];
      }
      
      // Assign status to each table in the group individually for color logic
      joinGroup.forEach(id => {
        const tableObj = tables.find(t => t.id === id);
        const tName = tableObj?.name || "";
        
        // Count reservations specifically affecting this physical table
        const tableSpecificRes = actualRes.filter(r => 
          r.tableId === id || 
          (r.tableName && r.tableName.split('/').some(part => part.trim() === tName))
        );
        
        const individualResCount = tableSpecificRes.length;
        let individualStatus: 'available' | 'partially-booked' | 'fully-booked' = 'available';
        
        if (isBlocked || individualResCount >= 2) {
          individualStatus = 'fully-booked';
        } else if (individualResCount === 1) {
          individualStatus = 'partially-booked';
        }

        let individualActiveRes: Reservation | undefined;
        let individualUpcomingRes: Reservation | undefined;

        if (selectedDate === format(new Date(), 'yyyy-MM-dd')) {
          individualActiveRes = tableSpecificRes.find(r => {
            const resTime = parseISO(`${r.date}T${r.time}`);
            const gap = settings?.minReservationGap || 135;
            const endTime = addMinutes(resTime, gap);
            return now >= resTime && now <= endTime;
          });
          
          individualUpcomingRes = tableSpecificRes.find(r => {
            const resTime = parseISO(`${r.date}T${r.time}`);
            return resTime > now;
          });
        } else {
          individualUpcomingRes = tableSpecificRes[0];
        }

        statuses[id] = { 
          status: status === 'inactive' ? 'available' : individualStatus,
          resCount: individualResCount,
          isBlocked,
          activeRes: individualActiveRes,
          upcomingRes: individualUpcomingRes || tableSpecificRes[0],
          isInactive: status === 'inactive',
          joinedName
        };
      });
    });

    return statuses;
  };

  const hasLunchReservations = useMemo(() => {
    const lunchOpen = sessions.lunchTimes?.open || '11:00';
    const lunchClose = sessions.lunchTimes?.close || '16:59';
    return filteredReservations.some(r => {
      if (r.status === 'cancelled') return false;
      if (r.session === 'lunch') return true;
      if (r.session === 'dinner') return false;
      if (r.time) {
        if (r.time >= lunchOpen && r.time <= lunchClose) return true;
        const hour = parseInt(r.time.split(':')[0], 10);
        return !isNaN(hour) && hour >= 11 && hour < 17;
      }
      return false;
    });
  }, [filteredReservations, sessions.lunchTimes]);

  const hasDinnerReservations = useMemo(() => {
    const dinnerOpen = sessions.dinnerTimes?.open || '17:00';
    const dinnerClose = sessions.dinnerTimes?.close || '23:59';
    return filteredReservations.some(r => {
      if (r.status === 'cancelled') return false;
      if (r.session === 'dinner') return true;
      if (r.session === 'lunch') return false;
      if (r.time) {
        if (r.time >= dinnerOpen && r.time <= dinnerClose) return true;
        const hour = parseInt(r.time.split(':')[0], 10);
        return !isNaN(hour) && (hour >= 17 || hour < 4);
      }
      return false;
    });
  }, [filteredReservations, sessions.dinnerTimes]);

  const showLunchPlan = !!(sessions.lunch || hasLunchReservations);
  const showDinnerPlan = !!(sessions.dinner || hasDinnerReservations);

  const lunchStatuses = useMemo(() => {
    if (!showLunchPlan) return null;
    const openTime = sessions.lunchTimes?.open || '11:00';
    const closeTime = sessions.lunchTimes?.close || '16:59';
    const lunchRes = filteredReservations.filter(r => {
      if (r.status === 'cancelled') return false;
      if (r.status === 'blocked') return true;
      if (r.session === 'lunch') return true;
      if (r.session === 'dinner') return false;
      if (r.time >= openTime && r.time <= closeTime) return true;
      const hour = parseInt(r.time.split(':')[0], 10);
      return !isNaN(hour) && hour >= 11 && hour < 17;
    });
    return getTableStatuses(lunchRes, 'lunch');
  }, [filteredReservations, sessions, showLunchPlan, tables, selectedDate]);

  const dinnerStatuses = useMemo(() => {
    if (!showDinnerPlan) return null;
    const openTime = sessions.dinnerTimes?.open || '17:00';
    const closeTime = sessions.dinnerTimes?.close || '23:59';
    const dinnerRes = filteredReservations.filter(r => {
      if (r.status === 'cancelled') return false;
      if (r.status === 'blocked') return true;
      if (r.session === 'dinner') return true;
      if (r.session === 'lunch') return false;
      if (r.time >= openTime && r.time <= closeTime) return true;
      const hour = parseInt(r.time.split(':')[0], 10);
      return !isNaN(hour) && (hour >= 17 || hour < 4);
    });
    return getTableStatuses(dinnerRes, 'dinner');
  }, [filteredReservations, sessions, showDinnerPlan, tables, selectedDate]);

  const tableStatuses = useMemo(() => {
    return getTableStatuses(filteredReservations);
  }, [tables, filteredReservations, selectedDate]);

  const handleWalkIn = async (tableId: string, force = false) => {
    if (!isToday(parseISO(selectedDate))) {
      toast.error(language === 'pt' ? 'Walk-in só é permitido para o dia atual.' : 'Walk-in is only allowed for the current day.');
      return;
    }

    if (isClosed) {
      const confirmMsg = language === 'pt' ? 'O restaurante está fechado nesta data. Tem a certeza que deseja adicionar cliente?' : 'The restaurant is closed on this date. Are you sure you want to add a walk-in?';
      if (!await confirm(confirmMsg)) return;
    } else {
       // Check if time closed
       let isTimeClosed = false;
       let computedSession = 'default';
       if (settings && selectedDate && walkInTime) {
         try {
           computedSession = getSessionFromTime(walkInTime);
           if (computedSession === 'lunch' && !sessions.lunch) isTimeClosed = true;
           if (computedSession === 'dinner' && !sessions.dinner) isTimeClosed = true;
           if (computedSession === 'default') isTimeClosed = true;
         } catch (e) {}
       }
       if (isTimeClosed) {
           let confirmMsg = language === 'pt' ? 'O restaurante está fechado neste horário. Tem a certeza que deseja adicionar cliente?' : 'The restaurant is closed at this time. Are you sure you want to add a walk-in?';
           if (computedSession === 'lunch') {
             confirmMsg = language === 'pt' ? `O restaurante está fechado ao almoço. Tem a certeza que deseja adicionar cliente?` : `The restaurant is closed for lunch. Are you sure you want to add a walk-in?`;
           } else if (computedSession === 'dinner') {
             confirmMsg = language === 'pt' ? `O restaurante está fechado ao jantar. Tem a certeza que deseja adicionar cliente?` : `The restaurant is closed for dinner. Are you sure you want to add a walk-in?`;
           }
           if (!await confirm(confirmMsg)) return;
       }
    }

    const table = tables.find(t => t.id === tableId);
    if (!table) return;

    if (!force) {
      const conflict = checkOverlap('new-walk-in', tableId, walkInTime);
      if (conflict) {
        setOverlapWarning({ resId: 'new-walk-in', tableId, conflictingRes: conflict, type: 'walkin', newTime: walkInTime });
        setShowWalkInModal(null);
        return;
      }
    }

    try {
      let customerUid = undefined;
      if (walkInName || walkInPhone) {
        const matches = customers.filter(c => 
          (c.phone && walkInPhone && c.phone.replace(/\s+/g, '') === walkInPhone.replace(/\s+/g, '')) ||
          (c.name && walkInName && c.name.toLowerCase() === walkInName.toLowerCase())
        );
        const foundCustomer = matches.find(c => c.isRegistered) || matches[0];
        if (foundCustomer) {
          customerUid = foundCustomer.id;
        }
      }

      await addReservation({
        customerUid,
        customerName: walkInName || (language === 'pt' ? 'Cliente sem Marcação' : 'Walk in customer'),
        customerEmail: "",
        customerPhone: walkInPhone || "",
        date: selectedDate,
        time: walkInTime,
        guests: walkInGuests,
        tableId: tableId,
        status: 'booked',
        notes: language === 'pt' ? 'Cliente sem Marcação' : 'Walk in customer',
        source: 'admin',
        bookedByStaffNumber: currentStaffNumber
      });
      setShowWalkInModal(null);
      setWalkInGuests(2);
      setWalkInName("");
      setWalkInPhone("");
      setWalkInTime(format(new Date(), 'HH:mm'));
    } catch (error) {
      console.error("Error adding walk-in:", error);
    }
  };

  const handleAreaDragStart = (e: React.DragEvent, id: string) => {
    setDraggedAreaId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleAreaDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleAreaDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedAreaId) return;

    const sourceIndex = areas.findIndex(a => a.id === draggedAreaId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) return;

    const updated = [...areas];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);

    try {
      for (let i = 0; i < updated.length; i++) {
        await updateArea(updated[i].id, { order: i });
      }
      toast.success(language === 'pt' ? 'Ordem atualizada' : 'Order updated');
    } catch (err) {
      console.error('Failed to update area order:', err);
      toast.error(language === 'pt' ? 'Erro ao atualizar ordem' : 'Error updating order');
    }
    setDraggedAreaId(null);
  };

  const findBestTable = (guests: number, date: string, time: string, favoriteTables?: string[]) => {
    if (!settings || !tables || !tables.length) return "";
    
    const [hours, minutes] = time.split(':').map(Number);
    const newStart = parseISO(date);
    newStart.setHours(hours, minutes, 0, 0);
    const gap = settings.minReservationGap || 135;
    const newEnd = addMinutes(newStart, gap);

    // 1. Filter candidates
    const session = getSessionFromTime(time);
    const candidates = tables.filter(table => {
      if (table.isActive === false) return false;
      if (session && table.activeSessions && table.activeSessions[session] === false) return false;

      // Session-specific activity
      if (session) {
        if (table.extraAvailability?.[date]) {
          if (table.extraAvailability[date][session] === false) return false;
        } else if (table.extraSessions) {
          if (table.extraSessions[session] === false) return false;
        }
      }

      const tableSeats = Number(table.seats);
      if (isNaN(tableSeats) || tableSeats < guests) return false;

      const selectedDateObj = parseISO(date);
      if (table.isExtra) {
        const isAvailableOnDate = (table.availableDate && isSameDay(selectedDateObj, parseISO(table.availableDate))) || 
                                 (table.availableDates && table.availableDates.includes(date));
        if (!isAvailableOnDate) return false;
      } else if (table.availableDate) {
        const availDate = parseISO(table.availableDate);
        if (isBefore(selectedDateObj, availDate) && !isSameDay(selectedDateObj, availDate)) return false;
      }
      return true;
    });

    // 2. Overlap check
    const freeTables = candidates.filter(table => {
      return !reservations.some(r => {
        if (r.tableId !== table.id || r.date !== date) return false;
        if (['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(r.status)) return false;
        
        const [rHours, rMinutes] = r.time.split(':').map(Number);
        const resStart = parseISO(r.date);
        resStart.setHours(rHours, rMinutes, 0, 0);
        const resEnd = addMinutes(resStart, gap);
        
        return (newStart < resEnd && resStart < newEnd);
      });
    });

    if (freeTables.length === 0) return "";

    // 3. Sorting (Stable alphabetical + seat priority)
    freeTables.sort((a, b) => {
      if (favoriteTables && favoriteTables.length > 0) {
        const aFavIndex = favoriteTables.indexOf(a.id);
        const bFavIndex = favoriteTables.indexOf(b.id);
        if (aFavIndex !== -1 && bFavIndex === -1) return -1;
        if (bFavIndex !== -1 && aFavIndex === -1) return 1;
        if (aFavIndex !== -1 && bFavIndex !== -1) return aFavIndex - bFavIndex;

        const favoriteAreas = new Set(
          favoriteTables.map(id => tables.find(t => t.id === id)?.areaId).filter(Boolean)
        );
        const aInFavArea = favoriteAreas.has(a.areaId);
        const bInFavArea = favoriteAreas.has(b.areaId);
        if (aInFavArea && !bInFavArea) return -1;
        if (!aInFavArea && bInFavArea) return 1;
      }
      const seatsA = parseInt(String(a.seats || 0), 10);
      const seatsB = parseInt(String(b.seats || 0), 10);
      if (seatsA !== seatsB) return seatsA - seatsB;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    return freeTables[0].id;
  };

  // Auto-assign table when guests or time changes in the modal
  useEffect(() => {
    if (showNewResModal && !newResData.manualSelection) {
      const phoneToFind = newResData.phone?.trim().replace(/\s+/g, '');
      const nameToFind = newResData.name?.trim().toLowerCase();
      const customer = customers.find(c => 
        (phoneToFind && c.phone?.trim().replace(/\s+/g, '') === phoneToFind) ||
        (nameToFind && c.name?.trim().toLowerCase() === nameToFind)
      );
      const bestTable = findBestTable(newResData.guests, selectedDate, newResData.time, customer?.favoriteTables);
      if (bestTable) {
        setNewResData(prev => {
          let needsVerify = false;
          if (customer?.favoriteTables && customer.favoriteTables.length > 0) {
            needsVerify = !customer.favoriteTables.includes(bestTable);
          }
          if (prev.tableId !== bestTable || prev.verifyTableNumber !== needsVerify) {
            return { ...prev, tableId: bestTable, verifyTableNumber: needsVerify };
          }
          return prev;
        });
      }
    }
  }, [newResData.guests, newResData.time, showNewResModal, newResData.manualSelection, newResData.name, newResData.phone, customers, selectedDate]);

  const handleNewReservation = async () => {
    let isTimeClosed = false;
    let computedSession = 'default';

    if (settings && selectedDate && newResData.time) {
      try {
        computedSession = getSessionFromTime(newResData.time, newResData.manualSession);
        if (computedSession === 'lunch' && !sessions.lunch) isTimeClosed = true;
        if (computedSession === 'dinner' && !sessions.dinner) isTimeClosed = true;
        if (computedSession === 'default') isTimeClosed = true;
      } catch (e) {}
    }

    if (isClosed || isTimeClosed) {
      let confirmMsg = language === 'pt' ? 'O restaurante está fechado nesta data ou horário. Tem a certeza que deseja efetuar esta reserva?' : 'The restaurant is closed on this date or time. Are you sure you want to make this reservation?';
      
      try {
        const dateObj = parseISO(selectedDate);
        const dayName = format(dateObj, 'EEEE');
        const dayMapPt: Record<string, string> = { 'Monday': 'segunda-feira', 'Tuesday': 'terça-feira', 'Wednesday': 'quarta-feira', 'Thursday': 'quinta-feira', 'Friday': 'sexta-feira', 'Saturday': 'sábado', 'Sunday': 'domingo' };
        const dayPt = dayMapPt[dayName] || dayName;
        
        if (isClosed) {
           confirmMsg = language === 'pt' ? `O restaurante está fechado à ${dayPt}. Tem a certeza que deseja efetuar esta reserva?` : `The restaurant is closed on ${dayName}. Are you sure you want to make this reservation?`;
        } else if (isTimeClosed) {
           if (computedSession === 'lunch') {
             confirmMsg = language === 'pt' ? `O restaurante está fechado ao almoço. Tem a certeza que deseja efetuar esta reserva?` : `The restaurant is closed for lunch. Are you sure you want to make this reservation?`;
           } else if (computedSession === 'dinner') {
             confirmMsg = language === 'pt' ? `O restaurante está fechado ao jantar. Tem a certeza que deseja efetuar esta reserva?` : `The restaurant is closed for dinner. Are you sure you want to make this reservation?`;
           }
        }
      } catch (e) {}

      if (!await confirm(confirmMsg)) {
        return;
      }
    }
    let targetTableId = newResData.tableId;
    let targetTableName = newResData.tableName;
    
    // Auto-assign if still not selected AND not explicitly set to "no table"
    if (!targetTableId && !newResData.manualSelection) {
      const phoneToFind = newResData.phone?.trim().replace(/\s+/g, '');
      const nameToFind = newResData.name?.trim().toLowerCase();
      const customer = customers.find(c => 
        (phoneToFind && c.phone?.trim().replace(/\s+/g, '') === phoneToFind) ||
        (nameToFind && c.name?.trim().toLowerCase() === nameToFind)
      );
      const bestTable = findBestTable(newResData.guests, selectedDate, newResData.time, customer?.favoriteTables);
      if (bestTable) {
        targetTableId = bestTable;
        targetTableName = tables.find(t => t.id === bestTable)?.name || "";
        if (customer?.favoriteTables && customer.favoriteTables.length > 0) {
           newResData.verifyTableNumber = !customer.favoriteTables.includes(bestTable);
           if (newResData.verifyTableNumber) {
             (newResData as any).preferredTableUnavailable = true;
           }
        } else {
           newResData.verifyTableNumber = false;
        }
      } else {
        // Fallback to empty if not found, allowing reservation to still be saved without a table.
        targetTableId = "";
        targetTableName = "";
      }
    }

    if (!newResData.name) {
      toast.error("Please enter a customer name");
      return;
    }
    
    setIsSubmitting(true);
    try {
      let customerUid = undefined;
      const matches = customers.filter(c => 
        (c.email && newResData.email && c.email.toLowerCase() === newResData.email.toLowerCase()) ||
        (c.phone && newResData.phone && c.phone.replace(/\s+/g, '') === newResData.phone.replace(/\s+/g, '')) ||
        (c.name && newResData.name && c.name.toLowerCase() === newResData.name.toLowerCase())
      );
      const foundCustomer = matches.find(c => c.isRegistered) || matches[0];
      if (foundCustomer) {
        customerUid = foundCustomer.id;
      }

      const addPayload: any = {
        customerUid,
        customerName: newResData.name,
        customerEmail: newResData.email,
        customerPhone: newResData.phone,
        language: newResData.language,
        date: selectedDate,
        time: newResData.time,
        guests: newResData.guests,
        tableId: targetTableId,
        tableName: targetTableName,
        status: 'booked',
        notes: newResData.notes,
        source: 'admin',
        bookedByStaffNumber: currentStaffNumber,
        verifyTableNumber: !!newResData.verifyTableNumber,
        manualSession: newResData.manualSession
      };
      
      if ((newResData as any).preferredTableUnavailable) {
        addPayload.preferredTableUnavailable = true;
      }

      await addReservation(addPayload);
      toast.success(t('res.book_success') || "Reservation added successfully");
      setShowNewResModal(false);
      setNewResData({
        name: "",
        email: "",
        phone: "",
        guests: 2,
        time: format(new Date(), 'HH:mm'),
        tableId: "",
        tableName: "",
        notes: "",
        manualSelection: false,
        verifyTableNumber: false,
        language: 'en',
        manualSession: undefined as "lunch" | "dinner" | undefined
      });
    } catch (error) {
      console.error("Error adding reservation:", error);
      toast.error("Failed to add reservation");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTableDrag = (id: string, e: any, data: any, sessionType?: 'lunch' | 'dinner', isModal: boolean = false) => {
    const sessionKey = (sessionType || 'default') + (isModal ? '-modal' : '');
    const size = floorPlanSizes[sessionKey] || { width: 1000, height: 600 };
    const normX = Math.max(0, Math.min(1, data.x / size.width));
    const normY = Math.max(0, Math.min(1, data.y / size.height));

    const table = tables.find(t => t.id === id);
    if (!table) return;

    const session = sessionType || 'default';
    const dailyPositions = { ...(table.dailyPositions || {}) };
    if (!dailyPositions[selectedDate]) {
      dailyPositions[selectedDate] = {};
    }
    dailyPositions[selectedDate][session as 'lunch' | 'dinner' | 'default'] = { x: normX, y: normY };

    updateTable(id, { dailyPositions });
  };

  const handleAreaDrag = (areaId: string, e: any, data: any, sessionType?: 'lunch' | 'dinner', isModal: boolean = false) => {
    const sessionKey = (sessionType || 'default') + (isModal ? '-modal' : '');
    const size = floorPlanSizes[sessionKey] || { width: 1000, height: 600 };
    const normX = Math.max(0, Math.min(1, data.x / size.width));
    const normY = Math.max(0, Math.min(1, data.y / size.height));

    const area = areas.find(a => a.id === areaId);
    if (!area) return;

    const newOverrides = { ...(area.dateOverrides || {}) };
    const dayOverride = newOverrides[selectedDate] || {};
    newOverrides[selectedDate] = {
      ...dayOverride,
      x: normX,
      y: normY
    };

    updateArea(areaId, { dateOverrides: newOverrides });
  };

  const checkOverlap = (resId: string, tableId: string, newTime: string) => {
    if (resId !== 'new-walk-in') {
       const res = filteredReservations.find(r => r.id === resId);
       if (res && ['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status)) return undefined;
    }
    const table = tables.find(t => t.id === tableId);
    if (!table) return undefined;

    const sessionKey = getSessionFromTime(newTime);
    const currentJoin = table.dailyJoins?.[selectedDate]?.[sessionKey];
    const joinGroup = currentJoin && currentJoin.joinedTables && currentJoin.joinedTables.length > 0
      ? [tableId, ...currentJoin.joinedTables]
      : [tableId];

    // Check if there is a blocked reservation (status === 'blocked') on ANY table in the joinGroup for this date, or if the table is blocked in blockedDates
    const blockedRes = filteredReservations.find(r => {
      if (r.id === resId || r.date !== selectedDate || r.status !== 'blocked') return false;
      return joinGroup.includes(r.tableId || '');
    });

    if (blockedRes) {
      return blockedRes;
    }

    const isTableBlocked = joinGroup.some(tid => {
      const tObj = tables.find(t => t.id === tid);
      if (!tObj) return false;
      return !!(tObj.blockedDates?.[selectedDate]?.[sessionKey] || tObj.blockedDates?.[selectedDate]?.default || tObj.isBlocked);
    });

    if (isTableBlocked) {
      return {
        id: 'blocked-simulated',
        customerName: 'BLOCKED',
        customerEmail: '',
        customerPhone: '',
        date: selectedDate,
        time: '00:00',
        guests: 0,
        tableId: tableId,
        status: 'blocked',
        notes: 'Manual block',
        source: 'admin'
      } as Reservation;
    }

    const newStart = parse(newTime, 'HH:mm', new Date());
    const gap = settings?.minReservationGap || 135;
    const newEnd = addMinutes(newStart, gap);

    const groupOverlappingRes = filteredReservations.filter(r => {
      if (r.id === resId || r.date !== selectedDate || ['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(r.status)) return false;
      if (!joinGroup.includes(r.tableId || '')) return false;

      const resStart = parse(r.time, 'HH:mm', new Date());
      const resEnd = addMinutes(resStart, gap);

      return (newStart < resEnd && resStart < newEnd);
    });

    if (groupOverlappingRes.length >= 1) {
      return groupOverlappingRes[0];
    }

    return undefined;
  };

  const handleTableChange = async (resId: string, newTableId: string, newTableName?: string, force = false) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;

    if (!force) {
      const conflict = checkOverlap(resId, newTableId, res.time);
      if (conflict) {
        setOverlapWarning({ resId, tableId: newTableId, tableName: newTableName, conflictingRes: conflict, type: 'table' });
        return;
      }
    }

    try {
      const updates: any = { tableId: newTableId, tableName: newTableName || "" };
      if (res.isWaitlist) {
        updates.isWaitlist = false;
        updates.status = 'booked';
      }
      
      await updateReservation(resId, updates);
      if (selectedRes && selectedRes.id === resId) {
        setSelectedRes({ ...selectedRes, ...updates });
      }
      setOverlapWarning(null);
    } catch (error) {
      console.error("Error reassigning table:", error);
    }
  };

  const handleTimeChange = async (resId: string, newTime: string, force = false) => {
    const res = reservations.find(r => r.id === resId);
    if (!res) return;

    if (!force && res.tableId) {
      const conflict = checkOverlap(resId, res.tableId, newTime);
      if (conflict) {
        setOverlapWarning({ resId, tableId: res.tableId, conflictingRes: conflict, type: 'time', newTime });
        return;
      }
    }

    try {
      await updateReservation(resId, { time: newTime });
      if (selectedRes && selectedRes.id === resId) {
        setSelectedRes({ ...selectedRes, time: newTime });
      }
      setOverlapWarning(null);
    } catch (error) {
      console.error("Error updating time:", error);
    }
  };

  const handleGuestsChange = async (resId: string, newGuests: number) => {
    try {
      await updateReservation(resId, { guests: newGuests });
      if (selectedRes && selectedRes.id === resId) {
        setSelectedRes({ ...selectedRes, guests: newGuests });
      }
    } catch (error) {
      console.error("Error updating guests:", error);
    }
  };

  const handleStatusChange = async (resId: string, newStatus: any) => {
    try {
      const updates: any = { status: newStatus };
      if (newStatus === 'waiting-list') {
        updates.isWaitlist = true;
        updates.tableId = "";
      } else if (selectedRes && selectedRes.status === 'waiting-list') {
        updates.isWaitlist = false;
      }
      
      await updateReservation(resId, updates);
      if (selectedRes && selectedRes.id === resId) {
        setSelectedRes({ ...selectedRes, ...updates });
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const handleJoinTables = async (tableId: string, joinedWithIds: string[], seats: number) => {
    try {
      const session = joinSessionType || 'default';
      const allIds = [tableId, ...joinedWithIds];
      
      for (const id of allIds) {
        const table = tables.find(t => t.id === id);
        if (!table) continue;
        
        const dailyJoins = { ...(table.dailyJoins || {}) };
        if (!dailyJoins[selectedDate]) dailyJoins[selectedDate] = {};
        
        const others = allIds.filter(tid => tid !== id);
        dailyJoins[selectedDate][session as 'lunch' | 'dinner'] = { 
          joinedTables: others, 
          joinedSeats: seats 
        };
        
        await updateTable(id, { dailyJoins });
      }
      
      setShowJoinModal(null);
      setJoinSessionType(undefined);
    } catch (error) {
      console.error("Error joining tables:", error);
    }
  };

  const handleUnjoinTables = async (tableId: string) => {
    try {
      const session = joinSessionType || 'default';
      const table = tables.find(t => t.id === tableId);
      if (!table) return;

      const currentJoin = table.dailyJoins?.[selectedDate]?.[session as 'lunch' | 'dinner'];
      const allIds = [tableId, ...(currentJoin?.joinedTables || [])];
      
      // Check for reservations that might become "orphaned" or over-capacity
      const orphanedReservations: Reservation[] = [];
      
      displayReservations.forEach(res => {
        if (res.tableId && allIds.includes(res.tableId)) {
          const resSession = getSessionFromTime(res.time, res.manualSession);
          if (resSession === session) {
            const individualTable = tables.find(t => t.id === res.tableId);
            if (individualTable && res.guests > individualTable.seats) {
              orphanedReservations.push(res);
            }
          }
        }
      });

      if (orphanedReservations.length > 0) {
        const names = orphanedReservations.map(r => `${r.customerName} (${r.guests} ${t('common.guests')})`).join(', ');
        alert(`${t('res.unjoin_warning')}: ${names} ${t('res.no_table_assigned')}`);
      }

      for (const id of allIds) {
        const t = tables.find(tab => tab.id === id);
        if (!t) continue;
        
        const dailyJoins = { ...(t.dailyJoins || {}) };
        if (dailyJoins[selectedDate]) {
          delete dailyJoins[selectedDate][session as 'lunch' | 'dinner'];
          if (Object.keys(dailyJoins[selectedDate]).length === 0) {
            delete dailyJoins[selectedDate];
          }
        }
        
        await updateTable(id, { dailyJoins });
      }
      
      setShowJoinModal(null);
      setJoinSessionType(undefined);
    } catch (error) {
      console.error("Error unjoining tables:", error);
    }
  };
 
  const getTablePosition = (table: Table, sessionType?: 'lunch' | 'dinner') => {
    const session = sessionType || 'default';
    if (table.dailyPositions?.[selectedDate]?.[session as 'lunch' | 'dinner' | 'default']) {
      return table.dailyPositions[selectedDate][session as 'lunch' | 'dinner' | 'default']!;
    }
    if (sessionType && table.positions?.[sessionType]) {
      return table.positions[sessionType];
    }
    return { x: table.x ?? 0.5, y: table.y ?? 0.5 };
  };

  const handleResetDailyLayout = async (sessionType?: 'lunch' | 'dinner') => {
    const session = sessionType || 'default';
    const promises = tables.map(table => {
      if (table.dailyPositions?.[selectedDate]?.[session]) {
        const dailyPositions = { ...table.dailyPositions };
        if (dailyPositions[selectedDate]) {
          const dayPositions = { ...dailyPositions[selectedDate] };
          delete dayPositions[session as 'lunch' | 'dinner' | 'default'];
          if (Object.keys(dayPositions).length === 0) {
            delete dailyPositions[selectedDate];
          } else {
            dailyPositions[selectedDate] = dayPositions;
          }
          return updateTable(table.id, { dailyPositions });
        }
      }
      return Promise.resolve();
    });
    await Promise.all(promises);
  };

  const getEffectiveTables = (sessionType?: 'lunch' | 'dinner') => {
    const session = sessionType || 'default';
    const effectiveTables: { id: string; name: string; seats: number; isJoined: boolean; uniqueKey: string }[] = [];
    const processedGroups = new Set<string>();

    tables.forEach(table => {
      const statuses = session === 'lunch' ? lunchStatuses : (session === 'dinner' ? dinnerStatuses : tableStatuses);
      if (!statuses?.[table.id]) return;
      if (table.isActive === false || statuses[table.id]?.isInactive) return;

      // 1. Add individual table
      effectiveTables.push({
        id: table.id,
        name: table.name,
        seats: table.seats,
        isJoined: false,
        uniqueKey: `ind_${table.id}`
      });

      // 2. Add group if it exists and hasn't been added
      const currentJoin = table.dailyJoins?.[selectedDate]?.[session as 'lunch' | 'dinner'];
      if (currentJoin?.joinedTables && currentJoin.joinedTables.length > 0) {
        const joinGroup = [table.id, ...currentJoin.joinedTables].sort();
        const groupKey = joinGroup.join(',');

        if (!processedGroups.has(groupKey)) {
          processedGroups.add(groupKey);
          const groupTables = joinGroup.map(id => tables.find(t => t.id === id)).filter(Boolean) as Table[];
          const joinedName = groupTables.map(t => t.name).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('/');
          const totalSeats = currentJoin.joinedSeats || groupTables.reduce((sum, t) => sum + t.seats, 0);

          effectiveTables.push({
            id: table.id, // Reference ID
            name: joinedName,
            seats: totalSeats,
            isJoined: true,
            uniqueKey: `grp_${groupKey}`
          });
        }
      }
    });

    return effectiveTables.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  };

  const renderReservationList = (sessionType?: 'lunch' | 'dinner', isMobile: boolean = false) => {
    const now = new Date();
    const currentTimeStr = format(now, 'HH:mm');

    const sessionRes = displayReservations.filter(res => {
      const resSession = getSessionFromTime(res.time, res.manualSession);
      if (sessionType) {
        return resSession === sessionType;
      }
      
      if (!sessionType) {
        // Only show upcoming/active on TODAY'S date
        if (selectedDate !== format(now, 'yyyy-MM-dd')) {
          return false;
        }

        const isActive = res.status === 'arrived';
        const isUpcoming = res.status === 'booked' || res.status === 'confirmed' || res.status === 'delayed' || res.status === 'pending';
        
        if (!isActive && !isUpcoming) return false;

        const [resH, resM] = res.time.split(':').map(Number);
        const resDate = new Date();
        resDate.setHours(resH, resM, 0, 0);
        
        const startTime = addMinutes(now, -30); // Keep reservations visible up to 30 mins after their time
        const endTime = addMinutes(now, 30);    // Show upcoming reservations for the next 30 mins
        const isWithinWindow = resDate >= startTime && resDate <= endTime;
        
        if (generalBoxPosition === 'lunch') {
          if (resSession !== 'lunch' && resSession !== 'default') return false;
        } else if (generalBoxPosition === 'dinner') {
          if (resSession !== 'dinner' && resSession !== 'default') return false;
        }

        // Active ones are ALWAYS shown. Upcoming are shown if in time window
        return isActive || isWithinWindow;
      }

      // For other dates, only show what belongs to the general/default pool
      return !sessions.lunch && !sessions.dinner ? true : (resSession === 'default');
    });

    const getSessionStats = (s: string) => {
      const filtered = displayReservations
        .filter(r => getSessionFromTime(r.time, r.manualSession) === s)
        .sort((a, b) => a.time.localeCompare(b.time));
        
      return {
        count: filtered.length,
        guests: filtered.reduce((acc, r) => acc + r.guests, 0),
        firstTime: filtered.length > 0 ? filtered[0].time : null,
        lastTime: filtered.length > 0 ? filtered[filtered.length - 1].time : null
      };
    };

    return (
      <motion.div 
        id={!sessionType ? "upcoming-active-box" : undefined}
        layout="position"
        layoutId={(!sessionType && !isMobile) ? "general-reservation-box" : undefined}
        className={cn(
          "py-6 rounded-2xl shadow-sm border flex flex-col transition-colors duration-300", // Removed max-h and sticky
          fullscreenSession ? "px-0" : "px-3",
          fullscreenSession && fullscreenTheme === 'dark'
            ? "bg-gray-900 border-gray-800 text-white"
            : "bg-white border-gray-100 text-gray-900"
        )}
      >
        <div className={cn("flex flex-col gap-2 mb-4 shrink-0", fullscreenSession ? "px-3" : "")}>
          <div className="flex items-start justify-between w-full flex-wrap gap-2">
            <div className="flex flex-col gap-2 items-start w-full">
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Clock className="text-amber-600" size={20} />
                    {sessionType ? t(`common.${sessionType}`) : (selectedDate === format(new Date(), 'yyyy-MM-dd') ? t('dashboard.upcoming') : format(parseISO(selectedDate), 'dd/MM/yyyy'))}
                    {!sessionType && (
                      <button
                        type="button"
                        onClick={() => setIsUpcomingExpanded(!isUpcomingExpanded)}
                        className={cn(
                          "ml-1 p-1 rounded-md transition-colors",
                          fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:text-gray-200 hover:bg-gray-800" : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                        )}
                        title={isUpcomingExpanded ? "Collapse" : "Expand"}
                      >
                        {isUpcomingExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                    )}
                  </h2>
                                 {sessionType && !fullscreenSession && (
                      <div className="relative">
                        <Search size={14} className={cn(
                          "absolute left-2.5 top-1/2 -translate-y-1/2",
                          fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )} />
                        <input 
                          type="text"
                          placeholder={language === 'pt' ? 'Pesquisar...' : 'Search...'}
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className={cn(
                            "pl-8 pr-8 py-1.5 text-xs rounded-lg border w-32 focus:w-40 transition-all duration-300 outline-none",
                            fullscreenSession && fullscreenTheme === 'dark'
                              ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-amber-500"
                              : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-500"
                          )}
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={(e) => {
                              setSearchQuery("");
                              const input = e.currentTarget.parentElement?.querySelector('input');
                              if (input) {
                                input.value = '';
                                input.blur();
                              }
                            }}
                            className={cn(
                              "absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors",
                              fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                            )}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                  )}
                </div>

                </div>
              {!sessionType && (
                <div className="flex justify-end w-full gap-2">
                  {!fullscreenSession && showLunchPlan && showDinnerPlan && (
                    <div className={cn(
                      "flex items-center gap-1 p-1 rounded-lg border",
                      fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800/50 border-gray-700" : "bg-gray-100/50 border-gray-100"
                    )}>
                      <button type="button" 
                        onClick={() => {
                          userClickedArrow.current = true;
                          setGeneralBoxPosition('lunch');
                        }}
                        className={cn(
                          "px-3 py-1 rounded-md transition-colors text-xs font-bold",
                          generalBoxPosition === 'lunch' 
                            ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-700 text-amber-500 shadow-sm" : "bg-white shadow-sm text-amber-600")
                            : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:bg-gray-700 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200")
                        )}
                      >
                        {t('common.lunch')}
                      </button>
                      <button type="button" 
                        onClick={() => {
                          userClickedArrow.current = true;
                          setGeneralBoxPosition('dinner');
                        }}
                        className={cn(
                          "px-3 py-1 rounded-md transition-colors text-xs font-bold",
                          generalBoxPosition === 'dinner' 
                            ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-700 text-indigo-400 shadow-sm" : "bg-white shadow-sm text-indigo-600")
                            : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:bg-gray-700 hover:text-gray-200" : "text-gray-500 hover:bg-gray-200")
                        )}
                      >
                        {t('common.dinner')}
                      </button>
                    </div>
                  )}
                  <div className={cn(
                    "flex items-center gap-1 p-1 rounded-lg transition-colors border",
                    fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                  )}>
                    <button
                      type="button"
                      onClick={() => setSortOrder('time')}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        sortOrder === 'time' 
                          ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-700 shadow-sm text-amber-500" : "bg-white shadow-sm text-amber-600")
                          : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                      )}
                      title="Sort by Time"
                    >
                      <Clock size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortOrder('table')}
                      className={cn(
                        "p-1 rounded-md transition-colors",
                        sortOrder === 'table' 
                          ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-700 shadow-sm text-amber-500" : "bg-white shadow-sm text-amber-600")
                          : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                      )}
                      title="Sort by Table"
                    >
                      <TableIcon size={14} />
                    </button>
                  </div>
                </div>
              )}
              {sessionType && (() => {
                const stats = getSessionStats(sessionType);
                return (
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded-lg border transition-colors duration-300",
                      fullscreenSession && fullscreenTheme === 'dark'
                        ? "bg-gray-800 border-gray-700 text-gray-200"
                        : "bg-gray-50 border-gray-100 text-gray-700"
                    )}>
                      {stats.firstTime && (
                        <div className={cn(
                          "flex items-center gap-1.5 px-2 border-r transition-colors",
                          fullscreenSession && fullscreenTheme === 'dark' ? "border-gray-700" : "border-gray-200"
                        )}>
                          <Clock size={12} className="text-amber-600" />
                          <span className={cn(
                            "text-[10px] font-black",
                            fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-300" : "text-gray-700"
                          )}>{stats.firstTime} - {stats.lastTime}</span>
                        </div>
                      )}
                      <div className={cn(
                        "flex items-center gap-1.5 px-2 border-r last:border-0 transition-colors",
                        fullscreenSession && fullscreenTheme === 'dark' ? "border-gray-700" : "border-gray-200"
                      )}>
                        <CalendarIcon size={12} className="text-amber-600" />
                        <span className={cn(
                          "text-[10px] font-bold",
                          fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>{stats.count}</span>
                      </div>
                      <div className="flex items-center gap-1.5 px-2 last:border-0">
                        <Users size={12} className="text-amber-600" />
                        <span className={cn(
                          "text-[10px] font-bold",
                          fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-300" : "text-gray-700"
                        )}>{stats.guests}</span>
                      </div>
                    </div>
                    
                    <div className={cn(
                      "flex items-center gap-1 p-1 rounded-lg transition-colors border",
                      fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-gray-50 border-gray-200"
                    )}>
                      <button
                        type="button"
                        onClick={() => setSortOrder('time')}
                        className={cn(
                          "p-1 rounded-md transition-colors",
                          sortOrder === 'time' 
                            ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-700 shadow-sm text-amber-500" : "bg-white shadow-sm text-amber-600")
                            : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                        )}
                        title="Sort by Time"
                      >
                        <Clock size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSortOrder('table')}
                        className={cn(
                          "p-1 rounded-md transition-colors",
                          sortOrder === 'table' 
                            ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-700 shadow-sm text-amber-500" : "bg-white shadow-sm text-amber-600")
                            : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                        )}
                        title="Sort by Table"
                      >
                        <TableIcon size={14} />
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
        <AnimatePresence initial={false}>
          {(!sessionType && !isUpcomingExpanded) ? null : (
            <motion.div
              initial={!sessionType ? { height: 0, opacity: 0 } : false}
              animate={!sessionType ? { height: 'auto', opacity: 1 } : {}}
              exit={!sessionType ? { height: 0, opacity: 0 } : {}}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
              className={cn("space-y-3 flex-grow overflow-y-auto custom-scrollbar max-h-[1350px]", fullscreenSession ? "pl-[14px] pr-2" : "pl-[14px] pr-2")}
            >
              {sessionRes.length > 0 ? (() => {
              let filteredRes = sessionRes;
              if (searchQuery && sessionType) {
              const lowerQuery = searchQuery.toLowerCase();
              filteredRes = sessionRes.filter(res => 
                (res.customerName && res.customerName.toLowerCase().includes(lowerQuery)) ||
                (res.customerPhone && res.customerPhone.toLowerCase().includes(lowerQuery))
              );
            }

            if (filteredRes.length === 0) {
              return (
                <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                  <p className="text-sm font-medium">{language === 'pt' ? 'Nenhuma reserva encontrada' : 'No reservations found'}</p>
                </div>
              );
            }

            const getTableDisplayName = (r: Reservation) => {
              if (r.tableName) return r.tableName;
              const s = getSessionFromTime(r.time, r.manualSession);
              const st = s === 'lunch' ? lunchStatuses : (s === 'dinner' ? dinnerStatuses : tableStatuses);
              return st?.[r.tableId || '']?.joinedName || tables.find(t => t.id === r.tableId)?.name || "";
            };

            const sortedRes = [...filteredRes].sort((a, b) => {
              const sessionA = getSessionFromTime(a.time, a.manualSession);
              const sessionB = getSessionFromTime(b.time, b.manualSession);
                         if (sessionA !== sessionB) {
                const order = { 'lunch': 1, 'dinner': 2, 'default': 3 };
                return (order[sessionA as keyof typeof order] || 4) - (order[sessionB as keyof typeof order] || 4);
              }

              if (sortOrder === 'table') {
                const tableA = getTableDisplayName(a) || "999";
                const tableB = getTableDisplayName(b) || "999";
                if (tableA !== tableB) {
                  return tableA.localeCompare(tableB, undefined, { numeric: true });
                }
              }

              return a.time.localeCompare(b.time);
            });

            return sortedRes.map((res, index) => {
              const table = tables.find(t => t.id === res.tableId);
              const session = getSessionFromTime(res.time, res.manualSession);
              const prevRes = sortedRes[index - 1];
              const prevSession = prevRes ? getSessionFromTime(prevRes.time, prevRes.manualSession) : null;
              const nextRes = sortedRes[index + 1];

              const displayName = getTableDisplayName(res);
              const hasTable = Boolean(displayName);
              const multipleForTable = hasTable && filteredRes.filter(r => 
                getTableDisplayName(r) === displayName && 
                getSessionFromTime(r.time, r.manualSession) === session
              ).length > 1;
              const isSameAsPrev = hasTable && prevRes && getTableDisplayName(prevRes) === displayName && getSessionFromTime(prevRes.time, prevRes.manualSession) === session;
              const isSameAsNext = hasTable && nextRes && getTableDisplayName(nextRes) === displayName && getSessionFromTime(nextRes.time, nextRes.manualSession) === session;

              const showSessionHeader = !sessionType && session !== prevSession;
              const stats = getSessionStats(session);

                return (
                  <React.Fragment key={res.id}>
                    {showSessionHeader && (
                      <div className={cn(
                        "pt-4 pb-2 flex items-center gap-[5px]",
                        index === 0 && "pt-0"
                      )}>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={cn(
                            "text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded transition-colors duration-300",
                            session === 'lunch' 
                              ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-amber-950/40 text-amber-400" : "bg-amber-100 text-amber-700") 
                              : session === 'dinner' 
                                ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-indigo-950/40 text-indigo-400" : "bg-indigo-100 text-indigo-700") 
                                : (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800 text-gray-400" : "bg-gray-100 text-gray-500")
                          )}>
                            {t(`common.${session}`)}
                          </span>
                        </div>
                        <div className={cn(
                          "h-px flex-grow transition-colors duration-300",
                          session === 'lunch' 
                            ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-amber-900/30" : "bg-amber-100") 
                            : session === 'dinner' 
                              ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-indigo-900/30" : "bg-indigo-100") 
                              : (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800" : "bg-gray-100")
                        )} />
                        <div className="flex items-center gap-3 flex-shrink-0">
                          <div className="flex items-center gap-1">
                            <CalendarIcon size={12} className={cn(session === 'lunch' ? "text-amber-500" : session === 'dinner' ? "text-indigo-500" : "text-gray-400")} />
                            <span className={cn(
                              "text-[10px] font-bold transition-colors duration-300",
                              fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400" : "text-gray-500"
                            )}>{stats.count}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users size={12} className={cn(session === 'lunch' ? "text-amber-500" : session === 'dinner' ? "text-indigo-500" : "text-gray-400")} />
                            <span className={cn(
                              "text-[10px] font-bold transition-colors duration-300",
                              fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400" : "text-gray-500"
                            )}>{stats.guests}</span>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className={cn("relative", index === sortedRes.length - 1 && fullscreenSession && "mb-[25px]")}>
                      {(isSameAsPrev || isSameAsNext || multipleForTable) && (
                        <div className={cn(
                          "absolute -left-[14px] w-1 bg-yellow-400 z-10",
                          isSameAsPrev ? "-top-[7px]" : "top-2",
                          isSameAsNext ? "-bottom-[7px]" : "bottom-2",
                          !isSameAsPrev && "rounded-t-full",
                          !isSameAsNext && "rounded-b-full"
                        )} />
                      )}
                      <button type="button" 
                        onClick={() => setSelectedRes(res)}
                        className={cn(
                          "w-full text-left p-3 rounded-xl border flex flex-col gap-2 transition-all group relative",
                          res.status === 'arrived' 
                            ? "bg-green-500 border-green-600 text-white hover:bg-green-600" :
                          res.status === 'completed'
                            ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800/40 border-gray-800 text-gray-500 hover:bg-gray-800" : "bg-gray-100 border-gray-200 text-gray-500 hover:bg-gray-200") :
                          res.status === 'no-show'
                            ? "bg-gray-400 border-gray-500 text-white hover:bg-gray-500" :
                          res.status === 'waiting-list'
                            ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800/40 border-gray-800 text-gray-400 hover:bg-gray-800" : "bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200")
                            : (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800/60 border-gray-800 text-gray-200 hover:bg-gray-800 hover:border-gray-700" : "bg-gray-50 border-gray-100 hover:bg-amber-50 hover:border-amber-200")
                        )}
                      >
                    {res.status === 'completed' && (
                       <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                         <div className="h-[2px] w-[90%] bg-blue-500/40 rotate-[-5deg]" />
                       </div>
                    )}
                    <div className={cn("w-full flex flex-col gap-2", res.status === 'completed' ? "opacity-60" : "")}>
                      {/* Top: Customer Name and Badges 100% width */}
                      <div className="w-full flex items-center gap-2 flex-wrap">
                        <div className={cn(
                          "font-bold transition-colors duration-300 truncate max-w-[80%]",
                          (res.status === 'arrived' || res.status === 'no-show') 
                            ? "text-white group-hover:text-white" 
                            : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-100 group-hover:text-amber-400" : "text-gray-900 group-hover:text-amber-900")
                        )}>{res.customerName}</div>
                        {res.notes && (
                          <div className={cn("flex items-center", (res.status === 'arrived' || res.status === 'no-show') ? "text-amber-200" : "text-amber-500")} title={res.notes}>
                            <FileText size={14} />
                          </div>
                        )}
                        {(() => {
                          const isRegular = res.isRegularCustomer || (customers && customers.some(c =>
                            c.isRegular && (
                              (c.phone && res.customerPhone && c.phone.replace(/\s+/g, '') === res.customerPhone.replace(/\s+/g, '')) ||
                              (c.email && res.customerEmail && c.email.toLowerCase().trim() === res.customerEmail.toLowerCase().trim())
                            )
                          ));
                          return (
                            <>
                              {isRegular && (
                                <span className="px-1.5 py-0.5 bg-amber-100 text-amber-800 text-[9px] font-bold uppercase rounded border border-amber-200/50">
                                  REGULAR
                                </span>
                              )}
                              {res.verifyTableNumber && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-100 text-rose-800 text-[9px] font-bold uppercase rounded border border-rose-200/50 animate-pulse">
                                  <AlertCircle size={9} strokeWidth={3} />
                                  {language === 'en' ? 'Verify Table' : 'Verificar Mesa'}
                                </span>
                              )}
                              {(() => {
                                if (res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status)) {
                                  const conflict = checkOverlap(res.id, res.tableId, res.time);
                                  if (conflict && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(conflict.status)) {
                                    return (
                                      <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold uppercase rounded border border-red-200/50 animate-pulse">
                                        <AlertCircle size={9} strokeWidth={3} />
                                        {language === 'en' ? 'Time Conflict' : 'Conflito de Horário'}
                                      </span>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </>
                          );
                        })()}
                      </div>

                      {/* Middle Row: Left (Table), Middle (Time and Guests), Right (Empty) */}
                      <div className="w-full flex items-center justify-between">
                        
                        {/* Middle Left: Table (40%) */}
                        <div className="w-[40%] flex items-center justify-start pr-1">
                          <span className={cn(
                            "font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-1.5 transition-colors duration-300 text-xs",
                            !res.tableId 
                              ? "bg-red-50 text-red-600 border border-red-100" 
                              : "bg-green-500 text-white border border-green-600"
                          )}>
                            {!res.tableId ? (
                              <>
                                <AlertTriangle size={10} className="animate-pulse" />
                                <span>{language === 'pt' ? 'Sem Mesa' : 'No Table'}</span>
                              </>
                            ) : (
                              <>
                                <TableIcon size={12} className="text-white" />
                                <span>{displayName}</span>
                              </>
                            )}
                          </span>
                        </div>

                        {/* Middle Middle: Time and Guests (40%) */}
                        <div className="w-[40%] flex items-center justify-start">
                          <div className={cn(
                            "flex items-center gap-2 px-2 py-0.5 rounded-md text-xs font-medium transition-colors duration-300",
                            (res.status === 'arrived' || res.status === 'no-show') 
                              ? "bg-white/20 text-white" 
                              : (fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800 text-gray-300" : "bg-gray-100 text-gray-700")
                          )}>
                            <span className="flex items-center gap-1">
                              <Clock size={12} />
                              {formatDisplayTime(res.time, settings)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users size={12} /> {res.guests}
                            </span>
                          </div>
                        </div>
                        
                        {/* Middle Right: Empty space (20%) */}
                        <div className="w-[20%]"></div>
                      </div>

                                                                  {/* Status and Pencil (100%) */}
                      <div className="w-full flex items-center relative z-20 mt-2">
                        <div className="w-[40%] flex items-center">
                          <div className={cn(
                            "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors duration-300 truncate",
                            res.status === 'arrived' ? "bg-white text-green-600 shadow-sm" :
                            res.status === 'completed' ? "bg-yellow-400 text-yellow-900 shadow-sm" :
                            res.status === 'cancelled' ? "bg-red-500 text-white shadow-sm" :
                            res.status === 'no-show' ? "bg-gray-500 text-white shadow-sm" :
                            res.status === 'confirmed' ? "bg-green-100 text-green-700" :
                            res.status === 'delayed' ? "bg-orange-500 text-white shadow-sm" :
                            res.status === 'booked' ? (fullscreenSession && fullscreenTheme === 'dark' ? "bg-blue-950/40 text-blue-400" : "bg-blue-100 text-blue-700") :
                            res.status === 'pending' ? "bg-amber-100 text-amber-700" :
                            res.status === 'waiting-list' ? "bg-gray-400 text-white shadow-sm" :
                            "bg-gray-100 text-gray-700"
                          )}>
                            {t(`res.${res.status}`) || res.status}
                          </div>
                        </div>
                        <div className="w-[50%] flex items-center overflow-hidden">
                          {res.bookingNumber && (
                            <span 
                              title={res.bookingNumber}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (res.bookingNumber) {
                                  navigator.clipboard.writeText(res.bookingNumber);
                                  // Optional: Could add a small local state toast here, but simple copy is fine
                                }
                              }}
                              className={cn(
                              "text-[10px] font-medium tracking-wider truncate cursor-pointer hover:underline",
                              (res.status === 'arrived' || res.status === 'no-show')
                                ? "text-white/80 hover:text-white" 
                                : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                            )}>
                              {res.bookingNumber}
                            </span>
                          )}
                        </div>
                        <div className="w-[10%] flex items-center justify-end">
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedRes(res);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors cursor-pointer flex items-center justify-center",
                              (res.status === 'arrived' || res.status === 'no-show')
                                 ? "text-white hover:bg-white/20" 
                                 : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-500 hover:text-amber-400 hover:bg-gray-800" : "text-gray-400 hover:text-amber-600 hover:bg-white")
                            )}
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </div>
                        </div>
                      </div>

                      {/* Bottom: Notes 100% width */}
                      {res.notes && (
                        <div className={cn(
                          "w-full text-[10px] italic line-clamp-2 transition-colors duration-300 text-left",
                          (res.status === 'arrived' || res.status === 'no-show') ? "text-green-50" : (fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400" : "text-gray-400")
                        )}>
                          "{res.notes}"
                        </div>
                      )}
                    </div>
                  </button>
                </div>
              </React.Fragment>
            );
          });
        })() : (
          <div className="flex items-center justify-between">
            <p className="text-gray-400 text-sm italic">{t('res.no_bookings')}</p>
          </div>
        )}
      </motion.div>
      )}
      </AnimatePresence>
      {!sessionType && !fullscreenSession && (
        <div className="mt-4 pt-4 border-t border-gray-100 flex justify-end shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={defaultToDinner}
              onChange={(e) => {
                const val = e.target.checked;
                setDefaultToDinner(val);
                localStorage.setItem('defaultToDinner', val ? 'true' : 'false');
                if (val) {
                  userClickedArrow.current = true;
                  setGeneralBoxPosition('dinner');
                } else {
                  userClickedArrow.current = true;
                  setGeneralBoxPosition('lunch');
                }
              }}
              className={cn(
                "w-3.5 h-3.5 rounded border-gray-300 text-purple-600 focus:ring-0 cursor-pointer",
                fullscreenSession && fullscreenTheme === 'dark' ? "bg-gray-800" : "bg-transparent"
              )}
            />
            <span className={cn(
              "text-xs font-medium",
              fullscreenSession && fullscreenTheme === 'dark' ? "text-gray-400" : "text-gray-400"
            )}>
              {language === 'pt' ? 'Padrão Jantar' : 'Default Dinner'}
            </span>
          </label>
        </div>
      )}
    </motion.div>
    );
  };

  if ((tablesLoading && !tables?.length) || (settingsLoading && !settings)) return <div className="p-8 text-center">{t('common.loading')}</div>;

  const renderFloorPlan = (statuses: any, title?: string, sessionType?: 'lunch' | 'dinner', isModal: boolean = false) => {
    const scrollRef = sessionType === 'lunch' ? lunchScrollRef : (sessionType === 'dinner' ? dinnerScrollRef : null);
    const sessionKey = (sessionType || 'default') + (isModal ? '-modal' : '');
    const size = floorPlanSizes[sessionKey] || { width: 1000, height: 600 };

    const getPixelPos = (pos: { x: number; y: number }) => {
      let tx = pos.x ?? 0.5;
      let ty = pos.y ?? 0.5;
      if (tx > 1) tx = tx / 1000;
      if (ty > 1) ty = ty / 600;
      tx = Math.max(0, Math.min(1, tx));
      ty = Math.max(0, Math.min(1, ty));
      return {
        x: tx * size.width,
        y: ty * size.height
      };
    };

    return (
      <div id={sessionType ? `floor-plan-${sessionType}` : undefined} className="space-y-4">
        {(title || !isModal) && (
          <div className="flex items-center justify-between">
            {title ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-xl w-fit">
                <Clock size={18} className="text-amber-600" />
                <span className="font-bold text-gray-700">{title}</span>
              </div>
            ) : (
              <div />
            )}
            {!isModal && (
              <div className="flex items-center gap-2">
                {tables.some(t => t.dailyPositions?.[selectedDate]?.[sessionType || 'default']) && (
                  <button
                    onClick={() => handleResetDailyLayout(sessionType)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                    title={language === 'pt' ? 'Restaurar layout padrão' : 'Reset to default layout'}
                  >
                    <RefreshCw size={14} />
                    <span>{language === 'pt' ? 'Restaurar Layout' : 'Reset Layout'}</span>
                  </button>
                )}
                <button
                  onClick={() => setFullscreenSession(sessionType || 'default')}
                  className="p-1.5 flex items-center justify-center text-xs font-bold bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 rounded-lg transition-colors shadow-sm cursor-pointer no-print"
                  title={t('res.increase_window')}
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            )}
          </div>
        )}
        <div 
          ref={scrollRef}
          className={cn(
            "bg-white border-2 border-dashed border-gray-200 rounded-3xl overflow-x-auto overflow-y-hidden shadow-inner custom-scrollbar relative floor-plan-scroll-container",
            isModal ? "h-[calc(100vh-160px)]" : "h-[600px]"
          )}
        >
        <FloorPlanContainer 
          sessionKey={sessionKey}
          onResize={handleFloorPlanResize}
          hasBgImage={settings?.showFloorPlanBg !== false}
        >
          {/* Floor Plan Background Image */}
          {settings?.showFloorPlanBg !== false && (
            <div 
              className="absolute inset-0 pointer-events-none z-0"
            >
              <img 
                src={settings?.useDefaultFloorPlanBg ? restaurantFloorPlan : (settings?.floorPlanBgUrl || restaurantFloorPlan)} 
                alt="Floor Plan" 
                className="w-full h-full object-fill" 
                referrerPolicy="no-referrer"
                style={{ opacity: 1.0 }}
              />
              <div 
                className="absolute inset-0 bg-black transition-opacity duration-300"
                style={{ opacity: settings?.floorPlanOpacity === 0.3 ? 0.0 : (settings?.floorPlanOpacity ?? 0.0) }} 
              />
            </div>
          )}

          {/* Visual Links for Joined Tables */}
          <svg className="absolute inset-0 pointer-events-none w-full h-full z-0">
            {tables.map(table => {
              const session = sessionType || 'default';
              const currentJoin = table.dailyJoins?.[selectedDate]?.[session as 'lunch' | 'dinner'];
              if (!currentJoin || !currentJoin.joinedTables || currentJoin.joinedTables.length === 0) return null;
              
              return currentJoin.joinedTables.map(otherId => {
                const other = tables.find(t => t.id === otherId);
                if (!other || table.id > otherId) return null; // Only draw once per pair

                const rawPos1 = getTablePosition(table, sessionType);
                const rawPos2 = getTablePosition(other, sessionType);
                
                const pos1 = getPixelPos(rawPos1);
                const pos2 = getPixelPos(rawPos2);

                // Center offsets based on shape (decreased by 10% from previous 15% decrease)
                const getOffset = (shape?: string) => {
                  if (shape === 'rectangle') {
                    return isLaptopOrBelow ? { x: 39.65, y: 24.79 } : { x: 44.06, y: 27.54 };
                  }
                  return isLaptopOrBelow ? { x: 29.75, y: 29.75 } : { x: 33.05, y: 33.05 };
                };

                const off1 = getOffset(table.shape);
                const off2 = getOffset(other.shape);

                return (
                  <line 
                    key={`${table.id}-${otherId}`}
                    x1={pos1.x + off1.x} y1={pos1.y + off1.y}
                    x2={pos2.x + off2.x} y2={pos2.y + off2.y}
                    stroke="#3b82f6"
                    strokeWidth="4"
                    strokeDasharray="8,4"
                    className="opacity-40"
                  />
                );
              });
            })}
          </svg>

          {tables.filter(t => statuses[t.id]).map((table) => {
            const statusInfo = statuses[table.id];
            const session = sessionType || 'default';
            const currentJoin = table.dailyJoins?.[selectedDate]?.[session as 'lunch' | 'dinner'];
            const isJoined = currentJoin && currentJoin.joinedTables && currentJoin.joinedTables.length > 0;
            const isInactive = statusInfo.isInactive;
            const tableArea = table.areaId ? areas.find(a => a.id === table.areaId) : null;

            const areaOptions = table.areaId ? (() => {
              const area = areas.find(a => a.id === table.areaId);
              if (!area) return null;
              const override = area.dateOverrides?.[selectedDate];
              const bookingMode = override?.bookingMode !== undefined ? override.bookingMode : area.bookingMode;
              const specialEventSessions = override?.specialEventSessions !== undefined ? override.specialEventSessions : (area.specialEventSessions || ['lunch', 'dinner']);
              const isSpecialActive = bookingMode === 'special_event' && (!sessionType || specialEventSessions.includes(sessionType));
              return {
                bookingMode: isSpecialActive ? 'special_event' : (bookingMode === 'special_event' ? 'online' : bookingMode),
                sessionMode: override?.sessionMode !== undefined ? override.sessionMode : area.sessionMode,
                specialEventName: override?.specialEventName !== undefined ? override.specialEventName : area.specialEventName,
                allowOnlineReservations: override?.allowOnlineReservations !== undefined ? override.allowOnlineReservations : area.allowOnlineReservations,
                closedSessions: override?.closedSessions !== undefined ? override.closedSessions : (area.closedSessions || ['lunch', 'dinner']),
                closedStartDate: area.closedStartDate,
                closedEndDate: area.closedEndDate,
              };
            })() : null;

            const isAreaManual = areaOptions?.bookingMode === 'manual';
            const isOnlineActive = (table.allowOnlineReservations ?? true) && (
              sessionType === 'lunch' ? (table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) :
              sessionType === 'dinner' ? (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)) :
              ((table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) || (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)))
            );
            const isTableManual = !isOnlineActive;
            const isAreaSpecial = areaOptions?.bookingMode === 'special_event';
            const isAreaPermanentlyClosed = areaOptions?.bookingMode === 'permanently_closed';
            
            const isLunchOnly = 
              (table.activeSessions?.lunch === true && table.activeSessions?.dinner === false) ||
              (table.isExtra && table.extraSessions?.lunch === true && table.extraSessions?.dinner === false) ||
              (table.allowOnlineReservations !== false && (table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) === true && (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)) === false) ||
              areaOptions?.sessionMode === 'lunch';

            const isDinnerOnly = 
              (table.activeSessions?.lunch === false && table.activeSessions?.dinner === true) ||
              (table.isExtra && table.extraSessions?.lunch === false && table.extraSessions?.dinner === true) ||
              (table.allowOnlineReservations !== false && (table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) === false && (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)) === true) ||
              areaOptions?.sessionMode === 'dinner';
            
            const isAreaFullyClosed = !isTableManual && (
              (areaOptions?.bookingMode === 'closed' && (!sessionType || areaOptions.closedSessions?.includes(sessionType)) && (!areaOptions.closedStartDate || selectedDate >= areaOptions.closedStartDate) && (!areaOptions.closedEndDate || selectedDate <= areaOptions.closedEndDate)) || 
              areaOptions?.bookingMode === 'permanently_closed' || 
              (areaOptions?.allowOnlineReservations === false && !isAreaManual && areaOptions?.bookingMode !== 'closed' && areaOptions?.bookingMode !== 'permanently_closed')
            );
            const isSessionClosed = !isAreaFullyClosed && !isTableManual && (
              (isLunchOnly && sessionType === 'dinner') ||
              (isDinnerOnly && sessionType === 'lunch')
            );
            const isAreaClosed = isAreaFullyClosed || isSessionClosed;

            
            const shapeClasses = {
              round: isLaptopOrBelow ? "rounded-full w-[68.4px] h-[68.4px] p-2" : "rounded-full w-[75.6px] h-[75.6px] p-2.5",
              square: isLaptopOrBelow ? "rounded-xl w-[68.4px] h-[68.4px] p-2" : "rounded-xl w-[75.6px] h-[75.6px] p-2",
              rectangle: isLaptopOrBelow ? "rounded-xl w-[88.2px] h-[57.6px] p-2" : "rounded-xl w-[97.2px] h-[64.8px] p-2"
            };
            const currentShapeClass = shapeClasses[table.shape || 'square'];
            const nodeRef = React.createRef<HTMLDivElement>();
            
            const rawPos = getTablePosition(table, sessionType);

            const position = getPixelPos(rawPos);

            return (
              <Draggable
                key={table.id}
                nodeRef={nodeRef}
                position={position}
                onStop={(e, data) => handleTableDrag(table.id, e, data, sessionType, isModal)}
                bounds="parent"
              >
                <div 
                  ref={nodeRef}
                  className="absolute group"
                >
                  {/* Action Icons Overlay */}
                  <div className="absolute -top-10 left-1/2 -translate-x-1/2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    {(statusInfo.activeRes || statusInfo.upcomingRes) && (
                      <button type="button" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedRes(statusInfo.activeRes || statusInfo.upcomingRes || null);
                        }}
                        className="p-2 bg-white rounded-full shadow-md border border-gray-100 text-blue-600 hover:bg-blue-50 transition-colors"
                        title="View Details"
                      >
                        <Eye size={16} />
                      </button>
                    )}
                    <button type="button" 
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isToday(parseISO(selectedDate))) {
                          toast.error(language === 'pt' ? 'Walk-in só é permitido para o dia atual.' : 'Walk-in is only allowed for the current day.');
                          return;
                        }
                        // Allow admin to bypass closed day
                        setShowWalkInModal(table.id);
                      }}
                      className={cn(
                        "p-2 bg-white rounded-full shadow-md border border-gray-100 transition-colors text-green-600 hover:bg-green-50"
                      )}
                      title={language === 'pt' ? 'Adicionar cliente sem marcação' : "Add Walk-in"}
                    >
                      <Users size={16} />
                    </button>
                    <button type="button" 
                      onClick={(e) => {
                        e.stopPropagation();

                        setShowTimeEditModal(table.id);
                        setTimeEditSessionType(sessionType);
                      }}
                      className={cn(
                        "p-2 bg-white rounded-full shadow-md border border-gray-100 transition-colors text-amber-600 hover:bg-amber-50"
                      )}
                      title={"Edit Seating Times"}
                    >
                      <Clock size={16} />
                    </button>
                    <button type="button" 
                      onClick={(e) => {
                        e.stopPropagation();

                        setShowJoinModal(table.id);
                        setJoinSessionType(sessionType);
                      }}
                      className={cn(
                        "p-2 bg-white rounded-full shadow-md border border-gray-100 transition-colors text-blue-600 hover:bg-blue-50"
                      )}
                      title={"Join Tables"}
                    >
                      <Link size={16} />
                    </button>
                  </div>

                  <div 
                    style={{ transform: `rotate(${table.rotation || 0}deg)` }}
                    className={cn(
                      "flex flex-col items-center justify-center gap-1 shadow-lg border-2 transition-all cursor-move hover:scale-105 relative",
                      currentShapeClass,
                      isJoined ? "border-blue-500 border-4 rounded-[2rem]" : "",
                      isInactive 
                        ? "bg-gray-200 border-gray-300 text-gray-400 opacity-50 grayscale cursor-not-allowed" 
                        : isAreaFullyClosed 
                          ? "bg-red-50/95 border-[3px] border-dashed border-red-500 text-red-900"
                          : isSessionClosed
                            ? "bg-green-500 border-[3px] border-dashed border-red-500 text-white"
                            : (isAreaManual || isTableManual)
                            ? (
                              statusInfo.status === 'fully-booked' ? "bg-red-500 border-dashed border-red-700 text-white" :
                              statusInfo.status === 'partially-booked' ? "bg-yellow-400 border-dashed border-yellow-600 text-yellow-950" :
                              "bg-yellow-50/95 border-dashed border-yellow-500 text-yellow-900"
                            )
                            : isAreaSpecial
                              ? "bg-purple-50/95 border-dashed border-purple-500 text-purple-900"
                              : isJoined ? (
                                statusInfo.status === 'fully-booked' ? "bg-red-500 border-red-600 text-white" :
                                statusInfo.status === 'partially-booked' ? "bg-yellow-400 border-yellow-500 text-yellow-950" :
                                "bg-green-500 border-green-600 text-white"
                              ) : (
                                statusInfo.status === 'fully-booked' ? "bg-red-500 border-red-600 text-white" : 
                                statusInfo.status === 'partially-booked' ? "bg-yellow-400 border-yellow-500 text-yellow-950" :
                                "bg-green-500 border-green-600 text-white"
                              )
                    )}
                  >
                    {isInactive && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <span className="bg-gray-800/90 text-white text-[10px] px-2 py-1 rounded-md font-extrabold uppercase tracking-widest shadow-lg transform -rotate-12">
                          {t('common.inactive') || 'Inactive'}
                        </span>
                      </div>
                    )}
                    {/* Area Color Indicator Circle */}
                    {tableArea?.color && !isInactive && (
                      <div 
                        className="absolute -top-2.5 -right-2.5 w-5 h-5 rounded-full border-2 border-white shadow-md z-30 flex items-center justify-center transition-all pointer-events-none"
                        style={{ backgroundColor: tableArea.color }}
                        title={tableArea.name}
                      />
                    )}
                    <div style={{ transform: `rotate(-${table.rotation || 0}deg)`, fontSize: '13px' }} className="flex flex-col items-center justify-center relative z-10 w-full">
                      <div style={{ fontSize: '13px' }} className="font-bold flex flex-col items-center justify-center gap-0 flex-wrap">
                        {(statusInfo.joinedName || table.name).split('/').map((part, i, arr) => {
                          return (
                            <React.Fragment key={i}>
                              <span style={{ fontSize: '13px', width: '65px' }} className="inline-flex text-center break-words flex-wrap items-center justify-center transition-all px-2.5 py-0 leading-tight">
                                {cleanTableName(part)}
                              </span>
                              {/* separator removed as requested */}
                            </React.Fragment>
                          );
                        })}
                      </div>
                      {isAreaFullyClosed && (
                        <span className="text-[7px] bg-red-100 text-red-700 px-1 rounded font-extrabold uppercase tracking-tight">
                          {language === 'pt' ? 'Fechada' : 'Closed'}
                        </span>
                      )}

                      {(isAreaManual || isTableManual) && (
                        <span className="text-[7px] bg-yellow-100 text-yellow-800 px-1 rounded font-extrabold uppercase tracking-tight">Manual</span>
                      )}
                      {isAreaSpecial && (
                        <span className="text-[7px] bg-purple-100 text-purple-800 px-1 rounded font-extrabold uppercase tracking-tight">{areaOptions?.specialEventName || 'Event'}</span>
                      )}
                      <span style={{ fontSize: '13px' }} className="font-bold opacity-80 mt-0.5 flex items-center justify-center gap-1">
                        <Users size={12} />
                        {currentJoin?.joinedSeats || table.seats}
                        {isLunchOnly && <Sun size={14} className="text-amber-500 ml-0.5" />}
                        {isDinnerOnly && <Moon size={14} className="text-gray-500 ml-0.5" />}
                      </span>
                      {table.isExtra && (
                        <span className="text-[9px] bg-purple-100 text-purple-700 dark:bg-purple-950/80 dark:text-purple-300 border border-purple-300 dark:border-purple-700/60 px-1.5 py-0.5 rounded font-extrabold uppercase mb-1 shadow-2xs">
                          Extra
                        </span>
                      )}
                      {statusInfo.resCount > 0 && !statusInfo.isInactive && (
                        <div className="flex gap-1 mt-1">
                          {Array.from({ length: statusInfo.resCount }).map((_, i) => (
                            <div key={i} className="w-2 h-2 rounded-full bg-white/50" />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Draggable>
            );
          })}

          {areas.map(area => {
            const override = area.dateOverrides?.[selectedDate];
            const bookingMode = override?.bookingMode !== undefined ? override.bookingMode : area.bookingMode;
            if (bookingMode !== 'special_event') return null;
            
            const specialEventSessions = override?.specialEventSessions !== undefined ? override.specialEventSessions : (area.specialEventSessions || ['lunch', 'dinner']);
            if (sessionType && !specialEventSessions.includes(sessionType)) return null;

            const sessionMode = override?.sessionMode !== undefined ? override.sessionMode : area.sessionMode;
            if (sessionType && sessionMode !== 'both' && sessionMode !== sessionType) return null;

            const specialEventName = override?.specialEventName !== undefined ? override.specialEventName : area.specialEventName;

            const nodeRef = React.createRef<HTMLDivElement>();
            const rawPos = { x: override?.x ?? 0.35, y: override?.y ?? 0.1 };
            const position = getPixelPos(rawPos);

            return (
              <Draggable
                key={`area-event-${area.id}-${sessionType || 'default'}`}
                nodeRef={nodeRef}
                position={position}
                onStop={(e, data) => handleAreaDrag(area.id, e, data, sessionType, isModal)}
                bounds="parent"
              >
                <div
                  ref={nodeRef}
                  className="absolute z-20 cursor-move"
                  style={{ whiteSpace: 'nowrap' }}
                >
                  <div className="bg-purple-600 text-white px-3 py-1.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1.5 font-bold hover:scale-105 transition-all animate-pulse">
                    <span className="text-xs">⭐</span>
                    <div className="flex flex-col text-left">
                      <span className="text-[8px] uppercase tracking-wider opacity-90 leading-none">Special Event</span>
                      <span className="text-[11px] leading-tight font-extrabold">{specialEventName || 'Event'}</span>
                    </div>
                  </div>
                </div>
              </Draggable>
            );
          })}
        </FloorPlanContainer>
      </div>
    </div>
    );
  };

  return (
    <div id="admin-live-view-top" className={cn("mx-auto py-8 px-4 sm:px-6 lg:px-8", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-4">
          <div>
            <h1 className={cn(
              "text-3xl font-bold transition-colors",
              settings?.theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{t('nav.live_view') || "Floor Plan Live"}</h1>
            <p className={cn(
              "transition-colors",
              settings?.theme === 'dark' ? "text-white" : "text-gray-500"
            )}>{t('dashboard.live_status') || "Real-time floor plan status"}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode('floorplan')}
              className={cn(
                "px-4 h-[42px] rounded-xl text-sm font-bold transition-colors",
                viewMode === 'floorplan'
                  ? "bg-amber-600 text-white"
                  : settings?.theme === 'dark' ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              )}
            >
              Floor Plan
            </button>
            <button
              onClick={() => setViewMode('cronograma')}
              className={cn(
                "px-4 h-[42px] rounded-xl text-sm font-bold transition-colors",
                viewMode === 'cronograma'
                  ? "bg-amber-600 text-white"
                  : settings?.theme === 'dark' ? "bg-gray-800 text-gray-400 hover:bg-gray-700" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
              )}
            >
              Cronograma
            </button>
          </div>
        </div>
        
        {/* Date Selector & Book Button */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white h-[42px] p-1 rounded-2xl shadow-sm border border-gray-100 relative">
            <button type="button" 
              onClick={() => {
                const d = parseISO(selectedDate);
                setSelectedDate(format(subHours(d, 24), 'yyyy-MM-dd'));
              }}
              className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-amber-600 transition-colors flex items-center justify-center h-full"
            >
              <ChevronLeft size={18} />
            </button>

            <div className="flex items-center gap-1.5 px-0.5 h-full">
              <div className="relative flex items-center justify-center">
                <div className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 hover:text-amber-700 transition-all flex items-center justify-center cursor-pointer">
                  <CalendarIcon size={17} />
                </div>
                <input 
                  type="date"
                  min={new Date().getFullYear() < 2026 ? '2026-01-01' : format(new Date(), 'yyyy-MM-dd')}
                  lang={language === "pt" ? "pt-PT" : "en-US"} 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  id="date-picker-icon"
                />
              </div>

              <div className="relative flex items-center justify-center min-w-[128px] group cursor-pointer h-full">
                <div className="px-1 font-bold text-gray-900 text-center text-xs sm:text-sm group-hover:text-amber-600 transition-colors pointer-events-none flex items-center justify-center">
                  <span>{isToday(parseISO(selectedDate)) ? t('common.today') : format(parseISO(selectedDate), 'dd/MM/yyyy')}</span>
                </div>
                <input 
                  type="date"
                  min={new Date().getFullYear() < 2026 ? '2026-01-01' : format(new Date(), 'yyyy-MM-dd')}
                  lang={language === "pt" ? "pt-PT" : "en-US"} 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                  id="date-picker"
                />
              </div>

              <button type="button"
                onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                title={language === 'pt' ? 'Ir para Hoje' : 'Go to Today'}
                className="p-1.5 hover:bg-gray-50 rounded-xl text-amber-500 hover:text-amber-600 transition-colors flex items-center justify-center"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            <button type="button" 
              onClick={() => {
                const d = parseISO(selectedDate);
                setSelectedDate(format(addHours(d, 24), 'yyyy-MM-dd'));
              }}
              className="p-2 hover:bg-gray-50 rounded-xl text-gray-400 hover:text-amber-600 transition-colors flex items-center justify-center h-full"
            >
              <ChevronRight size={18} />
            </button>
          </div>
                        <button type="button"
              onClick={() => {
                setNewResData(prev => ({ ...prev, date: selectedDate }));
                setShowNewResModal(true);
              }}
              className={cn(
                "flex items-center gap-2 px-6 h-[42px] rounded-xl font-bold transition-colors shadow-sm",
                "bg-amber-600 text-white hover:bg-amber-700"
              )}
            >
              <Plus size={18} />
              {t('res.book_table') || "Book a Table"}
            </button>
          </div>
          <div className="flex flex-row items-center gap-3">
            {/* Online Reservations Status Label */}
            {(() => {
              const isLiveLunchOnline = !isClosed && sessions.lunch && !(settings?.fullHouseLunchDates?.includes(selectedDate) || settings?.fullHouseDates?.includes(selectedDate));
              const isLiveDinnerOnline = !isClosed && sessions.dinner && !(settings?.fullHouseDinnerDates?.includes(selectedDate) || settings?.fullHouseDates?.includes(selectedDate));
              return (
                <div className="flex flex-col justify-center items-center px-4 py-1 bg-white border border-gray-200 rounded-2xl shadow-sm h-[42px] whitespace-nowrap">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-gray-400 leading-none mb-1">
                    {language === 'pt' ? 'Reservas Online' : 'Online Reservations'}
                  </span>
                  <div className="flex items-center gap-2 text-xs font-semibold text-gray-700 leading-none">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-600 font-medium text-xs">{language === 'pt' ? 'Almoço' : 'Lunch'}</span>
                      <div className={cn("w-2 h-2 rounded-full shrink-0", isLiveLunchOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]")} />
                      <span className={cn("font-bold text-[11px]", isLiveLunchOnline ? "text-green-600" : "text-red-500")}>
                        {isLiveLunchOnline ? 'ON' : 'OFF'}
                      </span>
                    </div>
                    <span className="text-gray-300 font-bold">-</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-600 font-medium text-xs">{language === 'pt' ? 'Jantar' : 'Dinner'}</span>
                      <div className={cn("w-2 h-2 rounded-full shrink-0", isLiveDinnerOnline ? "bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]")} />
                      <span className={cn("font-bold text-[11px]", isLiveDinnerOnline ? "text-green-600" : "text-red-500")}>
                        {isLiveDinnerOnline ? 'ON' : 'OFF'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="relative" ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                className="flex items-center justify-center w-[42px] h-[42px] rounded-xl font-bold bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 shadow-sm transition-all"
                title={language === 'pt' ? 'Mais Opções' : 'More Options'}
              >
                <MoreVertical size={18} />
              </button>
              {showMoreMenu && (
                <div className="absolute right-0 top-[48px] w-64 bg-white border border-gray-200 shadow-xl rounded-2xl overflow-hidden z-[60] flex flex-col py-1.5">
                  {(() => {
                    const isLiveLunchOnline = !isClosed && sessions.lunch && !(settings?.fullHouseLunchDates?.includes(selectedDate) || settings?.fullHouseDates?.includes(selectedDate));
                    const isLiveDinnerOnline = !isClosed && sessions.dinner && !(settings?.fullHouseDinnerDates?.includes(selectedDate) || settings?.fullHouseDates?.includes(selectedDate));
                    return (
                      <div className="pb-1">
                        <div className="px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-gray-400">
                          {language === 'pt' ? 'Reservas Online' : 'Online Reservations'}
                        </div>
                        <button
                          disabled={isClosed || !sessions.lunch}
                          onClick={async () => {
                            setShowMoreMenu(false);
                            if (settings && !isClosed && sessions.lunch) {
                              const currentDates = settings.fullHouseLunchDates || [];
                              const isFullHouse = currentDates.includes(selectedDate) || settings.fullHouseDates?.includes(selectedDate);
                              const newDates = isFullHouse 
                                ? currentDates.filter(d => d !== selectedDate)
                                : [...currentDates, selectedDate];
                                
                              const globalDates = settings.fullHouseDates || [];
                              const newGlobalDates = globalDates.filter(d => d !== selectedDate);
                                
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
                          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", isLiveLunchOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]")} />
                          <span>{language === 'pt' ? 'Almoço online' : 'Lunch online'} {isLiveLunchOnline ? 'ON' : 'OFF'}</span>
                        </button>

                        <button
                          disabled={isClosed || !sessions.dinner}
                          onClick={async () => {
                            setShowMoreMenu(false);
                            if (settings && !isClosed && sessions.dinner) {
                              const currentDates = settings.fullHouseDinnerDates || [];
                              const isFullHouse = currentDates.includes(selectedDate) || settings.fullHouseDates?.includes(selectedDate);
                              const newDates = isFullHouse 
                                ? currentDates.filter(d => d !== selectedDate)
                                : [...currentDates, selectedDate];
                                
                              const globalDates = settings.fullHouseDates || [];
                              const newGlobalDates = globalDates.filter(d => d !== selectedDate);
                                
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
                          <div className={cn("w-2.5 h-2.5 rounded-full shrink-0", isLiveDinnerOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]")} />
                          <span>{language === 'pt' ? 'Jantar online' : 'Dinner online'} {isLiveDinnerOnline ? 'ON' : 'OFF'}</span>
                        </button>
                        <div className="border-t border-gray-100 my-1" />
                      </div>
                    );
                  })()}

                  <button
                    onClick={() => {
                      setShowMoreMenu(false);
                      setShowAreaOverrideModal(true);
                    }}
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 text-left text-sm font-semibold text-gray-700 w-full"
                  >
                    <Globe size={16} className="text-gray-500" />
                    {language === 'pt' ? 'Gerir Áreas' : 'Manage Areas'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {viewMode === 'cronograma' ? (
        <CronogramaView 
          tables={tables}
          areas={areas}
          reservations={filteredReservations}
          settings={settings}
          selectedDate={selectedDate}
          language={language}
          updateReservation={updateReservation}
          updateTable={updateTable}
          theme={settings?.theme || 'light'}
          onDateChange={setSelectedDate}
          onReservationClick={(resId) => {
            const res = reservations.find(r => r.id === resId);
            if (res) {
              setSelectedRes(res);
            }
          }}
          onTableClick={(tableId) => {
            if (!isToday(parseISO(selectedDate))) {
              toast.error(language === 'pt' ? 'Walk-in só é permitido para o dia atual.' : 'Walk-in is only allowed for the current day.');
              return;
            }
            setShowWalkInModal(tableId);
          }}
        />
      ) : (
        <>
          <div className="space-y-12">
        {showLunchPlan && lunchStatuses ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 sticky top-24 self-start z-10">
              {renderFloorPlan(lunchStatuses, t('common.lunch'), 'lunch')}
            </div>
            <div className="hidden lg:block space-y-6">
              {/* Show upcoming/active reservations here if position is lunch */}
              {generalBoxPosition === 'lunch' && (settings?.showLiveUpcomingBox !== false) && renderReservationList()}
              {renderReservationList('lunch')}
            </div>
          </div>
        ) : null}

        {showDinnerPlan && dinnerStatuses ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 sticky top-24 self-start z-10">
              {renderFloorPlan(dinnerStatuses, t('common.dinner'), 'dinner')}
            </div>
            <div className="hidden lg:block space-y-6">
              {/* Show upcoming/active reservations here if position is dinner OR lunch is not active */}
              {(generalBoxPosition === 'dinner' || !showLunchPlan) && (settings?.showLiveUpcomingBox !== false) && renderReservationList()}
              {renderReservationList('dinner')}
            </div>
          </div>
        ) : null}

        {!showLunchPlan && !showDinnerPlan && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 sticky top-24 self-start z-10">
              {renderFloorPlan(tableStatuses)}
            </div>
            <div className="hidden lg:block">
              {settings?.showLiveUpcomingBox !== false && renderReservationList()}
            </div>
          </div>
        )}

        {/* Mobile Reservation List (shows all) */}
        <div className="lg:hidden">
          {settings?.showLiveUpcomingBox !== false && renderReservationList(undefined, true)}
        </div>
      </div>

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4">{t('dashboard.legend') || "Legend"}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 gap-3">
              <div className="space-y-3 overflow-y-auto flex-grow pr-2 custom-scrollbar">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-green-500" />
                  <span className="text-sm font-medium text-gray-600">{t('res.available')}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-amber-400" />
                  <span className="text-sm font-medium text-gray-600">
                    {language === 'pt' ? 'Parcialmente Reservada (1 Turno)' : 'Partially Booked (1 Seating)'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full bg-red-500" />
                  <span className="text-sm font-medium text-gray-600">
                    {language === 'pt' ? 'Totalmente Reservada (2+ Turnos)' : 'Fully Booked (2+ Seatings)'}
                  </span>
                </div>
              </div>
              <div className="space-y-3 border-t md:border-t-0 lg:border-t border-gray-100 pt-3 md:pt-0 lg:pt-3">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded border-2 border-dashed border-red-500 bg-red-50 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-600">
                    {language === 'pt' ? 'Área Fechada' : 'Area Closed'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded border-2 border-dashed border-yellow-500 bg-yellow-50 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-600">
                    {language === 'pt' ? 'Apenas Reservas Manuais' : 'Manual Bookings Only'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded border-2 border-dashed border-purple-500 bg-purple-50 flex-shrink-0" />
                  <span className="text-sm font-medium text-gray-600">
                    {language === 'pt' ? 'Reservado para Evento Especial' : 'Reserved for Special Event'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                    <Sun size={18} className="text-amber-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {language === 'pt' ? 'Reservas Online Apenas Almoço' : 'Online Booking Only Lunch'}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-5 h-5 flex-shrink-0">
                    <Moon size={18} className="text-gray-500" />
                  </div>
                  <span className="text-sm font-medium text-gray-600">
                    {language === 'pt' ? 'Reservas Online Apenas Jantar' : 'Online Booking Only Dinner'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Time Edit Modal */}
      <AnimatePresence>
      {showTimeEditModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
              <h3 className="text-xl md:text-2xl font-bold">{t('res.manage_seatings')} - {tables.find(t => t.id === showTimeEditModal)?.name}</h3>
              <button type="button" 
                onClick={() => {
                  setShowTimeEditModal(null);
                  setTimeEditSessionType(undefined);
                }}
                className="text-gray-400 hover:text-gray-600 p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1">
            <div className="mb-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "w-4 h-4 rounded-full",
                  (() => {
                    const activeStatuses = timeEditSessionType === 'lunch' ? lunchStatuses : (timeEditSessionType === 'dinner' ? dinnerStatuses : tableStatuses);
                    return activeStatuses?.[showTimeEditModal || '']?.isBlocked ? "bg-red-500" : "bg-gray-300";
                  })()
                )} />
                <span className="font-bold text-gray-700">{t('res.mark_fully_booked')}</span>
              </div>
              <input 
                type="checkbox"
                checked={(() => {
                  const activeStatuses = timeEditSessionType === 'lunch' ? lunchStatuses : (timeEditSessionType === 'dinner' ? dinnerStatuses : tableStatuses);
                  return activeStatuses?.[showTimeEditModal || '']?.isBlocked || false;
                })()}
                onChange={async (e) => {
                  const isChecked = e.target.checked;
                  const tableObj = tables.find(t => t.id === showTimeEditModal);
                  if (!tableObj) return;

                  const currentBlockedDates = tableObj.blockedDates || {};
                  const dateRecord = currentBlockedDates[selectedDate] || {};
                  const sessionKey = timeEditSessionType || 'default';

                  const newDateRecord = {
                    ...dateRecord,
                    [sessionKey]: isChecked
                  };

                  const newBlockedDates = {
                    ...currentBlockedDates,
                    [selectedDate]: newDateRecord
                  };

                  await updateTable(tableObj.id, {
                    blockedDates: newBlockedDates
                  });

                  // For legacy cleanup: cancel any old blocked reservations
                  const blockedRes = filteredReservations.find(r => r.tableId === showTimeEditModal && r.status === 'blocked');
                  if (blockedRes && !isChecked) {
                    await updateReservation(blockedRes.id, { status: 'cancelled' });
                  }
                }}
                className="w-6 h-6 rounded-lg text-amber-600 focus:ring-amber-500 cursor-pointer"
              />
            </div>

            <div className="space-y-4">
              {filteredReservations
                .filter(r => r.tableId === showTimeEditModal && r.status !== 'blocked')
                .sort((a, b) => a.time.localeCompare(b.time))
                .map((res, idx) => (
                  <div key={res.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-gray-900">{t('res.seating')} {idx + 1}: {res.customerName}</span>
                        {(() => {
                          if (res.tableId && !res.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(res.status)) {
                            const conflict = checkOverlap(res.id, res.tableId, res.time);
                            if (conflict && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(conflict.status)) {
                              return (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold uppercase rounded border border-red-200/50 animate-pulse">
                                  <AlertCircle size={9} strokeWidth={3} />
                                  {language === 'en' ? 'Time Conflict' : 'Conflito de Horário'}
                                </span>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold uppercase",
                        res.status === 'confirmed' ? "bg-green-100 text-green-700" : 
                        res.status === 'arrived' ? "bg-green-600 text-white shadow-sm" :
                        res.status === 'booked' ? "bg-blue-100 text-blue-700" :
                        res.status === 'delayed' ? "bg-orange-500 text-white shadow-sm" :
                        res.status === 'completed' ? "bg-yellow-400 text-yellow-900 shadow-sm" :
                        res.status === 'cancelled' ? "bg-red-500 text-white shadow-sm" :
                        res.status === 'no-show' ? "bg-gray-500 text-white shadow-sm" :
                        res.status === 'waiting-list' ? "bg-gray-400 text-white shadow-sm" :
                        "bg-amber-100 text-amber-700"
                      )}>
                        {t(`res.${res.status}`)}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex-grow">
                        <label className="block text-xs text-gray-400 font-bold uppercase mb-1">{t('common.time')}</label>
                        <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                          ampm={settings?.timeFormat === '12h'}
                          format={settings?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                          value={dayjs(res.time, 'HH:mm')}
                          onChange={(newValue) => {
                            if (newValue) handleTimeChange(res.id, newValue.format('HH:mm'));
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
                      </div>
                      <button type="button" 
                        onClick={() => setSelectedRes(res)}
                        className="mt-5 p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Edit size={20} />
                      </button>
                    </div>
                  </div>
                ))}

              {filteredReservations.filter(r => r.tableId === showTimeEditModal).length < 2 && (
                <button type="button" 
                  onClick={() => {
                    const existing = filteredReservations
                      .filter(r => r.tableId === showTimeEditModal)
                      .sort((a, b) => a.time.localeCompare(b.time));
                    
                    let nextTime = "18:00";
                    if (existing.length > 0) {
                      const lastRes = existing[existing.length - 1];
                      const lastStart = parse(lastRes.time, 'HH:mm', new Date());
                      const gap = settings?.minReservationGap || 135;
                      nextTime = format(addMinutes(lastStart, gap), 'HH:mm');
                    }

                    addReservation({
                      customerName: "New Seating",
                      customerEmail: "",
                      customerPhone: "",
                      date: selectedDate,
                      time: nextTime,
                      guests: 2,
                      tableId: showTimeEditModal,
                      status: 'booked',
                      notes: "Manual seating addition",
                      source: 'admin',
                      bookedByStaffNumber: currentStaffNumber
                    });
                  }}
                  className="w-full py-4 border-2 border-dashed border-gray-200 rounded-2xl text-gray-400 font-bold hover:border-amber-300 hover:text-amber-600 transition-all flex items-center justify-center gap-2"
                >
                  <Clock size={20} />
                  {t('res.add_second_seating')}
                </button>
              )}
            </div>

            <button type="button" 
              onClick={() => {
                setShowTimeEditModal(null);
                setTimeEditSessionType(undefined);
              }}
              className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-colors mt-6"
            >
              {t('res.done')}
            </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Join Tables Modal */}
      <AnimatePresence>
      {showJoinModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
              <div>
                <h3 className="text-2xl font-bold">{t('tables.join')}</h3>
                <p className="text-gray-500 text-sm mt-1">{t('tables.join_desc')}</p>
              </div>
              <button type="button" 
                onClick={() => setShowJoinModal(null)}
                className="text-gray-400 hover:text-gray-600 p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1">
            <div className="space-y-6">
              <div className="grid grid-cols-3 gap-2">
                {tables
                  .filter(t => t.id !== showJoinModal && t.isActive !== false)
                  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
                  .map(table => (
                    <button
                      key={table.id}
                      onClick={() => {
                        let newSelected: string[];
                        if (joiningSelectedIds.includes(table.id)) {
                          newSelected = joiningSelectedIds.filter(id => id !== table.id);
                        } else {
                          newSelected = [...joiningSelectedIds, table.id];
                        }
                        setJoiningSelectedIds(newSelected);
                        const baseTbl = tables.find(t => t.id === showJoinModal);
                        const baseS = Number(baseTbl?.seats || 0);
                        const otherS = newSelected.reduce((sum, id) => sum + Number(tables.find(t => t.id === id)?.seats || 0), 0);
                        setJoiningSeats(baseS + otherS);
                      }}
                      className={cn(
                        "p-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center gap-1",
                        joiningSelectedIds.includes(table.id)
                          ? "border-orange-600 bg-orange-50 text-orange-700" 
                          : "border-gray-100 hover:border-orange-200 text-gray-500"
                      )}
                    >
                      <span>{table.name}</span>
                      <span className="text-[10px] opacity-60 flex items-center gap-1">
                        <Users size={10} />
                        {table.seats}
                      </span>
                    </button>
                  ))}
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('tables.total_seats')}</label>
                <div className="flex items-center gap-4">
                  <button type="button" 
                    onClick={() => setJoiningSeats(Math.max(1, joiningSeats - 1))}
                    className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-50"
                  >
                    -
                  </button>
                  <div className="flex-grow text-center text-2xl font-bold">{joiningSeats}</div>
                  <button type="button" 
                    onClick={() => setJoiningSeats(joiningSeats + 1)}
                    className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button type="button" 
                  onClick={() => handleJoinTables(showJoinModal, joiningSelectedIds, joiningSeats)}
                  className="flex-grow bg-blue-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
                >
                  {t('common.confirm')}
                </button>
                {joiningSelectedIds.length > 0 && (
                  <button type="button" 
                    onClick={() => handleUnjoinTables(showJoinModal)}
                    className="px-6 bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
                  >
                    {t('tables.unjoin')}
                  </button>
                )}
              </div>
            </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Overlap Warning Modal */}
      <AnimatePresence>
      {overlapWarning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[130] p-4">
          <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl border-4 border-amber-400">
            <div className="flex items-center gap-4 mb-6 text-amber-600">
              <Clock size={40} />
              <h3 className="text-2xl font-bold">{t('res.conflict_title')}</h3>
            </div>
            
            <p className="text-gray-600 mb-6">
              {(t('res.conflict_desc') || 'This assignment overlaps with an existing booking for {name} at {time}. The required gap between bookings is {gap}.')
                .replace('{name}', overlapWarning.conflictingRes.customerName)
                .replace('{time}', formatDisplayTime(overlapWarning.conflictingRes.time, settings))
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
              <button type="button" 
                onClick={() => {
                  if (overlapWarning.type === 'walkin') {
                    handleWalkIn(overlapWarning.tableId, true);
                    setOverlapWarning(null);
                  } else if (overlapWarning.type === 'table') {
                    handleTableChange(overlapWarning.resId, overlapWarning.tableId, overlapWarning.tableName, true);
                  } else {
                    handleTimeChange(overlapWarning.resId, overlapWarning.newTime!, true);
                  }
                }}
                className="w-full bg-amber-600 text-white py-4 rounded-2xl font-bold hover:bg-amber-700 transition-colors"
              >
                {t('res.assign_anyway')}
              </button>
              <button type="button" 
                onClick={() => setOverlapWarning(null)}
                className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Walk-in Modal */}
      <AnimatePresence>
      {showWalkInModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
              <h3 className="text-2xl font-bold">{t('res.walkin')}</h3>
              <button type="button" 
                onClick={() => setShowWalkInModal(null)}
                className="text-gray-400 hover:text-gray-600 p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.time')}</label>
                  <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                    ampm={settings?.timeFormat === '12h'}
                    format={settings?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                    value={dayjs(walkInTime, 'HH:mm')}
                    onChange={(newValue) => {
                      if (newValue) {
                        setWalkInTime(newValue.format('HH:mm'));
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
                            backgroundColor: '#f9fafb',
                            '& fieldset': {
                              borderColor: '#f3f4f6',
                            },
                            '&:hover fieldset': {
                              borderColor: '#e5e7eb',
                            },
                            '&.Mui-focused fieldset': {
                              borderColor: '#d97706',
                            },
                          },
                        }
                      }
                    }}
                  />
                </div>
                <div className="flex items-end">
                  <button type="button" 
                    onClick={() => setWalkInTime(format(new Date(), 'HH:mm'))}
                    className="w-full py-2 bg-amber-100 text-amber-700 rounded-xl font-bold hover:bg-amber-200 transition-colors"
                  >
                    {t('res.set_now')}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.name')} ({t('common.optional')})</label>
                <input 
                  type="text"
                  maxLength={50}
                  list="customer-names-walkin"
                  value={walkInName}
                  onChange={(e) => {
                    const name = e.target.value;
                    const customer = customers.find(c => c.name === name);
                    setWalkInName(name);
                    if (customer) {
                      setWalkInPhone(customer.phone);
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                  placeholder="e.g. John Doe"
                  className="w-full px-4 py-2 border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50"
                />
                <datalist id="customer-names-walkin">
                  {customers.map((c, i) => (
                    <option key={i} value={c.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.phone')} ({t('common.optional')})</label>
                <div className="w-full px-4 py-1.5 border border-gray-100 rounded-xl focus-within:ring-2 focus-within:ring-amber-500 bg-gray-50">
                  <PhoneInput
                    defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                    value={walkInPhone}
                    onChange={(val) => setWalkInPhone(val || '')}
                    className="w-full text-sm outline-none text-gray-900 bg-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.guests')}</label>
                <div className="flex items-center gap-4">
                  <button type="button" 
                    onClick={() => setWalkInGuests(Math.max(1, walkInGuests - 1))}
                    className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-50"
                  >
                    -
                  </button>
                  <div className="flex-grow text-center text-2xl font-bold">{walkInGuests}</div>
                  <button type="button" 
                    onClick={() => setWalkInGuests(walkInGuests + 1)}
                    className="w-12 h-12 rounded-xl border-2 border-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-50"
                  >
                    +
                  </button>
                </div>
              </div>
              <button type="button" 
                onClick={() => handleWalkIn(showWalkInModal)}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold text-lg hover:bg-green-700 transition-colors shadow-lg shadow-green-100 mt-2"
              >
                {t('res.walkin_confirm')}
              </button>
            </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Reservation Detail Modal */}
      <AnimatePresence>
      {selectedRes && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4 overflow-hidden">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
              <h3 className="text-2xl font-bold">{t('res.edit') || "Edit Reservation"}</h3>
              <button type="button" 
                onClick={() => setSelectedRes(null)}
                className="text-gray-400 hover:text-gray-600 p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto flex-1">
            <div className="mb-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 font-bold text-2xl">
                  {selectedRes.customerName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-2xl font-bold text-gray-900">{selectedRes.customerName}</h3>
                    {(() => {
                      if (selectedRes.tableId && !selectedRes.isWaitlist && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(selectedRes.status)) {
                        const conflict = checkOverlap(selectedRes.id, selectedRes.tableId, selectedRes.time);
                        if (conflict && !['cancelled', 'completed', 'no-show', 'blocked', 'waiting-list'].includes(conflict.status)) {
                          return (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-red-100 text-red-800 text-[9px] font-bold uppercase rounded border border-red-200/50 animate-pulse">
                              <AlertCircle size={9} strokeWidth={3} />
                              {language === 'en' ? 'Time Conflict' : 'Conflito de Horário'}
                            </span>
                          );
                        }
                      }
                      return null;
                    })()}
                  </div>
                  <div className="flex items-center gap-2 text-amber-600 font-medium">
                    <CalendarIcon size={16} />
                    <span>{selectedRes.date} at {formatDisplayTime(selectedRes.time, settings)}</span>
                  </div>
                  {selectedRes.bookingNumber && (
                    <div className="flex items-center gap-2 text-gray-500 font-medium mt-1">
                      <span className="text-xs uppercase tracking-wider font-bold">Res #:</span>
                      <span className="text-sm bg-gray-100 px-2 py-0.5 rounded-md">{selectedRes.bookingNumber}</span>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(selectedRes.bookingNumber);
                        }}
                        className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy Reservation Number"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">{t('common.time')}</div>
                  <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                    ampm={settings?.timeFormat === '12h'}
                    format={settings?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                    value={dayjs(selectedRes.time, 'HH:mm')}
                    onChange={(newValue) => {
                      if (newValue) handleTimeChange(selectedRes.id, newValue.format('HH:mm'));
                    }}
                    slotProps={{
                      textField: {
                        variant: 'standard',
                        fullWidth: true,
                        sx: { 
                          '& .MuiInput-input': { 
                            fontSize: '1.125rem',
                            fontWeight: 700,
                            padding: 0
                          },
                          '& .MuiInput-underline:before, & .MuiInput-underline:after': { display: 'none' }
                        }
                      }
                    }}
                  />
                </div>
                <div className="p-3 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">{t('common.guests')}</div>
                  <div className="flex items-center gap-3">
                    <button type="button" 
                      onClick={() => handleGuestsChange(selectedRes.id, Math.max(1, selectedRes.guests - 1))}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold"
                    >
                      -
                    </button>
                    <div className="text-lg font-bold text-gray-900 flex items-center gap-2">
                      <Users size={18} className="text-amber-600" />
                      {selectedRes.guests}
                    </div>
                    <button type="button" 
                      onClick={() => handleGuestsChange(selectedRes.id, selectedRes.guests + 1)}
                      className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <CustomDropdown 
                  label={t('common.status')}
                  value={selectedRes.status}
                  onChange={(val) => handleStatusChange(selectedRes.id, val)}
                  options={[
                    { value: 'pending', label: t('res.pending'), colorDot: 'bg-amber-500' },
                    { value: 'booked', label: t('res.booked'), colorDot: 'bg-blue-500' },
                    { value: 'confirmed', label: t('res.confirmed'), colorDot: 'bg-green-500' },
                    { value: 'delayed', label: t('res.delayed') || "Delayed", colorDot: 'bg-orange-500' },
                    { value: 'arrived', label: t('res.arrived'), colorDot: 'bg-green-600' },
                    { value: 'no-show', label: t('res.no_show') || t('res.no-show') || "No-show", colorDot: 'bg-gray-500' },
                    { value: 'completed', label: t('res.completed'), colorDot: 'bg-yellow-400' },
                    { value: 'cancelled', label: t('res.cancelled'), colorDot: 'bg-red-500' },
                    { value: 'waiting-list', label: t('res.waiting-list'), colorDot: 'bg-gray-400' },
                  ]}
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-2xl border border-amber-100 mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-900">{t('res.waitlist')}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={selectedRes.isWaitlist || false}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      const updatedStatus = (isChecked ? 'waiting-list' : (selectedRes.status === 'waiting-list' ? 'confirmed' : selectedRes.status)) as Reservation['status'];
                      const updated = { ...selectedRes, isWaitlist: isChecked, status: updatedStatus, tableId: isChecked ? "" : selectedRes.tableId };
                      updateReservation(selectedRes.id, updated);
                      setSelectedRes(updated);
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                </label>
              </div>

              <div className="p-3 bg-green-50 rounded-2xl border border-green-100 mt-3 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-green-900">{language === 'pt' ? 'Mesa Verificada' : 'Table Verified'}</span>
                  <span className="text-[10px] text-green-600 font-medium">
                    {language === 'pt' ? 'Esconder aviso de verificar mesa' : 'Hide verify table number warning'}
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer"
                    checked={!selectedRes.verifyTableNumber}
                    onChange={(e) => {
                      const isChecked = e.target.checked;
                      const updated = { ...selectedRes, verifyTableNumber: !isChecked };
                      updateReservation(selectedRes.id, updated);
                      setSelectedRes(updated);
                      toast.success(isChecked ? (language === 'pt' ? 'Mesa marcada como verificada' : 'Table marked as verified') : (language === 'pt' ? 'Mesa marcada para verificação' : 'Table marked for verification'));
                    }}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 text-gray-600">
                  <Phone size={20} className="text-gray-400" />
                  <span className="font-medium">{selectedRes.customerPhone}</span>
                </div>
                <WhatsAppButton 
                  phone={selectedRes.customerPhone} 
                  customerName={selectedRes.customerName}
                  region={settings?.region}
                  defaultCountryCode={settings?.defaultCountryCode}
                  language={language}
                  iconSize={20}
                  className="bg-green-50 p-2"
                />
              </div>
              <div className="flex items-center gap-4 text-gray-600">
                <Mail size={20} className="text-gray-400" />
                <span className="font-medium">{selectedRes.customerEmail || '—'}</span>
              </div>
              {selectedRes.source === 'public' ? (
                <div className="flex items-center gap-4 text-blue-700 bg-blue-50 p-3 rounded-xl border border-blue-200">
                  <Globe size={20} className="text-blue-500" />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    {language === 'pt' ? 'Reserva Online' : 'Online Booking'}
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-4 text-rose-700 bg-rose-50/50 p-3 rounded-xl border border-rose-100">
                  <Users size={20} className="text-rose-500" />
                  <span className="font-bold text-xs uppercase tracking-wider">
                    {language === 'pt' ? `Criada por Staff #${selectedRes.bookedByStaffNumber || '001'}` : `Created by Staff #${selectedRes.bookedByStaffNumber || '001'}`}
                  </span>
                </div>
              )}
              {selectedRes.notes && (
                <div className="flex items-start gap-4 text-gray-600">
                  <MessageSquare size={20} className="text-gray-400 mt-1" />
                  <p className="bg-amber-50 p-3 rounded-xl text-sm italic border border-amber-100 w-full">
                    "{selectedRes.notes}"
                  </p>
                </div>
              )}
            </div>

            <div className="border-t border-gray-100 pt-6">
              <label className="block text-sm font-bold text-gray-700 mb-3">{t('common.table')} (Sorted)</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => handleTableChange(selectedRes.id, "", "")}
                  className={cn(
                    "p-3 rounded-xl border-2 text-[10px] font-bold transition-all",
                    !selectedRes.tableId 
                      ? "border-amber-600 bg-amber-50 text-amber-700" 
                      : "border-gray-100 hover:border-amber-200 text-gray-500"
                  )}
                >
                  {t('res.no_table')}
                </button>
                {getEffectiveTables(getSessionFromTime(selectedRes.time, selectedRes.manualSession) as any).map(table => (
                  <button
                    type="button"
                    key={table.uniqueKey}
                    onClick={() => handleTableChange(selectedRes.id, table.id, table.name)}
                    className={cn(
                      "p-3 rounded-xl border-2 text-sm font-bold transition-all flex flex-col items-center justify-center gap-1",
                      selectedRes.tableId === table.id && selectedRes.tableName === table.name
                        ? "border-amber-600 bg-amber-50 text-amber-700" 
                        : "border-gray-100 hover:border-amber-200 text-gray-500"
                    )}
                  >
                    <span>{table.name}</span>
                    {(() => {
                      const tableObj = tables.find(t => t.id === table.id);
                      const area = tableObj?.areaId ? areas.find(a => a.id === tableObj.areaId) : null;
                      if (!area) return null;
                      return (
                        <span 
                          style={{ backgroundColor: area.color || '#3B82F6', color: '#ffffff' }}
                          className="text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm"
                        >
                          {area.name}
                        </span>
                      );
                    })()}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-8 space-y-3">
              <button
                type="button"
                onClick={() => {
                  const name = selectedRes.customerName;
                  setSelectedRes(null);
                  navigate(`/admin/reservations?search=${encodeURIComponent(name)}`);
                }}
                className="w-full bg-amber-50 text-amber-700 border border-amber-200 py-4 rounded-2xl font-bold hover:bg-amber-100 transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Eye size={20} />
                {language === 'pt' ? 'Ver na Página de Reservas' : 'See in Reservations Page'}
              </button>
              <button type="button" 
                onClick={() => setSelectedRes(null)}
                className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold hover:bg-gray-800 transition-colors shadow-lg"
              >
                {t('common.close') || 'Close'}
              </button>
            </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      

      {/* New Reservation Modal */}
      <AnimatePresence>
      {showNewResModal && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[120] p-4 overflow-hidden"
          onClick={() => setShowNewResModal(false)}
        >
          <form 
            className="bg-white rounded-3xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => { e.preventDefault(); handleNewReservation(); }}
          >
            <div className="flex-shrink-0 flex items-center justify-between p-6 border-b border-gray-100 bg-white z-10">
              <h3 className="text-2xl font-bold">{t('res.book_table') || (language === 'pt' ? 'Reservar Mesa' : 'Book a Table')}</h3>
              <button type="button" 
                onClick={() => setShowNewResModal(false)}
                className="text-gray-400 hover:text-gray-600 p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.name')}</label>
                  <input 
                    type="text"
                    required
                    maxLength={50}
                    list="customer-names-new"
                    value={newResData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      const customer = customers.find(c => c.name === name);
                      setNewResData({
                        ...newResData, 
                        name: name,
                        phone: customer ? customer.phone : newResData.phone,
                        email: customer ? customer.email : newResData.email,
                        language: customer ? (customer.language || 'en') : newResData.language
                      });
                    }}
                    onKeyDown={(e) => handleKeyDown(e, 50, t('common.name'))}
                    placeholder="Customer Name"
                    className="w-full px-4 py-2 border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50"
                  />
                  <datalist id="customer-names-new">
                    {customers.map((c, i) => (
                      <option key={i} value={c.name} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.phone')}</label>
                  <div className="w-full px-4 py-1.5 border border-gray-100 rounded-xl focus-within:ring-2 focus-within:ring-amber-500 bg-gray-50">
                    <PhoneInput
                      defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                      value={newResData.phone}
                      onChange={(val) => setNewResData({...newResData, phone: val || ''})}
                      className="w-full text-sm outline-none text-gray-900 bg-transparent"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.email')}</label>
                <input 
                  type="email"
                  maxLength={100}
                  value={newResData.email}
                  onChange={(e) => setNewResData({...newResData, email: e.target.value})}
                  onKeyDown={(e) => handleKeyDown(e, 100, t('common.email'))}
                  placeholder="Email Address"
                  className="w-full px-4 py-2 border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.time')}</label>
                  <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                    ampm={settings?.timeFormat === '12h'}
                    format={settings?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                    value={dayjs(newResData.time, 'HH:mm')}
                    onChange={(newValue) => {
                      if (newValue) {
                        setNewResData({...newResData, time: newValue.format('HH:mm')});
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
                            backgroundColor: '#f9fafb',
                            '& fieldset': {
                              borderColor: '#f3f4f6',
                            },
                            '&:hover fieldset': {
                              borderColor: '#e5e7eb',
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
                          checked={newResData.manualSession === 'lunch'}
                          onChange={(e) => setNewResData({
                            ...newResData, 
                            language: 'en',
      manualSession: e.target.checked ? 'lunch' : undefined
                          })}
                          className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3 border-gray-300"
                        />
                        {language === 'pt' ? `Aceitar Almoço (após as ${sessions.lunchTimes.close}H)` : `Accept as Lunch (after ${sessions.lunchTimes.close}H)`}
                      </label>
                    )}
                    {sessions.dinnerTimes?.close && (
                      <label className="flex items-center gap-2 text-[10px] text-gray-500 font-bold uppercase tracking-wider">
                        <input 
                          type="checkbox" 
                          checked={newResData.manualSession === 'dinner'}
                          onChange={(e) => setNewResData({
                            ...newResData, 
                            language: 'en',
      manualSession: e.target.checked ? 'dinner' : undefined
                          })}
                          className="rounded text-amber-600 focus:ring-amber-500 w-3 h-3 border-gray-300"
                        />
                        {language === 'pt' ? `Aceitar Jantar (após as ${sessions.dinnerTimes.close}H)` : `Accept as Dinner (after ${sessions.dinnerTimes.close}H)`}
                      </label>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.guests')}</label>
                  <div className="flex items-center gap-4">
                    <button type="button" 
                      onClick={() => setNewResData({...newResData, guests: Math.max(1, newResData.guests - 1)})}
                      className="w-10 h-10 rounded-xl border-2 border-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-50"
                    >
                      -
                    </button>
                    <div className="flex-grow text-center text-xl font-bold">{newResData.guests}</div>
                    <button type="button" 
                      onClick={() => setNewResData({...newResData, guests: newResData.guests + 1})}
                      className="w-10 h-10 rounded-xl border-2 border-gray-100 flex items-center justify-center text-xl font-bold hover:bg-gray-50"
                    >
                      +
                    </button>
                  </div>

                  {/* Table Verified toggle below number of people */}
                  <div className="p-2.5 bg-green-50 rounded-2xl border border-green-100 flex items-center justify-between mt-2.5">
                    <div className="flex flex-col pr-1">
                      <span className="text-xs font-bold text-green-900">{language === 'pt' ? 'Mesa Verificada' : 'Table Verified'}</span>
                      <span className="text-[10px] text-green-600 font-medium leading-tight">
                        {language === 'pt' ? 'Marcar mesa como confirmada' : 'Mark table as confirmed'}
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={!newResData.verifyTableNumber}
                        onChange={(e) => {
                          setNewResData({...newResData, verifyTableNumber: !e.target.checked});
                        }}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.table')}</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => {
                      setNewResData({...newResData, tableId: "", tableName: "", manualSelection: false});
                      const phoneToFind = newResData.phone?.trim().replace(/\s+/g, '');
      const nameToFind = newResData.name?.trim().toLowerCase();
      const customer = customers.find(c => 
        (phoneToFind && c.phone?.trim().replace(/\s+/g, '') === phoneToFind) ||
        (nameToFind && c.name?.trim().toLowerCase() === nameToFind)
      );
                      const best = findBestTable(newResData.guests, selectedDate, newResData.time, customer?.favoriteTables);
                      if (best) {
                        const tableObj = tables.find(t => t.id === best);
                        setNewResData(prev => ({...prev, tableId: best, tableName: tableObj?.name || "", manualSelection: false}));
                      }
                    }}
                    className={cn(
                      "flex-1 py-3 rounded-xl border-2 font-bold transition-all text-sm flex items-center justify-center gap-2",
                      !newResData.manualSelection
                        ? "border-amber-600 bg-amber-50 text-amber-700" 
                        : "border-gray-100 hover:border-amber-200 text-gray-500"
                    )}
                  >
                    <CheckCircle size={16} />
                    {t('res.auto_assign') || "Auto-assign"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewResData({...newResData, tableId: "", tableName: "", manualSelection: true})}
                    className={cn(
                      "flex-1 py-3 rounded-xl border-2 font-bold transition-all text-sm flex items-center justify-center gap-2",
                      !newResData.tableId && newResData.manualSelection
                        ? "border-red-600 bg-red-50 text-red-700" 
                        : "border-gray-100 hover:border-red-200 text-gray-500"
                    )}
                  >
                    <Ban size={16} />
                    {t('res.no_table') || "No Table"}
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-2 h-40 overflow-y-auto pr-1 custom-scrollbar">
                  {getEffectiveTables(getSessionFromTime(newResData.time, newResData.manualSession) as any).map(table => {
                    return (
                      <button
                        type="button"
                        key={table.uniqueKey}
                        onClick={() => setNewResData({...newResData, tableId: table.id, tableName: table.name, manualSelection: true})}
                        className={cn(
                          "p-2 rounded-xl border-2 text-xs font-bold transition-all flex flex-col items-center justify-center gap-1",
                          newResData.tableId === table.id && newResData.tableName === table.name
                            ? "border-amber-600 bg-amber-50 text-amber-700" 
                            : "border-gray-100 hover:border-amber-200 text-gray-500"
                        )}
                      >
                        <span>{table.name}</span>
                        {(() => {
                          const tableObj = tables.find(t => t.id === table.id);
                          const area = tableObj?.areaId ? areas.find(a => a.id === tableObj.areaId) : null;
                          if (!area) return null;
                          return (
                            <span 
                              style={{ backgroundColor: area.color || '#3B82F6', color: '#ffffff' }}
                              className="text-[8px] font-bold px-1 py-0.5 rounded uppercase tracking-wider shadow-sm"
                            >
                              {area.name}
                            </span>
                          );
                        })()}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">{t('common.notes')}</label>
                <textarea 
                  value={newResData.notes}
                  onChange={(e) => setNewResData({...newResData, notes: e.target.value})}
                  onKeyDown={(e) => handleKeyDown(e, 300, t('common.notes'))}
                  placeholder="Special requests..."
                  maxLength={300}
                  className="w-full px-4 py-2 border border-gray-100 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none bg-gray-50 h-20 resize-none"
                />
              </div>

              <button type="submit"
                disabled={isSubmitting || !newResData.name}
                className="w-full bg-amber-600 text-white py-4 rounded-2xl font-bold hover:bg-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {t('common.loading') || "Loading..."}
                  </>
                ) : (
                  t('res.book_table') || (language === 'pt' ? 'Reservar Mesa' : 'Book a Table')
                )}
              </button>
            </div>
          </form>
        </motion.div>
      )}
      </AnimatePresence>
      

      {/* Fullscreen Floor Plan Modal */}
      <AnimatePresence>
      {fullscreenSession && (
        <motion.div
          id="live-view-fullscreen-floorplan"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className={cn(
            "fixed inset-0 z-[105] flex flex-col p-4 md:p-6 overflow-hidden transition-colors duration-300",
            fullscreenTheme === 'dark' ? "bg-gray-950 text-white" : "bg-white text-gray-900"
          )}
        >
          <div className="flex items-center justify-between mb-4 flex-shrink-0">
            <div className="flex items-center gap-3">
              {(settings?.logoUrl || settings?.cloudinaryLogoUrl) && (
                <div className="bg-white p-[10px] rounded-lg flex items-center justify-center shadow-sm">
                  <img 
                    src={getOptimizedUrl(settings?.logoUrl, settings, 'logo')} 
                    alt="Logo"
                    style={{ height: `${settings?.logoSize || 32}px` }}
                    className="object-contain"
                  />
                </div>
              )}
              <h3 className={cn(
                "text-xl md:text-2xl font-extrabold flex items-center gap-2",
                fullscreenTheme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <Clock className="text-amber-600" size={24} />
                <span>
                  {fullscreenSession === 'lunch' && `${t('common.lunch')} - `}
                  {fullscreenSession === 'dinner' && `${t('common.dinner')} - `}
                  {t('dashboard.live_status')}
                </span>
              </h3>
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                <div className={cn(
                  "flex items-center gap-1 p-1 rounded-lg shadow-sm border hidden sm:flex",
                  fullscreenTheme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
                )}>
                  <button type="button" 
                    onClick={() => {
                      const d = parseISO(selectedDate);
                      setSelectedDate(format(subHours(d, 24), 'yyyy-MM-dd'));
                    }}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      fullscreenTheme === 'dark' ? "hover:bg-gray-800 text-gray-400 hover:text-amber-500" : "hover:bg-gray-100 text-gray-500 hover:text-amber-600"
                    )}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <div className="relative flex items-center justify-center min-w-[90px] group cursor-pointer px-1">
                    <div className={cn(
                      "flex items-center gap-1.5 font-bold justify-center transition-colors pointer-events-none text-sm",
                      fullscreenTheme === 'dark' ? "text-gray-300 group-hover:text-amber-500" : "text-gray-700 group-hover:text-amber-600"
                    )}>
                      <CalendarIcon size={14} className="text-amber-600" />
                      <span>{isToday(parseISO(selectedDate)) ? t('common.today') : format(parseISO(selectedDate), 'dd/MM/yyyy')}</span>
                    </div>
                    <input 
                      type="date"
                        min={new Date().getFullYear() < 2026 ? '2026-01-01' : format(new Date(), 'yyyy-MM-dd')}
                        lang={language === "pt" ? "pt-PT" : "en-US"} 
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                    />
                  </div>
                  <button type="button"
                    onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
                    title={language === 'pt' ? 'Ir para Hoje' : 'Go to Today'}
                    className={cn(
                      "p-1.5 rounded-md transition-colors text-amber-500 hover:text-amber-600",
                      fullscreenTheme === 'dark' ? "hover:bg-gray-800" : "hover:bg-gray-100"
                    )}
                  >
                    <RefreshCw size={14} />
                  </button>
                  <button type="button" 
                    onClick={() => {
                      const d = parseISO(selectedDate);
                      setSelectedDate(format(addHours(d, 24), 'yyyy-MM-dd'));
                    }}
                    className={cn(
                      "p-1.5 rounded-md transition-colors",
                      fullscreenTheme === 'dark' ? "hover:bg-gray-800 text-gray-400 hover:text-amber-500" : "hover:bg-gray-100 text-gray-500 hover:text-amber-600"
                    )}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div className="relative hidden sm:block">
                  <Search size={14} className={cn(
                    "absolute left-2.5 top-1/2 -translate-y-1/2",
                    fullscreenTheme === 'dark' ? "text-gray-400" : "text-gray-400"
                  )} />
                  <input 
                    type="text"
                    placeholder={language === 'pt' ? 'Pesquisar...' : 'Search...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={cn(
                      "pl-8 pr-3 py-1.5 text-sm rounded-lg border w-32 focus:w-48 transition-all duration-300 outline-none",
                      fullscreenTheme === 'dark' 
                        ? "bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-amber-500" 
                        : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-500"
                    )}
                  />
                </div>

                {hasNewBookings && (
                  <div className="relative group/nav">
                    <button
                      onClick={() => {
                        setFullscreenSession(null);
                        navigate('/admin/reservations');
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors cursor-pointer shadow-sm border",
                        fullscreenTheme === 'dark'
                          ? "bg-amber-950/50 text-amber-400 border border-amber-900/30 hover:bg-amber-900/20"
                          : "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100/50"
                      )}
                    >
                      <Sparkles size={14} className="text-amber-500 animate-pulse" />
                      <span className="hidden sm:inline">{language === 'pt' ? 'Novas Reservas' : 'New Bookings'}</span>
                      <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse ml-1" />
                    </button>

                    <div className={cn(
                      "absolute right-0 top-full mt-1 w-80 rounded-xl shadow-xl border p-3 z-[100] pointer-events-none group-hover/nav:pointer-events-auto opacity-0 group-hover/nav:opacity-100 translate-y-2 group-hover/nav:translate-y-0 transition-all duration-200 space-y-2.5 text-left",
                      fullscreenTheme === 'dark'
                        ? "bg-gray-900 border-gray-800 text-white"
                        : "bg-white border-gray-100 text-gray-900"
                    )}>
                      <div className="flex items-center justify-between border-b pb-2 mb-1.5 border-gray-200 dark:border-gray-800">
                        <span className="text-xs font-bold flex items-center gap-1.5">
                          <Sparkles size={13} className="text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                          {language === 'pt' ? 'Novas Reservas' : 'New Bookings'}
                        </span>
                      </div>
                      
                      <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                        {newBookingsList.map((booking) => (
                          <div
                            key={booking.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeNotificationBooking(booking.id);
                              setFullscreenSession(null);
                              navigate(`/admin/reservations?date=${booking.date}&search=${encodeURIComponent(booking.customerName)}`);
                            }}
                            className={cn(
                              "p-2.5 rounded-lg border flex items-center justify-between transition-all hover:border-amber-500/40 cursor-pointer text-left",
                              fullscreenTheme === 'dark'
                                  ? "bg-gray-950/60 border-gray-800/80 hover:bg-gray-950"
                                  : "bg-gray-50 border-gray-200/60 hover:bg-white"
                            )}
                          >
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-xs truncate max-w-[130px]">
                                  {booking.customerName}
                                </span>
                                {booking.date === format(new Date(), 'yyyy-MM-dd') && (
                                  <span className="text-[8px] px-1.5 py-0.2 rounded font-extrabold bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/10">
                                    {language === 'pt' ? 'Hoje' : 'Today'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[9px] text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-0.5">
                                  <CalendarIcon size={10} className="text-amber-500" />
                                  {format(parseISO(booking.date), 'dd/MM/yyyy')} @ {booking.time}
                                </span>
                                <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                                <span className="flex items-center gap-0.5">
                                  <Users size={10} className="text-blue-500" />
                                  {booking.guests}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  removeNotificationBooking(booking.id);
                                  setFullscreenSession(null);
                                  navigate(`/admin/reservations?date=${booking.date}&search=${encodeURIComponent(booking.customerName)}`);
                                }}
                                className="p-1 bg-amber-500/10 text-amber-500 hover:bg-amber-500 hover:text-white rounded transition-colors cursor-pointer"
                                title={language === 'pt' ? 'Ver' : 'See'}
                              >
                                <Eye size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  removeNotificationBooking(booking.id);
                                }}
                                className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded transition-colors cursor-pointer"
                                title={language === 'pt' ? 'Dispensar' : 'Dismiss'}
                              >
                                <X size={12} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    takeScreenshot('live-view-fullscreen-floorplan', settings?.name ? `${settings.name}-LiveView.png` : 'LiveView.png');
                  }}
                  className={cn(
                    "p-1.5 flex items-center justify-center text-sm font-bold rounded-lg transition-colors shadow-sm border no-print cursor-pointer",
                    fullscreenTheme === 'dark' 
                       ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300" 
                       : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                  title={language === 'pt' ? 'Captura de Ecrã' : 'Screenshot'}
                >
                  <Camera size={16} />
                </button>
                <button
                  onClick={() => setFullscreenTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors shadow-sm border",
                    fullscreenTheme === 'dark' 
                      ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-yellow-400" 
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                  title={fullscreenTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {fullscreenTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>
                <button
                  onClick={() => setShowFullscreenReservations(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors shadow-sm border",
                    fullscreenTheme === 'dark'
                      ? (showFullscreenReservations ? "bg-amber-900/40 text-amber-500 border-amber-900/50 hover:bg-amber-900/50" : "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400")
                      : (showFullscreenReservations ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50")
                  )}
                  title={showFullscreenReservations ? (t('dashboard.hide_reservations') || "Hide Reservations") : (t('dashboard.show_reservations') || "Show Reservations")}
                >
                  {showFullscreenReservations ? <EyeOff size={14} /> : <Eye size={14} />}
                  <span className="hidden sm:inline">
                    {showFullscreenReservations 
                      ? (language === 'pt' ? 'Ocultar Reservas' : 'Hide Reservations') 
                      : (language === 'pt' ? 'Mostrar Reservas' : 'Show Reservations')}
                  </span>
                </button>
                <button
                  onClick={() => {
                    setFullscreenSession(null);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 text-sm font-bold rounded-lg transition-colors shadow-sm border",
                    fullscreenTheme === 'dark'
                      ? "bg-gray-800 border-gray-700 text-gray-200 hover:bg-gray-700"
                      : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                  )}
                  title={t('res.decrease_window')}
                >
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>
          </div>
          <div className={cn(
            "flex-grow w-full flex flex-col lg:flex-row overflow-hidden transition-all duration-300 ease-in-out",
            showFullscreenReservations ? "gap-6" : "gap-0"
          )}>
            {/* Left Portion for Floor Plan */}
            <div className={cn(
              "flex-grow overflow-hidden transition-all duration-300 ease-in-out",
              showFullscreenReservations ? "lg:w-[80%] w-full" : "lg:w-full w-full"
            )}>
              {fullscreenSession === 'lunch' && lunchStatuses && renderFloorPlan(lunchStatuses, undefined, 'lunch', true)}
              {fullscreenSession === 'dinner' && dinnerStatuses && renderFloorPlan(dinnerStatuses, undefined, 'dinner', true)}
              {fullscreenSession === 'default' && tableStatuses && renderFloorPlan(tableStatuses, undefined, undefined, true)}
            </div>
            {/* Right Portion for Reservations */}
            <div className={cn(
              "flex-shrink-0 h-full pb-4 transition-all duration-300 ease-in-out",
              showFullscreenReservations 
                ? "w-full lg:w-[20%] opacity-100 pointer-events-auto block" 
                : "w-0 opacity-0 pointer-events-none overflow-hidden h-0 lg:h-full hidden lg:block"
            )}>
              <div className="flex flex-col gap-4 h-full overflow-y-auto custom-scrollbar no-scrollbar pr-2 pb-20">
                {settings?.showLiveUpcomingBox !== false && renderReservationList()}
                {fullscreenSession === 'lunch' && renderReservationList('lunch')}
                {fullscreenSession === 'dinner' && renderReservationList('dinner')}
                {fullscreenSession === 'default' && settings?.showLiveUpcomingBox === false && renderReservationList()}
              </div>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
      

      {/* Area Override Modal */}
      <AnimatePresence>
      {showAreaOverrideModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[120]">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={cn(
              "w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]",
              settings?.theme === 'dark' ? "bg-gray-900 text-white" : "bg-white text-gray-900"
            )}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <div>
                <h3 className="text-xl font-extrabold flex items-center gap-2 text-amber-600">
                  <Globe size={24} />
                  <span>{language === 'pt' ? 'Gerir Opções de Área' : 'Manage Area Options'}</span>
                </h3>
                <p className="text-xs opacity-70 mt-1">
                  {language === 'pt' ? `Configurando regras de reserva para o dia ${format(parseISO(selectedDate), 'dd/MM/yyyy')}` : `Configuring reservation rules specifically for ${format(parseISO(selectedDate), 'dd/MM/yyyy')}`}
                </p>
              </div>
              <button type="button" 
                onClick={() => {
                  setShowAreaOverrideModal(false);
                  setEditingAreaOverrideId(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-grow overflow-y-auto p-6 space-y-6">
              {areas.length === 0 ? (
                <p className="text-center py-8 text-gray-500 font-medium">
                  {language === 'pt' ? 'Nenhuma área cadastrada.' : 'No areas defined yet.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {areas.map((area, index) => {
                    const override = area.dateOverrides?.[selectedDate];
                    const isOverridden = !!override;
                    const effectiveBookingMode = override?.bookingMode !== undefined ? override.bookingMode : area.bookingMode;
                    const effectiveSpecialEventName = override?.specialEventName !== undefined ? override.specialEventName : (area.specialEventName || '');
                    const effectiveSpecialEventSessions = override?.specialEventSessions !== undefined ? override.specialEventSessions : (area.specialEventSessions || ['lunch', 'dinner']);
                    const effectiveSessionMode = override?.sessionMode !== undefined ? override.sessionMode : (area.sessionMode || 'both');
                    const effectiveClosedSessions = override?.closedSessions !== undefined ? override.closedSessions : (area.closedSessions || ['lunch', 'dinner']);
                    const formatShortDate = (dStr) => dStr && dStr.split('-').length === 3 ? `${dStr.split('-')[2]}/${dStr.split('-')[1]}/${dStr.split('-')[0].substring(2)}` : dStr;
                    let activeSessionsLabel = language === 'pt' ? 'Sessões Ativas:' : 'Active Sessions:';
                    let activeSessionsValue = '';
                    if (effectiveBookingMode === 'permanently_closed') {
                       activeSessionsLabel = language === 'pt' ? 'Sessões Inativas:' : 'Inactive Sessions:';
                       activeSessionsValue = language === 'pt' ? 'Ambas' : 'Lunch & Dinner';
                    } else if (effectiveBookingMode === 'closed' && (isOverridden || (area.closedStartDate && area.closedEndDate && selectedDate >= area.closedStartDate && selectedDate <= area.closedEndDate))) {
                       const isLunchClosed = effectiveClosedSessions.includes('lunch');
                       const isDinnerClosed = effectiveClosedSessions.includes('dinner');
                       if (isLunchClosed && isDinnerClosed) {
                          activeSessionsLabel = language === 'pt' ? 'Sessões Inativas:' : 'Inactive Sessions:';
                          activeSessionsValue = language === 'pt' ? 'Ambas' : 'Lunch & Dinner';
                       } else if (isLunchClosed) {
                          activeSessionsLabel = language === 'pt' ? 'Sessões Ativas:' : 'Active Sessions:';
                          activeSessionsValue = language === 'pt' ? 'Apenas Jantar' : 'Only Dinner';
                       } else if (isDinnerClosed) {
                          activeSessionsLabel = language === 'pt' ? 'Sessões Ativas:' : 'Active Sessions:';
                          activeSessionsValue = language === 'pt' ? 'Apenas Almoço' : 'Only Lunch';
                       } else {
                          activeSessionsLabel = language === 'pt' ? 'Sessões Ativas:' : 'Active Sessions:';
                          activeSessionsValue = language === 'pt' ? 'Ambas' : 'Lunch & Dinner';
                       }
                    } else {
                       activeSessionsValue = effectiveSessionMode === 'both' ? (language === 'pt' ? 'Ambas' : 'Lunch & Dinner') :
                                 effectiveSessionMode === 'lunch' ? (language === 'pt' ? 'Apenas Almoço' : 'Only Lunch') :
                                 (language === 'pt' ? 'Apenas Jantar' : 'Only Dinner');
                    }
                    const isEditing = editingAreaOverrideId === area.id;

                    return (
                      <div 
                        key={area.id}
                        draggable
                        onDragStart={(e) => handleAreaDragStart(e, area.id)}
                        onDragOver={(e) => handleAreaDragOver(e, index)}
                        onDrop={(e) => handleAreaDrop(e, index)}
                        className={cn(
                          "p-5 rounded-2xl border-2 transition-all flex flex-col justify-between gap-4 shadow-sm",
                          isOverridden 
                            ? "border-amber-400 bg-amber-50/20" 
                            : "border-gray-100 bg-white",
                          draggedAreaId === area.id && "opacity-50 ring-2 ring-amber-500 bg-amber-50/10"
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              <div 
                                className="cursor-grab active:cursor-grabbing p-1.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100 transition-colors"
                                title={language === 'pt' ? 'Arrastar para reordenar' : 'Drag to reorder'}
                              >
                                <GripVertical size={20} />
                              </div>
                              <span className="font-extrabold text-base tracking-tight">{area.name}</span>
                            </div>
                            {isOverridden ? (
                              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                {language === 'pt' ? 'Alterado' : 'Overridden'}
                              </span>
                            ) : (
                              <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium uppercase tracking-wide">
                                {language === 'pt' ? 'Padrão' : 'Standard'}
                              </span>
                            )}
                          </div>

                          {/* Quick Summary of Active Mode */}
                          <div className="space-y-1.5 text-xs text-gray-600 mb-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                            <div className="flex justify-between">
                              <span>{language === 'pt' ? 'Modo de Reserva:' : 'Booking Mode:'}</span>
                              <span className="font-bold uppercase text-amber-700">
                                {effectiveBookingMode === 'online' ? 'Online & Manual' :
                                 effectiveBookingMode === 'manual' ? (language === 'pt' ? 'Apenas Manual' : 'Manual Only') :
                                 effectiveBookingMode === 'permanently_closed' ? (language === 'pt' ? 'Fechado Permanentemente' : 'Permanently Closed') :
                                 effectiveBookingMode === 'special_event' ? (language === 'pt' ? 'Evento Especial' : 'Special Event') :
                                 effectiveBookingMode === 'closed' ? (
                                   !isOverridden && area.closedStartDate && area.closedEndDate 
                                     ? (language === 'pt' ? `Fechado (${formatShortDate(area.closedStartDate)} a ${formatShortDate(area.closedEndDate)})` : `Closed (${formatShortDate(area.closedStartDate)} to ${formatShortDate(area.closedEndDate)})`)
                                     : (language === 'pt' ? 'Fechado' : 'Closed')
                                 ) : effectiveBookingMode}
                              </span>
                            </div>
                            {effectiveBookingMode === 'special_event' && (
                              <>
                                <div className="flex justify-between">
                                  <span>{language === 'pt' ? 'Nome do Evento:' : 'Event Name:'}</span>
                                  <span className="font-bold text-purple-700">{effectiveSpecialEventName}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>{language === 'pt' ? 'Sem reservas:' : 'No bookings:'}</span>
                                  <span className="font-bold text-purple-700 uppercase">
                                    {effectiveSpecialEventSessions.length === 0 ? (language === 'pt' ? 'Nenhuma' : 'None') : effectiveSpecialEventSessions.join(' & ')}
                                  </span>
                                </div>
                              </>
                            )}
                            <div className="flex justify-between">
                              <span>{activeSessionsLabel}</span>
                              <span className="font-bold uppercase text-amber-700">
                                {activeSessionsValue}
                              </span>
                            </div>
                          </div>

                          {isEditing ? (
                            <div className="space-y-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                              {/* Booking Mode Selector */}
                              <div>
                                <CustomDropdown
                                  size="sm"
                                  label={language === 'pt' ? 'Modo de Reserva' : 'Booking Mode'}
                                  value={editingAreaBookingMode}
                                  onChange={(val) => setEditingAreaBookingMode(val as any)}
                                  options={[
                                    { value: 'online', label: 'Online & Manual', colorDot: 'bg-green-500' },
                                    { value: 'manual', label: language === 'pt' ? 'Apenas Manual' : 'Manual Reservations Only', colorDot: 'bg-amber-500' },
                                    { value: 'closed', label: language === 'pt' ? 'Fechado' : 'Closed', colorDot: 'bg-red-500' },
                                    { value: 'permanently_closed', label: language === 'pt' ? 'Fechado Permanentemente' : 'Permanently Closed', colorDot: 'bg-gray-500' },
                                    { value: 'special_event', label: language === 'pt' ? 'Evento Especial' : 'Special Event', colorDot: 'bg-purple-500' },
                                  ]}
                                />
                              </div>

                              {/* Special Event Input & Session checkboxes */}
                              {editingAreaBookingMode === 'special_event' && (
                                <>
                                  <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1">
                                      {language === 'pt' ? 'Nome do Evento Especial' : 'Special Event Name'}
                                    </label>
                                    <input
                                      type="text"
                                      value={editingAreaSpecialEventName}
                                      onChange={(e) => setEditingAreaSpecialEventName(e.target.value)}
                                      placeholder="Ex: Jazz Night, Casamento..."
                                      className="w-full text-xs font-medium border border-gray-300 rounded-lg p-2 bg-white text-gray-900"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <label className="block text-xs font-bold text-gray-700">
                                      {language === 'pt' ? 'Sem reservas (Bloquear Reservas Online)' : 'No bookings (Block Online Reservations)'}
                                    </label>
                                    <div className="flex gap-4">
                                      <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editingAreaSpecialEventSessions.includes('lunch')}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setEditingAreaSpecialEventSessions([...editingAreaSpecialEventSessions, 'lunch']);
                                            } else {
                                              setEditingAreaSpecialEventSessions(editingAreaSpecialEventSessions.filter(s => s !== 'lunch'));
                                            }
                                          }}
                                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                                        />
                                        <span>{language === 'pt' ? 'Almoço' : 'Lunch'}</span>
                                      </label>
                                      <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editingAreaSpecialEventSessions.includes('dinner')}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setEditingAreaSpecialEventSessions([...editingAreaSpecialEventSessions, 'dinner']);
                                            } else {
                                              setEditingAreaSpecialEventSessions(editingAreaSpecialEventSessions.filter(s => s !== 'dinner'));
                                            }
                                          }}
                                          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 w-4 h-4"
                                        />
                                        <span>{language === 'pt' ? 'Jantar' : 'Dinner'}</span>
                                      </label>
                                    </div>
                                  </div>
                                </>
                              )}

                              {/* Closed Sessions Selector */}
                              {editingAreaBookingMode === 'closed' && (
                                  <div className="space-y-1.5 p-3 bg-red-50/50 rounded-xl border border-red-100">
                                    <label className="block text-xs font-bold text-gray-700">
                                      {language === 'pt' ? 'Fechar para:' : 'Close for:'}
                                    </label>
                                    <div className="flex gap-4">
                                      <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editingAreaClosedSessions.includes('lunch')}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setEditingAreaClosedSessions([...editingAreaClosedSessions, 'lunch']);
                                            } else {
                                              setEditingAreaClosedSessions(editingAreaClosedSessions.filter(s => s !== 'lunch'));
                                            }
                                          }}
                                          className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
                                        />
                                        <span>{language === 'pt' ? 'Almoço' : 'Lunch'}</span>
                                      </label>
                                      <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={editingAreaClosedSessions.includes('dinner')}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              setEditingAreaClosedSessions([...editingAreaClosedSessions, 'dinner']);
                                            } else {
                                              setEditingAreaClosedSessions(editingAreaClosedSessions.filter(s => s !== 'dinner'));
                                            }
                                          }}
                                          className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
                                        />
                                        <span>{language === 'pt' ? 'Jantar' : 'Dinner'}</span>
                                      </label>
                                    </div>
                                  </div>
                              )}

                              {/* Session Mode Selector */}
                              <div>
                                <CustomDropdown
                                  size="sm"
                                  label={language === 'pt' ? 'Sessões Ativas' : 'Active Sessions'}
                                  value={editingAreaSessionMode}
                                  onChange={(val) => setEditingAreaSessionMode(val as any)}
                                  options={[
                                    { value: 'both', label: language === 'pt' ? 'Ambas (Almoço & Jantar)' : 'Both (Lunch & Dinner)' },
                                    { value: 'lunch', label: language === 'pt' ? 'Apenas Almoço' : 'Only Lunch' },
                                    { value: 'dinner', label: language === 'pt' ? 'Apenas Jantar' : 'Only Dinner' },
                                  ]}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>

                        {/* Action buttons */}
                        <div className="flex gap-2 justify-end mt-2">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => setEditingAreaOverrideId(null)}
                                className="px-3 py-1.5 text-xs font-bold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                {language === 'pt' ? 'Cancelar' : 'Cancel'}
                              </button>
                              <button
                                onClick={async () => {
                                  try {
                                    const dateOverrides = { ...(area.dateOverrides || {}) };
                                    const currentOverride = dateOverrides[selectedDate] || {};
                                    dateOverrides[selectedDate] = {
                                      ...currentOverride,
                                      bookingMode: editingAreaBookingMode,
                                      specialEventName: editingAreaBookingMode === 'special_event' ? editingAreaSpecialEventName : '',
                                      specialEventSessions: editingAreaBookingMode === 'special_event' ? editingAreaSpecialEventSessions : [],
                                      sessionMode: editingAreaSessionMode,
closedSessions: editingAreaBookingMode === 'closed' ? editingAreaClosedSessions : [],
                                    };

                                    await updateArea(area.id, { dateOverrides });
                                    toast.success(language === 'pt' ? 'Configuração salva para hoje!' : 'Settings successfully saved for this date!');
                                    setEditingAreaOverrideId(null);
                                  } catch (err) {
                                    console.error(err);
                                    toast.error('Error saving settings');
                                  }
                                }}
                                className="px-3 py-1.5 text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 rounded-lg transition-colors shadow-sm"
                              >
                                {language === 'pt' ? 'Salvar' : 'Save'}
                              </button>
                            </>
                          ) : (
                            <>
                              {isOverridden && (
                                <button
                                  onClick={async () => {
                                    try {
                                      const dateOverrides = { ...(area.dateOverrides || {}) };
                                      delete dateOverrides[selectedDate];
                                      await updateArea(area.id, { dateOverrides });
                                      toast.success(language === 'pt' ? 'Restaurado para o padrão!' : 'Reset to default successfully!');
                                    } catch (err) {
                                      console.error(err);
                                      toast.error('Error resetting');
                                    }
                                  }}
                                  className="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                >
                                  {language === 'pt' ? 'Padrão' : 'Reset'}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setEditingAreaOverrideId(area.id);
setEditingAreaBookingMode(effectiveBookingMode);
setEditingAreaSpecialEventName(effectiveSpecialEventName);
setEditingAreaSpecialEventSessions(effectiveSpecialEventSessions);
setEditingAreaSessionMode(effectiveSessionMode);
setEditingAreaClosedSessions(override?.closedSessions !== undefined ? override.closedSessions : (area.closedSessions || ['lunch', 'dinner']));
                                }}
                                className="px-3 py-1.5 text-xs font-bold bg-gray-100 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                              >
                                {language === 'pt' ? 'Editar para este dia' : 'Configure Day'}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex justify-end p-6 border-t border-gray-100 bg-gray-50/50">
              <button
                onClick={() => {
                  setShowAreaOverrideModal(false);
                  setEditingAreaOverrideId(null);
                }}
                className="px-6 py-2 rounded-xl font-bold bg-amber-600 text-white hover:bg-amber-700 transition-colors shadow-sm"
              >
                {language === 'pt' ? 'Fechar' : 'Close'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>
      <ConfirmationDialog />
    </div>
  );
}
