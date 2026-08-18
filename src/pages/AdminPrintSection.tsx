import { formatDisplayTime, getOptimizedUrl, getReservationTableDisplay } from '../lib/utils';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useReservations } from '../hooks/useReservations';
import { useTables } from '../hooks/useTables';
import { useSettings } from '../hooks/useSettings';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../hooks/useLanguage';
import { format, parseISO } from 'date-fns';
import { ArrowLeft, Printer, FileText, Share2, Check, Lock, Unlock, AlertCircle, Eye, EyeOff, Download, Link, Sun, Moon, Palette } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { triggerPrint } from '../utils/printUtils';

interface AdminPrintSectionProps {
  isPublicShared?: boolean;
}

// Helper to format date in European Portuguese (pt-PT) or English
const formatPtDate = (dateStr: string, lang: string) => {
  if (!dateStr) return '';
  try {
    const d = parseISO(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    if (lang === 'pt') {
      const daysPt = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
      const monthsPt = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
      const dayOfWeek = daysPt[d.getDay()];
      const day = d.getDate();
      const month = monthsPt[d.getMonth()];
      const year = d.getFullYear();
      return `${dayOfWeek}, ${day} de ${month} de ${year}`;
    }
    return format(d, 'EEEE, d MMMM yyyy');
  } catch {
    return dateStr;
  }
};

// Helper to get detailed, accurate status text and styling matching main Reservations page
const getStatusInfo = (res: any, lang: string) => {
  const status = res.status;
  const isWaitlist = res.isWaitlist || status === 'waiting-list' || status === 'waitlist';

  if (isWaitlist) {
    return {
      label: lang === 'pt' ? 'Lista de Espera' : 'Waiting List',
      badgeColor: 'bg-gray-100 text-gray-700 border-gray-200',
      isCancelled: false,
    };
  }

  switch (status) {
    case 'pending':
      return {
        label: lang === 'pt' ? 'Pendente' : 'Pending',
        badgeColor: 'bg-amber-100 text-amber-700 border-amber-200',
        isCancelled: false,
      };
    case 'booked':
      return {
        label: lang === 'pt' ? 'Reservada' : 'Booked',
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        isCancelled: false,
      };
    case 'confirmed':
      return {
        label: lang === 'pt' ? 'Confirmada' : 'Confirmed',
        badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        isCancelled: false,
      };
    case 'arrived':
    case 'seated':
      return {
        label: lang === 'pt' ? 'Já Chegou' : 'Already In',
        badgeColor: 'bg-emerald-600 text-white border-emerald-600 font-bold',
        isCancelled: false,
      };
    case 'completed':
      return {
        label: lang === 'pt' ? 'Concluída' : 'Completed',
        badgeColor: 'bg-yellow-400 text-yellow-950 border-yellow-500 font-bold',
        isCancelled: false,
      };
    case 'cancelled':
      return {
        label: lang === 'pt' ? 'Cancelada' : 'Cancelled',
        badgeColor: 'bg-red-500 text-white border-red-600 font-bold',
        isCancelled: true,
      };
    case 'no-show':
      return {
        label: lang === 'pt' ? 'Não Compareceu' : 'No Show',
        badgeColor: 'bg-gray-500 text-white border-gray-600 font-bold',
        isCancelled: true,
      };
    case 'delayed':
      return {
        label: lang === 'pt' ? 'Atrasada' : 'Delayed',
        badgeColor: 'bg-orange-100 text-orange-700 border-orange-200 font-bold',
        isCancelled: false,
      };
    case 'blocked':
      return {
        label: lang === 'pt' ? 'Bloqueada' : 'Blocked',
        badgeColor: 'bg-gray-200 text-gray-800 border-gray-300 font-bold',
        isCancelled: false,
      };
    default:
      return {
        label: status ? String(status) : (lang === 'pt' ? 'Reservada' : 'Booked'),
        badgeColor: 'bg-blue-100 text-blue-700 border-blue-200',
        isCancelled: false,
      };
  }
};

// Helper to convert image URL to Base64 for native jsPDF embedding
const getBase64ImageFromUrl = async (imageUrl: string): Promise<string | null> => {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl, { mode: 'cors' });
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'Anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } else {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = imageUrl;
    });
  }
};

