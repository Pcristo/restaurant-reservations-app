import React, { useState, useMemo } from 'react';
import { DatePicker } from '@mui/x-date-pickers';
import dayjs from 'dayjs';
import { motion, AnimatePresence } from 'motion/react';
import { Table, Reservation, Area, RestaurantSettings } from '../types';
import { cn, getOptimizedUrl, formatDisplayTime, getEffectiveOpeningHours } from '../lib/utils';
import { useCustomers } from '../hooks/useCustomers';
import { format, parseISO, isSameDay, differenceInMinutes, addMinutes, subHours, addHours, isToday } from 'date-fns';
import { toast } from 'react-hot-toast';
import { Clock, Moon, Sun, User, Maximize2, Minimize2, CalendarIcon, ChevronLeft, ChevronRight, Eye, EyeOff, RefreshCw, Search, X, FileText, Globe, Sparkles, Lock, Table2, Ban, Printer, Camera } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { useNavigate } from 'react-router-dom';
import { triggerPrint } from '../utils/printUtils';
import { takeScreenshot } from '../utils/screenshotUtils';

interface CronogramaViewProps {
  tables: Table[];
  areas: Area[];
  reservations: Reservation[];
  settings: RestaurantSettings | null;
  selectedDate: string;
  language: string;
  updateReservation: (id: string, data: Partial<Reservation>) => Promise<void>;
  updateTable?: (id: string, data: Partial<Table>) => Promise<void>;
  theme: 'light' | 'dark';
  onReservationClick: (resId: string) => void;
  onDateChange: (date: string) => void;
  onTableClick?: (tableId: string) => void;
}


function getMins(t: string): number {
  if (!t) return 0;
  const parts = t.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}
