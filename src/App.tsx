import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { LanguageProvider, useLanguage } from './hooks/useLanguage';
import { NotificationProvider } from './hooks/useNotifications';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import 'dayjs/locale/pt';
import 'dayjs/locale/en';
import { useSettings } from './hooks/useSettings';
import Layout from './components/Layout';
import PublicBooking from './pages/PublicBooking';
import PublicCancel from './pages/PublicCancel';
import Login from './pages/Login';
import CustomerDashboard from './pages/CustomerDashboard';
import AdminDashboard from './pages/AdminDashboard';
import AdminSettings from './pages/AdminSettings';
import AdminTables from './pages/AdminTables';
import AdminReservations from './pages/AdminReservations';
import AdminPrintSection from './pages/AdminPrintSection';
import AdminCustomers from './pages/AdminCustomers';
import AdminUsers from './pages/AdminUsers';
import AdminLiveView from './pages/AdminLiveView';
import AdminInsights from './pages/AdminInsights';
import AdminCustomerStats from './pages/AdminCustomerStats';
import PrivacyPolicy from './pages/PrivacyPolicy';
import TermsAndConditions from './pages/TermsAndConditions';
import CookiePolicy from './pages/CookiePolicy';
import Maintenance from './pages/Maintenance';
import DevelopingApp from './pages/DevelopingApp';
import Instructions from './pages/Instructions';
import NotFound from './pages/NotFound';

import toast, { Toaster, ToastBar, useToasterStore } from 'react-hot-toast';
import { X } from 'lucide-react';
import ScrollToTop from './components/ScrollToTop';
import { FreezeOverlay } from './components/FreezeOverlay';
import CookieConsent from './components/CookieConsent';
import { BookingNotificationListener } from './components/BookingNotificationListener';
import Preloader from './components/Preloader';
import { updateFavicon } from './lib/utils';

function ProtectedRoute({ children, role }: { children: React.ReactNode, role?: 'admin' | 'staff' | 'customer' }) {
  const { user, loading, isAdmin, isStaff, isCustomer } = useAuth();
  const location = useLocation();
  const { language } = useLanguage();

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  if (!user) {
    const isStaffRoute = location.pathname.startsWith('/admin');
    const dest = isStaffRoute ? "/login?role=staff" : "/login?role=customer";
    return <Navigate to={dest} state={{ from: location }} replace />;
  }
  
  if (role === 'admin' && !isAdmin) return <Navigate to="/admin" />;
  if (role === 'staff' && !isStaff) {
    setTimeout(() => {
      // Use standard alert or dispatch an event, but toast from react-hot-toast can be called outside of render
      toast.error(language === 'pt' ? 'O acesso à área de Administração é restrito.' : 'Access to the Admin area is restricted.', { id: 'admin-restricted' });
    }, 100);
    return <Navigate to="/" />;
  }
  if (role === 'customer' && !isCustomer && !isStaff) return <Navigate to="/" />;

  return <>{children}</>;
}


const PageWrapper = ({ children }: { children: React.ReactNode }) => {
  const { settings } = useSettings();
  const transitionsEnabled = settings?.enablePageTransitions !== false;

  if (!transitionsEnabled) {
    return <div className="w-full h-full min-h-screen">{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.3 }}
      className="w-full h-full min-h-screen"
    >
      {children}
    </motion.div>
  );
};

