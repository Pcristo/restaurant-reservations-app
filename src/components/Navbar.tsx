import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { useNotifications } from '../hooks/useNotifications';
import { useSmartAlerts } from '../hooks/useSmartAlerts';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { LogIn, LogOut, Menu, X, LayoutDashboard, Calendar, Users, Settings, Globe, Bell, Phone, Mail, Sparkles, Eye, ShieldAlert, HelpCircle, BarChart3, WifiOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { cn, getOptimizedUrl } from '../lib/utils';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { APP_CONFIG } from '../data/appConfig';

export default function Navbar() {
  const { user, signIn, logout, isAdmin, isStaff } = useAuth();
  const { settings } = useSettings();
  const { language, setLanguage, t } = useLanguage();
  const { hasNewBookings, setHasNewBookings, newBookingsList, clearNotificationBookings, removeNotificationBooking } = useNotifications();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = React.useState(false);
  const [isPopupOpen, setIsPopupOpen] = React.useState(false);
  const [fetchedBookings, setFetchedBookings] = React.useState<any[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);
  const [exitPendingTarget, setExitPendingTarget] = React.useState<{ path?: string; action?: () => void; isLogout?: boolean } | null>(null);
  const location = useLocation();

  const handleNavigationAttempt = (e: React.MouseEvent, targetPath?: string, action?: () => void) => {
    const isLogout = action !== undefined && targetPath === undefined;
    const isCurrentlyInAdmin = location.pathname.startsWith('/admin');
    const isStaffOrAdmin = isAdmin || isStaff;

    // Only confirm when leaving the admin section entirely or logging out
    const isLeavingAdmin = !targetPath || !targetPath.startsWith('/admin');

    if (isLogout) {
      e.preventDefault();
      setExitPendingTarget({ path: targetPath, action, isLogout: true });
    } else if (isCurrentlyInAdmin && isStaffOrAdmin && isLeavingAdmin) {
      e.preventDefault();
      setExitPendingTarget({ path: targetPath, action, isLogout: false });
    } else {
      if (action) {
        action();
      }
    }
  };

  const confirmExit = () => {
    if (!exitPendingTarget) return;
    const { path, action } = exitPendingTarget;
    setExitPendingTarget(null);
    if (action) {
      action();
    } else if (path) {
      navigate(path);
    }
  };

  const cancelExit = () => {
    setExitPendingTarget(null);
  };

  const { isOnline, syncState, statusText, shortStatusText } = useNetworkSync();
  const { smartAlerts, loading } = useSmartAlerts();
  const smartAlertsCount = smartAlerts.length;

  React.useEffect(() => {
    if (isPopupOpen && newBookingsList.length === 0) {
      const fetchRecentBookings = async () => {
        setIsFetching(true);
        try {
          const q = query(
            collection(db, 'reservations'),
            where('source', '==', 'public'),
            orderBy('createdAt', 'desc'),
            limit(5)
          );
          const snap = await getDocs(q);
          const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setFetchedBookings(list);
        } catch (error) {
          console.error("Error fetching recent public bookings:", error);
        } finally {
          setIsFetching(false);
        }
      };
      fetchRecentBookings();
    } else {
      setFetchedBookings([]);
    }
  }, [isPopupOpen, newBookingsList]);

    const bookingsToShow = (newBookingsList.length > 0 ? newBookingsList : fetchedBookings).filter(b => {
    if (b.source !== 'public') return false;
    const todayStr = new Date().toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
    return b.date >= todayStr;
  });

  const formatBookingDate = (dateStr: string) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  const navLinks = [
    { name: t('nav.book'), path: '/', public: true },
    { name: t('nav.website'), path: settings?.websiteUrl || '#', public: true, external: true },
    { name: t('nav.my_bookings'), path: '/my-bookings', customer: true },
    { name: t('nav.dashboard'), path: '/admin', admin: true, staff: true },
    { name: t('nav.live_view'), path: '/admin/live', admin: true, staff: true },
    { name: t('nav.reservations'), path: '/admin/reservations', admin: true, staff: true },
    { name: t('nav.customers'), path: '/admin/customers', admin: true, staff: true },
  ];

  const filteredLinks = navLinks.filter(link => {
    if (link.external && (!settings?.websiteUrl || settings.websiteUrl === '#')) return false;
    if (link.path === '/' && (isAdmin || isStaff)) return false;
    if (link.public) return true;
    if (link.customer && user?.role === 'customer') return true;
    if (link.admin && isAdmin) return true;
    if (link.staff && isStaff) return true;
    return false;
  });

  const handleBookClick = (e: React.MouseEvent) => {
    if (location.pathname === '/') {
      e.preventDefault();
      const bookingSection = document.getElementById('booking-section');
      if (bookingSection) {
        bookingSection.scrollIntoView({ behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 600, behavior: 'smooth' });
      }
    }
  };

  return (
    <nav id="navbar-top" className={cn(
      "border-b fixed top-0 left-0 right-0 z-[100] transition-colors duration-300",
      settings?.theme === 'dark' 
        ? "bg-gray-950 border-gray-800 text-white" 
        : "bg-white border-gray-200 text-gray-900"
    )}>
      {/* Secondary Admin Top Bar */}
      {isAdmin && (
        <div className="bg-gray-900 text-gray-400 py-1.5 px-4 sm:px-6 lg:px-8 border-b border-gray-800">
          <div className={cn("mx-auto flex justify-end items-center gap-6 text-[10px] font-bold uppercase tracking-widest", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
            <Link 
              to="/admin/insights" 
              onClick={(e) => handleNavigationAttempt(e, '/admin/insights')}
              className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <BarChart3 size={12} className="text-gray-500" /> {language === 'pt' ? 'ESTATÍSTICAS' : 'INSIGHTS'}
            </Link>
            <Link 
              to="/admin/users" 
              onClick={(e) => handleNavigationAttempt(e, '/admin/users')}
              className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <Users size={12} className="text-gray-500" /> {t('nav.users')}
            </Link>
            <Link 
              to="/admin/settings" 
              onClick={(e) => handleNavigationAttempt(e, '/admin/settings')}
              className="hover:text-amber-400 transition-colors flex items-center gap-1.5"
            >
              <Settings size={12} className="text-gray-500" /> {t('nav.settings')}
            </Link>
          </div>
        </div>
      )}
      <div className={cn("mx-auto px-4 sm:px-6 lg:px-8", settings?.containerWidth === '1480px' ? "w-full max-w-[1480px]" : "w-full max-w-[1267px]")}>
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link 
              to="/" 
              className="flex-shrink-0 flex items-center gap-2"
            >
              {settings?.showLogo !== false && (
                settings?.logoUrl || settings?.cloudinaryLogoUrl ? (
                  <img 
                    src={getOptimizedUrl(settings?.logoUrl, settings, 'logo')} 
                    alt="Logo" 
                    className="w-auto object-contain" 
                    style={{ height: `${settings?.logoSize || 32}px` }}
                    referrerPolicy="no-referrer" 
                  />
                ) : (
                  <div className="h-8 w-8 bg-amber-600 rounded-lg flex items-center justify-center text-white font-bold">
                    {settings?.name ? settings.name.charAt(0).toUpperCase() : 'D'}
                  </div>
                )
              )}
              {settings?.showRestaurantName !== false && (
                <span className={cn(
                  "font-bold text-xl hidden sm:block transition-colors duration-300",
                  settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  {settings?.name || APP_CONFIG.appName}
                </span>
              )}
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden min-[1240px]:flex items-center space-x-4">
            {filteredLinks.map((link) => {
              if (link.external) {
                return (
                  <a
                    key={link.path}
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                      settings?.theme === 'dark' 
                        ? "text-gray-200 hover:bg-gray-800 hover:text-white" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {link.name}
                  </a>
                );
              }

              const isReservationsLink = link.path === '/admin/reservations';

              return (
                <React.Fragment key={link.path}>
                  <Link
                    to={link.path === '/' && location.pathname !== '/' ? '/?scrollTo=booking' : link.path}
                    onClick={(e) => {
                      if (link.path === '/') {
                        handleNavigationAttempt(e, link.path, () => handleBookClick(e));
                      } else {
                        handleNavigationAttempt(e, link.path);
                      }
                    }}
                    className={cn(
                      "px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-1.5",
                      location.pathname === link.path
                        ? (settings?.theme === 'dark' ? "bg-amber-900/40 text-amber-400" : "bg-amber-50 text-amber-700")
                        : (settings?.theme === 'dark' 
                            ? "text-gray-300 hover:bg-gray-800 hover:text-white" 
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")
                    )}
                  >
                    {link.name}
                    {link.path === '/admin' && smartAlertsCount > 0 && (
                      <span className="relative flex h-2.5 w-2.5 ml-1.5 -mt-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                      </span>
                    )}
                  </Link>

                  {isReservationsLink && hasNewBookings && (isAdmin || isStaff) && (
                    <div className="relative group/nav">
                      <button
                        type="button"
                        onClick={() => setIsPopupOpen(true)}
                        className={cn(
                          "px-3 py-2 rounded-md text-sm font-bold transition-colors flex items-center gap-1.5 cursor-pointer relative",
                          settings?.theme === 'dark'
                            ? "bg-amber-950/50 text-amber-400 border border-amber-900/30 hover:bg-amber-900/20"
                            : "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100/50"
                        )}
                      >
                        <Sparkles size={14} className="text-amber-500 animate-pulse" />
                        <span>{language === 'pt' ? 'Novas Reservas' : 'New Bookings'}</span>
                        <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                      </button>

                      {/* Desktop Dropdown Menu on Hover */}
                      {bookingsToShow.length > 0 && (
                        <div className={cn(
                          "absolute right-0 top-full mt-1 w-96 rounded-xl shadow-xl border p-3 z-50 pointer-events-none group-hover/nav:pointer-events-auto opacity-0 group-hover/nav:opacity-100 translate-y-2 group-hover/nav:translate-y-0 transition-all duration-200 space-y-2.5 text-left",
                          settings?.theme === 'dark'
                            ? "bg-gray-900 border-gray-800 text-white"
                            : "bg-white border-gray-100 text-gray-900"
                        )}>
                          <div className="flex items-center justify-between border-b pb-2 mb-1.5 border-gray-200 dark:border-gray-800">
                            <span className="text-xs font-bold flex items-center gap-1.5">
                              <Sparkles size={13} className="text-amber-500 animate-spin" style={{ animationDuration: '3s' }} />
                              {language === 'pt' ? 'Novas Reservas' : 'New Bookings'}
                            </span>
                            <button
                              onClick={() => {
                                clearNotificationBookings();
                                setFetchedBookings([]);
                              }}
                              className="text-[10px] text-amber-600 dark:text-amber-400 font-bold hover:underline cursor-pointer"
                            >
                              {language === 'pt' ? 'Limpar Tudo' : 'Dismiss All'}
                            </button>
                          </div>
                          
                          <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                            {bookingsToShow.map((booking) => (
                              <div
                                key={booking.id}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeNotificationBooking(booking.id);
                                  setFetchedBookings(prev => prev.filter(b => b.id !== booking.id));
                                  navigate(`/admin/reservations?date=${booking.date}&search=${encodeURIComponent(booking.customerName)}`);
                                }}
                                className={cn(
                                  "p-2.5 rounded-lg border flex items-center justify-between transition-all hover:border-amber-500/40 cursor-pointer text-left",
                                  settings?.theme === 'dark' 
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
                                      <Calendar size={10} className="text-amber-500" />
                                      {formatBookingDate(booking.date)} @ {booking.time}
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
                                      setFetchedBookings(prev => prev.filter(b => b.id !== booking.id));
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
                                      setFetchedBookings(prev => prev.filter(b => b.id !== booking.id));
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
                      )}
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {syncState === 'offline' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/25 animate-pulse ml-2" title={statusText}>
                <WifiOff size={13} className="text-amber-500" />
                <span>{language === 'pt' ? 'Modo Offline' : 'Offline Mode'}</span>
              </div>
            )}
            {syncState === 'syncing' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/25 ml-2" title={statusText}>
                <RefreshCw size={13} className="text-sky-500 animate-spin" />
                <span>{language === 'pt' ? 'A sincronizar...' : 'Syncing...'}</span>
              </div>
            )}
            {syncState === 'synced' && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 ml-2" title={statusText}>
                <CheckCircle2 size={13} className="text-emerald-500" />
                <span>{language === 'pt' ? 'Sincronizado' : 'Synced'}</span>
              </div>
            )}

            {settings?.showLanguageSwitch !== false && (
              <div className={cn(
                "flex items-center rounded-lg p-1 ml-2 transition-colors duration-300",
                settings?.theme === 'dark' ? "bg-gray-900" : "bg-gray-100"
              )}>
                <button
                  onClick={() => setLanguage('en')}
                  className={cn(
                    "px-2 py-1 text-xs font-bold rounded-md transition-all",
                    language === 'en' 
                      ? (settings?.theme === 'dark' ? "bg-gray-800 text-amber-400 shadow-sm" : "bg-white text-amber-600 shadow-sm") 
                      : (settings?.theme === 'dark' ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                  )}
                >
                  EN
                </button>
                <button
                  onClick={() => setLanguage('pt')}
                  className={cn(
                    "px-2 py-1 text-xs font-bold rounded-md transition-all",
                    language === 'pt' 
                      ? (settings?.theme === 'dark' ? "bg-gray-800 text-amber-400 shadow-sm" : "bg-white text-amber-600 shadow-sm") 
                      : (settings?.theme === 'dark' ? "text-gray-500 hover:text-gray-300" : "text-gray-500 hover:text-gray-700")
                  )}
                >
                  PT
                </button>
              </div>
            )}
            
            {user ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={(e) => handleNavigationAttempt(e, undefined, logout)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                    settings?.theme === 'dark' 
                      ? "text-gray-300 hover:bg-gray-800 hover:text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <LogOut size={18} />
                  <span>{t('nav.logout')}</span>
                </button>
                {isStaff && (
                  <Link
                    to="/admin/instructions"
                    title={language === 'pt' ? 'Instruções da App' : 'App Instructions'}
                    className={cn(
                      "p-2 rounded-md transition-colors cursor-pointer flex items-center justify-center",
                      settings?.theme === 'dark' 
                        ? "text-gray-300 hover:bg-gray-800 hover:text-white" 
                        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                    )}
                  >
                    <HelpCircle size={20} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/login?role=customer"
                  className={cn(
                    "px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    settings?.theme === 'dark' 
                      ? "text-gray-300 hover:bg-gray-800 hover:text-white" 
                      : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/login?role=customer&mode=signup"
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-md transition-colors shadow-sm"
                >
                  <LogIn size={18} />
                  <span>{t('nav.signup')}</span>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="min-[1240px]:hidden flex items-center gap-3">
            {syncState === 'offline' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/25 animate-pulse">
                <WifiOff size={11} className="text-amber-500" />
                <span>{language === 'pt' ? 'Offline' : 'Offline'}</span>
              </div>
            )}
            {syncState === 'syncing' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-sky-500/10 text-sky-500 border border-sky-500/25">
                <RefreshCw size={11} className="text-sky-500 animate-spin" />
                <span>{language === 'pt' ? 'Sync...' : 'Sync...'}</span>
              </div>
            )}
            {syncState === 'synced' && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/25">
                <CheckCircle2 size={11} className="text-emerald-500" />
                <span>{language === 'pt' ? 'OK' : 'OK'}</span>
              </div>
            )}
            <button
              onClick={() => setIsOpen(!isOpen)}
              className={cn(
                "inline-flex items-center justify-center p-2 rounded-md transition-colors",
                settings?.theme === 'dark' 
                  ? "text-gray-400 hover:text-white hover:bg-gray-800" 
                  : "text-gray-400 hover:text-gray-500 hover:bg-gray-100"
              )}
            >
              {isOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className={cn(
          "min-[1240px]:hidden transition-colors border-b duration-300",
          settings?.theme === 'dark' ? "bg-gray-950 border-gray-800 text-white" : "bg-white border-gray-200"
        )}>
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {filteredLinks.map((link) => {
              if (link.external) {
                return (
                  <a
                    key={link.path}
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "block px-3 py-2 rounded-md text-base font-medium transition-colors",
                      settings?.theme === 'dark' 
                        ? "text-gray-300 hover:bg-gray-800 hover:text-white" 
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    )}
                  >
                    {link.name}
                  </a>
                );
              }

              const isReservationsLink = link.path === '/admin/reservations';

              return (
                <React.Fragment key={link.path}>
                  <Link
                    to={link.path === '/' && location.pathname !== '/' ? '/?scrollTo=booking' : link.path}
                    onClick={(e) => {
                      setIsOpen(false);
                      if (link.path === '/') {
                        handleNavigationAttempt(e, link.path, () => handleBookClick(e));
                      } else {
                        handleNavigationAttempt(e, link.path);
                      }
                    }}
                    className={cn(
                      "block px-3 py-2 rounded-md text-base font-medium transition-colors relative",
                      location.pathname === link.path
                        ? (settings?.theme === 'dark' ? "bg-amber-900/40 text-amber-400" : "bg-amber-50 text-amber-700")
                        : (settings?.theme === 'dark' 
                            ? "text-gray-300 hover:bg-gray-800 hover:text-white" 
                            : "text-gray-600 hover:bg-gray-50 hover:text-gray-900")
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{link.name}</span>
                        {link.path === '/admin' && smartAlertsCount > 0 && (
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {isReservationsLink && hasNewBookings && (isAdmin || isStaff) && (
                    <div className="pl-3 pr-3 pt-1 pb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          setIsPopupOpen(true);
                        }}
                        className={cn(
                          "w-full text-left block px-3 py-2.5 rounded-md text-base font-bold transition-colors relative cursor-pointer",
                          settings?.theme === 'dark'
                            ? "bg-amber-950/40 text-amber-400 border border-amber-900/20 hover:bg-amber-950/60"
                            : "bg-amber-50 text-amber-700 border border-amber-100 hover:bg-amber-100/40"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <Sparkles size={16} className="text-amber-500 animate-pulse" />
                            {language === 'pt' ? 'Novas Reservas' : 'New Bookings'}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold ml-1.5 animate-pulse">
                              {bookingsToShow.length}
                            </span>
                          </span>
                          <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
                        </div>
                      </button>
                    </div>
                  )}
                </React.Fragment>
              );
            })}

            {settings?.showLanguageSwitch !== false && (
              <div className="flex items-center gap-4 px-3 py-2">
                <span className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Globe size={16} /> {t('nav.language')}:
                </span>
                <div className={cn(
                  "flex rounded-lg p-1 transition-colors duration-300",
                  settings?.theme === 'dark' ? "bg-gray-900" : "bg-gray-100"
                )}>
                  <button
                    onClick={() => { setLanguage('en'); setIsOpen(false); }}
                    className={cn(
                      "px-4 py-1 text-sm font-bold rounded-md transition-all",
                      language === 'en' 
                        ? (settings?.theme === 'dark' ? "bg-gray-800 text-amber-400 shadow-sm" : "bg-white text-amber-600 shadow-sm") 
                        : "text-gray-500"
                    )}
                  >
                    EN
                  </button>
                  <button
                    onClick={() => { setLanguage('pt'); setIsOpen(false); }}
                    className={cn(
                      "px-4 py-1 text-sm font-bold rounded-md transition-all",
                      language === 'pt' 
                        ? (settings?.theme === 'dark' ? "bg-gray-800 text-amber-400 shadow-sm" : "bg-white text-amber-600 shadow-sm") 
                        : "text-gray-500"
                    )}
                  >
                    PT
                  </button>
                </div>
              </div>
            )}

            {user ? (
              <div className="space-y-1">
                <button
                  onClick={(e) => {
                    setIsOpen(false);
                    handleNavigationAttempt(e, undefined, logout);
                  }}
                  className={cn(
                    "w-full text-left flex items-center gap-2 px-3 py-2 text-base font-medium rounded-md transition-colors cursor-pointer",
                    settings?.theme === 'dark' ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  <LogOut size={18} />
                  <span>{t('nav.logout')}</span>
                </button>
                {isStaff && (
                  <Link
                    to="/admin/instructions"
                    title={language === 'pt' ? 'Instruções da App' : 'App Instructions'}
                    onClick={() => setIsOpen(false)}
                    className={cn(
                      "w-full text-left flex items-center gap-2 px-3 py-2 text-base font-medium rounded-md transition-colors cursor-pointer",
                      settings?.theme === 'dark' ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <HelpCircle size={18} />
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                <Link
                  to="/login?role=customer"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "block px-3 py-2 text-base font-medium rounded-md transition-colors",
                    settings?.theme === 'dark' ? "text-gray-300 hover:bg-gray-800" : "text-gray-700 hover:bg-gray-100"
                  )}
                >
                  {t('nav.login')}
                </Link>
                <Link
                  to="/login?role=customer&mode=signup"
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 text-base font-medium rounded-md transition-colors",
                    settings?.theme === 'dark' ? "text-amber-400 hover:bg-gray-800" : "text-amber-600 hover:bg-amber-50"
                  )}
                >
                  <LogIn size={18} />
                  <span>{t('nav.signup')}</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {isPopupOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPopupOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", duration: 0.5 }}
              className={cn(
                "relative w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden border z-10 flex flex-col max-h-[85vh]",
                settings?.theme === 'dark' 
                  ? "bg-gray-900 border-gray-800 text-white" 
                  : "bg-white border-gray-100 text-gray-900"
              )}
            >
              {/* Header */}
              <div className={cn(
                "p-6 border-b flex items-center justify-between",
                settings?.theme === 'dark' ? "border-gray-800 bg-gray-950/40" : "border-gray-100 bg-gray-50/50"
              )}>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl animate-pulse">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-none">
                      {language === 'pt' ? 'Novas Reservas Recebidas' : 'New Bookings Received'}
                    </h3>
                    <p className={cn(
                      "text-xs mt-1.5",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' 
                        ? 'As reservas recebidas mais recentemente na plataforma' 
                        : 'Most recently received bookings on the platform'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsPopupOpen(false)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    settings?.theme === 'dark' ? "hover:bg-gray-800 text-gray-400 hover:text-white" : "hover:bg-gray-100 text-gray-500 hover:text-gray-900"
                  )}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Content body */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                {isFetching ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                    <p className={cn(
                      "text-sm font-medium",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' ? 'A carregar reservas recentes...' : 'Loading recent bookings...'}
                    </p>
                  </div>
                ) : bookingsToShow.length === 0 ? (
                  <div className="text-center py-12">
                    <Calendar size={48} className="mx-auto text-gray-400 mb-3" />
                    <p className={cn(
                      "text-sm font-medium",
                      settings?.theme === 'dark' ? "text-gray-400" : "text-gray-500"
                    )}>
                      {language === 'pt' ? 'Nenhuma nova reserva encontrada.' : 'No new bookings found.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {newBookingsList.length === 0 && (
                      <div className={cn(
                        "p-3 rounded-xl text-xs flex items-center gap-2 mb-2 font-medium",
                        settings?.theme === 'dark' ? "bg-amber-950/20 text-amber-400 border border-amber-900/30" : "bg-amber-50 text-amber-800 border border-amber-100"
                      )}>
                        <Bell size={14} className="shrink-0 animate-bounce" />
                        <span>
                          {language === 'pt'
                            ? 'A mostrar as 5 reservas públicas mais recentes obtidas do servidor.'
                            : 'Showing the 5 most recent public bookings retrieved from the server.'}
                        </span>
                      </div>
                    )}
                    
                    {bookingsToShow.map((booking) => (
                      <div
                        key={booking.id}
                        className={cn(
                          "p-3 rounded-xl border flex items-center justify-between transition-colors hover:border-amber-500/40 text-left",
                          settings?.theme === 'dark' ? "bg-gray-900 border-gray-800" : "bg-gray-50 border-gray-200"
                        )}
                      >
                        <div 
                          onClick={() => {
                            removeNotificationBooking(booking.id);
                            setFetchedBookings(prev => prev.filter(b => b.id !== booking.id));
                            setIsPopupOpen(false);
                            navigate(`/admin/reservations?date=${booking.date}&search=${encodeURIComponent(booking.customerName)}`);
                          }}
                          className="flex-1 min-w-0 space-y-1 hover:opacity-80 transition-opacity cursor-pointer group"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn(
                              "font-bold text-sm transition-colors group-hover:text-amber-600",
                              settings?.theme === 'dark' ? "text-white" : "text-gray-900"
                            )}>
                              {booking.customerName}
                            </span>
                            <span className={cn(
                              "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider",
                              booking.status === 'confirmed' 
                                ? "bg-emerald-500/10 text-emerald-500" 
                                : booking.status === 'pending'
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-gray-500/10 text-gray-500"
                            )}>
                              {booking.status}
                            </span>
                            {booking.date === format(new Date(), 'yyyy-MM-dd') && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20 animate-pulse">
                                {language === 'pt' ? 'Reserva de Hoje' : 'Today Booking'}
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2 text-[10px] text-gray-500 dark:text-gray-400">
                            <span className="flex items-center gap-1">
                              <Calendar size={11} className="text-amber-500" />
                              <strong>{formatBookingDate(booking.date)}</strong> @ {booking.time}
                            </span>
                            <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-gray-600" />
                            <span className="flex items-center gap-1">
                              <Users size={11} className="text-blue-500" />
                              <strong>{booking.guests}</strong> {t('common.guests')}
                            </span>
                          </div>

                          {booking.notes && (
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-medium truncate mt-1 max-w-md">
                              <span className="text-amber-600 dark:text-amber-500 font-semibold">
                                {language === 'pt' ? 'Obs' : 'Notes'}:
                              </span>{' '}
                              {booking.notes}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => {
                              removeNotificationBooking(booking.id);
                              setFetchedBookings(prev => prev.filter(b => b.id !== booking.id));
                              setIsPopupOpen(false);
                              navigate(`/admin/reservations?date=${booking.date}&search=${encodeURIComponent(booking.customerName)}`);
                            }}
                            className="px-2.5 py-1.5 text-[11px] font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap shadow-sm active:scale-95"
                          >
                            <Eye size={12} />
                            {language === 'pt' ? 'Ver' : 'See'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              removeNotificationBooking(booking.id);
                              setFetchedBookings(prev => prev.filter(b => b.id !== booking.id));
                              if (bookingsToShow.length <= 1) {
                                setIsPopupOpen(false);
                              }
                            }}
                            className="p-1.5 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-all cursor-pointer"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className={cn(
                "p-6 border-t flex flex-col sm:flex-row items-center justify-between gap-3",
                settings?.theme === 'dark' ? "border-gray-800 bg-gray-950/40" : "border-gray-100 bg-gray-50/50"
              )}>
                <button
                  type="button"
                  onClick={() => {
                    clearNotificationBookings();
                    setFetchedBookings([]);
                    setIsPopupOpen(false);
                    navigate('/admin/reservations');
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl font-bold text-sm bg-amber-600 hover:bg-amber-700 text-white shadow-lg shadow-amber-600/10 active:scale-95 transition-all text-center cursor-pointer"
                >
                  {language === 'pt' ? 'Limpar Tudo e Ir para Reservas' : 'Dismiss All & Go to Reservations'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsPopupOpen(false);
                  }}
                  className={cn(
                    "w-full sm:w-auto px-5 py-2.5 rounded-xl font-semibold text-sm transition-all text-center cursor-pointer",
                    settings?.theme === 'dark'
                      ? "bg-gray-800 hover:bg-gray-700 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  )}
                >
                  {language === 'pt' ? 'Fechar' : 'Close'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Confirmation Popup on Exiting Admin Section */}
      <AnimatePresence>
        {exitPendingTarget && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={cancelExit}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className={cn(
                "relative w-full max-w-md rounded-2xl p-6 shadow-2xl border z-10",
                settings?.theme === 'dark'
                  ? "bg-gray-900 border-gray-800 text-white"
                  : "bg-white border-gray-100 text-gray-900"
              )}
            >
              <div className="flex items-center gap-3 mb-4 text-amber-500">
                <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                  {exitPendingTarget.isLogout ? <LogOut size={24} /> : <ShieldAlert size={24} />}
                </div>
                <h3 className="font-bold text-lg leading-tight">
                  {exitPendingTarget.isLogout 
                    ? (language === 'pt' ? 'Confirmar Fim de Sessão' : 'Confirm Logout')
                    : (language === 'pt' ? 'Confirmar Saída' : 'Confirm Exit')}
                </h3>
              </div>
              
              <p className={cn(
                "text-sm mb-6 leading-relaxed",
                settings?.theme === 'dark' ? "text-gray-300" : "text-gray-600"
              )}>
                {exitPendingTarget.isLogout
                  ? (language === 'pt' 
                      ? 'Tem a certeza de que deseja terminar a sua sessão?' 
                      : 'Are you sure you want to log out of your session?')
                  : (language === 'pt' 
                      ? 'Tem a certeza de que deseja sair desta secção de administração? Quaisquer alterações não guardadas poderão ser perdidas.'
                      : 'Are you sure you want to exit this admin section? Any unsaved changes may be lost.')}
              </p>
              
              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={cancelExit}
                  className={cn(
                    "px-4 py-2 text-xs font-bold rounded-xl border transition-colors cursor-pointer",
                    settings?.theme === 'dark'
                      ? "border-gray-800 hover:bg-gray-800 text-gray-300"
                      : "border-gray-200 hover:bg-gray-50 text-gray-700"
                  )}
                >
                  {language === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="button"
                  onClick={confirmExit}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-md shadow-amber-600/10"
                >
                  {language === 'pt' ? 'Confirmar' : 'Confirm'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </nav>
  );
}
