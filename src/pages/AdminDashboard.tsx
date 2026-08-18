import { motion, AnimatePresence } from 'motion/react';
import React from 'react';
import { useReservations } from '../hooks/useReservations';
import { useSmartAlerts } from '../hooks/useSmartAlerts';
import { useTables } from '../hooks/useTables';
import { useCustomers } from '../hooks/useCustomers';
import { useLanguage } from '../hooks/useLanguage';
import { pt } from 'date-fns/locale';
import { format, isToday, parseISO, addMinutes, isBefore, isSameDay } from 'date-fns';
import { Calendar, Sun, Moon, Minimize2, Users, Map, TrendingUp, Clock, CheckCircle, XCircle, Lock, Eye, EyeOff, Pencil, X, AlertCircle, Search, Globe, Copy, Check, User, ArrowLeft, ArrowLeftToLine, Trash2, AlertTriangle, Settings, ChevronDown } from 'lucide-react';
import { MdTableRestaurant } from 'react-icons/md';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { cn, formatDisplayTime, getEffectiveOpeningHours } from '../lib/utils';
import { toast } from 'react-hot-toast';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { TimePicker } from '@mui/x-date-pickers';
import { renderTimeViewClock } from '@mui/x-date-pickers';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { Customer } from '../types';

dayjs.extend(customParseFormat);

const MONTH_OPTIONS = [
  { value: '01', pt: 'Janeiro', en: 'January' },
  { value: '02', pt: 'Fevereiro', en: 'February' },
  { value: '03', pt: 'Março', en: 'March' },
  { value: '04', pt: 'Abril', en: 'April' },
  { value: '05', pt: 'Maio', en: 'May' },
  { value: '06', pt: 'Junho', en: 'June' },
  { value: '07', pt: 'Julho', en: 'July' },
  { value: '08', pt: 'Agosto', en: 'August' },
  { value: '09', pt: 'Setembro', en: 'September' },
  { value: '10', pt: 'Outubro', en: 'October' },
  { value: '11', pt: 'Novembro', en: 'November' },
  { value: '12', pt: 'Dezembro', en: 'December' },
];

const getTranslatedAlertTitle = (title: string, lang: string) => {
  if (lang === 'pt') {
    if (title === 'Possible Duplicate Reservations') return 'Possíveis Reservas Duplicadas';
    if (title === 'Duplicate Reservations') return 'Reservas Duplicadas';
    if (title === 'Table Assignment Verify') return 'Verificar Atribuição de Mesa';
    if (title === 'Reservation Cancelled') return 'Reserva Cancelada';
    if (title === 'Time Conflict') return 'Conflito de Horário';
    if (title === 'Capacity Alert') return 'Alerta de Lotação';
    if (title === 'Reservation Deleted') return 'Reserva Apagada';
  }
  return title;
};

