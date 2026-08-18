import React, { useState, useEffect, useMemo } from 'react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { Reservation, Table } from '../types';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { 
  format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, 
  startOfYear, endOfYear, parseISO, isSameDay, isWithinInterval, 
  eachDayOfInterval, getDay, getMonth, isAfter, eachMonthOfInterval, startOfToday,
  subMonths
} from 'date-fns';
import { pt } from 'date-fns/locale';
import { 
  TrendingUp, TrendingDown, Users, Calendar, Clock, 
  Smartphone, Monitor, UserCheck, UserX, AlertCircle, Sparkles, Filter, Minus
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function AdminInsights() {
  const { settings } = useSettings();
  const { language, t } = useLanguage();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'last_month' | 'year' | 'all'>('month');
  const [bookingType, setBookingType] = useState<'all' | 'online' | 'manual'>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [isYearComparisonMode, setIsYearComparisonMode] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const resQuery = query(collection(db, 'reservations'));
        const resSnap = await getDocs(resQuery);
        const resData = resSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Reservation));
        
        const validRes = resData.filter(r => r.status !== 'blocked');
        setReservations(validRes);

        const tablesSnap = await getDocs(collection(db, 'tables'));
        const tablesData = tablesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Table));
        setTables(tablesData);
        
        const custSnap = await getDocs(collection(db, 'customers'));
        const custData = custSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCustomers(custData);
      } catch (err) {
        console.error("Error fetching insights data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const today = startOfToday();

  const referenceDate = useMemo(() => {
    if (filterYear !== 'all') {
      const y = parseInt(filterYear);
      const d = new Date(today);
      d.setFullYear(y);
      return d;
    }
    return today;
  }, [filterYear, today]);

  // FILTERED BY TYPE AND YEAR (for comparisons that span outside the selected date range)
  const typeFilteredReservations = useMemo(() => {
    return reservations.filter(res => {
      // Booking Type Filter
      if (bookingType === 'online' && res.source !== 'public') return false;
      if (bookingType === 'manual' && res.source === 'public') return false;
      
      try {
        if (filterYear !== 'all') {
          const resDate = parseISO(res.date);
          if (resDate.getFullYear().toString() !== filterYear) return false;
        }
      } catch (e) {
        return false;
      }
      return true;
    });
  }, [reservations, bookingType, filterYear]);

  // FILTERED DATA
  const filteredReservations = useMemo(() => {
    return typeFilteredReservations.filter(res => {
      // Date Range Filter
      try {
        const resDate = parseISO(res.date);
        switch (dateRange) {
          case 'today':
            return isSameDay(resDate, today);
          case 'week':
            return isWithinInterval(resDate, { start: startOfWeek(today, { weekStartsOn: 1 }), end: endOfWeek(today, { weekStartsOn: 1 }) });
          case 'month':
            return isWithinInterval(resDate, { start: startOfMonth(today), end: endOfMonth(today) });
          case 'last_month':
            const lastMonth = subMonths(today, 1);
            return isWithinInterval(resDate, { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) });
          case 'year':
            return isWithinInterval(resDate, { start: startOfYear(today), end: endOfYear(today) });
          default:
            return true;
        }
      } catch (e) {
        return false;
      }
    });
  }, [typeFilteredReservations, dateRange, today]);

  const yearComparisonData = useMemo(() => {
    const yearStats: Record<string, { online: number; manual: number; total: number; actualTotal: number; actualOnline: number; actualManual: number }> = {};
    reservations.forEach(r => {
      try {
        const d = parseISO(r.date);
        const y = d.getFullYear().toString();
        if (!yearStats[y]) yearStats[y] = { online: 0, manual: 0, total: 0, actualTotal: 0, actualOnline: 0, actualManual: 0 };
        if (r.source === 'public') yearStats[y].online += 1;
        else yearStats[y].manual += 1;
        yearStats[y].total += 1;

        if (r.status !== 'cancelled' && r.status !== 'no-show') {
          if (r.source === 'public') yearStats[y].actualOnline += 1;
          else yearStats[y].actualManual += 1;
          yearStats[y].actualTotal += 1;
        }
      } catch (e) {}
    });

    return Object.entries(yearStats)
      .map(([year, data]) => ({ year, ...data }))
      .sort((a, b) => b.year.localeCompare(a.year));
  }, [reservations]);

  // KPIs
  const kpis = useMemo(() => {
    const total = filteredReservations.length;
    
    // Reservations Today
    const resToday = typeFilteredReservations.filter(r => isSameDay(parseISO(r.date), referenceDate)).length;
    const resYesterday = typeFilteredReservations.filter(r => isSameDay(parseISO(r.date), subDays(referenceDate, 1))).length;
    const todayDiff = resYesterday === 0 ? 100 : Math.round(((resToday - resYesterday) / resYesterday) * 100);

    // This week
    const thisWeek = typeFilteredReservations.filter(r => isWithinInterval(parseISO(r.date), { start: startOfWeek(referenceDate, { weekStartsOn: 1 }), end: endOfWeek(referenceDate, { weekStartsOn: 1 }) })).length;
    
    // This month
    const thisMonth = typeFilteredReservations.filter(r => isWithinInterval(parseISO(r.date), { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) })).length;
    const lastMonthTotal = typeFilteredReservations.filter(r => isWithinInterval(parseISO(r.date), { start: startOfMonth(subMonths(referenceDate, 1)), end: endOfMonth(subMonths(referenceDate, 1)) })).length;
    const monthDiff = lastMonthTotal === 0 ? 100 : Math.round(((thisMonth - lastMonthTotal) / lastMonthTotal) * 100);

    // Average Party Size
    const totalGuests = filteredReservations.reduce((acc, r) => acc + (r.guests || 0), 0);
    const avgParty = total === 0 ? 0 : (totalGuests / total).toFixed(1);

    const onlineRes = filteredReservations.filter(r => r.source === 'public');
    const manualRes = filteredReservations.filter(r => r.source !== 'public');
    
    const onlineGuests = onlineRes.reduce((acc, r) => acc + (r.guests || 0), 0);
    const manualGuests = manualRes.reduce((acc, r) => acc + (r.guests || 0), 0);
    
    const avgOnline = onlineRes.length === 0 ? 0 : (onlineGuests / onlineRes.length).toFixed(1);
    const avgManual = manualRes.length === 0 ? 0 : (manualGuests / manualRes.length).toFixed(1);

    let newCustomers = 0;
    if (customers) {
      if (dateRange === 'today') {
        newCustomers = customers.filter(c => c.createdAt && isSameDay(parseISO(c.createdAt), referenceDate)).length;
      } else if (dateRange === 'week') {
        newCustomers = customers.filter(c => c.createdAt && isWithinInterval(parseISO(c.createdAt), { start: startOfWeek(referenceDate, { weekStartsOn: 1 }), end: endOfWeek(referenceDate, { weekStartsOn: 1 }) })).length;
      } else if (dateRange === 'month' || dateRange === 'last_month') {
        newCustomers = customers.filter(c => c.createdAt && isWithinInterval(parseISO(c.createdAt), { start: startOfMonth(referenceDate), end: endOfMonth(referenceDate) })).length;
      } else if (dateRange === 'year') {
        newCustomers = customers.filter(c => c.createdAt && isWithinInterval(parseISO(c.createdAt), { start: startOfYear(referenceDate), end: endOfYear(referenceDate) })).length;
      } else {
        newCustomers = customers.length;
      }
    }
    const totalCustomers = customers ? customers.length : 0;
    
    return { total, resToday, todayDiff, thisWeek, thisMonth, monthDiff, avgParty, avgOnline, avgManual, onlineCount: onlineRes.length, manualCount: manualRes.length, totalCustomers, newCustomers };
  }, [filteredReservations, typeFilteredReservations, referenceDate]);

  // CHARTS DATA
  // 1. By Hour
  const byHourData = useMemo(() => {
    let minHour = 24;
    let maxHour = 0;

    if (settings?.openingHours) {
      Object.values(settings.openingHours).forEach(day => {
        if (!day.closed) {
          ['open', 'close'].forEach(key => {
            const val = (day as any)[key];
            if (val) {
              const h = parseInt(val.split(':')[0]);
              if (!isNaN(h)) {
                if (h < minHour) minHour = h;
                if (h > maxHour) maxHour = h;
              }
            }
          });
          ['lunch', 'dinner'].forEach(session => {
            if ((day as any)[session]) {
              ['open', 'close'].forEach(key => {
                const val = (day as any)[session][key];
                if (val) {
                  const h = parseInt(val.split(':')[0]);
                  if (!isNaN(h)) {
                    if (h < minHour) minHour = h;
                    if (h > maxHour) maxHour = h;
                  }
                }
              });
            }
          });
        }
      });
    }

    if (minHour >= 24) minHour = 10;
    if (maxHour <= 0 || maxHour < minHour) maxHour = 23;
    if (maxHour < 23) maxHour = 23;

    filteredReservations.forEach(r => {
      const h = parseInt(r.time.split(':')[0]);
      if (!isNaN(h)) {
        if (h < minHour) minHour = h;
        if (h > maxHour) maxHour = h;
      }
    });

    const hours: Record<string, { reservations: number, guests: number }> = {};
    
    for (let i = minHour; i <= maxHour; i++) {
      const hStr = i.toString().padStart(2, '0') + ':00';
      hours[hStr] = { reservations: 0, guests: 0 };
    }

    filteredReservations.forEach(r => {
      const h = r.time.split(':')[0] + ':00';
      if (!hours[h]) hours[h] = { reservations: 0, guests: 0 };
      hours[h].reservations += 1;
      hours[h].guests += (r.guests || 0);
    });
    return Object.entries(hours)
      .map(([hour, data]) => ({ hour, ...data }))
      .sort((a, b) => a.hour.localeCompare(b.hour));
  }, [filteredReservations, settings]);

  // 2. By Day of Week
  const byDayData = useMemo(() => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const daysPt = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const counts = [0,0,0,0,0,0,0].map((_, i) => ({ 
      day: language === 'pt' ? daysPt[i] : days[i], 
      reservations: 0, 
      guests: 0 
    }));
    
    filteredReservations.forEach(r => {
      try {
        const d = getDay(parseISO(r.date));
        counts[d].reservations += 1;
        counts[d].guests += (r.guests || 0);
      } catch (e) {}
    });
    // Shift so Monday is first
    const shifted = [...counts.slice(1), counts[0]];
    return shifted;
  }, [filteredReservations, language]);

  // 3. Monthly Comparison (Year)
  const monthlyData = useMemo(() => {
    const months = language === 'pt' 
      ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
    const data = months.map(m => ({ month: m, online: 0, manual: 0, total: 0 }));
    
    typeFilteredReservations.filter(r => isWithinInterval(parseISO(r.date), { start: startOfYear(referenceDate), end: endOfYear(referenceDate) }))
      .forEach(r => {
        try {
          const m = getMonth(parseISO(r.date));
          if (r.source === 'public') data[m].online += 1;
          else data[m].manual += 1;
          data[m].total += 1;
        } catch (e) {}
      });
    return data;
  }, [typeFilteredReservations, referenceDate, language]);

  const getSessionFromTime = (time: string, dateStr: string, manualSession?: 'lunch' | 'dinner') => {
    if (manualSession) return manualSession;
    try {
      const dateObj = parseISO(dateStr);
      const dayOfWeek = getDay(dateObj);
      const dayHours = settings?.openingHours[dayOfWeek.toString()];
      const specialDay = settings?.specialDays?.[dateStr];

      const lunch = specialDay ? specialDay.lunch : dayHours?.lunch;
      const dinner = specialDay ? specialDay.dinner : dayHours?.dinner;

      if (lunch?.active && time >= lunch.open && time < lunch.close) return 'lunch';
      if (dinner?.active && time >= dinner.open && time < dinner.close) return 'dinner';
      
      // If we can't determine, guess based on time (before 16:00 is lunch)
      const hour = parseInt(time.split(':')[0]);
      if (hour < 16) return 'lunch';
      return 'dinner';
    } catch (e) {
      return 'general';
    }
  };

  const sessionDonutData = useMemo(() => {
    let lunchCount = 0;
    let dinnerCount = 0;
    
    filteredReservations.forEach(r => {
      const session = getSessionFromTime(r.time, r.date, r.manualSession);
      if (session === 'lunch') lunchCount++;
      else if (session === 'dinner') dinnerCount++;
    });

    const total = lunchCount + dinnerCount;

    return {
      lunchCount,
      dinnerCount,
      total,
      data: [
        { name: language === 'pt' ? 'Almoço' : 'Lunch', value: lunchCount, color: '#10b981' },
        { name: language === 'pt' ? 'Jantar' : 'Dinner', value: dinnerCount, color: '#6366f1' }
      ]
    };
  }, [filteredReservations, language, settings]);

  // 3.2 Monthly Comparison Session (Lunch vs Dinner)
  const sessionMonthlyData = useMemo(() => {
    const months = language === 'pt' 
      ? ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      : ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      
    const data = months.map(m => ({ month: m, lunch: 0, dinner: 0, total: 0 }));
    
    typeFilteredReservations.filter(r => isWithinInterval(parseISO(r.date), { start: startOfYear(referenceDate), end: endOfYear(referenceDate) }))
      .forEach(r => {
        try {
          const m = getMonth(parseISO(r.date));
          const session = getSessionFromTime(r.time, r.date, r.manualSession);
          if (session === 'lunch') data[m].lunch += 1;
          else if (session === 'dinner') data[m].dinner += 1;
          data[m].total += 1;
        } catch (e) {}
      });
    return data;
  }, [typeFilteredReservations, referenceDate, language, settings]);

  // 3.5 Last Month vs This Month
  const monthComparisonData = useMemo(() => {
    let baseDate = referenceDate;
    if (dateRange === 'last_month') {
      baseDate = subMonths(referenceDate, 1);
    }
    
    const thisMonthStart = startOfMonth(baseDate);
    const thisMonthEnd = endOfMonth(baseDate);
    const lastMonthStart = startOfMonth(subMonths(baseDate, 1));
    const lastMonthEnd = endOfMonth(subMonths(baseDate, 1));

    const thisMonthOnline = typeFilteredReservations.filter(r => r.source === 'public' && isWithinInterval(parseISO(r.date), { start: thisMonthStart, end: thisMonthEnd })).length;
    const thisMonthManual = typeFilteredReservations.filter(r => r.source !== 'public' && isWithinInterval(parseISO(r.date), { start: thisMonthStart, end: thisMonthEnd })).length;
    
    const lastMonthOnline = typeFilteredReservations.filter(r => r.source === 'public' && isWithinInterval(parseISO(r.date), { start: lastMonthStart, end: lastMonthEnd })).length;
    const lastMonthManual = typeFilteredReservations.filter(r => r.source !== 'public' && isWithinInterval(parseISO(r.date), { start: lastMonthStart, end: lastMonthEnd })).length;

    const onlineDiff = lastMonthOnline === 0 ? (thisMonthOnline > 0 ? 100 : 0) : Math.round(((thisMonthOnline - lastMonthOnline) / lastMonthOnline) * 100);
    const manualDiff = lastMonthManual === 0 ? (thisMonthManual > 0 ? 100 : 0) : Math.round(((thisMonthManual - lastMonthManual) / lastMonthManual) * 100);

    const totalDiff = (lastMonthOnline + lastMonthManual) === 0 
      ? ((thisMonthOnline + thisMonthManual) > 0 ? 100 : 0) 
      : Math.round((((thisMonthOnline + thisMonthManual) - (lastMonthOnline + lastMonthManual)) / (lastMonthOnline + lastMonthManual)) * 100);

    const formatMonth = (d: Date) => {
      const formatted = format(d, 'MMMM', language === 'pt' ? { locale: pt } : undefined);
      return formatted.charAt(0).toUpperCase() + formatted.slice(1);
    };

    return {
      chartData: [
        { period: formatMonth(lastMonthStart), online: lastMonthOnline, manual: lastMonthManual },
        { period: formatMonth(thisMonthStart), online: thisMonthOnline, manual: thisMonthManual }
      ],
      thisMonthName: formatMonth(thisMonthStart),
      lastMonthName: formatMonth(lastMonthStart),
      thisMonthOnline,
      thisMonthManual,
      lastMonthOnline,
      lastMonthManual,
      onlineDiff,
      manualDiff,
      totalDiff
    };
  }, [typeFilteredReservations, referenceDate, language, dateRange]);

  // 4. Source Donut
  const sourceData = [
    { name: 'Online', value: kpis.onlineCount, color: '#3b82f6' },
    { name: 'Manual', value: kpis.manualCount, color: '#f59e0b' }
  ];

  // 6. Heatmap
  const heatmapData = useMemo(() => {
    // Rows: 12 months, Cols: 31 days max
    const grid: number[][] = Array.from({ length: 12 }, () => Array(31).fill(0));
    let maxVal = 1;
    typeFilteredReservations.filter(r => isWithinInterval(parseISO(r.date), { start: startOfYear(referenceDate), end: endOfYear(referenceDate) }))
      .forEach(r => {
        try {
          const d = parseISO(r.date);
          const m = getMonth(d); // 0-11
          const day = d.getDate() - 1; // 0-30
          grid[m][day] += 1;
          if (grid[m][day] > maxVal) maxVal = grid[m][day];
        } catch(e) {}
      });
    return { grid, maxVal };
  }, [typeFilteredReservations, referenceDate]);
  const statusStats = useMemo(() => {
    const total = filteredReservations.length || 1;
    const cancelled = filteredReservations.filter(r => r.status === 'cancelled').length;
    const noShow = filteredReservations.filter(r => r.status === 'no-show').length;
    const completed = filteredReservations.filter(r => r.status === 'completed' || r.status === 'arrived').length;
    
    return {
      cancelRate: Math.round((cancelled / total) * 100),
      noShowRate: Math.round((noShow / total) * 100),
      successRate: Math.round((completed / total) * 100),
      cancelledCount: cancelled,
      noShowCount: noShow,
      completedCount: completed,
      totalCount: filteredReservations.length
    };
  }, [filteredReservations]);

  // AI Insights Generation
  const aiInsights = useMemo(() => {
    const insights: string[] = [];
    
    if (byDayData.length > 0) {
      const busiestDay = [...byDayData].sort((a, b) => b.reservations - a.reservations)[0];
      const quietestDay = [...byDayData].sort((a, b) => a.reservations - b.reservations)[0];
      if (busiestDay.reservations > 0) {
        insights.push(language === 'pt' 
          ? `${busiestDay.day} é o dia com maior procura, com média alta de reservas.`
          : `${busiestDay.day} is the busiest day with the highest number of reservations.`);
      }
      if (quietestDay.reservations === 0) {
         insights.push(language === 'pt' 
          ? `${quietestDay.day} tem capacidade disponível para promoções.`
          : `${quietestDay.day} has available capacity for promotions.`);
      }
    }

    if (kpis.onlineCount > kpis.manualCount) {
      insights.push(language === 'pt'
        ? "As reservas online são a principal fonte de captação de clientes."
        : "Online bookings are the main source of customer acquisition.");
    } else if (kpis.manualCount > kpis.onlineCount) {
       insights.push(language === 'pt'
        ? "O volume de reservas manuais continua elevado, considere promover os canais digitais."
        : "Manual booking volume remains high, consider promoting digital channels.");
    }

    if (statusStats.noShowRate > 10) {
      insights.push(language === 'pt'
        ? "A taxa de no-shows está alta. Considere implementar lembretes SMS."
        : "No-show rate is high. Consider implementing SMS reminders.");
    }

    if (settings?.openingHours) {
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const daysPt = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
      const daysEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      
      const closedDaysOfWeek: string[] = [];
      days.forEach((day, idx) => {
        if (settings.openingHours[day]?.closed) {
          closedDaysOfWeek.push(language === 'pt' ? daysPt[idx] : daysEn[idx]);
        }
      });
      
      if (closedDaysOfWeek.length > 0) {
        insights.push(language === 'pt'
          ? `O restaurante encontra-se encerrado: ${closedDaysOfWeek.join(', ')}.`
          : `The restaurant is regularly closed on: ${closedDaysOfWeek.join(', ')}.`);
      }
    }

    if (settings?.closedDays && settings.closedDays.length > 0) {
       const upcomingClosed = settings.closedDays.filter(d => new Date(d) >= today).length;
       if (upcomingClosed > 0) {
         insights.push(language === 'pt' 
            ? `Existem ${upcomingClosed} dia(s) de encerramento excecional agendados no futuro.`
            : `There are ${upcomingClosed} exceptional closed day(s) scheduled in the future.`);
       }
    }

    return insights.slice(0, 5);
  }, [byDayData, kpis, language, statusStats, settings, today]);

  const top5Years = yearComparisonData.slice(0, 5);
  const chartData = top5Years;
  const maxTotal = top5Years.length > 0 ? Math.max(...top5Years.map(d => d.total)) : 0;
  const minTotal = top5Years.length > 0 ? Math.min(...top5Years.map(d => d.total)) : 0;

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-amber-500"><Sparkles className="animate-spin" /></div>;
  }

  return (
    <div className={cn(
      "min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 transition-colors",
      settings?.theme === 'dark' ? "bg-gray-950 text-white" : "bg-gray-50 text-gray-900"
    )}>
      <div className={cn("mx-auto space-y-6", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
        
        {/* Header & Filters */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Sparkles className="text-amber-500" />
              {language === 'pt' ? 'Estatísticas' : 'Insights Dashboard'}
            </h1>
            <p className={cn("text-sm mt-1", settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500")}>
              {language === 'pt' ? 'Visão geral da performance e estatísticas do restaurante.' : 'Overview of restaurant performance and statistics.'}
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {!isYearComparisonMode && (
              <>
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border", settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
                  <Calendar size={14} className="text-amber-500" />
                  <select 
                    value={dateRange}
                    onChange={(e) => {
                      setDateRange(e.target.value as any);
                      if (e.target.value !== 'all') setFilterYear('all');
                    }}
                    className="bg-transparent text-sm font-medium outline-none cursor-pointer"
                  >
                    <option value="today">{language === 'pt' ? 'Hoje' : 'Today'}</option>
                    <option value="week">{language === 'pt' ? 'Esta Semana' : 'This Week'}</option>
                    <option value="month">{language === 'pt' ? 'Este Mês' : 'This Month'}</option>
                    <option value="last_month">{language === 'pt' ? 'Mês Passado' : 'Last Month'}</option>
                    <option value="year">{language === 'pt' ? 'Este Ano' : 'This Year'}</option>
                    <option value="all">{language === 'pt' ? 'Tudo' : 'All Time'}</option>
                  </select>
                </div>

                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border", settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
                  <Calendar size={14} className="text-blue-500" />
                  <select 
                    value={filterYear}
                    onChange={(e) => {
                      setFilterYear(e.target.value);
                      if (e.target.value !== 'all') setDateRange('all');
                    }}
                    className="bg-transparent text-sm font-medium outline-none cursor-pointer"
                  >
                    <option value="all">{language === 'pt' ? 'Qualquer Ano' : 'Any Year'}</option>
                    {Array.from({ length: Math.max(1, new Date().getFullYear() - 2026 + 1) }, (_, i) => 2026 + i).map(y => (
                      <option key={y} value={y.toString()}>{y}</option>
                    ))}
                  </select>
                </div>
                
                <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-lg border", settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
                  <Filter size={14} className="text-blue-500" />
                  <select 
                    value={bookingType}
                    onChange={(e) => setBookingType(e.target.value as any)}
                    className="bg-transparent text-sm font-medium outline-none cursor-pointer"
                  >
                    <option value="all">{language === 'pt' ? 'Todas as Reservas' : 'All Bookings'}</option>
                    <option value="online">{language === 'pt' ? 'Apenas Online' : 'Online Only'}</option>
                    <option value="manual">{language === 'pt' ? 'Apenas Manuais' : 'Manual Only'}</option>
                  </select>
                </div>
              </>
            )}

            <button
              onClick={() => setIsYearComparisonMode(!isYearComparisonMode)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors",
                isYearComparisonMode 
                  ? "bg-indigo-500 text-white border-indigo-500"
                  : (settings?.theme === 'dark' ? "bg-gray-900 border-gray-800 text-gray-300" : "bg-white border-gray-200 text-gray-700")
              )}
            >
              <Calendar size={14} />
              {language === 'pt' ? 'Comparação por Ano' : 'Year Comparison'}
            </button>
          </div>
        </div>

        {isYearComparisonMode ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">{language === 'pt' ? 'Comparação por Ano' : 'Year Comparison'}</h2>
              {top5Years.map(data => (
                <div key={data.year} className={cn(
                  "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center gap-4",
                  settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <div className="md:w-1/4 flex-shrink-0">
                    <h3 className="text-xl font-black">{data.year}</h3>
                    <p className="text-[10px] font-medium text-gray-500 uppercase mt-1">{language === 'pt' ? 'Total de Reservas' : 'Total Bookings'}</p>
                    <div className="text-2xl font-bold mt-1">{data.total}</div>
                  </div>
                  
                  <div className="md:w-3/4 flex-grow space-y-2">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold mb-1 text-blue-600 dark:text-blue-400">
                        <span>Online</span>
                        <span>{data.online} ({data.total > 0 ? Math.round((data.online / data.total) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${data.total > 0 ? (data.online / data.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between text-[10px] font-bold mb-1 text-amber-600 dark:text-amber-400">
                        <span>{language === 'pt' ? 'Manual' : 'Manual'}</span>
                        <span>{data.manual} ({data.total > 0 ? Math.round((data.manual / data.total) * 100) : 0}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-4 overflow-hidden">
                        <div className="h-full bg-amber-500 rounded-full transition-all duration-1000" style={{ width: `${data.total > 0 ? (data.manual / data.total) * 100 : 0}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-6">
              <div className="space-y-4">
                <h2 className="text-xl font-bold">{language === 'pt' ? 'Reservas por Ano' : 'Reservations by Year'}</h2>
                <div className={cn(
                  "p-5 rounded-2xl border h-[300px]",
                  settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={chartData} margin={{ top: 20, right: 40, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
                      <XAxis type="number" axisLine={false} tickLine={false} hide={true} />
                      <YAxis dataKey="year" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: '#111827', fontWeight: 'bold' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar 
                        dataKey="total" 
                        name={language === 'pt' ? 'Total' : 'Total'} 
                        barSize={6}
                        radius={[0, 4, 4, 0]}
                        label={{ position: 'right', fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12, fontWeight: 'bold' }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.total === maxTotal ? '#22c55e' : entry.total === minTotal ? '#ef4444' : '#8b5cf6'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-xl font-bold">{language === 'pt' ? 'Reservas por Ano (Efetivas)' : 'Reservations by Year (Actual)'}</h2>
                <div className={cn(
                  "p-5 rounded-2xl border h-[300px]",
                  settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm"
                )}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={chartData} margin={{ top: 20, right: 40, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
                      <XAxis type="number" axisLine={false} tickLine={false} hide={true} />
                      <YAxis dataKey="year" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                        itemStyle={{ color: '#111827', fontWeight: 'bold' }}
                        cursor={{ fill: 'transparent' }}
                      />
                      <Bar 
                        dataKey="actualTotal" 
                        name={language === 'pt' ? 'Total (Efetivas)' : 'Total (Actual)'} 
                        barSize={6}
                        radius={[0, 4, 4, 0]}
                        label={{ position: 'right', fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280', fontSize: 12, fontWeight: 'bold' }}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-actual-${index}`} fill={entry.total === maxTotal ? '#10b981' : entry.total === minTotal ? '#f43f5e' : '#6366f1'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
        {/* AI Insights Banner */}
        <div className={cn(
          "rounded-2xl p-6 border flex flex-col md:flex-row gap-6 items-start",
          settings?.theme === 'dark' ? "bg-indigo-950/20 border-indigo-500/20" : "bg-indigo-50 border-indigo-100"
        )}>
          <div className="flex-shrink-0 w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white">
            <Sparkles size={24} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mb-2">
              {language === 'pt' ? 'Estatísticas Inteligentes' : 'Smart Insights'}
            </h3>
            <ul className="space-y-2">
              {aiInsights.map((insight, idx) => (
                <li key={idx} className={cn("text-sm font-medium flex items-center gap-2", settings?.theme === 'dark' ? "text-indigo-200" : "text-indigo-900")}>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                  {insight}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
          <KpiCard 
            title={language === 'pt' ? 'Total Selecionado' : 'Total Selected'}
            value={kpis.total}
            icon={<Monitor className="text-blue-500" />}
            theme={settings?.theme}
          />
          <KpiCard 
            title={language === 'pt' ? 'Total de Clientes' : 'Total Customers'}
            value={kpis.totalCustomers}
            icon={<Users className="text-teal-500" />}
            theme={settings?.theme}
          />
          <KpiCard 
            title={language === 'pt' ? 'Novos Clientes' : 'New Customers'}
            value={kpis.newCustomers}
            icon={<Sparkles className="text-indigo-500" />}
            theme={settings?.theme}
          />
          <KpiCard 
            title={language === 'pt' ? 'Hoje' : 'Today'}
            value={kpis.resToday}
            trend={kpis.todayDiff}
            icon={<Calendar className="text-amber-500" />}
            theme={settings?.theme}
          />
          <KpiCard 
            title={language === 'pt' ? 'Esta Semana' : 'This Week'}
            value={kpis.thisWeek}
            icon={<Clock className="text-purple-500" />}
            theme={settings?.theme}
          />
          <KpiCard 
            title={language === 'pt' ? 'Este Mês' : 'This Month'}
            value={kpis.thisMonth}
            trend={kpis.monthDiff}
            icon={<TrendingUp className="text-green-500" />}
            theme={settings?.theme}
          />
          <KpiCard 
            title={language === 'pt' ? 'Média de Pessoas' : 'Avg Party Size'}
            value={kpis.avgParty}
            subtext={`Online: ${kpis.avgOnline} | Manual: ${kpis.avgManual}`}
            icon={<Users className="text-rose-500" />}
            theme={settings?.theme}
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* By Hour */}
          <ChartCard title={language === 'pt' ? 'Reservas por Hora' : 'Reservations by Hour'} theme={settings?.theme}>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={byHourData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
                <XAxis dataKey="hour" interval={0} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#111827', fontWeight: 'bold' }}
                />
                <Area type="monotone" dataKey="reservations" name={language === 'pt' ? 'Reservas' : 'Reservations'} stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRes)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* By Day */}
          <ChartCard title={language === 'pt' ? 'Atividade Semanal' : 'Weekly Activity'} theme={settings?.theme}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byDayData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6' }}
                />
                <Bar dataKey="reservations" name={language === 'pt' ? 'Reservas' : 'Reservations'} fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Source Analytics */}
          <ChartCard title={language === 'pt' ? 'Origem de Reservas' : 'Booking Source'} theme={settings?.theme} className="lg:col-span-1">
            <div className="flex flex-col items-center h-full justify-center relative">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold">{kpis.total}</span>
                <span className="text-xs text-gray-500 uppercase">{language === 'pt' ? 'Total' : 'Total'}</span>
              </div>
              <div className="flex gap-6 mt-4 w-full justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <span className="text-sm font-medium">Online ({Math.round(kpis.onlineCount/kpis.total*100 || 0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <span className="text-sm font-medium">Manual ({Math.round(kpis.manualCount/kpis.total*100 || 0)}%)</span>
                </div>
              </div>
            </div>
          </ChartCard>

          {/* Monthly Comparison */}
          <ChartCard title={language === 'pt' ? `Comparação Mensal (${referenceDate.getFullYear()})` : `Monthly Comparison (${referenceDate.getFullYear()})`} theme={settings?.theme} className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="manual" name="Manual Bookings" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="online" name="Online Bookings" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Growth Comparison Row */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mt-6">
          <ChartCard title={language === 'pt' ? `Crescimento Mensal (${monthComparisonData.lastMonthName} vs ${monthComparisonData.thisMonthName})` : `Monthly Growth (${monthComparisonData.lastMonthName} vs ${monthComparisonData.thisMonthName})`} theme={settings?.theme} className="lg:col-span-3">
            <div className="flex flex-col lg:flex-row gap-6 mt-4">
              <div className="flex-grow min-h-[300px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={monthComparisonData.chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
                    <XAxis dataKey="period" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                      cursor={{ fill: settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6' }}
                    />
                    <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                    <Bar dataKey="manual" name={language === 'pt' ? 'Manuais' : 'Manual'} fill="#f59e0b" radius={[4, 4, 0, 0]} barSize={30} />
                    <Bar dataKey="online" name="Online" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-col justify-center gap-6 lg:w-64 flex-shrink-0">
                <div className="p-4 rounded-xl border border-blue-100 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800/30">
                  <div className="text-sm font-bold text-blue-600 dark:text-blue-400 uppercase mb-2">Online</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black">{monthComparisonData.thisMonthOnline}</span>
                    <span className="text-sm text-gray-500">vs {monthComparisonData.lastMonthOnline}</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 font-bold mt-2",
                    monthComparisonData.onlineDiff > 0 ? "text-green-500" : monthComparisonData.onlineDiff < 0 ? "text-rose-500" : "text-gray-500"
                  )}>
                    {monthComparisonData.onlineDiff > 0 ? <TrendingUp size={16} /> : monthComparisonData.onlineDiff < 0 ? <TrendingDown size={16} /> : null}
                    <span>{Math.abs(monthComparisonData.onlineDiff)}%</span>
                  </div>
                </div>
                
                <div className="p-4 rounded-xl border border-amber-100 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800/30">
                  <div className="text-sm font-bold text-amber-600 dark:text-amber-400 uppercase mb-2">{language === 'pt' ? 'Manuais' : 'Manual'}</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-black">{monthComparisonData.thisMonthManual}</span>
                    <span className="text-sm text-gray-500">vs {monthComparisonData.lastMonthManual}</span>
                  </div>
                  <div className={cn(
                    "flex items-center gap-1 font-bold mt-2",
                    monthComparisonData.manualDiff > 0 ? "text-green-500" : monthComparisonData.manualDiff < 0 ? "text-rose-500" : "text-gray-500"
                  )}>
                    {monthComparisonData.manualDiff > 0 ? <TrendingUp size={16} /> : monthComparisonData.manualDiff < 0 ? <TrendingDown size={16} /> : null}
                    <span>{Math.abs(monthComparisonData.manualDiff)}%</span>
                  </div>
                </div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title={`${monthComparisonData.lastMonthName} vs ${monthComparisonData.thisMonthName}`} theme={settings?.theme} className="lg:col-span-1">
            <div className="flex flex-col items-center h-full justify-center relative">
              <div className="relative w-full">
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Online', value: monthComparisonData.thisMonthOnline, color: '#3b82f6' },
                        { name: 'Manual', value: monthComparisonData.thisMonthManual, color: '#f59e0b' }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={65}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      stroke="none"
                    >
                      {[
                        { name: 'Online', value: monthComparisonData.thisMonthOnline, color: '#3b82f6' },
                        { name: 'Manual', value: monthComparisonData.thisMonthManual, color: '#f59e0b' }
                      ].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold">{monthComparisonData.thisMonthOnline + monthComparisonData.thisMonthManual}</span>
                  <span className="text-xs text-gray-500 uppercase">{language === 'pt' ? 'Total' : 'Total'}</span>
                  <div className={cn(
                    "flex items-center gap-0.5 text-xs font-bold mt-1",
                    monthComparisonData.totalDiff > 0 ? "text-green-500" : monthComparisonData.totalDiff < 0 ? "text-rose-500" : "text-gray-500"
                  )}>
                    {monthComparisonData.totalDiff > 0 ? <TrendingUp size={12} /> : monthComparisonData.totalDiff < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                    <span>{Math.abs(monthComparisonData.totalDiff)}%</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-center mt-4 w-full justify-center">
                <span className="text-[10px] text-gray-500 uppercase font-bold mb-2">Vs {monthComparisonData.lastMonthName}</span>
                <div className="flex flex-col gap-2 w-full px-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400">Online</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500">
                        {monthComparisonData.thisMonthOnline} vs {monthComparisonData.lastMonthOnline}
                      </span>
                      <span className={cn(
                        "text-xs font-bold w-10 text-right",
                        monthComparisonData.onlineDiff > 0 ? "text-green-500" : monthComparisonData.onlineDiff < 0 ? "text-rose-500" : "text-gray-500"
                      )}>
                        {monthComparisonData.onlineDiff > 0 ? '+' : ''}{monthComparisonData.onlineDiff}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full bg-amber-500 flex-shrink-0" />
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400">Manual</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500">
                        {monthComparisonData.thisMonthManual} vs {monthComparisonData.lastMonthManual}
                      </span>
                      <span className={cn(
                        "text-xs font-bold w-10 text-right",
                        monthComparisonData.manualDiff > 0 ? "text-green-500" : monthComparisonData.manualDiff < 0 ? "text-rose-500" : "text-gray-500"
                      )}>
                        {monthComparisonData.manualDiff > 0 ? '+' : ''}{monthComparisonData.manualDiff}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Total</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-500">
                        {monthComparisonData.thisMonthOnline + monthComparisonData.thisMonthManual} vs {monthComparisonData.lastMonthOnline + monthComparisonData.lastMonthManual}
                      </span>
                      <span className={cn(
                        "text-xs font-bold w-10 text-right",
                        monthComparisonData.totalDiff > 0 ? "text-green-500" : monthComparisonData.totalDiff < 0 ? "text-rose-500" : "text-gray-500"
                      )}>
                        {monthComparisonData.totalDiff > 0 ? '+' : ''}{monthComparisonData.totalDiff}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Sessions Comparison Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <ChartCard title={language === 'pt' ? 'Distribuição de Sessões' : 'Session Distribution'} theme={settings?.theme} className="lg:col-span-1">
            <div className="flex flex-col items-center h-full justify-center relative">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={sessionDonutData.data}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {sessionDonutData.data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-bold">{sessionDonutData.total}</span>
                <span className="text-xs text-gray-500 uppercase">{language === 'pt' ? 'Total' : 'Total'}</span>
              </div>
              <div className="flex gap-6 mt-4 w-full justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-sm font-medium">{language === 'pt' ? 'Almoço' : 'Lunch'} ({Math.round(sessionDonutData.lunchCount/sessionDonutData.total*100 || 0)}%)</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-500" />
                  <span className="text-sm font-medium">{language === 'pt' ? 'Jantar' : 'Dinner'} ({Math.round(sessionDonutData.dinnerCount/sessionDonutData.total*100 || 0)}%)</span>
                </div>
              </div>
            </div>
          </ChartCard>

          <ChartCard title={language === 'pt' ? `Sessões Mensais (${referenceDate.getFullYear()})` : `Monthly Sessions (${referenceDate.getFullYear()})`} theme={settings?.theme} className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={sessionMonthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6'} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: settings?.theme === 'dark' ? '#9ca3af' : '#6b7280' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)' }}
                  cursor={{ fill: settings?.theme === 'dark' ? '#1f2937' : '#f3f4f6' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
                <Bar dataKey="lunch" name={language === 'pt' ? 'Almoço' : 'Lunch'} fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dinner" name={language === 'pt' ? 'Jantar' : 'Dinner'} fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <ChartCard title={language === 'pt' ? 'Performance de Presenças' : 'Attendance Performance'} theme={settings?.theme}>
             <div className="space-y-6 mt-4">
                <PerformanceRow 
                  label={language === 'pt' ? 'Taxa de Sucesso (Compareceu/Confirmado)' : 'Success Rate (Arrived/Confirmed)'} 
                  value={statusStats.successRate} 
                  count={statusStats.completedCount}
                  total={statusStats.totalCount}
                  color="bg-green-500" 
                />
                <PerformanceRow 
                  label={language === 'pt' ? 'Taxa de Cancelamento' : 'Cancellation Rate'} 
                  value={statusStats.cancelRate} 
                  count={statusStats.cancelledCount}
                  total={statusStats.totalCount}
                  color="bg-rose-500" 
                />
                <PerformanceRow 
                  label={language === 'pt' ? 'Taxa de No-Show' : 'No-Show Rate'} 
                  value={statusStats.noShowRate} 
                  count={statusStats.noShowCount}
                  total={statusStats.totalCount}
                  color="bg-gray-500" 
                />
             </div>
          </ChartCard>

          <ChartCard title={language === 'pt' ? 'Mapa de Ocupação' : 'Occupancy Heatmap'} theme={settings?.theme}>
            <div className="flex flex-col h-full mt-4">
              <div className="grid grid-cols-[auto_1fr] gap-2 overflow-x-auto pb-2">
                <div className="flex flex-col justify-between text-[10px] text-gray-400 font-bold pr-2 py-1">
                  {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map(m => (
                    <div key={m} className="h-4 flex items-center">{m}</div>
                  ))}
                </div>
                <div className="flex flex-col justify-between">
                  {heatmapData.grid.map((month, mIdx) => (
                    <div key={mIdx} className="flex gap-1 mb-1">
                      {month.map((val, dIdx) => {
                        const intensity = val === 0 ? 0 : Math.max(0.2, val / heatmapData.maxVal);
                        return (
                          <div 
                            key={dIdx}
                            title={`${val} reservations`}
                            className={cn(
                              "w-4 h-4 rounded-sm transition-colors",
                              val === 0 
                                ? (settings?.theme === 'dark' ? "bg-gray-800" : "bg-gray-100") 
                                : "bg-amber-500"
                            )}
                            style={{ opacity: val === 0 ? 1 : intensity }}
                          />
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end items-center gap-2 mt-2 text-xs text-gray-500">
                <span>{language === 'pt' ? 'Baixo' : 'Low'}</span>
                <div className="flex gap-1">
                  <div className={cn("w-3 h-3 rounded-sm", settings?.theme === 'dark' ? "bg-gray-800" : "bg-gray-100")} />
                  <div className="w-3 h-3 rounded-sm bg-amber-500" style={{ opacity: 0.3 }} />
                  <div className="w-3 h-3 rounded-sm bg-amber-500" style={{ opacity: 0.6 }} />
                  <div className="w-3 h-3 rounded-sm bg-amber-500" style={{ opacity: 1 }} />
                </div>
                <span>{language === 'pt' ? 'Alto' : 'High'}</span>
              </div>
            </div>
          </ChartCard>
        </div>
        </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, trend, subtext, icon, theme }: any) {
  return (
    <div className={cn(
      "p-6 rounded-2xl border transition-colors relative overflow-hidden flex flex-col",
      theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm hover:shadow-md"
    )}>
      <div className="flex justify-start relative z-10 mb-4">
        <div className="p-2 rounded-xl bg-gray-50 dark:bg-gray-800">
          {icon}
        </div>
      </div>
      <div className="relative z-10 flex flex-col items-start justify-start text-left w-full">
        <h4 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">{title}</h4>
        <div className="text-3xl font-black">{value}</div>
        
        {trend !== undefined && (
          <div className={cn(
            "flex items-center justify-start gap-1 text-sm font-bold mt-2",
            trend > 0 ? "text-green-500" : trend < 0 ? "text-rose-500" : "text-gray-500"
          )}>
            {trend > 0 ? <TrendingUp size={16} /> : trend < 0 ? <TrendingDown size={16} /> : null}
            <span>{Math.abs(trend)}% {trend >= 0 ? 'vs prev' : 'vs prev'}</span>
          </div>
        )}
        {subtext && (
          <div className="text-xs font-medium text-gray-500 mt-2 text-left">
            {subtext}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartCard({ title, children, className, theme }: any) {
  return (
    <div className={cn(
      "p-6 rounded-2xl border transition-colors h-full flex flex-col",
      theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-100 shadow-sm",
      className
    )}>
      <h3 className="text-lg font-bold mb-6">{title}</h3>
      <div className="flex-grow w-full">
        {children}
      </div>
    </div>
  );
}

function PerformanceRow({ label, value, count, total, color }: { label: string, value: number, count: number, total: number, color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm font-bold mb-2">
        <span>{label}</span>
        <span className="flex items-center gap-2">
          <span className="text-gray-500 font-medium text-xs">({count}/{total})</span>
          <span>{value || 0}%</span>
        </span>
      </div>
      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-1000", color)} style={{ width: `${value || 0}%` }} />
      </div>
    </div>
  );
}
