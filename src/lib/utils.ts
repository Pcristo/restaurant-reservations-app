import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { RestaurantSettings, SpecialSchedule } from '../types';
import dayjs from 'dayjs';
import { format, parseISO } from 'date-fns';

export interface EffectiveOpeningHours {
  closed: boolean;
  open: string;
  close: string;
  lunch?: { open: string; close: string; active: boolean; fullHouse?: boolean };
  dinner?: { open: string; close: string; active: boolean; fullHouse?: boolean };
  reservationInterval?: number;
  sourceType: 'exception' | 'special_schedule' | 'closed_period' | 'weekly';
  scheduleName?: string;
}

export function getEffectiveOpeningHours(
  dateStr: string,
  settings: RestaurantSettings | null | undefined
): EffectiveOpeningHours {
  if (!dateStr || !settings) {
    return {
      closed: false,
      open: '09:00',
      close: '22:00',
      lunch: { open: '12:00', close: '15:00', active: false },
      dinner: { open: '19:00', close: '23:00', active: false },
      reservationInterval: 30,
      sourceType: 'weekly',
      scheduleName: 'Default Schedule',
    };
  }

  let dayName = 'Monday';
  let monthDay = '';
  try {
    dayName = format(parseISO(dateStr), 'EEEE');
    if (dateStr.length >= 10) {
      monthDay = dateStr.substring(5);
    }
  } catch {
    // fallback if parse ISO fails
  }

  // 1. Specific Date Exception (Highest Priority)
  const specificException = settings.specialDays?.[dateStr] || (monthDay ? settings.recurringSpecialDays?.[monthDay] : undefined);
  if (specificException && specificException.active !== false) {
    return {
      closed: !!specificException.closed,
      open: specificException.open || '09:00',
      close: specificException.close || '22:00',
      lunch: specificException.lunch ? { ...specificException.lunch } : undefined,
      dinner: specificException.dinner ? { ...specificException.dinner } : undefined,
      reservationInterval: specificException.reservationInterval || settings.reservationInterval || 30,
      sourceType: 'exception',
      scheduleName: 'Specific Date Exception',
    };
  }

  // 2. Special Date-Range Schedule (Second Priority)
  if (settings.specialSchedules && settings.specialSchedules.length > 0) {
    const matchingSchedule = settings.specialSchedules.find((s) => {
      if (s.active === false) return false;
      if (!s.startDate || !s.endDate) return false;
      if (dateStr < s.startDate || dateStr > s.endDate) return false;
      const daysLower = (s.days || []).map((d) => d.toLowerCase());
      return daysLower.includes(dayName.toLowerCase());
    });

    if (matchingSchedule) {
      return {
        closed: !!matchingSchedule.closed,
        open: matchingSchedule.open || '09:00',
        close: matchingSchedule.close || '22:00',
        lunch: matchingSchedule.lunch ? { ...matchingSchedule.lunch } : undefined,
        dinner: matchingSchedule.dinner ? { ...matchingSchedule.dinner } : undefined,
        reservationInterval: matchingSchedule.reservationInterval || settings.reservationInterval || 30,
        sourceType: 'special_schedule',
        scheduleName: matchingSchedule.name,
      };
    }
  }

  // 3. Closed Periods (Date Range complete closure)
  if (settings.closedPeriods && settings.closedPeriods.length > 0) {
    const period = settings.closedPeriods.find(
      (p) => p.startDate && p.endDate && dateStr >= p.startDate && dateStr <= p.endDate
    );
    if (period) {
      return {
        closed: true,
        open: '00:00',
        close: '00:00',
        lunch: { open: '12:00', close: '15:00', active: false },
        dinner: { open: '19:00', close: '23:00', active: false },
        reservationInterval: settings.reservationInterval || 30,
        sourceType: 'closed_period',
        scheduleName: period.note || 'Closed Period',
      };
    }
  }

  // 4. Normal Weekly Schedule (Fallback)
  const baseDayHours = settings.openingHours?.[dayName] || {
    open: '09:00',
    close: '22:00',
    closed: false,
    lunch: { open: '12:00', close: '15:00', active: false },
    dinner: { open: '19:00', close: '23:00', active: false },
  };

  return {
    closed: !!baseDayHours.closed,
    open: baseDayHours.open || '09:00',
    close: baseDayHours.close || '22:00',
    lunch: baseDayHours.lunch ? { ...baseDayHours.lunch } : undefined,
    dinner: baseDayHours.dinner ? { ...baseDayHours.dinner } : undefined,
    reservationInterval: settings.reservationInterval || 30,
    sourceType: 'weekly',
    scheduleName: 'Normal Weekly Schedule',
  };
}