const getTranslatedAlertMessage = (alert: any, lang: string) => {
  if (lang === 'pt') {
    if (alert.type === 'capacity_alert') {
      const matchRest = alert.message.match(/The restaurant reached (\d+)% capacity for (.+) on (.+) \((\d+)\/(\d+) guests\)\./);
      if (matchRest) {
        const session = matchRest[2].toLowerCase() === 'lunch' ? 'almoço' : 'jantar';
        return `O restaurante atingiu ${matchRest[1]}% de lotação para o ${session} em ${matchRest[3]} (${matchRest[4]}/${matchRest[5]} lugares).`;
      }
      const matchSection = alert.message.match(/The section "(.+)" reached (\d+)% capacity for (.+) on (.+) \((\d+)\/(\d+) guests\)\./);
      if (matchSection) {
        const session = matchSection[3].toLowerCase() === 'lunch' ? 'almoço' : 'jantar';
        return `A secção "${matchSection[1]}" atingiu ${matchSection[2]}% de lotação para o ${session} em ${matchSection[4]} (${matchSection[5]}/${matchSection[6]} lugares).`;
      }
    }
    if (alert.type === 'duplicate_reservation') {
      const matchNew = alert.message.match(/The system found (\d+) reservations using the email (.+) for (.+) on (.+)\./);
      if (matchNew) {
         const session = matchNew[3].toLowerCase() === 'lunch' ? 'almoço' : 'jantar';
         return `O sistema encontrou ${matchNew[1]} reservas usando o e-mail ${matchNew[2]} para ${session} em ${matchNew[4]}.`;
      }
      const matchName = alert.message.match(/The system found (\d+) reservations using the name (.+) for (.+) on (.+)\./);
      if (matchName) {
         const session = matchName[3].toLowerCase() === 'lunch' ? 'almoço' : 'jantar';
         return `O sistema encontrou ${matchName[1]} reservas usando o nome ${matchName[2]} para ${session} em ${matchName[4]}.`;
      }
      const matchOld = alert.message.match(/Customer (.+) has (\d+) reservations for (.+) (.+)\./);
      if (matchOld) {
         const session = matchOld[4].toLowerCase() === 'lunch' ? 'almoço' : 'jantar';
         return `O cliente ${matchOld[1]} tem ${matchOld[2]} reservas para ${matchOld[3]} ${session}.`;
      }
    }
    if (alert.type === 'table_assignment_verify') {
      const match = alert.message.match(/Reservation for (.+) on (.+) requires table verification\./);
      if (match) {
        return `A reserva de ${match[1]} no dia ${match[2]} requer verificação de mesa.`;
      }
    }
    if (alert.type === 'cancelled_by_customer') {
      const match = alert.message.match(/Customer (.+) cancelled their reservation for (.+) at (.+)\./);
      if (match) {
        return `O cliente ${match[1]} cancelou a reserva para ${match[2]} às ${match[3]}.`;
      }
    }

    if (alert.type === 'time_conflict') {
      const match = alert.message.match(/Time conflict detected on (.+) between the customers (.+) during (.+) on (.+)\./);
      if (match) {
        let tableName = match[1];
        if (tableName === 'a Table') {
           tableName = 'numa Mesa';
        } else if (tableName.startsWith('Table ')) {
           tableName = 'na Mesa ' + tableName.replace('Table ', '');
        }
        const customerNames = match[2].replace(' and ', ' e ');
        const session = match[3].toLowerCase() === 'lunch' ? 'almoço' : 'jantar';
        return `Conflito de horário detetado ${tableName} entre os clientes ${customerNames} durante o ${session} a ${match[4]}.`;
      }
    }
  }
  return alert.message;
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user, isStaff, isAdmin } = useAuth();
  const { settings } = useSettings();
  const { reservations, updateReservation, loading: resLoading } = useReservations({ includeAll: true });
  const { tables, loading: tablesLoading } = useTables();
  const { customers, loading: custLoading } = useCustomers();
  const { t, language } = useLanguage();

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayReservations = reservations.filter(r => r.date === todayStr);
  const pendingReservations = reservations.filter(r => r.status === 'pending' || r.status === 'booked');
  const availableTablesToday = tables.filter(t => t.status === 'available');

  const getSessionFromTime = (time: string, dateStr: string, manualSession?: 'lunch' | 'dinner') => {
    if (manualSession) return manualSession;
    if (!settings) return 'general';
    const eff = getEffectiveOpeningHours(dateStr, settings);
    const lunch = eff.lunch;
    const dinner = eff.dinner;

    if (lunch?.active && time >= lunch.open && time < lunch.close) return 'lunch';
    if (dinner?.active && time >= dinner.open && time < dinner.close) return 'dinner';
    return 'general';
  };

  const lunchReservations = todayReservations.filter(r => getSessionFromTime(r.time, r.date, (r as any).manualSession) === 'lunch');
  const dinnerReservations = todayReservations.filter(r => getSessionFromTime(r.time, r.date, (r as any).manualSession) === 'dinner');
  const generalReservations = todayReservations.filter(r => {
    const session = getSessionFromTime(r.time, r.date, (r as any).manualSession);
    return session !== 'lunch' && session !== 'dinner';
  });

  const [registeredUsers, setRegisteredUsers] = React.useState<Record<string, { id?: string; email: string; status: string; createdAt?: any }>>({});

  React.useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersMap: Record<string, { id?: string; email: string; status: string; createdAt?: any }> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.role === 'customer') {
          usersMap[doc.id] = {
            id: doc.id,
            email: data.email || '',
            status: data.status || 'active',
            createdAt: data.createdAt
          };
          if (data.email) {
            usersMap[data.email.toLowerCase()] = {
              id: doc.id,
              email: data.email,
              status: data.status || 'active',
              createdAt: data.createdAt
            };
          }
        }
      });
      setRegisteredUsers(usersMap);
    }, (error) => {
      console.warn('Could not subscribe to users collection in dashboard. Falling back to isRegistered flags.', error);
    });

    return () => unsubscribe();
  }, []);

  const isCustomerRegistered = (c: Customer) => {
    return !!(c.isRegistered || registeredUsers[c.id] || (c.email && registeredUsers[c.email.toLowerCase()]));
  };

  const onlineCustomersCount = customers.filter(isCustomerRegistered).length;
  const manualCustomersCount = Math.max(0, customers.length - onlineCustomersCount);


  const { smartAlerts: activeSmartAlerts, allSmartAlerts, dismissAlert, resolveAlert, deleteAlert } = useSmartAlerts();
  const [showSmartAlertsModal, setShowSmartAlertsModal] = React.useState(false);
  const [alertStatusFilter, setAlertStatusFilter] = React.useState('active');
  const [alertToResolve, setAlertToResolve] = React.useState<string | null>(null);
  const [alertToDelete, setAlertToDelete] = React.useState<string | null>(null);
  const [alertTypeFilter, setAlertTypeFilter] = React.useState('all');
  
  const previousAlertCount = React.useRef(0);
  React.useEffect(() => {
    // if (activeSmartAlerts.length > previousAlertCount.current) {
    //    setShowSmartAlertsModal(true);
    // }
    previousAlertCount.current = activeSmartAlerts.length;
    localStorage.setItem('smartAlertsCount', activeSmartAlerts.length.toString());
    window.dispatchEvent(new Event('smartAlertsUpdated'));
  }, [activeSmartAlerts.length]);

  React.useEffect(() => {
    if (showSmartAlertsModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [showSmartAlertsModal, activeSmartAlerts.length, alertStatusFilter]);

  const handleDismissAlert = async (id: string) => {
    await dismissAlert(id);
  };

  const DashboardSessionStats = ({ resCount, guestCount }: { resCount: number, guestCount: number }) => {
    const totalCapacity = tables.reduce((acc, t) => acc + (t.seats || 0), 0);
    const occupancyRate = totalCapacity > 0 ? Math.round((guestCount / totalCapacity) * 100) : 0;
    
    let occupancyColor = "text-emerald-600 dark:text-emerald-400";
    if (occupancyRate > 80) occupancyColor = "text-rose-600 dark:text-rose-400";
    else if (occupancyRate > 60) occupancyColor = "text-orange-600 dark:text-orange-400";
    else if (occupancyRate > 35) occupancyColor = "text-amber-600 dark:text-amber-400";

    return (
      <div className={cn(
        "flex items-center justify-between w-[120px] px-1.5 py-0.5 rounded-md border shadow-xs flex-shrink-0",
        settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-1" title={language === 'pt' ? 'Total de Reservas' : 'Total Bookings'}>
          <Calendar size={11} className="text-amber-600 dark:text-amber-500 shrink-0" />
          <span className={cn("text-[10px] font-bold", settings?.theme === 'dark' ? "text-gray-200" : "text-gray-800")}>{resCount}</span>
        </div>
        <div className={cn("flex items-center gap-1 border-l pl-1.5", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")} title={language === 'pt' ? 'Total de Pessoas' : 'Total Guests'}>
          <Users size={11} className="text-amber-600 dark:text-amber-500 shrink-0" />
          <span className={cn("text-[10px] font-bold", settings?.theme === 'dark' ? "text-gray-200" : "text-gray-800")}>{guestCount}</span>
        </div>
        {totalCapacity > 0 && (
          <div className={cn("flex items-center gap-1 border-l pl-1.5", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")}>
            <div className="flex items-center text-amber-600 dark:text-amber-500 shrink-0">
              <Users size={9} />
              <Users size={9} className="-ml-0.5" />
            </div>
            <span className={`text-[10px] font-bold ${occupancyColor}`} title={language === 'pt' ? 'Taxa de Ocupação' : 'Occupancy Rate'}>
              {occupancyRate}%
            </span>
          </div>
        )}
      </div>
    );
  };

  const DashboardTableSessionStats = ({ session }: { session: 'lunch' | 'dinner' }) => {
    const sessionRes = (session === 'lunch' ? lunchReservations : dinnerReservations).filter(
      r => r.status !== 'cancelled'
    );

    let freeCount = 0;
    let partialCount = 0;
    let busyCount = 0;

    const activeTables = tables.filter(t => {
      if (t.isActive === false) return false;
      if (t.activeSessions && t.activeSessions[session] === false) return false;
      if (t.isExtra) {
        const isAvail = (t.availableDate && t.availableDate === todayStr) ||
          (t.availableDates && t.availableDates.includes(todayStr));
        if (!isAvail) return false;
        if (t.extraAvailability?.[todayStr] && t.extraAvailability[todayStr][session] === false) return false;
        if (t.extraSessions && t.extraSessions[session] === false) return false;
      } else if (t.availableDate && t.availableDate > todayStr) {
        return false;
      }
      return true;
    });

    activeTables.forEach(table => {
      const isBlocked = table.isBlocked ||
        table.blockedDates?.[todayStr]?.[session] ||
        table.blockedDates?.[todayStr]?.default ||
        sessionRes.some(r => r.status === 'blocked' && (r.tableId === table.id || r.tableId?.split(/[,/]/).map(s => s.trim()).includes(table.id)));

      if (isBlocked) {
        busyCount++;
        return;
      }

      const resCount = sessionRes.filter(r => 
        r.status !== 'blocked' && (r.tableId === table.id || r.tableId?.split(/[,/]/).map(s => s.trim()).includes(table.id))
      ).length;

      if (resCount === 0) {
        freeCount++;
      } else if (resCount === 1) {
        partialCount++;
      } else {
        busyCount++;
      }
    });

    return (
      <div className={cn(
        "flex items-center justify-between w-[95px] px-1.5 py-0.5 rounded-md border shadow-xs flex-shrink-0",
        settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        {/* Green: Free Tables */}
        <div 
          className="flex items-center gap-1" 
          title={language === 'pt' ? `Mesas Livres: ${freeCount}` : `Free Tables: ${freeCount}`}
        >
          <MdTableRestaurant size={11} className="text-emerald-500 shrink-0" />
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
            {freeCount}
          </span>
        </div>

        {/* Yellow: Partially Booked (1 booking) */}
        <div 
          className={cn("flex items-center gap-1 border-l pl-1.5", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")} 
          title={language === 'pt' ? `Mesas Parcialmente Ocupadas (1 reserva): ${partialCount}` : `Partially Booked Tables (1 booking): ${partialCount}`}
        >
          <MdTableRestaurant size={11} className="text-yellow-500 dark:text-yellow-400 shrink-0" />
          <span className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400">
            {partialCount}
          </span>
        </div>

        {/* Red: 2 or more bookings already */}
        <div 
          className={cn("flex items-center gap-1 border-l pl-1.5", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")} 
          title={language === 'pt' ? `Mesas com 2+ Reservas / Bloqueadas: ${busyCount}` : `Tables with 2+ Bookings / Blocked: ${busyCount}`}
        >
          <MdTableRestaurant size={11} className="text-rose-500 shrink-0" />
          <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400">
            {busyCount}
          </span>
        </div>
      </div>
    );
  };

  const DashboardUpcomingMonthStats = () => {
    const currentMonthKey = todayStr ? todayStr.slice(0, 7) : '';
    const validUpcoming = reservations.filter(
      r => r.date && typeof r.date === 'string' && r.date > todayStr && !['cancelled', 'blocked', 'completed', 'no-show'].includes(r.status)
    );
    const currentMonthUpcoming = validUpcoming.filter(r => r.date && r.date.startsWith(currentMonthKey));
    const nextMonthsUpcoming = validUpcoming.filter(r => r.date && !r.date.startsWith(currentMonthKey));

    let currentMonthName = '';
    try {
      const rawMonthName = format(new Date(), 'MMMM', { locale: language === 'pt' ? pt : undefined });
      currentMonthName = rawMonthName.charAt(0).toUpperCase() + rawMonthName.slice(1);
    } catch {
      currentMonthName = language === 'pt' ? 'Este Mês' : 'This Month';
    }

    return (
      <div className="flex flex-col gap-1 ml-2.5">
        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-amber-500 shrink-0" />
          <div 
            className={cn(
              "flex items-center justify-between w-[95px] px-1.5 py-0.5 rounded-md border shadow-xs flex-shrink-0",
              settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
            )}
            title={language === 'pt' ? `Reservas em ${currentMonthName}: ${currentMonthUpcoming.length}` : `Bookings in ${currentMonthName}: ${currentMonthUpcoming.length}`}
          >
            <span className={cn("text-[10px] font-semibold truncate", settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
              {currentMonthName}
            </span>
            <div className={cn("flex items-center justify-center border-l pl-1.5 min-w-[22px]", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")}>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {currentMonthUpcoming.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Calendar size={13} className="text-amber-500 shrink-0" />
          <div 
            className={cn(
              "flex items-center justify-between w-[95px] px-1.5 py-0.5 rounded-md border shadow-xs flex-shrink-0",
              settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
            )}
            title={language === 'pt' ? `Reservas nos Próximos Meses: ${nextMonthsUpcoming.length}` : `Bookings in Next Months: ${nextMonthsUpcoming.length}`}
          >
            <span className={cn("text-[10px] font-semibold truncate", settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
              {language === 'pt' ? 'Próximos' : 'Next'}
            </span>
            <div className={cn("flex items-center justify-center border-l pl-1.5 min-w-[22px]", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")}>
              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                {nextMonthsUpcoming.length}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const DashboardCustomerStats = () => {
    return (
      <div className="flex flex-col gap-1 ml-2.5">
        <div className="flex items-center gap-1.5">
          <Pencil size={13} className="text-amber-500 shrink-0" />
          <div 
            className={cn(
              "flex items-center justify-between w-[95px] px-1.5 py-0.5 rounded-md border shadow-xs flex-shrink-0",
              settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
            )}
            title={language === 'pt' ? `Clientes Criados Manualmente: ${manualCustomersCount}` : `Manual Customers: ${manualCustomersCount}`}
          >
            <span className={cn("text-[10px] font-semibold truncate", settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
              {language === 'pt' ? 'Manual' : 'Manual'}
            </span>
            <div className={cn("flex items-center justify-center border-l pl-1.5 min-w-[22px]", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")}>
              <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {manualCustomersCount}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Globe size={13} className="text-emerald-500 shrink-0" />
          <div 
            className={cn(
              "flex items-center justify-between w-[95px] px-1.5 py-0.5 rounded-md border shadow-xs flex-shrink-0",
              settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
            )}
            title={language === 'pt' ? `Clientes Registados Online: ${onlineCustomersCount}` : `Online Customers: ${onlineCustomersCount}`}
          >
            <span className={cn("text-[10px] font-semibold truncate", settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700")}>
              {language === 'pt' ? 'Online' : 'Online'}
            </span>
            <div className={cn("flex items-center justify-center border-l pl-1.5 min-w-[22px]", settings?.theme === 'dark' ? "border-gray-800" : "border-gray-200")}>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {onlineCustomersCount}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderReservationItem = (res: any, forceSearchByEmail: boolean = false) => {
    const isRegular = res.isRegularCustomer || customers.some(c => 
      c.isRegular && (
        (c.id === res.customerUid) || 
        (c.email && res.customerEmail && c.email.trim().toLowerCase() === res.customerEmail.trim().toLowerCase()) ||
        (c.phone && res.customerPhone && c.phone === res.customerPhone) ||
        (c.name && res.customerName && c.name.trim().toLowerCase() === res.customerName.trim().toLowerCase())
      )
    );

    const handleCardClick = () => {
      if (forceSearchByEmail && res.date) {
        const query = res.customerEmail ? `&search=${encodeURIComponent(res.customerEmail)}` : '';
        navigate(`/admin/reservations?date=${res.date}${query}`);
      } else if (viewingMonthPage && res.date) {
        const query = res.customerName ? `&search=${encodeURIComponent(res.customerName)}` : '';
        navigate(`/admin/reservations?date=${res.date}${query}`);
      }
    };

    const formattedTimeStr = formatDisplayTime(res.time, settings);
    const isAmPm = settings?.timeFormat === '12h' || formattedTimeStr.includes('AM') || formattedTimeStr.includes('PM');

    return (
      <div 
        key={res.id} 
        onClick={handleCardClick}
        className={cn(
          "flex w-full p-3 rounded-xl transition-colors",
          (viewingMonthPage || forceSearchByEmail) && "cursor-pointer hover:ring-2 hover:ring-amber-500/40",
          settings?.theme === 'dark' ? "bg-gray-900/40 hover:bg-gray-900/60" : "bg-gray-50 hover:bg-gray-100/70"
        )}
      >
        {/* Time block */}
        <div className={cn(
          isAmPm ? "w-[22%]" : "w-[16%]",
          "shrink-0 flex items-center justify-start pr-2"
        )}>
          <div className={cn(
            "h-10 bg-white rounded-lg flex items-center justify-center font-bold text-amber-600 shadow-sm flex-shrink-0 whitespace-nowrap px-1",
            isAmPm ? "w-full text-[11px] sm:text-[12px]" : "w-10 text-[13px]"
          )}>
            {formattedTimeStr}
          </div>
        </div>

        {/* Right Side */}
        <div className={cn(
          isAmPm ? "w-[78%]" : "w-[84%]",
          "flex flex-col justify-center gap-2"
        )}>
          {/* Top Card (66% of total) - Name and Badges */}
          <div className="w-full flex items-center gap-1.5 flex-wrap">
            <div className={cn(
              "font-bold truncate transition-colors text-sm",
              settings?.theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{res.customerName}</div>
            {isRegular && (
              <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[8px] font-bold uppercase rounded border border-amber-200">
                {language === 'pt' ? 'REGULAR' : 'REGULAR'}
              </span>
            )}
          </div>

          <div className="w-full flex items-center justify-between">
            {/* Bottom Left (33% of total) - Guests and Booking No */}
            <div className="w-[50%] flex items-center gap-2 flex-wrap pr-1">
              <span className={cn(
                "text-xs transition-colors whitespace-nowrap flex items-center gap-1",
                settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                <User size={12} />
                {res.guests} {t('common.guests')}
              </span>
                            {res.bookingNumber && settings?.enableBookingNumber !== false && (
                <>
                  <span className="text-[10px] text-gray-300 dark:text-gray-700 hidden sm:inline">•</span>
                  <span className={cn(
                    "font-mono text-[10.5px] font-bold px-1.5 py-0.5 rounded border transition-colors duration-300 whitespace-nowrap hidden sm:inline-block",
                    settings?.theme === 'dark' 
                      ? "bg-gray-800 text-gray-300 border-gray-700" 
                      : "bg-gray-100 text-gray-700 border-gray-200"
                  )}>
                    {res.bookingNumber}
                  </span>
                </>
              )}
            </div>
            {/* Bottom Right (33% of total) - Status and Edit */}
            <div className="w-[50%] flex items-center justify-end gap-2 pl-1">
              <div className={cn(
                "px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider",
                res.status === 'confirmed' ? "bg-green-100 text-green-700" :
                res.status === 'arrived' ? "bg-green-600 text-white shadow-sm" :
                res.status === 'no-show' ? "bg-gray-500 text-white shadow-sm" :
                res.status === 'delayed' ? "bg-orange-500 text-white shadow-sm" :
                res.status === 'booked' ? "bg-blue-100 text-blue-700" :
                res.status === 'pending' ? "bg-amber-100 text-amber-700" :
                res.status === 'cancelled' ? "bg-red-500 text-white shadow-sm" :
                res.status === 'completed' ? "bg-yellow-400 text-yellow-900 shadow-sm" :
                res.status === 'waiting-list' ? "bg-gray-400 text-white shadow-sm" :
                "bg-gray-100 text-gray-700"
              )}>
                {t(`res.${res.status}`)}
              </div>
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingRes({ ...res, tableId: res.tableId || 'auto' });
                }}
                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-all cursor-pointer flex-shrink-0"
                title={t('common.edit') || "Edit"}
              >
                <Pencil size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

      interface MonthDropdownOption {
  value: string;
  label: string;
}

const FloorPlanFilterDropdown: React.FC<{
  label: string;
  value: string;
  options: MonthDropdownOption[];
  onChange: (value: string) => void;
  isDark: boolean;
  minWidth?: string;
}> = ({ label, value, options, onChange, isDark, minWidth = "min-w-[150px]" }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="flex flex-col gap-1.5" ref={dropdownRef}>
      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
        {label}
      </label>
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            "flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl font-bold border shadow-xs transition-all text-xs cursor-pointer select-none",
            minWidth,
            isOpen
              ? "ring-2 ring-amber-500/30 border-amber-500"
              : isDark
                ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800"
                : "bg-white border-gray-200 text-black hover:bg-gray-50"
          )}
        >
          <span className="truncate">{selectedOption ? selectedOption.label : value}</span>
          <ChevronDown
            size={14}
            className={cn("text-gray-400 shrink-0 transition-transform duration-200", isOpen && "rotate-180 text-amber-500")}
          />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-[calc(100%+6px)] w-full min-w-[170px] bg-white border border-gray-100 shadow-xl rounded-2xl overflow-hidden z-[70] py-2 animate-in fade-in slide-in-from-top-2 duration-150 max-h-60 overflow-y-auto">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={cn(
                    "w-full text-left px-4 py-2.5 transition-colors flex items-center justify-between gap-2 text-xs cursor-pointer text-black hover:bg-amber-50 hover:text-amber-800",
                    isSelected
                      ? "bg-amber-50 text-black font-bold"
                      : "text-black font-semibold"
                  )}
                >
                  <span className="truncate text-black">{opt.label}</span>
                  {isSelected && (
                    <Check size={14} className="text-amber-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

  const renderMonthPage = () => {
    const isDark = settings?.theme === 'dark';
    
    let upcomingRes = reservations.filter(r => r.date > todayStr);

    if (monthYearFilter !== 'all') {
      upcomingRes = upcomingRes.filter(r => r.date && r.date.startsWith(monthYearFilter));
    }

    if (monthMonthFilter !== 'all') {
      upcomingRes = upcomingRes.filter(r => r.date && r.date.slice(5, 7) === monthMonthFilter);
    }
    
    if (monthSearchQuery) {
      const q = monthSearchQuery.toLowerCase().trim();
      upcomingRes = upcomingRes.filter(r => 
        (r.customerName || '').toLowerCase().includes(q) ||
        (r.customerEmail || '').toLowerCase().includes(q) ||
        (r.customerPhone || '').toLowerCase().includes(q) ||
        (r.bookingNumber || '').toLowerCase().includes(q)
      );
    }
    
    if (monthPageFilter !== 'all') {
      upcomingRes = upcomingRes.filter(r => r.status === monthPageFilter);
    }
    
    const activeMonths = new Set<string>();
    let totalGuests = 0;
    const totalBookings = upcomingRes.length;
    
    const groupedByMonth: Record<string, any[]> = {};
    upcomingRes.forEach(r => {
      totalGuests += r.guests || 0;
      let formattedMonthStr = language === 'pt' ? 'Outro' : 'Other';
      if (r.date) {
        try {
          const d = parseISO(r.date);
          if (!isNaN(d.getTime())) {
            const monthStr = format(d, 'MMMM yyyy', { locale: language === 'pt' ? pt : undefined });
            formattedMonthStr = monthStr.charAt(0).toUpperCase() + monthStr.slice(1);
          }
        } catch {}
      }
      activeMonths.add(formattedMonthStr);
      if (!groupedByMonth[formattedMonthStr]) groupedByMonth[formattedMonthStr] = [];
      groupedByMonth[formattedMonthStr].push(r);
    });
    
    const yearOptions: MonthDropdownOption[] = [
      { value: 'all', label: language === 'pt' ? 'Todos os anos' : 'All Years' },
      ...availableUpcomingYears.map(year => ({ value: year, label: year }))
    ];

    const monthOptions: MonthDropdownOption[] = [
      { value: 'all', label: language === 'pt' ? 'Todos os meses' : 'All Months' },
      ...MONTH_OPTIONS.map(m => ({ value: m.value, label: language === 'pt' ? m.pt : m.en }))
    ];

    const statusOptions: MonthDropdownOption[] = [
      { value: 'all', label: language === 'pt' ? 'Todos os estados' : 'All Statuses' },
      { value: 'booked', label: language === 'pt' ? 'Reservado' : 'Booked' },
      { value: 'confirmed', label: language === 'pt' ? 'Confirmado' : 'Confirmed' },
      { value: 'arrived', label: language === 'pt' ? 'Chegou' : 'Arrived' },
      { value: 'cancelled', label: language === 'pt' ? 'Cancelado' : 'Cancelled' },
      { value: 'no-show', label: language === 'pt' ? 'Não Compareceu' : 'No Show' },
    ];
    
    return (
      <div className="w-[80%] mx-auto py-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setViewingMonthPage(false)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 border rounded-md font-bold transition-colors shadow-sm text-sm cursor-pointer",
              isDark ? "bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
            )}
          >
            <ArrowLeftToLine size={18} className="text-amber-500" />
            {language === 'pt' ? 'Voltar ao Dashboard' : 'Back to Dashboard'}
          </button>
        </div>
        
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-gray-200 dark:border-gray-800 pb-6">
          <div>
            <h2 className={cn("text-3xl font-black tracking-tight", isDark ? "text-white" : "text-gray-900")}>{language === 'pt' ? 'Reservas Futuras por Mês' : 'Upcoming Bookings by Month'}</h2>
            <p className="text-gray-500 dark:text-gray-400 mt-1 text-sm font-medium">{language === 'pt' ? 'Veja e faça a gestão das reservas futuras agrupadas por mês.' : 'View and manage upcoming guest reservations grouped month-by-month.'}</p>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            {/* Search Input with Top Label */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 select-none">
                {language === 'pt' ? 'Pesquisar' : 'Search'}
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={15} />
                <input 
                  type="text"
                  value={monthSearchQuery}
                  onChange={(e) => setMonthSearchQuery(e.target.value)}
                  placeholder={language === 'pt' ? 'Nome, email, telefone' : 'Name, email, phone...'}
                  className={cn(
                    "pl-9.5 pr-8 py-2.5 border rounded-xl text-xs w-52 md:w-60 outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 font-semibold transition-all shadow-xs",
                    isDark ? "bg-gray-900 border-gray-800 text-white placeholder-gray-500" : "bg-white border-gray-200 text-gray-800 placeholder-gray-400"
                  )}
                />
                {monthSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setMonthSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-0.5 cursor-pointer"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>

            {/* Year Filter with Top Label */}
            <FloorPlanFilterDropdown
              label={language === 'pt' ? 'Ano' : 'Year'}
              value={monthYearFilter}
              options={yearOptions}
              onChange={setMonthYearFilter}
              isDark={isDark}
              minWidth="min-w-[130px]"
            />

            {/* Month Filter with Top Label */}
            <FloorPlanFilterDropdown
              label={language === 'pt' ? 'Mês' : 'Month'}
              value={monthMonthFilter}
              options={monthOptions}
              onChange={setMonthMonthFilter}
              isDark={isDark}
              minWidth="min-w-[150px]"
            />

            {/* Status Filter with Top Label */}
            <FloorPlanFilterDropdown
              label={language === 'pt' ? 'Estado' : 'Status'}
              value={monthPageFilter}
              options={statusOptions}
              onChange={setMonthPageFilter}
              isDark={isDark}
              minWidth="min-w-[150px]"
            />

            {/* Clear Filters Button */}
            {(monthYearFilter !== 'all' || monthMonthFilter !== 'all' || monthPageFilter !== 'all' || monthSearchQuery) && (
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setMonthYearFilter('all');
                    setMonthMonthFilter('all');
                    setMonthPageFilter('all');
                    setMonthSearchQuery('');
                  }}
                  className={cn(
                    "px-3.5 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer shadow-xs flex items-center gap-1.5 h-[38px]",
                    isDark ? "bg-gray-800 text-amber-400 border-gray-700 hover:bg-gray-700" : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                  )}
                  title={language === 'pt' ? 'Limpar todos os filtros' : 'Reset all filters'}
                >
                  <X size={14} />
                  <span>{language === 'pt' ? 'Limpar' : 'Reset'}</span>
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className={cn("p-6 border shadow-sm flex items-center gap-5 transition-colors relative", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100")} style={{ borderRadius: settings?.boxBorderRadius || "12px" }}>
            <div className="w-12 h-12 bg-[#D4A373]/30 dark:bg-[#D4A373]/20 text-[#D4A373] rounded-sm flex items-center justify-center shrink-0 transition-colors">
              <Calendar size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div className={cn("text-[26px] leading-tight font-black transition-colors", isDark ? "text-white" : "text-gray-900")}>{activeMonths.size}</div>
              <div className="text-xs font-semibold text-gray-500 transition-colors">{language === 'pt' ? 'Meses Ativos' : 'Active Months'}</div>
            </div>
          </div>
          <div className={cn("p-6 border shadow-sm flex items-center gap-5 transition-colors relative", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100")} style={{ borderRadius: settings?.boxBorderRadius || "12px" }}>
            <div className="w-12 h-12 bg-[#8CA4D8]/30 dark:bg-[#8CA4D8]/20 text-[#8CA4D8] rounded-sm flex items-center justify-center shrink-0 transition-colors">
              <Users size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div className={cn("text-[26px] leading-tight font-black transition-colors", isDark ? "text-white" : "text-gray-900")}>{totalGuests}</div>
              <div className="text-xs font-semibold text-gray-500 transition-colors">{language === 'pt' ? 'Total de Convidados Esperados' : 'Total Guests Expected'}</div>
            </div>
          </div>
          <div className={cn("p-6 border shadow-sm flex items-center gap-5 transition-colors relative", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100")} style={{ borderRadius: settings?.boxBorderRadius || "12px" }}>
            <div className="w-12 h-12 bg-[#A38CD8]/30 dark:bg-[#A38CD8]/20 text-[#A38CD8] rounded-sm flex items-center justify-center shrink-0 transition-colors">
              <Clock size={22} strokeWidth={2.5} />
            </div>
            <div>
              <div className={cn("text-[26px] leading-tight font-black transition-colors", isDark ? "text-white" : "text-gray-900")}>{totalBookings}</div>
              <div className="text-xs font-semibold text-gray-500 transition-colors">{language === 'pt' ? 'Total de Reservas' : 'Total Bookings'}</div>
            </div>
          </div>
        </div>
        
        <div className="space-y-8">
          {Object.keys(groupedByMonth).length === 0 ? (
            <div className={cn("p-12 text-center border rounded-xl shadow-xs", isDark ? "bg-gray-900 border-gray-800 text-gray-400" : "bg-white border-gray-200 text-gray-500")} style={{ borderRadius: settings?.boxBorderRadius || "12px" }}>
              <Calendar className="mx-auto mb-3 text-amber-500/60" size={40} />
              <p className="text-base font-bold text-gray-700 dark:text-gray-300">
                {language === 'pt' ? 'Nenhuma reserva futura encontrada com os filtros selecionados.' : 'No upcoming bookings found matching the selected filters.'}
              </p>
              {(monthYearFilter !== 'all' || monthMonthFilter !== 'all' || monthPageFilter !== 'all' || monthSearchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setMonthYearFilter('all');
                    setMonthMonthFilter('all');
                    setMonthPageFilter('all');
                    setMonthSearchQuery('');
                  }}
                  className="mt-4 px-4 py-2 text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200 dark:border-amber-800 cursor-pointer"
                >
                  {language === 'pt' ? 'Limpar Filtros' : 'Clear Filters'}
                </button>
              )}
            </div>
          ) : (
            Object.entries(groupedByMonth).sort((a,b) => {
               const dateA = new Date(a[1][0].date);
               const dateB = new Date(b[1][0].date);
               return dateA.getTime() - dateB.getTime();
            }).map(([monthStr, monthRes]) => {
              const monthGuests = monthRes.reduce((acc, r) => acc + (r.guests || 0), 0);
              
              const byDate: Record<string, any[]> = {};
              monthRes.forEach(r => {
                if(!byDate[r.date]) byDate[r.date] = [];
                byDate[r.date].push(r);
              });
              
              return (
                <div key={monthStr} className={cn("border shadow-sm p-6 transition-colors", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")} style={{ borderRadius: settings?.boxBorderRadius || "12px" }}>
                  <div className={cn("flex items-center justify-between border-b pb-4 mb-6 transition-colors", isDark ? "border-gray-700" : "border-gray-900/10")}>
                    <h3 className="text-2xl font-black text-amber-600">{monthStr}</h3>
                    <div className="flex items-center gap-2">
                      <div className={cn("flex items-center gap-1.5 px-3 py-1.5 border text-[12.5px] font-bold", isDark ? "border-gray-600 text-gray-400" : "border-gray-400 text-gray-500")} style={{ borderRadius: settings?.boxBorderRadius || "8px" }}>
                        <Calendar size={16} className="text-amber-500" strokeWidth={2.5} />
                        <span className={cn(isDark ? "text-white" : "text-gray-900")}>{monthRes.length}</span> {language === 'pt' ? (monthRes.length === 1 ? 'Reserva' : 'Reservas') : (monthRes.length === 1 ? 'Booking' : 'Bookings')}
                      </div>
                      <div className={cn("flex items-center gap-1.5 px-3 py-1.5 border text-[12.5px] font-bold", isDark ? "border-gray-600 text-gray-400" : "border-gray-400 text-gray-500")} style={{ borderRadius: settings?.boxBorderRadius || "8px" }}>
                        <Users size={16} className="text-amber-500" strokeWidth={2.5} />
                        <span className={cn(isDark ? "text-white" : "text-gray-900")}>{monthGuests}</span> {language === 'pt' ? (monthGuests === 1 ? 'Convidado' : 'Convidados') : (monthGuests === 1 ? 'Guest' : 'Guests')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="space-y-8">
                    {Object.entries(byDate).sort((a,b) => a[0] < b[0] ? -1 : 1).map(([date, dateRes]) => {
                      let formattedDate = date;
                      try {
                        const parsed = parseISO(date);
                        if (!isNaN(parsed.getTime())) {
                          formattedDate = format(parsed, 'dd/MM/yyyy');
                        }
                      } catch {}
                      
                      const lunchRes = dateRes.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'lunch').sort((a,b) => a.time.localeCompare(b.time));
                      const dinnerRes = dateRes.filter(r => getSessionFromTime(r.time, r.date, r.manualSession) === 'dinner').sort((a,b) => a.time.localeCompare(b.time));
                      
                      return (
                        <div key={date}>
                          <div className="flex items-center justify-between mb-4 pl-[14px] pr-2">
                            <h4 className="text-[15px] font-black text-[#9CA3AF] flex items-center gap-2">
                              <Calendar size={15} className="text-amber-500" />
                              <span>{formattedDate}</span>
                            </h4>
                            <Link
                              to={`/admin/reservations?date=${date}`}
                              className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition-all bg-white hover:bg-amber-50 px-2.5 py-1 rounded-lg border border-gray-200 hover:border-amber-300 shadow-xs"
                            >
                              <Eye size={13} className="text-amber-600" />
                              {language === 'pt' ? 'Ver Todas' : 'View All'}
                            </Link>
                          </div>
                          
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-6">
                            {/* LUNCH */}
                            <div>
                              <div className="flex items-center gap-2 text-xs font-black text-amber-500 pb-2 mb-4 transition-colors relative">
                                <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                                <span>{language === 'pt' ? 'ALMOÇO' : 'LUNCH'}</span>
                                <DashboardSessionStats 
                                  resCount={lunchRes.length} 
                                  guestCount={lunchRes.reduce((acc, r) => acc + (r.guests || 0), 0)} 
                                />
                                <div className="h-px flex-1 bg-amber-100 dark:bg-amber-900/30"></div>
                              </div>
                              {lunchRes.length === 0 ? (
                                <p className="text-sm italic text-gray-400">{language === 'pt' ? 'Sem reservas para almoço' : 'No lunch reservations'}</p>
                              ) : (
                                <div className="space-y-3">
                                  {lunchRes.map(r => renderReservationItem(r))}
                                </div>
                              )}
                            </div>
                            
                            {/* DINNER */}
                            <div>
                              <div className="flex items-center gap-2 text-xs font-black text-blue-500 pb-2 mb-4 transition-colors relative">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                                <span>{language === 'pt' ? 'JANTAR' : 'DINNER'}</span>
                                <DashboardSessionStats 
                                  resCount={dinnerRes.length} 
                                  guestCount={dinnerRes.reduce((acc, r) => acc + (r.guests || 0), 0)} 
                                />
                                <div className="h-px flex-1 bg-blue-100 dark:bg-blue-900/30"></div>
                              </div>
                              {dinnerRes.length === 0 ? (
                                <p className="text-sm italic text-gray-400">{language === 'pt' ? 'Sem reservas para jantar' : 'No dinner reservations'}</p>
                              ) : (
                                <div className="space-y-3">
                                  {dinnerRes.map(r => renderReservationItem(r))}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };
  const [dismissedDates, setDismissedDates] = React.useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('dashboard_dismissed_dates');
      const parsed = saved ? JSON.parse(saved) : [];
      if (Array.isArray(parsed)) {
        // Automatically clean up old past dates from the dismissed list
        return parsed.filter((d: string) => d > todayStr);
      }
      return [];
    } catch {
      return [];
    }
  });

  const [dateToConfirmDelete, setDateToConfirmDelete] = React.useState<string | null>(null);
  const [editingRes, setEditingRes] = React.useState<any | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [viewingMonthPage, setViewingMonthPage] = React.useState(false);
  const [monthPageFilter, setMonthPageFilter] = React.useState<string>('all');
  const [monthYearFilter, setMonthYearFilter] = React.useState<string>('all');
  const [monthMonthFilter, setMonthMonthFilter] = React.useState<string>('all');
  const [monthSearchQuery, setMonthSearchQuery] = React.useState<string>('');

  const availableUpcomingYears = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const yearSet = new Set<string>([currentYear.toString(), (currentYear + 1).toString()]);
    reservations.forEach(r => {
      if (r.date && r.date > todayStr) {
        const y = r.date.slice(0, 4);
        if (y && !isNaN(Number(y))) {
          yearSet.add(y);
        }
      }
    });
    return Array.from(yearSet).sort();
  }, [reservations, todayStr]);

  const availableTables = React.useMemo(() => {
    if (!editingRes || !settings) return tables;
    const targetDate = editingRes.date;
    const targetTime = editingRes.time;
    if (!targetDate || !targetTime) return tables;

    const eff = getEffectiveOpeningHours(targetDate, settings);
    const lunch = eff.lunch;
    const dinner = eff.dinner;

    let session: 'lunch' | 'dinner' | 'general' = 'general';
    if (lunch?.active && targetTime >= lunch.open && targetTime < lunch.close) session = 'lunch';
    else if (dinner?.active && targetTime >= dinner.open && targetTime < dinner.close) session = 'dinner';

    return tables.filter(table => {
      if (table.isActive === false) return false;
      if (session !== 'general' && table.activeSessions && table.activeSessions[session as 'lunch' | 'dinner'] === false) return false;
      
      let selectedDateObj: Date;
      try {
        selectedDateObj = parseISO(targetDate);
        if (isNaN(selectedDateObj.getTime())) return false;
      } catch {
        return false;
      }
      
      if (table.isExtra) {
        let isAvailableOnDate = false;
        if (table.availableDate) {
          try {
            const availDate = parseISO(table.availableDate);
            if (!isNaN(availDate.getTime()) && isSameDay(selectedDateObj, availDate)) {
              isAvailableOnDate = true;
            }
          } catch {}
        }
        if (!isAvailableOnDate && table.availableDates && table.availableDates.includes(targetDate)) {
          isAvailableOnDate = true;
        }
        
        let isAvailableForSession = true;
        if (session !== 'general' && table.extraAvailability?.[targetDate]) {
          isAvailableForSession = table.extraAvailability[targetDate][session as 'lunch' | 'dinner'] !== false;
        } else if (session !== 'general' && table.extraSessions) {
          isAvailableForSession = table.extraSessions[session as 'lunch' | 'dinner'] !== false;
        }

        if (!isAvailableOnDate || !isAvailableForSession) return false;
      } else if (table.availableDate) {
        try {
          const availDate = parseISO(table.availableDate);
          if (!isNaN(availDate.getTime())) {
            if (isBefore(selectedDateObj, availDate) && !isSameDay(selectedDateObj, availDate)) return false;
          }
        } catch {}
      }
      
      return true;
    }).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
  }, [tables, editingRes?.date, editingRes?.time, settings]);

  const formConflict = React.useMemo(() => {
    if (!editingRes) return null;
    const { id, tableId, date, time } = editingRes;
    if (!tableId || tableId === 'auto' || tableId === 'none') return null;

    const gap = settings?.minReservationGap || 135;
    const [year, month, day] = date.split('-').map(Number);
    const [hours, minutes] = time.split(':').map(Number);
    const newStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
    const newEnd = addMinutes(newStart, gap);

    return reservations.find(r => {
      if (r.id === id || r.tableId !== tableId || r.date !== date) return false;
      if (['cancelled', 'no-show', 'completed', 'blocked'].includes(r.status)) return false;

      const [rYear, rMonth, rDay] = r.date.split('-').map(Number);
      const [rHours, rMinutes] = r.time.split(':').map(Number);
      const resStart = new Date(rYear, rMonth - 1, rDay, rHours, rMinutes, 0, 0);
      const resEnd = addMinutes(resStart, gap);

      return (newStart < resEnd && resStart < newEnd);
    });
  }, [editingRes, reservations, settings]);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRes) return;

    setIsSubmitting(true);
    try {
      let finalTableId = editingRes.tableId;
      if (editingRes.tableId === 'auto') {
        // Run auto-assignment
        const gap = settings?.minReservationGap || 135;
        const [year, month, day] = editingRes.date.split('-').map(Number);
        const [hours, minutes] = editingRes.time.split(':').map(Number);
        const newStart = new Date(year, month - 1, day, hours, minutes, 0, 0);
        const newEnd = addMinutes(newStart, gap);

        const eff = getEffectiveOpeningHours(editingRes.date, settings);
        let session: 'lunch' | 'dinner' | 'general' = 'general';
        if (eff.lunch?.active && editingRes.time >= eff.lunch.open && editingRes.time < eff.lunch.close) session = 'lunch';
        else if (eff.dinner?.active && editingRes.time >= eff.dinner.open && editingRes.time < eff.dinner.close) session = 'dinner';

        const candidates = tables.filter(t => {
          if (t.isActive === false) return false;
          if (session !== 'general' && t.activeSessions && t.activeSessions[session as 'lunch' | 'dinner'] === false) return false;
          return Number(t.seats) >= editingRes.guests;
        });
        
        const freeTables = candidates.filter(table => {
          return !reservations.some(r => {
            if (r.id === editingRes.id || r.tableId !== table.id || r.date !== editingRes.date) return false;
            if (['cancelled', 'no-show', 'completed', 'blocked'].includes(r.status)) return false;
            
            const [rYear, rMonth, rDay] = r.date.split('-').map(Number);
            const [rHours, rMinutes] = r.time.split(':').map(Number);
            const resStart = new Date(rYear, rMonth - 1, rDay, rHours, rMinutes, 0, 0);
            const resEnd = addMinutes(resStart, gap);
            
            return (newStart < resEnd && resStart < newEnd);
          });
        });

        const customer = customers.find(c => 
          c.name?.trim().toLowerCase() === editingRes.customerName?.trim().toLowerCase() ||
          (c.phone && editingRes.customerPhone && c.phone?.trim() === editingRes.customerPhone?.trim())
        );
        const favoriteTables = customer?.favoriteTables || [];

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
          const seatsA = Number(a.seats || 0);
          const seatsB = Number(b.seats || 0);
          if (seatsA !== seatsB) return seatsA - seatsB;
          return a.name.localeCompare(b.name, undefined, { numeric: true });
        });

        finalTableId = freeTables[0]?.id || "";
        
        if (finalTableId && favoriteTables.length > 0 && !favoriteTables.includes(finalTableId)) {
          editingRes.verifyTableNumber = true;
          (editingRes as any).preferredTableUnavailable = true;
        }
      }

      const updatePayload: any = {
        customerName: editingRes.customerName,
        customerEmail: editingRes.customerEmail || '',
        customerPhone: editingRes.customerPhone || '',
        date: editingRes.date,
        time: editingRes.time,
        guests: Number(editingRes.guests),
        tableId: finalTableId === 'none' ? '' : finalTableId,
        status: editingRes.status,
        isWaitlist: editingRes.isWaitlist || false,
        notes: editingRes.notes || '',
        verifyTableNumber: editingRes.verifyTableNumber !== false,
      };
      
      if ((editingRes as any).preferredTableUnavailable) {
        updatePayload.preferredTableUnavailable = true;
      }

      await updateReservation(editingRes.id, updatePayload);

      toast.success(t('res.update_success') || 'Reservation updated successfully!');
      setEditingRes(null);
    } catch (err) {
      console.error(err);
      toast.error('Failed to update reservation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const dismissDate = (dateStr: string) => {
    const updated = [...dismissedDates, dateStr];
    setDismissedDates(updated);
    try {
      localStorage.setItem('dashboard_dismissed_dates', JSON.stringify(updated));
    } catch (e) {
      console.error(e);
    }
  };

  const deleteDate = async (dateStr: string) => {
    const dateReservations = reservations.filter(r => r.date === dateStr);
    try {
      await Promise.all(
        dateReservations.map(res => updateReservation(res.id, { showInUpcomingReports: false }))
      );
    } catch (e) {
      console.error('Failed to update reservation visibility in Firestore:', e);
    }
  };

  const resetDismissedDates = () => {
    setDismissedDates([]);
    try {
      localStorage.removeItem('dashboard_dismissed_dates');
    } catch (e) {
      console.error(e);
    }
  };

  const futureReservations = reservations.filter(
    r => r.date && 
         r.date > todayStr && 
         r.status !== 'cancelled' && 
         r.status !== 'blocked' && 
         r.status !== 'completed' && 
         r.status !== 'no-show' && 
         r.status !== 'arrived' &&
         r.showInUpcomingReports !== false
  );

  const bookingsByDate = futureReservations.reduce((acc, res) => {
    if (!acc[res.date]) {
      acc[res.date] = {
        date: res.date,
        count: 0,
        guests: 0,
        customerNames: [] as string[],
      };
    }
    acc[res.date].count += 1;
    acc[res.date].guests += res.guests;
    if (res.customerName && !acc[res.date].customerNames.includes(res.customerName)) {
      acc[res.date].customerNames.push(res.customerName);
    }
    return acc;
  }, {} as Record<string, { date: string; count: number; guests: number; customerNames: string[] }>);

  const upcomingReports = Object.values(bookingsByDate).sort((a, b) => a.date.localeCompare(b.date));
  const visibleUpcomingReports = upcomingReports.filter(
    report => !dismissedDates.includes(report.date)
  );

  const formatDateDisplay = (dateStr: string) => {
    try {
      if (!dateStr || typeof dateStr !== 'string') return '';
      const d = parseISO(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return format(d, 'dd/MM/yyyy');
    } catch {
      return dateStr || '';
    }
  };

  // Filter and group reservations for Month View
  const monthViewReservations = React.useMemo(() => {
    return reservations.filter(r => {
      if (!r.date) return false;
      const isUpcoming = r.date > todayStr;
      if (!isUpcoming) return false;

      // Status Filter
      if (monthPageFilter !== 'all') {
        if (r.status !== monthPageFilter) return false;
      } else {
        if (r.status === 'blocked') return false;
      }

      // Name, email, phone, or booking number search filter
      if (monthSearchQuery) {
        const query = monthSearchQuery.toLowerCase().trim();
        const customerName = (r.customerName || '').toLowerCase();
        const customerEmail = (r.customerEmail || '').toLowerCase();
        const customerPhone = (r.customerPhone || '').toLowerCase();
        const bookingNumber = (r.bookingNumber || '').toLowerCase();
        
        const nameMatches = customerName.includes(query);
        const emailMatches = customerEmail.includes(query);
        const phoneMatches = customerPhone.includes(query);
        const bookingNumberMatches = bookingNumber.includes(query);

        if (!nameMatches && !emailMatches && !phoneMatches && !bookingNumberMatches) {
          return false;
        }
      }
      
      return true;
    });
  }, [reservations, todayStr, monthPageFilter, monthSearchQuery]);

  // Group by Month (yyyy-MM)
  const groupedByMonth = React.useMemo(() => {
    const monthsMap: Record<string, {
      monthKey: string;
      monthLabel: string;
      totalReservations: number;
      totalGuests: number;
      dates: Record<string, {
        dateStr: string;
        dateLabel: string;
        list: any[];
      }>;
    }> = {};

    monthViewReservations.forEach(r => {
      let monthKey = 'unknown';
      let monthLabel = language === 'pt' ? 'Outro' : 'Other';
      const dateStr = r.date || '';
      let dateLabel = r.date || '';

      if (r.date) {
        try {
          const dateObj = parseISO(r.date);
          if (!isNaN(dateObj.getTime())) {
            monthKey = format(dateObj, 'yyyy-MM');
            monthLabel = format(dateObj, 'MMMM yyyy');
            dateLabel = format(dateObj, 'dd/MM/yyyy');
          }
        } catch {}
      }

      if (!monthsMap[monthKey]) {
        monthsMap[monthKey] = {
          monthKey,
          monthLabel,
          totalReservations: 0,
          totalGuests: 0,
          dates: {}
        };
      }

      monthsMap[monthKey].totalReservations += 1;
      monthsMap[monthKey].totalGuests += (r.guests || 0);

      if (!monthsMap[monthKey].dates[dateStr]) {
        monthsMap[monthKey].dates[dateStr] = {
          dateStr,
          dateLabel,
          list: []
        };
      }

      monthsMap[monthKey].dates[dateStr].list.push(r);
    });

    const sortedMonths = Object.values(monthsMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    
    sortedMonths.forEach(m => {
      const sortedDates = Object.values(m.dates).sort((a, b) => a.dateStr.localeCompare(b.dateStr));
      sortedDates.forEach(d => {
        d.list.sort((a, b) => a.time.localeCompare(b.time));
      });
      (m as any).sortedDatesList = sortedDates;
    });

    return sortedMonths;
  }, [monthViewReservations]);


    const dateGroupList = (m: any) => {
    return m.sortedDatesList || [];
  };

  const totalCapacity = tables.reduce((acc, t) => acc + (t.seats || 0), 0);
  const lunchGuests = lunchReservations.reduce((acc, r) => acc + (r.guests || 0), 0);
  const dinnerGuests = dinnerReservations.reduce((acc, r) => acc + (r.guests || 0), 0);
  const lunchOccupancy = totalCapacity > 0 ? Math.round((lunchGuests / totalCapacity) * 100) : 0;
  const dinnerOccupancy = totalCapacity > 0 ? Math.round((dinnerGuests / totalCapacity) * 100) : 0;
  const getOccupancyColor = (rate: number) => {
    if (rate > 80) return "text-rose-600 dark:text-rose-400";
    if (rate > 60) return "text-orange-600 dark:text-orange-400";
    if (rate > 35) return "text-amber-600 dark:text-amber-400";
    return "text-emerald-600 dark:text-emerald-400";
  };
  const stats = [
    { 
      label: t('dashboard.today_res'), 
      value: todayReservations.length, 
      subStats: (
        <div className="flex flex-col gap-1 ml-2.5">
          <div className="flex items-center gap-1.5">
            <Sun size={13} className="text-amber-500 shrink-0" />
            <DashboardSessionStats 
              resCount={lunchReservations.length} 
              guestCount={lunchGuests} 
            />
          </div>
          <div className="flex items-center gap-1.5">
            <Moon size={13} className="text-indigo-400 shrink-0" />
            <DashboardSessionStats 
              resCount={dinnerReservations.length} 
              guestCount={dinnerGuests} 
            />
          </div>
        </div>
      ),
      icon: Calendar, 
      color: "bg-blue-50 text-blue-600",
      link: "/admin/reservations"
    },
    { 
      label: t('dashboard.available_tables'), 
      value: tables.filter(t => t.isActive !== false).length, 
      subStats: (
        <div className="flex flex-col gap-1 ml-2.5">
          <div className="flex items-center gap-1.5">
            <Sun size={13} className="text-amber-500 shrink-0" />
            <DashboardTableSessionStats session="lunch" />
          </div>
          <div className="flex items-center gap-1.5">
            <Moon size={13} className="text-indigo-400 shrink-0" />
            <DashboardTableSessionStats session="dinner" />
          </div>
        </div>
      ),
      icon: MdTableRestaurant, 
      color: "bg-green-50 text-green-600",
      link: "/admin/tables"
    },
    { 
      label: language === 'pt' ? 'Reservas Futuras' : 'Upcoming Bookings', 
      value: reservations.filter(r => r.date > todayStr && !['cancelled', 'blocked', 'completed', 'no-show'].includes(r.status)).length, 
      subStats: <DashboardUpcomingMonthStats />,
      icon: Calendar, 
      color: "bg-amber-50 text-amber-600",
      onClick: () => {
        setMonthPageFilter('all');
        setMonthYearFilter('all');
        setMonthMonthFilter('all');
        setMonthSearchQuery('');
        setViewingMonthPage(true);
      }
    },
    { 
      label: t('dashboard.customers_list') || (language === 'pt' ? 'Lista de Clientes' : 'Customers List'), 
      value: customers.length, 
      subStats: <DashboardCustomerStats />,
      icon: Users, 
      color: "bg-purple-50 text-purple-600",
      link: "/admin/customers"
    },
  ];

  if (resLoading || tablesLoading || custLoading) {
    return <div className="p-8 text-center">{t('common.loading')}</div>;
  }

  return (
    <div className={cn(
      "transition-all duration-150",
      !viewingMonthPage && cn("mx-auto py-8 px-4 sm:px-6 lg:px-8", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")
    )}>
      <AnimatePresence>
      {showSmartAlertsModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
        >
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "w-[95vw] h-[95vh] max-w-none rounded-2xl shadow-xl flex flex-col max-h-[95vh]",
              settings?.theme === 'dark' ? "bg-gray-900 border border-gray-800" : "bg-white border border-gray-100"
            )}
          >
            <div className="p-4 border-b flex justify-between items-center" style={{ borderColor: settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6' }}>
              <div className="flex items-center gap-4">
                <h2 className={cn("text-lg font-bold flex items-center gap-2", 
                  alertStatusFilter === 'active' ? "text-red-600" : 
                  alertStatusFilter === 'resolved' ? "text-green-600 dark:text-green-400" : 
                  (settings?.theme === 'dark' ? "text-gray-300" : "text-gray-700")
                )}>
                  <AlertCircle size={20} />
                  {alertStatusFilter === 'active' && (language === 'pt' ? 'Alertas Ativos' : 'Active Alerts')}
                  {alertStatusFilter === 'dismissed' && (language === 'pt' ? 'Alertas Ignorados' : 'Dismissed Alerts')}
                  {alertStatusFilter === 'resolved' && (language === 'pt' ? 'Alertas Resolvidos' : 'Resolved Alerts')}
                  {alertStatusFilter === 'all' && (language === 'pt' ? 'Todos os Alertas' : 'All Alerts')}
                </h2>
                <select 
                  value={alertStatusFilter} 
                  onChange={(e) => setAlertStatusFilter(e.target.value)}
                  className={cn("text-sm font-bold px-4 py-2 rounded-xl border shadow-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all appearance-none cursor-pointer pr-8", settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-800")}
                >
                  <option value="active">{language === 'pt' ? "Ativos" : "Active"}</option>
                  <option value="dismissed">{language === 'pt' ? "Ignorados" : "Dismissed"}</option>
                  <option value="resolved">{language === 'pt' ? "Resolvidos" : "Resolved"}</option>
                  <option value="all">{language === 'pt' ? "Todos" : "All"}</option>
                </select>
                <select 
                  value={alertTypeFilter} 
                  onChange={(e) => setAlertTypeFilter(e.target.value)}
                  className={cn("text-sm font-bold px-4 py-2 rounded-xl border shadow-sm outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all appearance-none cursor-pointer pr-8", settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 text-white" : "bg-white border-gray-200 text-gray-800")}
                >
                  <option value="all">{language === 'pt' ? "Todos os Tipos" : "All Types"}</option>
                  <option value="capacity_alert">{language === 'pt' ? "Alerta de Lotação" : "Capacity Alert"}</option>
                  <option value="duplicate_reservation">{language === 'pt' ? "Duplicados" : "Duplicates"}</option>
                  <option value="table_assignment_verify">{language === 'pt' ? "Verificar Mesa" : "Verify Table"}</option>
                  <option value="cancelled_by_customer">{language === 'pt' ? "Cancelado por Cliente" : "Cancelled by Customer"}</option>
                  <option value="time_conflict">{language === 'pt' ? "Conflito de Horário" : "Time Conflict"}</option>
                </select>
              </div>
              <button 
                onClick={() => setShowSmartAlertsModal(false)}
                className={cn(
                  "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm",
                  settings?.theme === 'dark' ? "bg-gray-800 text-gray-200 hover:bg-gray-700" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
                )}
                title={language === 'pt' ? 'Fechar' : 'Close'}
              >
                <Minimize2 size={16} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto flex-1">
              {(() => {
                const displayedAlerts = allSmartAlerts.filter(a => {
                  const matchType = alertTypeFilter === 'all' || a.type === alertTypeFilter;
                  const matchStatus = alertStatusFilter === 'all' ? true : a.status === alertStatusFilter;
                  return matchType && matchStatus;
                });
                if (displayedAlerts.length === 0) {
                  return (
                    <div className="text-center py-8 px-4 bg-amber-100 border border-amber-200 rounded-xl shadow-sm text-amber-900 font-bold m-4 text-[110%]">
                       {alertStatusFilter === 'active' 
                         ? (language === 'pt' ? 'Não existem alertas ativos' : 'There are no active alerts')
                         : alertStatusFilter === 'dismissed'
                         ? (language === 'pt' ? 'Não existem alertas ignorados' : 'There are no dismissed alerts')
                         : alertStatusFilter === 'resolved'
                         ? (language === 'pt' ? 'Não existem alertas resolvidos' : 'There are no resolved alerts')
                         : (language === 'pt' ? 'Não existem alertas' : 'There are no alerts')}
                    </div>
                  );
                }

                const renderGroup = (title, alerts) => {
                  if (alerts.length === 0) return null;
                  return (
                    <div className="mb-6">
                      <div className="flex items-center gap-3 mb-4 px-1 w-full">
                        <h3 className="text-lg font-black text-gray-700 dark:text-gray-400 flex items-center gap-2 whitespace-nowrap">
                          {title}
                          <span className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full">
                            {alerts.length}
                          </span>
                        </h3>
                        <hr className="flex-grow border-t border-gray-300 dark:border-gray-700" />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                        {alerts.map(alert => (
                          <div key={alert.id} className={cn("p-4 rounded-xl border shadow-sm", (alert.status === 'dismissed' || alert.status === 'resolved') ? "border-gray-600/50 bg-gray-800" : "border-[#27304b]/50 bg-[#27304b]")}>
                            <div className="flex flex-col gap-3">
                              <div className="flex justify-between items-start">
                                <div className="w-full">
                                  <div className="flex items-center justify-between gap-2 mb-1 w-full">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {alert.type === 'capacity_alert' && (
                                        <AlertTriangle size={15} className="text-yellow-400 shrink-0" />
                                      )}
                                      <h3 className={cn("font-bold", alert.type === 'capacity_alert' || alert.severity === 'low' ? "text-yellow-400" : alert.severity === 'high' ? "text-red-400" : "text-orange-400", (alert.status === 'dismissed' || alert.status === 'resolved') && "opacity-70")}>
                                        {getTranslatedAlertTitle(alert.title, language)}
                                      </h3>
                                      {alert.type === 'capacity_alert' && (
                                        <span className="text-[10px] bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                                          85%+
                                        </span>
                                      )}
                                      {alert.status === 'dismissed' && (
                                        <span className="text-[10px] bg-gray-700 text-gray-300 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                          {language === 'pt' ? 'Ignorado' : 'Dismissed'}
                                        </span>
                                      )}
                                      {alert.status === 'resolved' && (
                                        <span className="text-[10px] bg-green-900/60 text-green-300 border border-green-700/50 px-2 py-0.5 rounded-full uppercase tracking-wider font-bold">
                                          {language === 'pt' ? 'Resolvido' : 'Resolved'}
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      onClick={() => setAlertToDelete(alert.id)}
                                      className="text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors p-1 rounded-md shrink-0 cursor-pointer"
                                      title={language === 'pt' ? 'Apagar Alerta' : 'Delete Alert'}
                                    >
                                      <Trash2 size={14} className="text-red-500" />
                                    </button>
                                  </div>
                                  <p className={cn("text-sm leading-snug text-white", (alert.status === 'dismissed' || alert.status === 'resolved') && "text-white/80")}>
                                    {getTranslatedAlertMessage(alert, language)}
                                  </p>
                                </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mt-2">
                                <button 
                                  onClick={() => {
                                    setShowSmartAlertsModal(false);
                                    const match = alert.fingerprint.match(/\d{4}-\d{2}-\d{2}/);
                                    let searchParam = '';
                                    if (alert.type === 'duplicate_reservation') {
                                        const matchEmail = alert.message.match(/using the email (.+) for/);
                                        const matchName = alert.message.match(/using the name (.+) for/);
                                        if (matchEmail) searchParam = matchEmail[1];
                                        else if (matchName) searchParam = matchName[1];
                                        else searchParam = alert.fingerprint.split('_').slice(4).join('_') || '';
                                    } else if (alert.type === 'cancelled_by_customer') {
                                        const matchName = alert.message.match(/Customer (.+) cancelled their reservation/);
                                        if (matchName) {
                                            searchParam = matchName[1];
                                        } else {
                                            searchParam = alert.relatedReservationIds?.[0] || '';
                                        }
                                    } else if (alert.type === 'table_assignment_verify') {
                                        const matchName = alert.message.match(/Reservation for (.+) on/);
                                        if (matchName) {
                                            searchParam = matchName[1];
                                        } else {
                                            searchParam = alert.relatedReservationIds?.[0] || '';
                                        }
                                    } else if (alert.type === 'time_conflict') {
                                        searchParam = '';
                                    } else if (alert.type === 'capacity_alert') {
                                        searchParam = '';
                                    } else if (alert.relatedReservationIds && alert.relatedReservationIds.length > 0) {
                                        searchParam = alert.relatedReservationIds[0];
                                    }
                                    
                                    if (match) {
                                       navigate(`/admin/reservations?date=${match[0]}&search=${encodeURIComponent(searchParam)}`);
                                    } else {
                                       navigate(`/admin/reservations?search=${encodeURIComponent(searchParam)}`);
                                    }
                                  }}
                                  className={cn("text-xs px-3 py-1.5 rounded-lg text-white font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-[80px]", alert.type === 'capacity_alert' ? "bg-yellow-600 hover:bg-yellow-700" : alert.severity === 'high' ? "bg-red-600 hover:bg-red-700" : alert.severity === 'medium' ? "bg-orange-600 hover:bg-orange-700" : "bg-yellow-600 hover:bg-yellow-700", alert.status === 'dismissed' && "opacity-70")}
                                >
                                  <Eye size={12} />
                                  {language === 'pt' ? 'Verificar' : 'Verify'}
                                </button>
                                {alert.status !== 'dismissed' && alert.status !== 'resolved' && (
                                    <button 
                                      onClick={() => handleDismissAlert(alert.id)}
                                      className={cn("text-xs px-3 py-1.5 rounded-lg bg-gray-500 hover:bg-gray-600 border border-gray-500 text-white font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-[80px]")}
                                    >
                                      <EyeOff size={12} /> {language === 'pt' ? 'Ignorar' : 'Dismiss'}
                                    </button>
                                )}
                                {alert.status !== 'resolved' ? (
                                  <button 
                                    onClick={() => setAlertToResolve(alert.id)}
                                    className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-[80px]"
                                  >
                                    <CheckCircle size={12} />
                                    {language === 'pt' ? 'Resolver' : 'Resolve'}
                                  </button>
                                ) : (
                                  <div className="text-xs px-3 py-1.5 rounded-lg bg-green-100 text-green-700 border border-green-200 font-bold flex items-center justify-center gap-1 min-w-[80px]">
                                    <CheckCircle size={12} />
                                    {language === 'pt' ? 'Resolvido' : 'Resolved'}
                                  </div>
                                )}

                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <hr className="mt-8 mb-2 border-gray-200 dark:border-gray-800" />
                    </div>
                  );
                };

                const duplicateAlerts = displayedAlerts.filter(a => a.type === 'duplicate_reservation');
                const tableAlerts = displayedAlerts.filter(a => a.type === 'table_assignment_verify');
                const cancelAlerts = displayedAlerts.filter(a => a.type === 'cancelled_by_customer');
                const timeConflictAlerts = displayedAlerts.filter(a => a.type === "time_conflict");
                const capacityAlerts = displayedAlerts.filter(a => a.type === "capacity_alert");
                const otherAlerts = displayedAlerts.filter(a => !["duplicate_reservation", "table_assignment_verify", "cancelled_by_customer", "time_conflict", "capacity_alert"].includes(a.type));

                return (
                  <>
                    {renderGroup(language === "pt" ? "Conflito de Horário" : "Time Conflict", timeConflictAlerts)}
                    {renderGroup(language === "pt" ? "Alerta de Lotação" : "Capacity Alert", capacityAlerts)}
                    {renderGroup(language === "pt" ? "Possíveis Reservas Duplicadas" : "Possible Duplicate Reservations", duplicateAlerts)}
                    {renderGroup(language === 'pt' ? 'Verificação de Mesas' : 'Table Assignment', tableAlerts)}
                    {renderGroup(language === 'pt' ? 'Cancelado pelo Cliente' : 'Cancelled by Customer', cancelAlerts)}

                    {renderGroup(language === 'pt' ? 'Outros Alertas' : 'Other Alerts', otherAlerts)}
                  </>
                );
              })()}
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

      {viewingMonthPage ? (
        renderMonthPage()
      ) : (
        <>
          {/* Smart Alerts Dashboard Section */}
          {activeSmartAlerts.length > 0 && (
            <div className="mb-8 p-6 rounded-2xl border border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-900/30 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle size={20} />
                  {language === 'pt' ? 'Alertas Inteligentes' : 'Smart Alerts'}
                  {activeSmartAlerts.length > 2 && (
                    <span className="ml-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
                      +{activeSmartAlerts.length - 2} {language === 'pt' ? 'Mais' : 'More'}
                    </span>
                  )}
                </h2>
                <button 
                  onClick={() => setShowSmartAlertsModal(true)}
                  className="text-sm font-bold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  {language === 'pt' ? 'Ver Todos' : 'View All'}
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {activeSmartAlerts.slice(0, 2).map(alert => (
                   <div key={alert.id} className="space-y-3 p-3 rounded-xl border shadow-sm bg-[#27304b] border-[#27304b]/50">
                        <div>
                          <div className="flex justify-between items-center text-sm mb-1 px-1">
                            <div className="flex items-center gap-1.5">
                              {alert.type === 'capacity_alert' && (
                                <AlertTriangle size={15} className="text-yellow-400 shrink-0" />
                              )}
                              <span className={cn("font-bold", alert.type === 'capacity_alert' || alert.severity === 'low' ? "text-yellow-400" : alert.severity === 'high' ? "text-red-400" : "text-orange-400")}>
                                {getTranslatedAlertTitle(alert.title, language)}
                              </span>
                            </div>
                            <button
                              onClick={() => setAlertToDelete(alert.id)}
                              className="text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-colors p-1 rounded-md cursor-pointer"
                              title={language === 'pt' ? 'Apagar Alerta' : 'Delete Alert'}
                            >
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          </div>
                          <p className="text-sm mt-1 mb-3 leading-snug px-1 text-white font-normal">
                            {getTranslatedAlertMessage(alert, language)}
                          </p>
                          <div className="flex flex-wrap gap-2 px-1">
                            <button 
                              onClick={() => {
                                const match = alert.fingerprint.match(/\d{4}-\d{2}-\d{2}/);
                                let searchParam = '';
                                if (alert.type === 'duplicate_reservation') {
                                    const matchEmail = alert.message.match(/using the email (.+) for/);
                                    const matchName = alert.message.match(/using the name (.+) for/);
                                    if (matchEmail) searchParam = matchEmail[1];
                                    else if (matchName) searchParam = matchName[1];
                                    else searchParam = alert.fingerprint.split('_').slice(4).join('_') || '';
                                } else if (alert.type === 'cancelled_by_customer') {
                                    const matchName = alert.message.match(/Customer (.+) cancelled their reservation/);
                                    if (matchName) {
                                        searchParam = matchName[1];
                                    } else {
                                        searchParam = alert.relatedReservationIds?.[0] || '';
                                    }
                                } else if (alert.type === 'table_assignment_verify') {
                                    const matchName = alert.message.match(/Reservation for (.+) on/);
                                    if (matchName) {
                                        searchParam = matchName[1];
                                    } else {
                                        searchParam = alert.relatedReservationIds?.[0] || '';
                                    }
                                } else if (alert.type === 'time_conflict') {
                                    searchParam = '';
                                } else if (alert.type === 'capacity_alert') {
                                    searchParam = '';
                                } else if (alert.relatedReservationIds && alert.relatedReservationIds.length > 0) {
                                    searchParam = alert.relatedReservationIds[0];
                                }
                                
                                if (match) {
                                   navigate(`/admin/reservations?date=${match[0]}&search=${encodeURIComponent(searchParam)}`);
                                } else {
                                   navigate(`/admin/reservations?search=${encodeURIComponent(searchParam)}`);
                                }
                              }}
                              className={cn("text-xs px-3 py-1.5 rounded-lg text-white font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-[80px]", alert.type === 'capacity_alert' ? "bg-yellow-600 hover:bg-yellow-700" : alert.severity === 'high' ? "bg-red-600 hover:bg-red-700" : alert.severity === 'medium' ? "bg-orange-600 hover:bg-orange-700" : "bg-yellow-600 hover:bg-yellow-700")}
                            >
                              <Eye size={12} />
                              {language === 'pt' ? 'Verificar' : 'Verify'}
                            </button>
                            <button 
                              onClick={() => handleDismissAlert(alert.id)}
                              className={cn("text-xs px-3 py-1.5 rounded-lg bg-gray-500 hover:bg-gray-600 border border-gray-500 text-white font-medium transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-[80px]")}
                            >
                              <EyeOff size={12} /> {language === 'pt' ? 'Ignorar' : 'Dismiss'}
                            </button>
                            <button 
                              onClick={() => setAlertToResolve(alert.id)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-[80px]"
                            >
                              <CheckCircle size={12} />
                              {language === 'pt' ? 'Resolvido' : 'Resolved'}
                            </button>

                          </div>
                        </div>
                   </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 mb-8">
            <div className="flex-1 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className={cn(
                    "text-3xl font-bold tracking-tight",
                    settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                  )}>
                    {t('nav.dashboard')}
                  </h1>
                  <p className={cn(
                    "text-sm mt-1",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                  )}>
                    {language === 'pt' ? `Bem-vindo de volta, ${user?.name?.split(' ')[0] || ''}. Aqui está o que está acontecendo hoje.` : `Welcome back, ${user?.name?.split(' ')[0] || ''}. Here's what's happening today.`}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-end flex-col gap-2">
              <div className="flex items-center gap-3">
                {!showSmartAlertsModal && activeSmartAlerts.length === 0 && (
                  <button
                    onClick={() => {
                      setAlertStatusFilter('active');
                      setShowSmartAlertsModal(true);
                    }}
                    className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center hover:bg-red-200 transition-colors shadow-sm relative shrink-0"
                    title={language === 'pt' ? 'Ver Alertas' : 'View Alerts'}
                  >
                    <AlertCircle size={22} className={activeSmartAlerts.length > 0 ? "animate-pulse" : ""} />
                    {activeSmartAlerts.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-600 rounded-full border-2 border-white dark:border-gray-900" />
                    )}
                  </button>
                )}
                <div className="bg-amber-100 text-amber-900 px-4 py-2 rounded-xl font-bold border border-amber-200 shadow-sm">
                  {language === 'pt' ? 'Hoje' : 'Today'}: {format(new Date(), 'dd MMM yyyy', { locale: language === 'pt' ? pt : undefined })}
                </div>
              </div>
              <p className={cn(
                "text-sm text-right px-1",
                settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                {language === 'pt' ? 'As reservas de hoje' : 'Today\'s bookings'}
              </p>
            </div>
          </div>
          
{/* Stats Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
            {stats.map((stat: any, index: number) => {
              const content = (
                <>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl transition-colors shrink-0 flex items-center justify-center", stat.color)}>
                        <stat.icon size={22} className="w-[22px] h-[22px] text-current" />
                      </div>
                      <div className="flex flex-col text-left">
                        <div className={cn(
                          "text-3xl font-bold transition-colors leading-none mb-1.5 flex items-center flex-wrap sm:flex-nowrap",
                          settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                        )}>
                          <span>{stat.value}</span>
                          {stat.subStats}
                        </div>
                        <div className={cn(
                          "text-sm font-medium transition-colors leading-none",
                          settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                        )}>{stat.label}</div>
                      </div>
                    </div>
                    <TrendingUp size={15} className="text-gray-300 group-hover:text-amber-500 transition-colors shrink-0 mt-0.5" />
                  </div>
                </>
              );

              if (stat.onClick) {
                return (
                  <button
                    key={index}
                    onClick={stat.onClick}
                    className={cn(
                      "p-5 rounded-2xl shadow-sm border transition-all group w-full cursor-pointer text-left focus:outline-none",
                      settings?.theme === 'dark' ? "bg-gray-950 border-gray-800 hover:bg-gray-900/60" : "bg-white border-gray-100 hover:shadow-md"
                    )}
                  >
                    {content}
                  </button>
                );
              }

              return (
                <Link 
                  key={index} 
                  to={stat.link!}
                  className={cn(
                    "p-5 rounded-2xl shadow-sm border transition-all group",
                    settings?.theme === 'dark' ? "bg-gray-950 border-gray-800 hover:bg-gray-900/60" : "bg-white border-gray-100 hover:shadow-md"
                  )}
                >
                  {content}
                </Link>
              );
            })}
          </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Recent Reservations */}
        <div className={cn(
          "p-6 rounded-2xl shadow-sm border transition-colors flex flex-col h-[450px]",
          settings?.theme === 'dark' ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100"
        )}>
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className={cn(
              "text-xl font-bold transition-colors",
              settings?.theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{t('dashboard.today_res')}</h2>
            <Link to="/admin/reservations" className="text-amber-600 text-xs font-bold hover:text-amber-700 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap">
              <Eye size={12} />
              <span>{t('nav.reservations')}</span>
            </Link>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-4">
            {todayReservations.length > 0 ? (
              <div className="space-y-6">
                {lunchReservations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-px w-6 flex-shrink-0", settings?.theme === 'dark' ? "bg-amber-500/20" : "bg-amber-100")} />
                      <h3 className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider whitespace-nowrap">
                        {t('common.lunch')}
                      </h3>
                      <DashboardSessionStats 
                        resCount={lunchReservations.length} 
                        guestCount={lunchReservations.reduce((acc, r) => acc + r.guests, 0)} 
                      />
                      <div className={cn("h-px flex-grow", settings?.theme === 'dark' ? "bg-amber-500/20" : "bg-amber-100")} />
                    </div>
                    <div className="space-y-3">
                      {lunchReservations.map((res) => renderReservationItem(res))}
                    </div>
                  </div>
                )}

                {dinnerReservations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-px w-6 flex-shrink-0", settings?.theme === 'dark' ? "bg-indigo-500/20" : "bg-indigo-100")} />
                      <h3 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider whitespace-nowrap">
                        {t('common.dinner')}
                      </h3>
                      <DashboardSessionStats 
                        resCount={dinnerReservations.length} 
                        guestCount={dinnerReservations.reduce((acc, r) => acc + r.guests, 0)} 
                      />
                      <div className={cn("h-px flex-grow", settings?.theme === 'dark' ? "bg-indigo-500/20" : "bg-indigo-100")} />
                    </div>
                    <div className="space-y-3">
                      {dinnerReservations.map((res) => renderReservationItem(res))}
                    </div>
                  </div>
                )}

                {generalReservations.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-px w-6 flex-shrink-0", settings?.theme === 'dark' ? "bg-gray-800" : "bg-gray-150")} />
                      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">
                        {(language === 'pt' ? 'Outras' : 'Other')}
                      </h3>
                      <DashboardSessionStats 
                        resCount={generalReservations.length} 
                        guestCount={generalReservations.reduce((acc, r) => acc + r.guests, 0)} 
                      />
                      <div className={cn("h-px flex-grow", settings?.theme === 'dark' ? "bg-gray-800" : "bg-gray-150")} />
                    </div>
                    <div className="space-y-3">
                      {generalReservations.map((res) => renderReservationItem(res))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-400">
                <p>{t('res.no_bookings')}.</p>
              </div>
            )}
        </div>

        </div>
        {/* Upcoming Reports */}
        <div className={cn(
          "p-6 rounded-2xl shadow-sm border transition-colors flex flex-col h-[450px]",
          settings?.theme === 'dark' ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100"
        )}>
          <div className="flex items-start justify-between mb-4 flex-shrink-0">
            <div className="min-w-0 flex-1">
              <h2 className={cn(
                "text-xl font-bold transition-colors flex items-center gap-2",
                settings?.theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                <span>{t('dashboard.upcoming_reports')}</span>
              </h2>
              <p className={cn(
                "text-xs transition-colors truncate mt-0.5",
                settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                {t('dashboard.upcoming_reports_desc')}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-1">
              <button
                onClick={() => {
                  setMonthPageFilter('all');
                  setMonthYearFilter('all');
                  setMonthMonthFilter('all');
                  setMonthSearchQuery('');
                  setViewingMonthPage(true);
                }}
                className="text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Eye size={12} />
                {language === 'pt' ? 'Ver por Mês' : 'View by Month'}
              </button>
              {dismissedDates.length > 0 && (
                <button
                  onClick={resetDismissedDates}
                  className="text-[10px] text-amber-600 font-bold hover:text-amber-700 transition-colors"
                >
                  {t('dashboard.reset_hidden')} ({dismissedDates.length})
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-3">
            {visibleUpcomingReports.length > 0 ? (
              visibleUpcomingReports.map((report) => {
                if (dateToConfirmDelete === report.date) {
                  return (
                    <div 
                      key={report.date} 
                      className={cn(
                        "p-3 rounded-xl border flex flex-col gap-2.5 transition-colors border-red-500/40 bg-red-50/10",
                        settings?.theme === 'dark' ? "bg-red-950/20" : "bg-red-50/40"
                      )}
                    >
                      <div className={cn(
                        "text-xs font-bold transition-colors text-center leading-relaxed",
                        settings?.theme === 'dark' ? "text-red-400" : "text-red-700"
                      )}>
                        {t('dashboard.remove_report_confirm')}
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => {
                            deleteDate(report.date);
                            setDateToConfirmDelete(null);
                          }}
                          className="px-3 py-1 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors shadow-sm cursor-pointer"
                        >
                          {t('common.yes') || "Yes"}
                        </button>
                        <button
                          onClick={() => setDateToConfirmDelete(null)}
                          className={cn(
                            "px-3 py-1 text-xs font-bold rounded-lg transition-colors border cursor-pointer",
                            settings?.theme === 'dark' ? "bg-gray-900 border-gray-700 text-gray-300 hover:bg-gray-800" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                          )}
                        >
                          {t('common.no') || "No"}
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div 
                    key={report.date} 
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between transition-colors hover:border-amber-500/40",
                      settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"
                    )}
                  >
                    <Link 
                      to={`/admin/reservations?date=${report.date}`}
                      className="flex-1 min-w-0 space-y-1 hover:opacity-80 transition-opacity cursor-pointer group"
                    >
                      <div className={cn(
                        "font-bold text-xs transition-colors group-hover:text-amber-600",
                        settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                      )}>
                        {formatDateDisplay(report.date)}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Calendar size={10} className="text-amber-500" />
                          <strong>{report.count}</strong> {report.count === 1 ? t('nav.reservations').toLowerCase().slice(0, -1) : t('nav.reservations').toLowerCase()}
                        </span>
                        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                        <span className="flex items-center gap-1">
                          <Users size={10} className="text-blue-500" />
                          <strong>{report.guests}</strong> {t('common.guests')}
                        </span>
                      </div>
                      {report.customerNames.length > 0 && (
                        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate mt-1">
                          <span className="text-amber-600 dark:text-amber-500 font-semibold">
                            {report.customerNames.length === 1 ? t('common.customer') : t('nav.customers')}:
                          </span>{' '}
                          {report.customerNames.join(', ')}
                        </div>
                      )}
                    </Link>

                    <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                      <button
                        onClick={() => dismissDate(report.date)}
                        className="p-1.5 text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition-all cursor-pointer"
                        title={t('common.hide') || "Hide"}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        onClick={() => setDateToConfirmDelete(report.date)}
                        className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                        title={t('common.remove') || "Delete from section"}
                      >
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
              ) : (
              <div className="h-full flex flex-col items-center justify-center text-center py-12 text-gray-400">
                <Calendar size={36} className="text-gray-300 dark:text-gray-700 mb-2" />
                <p className="text-xs font-medium">{t('dashboard.no_upcoming_reports')}</p>
                {dismissedDates.length > 0 && (
                  <button
                    onClick={resetDismissedDates}
                    className="text-xs text-amber-600 font-bold hover:text-amber-700 transition-colors mt-2 animate-bounce"
                  >
                    {t('dashboard.show_hidden')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className={cn(
          "p-6 rounded-2xl shadow-sm border transition-colors flex flex-col h-[450px]",
          settings?.theme === 'dark' ? "bg-gray-950 border-gray-800" : "bg-white border-gray-100"
        )}>
          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <h2 className={cn(
              "text-xl font-bold transition-colors",
              settings?.theme === 'dark' ? "text-white" : "text-gray-900"
            )}>{t('dashboard.quick_actions')}</h2>
          </div>
          <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 pr-1">
            <Link 
              to="/admin/live" 
              className="flex flex-col items-center justify-center p-4 bg-green-50 text-green-700 rounded-2xl hover:bg-green-100 transition-colors gap-2 group text-center"
            >
              <Map size={24} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-xs text-center">{t('nav.live_view')}</span>
            </Link>
            <Link 
              to="/admin/reservations" 
              className="flex flex-col items-center justify-center p-4 bg-amber-50 text-amber-700 rounded-2xl hover:bg-amber-100 transition-colors gap-2 group text-center"
            >
              <Calendar size={24} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-xs text-center">{t('res.new')}</span>
            </Link>
            <Link 
              to="/admin/tables" 
              className="flex flex-col items-center justify-center p-4 bg-blue-50 text-blue-700 rounded-2xl hover:bg-blue-100 transition-colors gap-2 group text-center"
            >
              <MdTableRestaurant size={24} className="group-hover:scale-110 transition-transform" />
              <span className="font-bold text-xs text-center">{isAdmin ? t('tables.edit') : t('nav.tables')}</span>
            </Link>
            {isAdmin ? (
              <Link 
                to="/admin/settings" 
                className="flex flex-col items-center justify-center p-4 bg-purple-50 text-purple-700 rounded-2xl hover:bg-purple-100 transition-colors gap-2 group text-center"
              >
                <Settings size={24} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-center">{t('nav.settings')}</span>
              </Link>
            ) : (
              <div className="flex flex-col items-center justify-center p-4 bg-gray-50 text-gray-400 rounded-2xl gap-2 cursor-not-allowed text-center">
                <Lock size={24} />
                <span className="font-bold text-xs text-center">{t('nav.settings')}</span>
              </div>
            )}
            {isAdmin && (
              <Link 
                to="/admin/users" 
                className="flex flex-col items-center justify-center p-4 bg-indigo-50 text-indigo-700 rounded-2xl hover:bg-indigo-100 transition-colors gap-2 group col-span-2 text-center"
              >
                <Users size={24} className="group-hover:scale-110 transition-transform" />
                <span className="font-bold text-xs text-center">{t('nav.users')}</span>
              </Link>
            )}
          </div>
        </div>
      </div>
        </>
      )}
      {editingRes && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-[100] p-4 overflow-y-auto">
          <div className={cn(
            "rounded-3xl p-6 md:p-8 w-full max-w-2xl shadow-2xl my-8 transition-colors border",
            settings?.theme === 'dark' ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-100 text-gray-900"
          )}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold">{t('res.edit') || "Edit Reservation"}</h3>
              <button 
                onClick={() => setEditingRes(null)} 
                className="text-gray-400 hover:text-gray-600 p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h4 className="font-semibold text-gray-400 uppercase text-xs tracking-widest">{t('public.guest_info') || "Guest Info"}</h4>
                </div>

                {editingRes.bookingNumber && settings?.enableBookingNumber !== false && (
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>
                      {language === 'pt' ? 'Número da Reserva' : 'Booking Number'}
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={editingRes.bookingNumber}
                        className={cn(
                          "flex-grow px-4 py-2 border rounded-xl font-mono font-bold outline-none cursor-not-allowed",
                          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500"
                        )}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(editingRes.bookingNumber || '');
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                          toast.success(language === 'pt' ? 'Número da reserva copiado!' : 'Booking number copied!');
                        }}
                        className={cn(
                          "p-2 border rounded-xl transition-colors cursor-pointer",
                          settings?.theme === 'dark' ? "border-gray-800 hover:bg-gray-900 text-gray-400 hover:text-amber-500" : "border-gray-200 hover:bg-gray-50 text-gray-500 hover:text-amber-600"
                        )}
                        title={language === 'pt' ? 'Copiar' : 'Copy'}
                      >
                        {copied ? <Check size={18} className="text-green-600" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                )}

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-1",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                  )}>{t('common.name')}</label>
                  <input 
                    required
                    type="text"
                    list="customer-names"
                    value={editingRes.customerName}
                    onChange={(e) => {
                      const name = e.target.value;
                      const customer = customers.find(c => c.name === name);
                      setEditingRes({ 
                        ...editingRes, 
                        customerName: name,
                        customerPhone: customer ? customer.phone : editingRes.customerPhone,
                        customerEmail: customer ? customer.email : editingRes.customerEmail
                      });
                    }}
                    className={cn(
                      "w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500",
                      settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                  />
                  <datalist id="customer-names">
                    {customers.map((c: any, i: number) => (
                      <option key={i} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-1",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                  )}>{t('common.phone') || "Phone"}</label>
                  <div className={cn(
                    "w-full px-4 py-1.5 border rounded-xl focus-within:ring-2 focus-within:ring-amber-500",
                    settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                  )}>
                    <PhoneInput
                      defaultCountry={(settings?.defaultCountryCode || (language === 'pt' ? 'PT' : 'US')) as any}
                      value={editingRes.customerPhone || ''}
                      onChange={(val) => setEditingRes({ ...editingRes, customerPhone: val || '' })}
                      className="w-full text-sm outline-none bg-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className={cn(
                    "block text-sm font-medium mb-1",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                  )}>{t('common.email') || "Email"}</label>
                  <input 
                    type="email"
                    value={editingRes.customerEmail || ''}
                    onChange={(e) => setEditingRes({ ...editingRes, customerEmail: e.target.value })}
                    className={cn(
                      "w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500",
                      settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                  />
                  {editingRes.source !== 'public' && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs font-bold text-rose-700 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 w-fit">
                      <User size={12} className="text-rose-500" />
                      <span>
                        {language === 'pt' ? `Criada por Staff #${editingRes.bookedByStaffNumber || '001'}` : `Created by Staff #${editingRes.bookedByStaffNumber || '001'}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-semibold text-gray-400 uppercase text-xs tracking-widest">{t('public.select_date') || "Select Date & Time"}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>{t('common.date')}</label>
                    <DatePicker
                      value={dayjs(editingRes.date)}
                      format="DD/MM/YYYY"
                      onChange={(newValue) => {
                        if (newValue) {
                          setEditingRes({ ...editingRes, date: newValue.format('YYYY-MM-DD') });
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
                              backgroundColor: settings?.theme === 'dark' ? '#111827' : '#ffffff',
                              color: settings?.theme === 'dark' ? '#ffffff' : '#111827',
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                              borderColor: settings?.theme === 'dark' ? '#1f2937' : '#e5e7eb',
                            }
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className={cn(
                      "block text-sm font-medium mb-1",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>{t('common.time')}</label>
                    <TimePicker viewRenderers={{ hours: renderTimeViewClock, minutes: renderTimeViewClock, seconds: renderTimeViewClock }}
                      ampm={settings?.timeFormat === '12h'}
                      format={settings?.timeFormat === '12h' ? "h:mm A" : "H:mm"}
                      value={dayjs(editingRes.time, 'HH:mm')}
                      onChange={(newValue) => {
                        if (newValue) {
                          setEditingRes({ ...editingRes, time: newValue.format('HH:mm') });
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
                              backgroundColor: settings?.theme === 'dark' ? '#111827' : 'white',
                              color: settings?.theme === 'dark' ? 'white' : 'inherit',
                              '& fieldset': {
                                borderColor: settings?.theme === 'dark' ? '#374151' : '#e5e7eb',
                              },
                              '&:hover fieldset': {
                                borderColor: settings?.theme === 'dark' ? '#4b5563' : '#d1d5db',
                              },
                              '&.Mui-focused fieldset': {
                                borderColor: '#d97706',
                              },
                            },
                            '& .MuiSvgIcon-root': {
                              color: settings?.theme === 'dark' ? '#9ca3af' : 'inherit',
                            }
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="col-span-1">
                    <label className={cn(
                      "block text-sm font-medium mb-1",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>{t('common.guests')}</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      value={editingRes.guests}
                      onChange={(e) => setEditingRes({ ...editingRes, guests: parseInt(e.target.value) || 1 })}
                      className={cn(
                        "w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                      )}
                    />
                  </div>
                  <div className="col-span-3">
                    <label className={cn(
                      "block text-sm font-medium mb-1",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                    )}>{t('common.table')}</label>
                    <select 
                      value={editingRes.tableId || (editingRes.isWaitlist ? "" : "auto")}
                      onChange={(e) => {
                        const val = e.target.value;
                        const updates: any = { tableId: val };
                        if (val && val !== 'auto' && val !== 'none' && editingRes.isWaitlist) {
                          updates.isWaitlist = false;
                          updates.status = 'booked';
                        }
                        setEditingRes({ ...editingRes, ...updates });
                      }}
                      className={cn(
                        "w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500",
                        settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                      )}
                    >
                      <option value="auto">{t('res.auto_assign') || "Auto-assign Table"}</option>
                      <option value="none">{t('res.no_table_assign') || "No Table Assignment"}</option>
                      {availableTables.map((table: any) => (
                        <option key={table.id} value={table.id}>
                          {table.name} ({table.seats} {t('common.guests')}) - {table.shape || 'square'}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-end gap-6">
                  <div className="flex-1">
                  <label className={cn(
                    "block text-sm font-medium mb-1",
                    settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                  )}>{t('common.status')}</label>
                  <select 
                    value={editingRes.status}
                    onChange={(e) => {
                      const newStatus = e.target.value;
                      const updates: any = { status: newStatus };
                      if (newStatus === 'waiting-list') {
                        updates.isWaitlist = true;
                        updates.tableId = "";
                      } else if (editingRes.status === 'waiting-list') {
                        updates.isWaitlist = false;
                      }
                      setEditingRes({ ...editingRes, ...updates });
                    }}
                    className={cn(
                      "w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500",
                      settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                    )}
                  >
                    <option value="pending">{t('res.pending')}</option>
                    <option value="booked">{t('res.booked')}</option>
                    <option value="confirmed">{t('res.confirmed')}</option>
                    <option value="delayed">{t('res.delayed') || "Delayed"}</option>
                    <option value="arrived">{t('res.arrived')}</option>
                    <option value="no-show">{t('res.no-show')}</option>
                    <option value="cancelled">{t('res.cancelled')}</option>
                    <option value="completed">{t('res.completed')}</option>
                    <option value="waiting-list">{t('res.waiting-list')}</option>
                  </select>
                  </div>

                <div className="flex flex-row items-center gap-6 pb-2">
                  <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editingRes.isWaitlist || false}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setEditingRes({ 
                          ...editingRes, 
                          isWaitlist: isChecked,
                          status: isChecked ? 'waiting-list' : (editingRes.status === 'waiting-list' ? 'booked' : editingRes.status),
                          tableId: isChecked ? "" : editingRes.tableId
                        });
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-amber-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
                  </label>
                  <span className="text-sm font-bold">{t('res.waitlist') || "Waitlist"}</span>
                  </div>

                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={!editingRes.verifyTableNumber}
                      onChange={(e) => {
                        const isChecked = e.target.checked;
                        setEditingRes({ 
                          ...editingRes, 
                          verifyTableNumber: !isChecked
                        });
                      }}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                  </label>
                  <span className="text-sm font-bold">{t('res.table_verified') || (language === 'pt' ? 'Mesa Verificada' : 'Table Verified')}</span>
                </div>
              </div>
              </div>

              </div>
              <div className="md:col-span-2">
                <label className={cn(
                  "block text-sm font-medium mb-1",
                  settings?.theme === 'dark' ? "text-gray-400" : "text-gray-700"
                )}>{t('common.notes')}</label>
                <textarea 
                  value={editingRes.notes || ''}
                  onChange={(e) => setEditingRes({ ...editingRes, notes: e.target.value })}
                  rows={3}
                  className={cn(
                    "w-full px-4 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-amber-500 resize-none",
                    settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900"
                  )}
                />
              </div>

              {formConflict && (
                <div className="md:col-span-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-2xl p-4 flex gap-3 items-start">
                  <AlertCircle className="text-red-600 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h5 className="font-bold text-red-800 dark:text-red-400 text-sm">{t('res.conflict_title') || 'Time Conflict!'}</h5>
                    <p className="text-xs text-red-700 dark:text-red-300 mt-1">
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

              <div className="md:col-span-2 flex gap-4 pt-4">
                <button 
                  type="button"
                  onClick={() => setEditingRes(null)}
                  className={cn(
                    "flex-1 py-3 rounded-xl font-bold transition-all text-center cursor-pointer",
                    settings?.theme === 'dark' ? "bg-gray-900 text-gray-300 hover:bg-gray-800" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  )}
                >
                  {t('common.cancel') || "Cancel"}
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-100 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {t('common.loading')}
                    </>
                  ) : (
                    t('common.save') || "Save"
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {alertToResolve && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border border-gray-100 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              {language === 'pt' ? 'Tem a certeza que pretende marcar este alerta como resolvido?' : 'Are you sure you want to mark this alert as resolved?'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-8">
              {language === 'pt' ? 'Uma vez resolvido, este alerta será removido da lista de alertas ativos.' : 'Once resolved, this alert will be removed from the active alerts list.'}
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  try {
                    await resolveAlert(alertToResolve);
                    toast.success(language === 'pt' ? 'Alerta resolvido' : 'Alert resolved');
                    setAlertToResolve(null);
                  } catch(e) {
                    toast.error(language === 'pt' ? 'Erro ao resolver' : 'Error resolving alert');
                  }
                }}
                className="w-full bg-green-600 text-white py-4 rounded-2xl font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-200 cursor-pointer"
              >
                {language === 'pt' ? 'Confirmar' : 'Confirm'}
              </button>
              <button
                onClick={() => setAlertToResolve(null)}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                {language === 'pt' ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
      {alertToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative border border-gray-100 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
              Delete Alert
            </h3>
            <p className="text-gray-500 dark:text-gray-400 text-center mb-8 leading-relaxed">
              Are you sure you want to delete this alert? This action cannot be undone.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={async () => {
                  try {
                    await deleteAlert(alertToDelete);
                    toast.success(language === 'pt' ? 'Alerta apagado' : 'Alert deleted');
                    setAlertToDelete(null);
                  } catch(e) {
                    toast.error(language === 'pt' ? 'Erro ao apagar alerta' : 'Error deleting alert');
                  }
                }}
                className="w-full bg-red-600 text-white py-4 rounded-2xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200 dark:shadow-none cursor-pointer"
              >
                {language === 'pt' ? 'Confirmar' : 'Confirm'}
              </button>
              <button
                onClick={() => setAlertToDelete(null)}
                className="w-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 py-4 rounded-2xl font-bold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
              >
                {language === 'pt' ? 'Cancelar' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