export default function AdminPrintSection({ isPublicShared = false }: AdminPrintSectionProps) {
  const documentRef = useRef<HTMLDivElement>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { settings, loading: settingsLoading } = useSettings();
  const { user, isStaff } = useAuth();
  const { areas, tables, loading: tablesLoading } = useTables();
  
  // URL params or defaults
  const queryDate = searchParams.get('date') || format(new Date(), 'yyyy-MM-dd');
  const querySection = searchParams.get('section') || (areas && areas[0] ? areas[0].id : '');
  const queryService = searchParams.get('service') || 'all';
  const queryShowCancelled = searchParams.get('includeCancelled') === 'true';
  const isDocumentMode = searchParams.get('mode') === 'document' || isPublicShared;

  const [date, setDate] = useState(queryDate);
  const [section, setSection] = useState(querySection);
  const [service, setService] = useState(queryService);
  const [includeCancelled, setIncludeCancelled] = useState(queryShowCancelled);

  const [copied, setCopied] = useState(false);
  const [passInput, setPassInput] = useState('');
  const [passError, setPassError] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  // PDF generation, color mode and share states
  const [pdfColorMode, setPdfColorMode] = useState<'color' | 'bw'>('color');
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSharingPdf, setIsSharingPdf] = useState(false);
  const [shareNotice, setShareNotice] = useState<{
    type: 'success' | 'fallback' | 'error';
    message: string;
    fileName?: string;
  } | null>(null);

  const logoUrl = useMemo(() => {
    return getOptimizedUrl(settings?.logoUrl, settings, 'logo');
  }, [settings]);

  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
    if (!logoUrl) {
      setLogoBase64(null);
      return;
    }
    if (logoUrl.startsWith('data:')) {
      setLogoBase64(logoUrl);
      return;
    }
    let isMounted = true;
    const loadBase64 = async () => {
      try {
        const res = await fetch(logoUrl, { mode: 'cors' });
        if (!res.ok) throw new Error('Fetch failed');
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          if (isMounted && typeof reader.result === 'string') {
            setLogoBase64(reader.result);
          }
        };
        reader.readAsDataURL(blob);
      } catch {
        if (isMounted) setLogoBase64(null);
      }
    };
    loadBase64();
    return () => { isMounted = false; };
  }, [logoUrl]);

  const displayLogoSrc = logoBase64 || logoUrl;

  // Determine required PDF password from Settings (using appUnlockPin or pdfPassword)
  const requiredPdfPassword = useMemo(() => {
    if (settings?.protectPdfWithPassword) {
      return (settings?.appUnlockPin || settings?.pdfPassword || '').trim();
    }
    return '';
  }, [settings?.protectPdfWithPassword, settings?.appUnlockPin, settings?.pdfPassword]);

  // Determine if PDF Password is required to unlock web view
  const passRequired = useMemo(() => {
    if (!requiredPdfPassword) return false;
    if (isPublicShared) {
      const sessionKey = `pdf_unlocked_${requiredPdfPassword}`;
      return sessionStorage.getItem(sessionKey) !== 'true';
    }
    if (isStaff || user?.role === 'admin') return false;

    const sessionKey = `pdf_unlocked_${requiredPdfPassword}`;
    return sessionStorage.getItem(sessionKey) !== 'true';
  }, [requiredPdfPassword, isStaff, user, isPublicShared, isUnlocked]);

  const handlePassUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (requiredPdfPassword && passInput.trim() === requiredPdfPassword) {
      const sessionKey = `pdf_unlocked_${requiredPdfPassword}`;
      sessionStorage.setItem(sessionKey, 'true');
      setIsUnlocked(true);
      setPassError(false);
    } else {
      setPassError(true);
      setTimeout(() => setPassError(false), 3000);
    }
  };

  const { reservations, loading: resLoading } = useReservations({ startDate: date, endDate: date });

  // Auto-trigger print dialog if autoPrint URL param is set and pass requirement is satisfied
  useEffect(() => {
    if (isDocumentMode && !passRequired && !resLoading && !tablesLoading && !settingsLoading && searchParams.get('autoPrint') === 'true') {
      const timer = setTimeout(() => {
        triggerPrint(settings?.name ? `${settings.name} - ${date}` : 'Reservas');
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDocumentMode, passRequired, resLoading, tablesLoading, settingsLoading, searchParams, settings?.name, date]);

  const filteredReservations = useMemo(() => {
    return reservations.filter(res => {
      // Date match
      if (res.date !== date) return false;
      
      // Status match
      if (!includeCancelled && (res.status === 'cancelled' || res.status === 'no-show')) return false;

      // Section match
      if (section && section !== 'all') {
        const table = tables.find(t => t.id === res.tableId);
        if (table && table.areaId !== section) return false;
      }

      // Service match
      if (service && service !== 'all') {
        const dayName = format(parseISO(date), 'EEEE');
        const monthDay = date.substring(5);
        const specialDay = settings?.specialDays?.[date] || settings?.recurringSpecialDays?.[monthDay];
        const dayHours = settings?.openingHours?.[dayName];
        
        const lunch = specialDay ? specialDay.lunch : dayHours?.lunch;
        const dinner = specialDay ? specialDay.dinner : dayHours?.dinner;

        if (service === 'lunch' && lunch?.active) {
          if (res.time < lunch.open || res.time > lunch.close) return false;
        } else if (service === 'dinner' && dinner?.active) {
          if (res.time < dinner.open || res.time > dinner.close) return false;
        }
      }

      return true;
    }).sort((a, b) => a.time.localeCompare(b.time));
  }, [reservations, date, section, service, includeCancelled, tables, settings]);

  // Helper to determine if a reservation belongs to Lunch or Dinner
  const isLunchReservation = (res: any) => {
    if (res.manualSession === 'lunch' || res.session === 'lunch') return true;
    if (res.manualSession === 'dinner' || res.session === 'dinner') return false;

    const dayName = format(parseISO(date), 'EEEE');
    const monthDay = date.substring(5);
    const specialDay = settings?.specialDays?.[date] || settings?.recurringSpecialDays?.[monthDay];
    const dayHours = settings?.openingHours?.[dayName];
    
    const lunch = specialDay ? specialDay.lunch : dayHours?.lunch;
    const dinner = specialDay ? specialDay.dinner : dayHours?.dinner;

    if (lunch?.active && lunch.close && res.time <= lunch.close) {
      return true;
    }
    if (dinner?.active && dinner.open && res.time >= dinner.open) {
      return false;
    }

    // Fallback cutoff at 16:30
    return res.time < '16:30';
  };

  const lunchReservations = useMemo(() => {
    return filteredReservations.filter(res => isLunchReservation(res));
  }, [filteredReservations, date, settings]);

  const dinnerReservations = useMemo(() => {
    return filteredReservations.filter(res => !isLunchReservation(res));
  }, [filteredReservations, date, settings]);

  const totalGuests = filteredReservations.reduce((sum, res) => sum + (res.guests || 0), 0);
  const lunchGuests = useMemo(() => lunchReservations.reduce((sum, res) => sum + (res.guests || 0), 0), [lunchReservations]);
  const dinnerGuests = useMemo(() => dinnerReservations.reduce((sum, res) => sum + (res.guests || 0), 0), [dinnerReservations]);
  
  const sectionCapacity = useMemo(() => {
    if (section === 'all') {
      return tables.reduce((sum, t) => sum + (t.seats || 0), 0);
    }
    return tables.filter(t => t.areaId === section).reduce((sum, t) => sum + (t.seats || 0), 0);
  }, [section, tables]);

  const occupancyPercentage = useMemo(() => {
    if (!sectionCapacity || sectionCapacity === 0) return 0;
    return Math.round((totalGuests / sectionCapacity) * 100);
  }, [totalGuests, sectionCapacity]);

  const lunchOccupancyPercentage = useMemo(() => {
    if (!sectionCapacity || sectionCapacity === 0) return 0;
    return Math.round((lunchGuests / sectionCapacity) * 100);
  }, [lunchGuests, sectionCapacity]);

  const dinnerOccupancyPercentage = useMemo(() => {
    if (!sectionCapacity || sectionCapacity === 0) return 0;
    return Math.round((dinnerGuests / sectionCapacity) * 100);
  }, [dinnerGuests, sectionCapacity]);

  const sectionName = areas.find(a => a.id === section)?.name || (language === 'pt' ? 'Todas as Áreas' : 'All Areas');

  // Helper to build sanitized, descriptive PDF filename
  const sanitizeFilename = (str: string) => {
    return (str || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const getPdfFilename = () => {
    const restName = sanitizeFilename(settings?.name || 'Restaurant');
    const secName = sanitizeFilename(sectionName || 'Section');
    const servName = sanitizeFilename(service === 'all' ? (language === 'pt' ? 'Todos' : 'All') : service);
    return `${restName}-${secName}-Reservations-${date}-${servName}.pdf`;
  };

  // Fallback native jsPDF document generator if html2canvas fails
  const createPdfWithJsPdfNative = (pdf: jsPDF) => {
    const margin = 15;
    let y = 20;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(18);
    pdf.setTextColor(20, 20, 20);
    pdf.text((settings?.name || 'RESTAURANT').toUpperCase(), margin, y);

    pdf.setFontSize(10);
    pdf.setTextColor(120, 120, 120);
    pdf.text((settings?.name || 'RESTAURANT').toUpperCase(), 195, y, { align: 'right' });
    y += 8;

    pdf.setFontSize(12);
    pdf.setTextColor(217, 119, 6);
    pdf.text(`${language === 'pt' ? 'RESERVAS DE ' : 'RESERVATIONS — '}${sectionName.toUpperCase()}`, margin, y);
    y += 7;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(80, 80, 80);
    pdf.text(formatPtDate(date, language), margin, y);
    y += 5;

    const serviceLabel = service === 'all' 
      ? (language === 'pt' ? 'Todos os Serviços (Almoço & Jantar)' : 'All Services (Lunch & Dinner)') 
      : (service === 'lunch' ? (language === 'pt' ? 'Almoço' : 'Lunch') : (language === 'pt' ? 'Jantar' : 'Dinner'));
    pdf.text(serviceLabel, margin, y);
    y += 8;

    pdf.setDrawColor(200, 200, 200);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, 210 - margin, y);
    y += 8;

    const renderPdfTable = (resList: typeof filteredReservations, title?: string) => {
      if (title) {
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.setTextColor(217, 119, 6);
        pdf.text(title.toUpperCase(), margin, y);
        y += 6;
      }

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8);
      pdf.setTextColor(80, 80, 80);
      
      pdf.text(language === 'pt' ? 'Hora' : 'Time', margin, y);
      pdf.text(language === 'pt' ? 'Pax' : 'Pax', margin + 18, y);
      pdf.text(language === 'pt' ? 'Cliente' : 'Customer', margin + 30, y);
      pdf.text(language === 'pt' ? 'Mesa' : 'Table', margin + 82, y);
      pdf.text(language === 'pt' ? 'Estado' : 'Status', margin + 102, y);
      pdf.text(language === 'pt' ? 'Verif' : 'Verified', margin + 130, y);
      pdf.text(language === 'pt' ? 'Nota' : 'Note', margin + 155, y);
      pdf.text('In', margin + 182, y);
      
      y += 3;
      pdf.setDrawColor(180, 180, 180);
      pdf.line(margin, y, 210 - margin, y);
      y += 5;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8.5);

      if (resList.length === 0) {
        pdf.setTextColor(150, 150, 150);
        pdf.text(language === 'pt' ? 'Nenhuma reserva neste período.' : 'No reservations for this period.', margin, y);
        y += 8;
        return;
      }

      resList.forEach((res) => {
        if (y > 270) {
          pdf.addPage();
          y = 20;
        }

        const tableName = getReservationTableDisplay(res, tables, language as any, settings);
        const statusInfo = getStatusInfo(res, language);

        const timeStr = formatDisplayTime(res.time, settings);
        const paxStr = String(res.guests || 0);
        const nameStr = (res.customerName || '').substring(0, 24);
        const tableStr = tableName.substring(0, 10);
        const statusStr = statusInfo.label;
        const verifStr = res.verifyTableNumber ? (language === 'pt' ? '⚠ Verificar' : '⚠ Verify') : '✓';
        const noteStr = (res.notes || '-').substring(0, 16);

        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(0, 0, 0);
        pdf.text(timeStr, margin, y);
        
        pdf.setFont('helvetica', 'normal');
        pdf.text(paxStr, margin + 18, y);
        pdf.text(nameStr, margin + 30, y);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(180, 80, 0);
        pdf.text(tableStr, margin + 82, y);

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(50, 50, 50);
        pdf.text(statusStr, margin + 102, y);

        pdf.setTextColor(res.verifyTableNumber ? 200 : 100, 100, 100);
        pdf.text(verifStr, margin + 130, y);
        pdf.setTextColor(100, 100, 100);
        pdf.text(noteStr, margin + 155, y);

        pdf.setDrawColor(120, 120, 120);
        pdf.setLineWidth(0.3);
        pdf.rect(margin + 182, y - 3.2, 3.5, 3.5);

        y += 6.5;
      });
      y += 4;
    };

    if (service === 'all') {
      renderPdfTable(lunchReservations, language === 'pt' ? 'Almoço' : 'Lunch');
      renderPdfTable(dinnerReservations, language === 'pt' ? 'Jantar' : 'Dinner');
    } else {
      renderPdfTable(filteredReservations);
    }

    if (y > 250) {
      pdf.addPage();
      y = 20;
    }
    y += 2;
    pdf.setDrawColor(0, 0, 0);
    pdf.setLineWidth(0.5);
    pdf.line(margin, y, 210 - margin, y);
    y += 7;

    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(50, 50, 50);
    pdf.text(`${language === 'pt' ? 'Reservas:' : 'Reservations:'} ${filteredReservations.length}`, margin, y);
    pdf.text(`${language === 'pt' ? 'Pessoas:' : 'Guests:'} ${totalGuests}`, margin + 32, y);
    pdf.text(`${language === 'pt' ? 'Capacidade:' : 'Capacity:'} ${sectionCapacity}`, margin + 65, y);
    pdf.text(`${language === 'pt' ? 'Ocup. Total:' : 'Total Occup.:'} ${occupancyPercentage}%`, margin + 100, y);
    pdf.text(`${language === 'pt' ? 'Almoço:' : 'Lunch:'} ${lunchOccupancyPercentage}%`, margin + 135, y);
    pdf.text(`${language === 'pt' ? 'Jantar:' : 'Dinner:'} ${dinnerOccupancyPercentage}%`, margin + 162, y);

    return pdf;
  };

  // Core PDF Creation Engine: captures the exact Preview DOM element as the single source of truth
  const createPdfDocument = async () => {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    // Apply native PDF file password encryption if enabled in settings
    const activePdfPassword = settings?.appUnlockPin || settings?.pdfPassword;
    if (settings?.protectPdfWithPassword && activePdfPassword) {
      try {
        if (typeof (pdf as any).setEncryption === 'function') {
          (pdf as any).setEncryption({
            userPassword: activePdfPassword,
            ownerPassword: activePdfPassword,
            userPermissions: ['print', 'modify', 'copy']
          });
        }
      } catch (encErr) {
        console.warn('PDF Encryption plugin not active:', encErr);
      }
    }

    if (!documentRef.current) {
      return createPdfWithJsPdfNative(pdf);
    }

    try {
      // Capture the exact preview DOM element
      const canvas = await html2canvas(documentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: '#ffffff',
        scrollX: 0,
        scrollY: 0,
        windowWidth: documentRef.current.scrollWidth,
        windowHeight: documentRef.current.scrollHeight,
        imageTimeout: 10000,
        onclone: (clonedDoc) => {
          const clonedSheet = clonedDoc.querySelector('.print-sheet') as HTMLElement;
          if (clonedSheet) {
            clonedSheet.style.boxShadow = 'none';
            clonedSheet.style.borderRadius = '0';
            clonedSheet.style.margin = '0';
            clonedSheet.style.width = '210mm';
            clonedSheet.style.minHeight = '297mm';
            clonedSheet.style.backgroundColor = '#ffffff';
          }
        }
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdfWidth = 210; // A4 width in mm
      const pdfPageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
      heightLeft -= pdfPageHeight;

      while (heightLeft >= 2) {
        position -= pdfPageHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight, undefined, 'FAST');
        heightLeft -= pdfPageHeight;
      }

      return pdf;
    } catch (canvasErr) {
      console.warn('html2canvas rendering error, falling back to native jsPDF layout:', canvasErr);
      return createPdfWithJsPdfNative(pdf);
    }
  };

  // Action 1: Prepare PDF Document notice bar (No automatic window download popup)
  const handleGeneratePdf = async () => {
    try {
      setIsGeneratingPdf(true);
      setShareNotice({
        type: 'success',
        message: language === 'pt' 
          ? 'Documento PDF pronto! Utilize os botões na barra verde para Guardar Ficheiro, Abrir, Imprimir, Partilhar ou Alternar Cor (Colorido / P&B).' 
          : 'PDF document ready! Use the buttons in the green bar to Save File, Open, Print, Share or Toggle Color (Color / B&W).',
      });
    } catch (err) {
      console.error('Failed to prepare PDF:', err);
      setShareNotice({
        type: 'error',
        message: language === 'pt' ? 'Erro ao preparar o documento PDF.' : 'Failed to prepare PDF document.'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Action 1b: Save/Download PDF File to Local Machine (Triggered ONLY when user clicks "Guardar PDF" in the green nav bar)
  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);
      const pdf = await createPdfDocument();
      const filename = getPdfFilename();
      pdf.save(filename);
      setShareNotice({
        type: 'success',
        message: language === 'pt' 
          ? `Ficheiro PDF "${filename}" guardado com sucesso no seu computador!` 
          : `PDF file "${filename}" saved successfully to your computer!`,
      });
    } catch (err) {
      console.error('Failed to save PDF:', err);
      setShareNotice({
        type: 'error',
        message: language === 'pt' ? 'Erro ao guardar o ficheiro PDF.' : 'Failed to save PDF file.'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Action 2: Print Document Directly
  const handlePrint = () => {
    triggerPrint(settings?.name ? `${settings.name} - ${date}` : 'Reservas');
  };

  // Action 3: Open PDF in Browser Tab (Handles popup blockers reliably)
  const handleOpenPdf = async () => {
    const newWindow = window.open('about:blank', '_blank');
    if (newWindow) {
      newWindow.document.write(`
        <html>
          <head><title>Generating PDF...</title></head>
          <body style="font-family: system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f9fafb; color: #374151;">
            <div style="text-align: center;">
              <div style="border: 3px solid #e5e7eb; border-top-color: #d97706; border-radius: 50%; width: 36px; height: 36px; animation: spin 1s linear infinite; margin: 0 auto 16px;"></div>
              <p style="font-weight: 600; font-size: 16px; margin: 0;">${language === 'pt' ? 'A gerar documento PDF...' : 'Generating PDF document...'}</p>
            </div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
          </body>
        </html>
      `);
    }

    try {
      setIsGeneratingPdf(true);
      setShareNotice(null);
      const pdf = await createPdfDocument();
      const pdfBlob = pdf.output('blob');
      const blobUrl = URL.createObjectURL(pdfBlob);

      if (newWindow && !newWindow.closed) {
        newWindow.location.href = blobUrl;
      } else {
        pdf.save(getPdfFilename());
      }

      setShareNotice({
        type: 'success',
        message: language === 'pt' 
          ? 'PDF gerado e aberto num novo separador.' 
          : 'PDF generated and opened in a new tab.',
      });
    } catch (err) {
      if (newWindow && !newWindow.closed) {
        newWindow.close();
      }
      console.error('Failed to open PDF:', err);
      setShareNotice({
        type: 'error',
        message: language === 'pt' ? 'Erro ao abrir o ficheiro PDF.' : 'Failed to open PDF file.'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Action 4: Share Protected PDF Link (Prompts for password set in Settings)
  const handleSharePdf = async () => {
    try {
      setIsSharingPdf(true);
      setShareNotice(null);
      const shareUrl = `${window.location.origin}/print/shared-pdf?mode=document&date=${date}&section=${section}&service=${service}&includeCancelled=${includeCancelled}`;

      if (navigator.share) {
        await navigator.share({
          title: `${settings?.name || 'Restaurant'} - ${sectionName}`,
          text: `${language === 'pt' ? 'Reservas de' : 'Reservations for'} ${sectionName} (${date})`,
          url: shareUrl,
        });
        setShareNotice({
          type: 'success',
          message: language === 'pt' 
            ? 'Link do PDF partilhado! Quem abrir o link precisará da palavra-passe configurada nas Definições.' 
            : 'PDF link shared! Whoever opens the link will need the password configured in Settings.'
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
        setShareNotice({
          type: 'success',
          message: language === 'pt' 
            ? 'Link do PDF copiado! Quem abrir o link precisará da palavra-passe configurada nas Definições.' 
            : 'PDF link copied! Whoever opens the link will need the password configured in Settings.'
        });
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        const shareUrl = `${window.location.origin}/print/shared-pdf?mode=document&date=${date}&section=${section}&service=${service}&includeCancelled=${includeCancelled}`;
        try {
          await navigator.clipboard.writeText(shareUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 3000);
          setShareNotice({
            type: 'success',
            message: language === 'pt' 
              ? 'Link do PDF copiado! Quem abrir o link precisará da palavra-passe configurada nas Definições.' 
              : 'PDF link copied! Whoever opens the link will need the password configured in Settings.'
          });
        } catch (clipErr) {
          prompt(language === 'pt' ? 'Copie este link:' : 'Copy this link:', shareUrl);
        }
      }
    } finally {
      setIsSharingPdf(false);
    }
  };

  // Helper to render a reservation table block with related colors
  const renderReservationTableBlock = (resList: typeof filteredReservations, title?: string, icon?: React.ReactNode, accentColorClass?: string) => {
    if (resList.length === 0 && service === 'all') {
      return (
        <div className="mb-6 relative z-10">
          {title && (
            <div className={`mb-2 flex items-center justify-between pb-1 border-b-2 ${accentColorClass || 'border-amber-600 text-amber-900'}`}>
              <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                {icon}
                {title}
              </h3>
              <span className="text-[11px] text-gray-500 font-medium">0 reservas</span>
            </div>
          )}
          <p className="text-xs text-gray-400 italic py-2 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
            {language === 'pt' ? 'Nenhuma reserva neste período.' : 'No reservations for this period.'}
          </p>
        </div>
      );
    }

    const periodPax = resList.reduce((sum, r) => sum + (r.guests || 0), 0);

    return (
      <div className="mb-6 relative z-10">
        {title && (
          <div className={`mb-2.5 flex items-center justify-between pb-1.5 border-b-2 ${accentColorClass || 'border-amber-600 text-amber-900'}`}>
            <h3 className="font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
              {icon}
              {title}
            </h3>
            <div className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-800">
              {resList.length} {language === 'pt' ? 'reservas' : 'reservations'} • {periodPax} pax
            </div>
          </div>
        )}

        <table className="w-full text-left text-xs reservation-table border-collapse table-fixed">
          <thead>
            <tr className="border-b-2 font-bold text-[11px] uppercase tracking-wider border-gray-800 bg-gray-50/90 text-gray-700">
              <th className="py-2 px-1.5 w-[11%] text-left">{language === 'pt' ? 'Hora' : 'Time'}</th>
              <th className="py-2 px-1 w-[7%] text-center">{language === 'pt' ? 'Pax' : 'Pax'}</th>
              <th className="py-2 px-1.5 w-[26%] text-left">{language === 'pt' ? 'Cliente' : 'Customer'}</th>
              <th className="py-2 px-1 w-[10%] text-center">{language === 'pt' ? 'Mesa' : 'Table'}</th>
              <th className="py-2 px-1 w-[16%] text-center">{language === 'pt' ? 'Estado' : 'Status'}</th>
              <th className="py-2 px-1 w-[16%] text-center">{language === 'pt' ? 'Verif' : 'Verified'}</th>
              <th className="py-2 px-1.5 w-[18%] text-left">{language === 'pt' ? 'Nota' : 'Note'}</th>
              <th className="py-2 px-1 w-[6%] text-center">In</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 text-gray-900">
            {resList.map(res => {
              const tableName = getReservationTableDisplay(res, tables, language as any, settings);
              const statusInfo = getStatusInfo(res, language);
              const isCancelled = statusInfo.isCancelled;

              return (
                <tr key={res.id} className={`reservation-row ${isCancelled ? 'bg-red-50/40 text-gray-400 line-through decoration-gray-400' : 'hover:bg-gray-50/50'}`}>
                  <td className="py-2 px-1.5 font-bold text-gray-900 whitespace-nowrap">{formatDisplayTime(res.time, settings)}</td>
                  <td className="py-2 px-1 text-center font-bold text-gray-900">{res.guests}</td>
                  <td className="py-2 px-1.5 font-semibold text-gray-900 truncate">{res.customerName}</td>
                  <td className="py-2 px-1 text-center font-bold rounded text-amber-900 bg-amber-50/70 whitespace-nowrap">{tableName}</td>
                  <td className="py-2 px-1 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border whitespace-nowrap ${statusInfo.badgeColor}`}>
                      {statusInfo.label}
                    </span>
                  </td>
                  <td className="py-2 px-1 text-center">
                    {res.verifyTableNumber ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border bg-amber-100 text-amber-900 border-amber-300 whitespace-nowrap">
                        ⚠ {language === 'pt' ? 'Verificar' : 'Verify'}
                      </span>
                    ) : (
                      <span className="text-emerald-600 font-bold">✓</span>
                    )}
                  </td>
                  <td className="py-2 px-1.5 text-gray-600 text-xs truncate">
                    {res.notes || '-'}
                  </td>
                  <td className="py-2 px-1 text-center align-middle">
                    <div className="w-4 h-4 border-2 border-gray-400 rounded-sm mx-auto bg-white"></div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  if (settingsLoading || tablesLoading) {
    return <div className="p-8 text-center text-gray-500 font-medium">{language === 'pt' ? 'A carregar...' : 'Loading...'}</div>;
  }

  // Set default section if empty
  if (!section && areas.length > 0) {
    setSection(areas[0].id);
  }

  // Password Protection Overlay for Unauthenticated Users opening PDF links
  if (passRequired && !isUnlocked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-4 no-print">
        <div className="w-full max-w-md bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl text-center">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-amber-500/20">
            <Lock size={32} />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            {language === 'pt' ? 'Documento PDF Protegido' : 'Protected PDF Document'}
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            {language === 'pt'
              ? 'Por favor, introduza a Pass. de Desbloqueio da App (Auto-Lock & PDF) configurada para visualizar este documento.'
              : 'Please enter the App Unlock Pass (Auto-Lock & PDF) to view this document.'}
          </p>

          <form onSubmit={handlePassUnlock} className="space-y-4">
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={passInput}
                onChange={(e) => setPassInput(e.target.value)}
                placeholder={language === 'pt' ? 'Palavra-passe de desbloqueio...' : 'Unlock password...'}
                className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-xl focus:ring-2 focus:ring-amber-500 outline-none text-center font-semibold tracking-wider placeholder-gray-500"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 cursor-pointer"
              >
                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {passError && (
              <p className="text-xs text-red-400 font-medium flex items-center justify-center gap-1">
                <AlertCircle size={14} />
                {language === 'pt' ? 'Palavra-passe incorreta. Tente novamente.' : 'Incorrect password. Please try again.'}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 px-6 rounded-xl transition-all shadow-lg shadow-amber-600/20 active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock size={18} />
              {language === 'pt' ? 'Desbloquear PDF' : 'Unlock PDF'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 print:p-0 print:max-w-none">
      
      {/* Configuration UI - Hidden on Document/Print View */}
      {!isDocumentMode && (
        <div className="mb-8 no-print animate-in fade-in slide-in-from-bottom-4 duration-500">
          <button 
            onClick={() => navigate('/admin/reservations')}
            className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 transition-colors cursor-pointer"
          >
            <ArrowLeft size={18} />
            {language === 'pt' ? 'Voltar às Reservas' : 'Back to Reservations'}
          </button>

          {/* Feedback & Fallback Status Notice (Green bar with uniform white buttons & light shadow) */}
          {shareNotice && (
            <div className={`mb-6 p-4 rounded-2xl border text-sm font-medium animate-in fade-in slide-in-from-top-2 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 ${
              shareNotice.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900 shadow-sm' 
                : shareNotice.type === 'fallback'
                ? 'bg-amber-50 border-amber-200 text-amber-900 shadow-sm'
                : 'bg-red-50 border-red-200 text-red-900 shadow-sm'
            }`}>
              <div className="flex items-start gap-3">
                {shareNotice.type === 'success' ? (
                  <Check size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                ) : shareNotice.type === 'fallback' ? (
                  <Download size={20} className="text-amber-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold mb-0.5">
                    {shareNotice.type === 'fallback' 
                      ? (language === 'pt' ? 'Ficheiro PDF Gerado e Descarregado' : 'PDF File Generated & Downloaded')
                      : shareNotice.type === 'success'
                      ? (language === 'pt' ? 'Operação Concluída' : 'Operation Completed')
                      : (language === 'pt' ? 'Aviso' : 'Notice')}
                  </p>
                  <p className="text-xs opacity-90">{shareNotice.message}</p>
                </div>
              </div>

              {/* Action Buttons: Clean neutral buttons with subtle borders */}
              <div className="flex flex-wrap items-center gap-2 self-end md:self-center shrink-0">
                {/* 💾 1. Save/Download PDF */}
                <button
                  onClick={handleDownloadPdf}
                  disabled={isGeneratingPdf}
                  className="h-10 px-4 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  title={language === 'pt' ? 'Guardar Ficheiro PDF no Computador' : 'Save PDF File to Computer'}
                >
                  <Download size={15} className="text-gray-700" />
                  {language === 'pt' ? 'Guardar PDF' : 'Save PDF'}
                </button>

                {/* 👁 2. Open PDF */}
                <button
                  onClick={handleOpenPdf}
                  disabled={isGeneratingPdf}
                  className="h-10 px-4 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Eye size={15} className="text-gray-700" />
                  {language === 'pt' ? 'Abrir PDF' : 'Open PDF'}
                </button>

                {/* 🖨 3. Print */}
                <button
                  onClick={handlePrint}
                  className="h-10 px-4 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Printer size={15} className="text-gray-700" />
                  {language === 'pt' ? 'Imprimir' : 'Print'}
                </button>

                {/* 📤 4. Share PDF */}
                <button
                  onClick={handleSharePdf}
                  disabled={isSharingPdf}
                  className="h-10 px-4 bg-white hover:bg-gray-50 text-gray-800 border border-gray-200 rounded-xl text-xs font-bold shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Share2 size={15} className="text-gray-700" />
                  {copied ? (language === 'pt' ? 'Copiado!' : 'Copied!') : (language === 'pt' ? 'Partilhar' : 'Share')}
                </button>

                {/* 🎨 5. Color / Black & White Mode Toggle (Moved to the end, icon-only, half-B&W / colorful gradient bg) */}
                <button
                  onClick={() => setPdfColorMode(prev => prev === 'color' ? 'bw' : 'color')}
                  className={`w-10 h-10 rounded-xl shadow-sm hover:scale-105 active:scale-95 transition-all flex items-center justify-center cursor-pointer border shrink-0 ${
                    pdfColorMode === 'bw'
                      ? 'bg-[linear-gradient(90deg,#ffffff_50%,#000000_50%)] border-gray-400'
                      : 'bg-gradient-to-r from-red-500 via-amber-400 via-emerald-400 via-blue-500 to-purple-500 border-white/60'
                  }`}
                  title={
                    pdfColorMode === 'bw'
                      ? (language === 'pt' ? 'Modo Preto e Branco (Clique para Colorido)' : 'Black & White Mode (Click for Color)')
                      : (language === 'pt' ? 'Modo Colorido (Clique para Preto e Branco)' : 'Color Mode (Click for Black & White)')
                  }
                >
                  <Palette 
                    size={16} 
                    className={
                      pdfColorMode === 'bw' 
                        ? 'mix-blend-difference text-white filter drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]' 
                        : 'text-white filter drop-shadow-[0_1px_2px_rgba(0,0,0,0.6)]'
                    } 
                  />
                </button>
              </div>
            </div>
          )}

          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-2">
              <h2 className="text-xl font-bold text-gray-900">
                {language === 'pt' ? 'Imprimir e Partilhar Reservas por Área' : 'Print & Share Area Reservations'}
              </h2>

              {/* Generate PDF Button placed at Top Right of the Element */}
              <button 
                onClick={handleGeneratePdf}
                disabled={isGeneratingPdf}
                style={{ backgroundColor: settings?.primaryColor || '#d97706' }}
                className="h-10 px-5 text-white rounded-xl text-xs font-bold shadow-sm hover:opacity-90 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border-0 shrink-0 self-start sm:self-auto"
              >
                {isGeneratingPdf ? (
                  <span className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : (
                  <FileText size={16} />
                )}
                {language === 'pt' ? 'Gerar PDF' : 'Generate PDF'}
              </button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'pt' ? 'Data' : 'Date'}
                </label>
                <input 
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-400 outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'pt' ? 'Área' : 'Area'}
                </label>
                <select
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-400 outline-none"
                >
                  <option value="all">{language === 'pt' ? 'Todas as Áreas' : 'All Areas'}</option>
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {language === 'pt' ? 'Serviço' : 'Service'}
                </label>
                <select
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-400 outline-none"
                >
                  <option value="all">{language === 'pt' ? 'Todos os Serviços' : 'All Services'}</option>
                  <option value="lunch">{language === 'pt' ? 'Almoço' : 'Lunch'}</option>
                  <option value="dinner">{language === 'pt' ? 'Jantar' : 'Dinner'}</option>
                </select>
              </div>

              <div className="flex flex-col justify-center">
                <label className="flex items-center gap-2 cursor-pointer mt-6">
                  <input 
                    type="checkbox"
                    checked={includeCancelled}
                    onChange={(e) => setIncludeCancelled(e.target.checked)}
                    className="w-4 h-4 text-gray-900 focus:ring-gray-500 border-gray-300 rounded"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {language === 'pt' ? 'Incluir Canceladas' : 'Include Cancelled'}
                  </span>
                </label>
              </div>
            </div>
          </div>
          
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">
            {language === 'pt' ? 'Pré-visualização de Impressão (A4)' : 'Print Preview (A4)'}
          </h3>
        </div>
      )}

      {/* The actual A4 document sheet layout - Single Source of Truth for Print & PDF */}
      <div 
        ref={documentRef}
        className={`print-sheet bg-white mx-auto shadow-2xl rounded-sm overflow-hidden print:shadow-none print:m-0 print:p-0 relative ${
          pdfColorMode === 'bw' ? 'grayscale contrast-125' : ''
        }`}
        style={{ maxWidth: '210mm', minHeight: '297mm' }}
      >
        {/* Light Watermark in center of document sheet */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none overflow-hidden z-0">
          {displayLogoSrc ? (
            <img 
              src={displayLogoSrc} 
              alt="" 
              className="w-96 h-96 object-contain transform -rotate-12 opacity-[0.05]" 
            />
          ) : (
            <div className="text-center opacity-[0.04] transform -rotate-12 select-none">
              <p className="text-8xl font-black uppercase tracking-widest text-gray-900">
                {settings?.name || 'RESTAURANT'}
              </p>
            </div>
          )}
        </div>

        <div className="px-6 py-6 print:p-0 relative z-10">
          
          {/* Document Header */}
          <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-900 relative z-10">
            <div>
              <h1 className="text-2xl font-black text-gray-900 uppercase tracking-wide">
                {settings?.name || 'Restaurant'}
              </h1>
              <h2 className="text-sm font-bold uppercase tracking-widest mt-0.5 text-amber-700">
                {language === 'pt' ? 'RESERVAS DE ' : 'RESERVATIONS — '} {sectionName}
              </h2>
              <div className="text-xs text-gray-600 font-semibold space-y-0.5 mt-2">
                <p className="text-gray-900 font-bold">{formatPtDate(date, language)}</p>
                <p className="capitalize">
                  {service === 'all' 
                    ? (language === 'pt' ? 'Todos os Serviços (Almoço & Jantar)' : 'All Services (Lunch & Dinner)') 
                    : (service === 'lunch' ? (language === 'pt' ? 'Almoço' : 'Lunch') : (language === 'pt' ? 'Jantar' : 'Dinner'))}
                </p>
              </div>
            </div>

            {/* Top Right Restaurant Logo */}
            <div className="text-right shrink-0">
              {displayLogoSrc ? (
                <img 
                  src={displayLogoSrc} 
                  alt={settings?.name || 'Logo'} 
                  className="h-16 w-auto max-w-[160px] object-contain ml-auto" 
                />
              ) : (
                <div 
                  className="w-12 h-12 rounded-xl text-white font-black text-lg flex items-center justify-center shadow-sm ml-auto"
                  style={{ backgroundColor: settings?.primaryColor || '#d97706' }}
                >
                  {(settings?.name || 'R').substring(0, 2).toUpperCase()}
                </div>
              )}
            </div>
          </div>

          {/* Reservation Tables */}
          {resLoading ? (
            <div className="text-center py-8 text-gray-500">{language === 'pt' ? 'A carregar...' : 'Loading...'}</div>
          ) : filteredReservations.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl relative z-10">
              <p className="text-gray-500 font-medium">
                {language === 'pt' ? 'Nenhuma reserva encontrada para esta área e data.' : 'No reservations found for this area and date.'}
              </p>
            </div>
          ) : service === 'all' ? (
            <>
              {/* Separate Lunch and Dinner sections when service === 'all' */}
              {renderReservationTableBlock(
                lunchReservations, 
                language === 'pt' ? 'Almoço' : 'Lunch', 
                <Sun size={15} className="text-amber-600" />, 
                'border-amber-600 text-amber-900'
              )}

              {renderReservationTableBlock(
                dinnerReservations, 
                language === 'pt' ? 'Jantar' : 'Dinner', 
                <Moon size={15} className="text-indigo-600" />, 
                'border-indigo-600 text-indigo-900'
              )}
            </>
          ) : (
            renderReservationTableBlock(filteredReservations)
          )}

          {/* Summary Cards */}
          {!resLoading && filteredReservations.length > 0 && (
            <div className="mt-8 border-t-2 border-gray-900 pt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-semibold relative z-10">
              <div className={`p-2.5 rounded-xl text-center border ${pdfColorMode === 'bw' ? 'bg-white border-black text-black' : 'bg-amber-50/70 border-amber-200/80'}`}>
                <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">{language === 'pt' ? 'Total Reservas' : 'Total Reservations'}</p>
                <p className={`text-base font-black ${pdfColorMode === 'bw' ? 'text-black' : 'text-amber-900'}`}>{filteredReservations.length}</p>
              </div>

              <div className={`p-2.5 rounded-xl text-center border ${pdfColorMode === 'bw' ? 'bg-white border-black text-black' : 'bg-emerald-50/70 border-emerald-200/80'}`}>
                <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">{language === 'pt' ? 'Total Pessoas' : 'Total Guests'}</p>
                <p className={`text-base font-black ${pdfColorMode === 'bw' ? 'text-black' : 'text-emerald-900'}`}>{totalGuests} pax</p>
              </div>

              <div className={`p-2.5 rounded-xl text-center border ${pdfColorMode === 'bw' ? 'bg-white border-black text-black' : 'bg-blue-50/70 border-blue-200/80'}`}>
                <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">{language === 'pt' ? 'Capacidade' : 'Capacity'}</p>
                <p className={`text-base font-black ${pdfColorMode === 'bw' ? 'text-black' : 'text-blue-900'}`}>{sectionCapacity} lug.</p>
              </div>

              <div className={`p-2.5 rounded-xl text-center border ${pdfColorMode === 'bw' ? 'bg-white border-black text-black' : 'bg-purple-50/70 border-purple-200/80'}`}>
                <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">{language === 'pt' ? 'Ocup. Total' : 'Total Occup.'}</p>
                <p className={`text-base font-black ${pdfColorMode === 'bw' ? 'text-black' : 'text-purple-900'}`}>{occupancyPercentage}%</p>
              </div>

              <div className={`p-2.5 rounded-xl text-center border ${pdfColorMode === 'bw' ? 'bg-white border-black text-black' : 'bg-amber-100/60 border-amber-300/80'}`}>
                <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">{language === 'pt' ? 'Ocup. Almoço' : 'Lunch Occup.'}</p>
                <p className={`text-base font-black ${pdfColorMode === 'bw' ? 'text-black' : 'text-amber-900'}`}>{lunchOccupancyPercentage}%</p>
                <p className="text-[9px] text-gray-500 font-medium">{lunchGuests} pax</p>
              </div>

              <div className={`p-2.5 rounded-xl text-center border ${pdfColorMode === 'bw' ? 'bg-white border-black text-black' : 'bg-indigo-50/70 border-indigo-200/80'}`}>
                <p className="text-gray-500 uppercase tracking-wider text-[9px] mb-0.5">{language === 'pt' ? 'Ocup. Jantar' : 'Dinner Occup.'}</p>
                <p className={`text-base font-black ${pdfColorMode === 'bw' ? 'text-black' : 'text-indigo-900'}`}>{dinnerOccupancyPercentage}%</p>
                <p className="text-[9px] text-gray-500 font-medium">{dinnerGuests} pax</p>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  );
}