export default function CronogramaView({
  tables,
  areas,
  reservations,
  settings,
  selectedDate,
  language,
  updateReservation,
  updateTable,
  theme,
  onReservationClick,
  onDateChange,
  onTableClick
}: CronogramaViewProps) {
  const [draggedResId, setDraggedResId] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{resId: string, tableId: string, time: string, targetTableName: string, customerName: string, hasConflict: boolean} | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState<80 | 90 | 100>(100);
  const [filteredAreaId, setFilteredAreaId] = useState<string | null>(null);
  const { customers } = useCustomers();
  const [localTheme, setLocalTheme] = useState<'light' | 'dark'>(theme);
  const [searchQuery, setSearchQuery] = useState("");
  const { hasNewBookings, newBookingsList, removeNotificationBooking } = useNotifications();
  const navigate = useNavigate();
  const [showAvailableSlots, setShowAvailableSlots] = useState(false);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const [isDraggingScroll, setIsDraggingScroll] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.cursor-grab') || (e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('select') || (e.target as HTMLElement).closest('.cursor-pointer')) return;
    if (scrollContainerRef.current) {
      setIsDraggingScroll(true);
      setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
      setScrollLeft(scrollContainerRef.current.scrollLeft);
    }
  };

  const handleMouseLeave = () => {
    setIsDraggingScroll(false);
  };

  const handleMouseUp = () => {
    setIsDraggingScroll(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingScroll) return;
    e.preventDefault();
    if (scrollContainerRef.current) {
      const x = e.pageX - scrollContainerRef.current.offsetLeft;
      const walk = (x - startX) * 2;
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  React.useEffect(() => {
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      const matchedRes = reservations.find(res => 
        (res.customerName && res.customerName.toLowerCase().includes(lowerQuery)) ||
        (res.customerPhone && res.customerPhone.toLowerCase().includes(lowerQuery)) ||
        (res.id && res.id.toLowerCase().includes(lowerQuery))
      );
      if (matchedRes) {
        const el = document.getElementById(`crono-res-${matchedRes.id}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
        }
      }
    }
  }, [searchQuery, reservations]);

  React.useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);
  

  const [currentTime, setCurrentTime] = useState(new Date());
  const [dragOffsetSlots, setDragOffsetSlots] = useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const currentTheme = isFullscreen ? localTheme : theme;


const [timeRangeType, setTimeRangeType] = useState<'service' | '24h'>(settings?.cronogramaTimeRange || 'service');

  React.useEffect(() => {
    if (settings?.cronogramaTimeRange) {
      setTimeRangeType(settings.cronogramaTimeRange);
    }
  }, [settings?.cronogramaTimeRange]);


  const times = useMemo(() => {
    let startH = 10;
    let endH = 23;
    let endM = 45;

    if (timeRangeType === '24h') {
      startH = 0;
      endH = 23;
    } else {
      // service mode
      if (settings && settings.openingHours) {
        try {
          const dayHours = getEffectiveOpeningHours(selectedDate, settings);
          if (dayHours) {
            let earliestH = 24;
            let latestH = 0;
            let latestM = 0;

            if (dayHours.lunch && dayHours.lunch.open && dayHours.lunch.close) {
              earliestH = Math.min(earliestH, parseInt(dayHours.lunch.open.split(':')[0], 10));
              const lh = parseInt(dayHours.lunch.close.split(':')[0], 10);
              const lm = parseInt(dayHours.lunch.close.split(':')[1], 10);
              if (lh > latestH || (lh === latestH && lm > latestM)) {
                latestH = lh; latestM = lm;
              }
            }
            if (dayHours.dinner && dayHours.dinner.open && dayHours.dinner.close) {
              const dOpenH = parseInt(dayHours.dinner.open.split(':')[0], 10);
              earliestH = Math.min(earliestH, dOpenH);
              let dh = parseInt(dayHours.dinner.close.split(':')[0], 10);
              const dm = parseInt(dayHours.dinner.close.split(':')[1], 10);
              
              if (dh < dOpenH) {
                // closes after midnight
                dh = 23;
                latestM = 59;
              }
              
              if (dh > latestH || (dh === latestH && dm > latestM)) {
                latestH = dh; latestM = dm;
              }
            }

            if (earliestH < 24) {
              // Expand a bit before and after
              startH = Math.max(0, earliestH - 1);
              endH = Math.min(23, latestH + 1);
            }
          }
        } catch (e) {
          // ignore
        }
      }
    }

    const t = [];
    if (timeRangeType === '24h') {
      let currentStartH = 0;
      if (settings?.cronogramaStartTime) {
        currentStartH = parseInt(settings.cronogramaStartTime.split(':')[0], 10) || 0;
      }
      for (let step = 0; step < 96; step++) {
        const totalMins = currentStartH * 60 + step * 15;
        const h = Math.floor(totalMins / 60) % 24;
        const m = totalMins % 60;
        t.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
      }
    } else {
      for (let h = startH; h <= endH; h++) {
        for (let m = 0; m < 60; m += 15) {
          if (h === endH && m > endM && endH === 23) continue;
          t.push(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`);
        }
      }
    }
    return t;
  }, [timeRangeType, settings, selectedDate]);

  const timeToIndex = (timeStr: string) => {
    if (!timeStr) return -1;
    const parts = timeStr.split(':');
    if (parts.length < 2) return -1;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const roundedM = Math.floor(m / 15) * 15;
    const roundedTimeStr = `${h.toString().padStart(2, '0')}:${roundedM.toString().padStart(2, '0')}`;
    const idx = times.indexOf(roundedTimeStr);
    return idx >= 0 ? idx : -1;
  };

  const getReservationDurationMinutes = (res: Reservation) => {
    // Basic duration estimation, could be refined by settings
    const defaultDuration = settings?.minReservationGap || 120;
    return defaultDuration;
  };

  const getReservationSpan = (res: Reservation) => {
    const durationMins = getReservationDurationMinutes(res);
    return Math.max(1, Math.ceil(durationMins / 15));
  };

  // Group tables by area
  const tablesByArea = useMemo(() => {
    const grouped: { area: Area | undefined; tables: Table[] }[] = [];
    const areaMap = new Map(areas.map(a => [a.id, a]));
    
    // Create groups
    const areaGroups: Record<string, Table[]> = {};
    const noAreaTables: Table[] = [];

    tables.forEach(t => {
      if (t.areaId && areaMap.has(t.areaId)) {
        if (!areaGroups[t.areaId]) areaGroups[t.areaId] = [];
        areaGroups[t.areaId].push(t);
      } else {
        noAreaTables.push(t);
      }
    });

    areas.forEach(a => {
      if (areaGroups[a.id]) {
        // Sort tables inside area
        const sorted = [...areaGroups[a.id]].sort((t1, t2) => t1.name.localeCompare(t2.name));
        grouped.push({ area: a, tables: sorted });
      }
    });

    if (noAreaTables.length > 0) {
      grouped.push({ area: undefined, tables: noAreaTables.sort((a, b) => a.name.localeCompare(b.name)) });
    }

    return grouped;
  }, [tables, areas]);

  const handleDragStart = (e: React.DragEvent, resId: string, effectiveSpan: number = 1) => {
    e.dataTransfer.setData('text/plain', resId);
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => {
      setDraggedResId(resId);
    }, 0);
    
    if (e.currentTarget instanceof HTMLElement) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const slotWidth = rect.width / effectiveSpan;
      const offsetSlots = Math.max(0, Math.floor(clickX / slotWidth));
      setDragOffsetSlots(offsetSlots);
    } else {
      setDragOffsetSlots(0);
    }
        
    // Make dragged element slightly transparent
    setTimeout(() => {
      if (e.target instanceof HTMLElement) {
        e.target.style.opacity = '0.5';
      }
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedResId(null);
    if (e.target instanceof HTMLElement) {
      e.target.style.opacity = '1';
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, tableId: string, time: string) => {
    e.preventDefault();
    const resId = draggedResId || e.dataTransfer.getData('text/plain');
    if (!resId) return;

    const res = reservations.find(r => r.id === resId);
    if (!res) return;

    let adjustedTime = time;
    const dropIdx = times.indexOf(time);
    if (dropIdx !== -1) {
      let startIdx = dropIdx - dragOffsetSlots;
      if (startIdx < 0) startIdx = 0;
      const newBaseTime = times[startIdx] || time;
      
      const origParts = res.time.split(':');
      if (origParts.length === 2) {
        const origM = parseInt(origParts[1], 10);
        const remainder = origM % 15;
        if (remainder > 0) {
          const newParts = newBaseTime.split(':');
          let newH = parseInt(newParts[0], 10);
          let newM = parseInt(newParts[1], 10);
          let finalM = newM + remainder;
          let finalH = newH;
          if (finalM >= 60) {
             finalM -= 60;
             finalH += 1;
          }
          adjustedTime = `${finalH.toString().padStart(2, '0')}:${finalM.toString().padStart(2, '0')}`;
        } else {
          adjustedTime = newBaseTime;
        }
      } else {
        adjustedTime = newBaseTime;
      }
    }

    const targetTable = tables.find(t => t.id === tableId);
    if (!targetTable) return;

    if (res.tableId === tableId && res.time === adjustedTime) {
      return; // No change
    }

    // Check for conflicts
    const durationMins = getReservationDurationMinutes(res);
    const targetStartMins = getMins(adjustedTime);
    const targetEndMins = targetStartMins + durationMins;

    const tableReservations = reservations.filter(r => r.tableId === tableId && r.id !== res.id && !['cancelled', 'no-show', 'deleted'].includes(r.status));
    let hasConflict = false;
    for (const r of tableReservations) {
      const rStartMins = getMins(r.time);
      const rDuration = getReservationDurationMinutes(r);
      const rEndMins = rStartMins + rDuration;
      
      // Check for overlap
      if (
        (targetStartMins >= rStartMins && targetStartMins < rEndMins) ||
        (targetEndMins > rStartMins && targetEndMins <= rEndMins) ||
        (targetStartMins <= rStartMins && targetEndMins >= rEndMins)
      ) {
        hasConflict = true;
        break;
      }
    }

    setPendingDrop({
      resId,
      tableId,
      time: adjustedTime,
      targetTableName: targetTable.name,
      customerName: res.customerName,
      hasConflict
    });
  };

  const getAreaColor = (areaId?: string) => {
    if (!areaId) return currentTheme === 'dark' ? 'bg-[#31313c]' : 'bg-gray-100';
    
    const darkColors = [
      'bg-indigo-950', 'bg-emerald-950', 'bg-cyan-950', 
      'bg-rose-950', 'bg-amber-950', 'bg-purple-950', 'bg-fuchsia-950'
    ];
    const lightColors = [
      'bg-indigo-50', 'bg-emerald-50', 'bg-cyan-50', 
      'bg-rose-50', 'bg-amber-50', 'bg-purple-50', 'bg-fuchsia-50'
    ];
    
    const colors = currentTheme === 'dark' ? darkColors : lightColors;
    
    let hash = 0;
    for (let i = 0; i < areaId.length; i++) {
      hash = areaId.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  };

  const gridColsRight = `repeat(${times.length}, minmax(45px, 45px))`;
  const gridMinWidth = `${times.length * 16}px`;

  const getHourColor = (timeStr: string) => {
    const h = parseInt(timeStr.split(':')[0], 10);
    const m = parseInt(timeStr.split(':')[1], 10);
    const timeNum = h * 60 + m;

    let lunchStart = '12:00';
    let lunchEnd = '15:00';
    let dinnerStart = '19:00';
    let dinnerEnd = '23:00';

    if (settings && settings.openingHours) {
      try {
        const dayHours = getEffectiveOpeningHours(selectedDate, settings);
        if (dayHours) {
          if (dayHours.lunch && dayHours.lunch.open && dayHours.lunch.close) {
            lunchStart = dayHours.lunch.open;
            lunchEnd = dayHours.lunch.close;
          }
          if (dayHours.dinner && dayHours.dinner.open && dayHours.dinner.close) {
            dinnerStart = dayHours.dinner.open;
            dinnerEnd = dayHours.dinner.close;
          }
        }
      } catch (e) {
        // Fallback to defaults
      }
    }

    const ls = getMins(lunchStart);
    const le = getMins(lunchEnd);
    const ds = getMins(dinnerStart);
    const de = getMins(dinnerEnd);

    if (timeNum < ls || timeNum >= de) {
      // Not serving (light red)
      return currentTheme === 'dark' ? 'bg-red-950/20 border-red-900/30' : 'bg-red-50 border-red-100';
    } else if (timeNum >= le && timeNum < ds) {
      // Between lunch and dinner (light yellow)
      return currentTheme === 'dark' ? 'bg-yellow-950/20 border-yellow-900/30' : 'bg-yellow-50 border-yellow-100';
    } else {
      // Alternate hours grey tones
      const isEvenHour = h % 2 === 0;
      if (currentTheme === 'dark') {
        return isEvenHour ? 'bg-[#212128]' : 'bg-[#25252d]';
      } else {
        return isEvenHour ? 'bg-gray-100' : 'bg-gray-50';
      }
    }
  };

  const getAvailableSlots = (table: Table, tableReservations: Reservation[]) => {
    const blockedDates = table.blockedDates?.[selectedDate] || {};
    const isDefaultBlocked = blockedDates.default || table.isBlocked;
    const isLunchBlocked = blockedDates.lunch || isDefaultBlocked;
    const isDinnerBlocked = blockedDates.dinner || isDefaultBlocked;

    const isOccupied = new Array(times.length).fill(false);
    tableReservations.forEach(res => {
      const resStartMins = getMins(res.time);
      const resSpanMins = getReservationSpan(res) * 15;
      const resEndMins = resStartMins + resSpanMins;
      for (let i = 0; i < times.length; i++) {
        const tMins = getMins(times[i]);
        if (tMins >= resStartMins && tMins < resEndMins) {
          isOccupied[i] = true;
        }
      }
    });

    const dayHours = getEffectiveOpeningHours(selectedDate, settings as any);

    let lunchStart = -1, lunchEnd = -1, dinnerStart = -1, dinnerEnd = -1;
    if (dayHours?.lunch?.open && dayHours?.lunch?.close) {
      lunchStart = getMins(dayHours.lunch.open);
      lunchEnd = getMins(dayHours.lunch.close);
    }
    if (dayHours?.dinner?.open && dayHours?.dinner?.close) {
      dinnerStart = getMins(dayHours.dinner.open);
      let de = getMins(dayHours.dinner.close);
      if (de < dinnerStart) de += 24 * 60; // next day
      dinnerEnd = de;
    }

    const availableBlocks = [];
    let currentBlockStart = -1;

    let currentShift = null;
    for (let i = 0; i < times.length; i++) {
      const tMins = getMins(times[i]);
      const isLunchTime = (tMins >= lunchStart && tMins < lunchEnd);
      const isDinnerTime = (tMins >= dinnerStart && tMins < dinnerEnd);
      const isWithinShift = (isLunchTime && !isLunchBlocked) || (isDinnerTime && !isDinnerBlocked);
      
      if (isWithinShift && !isOccupied[i]) {
        if (currentBlockStart === -1) {
          currentBlockStart = i;
          currentShift = isLunchTime ? 'lunch' : 'dinner';
        }
      } else {
        if (currentBlockStart !== -1) {
          availableBlocks.push({ 
            start: currentBlockStart, 
            span: i - currentBlockStart,
            endsAtBooking: isWithinShift,
            shift: currentShift
          });
          currentBlockStart = -1;
        }
      }
    }
    if (currentBlockStart !== -1) {
      availableBlocks.push({ 
        start: currentBlockStart, 
        span: times.length - currentBlockStart,
        endsAtBooking: false,
        shift: currentShift
      });
    }

    const minSpan = Math.ceil((settings?.minReservationGap || 120) / 15);
    return availableBlocks.filter(block => !block.endsAtBooking || block.span >= minSpan);
  };

  const getBlockedSlots = (table: Table, tableReservations: Reservation[]) => {
    const getLocalMins = (t: string) => { if (!t) return 0; const parts = t.split(':'); return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10); };
    const isOccupied = new Array(times.length).fill(false);
    tableReservations.forEach(res => {
      const resStartMins = getLocalMins(res.time);
      const resSpanMins = getReservationSpan(res) * 15;
      const resEndMins = resStartMins + resSpanMins;
      for (let i = 0; i < times.length; i++) {
        const tMins = getLocalMins(times[i]);
        if (tMins >= resStartMins && tMins < resEndMins) {
          isOccupied[i] = true;
        }
      }
    });
    const blockedSlots = [];
    const blockedDates = table.blockedDates?.[selectedDate] || {};
    const isDefaultBlocked = blockedDates.default || table.isBlocked;
    const isLunchBlocked = blockedDates.lunch || isDefaultBlocked;
    const isDinnerBlocked = blockedDates.dinner || isDefaultBlocked;

    if (!isLunchBlocked && !isDinnerBlocked) return blockedSlots;

    const dayHours = getEffectiveOpeningHours(selectedDate, settings as any);

    let lunchStart = -1, lunchEnd = -1, dinnerStart = -1, dinnerEnd = -1;
    if (dayHours?.lunch?.open && dayHours?.lunch?.close) {
      lunchStart = getMins(dayHours.lunch.open);
      lunchEnd = getMins(dayHours.lunch.close);
    }
    if (dayHours?.dinner?.open && dayHours?.dinner?.close) {
      dinnerStart = getMins(dayHours.dinner.open);
      let de = getMins(dayHours.dinner.close);
      if (de < dinnerStart) de += 24 * 60;
      dinnerEnd = de;
    }

    const processShift = (startMins: number, endMins: number, label: string) => {
      let currentStartIdx = -1;
      for (let i = 0; i < times.length; i++) {
        const tMins = getMins(times[i]);
        if (tMins >= startMins && tMins < endMins && !isOccupied[i]) {
          if (currentStartIdx === -1) currentStartIdx = i;
        } else if (currentStartIdx !== -1) {
          blockedSlots.push({ start: currentStartIdx, span: i - currentStartIdx, label });
          currentStartIdx = -1;
        }
      }
      if (currentStartIdx !== -1) {
        blockedSlots.push({ start: currentStartIdx, span: times.length - currentStartIdx, label });
      }
    };

    if (isLunchBlocked && lunchStart !== -1) {
      processShift(lunchStart, lunchEnd, 'Lunch');
    }
    if (isDinnerBlocked && dinnerStart !== -1) {
      processShift(dinnerStart, dinnerEnd, 'Dinner');
    }

    return blockedSlots;
  };

  const toggleTableBlock = (e: React.MouseEvent, table: Table, session: 'lunch' | 'dinner') => {
    e.stopPropagation();
    if (!updateTable) return;
    
    const currentBlockedDates = table.blockedDates || {};
    const dateRecord = currentBlockedDates[selectedDate] || {};
    
    const isCurrentlyBlocked = dateRecord[session] || dateRecord.default || table.isBlocked;
    
    const newDateRecord = {
      ...dateRecord,
      [session]: !isCurrentlyBlocked
    };
    
    const newBlockedDates = {
      ...currentBlockedDates,
      [selectedDate]: newDateRecord
    };
    
    updateTable(table.id, { blockedDates: newBlockedDates });
  };

  const content = (
    <div className={cn(
      "w-full flex flex-col rounded-xl border relative z-10",
      currentTheme === 'dark' ? "bg-[#1e1e24] border-gray-800 text-white" : "bg-white border-gray-200 text-gray-900",
      isFullscreen ? "h-full border-none rounded-none" : "h-[80vh] min-h-[600px] mt-4"
    )}>
      {/* Header Bar */}
      <div className={cn(
        "flex items-center justify-between p-2 border-b shrink-0 relative z-[90]",
        currentTheme === 'dark' ? "bg-[#25252d] border-gray-700" : "bg-gray-50 border-gray-200"
      )}>
        <div className="flex items-center gap-3">
          {isFullscreen && (settings?.logoUrl || settings?.cloudinaryLogoUrl) && (
            <div className="bg-white p-[10px] rounded-lg ml-2 flex items-center justify-center shadow-sm">
              <img 
                src={getOptimizedUrl(settings?.logoUrl, settings, 'logo')} 
                alt="Logo"
                style={{ height: `${settings?.logoSize || 32}px` }}
                className="object-contain"
              />
            </div>
          )}
          {isFullscreen && (
            <h3 className={cn(
              "text-xl md:text-2xl font-extrabold flex items-center gap-2",
              currentTheme === 'dark' ? "text-white" : "text-gray-900"
            )}>
              <Clock className="text-amber-600" size={24} />
              <span>Real-time floor cronograma</span>
            </h3>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-4">
          {isFullscreen && (
            <div className={cn(
              "flex items-center gap-2 p-1.5 rounded-2xl shadow-sm border",
              currentTheme === 'dark' ? "bg-[#1e1e24] border-gray-700" : "bg-white border-gray-200"
            )}>
              <button type="button" 
                onClick={() => {
                  const d = parseISO(selectedDate);
                  onDateChange(format(subHours(d, 24), 'yyyy-MM-dd'));
                }}
                className={cn(
                  "p-2 rounded-xl transition-colors",
                  currentTheme === 'dark' ? "hover:bg-gray-800 text-gray-400 hover:text-white0" : "hover:bg-gray-100 text-gray-500 hover:text-amber-600"
                )}
              >
                <ChevronLeft size={20} />
              </button>
              <div className="relative flex items-center justify-center min-w-[140px] group cursor-pointer">
                <div className={cn(
                  "flex items-center gap-2 px-4 font-bold justify-center transition-colors pointer-events-none",
                  currentTheme === 'dark' ? "text-gray-300 group-hover:text-amber-500" : "text-gray-700 group-hover:text-amber-600"
                )}>
                  <CalendarIcon size={18} className="text-amber-600" />
                  <span>{isToday(parseISO(selectedDate)) ? (language === 'pt' ? 'Hoje' : 'Today') : format(parseISO(selectedDate), 'dd/MM/yyyy')}</span>
                </div>
                <input 
                  type="date"
                        min={new Date().getFullYear() < 2026 ? '2026-01-01' : format(new Date(), 'yyyy-MM-dd')}
                        lang={language === "pt" ? "pt-PT" : "en-US"} 
                  value={selectedDate}
                  onChange={(e) => onDateChange(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:opacity-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer"
                />
              </div>
              <button type="button"
                onClick={() => onDateChange(format(new Date(), 'yyyy-MM-dd'))}
                title={language === 'pt' ? 'Ir para Hoje' : 'Go to Today'}
                className={cn(
                  "p-1.5 rounded-xl transition-colors text-amber-500 hover:text-amber-600",
                  currentTheme === 'dark' ? "hover:bg-gray-800" : "hover:bg-gray-100"
                )}
              >
                <RefreshCw size={14} />
              </button>
              <button type="button" 
                onClick={() => {
                  const d = parseISO(selectedDate);
                  onDateChange(format(addHours(d, 24), 'yyyy-MM-dd'));
                }}
                className={cn(
                  "p-2 rounded-xl transition-colors",
                  currentTheme === 'dark' ? "hover:bg-gray-800 text-gray-400 hover:text-amber-500" : "hover:bg-gray-100 text-gray-500 hover:text-amber-600"
                )}
              >
                <ChevronRight size={20} />
              </button>
            </div>
          )}

          {isFullscreen && (
            <div className="relative flex items-center">
              <Search size={14} className={cn("absolute left-2.5", currentTheme === 'dark' ? "text-gray-400" : "text-gray-500")} />
              <input 
                type="text"
                placeholder={language === 'pt' ? 'Pesquisar...' : 'Search...'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "pl-8 pr-8 py-1.5 text-xs rounded-lg border w-32 focus:w-40 transition-all duration-300 outline-none",
                  currentTheme === 'dark'
                    ? "bg-gray-800 border-gray-700 text-white placeholder-gray-500 focus:border-amber-500"
                    : "bg-white border-gray-200 text-gray-900 placeholder-gray-400 focus:border-amber-500"
                )}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className={cn(
                    "absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors",
                    currentTheme === 'dark' ? "text-gray-400 hover:text-gray-200" : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}
          {isFullscreen && hasNewBookings && (
            <div className="relative group/nav">
              <button
                onClick={() => {
                  setIsFullscreen(false);
                  navigate('/admin/reservations');
                }}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-sm border",
                  currentTheme === 'dark'
                    ? "bg-amber-950/50 text-amber-400 border border-amber-900/30 hover:bg-amber-900/20"
                    : "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100/50"
                )}
              >
                <Sparkles size={14} className="text-white0 animate-pulse" />
                <span className="hidden sm:inline">{language === 'pt' ? 'Novas Reservas' : 'New Bookings'}</span>
                <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse ml-1" />
              </button>

              <div className={cn(
                "absolute right-0 top-full mt-1 w-80 rounded-xl shadow-xl border p-3 z-[100] pointer-events-none group-hover/nav:pointer-events-auto opacity-0 group-hover/nav:opacity-100 translate-y-2 group-hover/nav:translate-y-0 transition-all duration-200 space-y-2.5 text-left",
                currentTheme === 'dark'
                  ? "bg-gray-900 border-gray-800 text-white"
                  : "bg-white border-gray-100 text-gray-900"
              )}>
                <div className="flex items-center justify-between border-b pb-2 mb-1.5 border-gray-200 dark:border-gray-800">
                  <span className="text-xs font-bold flex items-center gap-1.5">
                    <Sparkles size={13} className="text-white0 animate-spin" style={{ animationDuration: '3s' }} />
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
                        setIsFullscreen(false);
                        navigate(`/admin/reservations?date=${booking.date}&search=${encodeURIComponent(booking.customerName)}`);
                      }}
                      className={cn(
                        "p-2.5 rounded-lg border flex items-center justify-between transition-all hover:border-amber-500/40 cursor-pointer text-left",
                        currentTheme === 'dark'
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
                            <CalendarIcon size={10} className="text-white0" />
                            {format(parseISO(booking.date), 'dd/MM/yyyy')} @ {booking.time}
                          </span>
                          <span className="w-0.5 h-0.5 rounded-full bg-gray-300 dark:bg-gray-600" />
                          <span className="flex items-center gap-0.5">
                            <User size={10} className="text-blue-500" />
                            {booking.guests}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            removeNotificationBooking(booking.id);
                            setIsFullscreen(false);
                            navigate(`/admin/reservations?date=${booking.date}&search=${encodeURIComponent(booking.customerName)}`);
                          }}
                          className="p-1 bg-amber-500/10 text-white0 hover:bg-amber-500 hover:text-white rounded transition-colors cursor-pointer"
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
          {isFullscreen && (
            <button
              type="button"
              onClick={() => {
                takeScreenshot('cronograma-fullscreen-view', settings?.name ? `${settings.name}-Cronograma.png` : 'Cronograma.png');
              }}
              className={cn(
                "p-1.5 flex items-center justify-center text-xs font-bold rounded-lg transition-colors shadow-sm border no-print cursor-pointer",
                currentTheme === 'dark' 
                   ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300" 
                   : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
              title={language === 'pt' ? 'Captura de Ecrã' : 'Screenshot'}
            >
              <Camera size={16} />
            </button>
          )}
          {isFullscreen && (
            <button
              onClick={() => setLocalTheme(prev => prev === 'dark' ? 'light' : 'dark')}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm border",
                currentTheme === 'dark' 
                  ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-yellow-400" 
                  : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
              )}
              title={currentTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {currentTheme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              
            </button>
          )}

          <button
            onClick={() => setShowAvailableSlots(!showAvailableSlots)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm border",
              showAvailableSlots
                ? (currentTheme === 'dark' ? "bg-emerald-900/40 text-emerald-500 border-emerald-900/50 hover:bg-emerald-900/50" : "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100")
                : (currentTheme === 'dark' ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-400" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50")
            )}
            title={showAvailableSlots ? (language === 'pt' ? 'Ocultar espaços livres' : 'Hide available slots') : (language === 'pt' ? 'Mostrar espaços livres' : 'Show available slots')}
          >
            {showAvailableSlots ? <EyeOff size={16} /> : <Eye size={16} />}
            <span className="hidden sm:inline">{language === 'pt' ? 'Disponibilidade' : 'Availability'}</span>
          </button>

          {isFullscreen && (
            <div className="relative group/zoom flex items-center">
              <button
                type="button"
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm border cursor-pointer",
                  currentTheme === 'dark' ? "bg-gray-800 text-gray-200 border-gray-700 hover:bg-gray-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                )}
                title="Zoom"
              >
                <Search size={14} />
                <span>{zoomLevel}%</span>
              </button>
              <div className={cn(
                "absolute right-0 top-full mt-1 flex flex-col rounded-lg shadow-xl border overflow-hidden z-[100] opacity-0 pointer-events-none group-hover/zoom:opacity-100 group-hover/zoom:pointer-events-auto transition-all duration-200 min-w-[80px]",
                currentTheme === 'dark' ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              )}>
                {[100, 90, 80].map((level) => (
                  <button
                    key={level}
                    onClick={() => setZoomLevel(level as any)}
                    className={cn(
                      "px-4 py-2 text-xs font-bold text-left hover:bg-gray-100 transition-colors whitespace-nowrap",
                      currentTheme === 'dark' ? "hover:bg-gray-700 text-gray-200" : "text-gray-700 hover:bg-gray-50",
                      zoomLevel === level ? (currentTheme === 'dark' ? "bg-gray-700 text-amber-400" : "bg-gray-100 text-amber-600") : ""
                    )}
                  >
                    {level}%
                  </button>
                ))}
              </div>
            </div>
          )}
          {isFullscreen && (
            <select
              value={timeRangeType}
              onChange={(e) => setTimeRangeType(e.target.value as any)}
              className={cn(
                "px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm border appearance-none cursor-pointer",
                currentTheme === 'dark' ? "bg-gray-800 text-gray-200 border-gray-700" : "bg-white text-gray-700 border-gray-200"
              )}
            >
              <option value="service">{language === 'pt' ? 'Serviço' : 'Service'}</option>
              <option value="24h">24h</option>
            </select>
          )}
          <button
            onClick={() => { if (isFullscreen) {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
              setIsFullscreen(!isFullscreen);
            }}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm",
              currentTheme === 'dark' ? "bg-gray-800 text-gray-200 hover:bg-gray-700" : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-50"
            )}
            title={isFullscreen ? (language === 'pt' ? 'Reduzir' : 'Minimize Window') : (language === 'pt' ? 'Aumentar' : 'Increase Window')}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          </div>
        </div>
      </div>

      <div 
        ref={scrollContainerRef}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        className={cn("w-full flex-grow overflow-auto custom-scrollbar pb-[50px]", isFullscreen ? "no-scrollbar" : "", isDraggingScroll ? "cursor-grabbing" : "")}
      >
        <div className="min-w-[max-content] relative" style={isFullscreen ? { zoom: zoomLevel / 100, WebkitZoom: zoomLevel / 100 } as any : undefined}>
          {/* Header - Times */}

          <div 
            className={cn("sticky top-0 z-[70] flex border-b w-full min-w-max", currentTheme === 'dark' ? "bg-[#25252d] border-gray-700" : "bg-gray-50 border-gray-200")} 
          >
          <div className={cn("w-[178px] flex-shrink-0 p-3 font-bold border-r sticky left-0 z-[80] bg-inherit flex items-center justify-center gap-2", currentTheme === 'dark' ? "border-gray-700 text-gray-200" : "border-gray-200 text-gray-700")}><Clock size={16} className="text-white0" /><span>{language === 'pt' ? 'Horário' : 'Schedule'}</span></div>
          {(() => {
            const date = new Date();
            const nowMins = date.getHours() * 60 + date.getMinutes();
            const firstTimeMins = times.length > 0 ? getMins(times[0]) : 0;
            const totalGridMins = times.length * 15;
            if (isToday(parseISO(selectedDate)) && nowMins >= firstTimeMins && nowMins <= firstTimeMins + totalGridMins) {
              const fraction = (nowMins - firstTimeMins) / totalGridMins;
              return (
                <div 
                  className="absolute top-0 h-[50px] w-0.5 bg-yellow-400 z-[55] pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                  style={{ left: `calc(178px + (100% - 178px) * ${fraction})` }}
                >
                  <div className="absolute top-[20px] -left-1.5 w-3.5 h-3.5 bg-yellow-400 rounded-full shadow-md" />
                </div>
              );
            }
            return null;
          })()}

          <div className="flex-grow grid" style={{ gridTemplateColumns: gridColsRight }}>
          {times.map((t, i) => (
            <div 
              key={t} 
              className={cn("relative min-w-[15px] border-r", currentTheme === 'dark' ? "text-gray-400 border-gray-700" : "text-gray-500 border-gray-200", getHourColor(t))}
              style={{ height: '50px' }}
            >
              <div className={cn("absolute top-1/2 -translate-y-1/2 text-[11px] font-bold z-10 whitespace-nowrap px-0.5 rounded bg-inherit", i === 0 ? "left-1" : "left-0 -translate-x-1/2")}>
                {formatDisplayTime(t, settings)}
              </div>
            </div>
          ))}
          </div>
        </div>

        {/* Body - Areas and Tables */}
        <AnimatePresence initial={false}>
        {tablesByArea.filter(g => !filteredAreaId || (g.area && g.area.id === filteredAreaId)).map((group, groupIndex) => {
          const override = group.area?.dateOverrides?.[selectedDate];
          const effectiveBookingMode = override?.bookingMode !== undefined ? override.bookingMode : group.area?.bookingMode;
          const effectiveClosedSessions = override?.closedSessions !== undefined ? override.closedSessions : (group.area?.closedSessions || ['lunch', 'dinner']);

          let isGroupAreaClosed = false;
          let isLunchClosed = false;
          let isDinnerClosed = false;

          if (group.area) {
            if (effectiveBookingMode === 'permanently_closed') {
              isGroupAreaClosed = true;
              isLunchClosed = true;
              isDinnerClosed = true;
            } else if (effectiveBookingMode === 'closed') {
              // if override is active, we just check closedSessions
              // if it's the base area, we check dates
              if (override && override.bookingMode === 'closed') {
                isGroupAreaClosed = true;
                isLunchClosed = effectiveClosedSessions.includes('lunch');
                isDinnerClosed = effectiveClosedSessions.includes('dinner');
              } else {
                const isWithinDates = (!group.area.closedStartDate || selectedDate >= group.area.closedStartDate) && 
                                      (!group.area.closedEndDate || selectedDate <= group.area.closedEndDate);
                if (isWithinDates) {
                  isGroupAreaClosed = true;
                  isLunchClosed = effectiveClosedSessions.includes('lunch');
                  isDinnerClosed = effectiveClosedSessions.includes('dinner');
                }
              }
            }
          }

          let lunchStyle = null;
          let dinnerStyle = null;
          if (isGroupAreaClosed) {
            let lStart = '12:00', lEnd = '15:00', dStart = '19:00', dEnd = '23:00';
            try {
              const dayHours = getEffectiveOpeningHours(selectedDate, settings as any);
              if (dayHours) {
                if (dayHours.lunch?.open && dayHours.lunch?.close) { lStart = dayHours.lunch.open; lEnd = dayHours.lunch.close; }
                if (dayHours.dinner?.open && dayHours.dinner?.close) { dStart = dayHours.dinner.open; dEnd = dayHours.dinner.close; }
              }
            } catch(e){}
            const lsMins = getMins(lStart); const leMins = getMins(lEnd);
            const dsMins = getMins(dStart); const deMins = getMins(dEnd);
            const fTimeMins = times.length > 0 ? getMins(times[0]) : 0;
            const tGridMins = times.length * 15;
            
            const getBoxStyle = (start, end) => {
              const aStart = Math.max(fTimeMins, start);
              const aEnd = Math.min(fTimeMins + tGridMins, end);
              if (aEnd <= aStart) return null;
              return {
                left: `calc(178px + (100% - 178px) * ${(aStart - fTimeMins) / tGridMins})`,
                width: `calc((100% - 178px) * ${(aEnd - aStart) / tGridMins})`
              };
            };
            if (isLunchClosed) lunchStyle = getBoxStyle(lsMins, leMins);
            if (isDinnerClosed) dinnerStyle = getBoxStyle(dsMins, deMins);
          }
          return (
          <motion.div 
            key={group.area?.id || 'no-area'} 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="relative flex flex-col w-full min-w-max ">
{(() => {
            const date = new Date();
            const nowMins = date.getHours() * 60 + date.getMinutes();
            const firstTimeMins = times.length > 0 ? getMins(times[0]) : 0;
            const totalGridMins = times.length * 15;
            
            if (isToday(parseISO(selectedDate)) && nowMins >= firstTimeMins && nowMins <= firstTimeMins + totalGridMins) {
              const fraction = (nowMins - firstTimeMins) / totalGridMins;
              return (
                <div 
                  className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 z-[55] pointer-events-none shadow-[0_0_8px_rgba(250,204,21,0.8)]"
                  style={{ left: `calc(178px + (100% - 178px) * ${fraction})` }}
                >
                  
                </div>
              );
            }
            return null;
          })()}
            {/* Area Header */}
            {group.area && (
              
              <div className="flex w-full">
                <div 
                  className={cn("sticky left-0 font-bold z-[60] flex items-stretch justify-between text-white flex-shrink-0 opacity-90", getAreaColor(group.area.id))} 
                  style={{ width: '178px', backgroundColor: group.area.color }}
                >
                  <span className="truncate pl-3 pr-1 py-2 text-sm bg-gray-700/50 text-white flex-1 flex items-center w-full">{group.area.name}</span>
                  <div className="bg-gray-700/50 pr-4 flex items-center justify-center">
                    <button 
                      onClick={() => { setFilteredAreaId(filteredAreaId === group.area.id ? null : group.area.id); if (filteredAreaId !== group.area.id) setIsFullscreen(true); }}
                      className="p-1.5 rounded-[8px] transition-colors text-white hover:bg-gray-600/80"
                      title={filteredAreaId === group.area.id ? (language === 'pt' ? 'Mostrar todas as áreas' : 'Show all areas') : (language === 'pt' ? 'Filtrar por esta área' : 'Filter by this area')}
                    >
                      {filteredAreaId === group.area.id ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>
                <div className={cn("flex-grow opacity-50", getAreaColor(group.area.id))} style={{ backgroundColor: group.area.color }}></div>
              </div>
            )}
            
            {/* Tables Rows */}
            {group.tables.map(table => {
              // Find reservations for this table on this date (already filtered by selectedDate from parent)
              const tableReservations = reservations.filter(r => r.tableId === table.id && !['cancelled', 'no-show', 'deleted'].includes(r.status));
              
              return (
                <div 
                  key={table.id}
                  className={cn("flex border-b relative group h-[50px] w-full min-w-max ", currentTheme === 'dark' ? "border-gray-600 hover:bg-[#25252d]" : "border-gray-300 hover:bg-gray-50")}
                >
                  {/* Table Info Column */}
                  <div 
                    onClick={() => onTableClick && onTableClick(table.id)}
                    className={cn("w-[178px] flex-shrink-0 p-3 border-r flex items-center justify-between sticky left-0 z-[60] cursor-pointer transition-colors", currentTheme === 'dark' ? "bg-[#25252d] border-gray-700 hover:bg-gray-800" : "bg-gray-50 border-gray-200 hover:bg-gray-100")}
                  >
                    {(() => {
                      const dj = table.dailyJoins?.[selectedDate];
                      const isParent = dj && (dj.lunch?.joinedTables?.length > 0 || dj.dinner?.joinedTables?.length > 0);
                      const isChild = tables.some(t => {
                        const tdj = t.dailyJoins?.[selectedDate];
                        return tdj && (tdj.lunch?.joinedTables?.includes(table.id) || tdj.dinner?.joinedTables?.includes(table.id));
                      });
                      const isLinked = isParent || isChild;
                      if (isLinked) {
                        return <div className="absolute left-0 top-0 bottom-0 border-l-2 border-dashed border-blue-500 z-10" title={language === 'pt' ? 'Mesa associada/unida' : 'Joined/linked table'} />;
                      }
                      return null;
                    })()}
                    <div className="flex flex-row items-center gap-1.5 flex-1 h-full py-[2px]">
                      <span className="font-medium text-[13px] px-[2px] py-2 rounded text-white bg-green-500 shadow-sm truncate w-full h-full flex items-center justify-center">{cleanTableName(table.name)}</span>
                      <div className="flex items-center gap-1">
                        {(() => {
                          const blockedDates = table.blockedDates?.[selectedDate] || {};
                          const isDefaultBlocked = blockedDates.default || table.isBlocked;
                          const isLunchBlocked = blockedDates.lunch || isDefaultBlocked;
                          const isDinnerBlocked = blockedDates.dinner || isDefaultBlocked;
                          return (
                            <>
                              <div className={cn("flex items-center justify-center rounded px-[5px] py-[5px] mr-[3px]", currentTheme === 'dark' ? "bg-gray-600" : "bg-gray-300")} title={language === 'pt' ? 'Bloquear mesa por turno' : 'Block table by shift'}>
                                <Table2 size={10} className={cn("mr-1", currentTheme === 'dark' ? "text-white/80" : "text-gray-800")} />
                                <button 
                                  onClick={(e) => toggleTableBlock(e, table, 'lunch')}
                                  className={cn("px-[6px] py-[3px] mr-0.5 text-[9px] rounded font-bold uppercase transition-colors", isLunchBlocked ? "bg-red-500 text-white" : (currentTheme === 'dark' ? "bg-white/20 text-white/80 hover:bg-white/40" : "bg-gray-500/20 text-gray-800 hover:bg-gray-500/40"))}
                                  title={language === 'pt' ? (isLunchBlocked ? 'Desbloquear Almoço' : 'Bloquear Almoço') : (isLunchBlocked ? 'Unblock Lunch' : 'Block Lunch')}
                                >
                                  {language === 'pt' ? 'A' : 'L'}
                                </button>
                                <button 
                                  onClick={(e) => toggleTableBlock(e, table, 'dinner')}
                                  className={cn("px-[6px] py-[3px] text-[9px] rounded font-bold uppercase transition-colors", isDinnerBlocked ? "bg-red-500 text-white" : (currentTheme === 'dark' ? "bg-white/20 text-white/80 hover:bg-white/40" : "bg-gray-500/20 text-gray-800 hover:bg-gray-500/40"))}
                                  title={language === 'pt' ? (isDinnerBlocked ? 'Desbloquear Jantar' : 'Bloquear Jantar') : (isDinnerBlocked ? 'Unblock Dinner' : 'Block Dinner')}
                                >
                                  {language === 'pt' ? 'J' : 'D'}
                                </button>
                              </div>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn("text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-sm", currentTheme === 'dark' ? "bg-gray-800 text-gray-300" : "bg-white text-gray-600")}>
                        {table.seats}
                      </span>
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm" style={{ backgroundColor: group.area?.color || '#ccc' }} title={group.area?.name} />
                    </div>
                  </div>
                  <div className="flex-grow grid relative" style={{ gridTemplateColumns: gridColsRight }}>
                  {/* Time Slots (Drop targets) */}
                  {times.map((time, i) => (
                    <div 
                      key={time}
                      className={cn("border-r transition-colors", currentTheme === 'dark' ? "border-gray-700/50" : "border-gray-200", getHourColor(time))}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, table.id, time)}
                      style={{ gridRow: 1, gridColumn: i + 1 }}
                    />
                  ))}

                  {/* Blocked Slots (Fully Booked) */}
                  {getBlockedSlots(table, tableReservations).map((block, idx) => (
                    <div
                      key={`blocked-${idx}`}
                      onClick={(e) => toggleTableBlock(e, table, block.label.toLowerCase() as 'lunch' | 'dinner')}
                      className={cn(
                        "m-1 rounded-md border-2 border-dashed flex items-center justify-center cursor-pointer z-10 transition-colors group/block",
                        currentTheme === 'dark' ? "bg-red-900/30 border-red-700 text-red-400 hover:bg-red-900/50" : "bg-red-50 border-red-400 text-red-600 hover:bg-red-100"
                      )}
                      style={{
                        gridRow: 1,
                        gridColumn: `${block.start + 1} / span ${block.span}`,
                      }}
                      title={language === 'pt' ? 'Clique para desbloquear' : 'Click to unblock'}
                    >
                      <span className="text-[10px] font-bold tracking-wider opacity-80 group-hover:hidden flex items-center gap-1">
                        {block.label === 'Lunch' ? <Sun size={12} /> : <Moon size={12} />}
                        {language === 'pt' ? 'OCUPADO' : 'OCCUPIED'}
                      </span>
                      <span className="text-[10px] font-bold tracking-wider hidden group-hover:flex items-center gap-1">
                        <X size={14} /> {language === 'pt' ? 'DESBLOQUEAR' : 'UNBLOCK'}
                      </span>
                    </div>
                  ))}

                  {/* Available Slots */}
                  {showAvailableSlots && getAvailableSlots(table, tableReservations).map((block, idx) => (
                    <div
                      key={`available-${idx}`}
                      onClick={(e) => block.shift && toggleTableBlock(e, table, block.shift as 'lunch' | 'dinner')}
                      className={cn(
                        "m-1 rounded-md border border-dashed flex items-center justify-center opacity-40 hover:opacity-100 cursor-pointer z-10 transition-colors group/avail min-w-0 overflow-hidden",
                        currentTheme === 'dark' ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/50 hover:border-emerald-600" : "bg-emerald-50 border-emerald-300 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-400"
                      )}
                      style={{
                        gridRow: 1,
                        gridColumn: `${block.start + 1} / span ${block.span}`,
                      }}
                      title={language === 'pt' ? 'Clique para bloquear (Ocupado)' : 'Click to block (Occupied)'}
                    >
                      <span className="text-[10px] font-bold tracking-wider group-hover:hidden">{language === 'pt' ? 'LIVRE' : 'FREE'}</span>
                      <span className="text-[10px] font-bold tracking-wider hidden group-hover:flex items-center gap-1">
                        <X size={12} /> {language === 'pt' ? 'BLOQUEAR' : 'BLOCK'}
                      </span>
                    </div>
                  ))}

                  {/* Reservations */}
                  {tableReservations.map(res => {
                    const startIdx = timeToIndex(res.time);
                    if (startIdx === -1) return null; // Outside display range
                    
                    const span = getReservationSpan(res);
                    // Ensure it doesn't overflow the grid
                    const effectiveSpan = Math.min(span, times.length - startIdx);
                    
                    const isSearchMatch = searchQuery && (
                      (res.customerName && res.customerName.toLowerCase().includes(searchQuery.toLowerCase())) ||
                      (res.customerPhone && res.customerPhone.toLowerCase().includes(searchQuery.toLowerCase())) ||
                      (res.id && res.id.toLowerCase().includes(searchQuery.toLowerCase()))
                    );
                    
                    return (
                      <div
                        key={res.id}
                        id={`crono-res-${res.id}`}
                        draggable={true}
                        onClick={() => onReservationClick(res.id)}
                        onDragStart={(e) => handleDragStart(e, res.id, effectiveSpan)}
                        onDragEnd={handleDragEnd}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, table.id, res.time)}
                        className={cn(
                          "m-1 rounded-md shadow-sm border p-1 px-2 cursor-grab active:cursor-grabbing flex flex-col justify-center relative transition-colors group/res min-w-0",
                          "z-20 hover:z-[9999]",
                          isSearchMatch ? "bg-yellow-100 border-yellow-400 text-yellow-900 shadow-[0_0_8px_rgba(250,204,21,0.5)]" : 
                          (currentTheme === 'dark' ? "bg-gray-700/90 border-gray-500 text-white hover:bg-gray-600" : "bg-white border-gray-400 text-gray-900 hover:bg-gray-50"),
                          !!draggedResId ? "pointer-events-none" : "",
                          draggedResId === res.id ? "opacity-0" : ""
                        )}
                        style={{
                          gridRow: 1,
                          gridColumn: `${startIdx + 1} / span ${effectiveSpan}`,
                        }}
                      >
                        
                        <div className="flex items-center justify-between gap-[10px] w-full text-xs">
                          <div className="flex items-center gap-1 flex-grow min-w-0">
                            <span className="font-bold truncate">{res.customerName}</span>
                            {res.notes && (
                              <div className="relative group/note flex-shrink-0 cursor-help">
                                <FileText size={12} className={currentTheme === 'dark' ? 'text-amber-400' : 'text-amber-600'} />
                                <div className={cn(
                                  "absolute top-full mt-1 left-0 -translate-x-1/4 p-2 w-max max-w-[200px] rounded-lg shadow-xl border text-xs whitespace-normal z-[9999]",
                                  "hidden group-hover/note:block pointer-events-none",
                                  currentTheme === 'dark' ? "bg-gray-800 border-gray-700 text-gray-200" : "bg-white border-gray-200 text-gray-700"
                                )}>
                                  <div className="font-bold mb-0.5">{language === 'pt' ? 'Nota:' : 'Note:'}</div>
                                  <div>{res.notes}</div>
                                </div>
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
                                  <span className="px-1.5 bg-amber-100 text-amber-800 text-[9px] font-bold uppercase rounded border border-amber-200 flex-shrink-0">
                                    REG
                                  </span>
                                )}
                              </>
                            );
                          })()}
                          <span className={cn(
                            "px-1.5 text-[9px] font-bold uppercase rounded border flex-shrink-0",
                            res.status === 'arrived' ? "bg-green-100 text-green-700 border-green-200" :
                            res.status === 'completed' ? "bg-yellow-100 text-yellow-800 border-yellow-200" :
                            res.status === 'cancelled' ? "bg-red-100 text-red-700 border-red-200" :
                            res.status === 'no-show' ? "bg-gray-100 text-gray-700 border-gray-200" :
                            res.status === 'confirmed' ? "bg-green-50 text-green-600 border-green-100" :
                            res.status === 'delayed' ? "bg-orange-100 text-orange-700 border-orange-200" :
                            res.status === 'booked' ? "bg-blue-100 text-blue-700 border-blue-200" :
                            res.status === 'pending' ? "bg-amber-50 text-amber-600 border-amber-100" :
                            "bg-gray-50 text-gray-500 border-gray-200"
                          )}>
                            {res.status === 'arrived' ? (language === 'pt' ? 'Chegou' : 'Arrived') :
                             res.status === 'completed' ? (language === 'pt' ? 'Concluído' : 'Completed') :
                             res.status === 'cancelled' ? (language === 'pt' ? 'Cancelado' : 'Cancelled') :
                             res.status === 'no-show' ? 'Falta' :
                             res.status === 'confirmed' ? (language === 'pt' ? 'Confirmada' : 'Confirmed') :
                             res.status === 'delayed' ? (language === 'pt' ? 'Atraso' : 'Delayed') :
                             res.status === 'booked' ? (language === 'pt' ? 'Reservado' : 'Booked') :
                             res.status === 'pending' ? (language === 'pt' ? 'Pendente' : 'Pending') :
                             (res.status).toUpperCase()}
                          </span>
                        
                          </div>
                          <span className="flex items-center gap-0.5 text-gray-300 flex-shrink-0">
                            <User size={10} /> {res.guests}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                </div>
              );
            })}
            
            {/* Closed Area Overlay */}
            {isGroupAreaClosed && lunchStyle && (
              <div className="absolute top-0 bottom-0 z-[50] pointer-events-none flex items-center overflow-hidden justify-center select-none" style={lunchStyle} >
                <div className={cn("absolute inset-0 border-[3px] border-dashed border-red-500/80 m-1 rounded-lg pointer-events-none backdrop-blur-[2px]", currentTheme === 'dark' ? "bg-red-950/40" : "bg-red-50/70")} />
                <div className="bg-red-500 text-white font-black text-lg md:text-xl tracking-widest uppercase px-4 py-1.5 rounded shadow-xl rotate-[-12deg] opacity-90 backdrop-blur-sm z-[51]">
                  {language === 'pt' ? 'Fechado (Almoço)' : 'Closed (Lunch)'}
                </div>
              </div>
            )}
            {isGroupAreaClosed && dinnerStyle && (
              <div className="absolute top-0 bottom-0 z-[50] pointer-events-none flex items-center overflow-hidden justify-center select-none" style={dinnerStyle} >
                <div className={cn("absolute inset-0 border-[3px] border-dashed border-red-500/80 m-1 rounded-lg pointer-events-none backdrop-blur-[2px]", currentTheme === 'dark' ? "bg-red-950/40" : "bg-red-50/70")} />
                <div className="bg-red-500 text-white font-black text-lg md:text-xl tracking-widest uppercase px-4 py-1.5 rounded shadow-xl rotate-[-12deg] opacity-90 backdrop-blur-sm z-[51]">
                  {language === 'pt' ? 'Fechado (Jantar)' : 'Closed (Dinner)'}
                </div>
              </div>
            )}
            
          </motion.div>
        )})}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );

  
  const pendingDropModal = pendingDrop && (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
      <div className={cn("rounded-2xl p-6 max-w-sm w-full shadow-2xl relative", currentTheme === 'dark' ? "bg-gray-900 text-white" : "bg-white text-gray-900")}>
        <h3 className="text-xl font-bold mb-4">{language === 'pt' ? 'Confirmar Alteração' : 'Confirm Change'}</h3>
        {pendingDrop.hasConflict && (
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4 border border-red-200 font-medium">
            {language === 'pt' 
              ? `Atenção: Já existe uma reserva na mesa ${pendingDrop.targetTableName} neste horário. Deseja sobrepor a reserva?`
              : `Warning: There is already a reservation on table ${pendingDrop.targetTableName} at this time. Do you want to overlap?`}
          </div>
        )}
        <p className="mb-6 leading-relaxed">
          {language === 'pt' ? (
            <>Tem certeza que deseja mover a reserva de <span className="text-blue-600 font-bold">{pendingDrop.customerName}</span> para a mesa <span className="bg-green-500 text-white font-bold px-2 py-0.5 rounded">{pendingDrop.targetTableName}</span> às <span className="text-blue-600 font-bold">{pendingDrop.time}</span>?</>
          ) : (
            <>Are you sure you want to move <span className="text-blue-600 font-bold">{pendingDrop.customerName}</span>'s reservation to <span className="bg-green-500 text-white font-bold px-2 py-0.5 rounded">{pendingDrop.targetTableName}</span> at <span className="text-blue-600 font-bold">{pendingDrop.time}</span>?</>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setPendingDrop(null)}
            className="px-4 py-2 rounded-lg font-bold bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
          >
            {language === 'pt' ? 'Cancelar' : 'Cancel'}
          </button>
          <button
            onClick={() => {
              updateReservation(pendingDrop.resId, { 
                tableId: pendingDrop.tableId, 
                tableName: pendingDrop.targetTableName,
                time: pendingDrop.time 
              }).then(() => {
                toast.success(language === 'pt' ? 'Reserva atualizada!' : 'Reservation updated!');
                setPendingDrop(null);
              }).catch(err => {
                console.error(err);
                toast.error(language === 'pt' ? 'Erro ao atualizar' : 'Error updating');
              });
            }}
            className="px-4 py-2 rounded-lg font-bold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
          >
            {language === 'pt' ? 'Confirmar' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            id="cronograma-fullscreen-view"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "fixed inset-0 z-[100] flex flex-col overflow-hidden",
              currentTheme === 'dark' ? "bg-[#1e1e24]" : "bg-white"
            )}
          >
            {content}
            {pendingDropModal}
          </motion.div>
        )}
      </AnimatePresence>

      {!isFullscreen && (
        <>
          {content}
          {pendingDropModal}
        </>
      )}
    </>
  );
}

function cleanTableName(name: string) {
  return name.replace(/table\s*/gi, '').replace(/mesa\s*/gi, '').trim();
}