export function findSpecialScheduleConflicts(schedules: SpecialSchedule[]): { s1: SpecialSchedule; s2: SpecialSchedule; overlappingDays: string[] }[] {
  const conflicts: { s1: SpecialSchedule; s2: SpecialSchedule; overlappingDays: string[] }[] = [];
  if (!schedules || schedules.length < 2) return conflicts;

  for (let i = 0; i < schedules.length; i++) {
    for (let j = i + 1; j < schedules.length; j++) {
      const s1 = schedules[i];
      const s2 = schedules[j];
      if (s1.active === false || s2.active === false) continue;

      // Check date range overlap
      const rangeOverlap = s1.startDate <= s2.endDate && s1.endDate >= s2.startDate;
      if (rangeOverlap) {
        // Check days overlap
        const s1DaysLower = (s1.days || []).map((d) => d.toLowerCase());
        const s2DaysLower = (s2.days || []).map((d) => d.toLowerCase());
        const commonDays = s1DaysLower.filter((d) => s2DaysLower.includes(d));

        if (commonDays.length > 0) {
          conflicts.push({
            s1,
            s2,
            overlappingDays: commonDays.map((d) => d.charAt(0).toUpperCase() + d.slice(1)),
          });
        }
      }
    }
  }

  return conflicts;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDisplayTime(time: string, settings: RestaurantSettings | null | undefined): string {
  if (!time) return '';
  const timeFormat = settings?.timeFormat || '24h';
  
  if (timeFormat === '12h') {
    // If the time is in HH:mm format, append standard prefix to parse it reliably
    const parsed = dayjs(`2026-01-01 ${time}`, 'YYYY-MM-DD HH:mm');
    if (parsed.isValid()) {
      return parsed.format('h:mm A');
    }
    // Fallback parsing
    const parts = time.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      const mStr = m.toString().padStart(2, '0');
      return `${h12}:${mStr} ${ampm}`;
    }
  } else {
    const parsed = dayjs(`2026-01-01 ${time}`, 'YYYY-MM-DD HH:mm');
    if (parsed.isValid()) {
      return parsed.format('H:mm');
    }
    const parts = time.split(':');
    if (parts.length >= 2) {
      const h = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      const mStr = m.toString().padStart(2, '0');
      return `${h}:${mStr}`;
    }
  }
  return time;
}

export function getDailyJoinForSession(table: any, date: string, sessionKey: string) {
  if (!table?.dailyJoins?.[date]) return undefined;
  const dayJoins = table.dailyJoins[date];
  if (sessionKey === 'lunch') {
    return dayJoins.lunch || dayJoins.default;
  }
  if (sessionKey === 'dinner') {
    return dayJoins.dinner || dayJoins.default;
  }
  return dayJoins.default || dayJoins.lunch || dayJoins.dinner;
}

