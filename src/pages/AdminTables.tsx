import { MdTableRestaurant } from 'react-icons/md';
import React, { useState, useRef } from 'react';
import Draggable from 'react-draggable';
import { format, parseISO, isAfter, addDays } from 'date-fns';
import { useTables } from '../hooks/useTables';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { useSettings } from '../hooks/useSettings';
import { LayoutGrid, Plus, Trash2, Edit2, Save, X, Move, Users, Circle, Square, RectangleHorizontal, RotateCw, Maximize2, Minimize2, Eye, EyeOff, Sun, Moon, GripVertical, Printer } from 'lucide-react';
import { cn } from '../lib/utils';
import { Table, TableShape, Area } from '../types';
import restaurantFloorPlan from '../assets/restaurant_floor-plan.jpg';
import { motion, AnimatePresence } from 'motion/react';
import { CustomDropdown, DropdownOption } from '../components/CustomDropdown';
import { triggerPrint } from '../utils/printUtils';

const cleanTableName = (name: string) => {
  return name.replace(/table\s*/gi, '').replace(/mesa\s*/gi, '').trim();
};

interface DraggableTableProps {
  table: Table;
  areas?: Area[];
  isAdmin: boolean;
  onDrag: (id: string, e: any, data: any, session?: 'default' | 'lunch' | 'dinner') => void;
  onEdit: (table: Table) => void;
  onDelete: (id: string) => void;
  containerWidth: number;
  containerHeight: number;
  session?: 'default' | 'lunch' | 'dinner';
}

const DraggableTable: React.FC<DraggableTableProps> = ({ table, areas = [], isAdmin, onDrag, onEdit, onDelete, containerWidth, containerHeight, session = 'default' }) => {
  const nodeRef = useRef(null);
  const { language } = useLanguage();
  const [isLaptopOrBelow, setIsLaptopOrBelow] = useState(false);

  React.useEffect(() => {
    const media = window.matchMedia("(max-width: 1279px)");
    setIsLaptopOrBelow(media.matches);
    const listener = (e: MediaQueryListEvent) => setIsLaptopOrBelow(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);
  
  const shapeClasses = {
    round: isLaptopOrBelow ? "rounded-full w-[66.1px] h-[66.1px]" : "rounded-full w-[73.44px] h-[73.44px]",
    square: isLaptopOrBelow ? "rounded-xl w-[66.1px] h-[66.1px]" : "rounded-xl w-[73.44px] h-[73.44px]",
    rectangle: isLaptopOrBelow ? "rounded-xl w-[88.13px] h-[55.08px]" : "rounded-xl w-[97.92px] h-[61.2px]"
  };

  const currentShapeClass = shapeClasses[table.shape || 'square'];
  
  const getPixelPosition = () => {
    const rawPos = (session && session !== 'default' && table.positions?.[session]) 
      ? table.positions[session] 
      : { x: table.x ?? 0.5, y: table.y ?? 0.5 };

    let tx = rawPos.x ?? 0.5;
    let ty = rawPos.y ?? 0.5;
    // legacy fallback support: if coordinates are stored as absolute pixels (greater than 1)
    if (tx > 1) tx = tx / 1000;
    if (ty > 1) ty = ty / 600;
    // clamp to [0, 1]
    tx = Math.max(0, Math.min(1, tx));
    ty = Math.max(0, Math.min(1, ty));
    return {
      x: tx * containerWidth,
      y: ty * containerHeight
    };
  };

  const position = getPixelPosition();

  const area = areas.find(a => a.id === table.areaId);
  const isTableActive = table.isActive !== false && (
    session === 'lunch' ? (table.activeSessions?.lunch ?? true) :
    session === 'dinner' ? (table.activeSessions?.dinner ?? true) :
    ((table.activeSessions?.lunch ?? true) || (table.activeSessions?.dinner ?? true))
  );
  const isExtraActive = !table.isExtra || (
    session === 'lunch' ? (table.extraSessions?.lunch ?? true) :
    session === 'dinner' ? (table.extraSessions?.dinner ?? true) :
    ((table.extraSessions?.lunch ?? true) || (table.extraSessions?.dinner ?? true))
  );
  const isInactive = !isTableActive || !isExtraActive;

  const isAreaManual = area?.bookingMode === 'manual';
  const isOnlineActive = (table.allowOnlineReservations ?? true) && (
    session === 'lunch' ? (table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) :
    session === 'dinner' ? (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)) :
    ((table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) || (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)))
  );
  const isTableManual = !isOnlineActive;
  const isAreaPermanentlyClosed = area?.bookingMode === 'permanently_closed';
  
  const isLunchOnly = 
    ((table.activeSessions?.lunch ?? true) && table.activeSessions?.dinner === false) ||
    (table.isExtra && (table.extraSessions?.lunch ?? true) && table.extraSessions?.dinner === false) ||
    (table.allowOnlineReservations !== false && (table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) === true && (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)) === false) ||
    area?.sessionMode === 'lunch';

  const isDinnerOnly = 
    (table.activeSessions?.lunch === false && (table.activeSessions?.dinner ?? true)) ||
    (table.isExtra && table.extraSessions?.lunch === false && (table.extraSessions?.dinner ?? true)) ||
    (table.allowOnlineReservations !== false && (table.onlineSessions?.lunch ?? (table.extraSessions?.lunch ?? true)) === false && (table.onlineSessions?.dinner ?? (table.extraSessions?.dinner ?? true)) === true) ||
    area?.sessionMode === 'dinner';

  const areaClosedSessions = area?.closedSessions || ['lunch', 'dinner'];
  const isPeriodClosedBoth = area?.bookingMode === 'closed' && areaClosedSessions.includes('lunch') && areaClosedSessions.includes('dinner');
  const isPeriodClosedLunch = area?.bookingMode === 'closed' && areaClosedSessions.includes('lunch') && !areaClosedSessions.includes('dinner');
  const isPeriodClosedDinner = area?.bookingMode === 'closed' && areaClosedSessions.includes('dinner') && !areaClosedSessions.includes('lunch');

  const isAreaFullyClosed = !isTableManual && (
    (!isAreaManual && area?.allowOnlineReservations === false && area?.bookingMode !== 'closed' && area?.bookingMode !== 'permanently_closed') || 
    area?.bookingMode === 'permanently_closed'
  );
  const isSessionClosed = !isAreaFullyClosed && !isTableManual && (
    (isLunchOnly && session === 'dinner') ||
    (isDinnerOnly && session === 'lunch')
  );
  const isAreaClosed = isAreaFullyClosed || isSessionClosed;

  return (
    <Draggable
      key={`${table.id}-${session}`}
      nodeRef={nodeRef}
      position={position}
      onStop={(e, data) => onDrag(table.id, e, data, session)}
      disabled={!isAdmin}
      bounds="parent"
    >
      <div 
        ref={nodeRef}
        className="absolute cursor-move group select-none"
      >
        <div 
          style={{ transform: `rotate(${table.rotation || 0}deg)` }}
          className={cn(
            "flex flex-col items-center justify-center gap-1 shadow-lg border-2 transition-all active:scale-95 relative",
            currentShapeClass,
            isInactive
              ? "bg-gray-700 border-gray-600 text-gray-200 opacity-75"
              : isAreaFullyClosed
                ? "bg-red-50/95 border-dashed border-red-500 text-red-900"
                : isSessionClosed
                  ? "bg-green-500 border-[3px] border-dashed border-red-500 text-white"
                  : (isAreaManual || isTableManual)
                  ? "bg-yellow-50/95 border-dashed border-yellow-500 text-yellow-900"
                  : table.status === 'available' ? "bg-white border-amber-200 text-amber-900" :
                    table.status === 'reserved' ? "bg-amber-100 border-amber-400 text-amber-900" :
                    "bg-red-50 border-red-200 text-red-900"
          )}
        >
          <div style={{ transform: `rotate(-${table.rotation || 0}deg)`, fontSize: '13px' }} className="flex flex-col items-center justify-center gap-0.5 text-center p-1">
            <span style={{ fontSize: '13px', width: '65px' }} className="font-bold inline-block text-center break-words">{cleanTableName(table.name)}</span>
            
            {/* Side-by-side tags container */}
            <div className="flex items-center justify-center gap-1 flex-wrap max-w-full">
              {!isInactive && !isAreaManual && isAreaFullyClosed && !table.isExtra && (
                <span className="text-[7px] bg-red-100 text-red-700 px-1 rounded font-bold uppercase tracking-tight scale-90">
                  {isAreaPermanentlyClosed ? (language === 'pt' ? 'Fechada' : 'Closed') : 'Off'}
                </span>
              )}

              {!isInactive && (isAreaManual || isTableManual) && (
                <span className="text-[7px] bg-yellow-100 text-yellow-800 px-1 rounded font-bold uppercase tracking-tight scale-90">Manual</span>
              )}

              {!isInactive && table.isExtra && (
                <span className="text-[8px] bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.2 rounded font-extrabold uppercase flex items-center gap-0.5 shadow-2xs">
                  Extra
                  {(table.extraSessions?.lunch ?? true) && table.extraSessions?.dinner === false && <Sun size={8} className="text-amber-500" />}
                  {table.extraSessions?.lunch === false && (table.extraSessions?.dinner ?? true) && <Moon size={8} className="text-indigo-400" />}
                </span>
              )}
            </div>

            <div style={{ fontSize: '13px' }} className="flex items-center gap-1 opacity-70 justify-center scale-[1.05]">
              <Users size={12} />
              <span>{table.seats}</span>
              {!table.isExtra && isLunchOnly && <Sun size={14} className="text-amber-500 ml-0.5" />}
              {!table.isExtra && isDinnerOnly && <Moon size={14} className="text-gray-500 ml-0.5" />}
            </div>
          </div>

          {/* Inactive overlay badge matching Floor Plan Live View */}
          {isInactive && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <span className="bg-gray-800/90 text-white text-[10px] px-2 py-1 rounded-md font-extrabold uppercase tracking-widest shadow-lg transform -rotate-12">
                {language === 'pt' ? 'Inativo' : 'Inactive'}
              </span>
            </div>
          )}
          
          {/* Table Status / Area Indicator */}
          <div 
            className={cn(
              "absolute -top-2.5 -right-2.5 w-6 h-6 rounded-full border-2 border-white shadow-md z-20 flex items-center justify-center transition-all",
              isInactive ? "bg-gray-400" :
              isAreaClosed ? "bg-red-600" : ""
            )}
            style={
              !isInactive && !isAreaClosed
                ? { backgroundColor: area?.color || (table.status === 'available' ? '#22c55e' : table.status === 'reserved' ? '#f59e0b' : '#ef4444') }
                : undefined
            }
            title={area ? `${area.name} (${cleanTableName(table.name)})` : cleanTableName(table.name)}
          />
        </div>

        {/* Admin Actions - Moved outside the rotated div to stay upright */}
        {isAdmin && (
          <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white p-1 rounded-lg shadow-md border border-gray-100 z-10">
            <button 
              onClick={(e) => { e.stopPropagation(); onEdit(table); }}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
            >
              <Edit2 size={14} />
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onDelete(table.id); }}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>
    </Draggable>
  );
};