function AppContent() {
  const { loading: authLoading, isAdmin, isStaff } = useAuth();
  const { settings, loading: settingsLoading } = useSettings();
  const [showPreloader, setShowPreloader] = React.useState(true);
  const [developingUnlocked, setDevelopingUnlocked] = React.useState(() => sessionStorage.getItem('app_developing_unlocked') === 'true');
  const location = useLocation();
  const { language } = useLanguage();

  const prevEnabledRef = React.useRef<boolean | undefined>(undefined);
  const prevPasswordRef = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    if (settings) {
      if (!settings.developingModeEnabled) {
        sessionStorage.removeItem('app_developing_unlocked');
        setDevelopingUnlocked(false);
      } else {
        // If developing mode was just enabled, or if the password has changed, relock the app
        if (
          prevEnabledRef.current === false ||
          (prevPasswordRef.current !== undefined && settings.developingPassword !== prevPasswordRef.current)
        ) {
          sessionStorage.removeItem('app_developing_unlocked');
          setDevelopingUnlocked(false);
        }
      }
      prevEnabledRef.current = settings.developingModeEnabled;
      prevPasswordRef.current = settings.developingPassword;
    }
  }, [settings?.developingModeEnabled, settings?.developingPassword]);

  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= 3)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  useEffect(() => {
    // Hide preloader when both are loaded OR after a max timeout
    if (!authLoading && !settingsLoading) {
      const timer = setTimeout(() => {
        setShowPreloader(false);
      }, 300); // Small buffer for smooth transition
      return () => clearTimeout(timer);
    }
    
    // Safety fallback: hide after 1.5 seconds regardless
    const safetyTimer = setTimeout(() => {
      setShowPreloader(false);
    }, 1500);

    return () => clearTimeout(safetyTimer);
  }, [authLoading, settingsLoading]);

  useEffect(() => {
    if (settings) {
      if (settings.name) {
        document.title = settings.name;
      }
      if (settings.fontFamily) {
        document.documentElement.style.setProperty('--font-family', `"${settings.fontFamily}"`);
      }
      if (settings.primaryColor) {
        document.documentElement.style.setProperty('--primary-color', settings.primaryColor);
      } else {
        document.documentElement.style.setProperty('--primary-color', '#f77408');
      }
      if (settings.buttonBorderRadius) {
        document.documentElement.style.setProperty('--button-radius', settings.buttonBorderRadius);
      } else {
        document.documentElement.style.removeProperty('--button-radius');
      }
      if (settings.boxBorderRadius) {
        document.documentElement.style.setProperty('--box-radius', settings.boxBorderRadius);
      } else {
        document.documentElement.style.removeProperty('--box-radius');
      }
      if (settings.inputBorderRadius) {
        document.documentElement.style.setProperty('--input-radius', settings.inputBorderRadius);
      } else {
        document.documentElement.style.removeProperty('--input-radius');
      }
      if (settings.theme) {
        document.documentElement.setAttribute('data-theme', settings.theme);
      } else {
        document.documentElement.setAttribute('data-theme', 'light');
      }
      updateFavicon(settings.faviconUrl, settings);
    } else {
      updateFavicon(undefined, null);
    }
  }, [settings]);

  const isLoginPage = location.pathname === '/login';
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isStaffOrAdmin = isAdmin || isStaff;
  const isDevelopingActive = settings?.developingModeEnabled && !developingUnlocked && !isLoginPage && !isAdminRoute;
  const isMaintenanceActive = settings?.maintenanceModeEnabled && !isStaffOrAdmin && !isLoginPage;

  if (isDevelopingActive) {
    return (
      <>
        <AnimatePresence>
          {showPreloader && <Preloader />}
        </AnimatePresence>
        <ScrollToTop />
        <DevelopingApp onUnlock={() => {
          setDevelopingUnlocked(true);
          sessionStorage.setItem('app_developing_unlocked', 'true');
        }} />
      </>
    );
  }

  if (isMaintenanceActive) {
    return (
      <>
        <AnimatePresence>
          {showPreloader && <Preloader />}
        </AnimatePresence>
        <ScrollToTop />
        <Maintenance />
      </>
    );
  }

  return (
    <>
      <AnimatePresence>
        {showPreloader && <Preloader />}
      </AnimatePresence>
      <ScrollToTop />
      <Toaster position="top-right">
        {(t) => (
          <ToastBar toast={t}>
            {({ icon, message }) => (
              <>
                {icon}
                {message}
                {t.type !== 'loading' && (
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="p-1 rounded-full hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700 ml-auto cursor-pointer flex items-center justify-center"
                    aria-label="Close"
                    id={`dismiss-toast-${t.id}`}
                  >
                    <X size={16} />
                  </button>
                )}
              </>
            )}
          </ToastBar>
        )}
      </Toaster>
      <FreezeOverlay />
      <CookieConsent />
      <BookingNotificationListener />
      <Layout>
        <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname + '-' + language}>
        <Route path="/" element={<PageWrapper><PublicBooking /></PageWrapper>} />
        <Route path="/cancel/:id" element={<PageWrapper><PublicCancel /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/privacy" element={<PageWrapper><PrivacyPolicy /></PageWrapper>} />
        <Route path="/terms" element={<PageWrapper><TermsAndConditions /></PageWrapper>} />
        <Route path="/cookies" element={<PageWrapper><CookiePolicy /></PageWrapper>} />
        
        {/* Customer Routes */}
        <Route path="/my-bookings" element={<PageWrapper>
          <ProtectedRoute role="customer">
            <CustomerDashboard />
          </ProtectedRoute>
        </PageWrapper>} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={<PageWrapper>
          <ProtectedRoute role="staff">
            <AdminDashboard />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/live" element={<PageWrapper>
          <ProtectedRoute role="staff">
            <AdminLiveView />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/print/section" element={<PageWrapper><ProtectedRoute role="staff"><AdminPrintSection /></ProtectedRoute></PageWrapper>} />
        <Route path="/admin/print/section-document" element={<PageWrapper><ProtectedRoute role="staff"><AdminPrintSection /></ProtectedRoute></PageWrapper>} />
        <Route path="/print/shared-pdf" element={<PageWrapper><AdminPrintSection isPublicShared={true} /></PageWrapper>} />
        <Route path="/admin/reservations" element={<PageWrapper>
          <ProtectedRoute role="staff">
            <AdminReservations />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/tables" element={<PageWrapper>
          <ProtectedRoute role="staff">
            <AdminTables />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/customers" element={<PageWrapper>
          <ProtectedRoute role="staff">
            <AdminCustomers />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/insights" element={<PageWrapper>
          <ProtectedRoute role="admin">
            <AdminInsights />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/customer-stats" element={<PageWrapper>
          <ProtectedRoute role="admin">
            <AdminCustomerStats />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/settings" element={<PageWrapper>
          <ProtectedRoute role="admin">
            <AdminSettings />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/users" element={<PageWrapper>
          <ProtectedRoute role="admin">
            <AdminUsers />
          </ProtectedRoute>
        </PageWrapper>} />
        <Route path="/admin/instructions" element={<PageWrapper>
          <ProtectedRoute role="staff">
            <Instructions />
          </ProtectedRoute>
        </PageWrapper>} />

        {/* 404 Page Not Found */}
        <Route path="*" element={<PageWrapper><NotFound /></PageWrapper>} />
      </Routes>
      </AnimatePresence>
    </Layout>
    </>
  );
}

function LocalizedApp() {
  const { language } = useLanguage();
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={language}>
      <NotificationProvider>
        <AuthProvider>
          <Router>
            <AppContent />
          </Router>
        </AuthProvider>
      </NotificationProvider>
    </LocalizationProvider>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <LocalizedApp />
    </LanguageProvider>
  );
}