export function getReservationTableDisplay(
  res: { tableId?: string; tableName?: string; date?: string; time?: string; manualSession?: 'lunch' | 'dinner' } | null | undefined,
  tables: any[],
  language: string = 'pt',
  settings?: RestaurantSettings | null
): string {
  if (!res || !res.tableId) {
    return res?.tableName || (language === 'pt' ? 'Desconhecida' : 'Unknown');
  }

  // Handle case where tableId has comma or slash (e.g. "id1,id2")
  if (res.tableId.includes(',') || res.tableId.includes('/')) {
    const ids = res.tableId.split(/[,/]/).map(s => s.trim()).filter(Boolean);
    const names = ids.map(id => tables.find(t => t.id === id)?.name || id).filter(Boolean);
    if (names.length > 0) {
      return names.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('/');
    }
  }

  // Determine session if possible
  let session = res.manualSession;
  if (!session && res.date && res.time && settings) {
    try {
      const eff = getEffectiveOpeningHours(res.date, settings);
      const lunch = eff.lunch;
      const dinner = eff.dinner;
      if (lunch && lunch.active && res.time >= lunch.open && res.time <= lunch.close) session = 'lunch';
      else if (dinner && dinner.active && res.time >= dinner.open && res.time <= dinner.close) session = 'dinner';
    } catch {
      // ignore parsing error
    }
  }

  const sessionKey = session === 'lunch' ? 'lunch' : session === 'dinner' ? 'dinner' : 'default';

  const groupTableIds: string[] = [];

  // Check if res.tableId is a parent table with dailyJoins or joinedTables
  const mainTable = tables.find(t => t.id === res.tableId);
  if (mainTable) {
    let joined: string[] = [];
    if (res.date) {
      const dj = getDailyJoinForSession(mainTable, res.date, sessionKey);
      if (dj?.joinedTables && dj.joinedTables.length > 0) {
        joined = dj.joinedTables;
      }
    }
    if (joined.length === 0 && mainTable.joinedTables && mainTable.joinedTables.length > 0) {
      joined = mainTable.joinedTables;
    }

    if (joined.length > 0) {
      groupTableIds.push(mainTable.id, ...joined);
    }
  }

  // If not found, check if res.tableId is inside another table's dailyJoins or joinedTables
  if (groupTableIds.length === 0) {
    for (const t of tables) {
      let joined: string[] = [];
      if (res.date) {
        const dj = getDailyJoinForSession(t, res.date, sessionKey);
        if (dj?.joinedTables && dj.joinedTables.length > 0) {
          joined = dj.joinedTables;
        }
      }
      if (joined.length === 0 && t.joinedTables && t.joinedTables.length > 0) {
        joined = t.joinedTables;
      }

      if (joined.includes(res.tableId)) {
        groupTableIds.push(t.id, ...joined);
        break;
      }
    }
  }

  if (groupTableIds.length === 0) {
    return mainTable?.name || res.tableName || res.tableId || (language === 'pt' ? 'Desconhecida' : 'Unknown');
  }

  const uniqueIds = Array.from(new Set(groupTableIds));
  const tableNames = uniqueIds
    .map(id => tables.find(t => t.id === id)?.name)
    .filter(Boolean);

  if (tableNames.length === 0) {
    return mainTable?.name || res.tableName || (language === 'pt' ? 'Desconhecida' : 'Unknown');
  }

  return tableNames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('/');
}