export default function AdminTables() {
  const { tables, areas = [], addTable, updateTable, deleteTable, addArea, updateArea, deleteArea, loading } = useTables();
  const sortedAreas = React.useMemo(() => {
    return [...areas].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [areas]);

  const [draggedAreaId, setDraggedAreaId] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedAreaId(id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (!draggedAreaId) return;

    const sourceIndex = sortedAreas.findIndex(a => a.id === draggedAreaId);
    if (sourceIndex === -1 || sourceIndex === targetIndex) return;

    const updated = [...sortedAreas];
    const [moved] = updated.splice(sourceIndex, 1);
    updated.splice(targetIndex, 0, moved);

    try {
      for (let i = 0; i < updated.length; i++) {
        await updateArea(updated[i].id, { order: i });
      }
    } catch (err) {
      console.error('Failed to update area order:', err);
    }
    setDraggedAreaId(null);
  };

  const { settings } = useSettings();
  const { isAdmin } = useAuth();
  const { t, language } = useLanguage();
  const [editingTable, setEditingTable] = useState<Partial<Table> | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  // Areas state
  const [showAreaModal, setShowAreaModal] = useState(false);
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaBookingMode, setNewAreaBookingMode] = useState<'online' | 'manual' | 'closed' | 'special_event' | 'permanently_closed'>('online');
  const [newAreaClosedStartDate, setNewAreaClosedStartDate] = useState('');
  const [newAreaClosedEndDate, setNewAreaClosedEndDate] = useState('');
  const [newAreaSessionMode, setNewAreaSessionMode] = useState<'both' | 'lunch' | 'dinner'>('both');
  const [newAreaClosedSessions, setNewAreaClosedSessions] = useState<('lunch' | 'dinner')[]>(['lunch', 'dinner']);
  const [newAreaColor, setNewAreaColor] = useState('#3B82F6');

  const [editingArea, setEditingArea] = useState<any | null>(null);
  const [editingAreaName, setEditingAreaName] = useState('');
  const [editingAreaBookingMode, setEditingAreaBookingMode] = useState<'online' | 'manual' | 'closed' | 'special_event' | 'permanently_closed'>('online');
  const [editingAreaClosedStartDate, setEditingAreaClosedStartDate] = useState('');
  const [editingAreaClosedEndDate, setEditingAreaClosedEndDate] = useState('');
  const [editingAreaSessionMode, setEditingAreaSessionMode] = useState<'both' | 'lunch' | 'dinner'>('both');
  const [editingAreaClosedSessions, setEditingAreaClosedSessions] = useState<('lunch' | 'dinner')[]>(['lunch', 'dinner']);
  const [editingAreaColor, setEditingAreaColor] = useState('#3B82F6');

  const [showAreaDeleteConfirm, setShowAreaDeleteConfirm] = useState<string | null>(null);

  const [newTable, setNewTable] = useState<{ 
    name: string; 
    seats: number; 
    shape: TableShape; 
    rotation: number; 
    isActive: boolean; 
    activeSessions: { lunch: boolean; dinner: boolean };
    allowOnlineReservations: boolean;
    onlineSessions: { lunch: boolean; dinner: boolean };
    availableDate: string; 
    availableDates: string[];
    isExtra: boolean;
    extraStartDate?: string;
    extraEndDate?: string;
    extraSessions: { lunch: boolean; dinner: boolean };
    extraAvailability: Record<string, { lunch: boolean; dinner: boolean }>;
    areaId: string;
    status?: 'available' | 'reserved' | 'occupied';
  }>({ 
    name: '', 
    seats: 2, 
    shape: 'square',
    rotation: 0,
    isActive: true,
    activeSessions: { lunch: true, dinner: true },
    allowOnlineReservations: true,
    onlineSessions: { lunch: true, dinner: true },
    availableDate: '',
    availableDates: [],
    isExtra: false,
    extraStartDate: '',
    extraEndDate: '',
    extraSessions: { lunch: true, dinner: true },
    extraAvailability: {},
    areaId: '',
    status: 'available'
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1000, height: 600 });
  const [fullscreenDimensions, setFullscreenDimensions] = useState({ width: 1000, height: 600 });
  const [selectedSession, setSelectedSession] = useState<'default' | 'lunch' | 'dinner'>('default');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenTheme, setFullscreenTheme] = useState<'light' | 'dark'>('light');
  const [showFullscreenSidebar, setShowFullscreenSidebar] = useState(true);

  React.useEffect(() => {
    if (loading) return;

    const element = containerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        setDimensions({
          width: rect.width || 1000,
          height: rect.height || 600
        });
      }
    });

    resizeObserver.observe(element);
    
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height) {
      setDimensions({ width: rect.width, height: rect.height });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [loading]);

  React.useEffect(() => {
    if (!isFullscreen) return;

    const element = fullscreenContainerRef.current;
    if (!element) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const rect = entry.target.getBoundingClientRect();
        setFullscreenDimensions({
          width: rect.width || 1000,
          height: rect.height || 600
        });
      }
    });

    resizeObserver.observe(element);
    
    const rect = element.getBoundingClientRect();
    if (rect.width && rect.height) {
      setFullscreenDimensions({ width: rect.width, height: rect.height });
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [isFullscreen]);

  React.useEffect(() => {
    if (scrollContainerRef.current && !loading) {
      const container = scrollContainerRef.current;
      container.scrollLeft = container.scrollWidth - container.clientWidth;
    }
  }, [loading, tables.length]);

  if (loading) return <div className="p-8 text-center">{t('common.loading')}</div>;

  /**
   * Professional Print Functionality:
   * Triggers clean print dialog or printable document, optimized for A4 paper size,
   * hiding non-essential UI and preserving layout/colors.
   */
  const handlePrint = () => {
    triggerPrint(settings?.name ? `${settings.name} - ${language === 'pt' ? 'Planta de Mesas' : 'Floor Plan'}` : 'Floor Plan');
  };

  const handleDrag = (id: string, e: any, data: any, session: 'default' | 'lunch' | 'dinner' = 'default') => {
    if (!isAdmin) return;
    const size = isFullscreen ? fullscreenDimensions : dimensions;
    const normX = Math.max(0, Math.min(1, data.x / size.width));
    const normY = Math.max(0, Math.min(1, data.y / size.height));
    
    if (session && session !== 'default') {
      const table = tables.find(t => t.id === id);
      const positions = { ...(table?.positions || {}) };
      positions[session] = { x: normX, y: normY };
      updateTable(id, { positions });
    } else {
      updateTable(id, { x: normX, y: normY });
    }
  };

  const generateDateRange = (start: string, end: string) => {
    if (!start || !end) return [];
    const dates = [];
    let current = parseISO(start);
    const last = parseISO(end);
    while (!isAfter(current, last)) {
      dates.push(format(current, 'yyyy-MM-dd'));
      current = addDays(current, 1);
    }
    return dates;
  };

  const handleAddTable = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check for duplicate names
    if (tables.some(t => t.name.toLowerCase() === newTable.name.toLowerCase())) {
      alert("A table with this name already exists. Please use a unique name.");
      return;
    }

    const tableToSave = { ...newTable };
    if (tableToSave.isExtra) {
       tableToSave.availableDate = tableToSave.extraStartDate || '';
       if (tableToSave.extraStartDate && tableToSave.extraEndDate) {
          tableToSave.availableDates = generateDateRange(tableToSave.extraStartDate, tableToSave.extraEndDate);
       } else {
          tableToSave.availableDates = [];
       }
    }

    await addTable({
      ...tableToSave,
      x: 0.5,
      y: 0.5,
      status: 'available'
    });
    setShowAddModal(false);
    setNewTable({ 
      name: '', 
      seats: 2, 
      shape: 'square', 
      rotation: 0, 
      isActive: true, 
      activeSessions: { lunch: true, dinner: true },
      allowOnlineReservations: true,
      onlineSessions: { lunch: true, dinner: true },
      availableDate: '', 
      availableDates: [],
      isExtra: false,
      extraStartDate: '',
      extraEndDate: '',
      extraSessions: { lunch: true, dinner: true },
      extraAvailability: {},
      areaId: ''
    });
  };

  const handleAddArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAreaName.trim()) return;

    if (areas.some(a => a.name.toLowerCase() === newAreaName.trim().toLowerCase())) {
      alert(language === 'pt' ? 'Uma área com este nome já existe.' : 'An area with this name already exists.');
      return;
    }

    try {
      await addArea({
        name: newAreaName.trim(),
        bookingMode: newAreaBookingMode,
        closedStartDate: newAreaBookingMode === 'closed' ? newAreaClosedStartDate : '',
        closedEndDate: newAreaBookingMode === 'closed' ? newAreaClosedEndDate : '',
        closedSessions: newAreaBookingMode === 'closed' ? newAreaClosedSessions : [],
        allowOnlineReservations: newAreaBookingMode === 'online',
        sessionMode: newAreaSessionMode,
        order: areas.length,
        color: newAreaColor
      });
      setNewAreaName('');
      setNewAreaBookingMode('online');
      setNewAreaClosedStartDate('');
      setNewAreaClosedEndDate('');
      setNewAreaSessionMode('both');
      setNewAreaColor('#3B82F6');
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateAreaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingArea || !editingAreaName.trim()) return;

    if (areas.some(a => a.id !== editingArea.id && a.name.toLowerCase() === editingAreaName.trim().toLowerCase())) {
      alert(language === 'pt' ? 'Uma área com este nome já existe.' : 'An area with this name already exists.');
      return;
    }

    try {
      await updateArea(editingArea.id, {
        name: editingAreaName.trim(),
        bookingMode: editingAreaBookingMode,
        closedStartDate: editingAreaBookingMode === 'closed' ? editingAreaClosedStartDate : '',
        closedEndDate: editingAreaBookingMode === 'closed' ? editingAreaClosedEndDate : '',
      closedSessions: editingAreaBookingMode === 'closed' ? editingAreaClosedSessions : [],
        allowOnlineReservations: editingAreaBookingMode === 'online',
        sessionMode: editingAreaSessionMode,
        color: editingAreaColor
      });
      setEditingArea(null);
      setEditingAreaName('');
      setEditingAreaBookingMode('online');
      setEditingAreaClosedStartDate('');
      setEditingAreaClosedEndDate('');
      setEditingAreaSessionMode('both');
      setEditingAreaColor('#3B82F6');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteArea = (areaId: string) => {
    setShowAreaDeleteConfirm(areaId);
  };

  const executeDeleteArea = async () => {
    if (!showAreaDeleteConfirm) return;
    const areaId = showAreaDeleteConfirm;
    try {
      const tablesInArea = tables.filter(t => t.areaId === areaId);
      for (const t of tablesInArea) {
        await updateTable(t.id, { areaId: '' });
      }
      await deleteArea(areaId);
      setShowAreaDeleteConfirm(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateTable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTable?.id) {
      // Check for duplicate names (excluding current table)
      if (tables.some(t => t.id !== editingTable.id && t.name.toLowerCase() === editingTable.name?.toLowerCase())) {
        alert("A table with this name already exists. Please use a unique name.");
        return;
      }

      const tableToSave = { ...editingTable };
      if (!tableToSave.status) tableToSave.status = 'available';
      if (tableToSave.isExtra) {
         tableToSave.availableDate = tableToSave.extraStartDate || '';
         if (tableToSave.extraStartDate && tableToSave.extraEndDate) {
            tableToSave.availableDates = generateDateRange(tableToSave.extraStartDate, tableToSave.extraEndDate);
         } else {
            tableToSave.availableDates = [];
         }
      }

      await updateTable(editingTable.id, tableToSave);
      setEditingTable(null);
    }
  };

  const handleDeleteTable = async () => {
    if (showDeleteConfirm) {
      await deleteTable(showDeleteConfirm);
      setShowDeleteConfirm(null);
    }
  };

  const areaOptions: DropdownOption[] = [
    { 
      value: '', 
      label: language === 'pt' ? 'Sem Área Atribuída' : 'No Area Assigned',
      hexColor: '#9CA3AF',
      colorDot: '#9CA3AF'
    },
    ...sortedAreas.map(area => {
      const isClosed = area.allowOnlineReservations === false || area.bookingMode === 'manual' || area.bookingMode === 'closed' || area.bookingMode === 'permanently_closed';
      const isPerm = area.bookingMode === 'permanently_closed';
      const labelSuffix = area.bookingMode === 'manual' 
        ? ` (${language === 'pt' ? 'Manual' : 'Manual'})` 
        : isPerm
          ? ` (${language === 'pt' ? 'Permanente' : 'Permanently Closed'})`
          : isClosed 
            ? ` (${language === 'pt' ? 'Fechada' : 'Closed'})` 
            : '';
      return {
        value: area.id,
        label: `${area.name}${labelSuffix}`,
        hexColor: area.color || '#3B82F6',
        colorDot: area.color || '#3B82F6'
      };
    })
  ];

  const tableStatusOptions: DropdownOption[] = [
    { value: 'available', label: t('res.available') || (language === 'pt' ? 'Disponível' : 'Available'), colorDot: 'bg-green-500' },
    { value: 'reserved', label: t('res.reserved') || (language === 'pt' ? 'Reservada' : 'Reserved'), colorDot: 'bg-amber-500' },
    { value: 'occupied', label: t('res.occupied') || (language === 'pt' ? 'Ocupada' : 'Occupied'), colorDot: 'bg-red-500' }
  ];

  const bookingModeOptions: DropdownOption[] = [
    {
      value: 'online',
      label: language === 'pt' ? 'Disponível Online & Manual (Público & Admin)' : 'Available Online & Manual (Public & Admin)',
      colorDot: 'bg-green-500'
    },
    {
      value: 'manual',
      label: language === 'pt' ? 'Apenas Reservas Manuais (Offline para o Público)' : 'Manual Bookings Only (Offline for Public)',
      colorDot: 'bg-amber-500'
    },
    {
      value: 'closed',
      label: language === 'pt' ? 'Fechado por um período de tempo' : 'Closed for a period of time',
      colorDot: 'bg-red-500'
    },
    {
      value: 'permanently_closed',
      label: language === 'pt' ? 'Fechado Permanentemente' : 'Permanently Closed',
      colorDot: 'bg-gray-500'
    }
  ];

  const sessionModeOptions: DropdownOption[] = [
    {
      value: 'both',
      label: language === 'pt' ? 'Almoço & Jantar' : 'Both (Lunch & Dinner)'
    },
    {
      value: 'lunch',
      label: language === 'pt' ? 'Apenas Almoço' : 'Only Lunch'
    },
    {
      value: 'dinner',
      label: language === 'pt' ? 'Apenas Jantar' : 'Only Dinner'
    }
  ];

  return (
    <div className={cn("mx-auto py-8 px-4 sm:px-6 lg:px-8", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
      {/* Dedicated Clean Print Header (Visible Only When Printing) */}
      <div className="print-only hidden print:block mb-6 pb-4 border-b-2 border-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {(settings?.logoUrl || settings?.cloudinaryLogoUrl) ? (
              <img 
                src={settings?.logoUrl || settings?.cloudinaryLogoUrl} 
                alt={settings?.name || "Restaurant"} 
                className="h-12 w-auto object-contain"
                referrerPolicy="no-referrer"
              />
            ) : null}
            <div>
              <h1 className="text-2xl font-black tracking-tight text-gray-900 uppercase">
                {settings?.name || 'Restaurant'} — {language === 'pt' ? 'Planta de Mesas' : 'Floor Plan'}
              </h1>
              <p className="text-xs font-semibold text-gray-600 mt-0.5">
                {language === 'pt' ? 'Layout Ativo' : 'Active Layout'}: <span className="font-bold text-gray-900 uppercase">{selectedSession === 'lunch' ? (language === 'pt' ? 'Almoço' : 'Lunch') : selectedSession === 'dinner' ? (language === 'pt' ? 'Jantar' : 'Dinner') : (language === 'pt' ? 'Geral / Padrão' : 'Default / General')}</span>
                {' • '}{language === 'pt' ? 'Total de Mesas' : 'Total Tables'}: <span className="font-bold text-gray-900">{tables.length}</span>
                {' • '}{language === 'pt' ? 'Capacidade Total' : 'Total Capacity'}: <span className="font-bold text-gray-900">{tables.reduce((acc, t) => acc + (t.seats || 0), 0)} {language === 'pt' ? 'lugares' : 'seats'}</span>
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-gray-600">
            <div className="font-bold text-gray-900">{format(new Date(), 'dd/MM/yyyy HH:mm')}</div>
            <div className="text-[11px] text-gray-500">{language === 'pt' ? 'Documento Oficial de Sala' : 'Official Room Document'}</div>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mb-8 no-print">
        <div>
          <h1 className={cn(
            "text-3xl font-bold transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-900"
          )}>{t('nav.tables')}</h1>
          <p className={cn(
            "transition-colors",
            settings?.theme === 'dark' ? "text-white" : "text-gray-500"
          )}>{t('dashboard.floor_plan')}</p>
        </div>
        {isAdmin && (
          <div className="flex gap-3 no-print">
            <button
              onClick={() => setShowAreaModal(true)}
              className="flex items-center gap-2 bg-gray-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={20} />
              {language === 'pt' ? 'Gerir Áreas' : 'Manage Areas'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
            >
              <Plus size={20} />
              {t('tables.new')}
            </button>
          </div>
        )}
      </div>

      {/* Control row with layout selector & full window */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between no-print">
        <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => setSelectedSession('default')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
              selectedSession === 'default' 
                ? "bg-white text-amber-700 shadow-sm" 
                : "text-gray-600 hover:text-amber-600"
            )}
          >
            {t('tables.default_layout') || "Default Layout"}
          </button>
          <button
            onClick={() => setSelectedSession('lunch')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
              selectedSession === 'lunch' 
                ? "bg-white text-amber-700 shadow-sm" 
                : "text-gray-600 hover:text-amber-600"
            )}
          >
            {t('common.lunch') || "Lunch Layout"}
          </button>
          <button
            onClick={() => setSelectedSession('dinner')}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-bold transition-all cursor-pointer",
              selectedSession === 'dinner' 
                ? "bg-white text-amber-700 shadow-sm" 
                : "text-gray-600 hover:text-amber-600"
            )}
          >
            {t('common.dinner') || "Dinner Layout"}
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Table Metrics Pill Widget */}
          <div className={cn(
            "hidden sm:flex items-center rounded-xl border shadow-2xs divide-x transition-colors duration-300 py-1 px-0.5",
            settings?.theme === 'dark' ? "bg-gray-800 border-gray-700 divide-gray-700" : "bg-white border-gray-200 divide-gray-200"
          )}>
            {/* Total Tables */}
            <div className="flex flex-col items-center px-2.5 sm:px-3 py-0.5 min-w-[56px] sm:min-w-[64px]" title={language === 'pt' ? 'Total de Mesas' : 'Total Tables'}>
              <span className={cn(
                "w-full text-center text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider leading-none mb-1",
                settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
              )}>
                {language === 'pt' ? 'Total' : 'Total'}
              </span>
              <div className="w-full flex items-center justify-center gap-1.5">
                <div className={cn("w-1/2 flex items-center justify-end", settings?.theme === 'dark' ? "text-white" : "text-gray-900")}>
                  <MdTableRestaurant size={15} />
                </div>
                <div className={cn("w-1/2 flex items-center justify-start text-xs sm:text-sm font-black leading-none", settings?.theme === 'dark' ? "text-white" : "text-gray-900")}>
                  {tables.length}
                </div>
              </div>
            </div>

            {/* Active Tables */}
            <div className="flex flex-col items-center px-2.5 sm:px-3 py-0.5 min-w-[56px] sm:min-w-[64px]" title={language === 'pt' ? 'Mesas Ativas' : 'Active Tables'}>
              <span className="w-full text-center text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider leading-none mb-1 text-green-600 dark:text-green-400">
                {language === 'pt' ? 'Ativas' : 'Active'}
              </span>
              <div className="w-full flex items-center justify-center gap-1.5">
                <div className="w-1/2 flex items-center justify-end text-green-600 dark:text-green-400">
                  <MdTableRestaurant size={15} />
                </div>
                <div className="w-1/2 flex items-center justify-start text-xs sm:text-sm font-black leading-none text-green-600 dark:text-green-400">
                  {tables.filter(t => t.isActive !== false).length}
                </div>
              </div>
            </div>

            {/* Inactive Tables */}
            <div className="flex flex-col items-center px-2.5 sm:px-3 py-0.5 min-w-[56px] sm:min-w-[64px]" title={language === 'pt' ? 'Mesas Inativas' : 'Inactive Tables'}>
              <span className="w-full text-center text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider leading-none mb-1 text-gray-400 dark:text-gray-500">
                {language === 'pt' ? 'Inativas' : 'Inactive'}
              </span>
              <div className="w-full flex items-center justify-center gap-1.5">
                <div className="w-1/2 flex items-center justify-end text-gray-400 dark:text-gray-500">
                  <MdTableRestaurant size={15} />
                </div>
                <div className="w-1/2 flex items-center justify-start text-xs sm:text-sm font-black leading-none text-gray-400 dark:text-gray-500">
                  {tables.filter(t => t.isActive === false).length}
                </div>
              </div>
            </div>

            {/* Extra Tables */}
            <div className="flex flex-col items-center px-2.5 sm:px-3 py-0.5 min-w-[56px] sm:min-w-[64px]" title={language === 'pt' ? 'Mesas Extra' : 'Extra Tables'}>
              <span className="w-full text-center text-[8.5px] sm:text-[9px] font-bold uppercase tracking-wider leading-none mb-1 text-purple-600 dark:text-purple-400">
                {language === 'pt' ? 'Extra' : 'Extra'}
              </span>
              <div className="w-full flex items-center justify-center gap-1.5">
                <div className="w-1/2 flex items-center justify-end text-purple-600 dark:text-purple-400">
                  <MdTableRestaurant size={15} />
                </div>
                <div className="w-1/2 flex items-center justify-start text-xs sm:text-sm font-black leading-none text-purple-600 dark:text-purple-400">
                  {tables.filter(t => t.isExtra).length}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsFullscreen(true)}
              className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-200 hover:bg-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 transition-colors shadow-2xs cursor-pointer no-print"
              title={t('res.increase_window') || "Increase Window"}
            >
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Canvas Area with Sidebar */}
      <div className="flex flex-col lg:flex-row gap-8">
        <div 
          ref={scrollContainerRef}
          className="flex-grow h-[600px] overflow-x-auto overflow-y-hidden rounded-3xl border-2 border-dashed border-gray-200 bg-white shadow-inner custom-scrollbar floor-plan-scroll-container"
        >
          <div 
            ref={containerRef}
            className={cn(
              "relative min-w-[1000px] h-full floor-plan-canvas-scaler",
              settings?.showFloorPlanBg !== false ? "bg-white" : "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"
            )}
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

            {tables.map((table) => (
              <DraggableTable 
                key={table.id}
                table={table}
                areas={areas}
                isAdmin={isAdmin}
                onDrag={handleDrag}
                onEdit={(t) => setEditingTable({
                  ...t,
                  extraStartDate: t.extraStartDate || t.availableDate || ''
                })}
                onDelete={(id) => setShowDeleteConfirm(id)}
                containerWidth={dimensions.width}
                containerHeight={dimensions.height}
                session={selectedSession}
              />
            ))}

            {tables.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                <Move size={48} className="mb-4 opacity-20" />
                <p>{t('res.no_tables')}</p>
                {isAdmin && <p className="text-sm">{t('res.add_table_hint')}</p>}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar Table List */}
        <div className="lg:w-80 space-y-4 no-print">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Users className="text-amber-600" size={20} />
              {t('nav.tables')} ({tables.length})
            </h2>
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {(() => {
                const sortedAreas = [...areas].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                
                const renderTableItemInSidebar = (table: Table) => {
                  const tableArea = areas.find(a => a.id === table.areaId);
                  const isTableManual = table.allowOnlineReservations === false;
                  const isInactive = table.isActive === false;
                  const isClosed = !isTableManual && ((tableArea?.allowOnlineReservations === false && tableArea?.bookingMode !== 'manual') || tableArea?.bookingMode === 'closed' || tableArea?.bookingMode === 'permanently_closed');
                  const isManual = tableArea?.bookingMode === 'manual' || isTableManual;

                  return (
                    <div 
                      key={table.id} 
                      className={cn(
                        "relative p-3 rounded-xl border flex flex-col gap-2 transition-all group overflow-hidden",
                        isInactive
                          ? "bg-gray-100/80 border-gray-200 text-gray-500 opacity-60"
                          : isClosed 
                            ? "bg-red-50 border-red-200 hover:bg-red-100/70 hover:border-red-300 text-gray-900" 
                            : isManual
                              ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100/70 hover:border-yellow-300 text-yellow-950"
                              : "bg-gray-50 border-gray-100 hover:bg-amber-50 hover:border-amber-200 text-gray-900"
                      )}
                    >
                      <div className="flex items-start">
                        <div className={cn(
                          "min-w-[42px] px-1.5 h-8 rounded-lg flex items-center justify-center text-xs font-bold border mr-3 whitespace-nowrap flex-shrink-0 mt-0.5",
                          isInactive ? "bg-gray-700 text-white border-gray-600" :
                          table.status === 'available' ? "bg-green-100 text-green-700 border-green-200" :
                          table.status === 'reserved' ? "bg-amber-100 text-amber-700 border-amber-200" :
                          "bg-red-100 text-red-700 border-red-200"
                        )}>
                          {table.name}
                        </div>
                        <div className="flex-1 min-w-0 pr-12">
                          <div className="font-bold text-gray-900 flex items-center gap-1.5 flex-wrap">
                            {table.isExtra && (
                              <span className="text-[8px] bg-purple-100 text-purple-700 border border-purple-300 px-1 py-0.5 rounded font-extrabold uppercase flex items-center gap-0.5">
                                Extra
                                {(table.extraSessions?.lunch ?? true) && table.extraSessions?.dinner === false && <Sun size={8} className="text-amber-500" />}
                                {table.extraSessions?.lunch === false && (table.extraSessions?.dinner ?? true) && <Moon size={8} className="text-indigo-400" />}
                              </span>
                            )}
                            {table.isActive === false ? (
                              <span className="text-[8px] bg-gray-700 text-white border border-gray-600 px-1 py-0.5 rounded font-bold uppercase">
                                {language === 'pt' ? 'Inativo' : 'Inactive'}
                              </span>
                            ) : !table.isExtra ? (
                              <>
                                {table.activeSessions?.lunch === false && (table.activeSessions?.dinner ?? true) && (
                                  <span className="text-[8px] bg-gray-700 text-white border border-gray-600 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                    Off <Sun size={8} className="text-amber-400" />
                                  </span>
                                )}
                                {(table.activeSessions?.lunch ?? true) && table.activeSessions?.dinner === false && (
                                  <span className="text-[8px] bg-gray-700 text-white border border-gray-600 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                    Off <Moon size={8} className="text-indigo-300" />
                                  </span>
                                )}
                              </>
                            ) : null}
                            {table.allowOnlineReservations === false ? (
                              <span className="text-[8px] bg-yellow-100 text-yellow-800 px-1 py-0.5 rounded font-bold uppercase">
                                {language === 'pt' ? 'Manual' : 'Manual'}
                              </span>
                            ) : (
                              <>
                                {table.onlineSessions?.lunch === false && (table.onlineSessions?.dinner ?? true) && (
                                  <span className="text-[8px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                    Online <Moon size={8} className="text-indigo-400" />
                                  </span>
                                )}
                                {(table.onlineSessions?.lunch ?? true) && table.onlineSessions?.dinner === false && (
                                  <span className="text-[8px] bg-blue-100 text-blue-800 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                    Online <Sun size={8} className="text-amber-500" />
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-1.5 flex-wrap mt-1">
                            <span className="flex items-center gap-0.5">
                              <Users size={10} className="inline" />
                              <span>{table.seats}</span>
                            </span>
                            {table.areaId && (() => {
                              return (
                                <span 
                                  style={{
                                    backgroundColor: tableArea?.color || '#3B82F6',
                                  }}
                                  className="w-2.5 h-2.5 rounded-full inline-block border border-white/20 shadow-xs flex-shrink-0 ml-1"
                                  title={tableArea?.name || ''}
                                />
                              );
                            })()}
                          </div>
                        </div>
                      </div>

                      {table.availableDate && (
                        <div className="w-full text-[10px] text-gray-600 bg-gray-100 py-1.5 px-2 rounded flex justify-center font-medium mt-1">
                          {table.isExtra 
                            ? (language === 'pt' ? `Apenas ${table.availableDate}` : `Only ${table.availableDate}`) 
                            : (language === 'pt' ? `A partir de ${table.availableDate}` : `From ${table.availableDate}`)}
                        </div>
                      )}

                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                         onClick={() => setEditingTable({
                           ...table,
                           extraStartDate: table.extraStartDate || table.availableDate || ''
                         })}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => setShowDeleteConfirm(table.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                };

                return (
                  <div className="space-y-4">
                    {sortedAreas.map(area => {
                      const areaTables = tables
                        .filter(t => t.areaId === area.id)
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                      if (areaTables.length === 0) return null;

                      const isAreaManual = area.bookingMode === 'manual';
                      const isAreaPermanentlyClosed = !isAreaManual && (area.bookingMode === 'permanently_closed' || (area.allowOnlineReservations === false && area.bookingMode !== 'closed'));
                      const isAreaPeriodClosed = !isAreaManual && area.bookingMode === 'closed';
                      const areaClosedSessions = area.closedSessions || ['lunch', 'dinner'];
                      const isPeriodClosedBoth = isAreaPeriodClosed && areaClosedSessions.includes('lunch') && areaClosedSessions.includes('dinner');
                      const isPeriodClosedLunch = isAreaPeriodClosed && areaClosedSessions.includes('lunch') && !areaClosedSessions.includes('dinner');
                      const isPeriodClosedDinner = isAreaPeriodClosed && areaClosedSessions.includes('dinner') && !areaClosedSessions.includes('lunch');
                      const isAreaClosed = !isAreaManual && (isAreaPermanentlyClosed || isPeriodClosedBoth);

                      return (
                        <div key={area.id} className="space-y-1.5">
                          <div 
                            style={{ backgroundColor: area.color || '#3B82F6' }}
                            className="sticky top-0 z-10 py-1.5 px-2.5 rounded-lg flex items-center justify-between shadow-sm text-white"
                          >
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-[10px] uppercase tracking-wider text-white bg-gray-700/80 px-2 py-0.5 rounded shadow-sm border border-gray-600/50">
                                {area.name}
                              </span>
                              {isAreaPermanentlyClosed && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'}
                                </span>
                              )}
                              {isPeriodClosedBoth && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20 flex items-center gap-1">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'} <Sun size={10} /><Moon size={10} />
                                </span>
                              )}
                              {isPeriodClosedLunch && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20 flex items-center gap-1">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'} <Sun size={10} />
                                </span>
                              )}
                              {isPeriodClosedDinner && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20 flex items-center gap-1">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'} <Moon size={10} />
                                </span>
                              )}
                              {isAreaManual && !isAreaClosed && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-yellow-500 text-yellow-950 px-1.5 py-0.5 rounded shadow-xs border border-white/20">
                                  {language === 'pt' ? 'MANUAL' : 'MANUAL'}
                                </span>
                              )}
                              {area.sessionMode && area.sessionMode !== 'both' && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-white/25 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/10">
                                  {area.sessionMode === 'lunch'
                                    ? (language === 'pt' ? 'Apenas Almoço' : 'Lunch Only')
                                    : (language === 'pt' ? 'Apenas Jantar' : 'Dinner Only')}
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] bg-gray-700 text-white px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ml-2 shadow-sm border border-gray-600">
                              {areaTables.length}
                            </span>
                          </div>
                          <div className="space-y-1.5 pl-0.5">
                            {areaTables.map(t => renderTableItemInSidebar(t))}
                          </div>
                        </div>
                      );
                    })}

                    {(() => {
                      const unassignedTables = tables
                        .filter(t => !t.areaId || !areas.some(a => a.id === t.areaId))
                        .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                      if (unassignedTables.length === 0) return null;

                      return (
                        <div className="space-y-1.5">
                          <div className="sticky top-0 z-10 py-1.5 px-2.5 bg-gray-600 rounded-lg flex items-center justify-between shadow-sm text-white">
                            <span className="font-extrabold text-[10px] uppercase tracking-wider text-white bg-gray-700/80 px-2 py-0.5 rounded shadow-sm border border-gray-600/50">
                              {language === 'pt' ? 'Sem Área Atribuída' : 'Unassigned Area'}
                            </span>
                            <span className="text-[9px] bg-white/25 text-white px-1.5 py-0.5 rounded-full font-bold">
                              {unassignedTables.length}
                            </span>
                          </div>
                          <div className="space-y-1.5 pl-0.5">
                            {unassignedTables.map(t => renderTableItemInSidebar(t))}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* Dedicated Print-Only Table Summary (Optimized for A4 Multiple Pages) */}
      <div className="print-only hidden print:block mt-6">
        <div className="flex items-center justify-between mb-3 border-b border-gray-300 pb-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-900">
            {language === 'pt' ? 'Resumo de Mesas & Capacidades' : 'Tables & Capacity Overview'}
          </h2>
          <span className="text-xs font-semibold text-gray-600">
            {tables.length} {language === 'pt' ? 'mesas registadas' : 'registered tables'}
          </span>
        </div>

        <table className="w-full text-left text-xs border border-gray-300 rounded-lg overflow-hidden border-collapse">
          <thead>
            <tr className="bg-gray-100 border-b border-gray-300 text-gray-800 font-bold">
              <th className="py-2 px-3 border-r border-gray-300">{language === 'pt' ? 'Mesa' : 'Table'}</th>
              <th className="py-2 px-3 border-r border-gray-300 text-center">{language === 'pt' ? 'Lugares' : 'Seats'}</th>
              <th className="py-2 px-3 border-r border-gray-300">{language === 'pt' ? 'Área / Zona' : 'Area / Zone'}</th>
              <th className="py-2 px-3 border-r border-gray-300">{language === 'pt' ? 'Sessões Ativas' : 'Active Sessions'}</th>
              <th className="py-2 px-3 border-r border-gray-300">{language === 'pt' ? 'Tipo' : 'Type'}</th>
              <th className="py-2 px-3">{language === 'pt' ? 'Estado' : 'Status'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tables
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
              .map((table) => {
                const area = areas.find(a => a.id === table.areaId);
                return (
                  <tr key={table.id} className="even:bg-gray-50/70 page-break-avoid">
                    <td className="py-1.5 px-3 font-bold text-gray-900 border-r border-gray-200">
                      {table.name}
                    </td>
                    <td className="py-1.5 px-3 font-bold text-gray-800 border-r border-gray-200 text-center">
                      {table.seats} {language === 'pt' ? 'lugares' : 'pax'}
                    </td>
                    <td className="py-1.5 px-3 border-r border-gray-200">
                      <div className="flex items-center gap-1.5">
                        <span 
                          style={{ backgroundColor: area?.color || '#3B82F6' }}
                          className="w-2.5 h-2.5 rounded-full inline-block border border-gray-300"
                        />
                        <span className="font-semibold text-gray-800">
                          {area?.name || (language === 'pt' ? 'Principal' : 'Main')}
                        </span>
                      </div>
                    </td>
                    <td className="py-1.5 px-3 border-r border-gray-200 text-gray-700">
                      {table.activeSessions?.lunch !== false && table.activeSessions?.dinner !== false
                        ? (language === 'pt' ? 'Almoço & Jantar' : 'Lunch & Dinner')
                        : table.activeSessions?.lunch !== false
                        ? (language === 'pt' ? 'Apenas Almoço' : 'Lunch Only')
                        : table.activeSessions?.dinner !== false
                        ? (language === 'pt' ? 'Apenas Jantar' : 'Dinner Only')
                        : (language === 'pt' ? 'Inativa' : 'Inactive')}
                    </td>
                    <td className="py-1.5 px-3 border-r border-gray-200">
                      {table.isExtra ? (
                        <span className="font-extrabold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200 text-[10px] uppercase">
                          Extra
                        </span>
                      ) : (
                        <span className="text-gray-600">{language === 'pt' ? 'Padrão' : 'Standard'}</span>
                      )}
                    </td>
                    <td className="py-1.5 px-3 font-medium">
                      {table.isActive === false ? (
                        <span className="text-gray-500">{language === 'pt' ? 'Inativo' : 'Inactive'}</span>
                      ) : table.allowOnlineReservations === false ? (
                        <span className="text-amber-800 font-semibold">{language === 'pt' ? 'Manual' : 'Manual'}</span>
                      ) : (
                        <span className="text-emerald-700 font-semibold">{language === 'pt' ? 'Online' : 'Online'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {/* Add Table Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header with 100% full background */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between z-10 shrink-0 w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <Plus size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{t('tables.add')}</h3>
                  <p className="text-xs text-gray-500">{language === 'pt' ? 'Adicionar nova mesa ao restaurante' : 'Add new table to restaurant'}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddModal(false)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTable} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {/* Name, Guests, Area, and Status inputs in a grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.name')}</label>
                    <input 
                      required
                      type="text"
                      value={newTable.name}
                      onChange={(e) => setNewTable({ ...newTable, name: e.target.value })}
                      placeholder="e.g. T1"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.guests')}</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      value={newTable.seats}
                      onChange={(e) => setNewTable({ ...newTable, seats: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <CustomDropdown
                      label={t('common.status') || 'Status'}
                      value={newTable.status || 'available'}
                      onChange={(val) => setNewTable({ ...newTable, status: val as any })}
                      options={tableStatusOptions}
                    />
                  </div>
                  <div>
                    <CustomDropdown
                      label={language === 'pt' ? 'Área do Restaurante' : 'Restaurant Area'}
                      value={newTable.areaId || ''}
                      onChange={(val) => setNewTable({ ...newTable, areaId: val })}
                      options={areaOptions}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">{t('common.shape') || 'Shape'}</label>
                  <div className="flex gap-4">
                    {(['round', 'square', 'rectangle'] as TableShape[]).map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => setNewTable({ ...newTable, shape })}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer",
                          newTable.shape === shape 
                            ? "border-amber-600 bg-amber-50 text-amber-700 font-bold" 
                            : "border-gray-100 hover:border-gray-200 text-gray-400"
                        )}
                      >
                        {shape === 'round' && <Circle size={24} />}
                        {shape === 'square' && <Square size={24} />}
                        {shape === 'rectangle' && <RectangleHorizontal size={24} />}
                        <span className="text-xs">
                          {shape === 'round' ? t('common.round') : shape === 'square' ? t('common.square') : t('common.rectangle')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {t('common.rotation') || 'Rotation'}
                    </label>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {newTable.rotation || 0}°
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    {/* Controls taking 80% width */}
                    <div className="w-[80%] flex flex-col justify-center gap-2">
                      <div className="flex items-center gap-2.5">
                        <RotateCw size={18} className="text-gray-400 shrink-0" />
                        <input 
                          type="range"
                          min="0"
                          max="360"
                          value={newTable.rotation || 0}
                          onChange={(e) => setNewTable({ ...newTable, rotation: parseInt(e.target.value) || 0 })}
                          className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                        />
                      </div>
                      {/* Quick Angles */}
                      <div className="flex items-center justify-between gap-1">
                        {[0, 45, 90, 180, 270].map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() => setNewTable({ ...newTable, rotation: deg })}
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer",
                              (newTable.rotation || 0) === deg
                                ? "bg-amber-600 text-white shadow-xs"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300"
                            )}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 20% Width: Visual Preview of Desired Shape with Auto-Rotation */}
                    <div className="w-[20%] flex flex-col items-center justify-center p-1 bg-white border border-gray-200 rounded-xl shadow-xs min-h-[68px] overflow-hidden">
                      <div 
                        className="transition-transform duration-150 ease-out flex items-center justify-center"
                        style={{ transform: `rotate(${newTable.rotation || 0}deg)` }}
                      >
                        {newTable.shape === 'round' && (
                          <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-500 flex flex-col items-center justify-center text-amber-900 shadow-xs">
                            <span className="text-[10px] font-extrabold truncate max-w-[32px]">{newTable.name || 'T'}</span>
                            <div className="flex items-center gap-0.5 text-[8px] opacity-75">
                              <Users size={8} />
                              <span>{newTable.seats || 2}</span>
                            </div>
                          </div>
                        )}
                        {newTable.shape === 'square' && (
                          <div className="w-10 h-10 rounded-lg bg-amber-100 border-2 border-amber-500 flex flex-col items-center justify-center text-amber-900 shadow-xs">
                            <span className="text-[10px] font-extrabold truncate max-w-[32px]">{newTable.name || 'T'}</span>
                            <div className="flex items-center gap-0.5 text-[8px] opacity-75">
                              <Users size={8} />
                              <span>{newTable.seats || 2}</span>
                            </div>
                          </div>
                        )}
                        {newTable.shape === 'rectangle' && (
                          <div className="w-13 h-8 rounded-lg bg-amber-100 border-2 border-amber-500 flex flex-col items-center justify-center text-amber-900 shadow-xs">
                            <span className="text-[10px] font-extrabold truncate max-w-[38px]">{newTable.name || 'T'}</span>
                            <div className="flex items-center gap-0.5 text-[8px] opacity-75">
                              <Users size={8} />
                              <span>{newTable.seats || 2}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 space-y-3.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {language === 'pt' ? 'Configurações de Sessão & Disponibilidade' : 'Session & Availability Settings'}
                  </label>

                  {/* 1. Mesa Ativa / Table is active */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={newTable.isActive}
                          onChange={(e) => {
                            const isAct = e.target.checked;
                            setNewTable({ 
                              ...newTable, 
                              isActive: isAct,
                              activeSessions: isAct ? (newTable.activeSessions || { lunch: true, dinner: true }) : { lunch: false, dinner: false }
                            });
                          }}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-gray-800">{language === 'pt' ? 'Mesa Ativa' : 'Table is active'}</span>
                      </label>
                      {newTable.isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {newTable.activeSessions?.lunch && newTable.activeSessions?.dinner 
                            ? (language === 'pt' ? 'Ativa (Almoço & Jantar)' : 'Active (Both Sessions)')
                            : newTable.activeSessions?.lunch 
                              ? (language === 'pt' ? 'Ativa apenas no Almoço' : 'Active for Lunch only')
                              : newTable.activeSessions?.dinner 
                                ? (language === 'pt' ? 'Ativa apenas no Jantar' : 'Active for Dinner only')
                                : (language === 'pt' ? 'Inativa' : 'Inactive')}
                        </span>
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-4 pl-6 pt-0.5 transition-opacity",
                      !newTable.isActive && "opacity-40 pointer-events-none"
                    )}>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={!newTable.isActive}
                          checked={Boolean(newTable.isActive && (newTable.activeSessions?.lunch ?? true))}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setNewTable({
                              ...newTable,
                              activeSessions: {
                                lunch: val,
                                dinner: Boolean(newTable.activeSessions?.dinner ?? true)
                              },
                              ...(val === false ? {
                                extraSessions: {
                                  ...(newTable.extraSessions || { lunch: true, dinner: true }),
                                  lunch: false
                                },
                                onlineSessions: {
                                  ...(newTable.onlineSessions || { lunch: true, dinner: true }),
                                  lunch: false
                                }
                              } : {})
                            });
                          }}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <Sun size={13} className="text-amber-500 inline" />
                        <span>{language === 'pt' ? 'Almoço' : 'Lunch'}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={!newTable.isActive}
                          checked={Boolean(newTable.isActive && (newTable.activeSessions?.dinner ?? true))}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setNewTable({
                              ...newTable,
                              activeSessions: {
                                lunch: Boolean(newTable.activeSessions?.lunch ?? true),
                                dinner: val
                              },
                              ...(val === false ? {
                                extraSessions: {
                                  ...(newTable.extraSessions || { lunch: true, dinner: true }),
                                  dinner: false
                                },
                                onlineSessions: {
                                  ...(newTable.onlineSessions || { lunch: true, dinner: true }),
                                  dinner: false
                                }
                              } : {})
                            });
                          }}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <Moon size={13} className="text-indigo-500 inline" />
                        <span>{language === 'pt' ? 'Jantar' : 'Dinner'}</span>
                      </label>
                    </div>
                  </div>

                  {/* 2. Mesa Extra / Extra Table */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={newTable.isExtra}
                          onChange={(e) => {
                            const isExt = e.target.checked;
                            setNewTable({ 
                              ...newTable, 
                              isExtra: isExt,
                              extraSessions: isExt ? (newTable.extraSessions || { lunch: true, dinner: true }) : { lunch: false, dinner: false }
                            });
                          }}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-gray-800">
                          {language === 'pt' ? 'Mesa Extra' : 'Extra Table'}
                        </span>
                      </label>
                      {newTable.isExtra && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {newTable.extraSessions?.lunch && newTable.extraSessions?.dinner
                            ? (language === 'pt' ? 'Extra (Almoço & Jantar)' : 'Extra (Both Sessions)')
                            : newTable.extraSessions?.lunch
                              ? (language === 'pt' ? 'Extra apenas no Almoço' : 'Extra (Lunch only)')
                              : newTable.extraSessions?.dinner
                                ? (language === 'pt' ? 'Extra apenas no Jantar' : 'Extra (Dinner only)')
                                : (language === 'pt' ? 'Nenhuma sessão' : 'No session')}
                        </span>
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-4 pl-6 pt-0.5 transition-opacity",
                      !newTable.isExtra && "opacity-40 pointer-events-none"
                    )}>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={!newTable.isExtra || newTable.activeSessions?.lunch === false}
                          checked={Boolean(newTable.isExtra && (newTable.extraSessions?.lunch ?? true))}
                          onChange={(e) => setNewTable({
                            ...newTable,
                            extraSessions: {
                              lunch: e.target.checked,
                              dinner: Boolean(newTable.extraSessions?.dinner ?? true)
                            }
                          })}
                          className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <Sun size={13} className="text-amber-500 inline" />
                        <span>{language === 'pt' ? 'Disponível no Almoço' : 'Available for Lunch'}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={!newTable.isExtra || newTable.activeSessions?.dinner === false}
                          checked={Boolean(newTable.isExtra && (newTable.extraSessions?.dinner ?? true))}
                          onChange={(e) => setNewTable({
                            ...newTable,
                            extraSessions: {
                              lunch: Boolean(newTable.extraSessions?.lunch ?? true),
                              dinner: e.target.checked
                            }
                          })}
                          className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <Moon size={13} className="text-indigo-500 inline" />
                        <span>{language === 'pt' ? 'Disponível no Jantar' : 'Available for Dinner'}</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Permitir Reservas Online / Allow Online Reservations */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={newTable.allowOnlineReservations ?? true}
                          onChange={(e) => {
                            const isAllowed = e.target.checked;
                            setNewTable({ 
                              ...newTable, 
                              allowOnlineReservations: isAllowed,
                              onlineSessions: isAllowed ? (newTable.onlineSessions || { lunch: true, dinner: true }) : { lunch: false, dinner: false }
                            });
                          }}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-gray-800">{t('tables.allow_online')}</span>
                      </label>
                      {(newTable.allowOnlineReservations ?? true) ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {(newTable.onlineSessions?.lunch ?? true) && (newTable.onlineSessions?.dinner ?? true)
                            ? (language === 'pt' ? 'Online (Almoço & Jantar)' : 'Online (Both)')
                            : (newTable.onlineSessions?.lunch ?? true)
                              ? (language === 'pt' ? 'Online no Almoço' : 'Online Lunch')
                              : (newTable.onlineSessions?.dinner ?? true)
                                ? (language === 'pt' ? 'Online no Jantar' : 'Online Dinner')
                                : (language === 'pt' ? 'Apenas Manual' : 'Manual only')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {language === 'pt' ? 'Apenas Manual' : 'Manual only'}
                        </span>
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-4 pl-6 pt-0.5 transition-opacity",
                      newTable.allowOnlineReservations === false && "opacity-40 pointer-events-none"
                    )}>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={newTable.allowOnlineReservations === false || newTable.activeSessions?.lunch === false}
                          checked={Boolean((newTable.allowOnlineReservations ?? true) && (newTable.onlineSessions?.lunch ?? true))}
                          onChange={(e) => setNewTable({
                            ...newTable,
                            onlineSessions: {
                              lunch: e.target.checked,
                              dinner: Boolean(newTable.onlineSessions?.dinner ?? true)
                            }
                          })}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <Sun size={13} className="text-amber-500 inline" />
                        <span>{language === 'pt' ? 'Online no Almoço' : 'Online for Lunch'}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={newTable.allowOnlineReservations === false || newTable.activeSessions?.dinner === false}
                          checked={Boolean((newTable.allowOnlineReservations ?? true) && (newTable.onlineSessions?.dinner ?? true))}
                          onChange={(e) => setNewTable({
                            ...newTable,
                            onlineSessions: {
                              lunch: Boolean(newTable.onlineSessions?.lunch ?? true),
                              dinner: e.target.checked
                            }
                          })}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <Moon size={13} className="text-indigo-500 inline" />
                        <span>{language === 'pt' ? 'Online no Jantar' : 'Online for Dinner'}</span>
                      </label>
                    </div>
                  </div>
                </div>
                {newTable.isExtra ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        {language === 'pt' ? 'Data de Início' : 'Start Date'}
                      </label>
                      <input 
                        type="date"
                        lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                        placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                        value={newTable.extraStartDate || ''}
                        onChange={(e) => setNewTable({ ...newTable, extraStartDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        {language === 'pt' ? 'Data de Fim (Opcional)' : 'End Date (Optional)'}
                      </label>
                      <input 
                        type="date"
                        lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                        placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                        value={newTable.extraEndDate || ''}
                        onChange={(e) => setNewTable({ ...newTable, extraEndDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-gray-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      {language === 'pt' ? 'Disponível a partir da Data (Opcional)' : 'Available From Date (Optional)'}
                    </label>
                    <input 
                      type="date"
                      lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                      placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                      value={newTable.availableDate || ''}
                      onChange={(e) => setNewTable({ ...newTable, availableDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-gray-100"
                    />
                    <p className="text-[10px] text-gray-500">
                      {language === 'pt' ? "Se definido, a mesa só aparecerá nas reservas a partir desta data (dd/mm/aaaa)." : "If set, table will only appear in booking from this date onwards (dd/mm/yyyy)."}
                    </p>
                  </div>
                )}
              </div>

              {/* Fixed Bottom Save Button */}
              <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0 w-full">
                <button 
                  type="submit"
                  className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Table Modal */}
      {editingTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Modal Header with 100% full background */}
            <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center justify-between z-10 shrink-0 w-full">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-50 rounded-xl text-amber-600">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{t('tables.edit')}: {editingTable.name}</h3>
                  <p className="text-xs text-gray-500">{language === 'pt' ? 'Edite os detalhes, capacidade e localização da mesa' : 'Edit table details, capacity and location'}</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setEditingTable(null)} 
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleUpdateTable} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {/* Name, Guests, and Area inputs side by side */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.name')}</label>
                    <input 
                      required
                      type="text"
                      value={editingTable.name || ''}
                      onChange={(e) => setEditingTable({ ...editingTable, name: e.target.value })}
                      placeholder="e.g. T1"
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">{t('common.guests')}</label>
                    <input 
                      required
                      type="number"
                      min="1"
                      value={editingTable.seats || 2}
                      onChange={(e) => setEditingTable({ ...editingTable, seats: parseInt(e.target.value) || 1 })}
                      className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none text-sm font-medium text-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <CustomDropdown
                      label={language === 'pt' ? 'Área do Restaurante' : 'Restaurant Area'}
                      value={editingTable.areaId || ''}
                      onChange={(val) => setEditingTable({ ...editingTable, areaId: val })}
                      options={areaOptions}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">{t('common.shape') || 'Shape'}</label>
                  <div className="flex gap-4">
                    {(['round', 'square', 'rectangle'] as TableShape[]).map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() => setEditingTable({ ...editingTable, shape })}
                        className={cn(
                          "flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all cursor-pointer",
                          (editingTable.shape || 'square') === shape 
                            ? "border-amber-600 bg-amber-50 text-amber-700 font-bold" 
                            : "border-gray-100 hover:border-gray-200 text-gray-400"
                        )}
                      >
                        {shape === 'round' && <Circle size={24} />}
                        {shape === 'square' && <Square size={24} />}
                        {shape === 'rectangle' && <RectangleHorizontal size={24} />}
                        <span className="text-xs">
                          {shape === 'round' ? t('common.round') : shape === 'square' ? t('common.square') : t('common.rectangle')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {/* Decreased Status width to 33% */}
                <div className="w-full sm:w-[33%]">
                  <CustomDropdown
                    label={t('common.status') || 'Status'}
                    value={editingTable.status || 'available'}
                    onChange={(val) => setEditingTable({ ...editingTable, status: val as any })}
                    options={tableStatusOptions}
                  />
                </div>
                <div className="p-4 bg-gray-50/80 rounded-2xl border border-gray-200/80 space-y-3.5">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">
                    {language === 'pt' ? 'Configurações de Sessão & Disponibilidade' : 'Session & Availability Settings'}
                  </label>

                  {/* 1. Mesa Ativa / Table is active */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={editingTable.isActive ?? true}
                          onChange={(e) => {
                            const isAct = e.target.checked;
                            setEditingTable({ 
                              ...editingTable, 
                              isActive: isAct,
                              activeSessions: isAct 
                                ? (editingTable.activeSessions || { lunch: true, dinner: true }) 
                                : { lunch: false, dinner: false }
                            });
                          }}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-gray-800">{language === 'pt' ? 'Mesa Ativa' : 'Table is active'}</span>
                      </label>
                      {(editingTable.isActive ?? true) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {(editingTable.activeSessions?.lunch ?? true) && (editingTable.activeSessions?.dinner ?? true)
                            ? (language === 'pt' ? 'Ativa (Almoço & Jantar)' : 'Active (Both Sessions)')
                            : (editingTable.activeSessions?.lunch ?? true)
                              ? (language === 'pt' ? 'Ativa apenas no Almoço' : 'Active for Lunch only')
                              : (editingTable.activeSessions?.dinner ?? true)
                                ? (language === 'pt' ? 'Ativa apenas no Jantar' : 'Active for Dinner only')
                                : (language === 'pt' ? 'Inativa' : 'Inactive')}
                        </span>
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-4 pl-6 pt-0.5 transition-opacity",
                      editingTable.isActive === false && "opacity-40 pointer-events-none"
                    )}>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={editingTable.isActive === false}
                          checked={Boolean((editingTable.isActive ?? true) && (editingTable.activeSessions?.lunch ?? true))}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setEditingTable({
                              ...editingTable,
                              activeSessions: {
                                lunch: val,
                                dinner: Boolean(editingTable.activeSessions?.dinner ?? true)
                              },
                              ...(val === false ? {
                                extraSessions: {
                                  ...(editingTable.extraSessions || { lunch: true, dinner: true }),
                                  lunch: false
                                },
                                onlineSessions: {
                                  ...(editingTable.onlineSessions || { lunch: true, dinner: true }),
                                  lunch: false
                                }
                              } : {})
                            });
                          }}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <Sun size={13} className="text-amber-500 inline" />
                        <span>{language === 'pt' ? 'Almoço' : 'Lunch'}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={editingTable.isActive === false}
                          checked={Boolean((editingTable.isActive ?? true) && (editingTable.activeSessions?.dinner ?? true))}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setEditingTable({
                              ...editingTable,
                              activeSessions: {
                                lunch: Boolean(editingTable.activeSessions?.lunch ?? true),
                                dinner: val
                              },
                              ...(val === false ? {
                                extraSessions: {
                                  ...(editingTable.extraSessions || { lunch: true, dinner: true }),
                                  dinner: false
                                },
                                onlineSessions: {
                                  ...(editingTable.onlineSessions || { lunch: true, dinner: true }),
                                  dinner: false
                                }
                              } : {})
                            });
                          }}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <Moon size={13} className="text-indigo-500 inline" />
                        <span>{language === 'pt' ? 'Jantar' : 'Dinner'}</span>
                      </label>
                    </div>
                  </div>

                  {/* 2. Mesa Extra / Extra Table */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={editingTable.isExtra || false}
                          onChange={(e) => {
                            const isExt = e.target.checked;
                            setEditingTable({ 
                              ...editingTable, 
                              isExtra: isExt,
                              extraSessions: isExt 
                                ? (editingTable.extraSessions || { lunch: true, dinner: true }) 
                                : { lunch: false, dinner: false }
                            });
                          }}
                          className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-gray-800">
                          {language === 'pt' ? 'Mesa Extra' : 'Extra Table'}
                        </span>
                      </label>
                      {editingTable.isExtra && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {editingTable.extraSessions?.lunch && editingTable.extraSessions?.dinner
                            ? (language === 'pt' ? 'Extra (Almoço & Jantar)' : 'Extra (Both Sessions)')
                            : editingTable.extraSessions?.lunch
                              ? (language === 'pt' ? 'Extra apenas no Almoço' : 'Extra (Lunch only)')
                              : editingTable.extraSessions?.dinner
                                ? (language === 'pt' ? 'Extra apenas no Jantar' : 'Extra (Dinner only)')
                                : (language === 'pt' ? 'Nenhuma sessão' : 'No session')}
                        </span>
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-4 pl-6 pt-0.5 transition-opacity",
                      !editingTable.isExtra && "opacity-40 pointer-events-none"
                    )}>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={!editingTable.isExtra || editingTable.activeSessions?.lunch === false}
                          checked={Boolean(editingTable.isExtra && (editingTable.extraSessions?.lunch ?? true))}
                          onChange={(e) => setEditingTable({
                            ...editingTable,
                            extraSessions: {
                              lunch: e.target.checked,
                              dinner: Boolean(editingTable.extraSessions?.dinner ?? true)
                            }
                          })}
                          className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <Sun size={13} className="text-amber-500 inline" />
                        <span>{language === 'pt' ? 'Disponível no Almoço' : 'Available for Lunch'}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={!editingTable.isExtra || editingTable.activeSessions?.dinner === false}
                          checked={Boolean(editingTable.isExtra && (editingTable.extraSessions?.dinner ?? true))}
                          onChange={(e) => setEditingTable({
                            ...editingTable,
                            extraSessions: {
                              lunch: Boolean(editingTable.extraSessions?.lunch ?? true),
                              dinner: e.target.checked
                            }
                          })}
                          className="w-3.5 h-3.5 text-purple-600 rounded focus:ring-purple-500 cursor-pointer"
                        />
                        <Moon size={13} className="text-indigo-500 inline" />
                        <span>{language === 'pt' ? 'Disponível no Jantar' : 'Available for Dinner'}</span>
                      </label>
                    </div>
                  </div>

                  {/* 3. Permitir Reservas Online / Allow Online Reservations */}
                  <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input 
                          type="checkbox"
                          checked={editingTable.allowOnlineReservations ?? true}
                          onChange={(e) => {
                            const isAllowed = e.target.checked;
                            setEditingTable({ 
                              ...editingTable, 
                              allowOnlineReservations: isAllowed,
                              onlineSessions: isAllowed 
                                ? (editingTable.onlineSessions || { lunch: true, dinner: true }) 
                                : { lunch: false, dinner: false }
                            });
                          }}
                          className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-sm font-semibold text-gray-800">{t('tables.allow_online')}</span>
                      </label>
                      {(editingTable.allowOnlineReservations ?? true) ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {(editingTable.onlineSessions?.lunch ?? (editingTable.extraSessions?.lunch ?? true)) && (editingTable.onlineSessions?.dinner ?? (editingTable.extraSessions?.dinner ?? true))
                            ? (language === 'pt' ? 'Online (Almoço & Jantar)' : 'Online (Both)')
                            : (editingTable.onlineSessions?.lunch ?? (editingTable.extraSessions?.lunch ?? true))
                              ? (language === 'pt' ? 'Online no Almoço' : 'Online Lunch')
                              : (editingTable.onlineSessions?.dinner ?? (editingTable.extraSessions?.dinner ?? true))
                                ? (language === 'pt' ? 'Online no Jantar' : 'Online Dinner')
                                : (language === 'pt' ? 'Apenas Manual' : 'Manual only')}
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200">
                          {language === 'pt' ? 'Apenas Manual' : 'Manual only'}
                        </span>
                      )}
                    </div>

                    <div className={cn(
                      "flex items-center gap-4 pl-6 pt-0.5 transition-opacity",
                      editingTable.allowOnlineReservations === false && "opacity-40 pointer-events-none"
                    )}>
                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={editingTable.allowOnlineReservations === false || editingTable.activeSessions?.lunch === false}
                          checked={Boolean((editingTable.allowOnlineReservations ?? true) && (editingTable.onlineSessions?.lunch ?? (editingTable.extraSessions?.lunch ?? true)))}
                          onChange={(e) => setEditingTable({
                            ...editingTable,
                            onlineSessions: {
                              lunch: e.target.checked,
                              dinner: Boolean(editingTable.onlineSessions?.dinner ?? (editingTable.extraSessions?.dinner ?? true))
                            }
                          })}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <Sun size={13} className="text-amber-500 inline" />
                        <span>{language === 'pt' ? 'Online no Almoço' : 'Online for Lunch'}</span>
                      </label>

                      <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-gray-700 select-none">
                        <input 
                          type="checkbox"
                          disabled={editingTable.allowOnlineReservations === false || editingTable.activeSessions?.dinner === false}
                          checked={Boolean((editingTable.allowOnlineReservations ?? true) && (editingTable.onlineSessions?.dinner ?? (editingTable.extraSessions?.dinner ?? true)))}
                          onChange={(e) => setEditingTable({
                            ...editingTable,
                            onlineSessions: {
                              lunch: Boolean(editingTable.onlineSessions?.lunch ?? (editingTable.extraSessions?.lunch ?? true)),
                              dinner: e.target.checked
                            }
                          })}
                          className="w-3.5 h-3.5 text-amber-600 rounded focus:ring-amber-500 cursor-pointer disabled:cursor-not-allowed"
                        />
                        <Moon size={13} className="text-indigo-500 inline" />
                        <span>{language === 'pt' ? 'Online no Jantar' : 'Online for Dinner'}</span>
                      </label>
                    </div>
                  </div>
                </div>
                {editingTable.isExtra ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        {language === 'pt' ? 'Data de Início' : 'Start Date'}
                      </label>
                      <input 
                        type="date"
                        lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                        placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                        value={editingTable.extraStartDate || ''}
                        onChange={(e) => setEditingTable({ ...editingTable, extraStartDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-gray-100"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                        {language === 'pt' ? 'Data de Fim (Opcional)' : 'End Date (Optional)'}
                      </label>
                      <input 
                        type="date"
                        lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                        placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                        value={editingTable.extraEndDate || ''}
                        onChange={(e) => setEditingTable({ ...editingTable, extraEndDate: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-gray-100"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1">
                      {language === 'pt' ? 'Disponível a partir da Data (Opcional)' : 'Available From Date (Optional)'}
                    </label>
                    <input 
                      type="date"
                      lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                      placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                      value={editingTable.availableDate || ''}
                      onChange={(e) => setEditingTable({ ...editingTable, availableDate: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-sm bg-gray-100"
                    />
                    <p className="text-[10px] text-gray-500">
                      {language === 'pt' ? "Se definido, a mesa só aparecerá nas reservas a partir desta data (dd/mm/aaaa)." : "If set, table will only appear in booking from this date onwards (dd/mm/yyyy)."}
                    </p>
                  </div>
                )}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      {t('common.rotation') || 'Rotation'}
                    </label>
                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      {editingTable.rotation || 0}°
                    </span>
                  </div>
                  <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl">
                    {/* Controls taking 80% width */}
                    <div className="w-[80%] flex flex-col justify-center gap-2">
                      <div className="flex items-center gap-2.5">
                        <RotateCw size={18} className="text-gray-400 shrink-0" />
                        <input 
                          type="range"
                          min="0"
                          max="360"
                          value={editingTable.rotation || 0}
                          onChange={(e) => setEditingTable({ ...editingTable, rotation: parseInt(e.target.value) || 0 })}
                          className="flex-grow h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                        />
                      </div>
                      {/* Quick Angles */}
                      <div className="flex items-center justify-between gap-1">
                        {[0, 45, 90, 180, 270].map((deg) => (
                          <button
                            key={deg}
                            type="button"
                            onClick={() => setEditingTable({ ...editingTable, rotation: deg })}
                            className={cn(
                              "px-2 py-0.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer",
                              (editingTable.rotation || 0) === deg
                                ? "bg-amber-600 text-white shadow-xs"
                                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:border-gray-300"
                            )}
                          >
                            {deg}°
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 20% Width: Visual Preview of Desired Shape with Auto-Rotation */}
                    <div className="w-[20%] flex flex-col items-center justify-center p-1 bg-white border border-gray-200 rounded-xl shadow-xs min-h-[68px] overflow-hidden">
                      <div 
                        className="transition-transform duration-150 ease-out flex items-center justify-center"
                        style={{ transform: `rotate(${editingTable.rotation || 0}deg)` }}
                      >
                        {editingTable.shape === 'round' && (
                          <div className="w-10 h-10 rounded-full bg-amber-100 border-2 border-amber-500 flex flex-col items-center justify-center text-amber-900 shadow-xs">
                            <span className="text-[10px] font-extrabold truncate max-w-[32px]">{editingTable.name || 'T'}</span>
                            <div className="flex items-center gap-0.5 text-[8px] opacity-75">
                              <Users size={8} />
                              <span>{editingTable.seats || 2}</span>
                            </div>
                          </div>
                        )}
                        {editingTable.shape === 'square' && (
                          <div className="w-10 h-10 rounded-lg bg-amber-100 border-2 border-amber-500 flex flex-col items-center justify-center text-amber-900 shadow-xs">
                            <span className="text-[10px] font-extrabold truncate max-w-[32px]">{editingTable.name || 'T'}</span>
                            <div className="flex items-center gap-0.5 text-[8px] opacity-75">
                              <Users size={8} />
                              <span>{editingTable.seats || 2}</span>
                            </div>
                          </div>
                        )}
                        {editingTable.shape === 'rectangle' && (
                          <div className="w-13 h-8 rounded-lg bg-amber-100 border-2 border-amber-500 flex flex-col items-center justify-center text-amber-900 shadow-xs">
                            <span className="text-[10px] font-extrabold truncate max-w-[38px]">{editingTable.name || 'T'}</span>
                            <div className="flex items-center gap-0.5 text-[8px] opacity-75">
                              <Users size={8} />
                              <span>{editingTable.seats || 2}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Save Button */}
              <div className="px-6 py-4 bg-white border-t border-gray-100 shrink-0 w-full">
                <button 
                  type="submit"
                  className="w-full bg-amber-600 text-white py-3 rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-sm cursor-pointer"
                >
                  {t('common.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-xl font-bold mb-4">{t('tables.delete_title')}</h3>
            <p className="text-gray-600 mb-6">{t('tables.delete_confirm')}</p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={handleDeleteTable}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Area Delete Confirmation Modal */}
      {showAreaDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10010] p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl text-gray-900">
            <h3 className="text-xl font-bold mb-4">
              {language === 'pt' ? 'Eliminar Área' : 'Delete Area'}
            </h3>
            <p className="text-gray-600 text-sm mb-6">
              {language === 'pt' 
                ? 'Tem a certeza que deseja eliminar esta área? Todas as mesas associadas ficarão sem área atribuída.' 
                : 'Are you sure you want to delete this area? All associated tables will be unassigned.'}
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowAreaDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={executeDeleteArea}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
              >
                {t('common.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Areas Modal */}
      {showAreaModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white text-gray-900 rounded-2xl p-6 w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 sticky top-0 bg-white z-10 pb-2 border-b">
              <h3 className="text-xl font-bold">
                {language === 'pt' ? 'Gerir Áreas do Restaurante' : 'Manage Restaurant Areas'}
              </h3>
              <button 
                onClick={() => {
                  setShowAreaModal(false);
                  setEditingArea(null);
                }} 
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={24} />
              </button>
            </div>

            {/* List of existing areas */}
            <div className="space-y-3 mb-6">
              <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider">
                {language === 'pt' ? 'Áreas Existentes (Arraste para ordenar)' : 'Existing Areas (Drag to reorder)'} ({areas.length})
              </h4>
              {areas.length === 0 ? (
                <p className="text-sm text-gray-400 italic">
                  {language === 'pt' ? 'Nenhuma área criada ainda.' : 'No areas created yet.'}
                </p>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                  {sortedAreas.map((area, index) => (
                    <div 
                      key={area.id} 
                      draggable
                      onDragStart={(e) => handleDragStart(e, area.id)}
                      onDragOver={(e) => handleDragOver(e, index)}
                      onDrop={(e) => handleDrop(e, index)}
                      className={cn(
                        "p-3 bg-gray-50 rounded-xl border border-gray-100 flex items-center justify-between transition-all duration-200",
                        draggedAreaId === area.id ? "opacity-50 border-amber-300 bg-amber-50/20" : "hover:border-gray-300"
                      )}
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div 
                          className="cursor-grab active:cursor-grabbing p-1.5 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100 transition-colors"
                          title={language === 'pt' ? 'Arrastar para reordenar' : 'Drag to reorder'}
                        >
                          <GripVertical size={16} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span 
                              style={{ backgroundColor: area.color || '#3B82F6' }} 
                              className="w-3.5 h-3.5 rounded-full border border-white shadow-sm flex-shrink-0"
                            />
                            <p className="font-bold text-gray-800 truncate">{area.name}</p>
                          </div>
                          <div className="text-xs text-gray-500 space-y-0.5 mt-1.5">
                            {(!area.bookingMode || area.bookingMode === 'online') && (
                              <p className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-green-500" />
                                {language === 'pt' ? 'Reservas online & manuais' : 'Online & manual bookings'}
                              </p>
                            )}
                            {area.bookingMode === 'manual' && (
                              <p className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-yellow-500" />
                                <span className="text-yellow-700 font-medium">
                                  {language === 'pt' ? 'Apenas Reservas Manuais (Admins)' : 'Manual Bookings Only (Admins)'}
                                </span>
                              </p>
                            )}
                            {area.bookingMode === 'closed' && (
                              <p className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-500" />
                                <span className="text-red-700 font-medium">
                                  {language === 'pt' 
                                    ? `Fechado temporariamente: ${area.closedStartDate} a ${area.closedEndDate}` 
                                    : `Closed temporarily: ${area.closedStartDate} to ${area.closedEndDate}`}
                                </span>
                              </p>
                            )}
                            {area.bookingMode === 'permanently_closed' && (
                              <p className="flex items-center gap-1">
                                <span className="w-2 h-2 rounded-full bg-red-700 animate-pulse" />
                                <span className="text-red-900 font-extrabold uppercase text-[10px]">
                                  {language === 'pt' ? 'Fechado Permanentemente' : 'Permanently Closed'}
                                </span>
                              </p>
                            )}
                            <p className="text-[11px] text-amber-700 font-medium flex items-center gap-1">
                              <span>•</span>
                              <span>
                                {(!area.sessionMode || area.sessionMode === 'both') && (language === 'pt' ? 'Almoço & Jantar' : 'Lunch & Dinner')}
                                {area.sessionMode === 'lunch' && (language === 'pt' ? 'Apenas Almoço' : 'Only Lunch')}
                                {area.sessionMode === 'dinner' && (language === 'pt' ? 'Apenas Jantar' : 'Only Dinner')}
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingArea(area);
                            setEditingAreaName(area.name);
                            setEditingAreaBookingMode(area.bookingMode || (area.allowOnlineReservations !== false ? 'online' : 'manual'));
                            setEditingAreaClosedStartDate(area.closedStartDate || '');
                            setEditingAreaClosedEndDate(area.closedEndDate || '');
                            setEditingAreaSessionMode(area.sessionMode || 'both');
                            setEditingAreaClosedSessions(area.closedSessions || ['lunch', 'dinner']);
                            setEditingAreaColor(area.color || '#3B82F6');
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title={language === 'pt' ? 'Editar' : 'Edit'}
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteArea(area.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title={language === 'pt' ? 'Eliminar' : 'Delete'}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add / Edit Area Form */}
            <div className="border-t pt-6">
              <h4 className="font-bold text-sm text-gray-500 uppercase tracking-wider mb-4">
                {editingArea 
                  ? (language === 'pt' ? 'Editar Área' : 'Edit Area') 
                  : (language === 'pt' ? 'Criar Nova Área' : 'Create New Area')}
              </h4>
              <form onSubmit={editingArea ? handleUpdateAreaSubmit : handleAddArea} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {language === 'pt' ? 'Nome da Área' : 'Area Name'}
                  </label>
                  <input 
                    required
                    type="text"
                    value={editingArea ? editingAreaName : newAreaName}
                    onChange={(e) => editingArea ? setEditingAreaName(e.target.value) : setNewAreaName(e.target.value)}
                    placeholder="e.g. Esplanada, Sala Principal"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                  />
                </div>

                <div>
                  <CustomDropdown
                    label={language === 'pt' ? 'Opções de Reserva' : 'Booking Options'}
                    value={editingArea ? editingAreaBookingMode : newAreaBookingMode}
                    onChange={(val) => {
                      const v = val as 'online' | 'manual' | 'closed' | 'permanently_closed';
                      if (editingArea) {
                        setEditingAreaBookingMode(v);
                      } else {
                        setNewAreaBookingMode(v);
                      }
                    }}
                    options={bookingModeOptions}
                  />
                </div>

                <div>
                  <CustomDropdown
                    label={language === 'pt' ? 'Sessões Permitidas' : 'Allowed Sessions'}
                    value={editingArea ? editingAreaSessionMode : newAreaSessionMode}
                    onChange={(val) => {
                      const v = val as 'both' | 'lunch' | 'dinner';
                      if (editingArea) {
                        setEditingAreaSessionMode(v);
                      } else {
                        setNewAreaSessionMode(v);
                      }
                    }}
                    options={sessionModeOptions}
                  />
                </div>

                {((editingArea ? editingAreaBookingMode : newAreaBookingMode) === 'closed') && (
                  <div className="space-y-4 p-3 bg-red-50/50 rounded-xl border border-red-100">
                    <div className="grid grid-cols-2 gap-4">
                      
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        {language === 'pt' ? 'Data de Início' : 'Start Date'}
                      </label>
                      <input 
                        required
                        type="date"
                        lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                        placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                        value={editingArea ? editingAreaClosedStartDate : newAreaClosedStartDate}
                        onChange={(e) => editingArea ? setEditingAreaClosedStartDate(e.target.value) : setNewAreaClosedStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-gray-100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">
                        {language === 'pt' ? 'Data de Fim' : 'End Date'}
                      </label>
                      <input 
                        required
                        type="date"
                        lang={language === 'pt' ? 'pt-PT' : 'en-US'}
                        placeholder={language === 'pt' ? 'dd/mm/aaaa' : 'dd/mm/yyyy'}
                        value={editingArea ? editingAreaClosedEndDate : newAreaClosedEndDate}
                        onChange={(e) => editingArea ? setEditingAreaClosedEndDate(e.target.value) : setNewAreaClosedEndDate(e.target.value)}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-gray-100"
                      />
                    </div>
                  
                    </div>
                    <div className="border-t border-red-100 pt-3">
                      <label className="block text-xs font-semibold text-gray-600 mb-2">
                        {language === 'pt' ? 'Sessões Fechadas' : 'Closed Sessions'}
                      </label>
                      <div className="flex gap-4">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingArea ? editingAreaClosedSessions.includes('lunch') : newAreaClosedSessions.includes('lunch')}
                            onChange={(e) => {
                              if (editingArea) {
                                if (e.target.checked) setEditingAreaClosedSessions([...editingAreaClosedSessions, 'lunch']);
                                else setEditingAreaClosedSessions(editingAreaClosedSessions.filter(s => s !== 'lunch'));
                              } else {
                                if (e.target.checked) setNewAreaClosedSessions([...newAreaClosedSessions, 'lunch']);
                                else setNewAreaClosedSessions(newAreaClosedSessions.filter(s => s !== 'lunch'));
                              }
                            }}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
                          />
                          <span>{language === 'pt' ? 'Almoço' : 'Lunch'}</span>
                        </label>
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editingArea ? editingAreaClosedSessions.includes('dinner') : newAreaClosedSessions.includes('dinner')}
                            onChange={(e) => {
                              if (editingArea) {
                                if (e.target.checked) setEditingAreaClosedSessions([...editingAreaClosedSessions, 'dinner']);
                                else setEditingAreaClosedSessions(editingAreaClosedSessions.filter(s => s !== 'dinner'));
                              } else {
                                if (e.target.checked) setNewAreaClosedSessions([...newAreaClosedSessions, 'dinner']);
                                else setNewAreaClosedSessions(newAreaClosedSessions.filter(s => s !== 'dinner'));
                              }
                            }}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
                          />
                          <span>{language === 'pt' ? 'Jantar' : 'Dinner'}</span>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {language === 'pt' ? 'Cor do Badge da Área' : 'Area Badge Color'}
                  </label>
                  <div className="flex flex-wrap items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100">
                    {[
                      '#3B82F6', // Blue
                      '#10B981', // Green
                      '#8B5CF6', // Purple
                      '#EF4444', // Red
                      '#F59E0B', // Orange
                      '#EC4899', // Pink
                      '#6366F1', // Indigo
                      '#64748B'  // Slate
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => editingArea ? setEditingAreaColor(c) : setNewAreaColor(c)}
                        style={{ backgroundColor: c }}
                        className={cn(
                          "w-8 h-8 rounded-lg border-2 shadow-sm transition-all relative cursor-pointer active:scale-95 hover:scale-105",
                          (editingArea ? editingAreaColor : newAreaColor) === c 
                            ? "border-black scale-110 ring-2 ring-amber-400" 
                            : "border-white"
                        )}
                        title={c}
                      >
                        {(editingArea ? editingAreaColor : newAreaColor) === c && (
                          <span className="absolute inset-0 flex items-center justify-center text-white font-bold text-sm drop-shadow">✓</span>
                        )}
                      </button>
                    ))}
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-xs text-gray-500 font-medium">{language === 'pt' ? 'Personalizar:' : 'Custom:'}</span>
                      <input 
                        type="color"
                        value={editingArea ? editingAreaColor : newAreaColor}
                        onChange={(e) => editingArea ? setEditingAreaColor(e.target.value) : setNewAreaColor(e.target.value)}
                        className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  {editingArea && (
                    <button
                      type="button"
                      onClick={() => setEditingArea(null)}
                      className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                    >
                      {t('common.cancel')}
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="flex-1 bg-amber-600 text-white py-2.5 rounded-xl font-bold hover:bg-amber-700 transition-colors"
                  >
                    {editingArea 
                      ? (language === 'pt' ? 'Salvar Alterações' : 'Save Changes') 
                      : (language === 'pt' ? 'Adicionar Área' : 'Add Area')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen Floor Plan Modal */}
      <AnimatePresence>
        {isFullscreen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "fixed inset-0 z-[9990] flex flex-col p-4 md:p-6 overflow-hidden transition-colors duration-300",
              fullscreenTheme === 'dark' ? "bg-gray-950 text-white" : "bg-white text-gray-900"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4 flex-shrink-0">
              <div className="flex items-center gap-3">
                <h3 className={cn(
                  "text-xl md:text-2xl font-extrabold flex items-center gap-2",
                  fullscreenTheme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <Move className="text-amber-600 animate-pulse" size={24} />
                  <span>
                    {t('tables.editor')} 
                    {selectedSession === 'lunch' && ` - ${t('common.lunch')}`}
                    {selectedSession === 'dinner' && ` - ${t('common.dinner')}`}
                    {selectedSession === 'default' && ` - ${t('tables.default_layout')}`}
                  </span>
                </h3>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Session Selector in Fullscreen */}
                <div className={cn(
                  "flex items-center gap-1.5 p-1 rounded-xl border",
                  fullscreenTheme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-gray-100 border-gray-200"
                )}>
                  <button
                    onClick={() => setSelectedSession('default')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      selectedSession === 'default' 
                        ? (fullscreenTheme === 'dark' ? "bg-gray-800 text-amber-400" : "bg-white text-amber-700 shadow-sm") 
                        : "text-gray-500 hover:text-amber-600"
                    )}
                  >
                    {t('tables.default_layout') || "Default"}
                  </button>
                  <button
                    onClick={() => setSelectedSession('lunch')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      selectedSession === 'lunch' 
                        ? (fullscreenTheme === 'dark' ? "bg-gray-800 text-amber-400" : "bg-white text-amber-700 shadow-sm") 
                        : "text-gray-500 hover:text-amber-600"
                    )}
                  >
                    {t('common.lunch') || "Lunch"}
                  </button>
                  <button
                    onClick={() => setSelectedSession('dinner')}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      selectedSession === 'dinner' 
                        ? (fullscreenTheme === 'dark' ? "bg-gray-800 text-amber-400" : "bg-white text-amber-700 shadow-sm") 
                        : "text-gray-500 hover:text-amber-600"
                    )}
                  >
                    {t('common.dinner') || "Dinner"}
                  </button>
                </div>

                {/* Table Metrics Pill Widget in Fullscreen */}
                <div className={cn(
                  "hidden xl:flex items-center rounded-xl border shadow-2xs divide-x transition-colors duration-300 py-0.5 px-0.5 mr-1",
                  fullscreenTheme === 'dark' ? "bg-gray-900 border-gray-800 divide-gray-800" : "bg-gray-100 border-gray-200 divide-gray-200"
                )}>
                  {/* Total Tables */}
                  <div className="flex flex-col items-center px-2 py-0.5 min-w-[48px]" title={language === 'pt' ? 'Total de Mesas' : 'Total Tables'}>
                    <span className={cn(
                      "w-full text-center text-[8px] font-bold uppercase tracking-wider leading-none mb-0.5",
                      fullscreenTheme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' ? 'Total' : 'Total'}
                    </span>
                    <div className="w-full flex items-center justify-center gap-1">
                      <div className={cn("w-1/2 flex items-center justify-end", fullscreenTheme === 'dark' ? "text-white" : "text-gray-900")}>
                        <MdTableRestaurant size={13} />
                      </div>
                      <div className={cn("w-1/2 flex items-center justify-start text-xs font-black leading-none", fullscreenTheme === 'dark' ? "text-white" : "text-gray-900")}>
                        {tables.length}
                      </div>
                    </div>
                  </div>

                  {/* Active Tables */}
                  <div className="flex flex-col items-center px-2 py-0.5 min-w-[48px]" title={language === 'pt' ? 'Mesas Ativas' : 'Active Tables'}>
                    <span className="w-full text-center text-[8px] font-bold uppercase tracking-wider leading-none mb-0.5 text-green-600 dark:text-green-400">
                      {language === 'pt' ? 'Ativas' : 'Active'}
                    </span>
                    <div className="w-full flex items-center justify-center gap-1">
                      <div className="w-1/2 flex items-center justify-end text-green-600 dark:text-green-400">
                        <MdTableRestaurant size={13} />
                      </div>
                      <div className="w-1/2 flex items-center justify-start text-xs font-black leading-none text-green-600 dark:text-green-400">
                        {tables.filter(t => t.isActive !== false).length}
                      </div>
                    </div>
                  </div>

                  {/* Inactive Tables */}
                  <div className="flex flex-col items-center px-2 py-0.5 min-w-[48px]" title={language === 'pt' ? 'Mesas Inativas' : 'Inactive Tables'}>
                    <span className="w-full text-center text-[8px] font-bold uppercase tracking-wider leading-none mb-0.5 text-gray-400 dark:text-gray-500">
                      {language === 'pt' ? 'Inativas' : 'Inactive'}
                    </span>
                    <div className="w-full flex items-center justify-center gap-1">
                      <div className="w-1/2 flex items-center justify-end text-gray-400 dark:text-gray-500">
                        <MdTableRestaurant size={13} />
                      </div>
                      <div className="w-1/2 flex items-center justify-start text-xs font-black leading-none text-gray-400 dark:text-gray-500">
                        {tables.filter(t => t.isActive === false).length}
                      </div>
                    </div>
                  </div>

                  {/* Extra Tables */}
                  <div className="flex flex-col items-center px-2 py-0.5 min-w-[48px]" title={language === 'pt' ? 'Mesas Extra' : 'Extra Tables'}>
                    <span className="w-full text-center text-[8px] font-bold uppercase tracking-wider leading-none mb-0.5 text-purple-600 dark:text-purple-400">
                      {language === 'pt' ? 'Extra' : 'Extra'}
                    </span>
                    <div className="w-full flex items-center justify-center gap-1">
                      <div className="w-1/2 flex items-center justify-end text-purple-600 dark:text-purple-400">
                        <MdTableRestaurant size={13} />
                      </div>
                      <div className="w-1/2 flex items-center justify-start text-xs font-black leading-none text-purple-600 dark:text-purple-400">
                        {tables.filter(t => t.isExtra).length}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar toggle */}
                <button
                  onClick={() => setShowFullscreenSidebar(prev => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm border",
                    fullscreenTheme === 'dark'
                      ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-amber-400"
                      : "bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600"
                  )}
                  title={showFullscreenSidebar ? "Hide Tables List" : "Show Tables List"}
                >
                  {showFullscreenSidebar ? <EyeOff size={14} /> : <Eye size={14} />}
                  {showFullscreenSidebar ? (language === "pt" ? "Ocultar Mesas" : "Hide Tables") : (language === "pt" ? "Mostrar Mesas" : "Show Tables")}
                  
                </button>

                {/* Print Button - Icon Only */}
                <button
                  type="button"
                  onClick={handlePrint}
                  className={cn(
                    "p-1.5 flex items-center justify-center text-xs font-bold rounded-lg transition-colors shadow-sm border no-print cursor-pointer",
                    fullscreenTheme === 'dark' 
                       ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300" 
                       : "bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600"
                  )}
                  title={language === 'pt' ? 'Imprimir Planta de Mesas (A4)' : 'Print Floor Plan (A4)'}
                >
                  <Printer size={14} />
                </button>
                {/* Theme Toggle */}
                <button
                  onClick={() => setFullscreenTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm border no-print",
                    fullscreenTheme === 'dark' 
                      ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-yellow-400" 
                      : "bg-gray-100 hover:bg-gray-200 border-gray-200 text-gray-600"
                  )}
                  title={fullscreenTheme === 'dark' ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                  {fullscreenTheme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
                </button>

                {/* Exit Fullscreen */}
                <button
                  onClick={() => { setIsFullscreen(false); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors shadow-sm border no-print",
                    fullscreenTheme === "dark" ? "bg-gray-800 hover:bg-gray-700 border-gray-700 text-gray-300" : "bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
                  )}
                  title={t('common.exit')}
                >
                  <Minimize2 size={14} />
                </button>
              </div>
            </div>

            {/* Main Workspace */}
            <div className="flex-grow w-full flex flex-col lg:flex-row overflow-hidden gap-6">
              {/* Left Portion for Floor Plan */}
              <div className={cn(
                "flex-grow overflow-auto h-full rounded-3xl border relative shadow-inner transition-all duration-300 ease-in-out floor-plan-scroll-container",
                fullscreenTheme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200",
                showFullscreenSidebar ? "flex-1 w-full" : "flex-1 w-full"
              )}>
                <div 
                  ref={fullscreenContainerRef}
                  className={cn(
                    "relative min-w-[1000px] h-full floor-plan-canvas-scaler",
                    settings?.showFloorPlanBg !== false ? "" : "bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px]"
                  )}
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

                  {tables.map((table) => (
                    <DraggableTable 
                      key={table.id}
                      table={table}
                      areas={areas}
                      isAdmin={isAdmin}
                      onDrag={handleDrag}
                      onEdit={(t) => setEditingTable({
                        ...t,
                        extraStartDate: t.extraStartDate || t.availableDate || ''
                      })}
                      onDelete={(id) => setShowDeleteConfirm(id)}
                      containerWidth={fullscreenDimensions.width}
                      containerHeight={fullscreenDimensions.height}
                      session={selectedSession}
                    />
                  ))}

                  {tables.length === 0 && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                      <Move size={48} className="mb-4 opacity-20" />
                      <p>{t('res.no_tables')}</p>
                      {isAdmin && <p className="text-sm">{t('res.add_table_hint')}</p>}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Portion for Table List */}
              <div className={cn(
                  "flex-shrink-0 overflow-hidden h-full transition-all duration-500 ease-in-out no-print",
                  showFullscreenSidebar ? "w-full lg:w-[450px] opacity-100" : "w-0 opacity-0 lg:w-0 border-none",
                  fullscreenTheme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  <div className={cn("w-full lg:w-[450px] p-4 rounded-2xl border h-full overflow-y-auto custom-scrollbar", fullscreenTheme === 'dark' ? "bg-gray-900/50 border-gray-800" : "bg-white border-gray-100")}>
                    <h4 className="font-bold text-lg mb-4 flex items-center justify-between">
                      <span>{t('nav.tables')} ({tables.length})</span>
                      {isAdmin && (
                        <div className="flex gap-2">
                          <button 
                            onClick={() => setShowAreaModal(true)}
                            className="p-1.5 bg-gray-600 text-white hover:bg-gray-700 rounded-lg shadow-sm"
                            title={language === 'pt' ? 'Gerir Áreas' : 'Manage Areas'}
                          >
                            <Plus size={14} />
                          </button>
                          <button 
                            onClick={() => setShowAddModal(true)}
                            className="p-1.5 bg-amber-600 text-white hover:bg-amber-700 rounded-lg shadow-sm"
                            title={t('tables.add')}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </h4>

                    <div className="space-y-4 max-h-[calc(100vh-250px)] overflow-y-auto pr-1 custom-scrollbar">
                      {(() => {
                        const sortedAreas = [...areas].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                        
                        const renderTableItem = (table: Table) => {
                          const tableArea = areas.find(a => a.id === table.areaId);
                          const isTableManual = table.allowOnlineReservations === false;
                          const isInactive = table.isActive === false;
                          const isManual = tableArea?.bookingMode === 'manual' || isTableManual;
                          const isClosed = !isTableManual && ((tableArea?.allowOnlineReservations === false && tableArea?.bookingMode !== 'manual') || tableArea?.bookingMode === 'closed' || tableArea?.bookingMode === 'permanently_closed');
                          const isDark = fullscreenTheme === 'dark';

                          return (
                            <div 
                              key={table.id} 
                              className={cn(
                                "relative p-3 rounded-xl border flex flex-col gap-2 transition-all group overflow-hidden",
                                isInactive
                                  ? (isDark 
                                      ? "bg-gray-900/60 border-gray-800 text-gray-500 opacity-60" 
                                      : "bg-gray-100/80 border-gray-200 text-gray-500 opacity-60")
                                  : isClosed 
                                    ? (isDark 
                                        ? "bg-red-950/20 border-red-900/50 hover:bg-red-900/30 hover:border-red-800 text-red-200" 
                                        : "bg-red-50 border-red-200 hover:bg-red-100/70 hover:border-red-300 text-gray-900")
                                    : isManual
                                      ? (isDark
                                          ? "bg-yellow-950/20 border-yellow-900/50 hover:bg-yellow-900/30 hover:border-yellow-800 text-yellow-200"
                                          : "bg-yellow-50 border-yellow-200 hover:bg-yellow-100/70 hover:border-yellow-300 text-yellow-950")
                                      : (isDark 
                                          ? "bg-gray-800/50 border-gray-800 hover:bg-amber-950/20 hover:border-amber-900/30 text-white" 
                                          : "bg-gray-50 border-gray-100 hover:bg-amber-50 hover:border-amber-200 text-gray-900")
                              )}
                            >
                              <div className="flex items-start">
                                <div className={cn(
                                  "min-w-[42px] px-1.5 h-8 rounded-lg flex items-center justify-center text-xs font-bold border mr-3 whitespace-nowrap flex-shrink-0 mt-0.5",
                                  isInactive ? (isDark ? "bg-gray-800 text-gray-300 border-gray-700" : "bg-gray-700 text-white border-gray-600") :
                                  table.status === 'available' 
                                    ? (isDark ? "bg-green-950/40 text-green-400 border-green-900/50" : "bg-green-100 text-green-700 border-green-200") 
                                    : table.status === 'reserved' 
                                      ? (isDark ? "bg-amber-950/40 text-amber-400 border-amber-900/50" : "bg-amber-100 text-amber-700 border-amber-200") 
                                      : (isDark ? "bg-red-950/40 text-red-400 border-red-900/50" : "bg-red-100 text-red-700 border-red-200")
                                )}>
                                  {table.name}
                                </div>
                                <div className="flex-1 min-w-0 pr-12">
                                  <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                                    {table.isExtra && (
                                      <span className="text-[8px] bg-purple-100 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-300 dark:border-purple-800/50 px-1 py-0.5 rounded font-extrabold uppercase flex items-center gap-0.5">
                                        Extra
                                        {(table.extraSessions?.lunch ?? true) && table.extraSessions?.dinner === false && <Sun size={8} className="text-amber-500" />}
                                        {table.extraSessions?.lunch === false && (table.extraSessions?.dinner ?? true) && <Moon size={8} className="text-indigo-400" />}
                                      </span>
                                    )}
                                    {table.isActive === false ? (
                                      <span className="text-[8px] bg-gray-700 dark:bg-gray-800 text-white border border-gray-600 dark:border-gray-700 px-1 py-0.5 rounded font-bold uppercase">
                                        {language === 'pt' ? 'Inativo' : 'Inactive'}
                                      </span>
                                    ) : !table.isExtra ? (
                                      <>
                                        {table.activeSessions?.lunch === false && (table.activeSessions?.dinner ?? true) && (
                                          <span className="text-[8px] bg-gray-700 dark:bg-gray-800 text-white border border-gray-600 dark:border-gray-700 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                            Off <Sun size={8} className="text-amber-400" />
                                          </span>
                                        )}
                                        {(table.activeSessions?.lunch ?? true) && table.activeSessions?.dinner === false && (
                                          <span className="text-[8px] bg-gray-700 dark:bg-gray-800 text-white border border-gray-600 dark:border-gray-700 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                            Off <Moon size={8} className="text-indigo-300" />
                                          </span>
                                        )}
                                      </>
                                    ) : null}
                                    {table.allowOnlineReservations === false ? (
                                      <span className="text-[8px] bg-yellow-100 dark:bg-yellow-950/40 text-yellow-800 dark:text-yellow-300 px-1 py-0.5 rounded font-bold uppercase">
                                        {language === 'pt' ? 'Manual' : 'Manual'}
                                      </span>
                                    ) : (
                                      <>
                                        {table.onlineSessions?.lunch === false && (table.onlineSessions?.dinner ?? true) && (
                                          <span className="text-[8px] bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                            Online <Moon size={8} className="text-indigo-400" />
                                          </span>
                                        )}
                                        {(table.onlineSessions?.lunch ?? true) && table.onlineSessions?.dinner === false && (
                                          <span className="text-[8px] bg-blue-100 dark:bg-blue-950/40 text-blue-800 dark:text-blue-300 px-1 py-0.5 rounded font-bold uppercase flex items-center gap-0.5">
                                            Online <Sun size={8} className="text-amber-500" />
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1.5 flex-wrap mt-1">
                                    <span className="flex items-center gap-0.5">
                                      <Users size={10} className="inline" />
                                      <span>{table.seats}</span>
                                    </span>
                                    {table.areaId && (() => {
                                      return (
                                        <span 
                                          style={{
                                            backgroundColor: tableArea?.color || '#3B82F6',
                                          }}
                                          className="w-2.5 h-2.5 rounded-full inline-block border border-white/20 shadow-xs flex-shrink-0 ml-1"
                                          title={tableArea?.name || ''}
                                        />
                                      );
                                    })()}
                                  </div>
                                </div>
                              </div>

                              {table.availableDate && (
                                <div className="w-full text-[10px] text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 py-1.5 px-2 rounded flex justify-center font-medium mt-1">
                                  {table.isExtra 
                                    ? (language === 'pt' ? `Apenas ${table.availableDate}` : `Only ${table.availableDate}`) 
                                    : (language === 'pt' ? `A partir de ${table.availableDate}` : `From ${table.availableDate}`)}
                                </div>
                              )}

                              <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button 
                                  onClick={() => setEditingTable({
                                    ...table,
                                    extraStartDate: table.extraStartDate || table.availableDate || ''
                                  })}
                                  className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
                                >
                                  <Edit2 size={12} />
                                </button>
                                <button 
                                  onClick={() => setShowDeleteConfirm(table.id)}
                                  className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-md transition-colors"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </div>
                            </div>
                          );
                        };

                        return (
                          <div className="space-y-4">
                            {sortedAreas.map(area => {
                              const areaTables = tables
                                .filter(t => t.areaId === area.id)
                                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                              if (areaTables.length === 0) return null;

                              const isAreaManual = area.bookingMode === 'manual';
                      const isAreaPermanentlyClosed = !isAreaManual && (area.bookingMode === 'permanently_closed' || (area.allowOnlineReservations === false && area.bookingMode !== 'closed'));
                      const isAreaPeriodClosed = !isAreaManual && area.bookingMode === 'closed';
                      const areaClosedSessions = area.closedSessions || ['lunch', 'dinner'];
                      const isPeriodClosedBoth = isAreaPeriodClosed && areaClosedSessions.includes('lunch') && areaClosedSessions.includes('dinner');
                      const isPeriodClosedLunch = isAreaPeriodClosed && areaClosedSessions.includes('lunch') && !areaClosedSessions.includes('dinner');
                      const isPeriodClosedDinner = isAreaPeriodClosed && areaClosedSessions.includes('dinner') && !areaClosedSessions.includes('lunch');
                      const isAreaClosed = !isAreaManual && (isAreaPermanentlyClosed || isPeriodClosedBoth);

                              return (
                                <div key={area.id} className="space-y-1.5">
                                  <div 
                                    style={{ backgroundColor: area.color || '#3B82F6' }}
                                    className="sticky top-0 z-10 py-1.5 px-2.5 rounded-lg flex items-center justify-between shadow-sm text-white"
                                  >
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-extrabold text-[10px] uppercase tracking-wider text-white bg-gray-700/80 px-2 py-0.5 rounded shadow-sm border border-gray-600/50">
                                        {area.name}
                                      </span>
                                      {isAreaPermanentlyClosed && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'}
                                </span>
                              )}
                              {isPeriodClosedBoth && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20 flex items-center gap-1">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'} <Sun size={10} /><Moon size={10} />
                                </span>
                              )}
                              {isPeriodClosedLunch && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20 flex items-center gap-1">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'} <Sun size={10} />
                                </span>
                              )}
                              {isPeriodClosedDinner && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-red-600/90 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/20 flex items-center gap-1">
                                  {language === 'pt' ? 'FECHADA' : 'CLOSED'} <Moon size={10} />
                                </span>
                              )}
                                      {isAreaManual && !isAreaClosed && (
                                        <span className="text-[8px] font-black uppercase tracking-wider bg-yellow-500 text-yellow-950 px-1.5 py-0.5 rounded shadow-xs border border-white/20">
                                          {language === 'pt' ? 'MANUAL' : 'MANUAL'}
                                        </span>
                                      )}
                                      {area.sessionMode && area.sessionMode !== 'both' && (
                                        <span className="text-[8px] font-black uppercase tracking-wider bg-white/25 text-white px-1.5 py-0.5 rounded shadow-xs border border-white/10">
                                          {area.sessionMode === 'lunch'
                                            ? (language === 'pt' ? 'Apenas Almoço' : 'Lunch Only')
                                            : (language === 'pt' ? 'Apenas Jantar' : 'Dinner Only')}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs bg-gray-700 text-white px-2 py-0.5 rounded-full font-bold flex-shrink-0 ml-2 shadow-sm border border-gray-600">
                                      {areaTables.length}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pl-0.5">
                                    {areaTables.map(t => renderTableItem(t))}
                                  </div>
                                </div>
                              );
                            })}

                            {(() => {
                              const unassignedTables = tables
                                .filter(t => !t.areaId || !areas.some(a => a.id === t.areaId))
                                .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

                              if (unassignedTables.length === 0) return null;

                              return (
                                <div className="space-y-1.5">
                                  <div className="sticky top-0 z-10 py-1.5 px-2.5 bg-gray-600 rounded-lg flex items-center justify-between shadow-sm text-white">
                                    <span className="font-extrabold text-[10px] uppercase tracking-wider text-white bg-gray-700/80 px-2 py-0.5 rounded shadow-sm border border-gray-600/50">
                                      {language === 'pt' ? 'Sem Área Atribuída' : 'Unassigned Area'}
                                    </span>
                                    <span className="text-[9px] bg-white/25 text-white px-1.5 py-0.5 rounded-full font-bold">
                                      {unassignedTables.length}
                                    </span>
                                  </div>
                                  <div className="space-y-1.5 pl-0.5">
                                    {unassignedTables.map(t => renderTableItem(t))}
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
