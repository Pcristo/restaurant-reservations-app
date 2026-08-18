import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  Home, 
  ArrowLeft, 
  LayoutDashboard, 
  Calendar, 
  Phone, 
  Mail, 
  Compass, 
  UtensilsCrossed 
} from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import { useLanguage } from '../hooks/useLanguage';
import { useAuth } from '../hooks/useAuth';
import { getOptimizedUrl, cn } from '../lib/utils';
import { APP_CONFIG } from '../data/appConfig';

const DEFAULT_BG_IMAGE = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&q=80&w=2070';

export default function NotFound() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const { language, t } = useLanguage();
  const { user, isAdmin, isStaff, isCustomer } = useAuth();

  // Check if admin configured a custom background / hero image in settings
  const adminCustomImage = 
    settings?.heroImageUrl || 
    (settings?.useCloudinary && settings?.cloudinaryHeroImageUrl) || 
    (settings as any)?.backgroundImage ||
    settings?.footerImageUrl ||
    (settings?.useCloudinary && settings?.cloudinaryFooterImageUrl);

  const bgImageUrl = adminCustomImage 
    ? getOptimizedUrl(adminCustomImage, settings, 'hero') 
    : DEFAULT_BG_IMAGE;

  const logo = settings?.logoUrl || (settings?.useCloudinary && settings?.cloudinaryLogoUrl);
  const restaurantName = settings?.name || APP_CONFIG.appName;
  const isDark = settings?.theme === 'dark';

  const primaryBtnStyle: React.CSSProperties = {
    backgroundColor: settings?.primaryColor || '#ea580c',
    borderRadius: settings?.buttonBorderRadius || undefined,
  };

  const cardStyle: React.CSSProperties = {
    borderRadius: settings?.boxBorderRadius || '1.5rem',
  };

  return (
    <div 
      id="not-found-page"
      className="relative min-h-[calc(100vh-4rem)] flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(3, 15, 32, 0.75), rgba(3, 15, 32, 0.88)), url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Decorative Blur Backing */}
      <div className="absolute inset-0 backdrop-blur-[2px] pointer-events-none" />

      {/* Main 404 Container Card */}
      <motion.div
        id="not-found-card"
        initial={{ opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        style={cardStyle}
        className={cn(
          "relative z-10 w-full max-w-xl p-8 sm:p-12 shadow-2xl border text-center flex flex-col items-center",
          isDark 
            ? "bg-gray-900/90 border-gray-800/80 text-gray-200 backdrop-blur-md" 
            : "bg-white/95 border-gray-100/80 text-gray-800 backdrop-blur-md"
        )}
      >
        {/* Top Header: Brand Logo / Restaurant Name */}
        <div className="w-full flex items-center justify-center mb-6">
          <div className="flex items-center gap-3">
            {logo && (
              <img 
                src={getOptimizedUrl(logo, settings, 'logo')} 
                alt={restaurantName} 
                className="h-10 w-auto object-contain max-w-[140px]"
                referrerPolicy="no-referrer"
              />
            )}
            {restaurantName && (
              <span className={cn(
                "font-bold text-base sm:text-lg tracking-tight truncate max-w-[260px] sm:max-w-[340px]",
                isDark ? "text-white" : "text-gray-900"
              )}>
                {restaurantName}
              </span>
            )}
          </div>
        </div>

        {/* 404 Visual Icon & Code */}
        <div className="relative my-2 flex flex-col items-center justify-center">
          <div className="p-4 rounded-3xl bg-amber-500/10 text-amber-500 mb-3 animate-pulse">
            <Compass size={44} className="animate-spin" style={{ animationDuration: '18s' }} />
          </div>

          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-2">
            {t('notfound.badge')}
          </div>

          <h1 className={cn(
            "text-6xl sm:text-7xl font-black tracking-tight",
            isDark ? "text-white" : "text-gray-900"
          )}>
            404
          </h1>
        </div>

        {/* Informative Text */}
        <div className="space-y-2.5 my-4 max-w-md">
          <h2 className={cn(
            "text-2xl sm:text-3xl font-extrabold tracking-tight",
            isDark ? "text-white" : "text-gray-900"
          )}>
            {t('notfound.title')}
          </h2>
          <p className={cn(
            "text-sm sm:text-base leading-relaxed font-normal",
            isDark ? "text-gray-400" : "text-gray-600"
          )}>
            {t('notfound.desc')}
          </p>
        </div>

        {/* Navigation Action Buttons */}
        <div className="w-full flex flex-col sm:flex-row items-center justify-center gap-3 mt-6">
          <Link
            id="not-found-home-btn"
            to="/"
            style={primaryBtnStyle}
            className="w-full sm:w-auto flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 text-white font-bold text-sm shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer"
          >
            <UtensilsCrossed size={18} />
            <span>{t('notfound.book_table')}</span>
          </Link>

          <button
            id="not-found-back-btn"
            type="button"
            onClick={() => navigate(-1)}
            className={cn(
              "w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3 font-semibold text-sm border rounded-xl transition-all cursor-pointer active:scale-98",
              isDark 
                ? "border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white" 
                : "border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100 hover:text-gray-900"
            )}
            style={{ borderRadius: settings?.buttonBorderRadius || undefined }}
          >
            <ArrowLeft size={16} />
            <span>{t('notfound.go_back')}</span>
          </button>
        </div>

        {/* Role-Specific Quick Navigation */}
        {(isAdmin || isStaff || isCustomer) && (
          <div className="w-full pt-6 mt-6 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            {(isAdmin || isStaff) && (
              <Link
                id="not-found-admin-btn"
                to="/admin"
                className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-500 transition-colors"
              >
                <LayoutDashboard size={14} />
                <span>{t('notfound.admin_dashboard')}</span>
              </Link>
            )}
            {isCustomer && (
              <Link
                id="not-found-bookings-btn"
                to="/my-bookings"
                className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-500 transition-colors"
              >
                <Calendar size={14} />
                <span>{t('notfound.my_bookings')}</span>
              </Link>
            )}
          </div>
        )}

        {/* Contact Info Footer if available */}
        {(settings?.phone || settings?.email) && (
          <div className={cn(
            "w-full pt-6 mt-6 border-t space-y-2 text-xs",
            isDark ? "border-gray-800 text-gray-400" : "border-gray-100 text-gray-500"
          )}>
            <p className="font-medium">
              {t('notfound.need_help')} {t('notfound.contact_us')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4 font-semibold">
              {settings?.phone && (
                <a
                  id="not-found-phone-link"
                  href={`tel:${settings.phone}`}
                  className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-500 transition-colors"
                >
                  <Phone size={13} />
                  <span>{settings.phone}</span>
                </a>
              )}
              {settings?.email && (
                <a
                  id="not-found-email-link"
                  href={`mailto:${settings.email}`}
                  className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-500 transition-colors"
                >
                  <Mail size={13} />
                  <span>{settings.email}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