export function getTableDisplayForDropdown(
  table: any,
  targetDate: string,
  sessionKey: string,
  tables: any[]
): { name: string; seats: number; isJoined: boolean; joinedIds: string[] } {
  if (!table) return { name: '', seats: 0, isJoined: false, joinedIds: [] };

  let joinedIds: string[] = [];
  const dj = getDailyJoinForSession(table, targetDate, sessionKey);
  if (dj?.joinedTables && dj.joinedTables.length > 0) {
    joinedIds = dj.joinedTables;
  } else if (table.joinedTables && table.joinedTables.length > 0) {
    joinedIds = table.joinedTables;
  }

  const groupTableIds: string[] = [];
  if (joinedIds.length > 0) {
    groupTableIds.push(table.id, ...joinedIds);
  } else if (targetDate) {
    // Reverse lookup: check if table.id is inside another table's dailyJoins or joinedTables
    for (const t of tables) {
      let otherJoined: string[] = [];
      const otherDj = getDailyJoinForSession(t, targetDate, sessionKey);
      if (otherDj?.joinedTables && otherDj.joinedTables.length > 0) {
        otherJoined = otherDj.joinedTables;
      } else if (t.joinedTables && t.joinedTables.length > 0) {
        otherJoined = t.joinedTables;
      }

      if (otherJoined.includes(table.id)) {
        groupTableIds.push(t.id, ...otherJoined);
        break;
      }
    }
  }

  if (groupTableIds.length > 0) {
    const uniqueIds = Array.from(new Set(groupTableIds));
    const names = uniqueIds
      .map(id => tables.find(t => t.id === id)?.name || id)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    const sumOfSeats = uniqueIds.reduce((sum, id) => sum + Number(tables.find(t => t.id === id)?.seats || 0), 0);
    const mainTable = tables.find(t => uniqueIds.includes(t.id) && getDailyJoinForSession(t, targetDate, sessionKey)?.joinedSeats);
    const mainDj = mainTable ? getDailyJoinForSession(mainTable, targetDate, sessionKey) : null;
    const totalSeats = (mainDj?.joinedSeats && mainDj.joinedSeats > sumOfSeats) ? mainDj.joinedSeats : sumOfSeats;

    return {
      name: names.join('/'),
      seats: totalSeats,
      isJoined: true,
      joinedIds: uniqueIds
    };
  }

  return {
    name: table.name || '',
    seats: Number(table.seats || 0),
    isJoined: false,
    joinedIds: [table.id]
  };
}

export function getOptimizedUrl(url: string | undefined, settings: RestaurantSettings | null, type?: 'logo' | 'hero' | 'footer' | 'favicon' | 'social') {
  let targetUrl = url;

  // If cloudinary is enabled and we have a specific cloudinary field, use it
  if (settings?.useCloudinary) {
    if (type === 'logo' && settings.cloudinaryLogoUrl) targetUrl = settings.cloudinaryLogoUrl;
    else if (type === 'favicon' && settings.cloudinaryFaviconUrl) targetUrl = settings.cloudinaryFaviconUrl;
    else if (type === 'hero' && settings.cloudinaryHeroImageUrl) targetUrl = settings.cloudinaryHeroImageUrl;
    else if (type === 'footer' && settings.cloudinaryFooterImageUrl) targetUrl = settings.cloudinaryFooterImageUrl;
    else if (type === 'social' && settings.seo?.cloudinarySocialImageUrl) targetUrl = settings.seo.cloudinarySocialImageUrl;
  }

  if (!targetUrl) return '';
  
  // If Cloudinary is off, return the URL as is (the standard URL)
  if (!settings?.useCloudinary) return targetUrl;
  
  // If it's already a Cloudinary URL, ensure optimization params
  if (targetUrl.includes('cloudinary.com')) {
    if (!targetUrl.includes('/f_auto,q_auto/')) {
        return targetUrl.replace('/upload/', '/upload/f_auto,q_auto/');
    }
    return targetUrl;
  }
  
  // If Cloudinary is on but we only have a standard URL, use Fetch API for optimization
  if (settings?.cloudinaryCloudName) {
    return `https://res.cloudinary.com/${settings.cloudinaryCloudName}/image/fetch/f_auto,q_auto/${targetUrl}`;
  }

  return targetUrl;
}

export function updateFavicon(url: string | undefined, settings?: RestaurantSettings | null) {
  if (typeof document === 'undefined') return;

  const customUrl = getOptimizedUrl(url, settings || null, 'favicon') || url || '';
  const defaultFavicon = '/favicon.svg';
  const effectiveFavicon = customUrl.trim() !== '' ? customUrl.trim() : defaultFavicon;

  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="alternate icon"]',
    'link[rel="apple-touch-icon"]'
  ];

  let foundAny = false;
  selectors.forEach(selector => {
    const el = document.querySelector(selector) as HTMLLinkElement;
    if (el) {
      el.href = effectiveFavicon;
      foundAny = true;
    }
  });

  if (!foundAny) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = effectiveFavicon;
    document.head.appendChild(link);
  }
}

